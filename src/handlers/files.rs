use crate::utils::validate_path;
use crate::{error::AppError, state::AppState};
use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use std::os::unix::fs::MetadataExt;

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
struct FilesResponse {
    entries: Vec<Entry>,
}

#[derive(Deserialize)]
pub struct FilesParams {
    path: Option<String>,
}

#[tracing::instrument(skip_all)]
pub async fn files_handler(
    State(state): State<AppState>,
    Query(params): Query<FilesParams>,
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

    let response = FilesResponse { entries };

    Ok((StatusCode::OK, Json(response)))
}
