use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use std::os::unix::fs::MetadataExt;
use tokio::fs;

use crate::{error::AppError, state::AppState, utils::validate_path};

#[derive(Deserialize)]
pub struct CreateDirQuery {
    path: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateDirRequest {
    name: String,
}

pub async fn create_dir(
    State(state): State<AppState>,
    Query(query): Query<CreateDirQuery>,
    Json(body): Json<CreateDirRequest>,
) -> Result<Response, AppError> {
    let mut parent = state.root;

    if let Some(path) = query.path {
        parent = validate_path(&parent, &path).await?;
    }

    if body.name.is_empty()
        || body.name == "."
        || body.name == ".."
        || body.name.contains(['/', '\\', '\0'])
    {
        return Err(AppError::BadRequest("Invalid Directory Name".to_owned()));
    }

    let target_directory = parent.join(body.name);

    if target_directory.exists() {
        return Err(AppError::BadRequest(
            "There exists a file with this name".to_owned(),
        ));
    }

    fs::create_dir(target_directory)
        .await
        .map_err(|_| AppError::Internal)?;

    Ok(StatusCode::CREATED.into_response())
}

#[derive(Deserialize)]
pub struct DeleteDirRequest {
    path: String,
}

pub async fn delete_dir(
    State(state): State<AppState>,
    Json(body): Json<DeleteDirRequest>,
) -> Result<Response, AppError> {
    let target_dir = validate_path(&state.root, &body.path).await?;

    if !target_dir.is_dir() {
        return Err(AppError::BadRequest("Invalid Directory".to_string()));
    }

    fs::remove_dir_all(target_dir)
        .await
        .map_err(|_| AppError::Internal)?;

    return Ok(StatusCode::NO_CONTENT.into_response());
}

#[derive(Serialize)]
enum EntryType {
    File,
    Folder,
}

#[derive(Serialize)]
struct Entry {
    name: String,
    r#type: EntryType,
    path: String,
    size: u64,
}

#[derive(Serialize)]
struct ListDirResponse {
    entries: Vec<Entry>,
}

#[derive(Deserialize)]
pub struct ListDirQuery {
    path: Option<String>,
}

#[tracing::instrument(skip_all)]
pub async fn list_directory(
    State(state): State<AppState>,
    Query(params): Query<ListDirQuery>,
) -> Result<impl IntoResponse, AppError> {
    let path = match params.path {
        Some(path) => validate_path(&state.root, &path).await?,
        None => state.root.clone(),
    };

    if !path.is_dir() {
        tracing::warn!(reason = "not_a_directory", "directory request rejected");
        return Err(AppError::BadRequest(
            "Provided path isn't a valid folder".to_string(),
        ));
    }

    let dir = std::fs::read_dir(path).map_err(|error| {
        tracing::error!(%error, operation = "read_directory", "filesystem operation failed");
        AppError::Internal
    })?;

    let mut entries: Vec<Entry> = vec![];
    let mut skipped_entries = 0usize;

    for entry in dir {
        if let Ok(e) = entry {
            let metadata = e.metadata().map_err(|error| {
                tracing::error!(%error, operation = "read_entry_metadata", "filesystem operation failed");
                AppError::Internal
            })?;

            let name = e.file_name().to_string_lossy().to_string();
            let r#type = match metadata.is_dir() {
                true => EntryType::Folder,
                false => EntryType::File,
            };

            let size = metadata.size();

            let path = e
                .path()
                .strip_prefix(&state.root)
                .map_err(|error| {
                    tracing::error!(%error, "directory entry is outside configured root");
                    AppError::Internal
                })?
                .to_string_lossy()
                .into_owned();

            entries.push(Entry {
                name,
                r#type,
                size,
                path,
            });
        } else if let Err(error) = entry {
            skipped_entries += 1;
            tracing::warn!(%error, operation = "read_directory_entry", "directory entry skipped");
        }
    }

    tracing::info!(
        entry_count = entries.len(),
        skipped_entries,
        "directory listing prepared"
    );

    let response = ListDirResponse { entries };

    Ok((StatusCode::OK, Json(response)))
}
