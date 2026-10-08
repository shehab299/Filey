use crate::{error::AppError, state::AppState};
use axum::{
    Json,
    extract::{Query, State},
    http::{StatusCode, header},
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use std::{
    fs::OpenOptions,
    io::Read,
    os::unix::fs::MetadataExt,
    path::{Path, PathBuf},
};
use tokio::fs;

pub async fn root_handler() -> Result<impl IntoResponse, AppError> {
    Ok((StatusCode::OK, Json("Hello! I am alive".to_string())))
}

// ######################
// Download Handler
// ######################


pub async fn download_handler() -> Result<impl IntoResponse, AppError> {
    let path = "./assets/Purchase.pdf";

    let mut f = OpenOptions::new()
        .read(true)
        .open(path)
        .map_err(|_| AppError::Internal)?;

    let mut file_bytes: Vec<u8> = vec![];

    let size = f
        .read_to_end(&mut file_bytes)
        .map_err(|_| AppError::Internal)?;

    let response = (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/pdf")],
        file_bytes,
    );

    Ok(response)
}

// ######################
// Files Handler
// ######################

#[derive(Serialize)]
enum EntryType {
    File,
    Folder,
}

#[derive(Serialize)]
struct Entry {
    name: String,
    r#type: EntryType,
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

async fn validate_path(root: &PathBuf, path: &str) -> Result<PathBuf, AppError> {
    let requested = Path::new(&path);

    if requested.is_absolute() {
        return Err(AppError::BadRequest(
            "Absolute paths are not allowed".to_string(),
        ));
    }

    let root = fs::canonicalize(root)
        .await
        .map_err(|_| AppError::Internal)?;

    let candidate = fs::canonicalize(root.join(path))
        .await
        .map_err(|_| AppError::Internal)?;

    if !candidate.starts_with(&root) {
        return Err(AppError::BadRequest(
            "Path is outside the shared folder".to_string(),
        ));
    }

    Ok(candidate)
}

pub async fn files_handler(
    State(state): State<AppState>,
    Query(params): Query<FilesParams>,
) -> Result<impl IntoResponse, AppError> {
    let path = match params.path {
        Some(path) => validate_path(&state.root, &path).await?,
        None => state.root,
    };

    let dir = std::fs::read_dir(path).map_err(|_| AppError::Internal)?;

    let mut entries: Vec<Entry> = vec![];

    for entry in dir {
        if let Ok(e) = entry {
            let metadata = e.metadata().map_err(|_| AppError::Internal)?;

            let name = e.file_name().to_string_lossy().to_string();
            let r#type = match metadata.is_dir() {
                true => EntryType::Folder,
                false => EntryType::File,
            };
            let size = metadata.size();

            entries.push(Entry { name, r#type, size });
        }
    }

    let response = FilesResponse { entries };

    Ok((StatusCode::OK, Json(response)))
}
