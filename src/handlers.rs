use crate::{error::AppError, state::AppState};
use axum::{
    Json,
    extract::{Query, State},
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use std::{
    fs::OpenOptions,
    io::Read,
    os::unix::fs::MetadataExt,
    path::{Path, PathBuf},
};
use tokio::fs;

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

    let path = root.join(path);

    if !path.exists() {
        return Err(AppError::BadRequest("Path doesn't exist".to_string()));
    }

    let candidate = fs::canonicalize(root.join(path))
        .await
        .map_err(|_| AppError::Internal)?;

    if !candidate.starts_with(&root) {
        return Err(AppError::BadRequest("Path doesn't exist".to_string()));
    }

    Ok(candidate)
}

// ######################
// Root Handler
// ######################

pub async fn root_handler() -> Result<impl IntoResponse, AppError> {
    Ok((StatusCode::OK, Json("Hello! I am alive".to_string())))
}

// ######################
// Download Handler
// ######################

fn extract_mimetype(extension: String) -> String {
    match extension.to_ascii_lowercase().as_str() {
        "txt" => "text/plain",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" => "text/javascript",
        "json" => "application/json",
        "pdf" => "application/pdf",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "m4v" => "video/x-m4v",
        "zip" => "application/zip",
        "gz" => "application/gzip",
        _ => "application/octet-stream",
    }
    .to_string()
}


// A safe ASCII fallback plus RFC 5987 encoding preserves Unicode filenames.
fn attachment_header(filename: &str) -> String {
    let fallback: String = filename
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || " .-_".contains(character) {
                character
            } else {
                '_'
            }
        })
        .collect();
    let encoded: String = filename
        .bytes()
        .map(|byte| format!("%{byte:02X}"))
        .collect();
    format!("attachment; filename=\"{fallback}\"; filename*=UTF-8''{encoded}")
}

#[derive(Deserialize)]
pub struct DownloadQuery {
    path: String,
}

pub async fn download_handler(
    State(state): State<AppState>,
    Query(body): Query<DownloadQuery>,
) -> Result<Response, AppError> {

    let filename = Path::new(&body.path)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "download".to_string());

    let rbody = DownloadRequest {
        path: body.path
    };
    
    let mut response = preview_handler(State(state), Json(rbody))
        .await?
        .into_response();
    
    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&attachment_header(&filename)).map_err(|_| AppError::Internal)?,
    );

    Ok(response)
}

#[derive(Deserialize)]
pub struct DownloadRequest {
    path: String,
}

// POST remains available for fetching preview bytes without an attachment header.
pub async fn preview_handler(
    State(state): State<AppState>,
    Json(body): Json<DownloadRequest>,
) -> Result<impl IntoResponse, AppError> {
    
    let path = validate_path(&state.root, &body.path).await?;

    if !path.is_file() {
        return Err(AppError::BadRequest(
            "Provided path isn't a valid file".to_string(),
        ));
    }

    let mut f = OpenOptions::new()
        .read(true)
        .open(&path)
        .map_err(|_| AppError::Internal)?;

    let mut file_bytes: Vec<u8> = vec![];

    f.read_to_end(&mut file_bytes)
        .map_err(|_| AppError::Internal)?;

    let mime = path
        .extension()
        .map(|s| extract_mimetype(s.to_string_lossy().to_string()))
        .unwrap_or("application/octet-stream".to_string());

    let response = (StatusCode::OK, [(header::CONTENT_TYPE, mime)], file_bytes);

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

pub async fn files_handler(
    State(state): State<AppState>,
    Query(params): Query<FilesParams>,
) -> Result<impl IntoResponse, AppError> {
    let path = match params.path {
        Some(path) => validate_path(&state.root, &path).await?,
        None => state.root.clone(),
    };

    if !path.is_dir() {
        return Err(AppError::BadRequest(
            "Provided path isn't a valid folder".to_string(),
        ));
    }

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

            let path = e
                .path()
                .strip_prefix(&state.root)
                .map_err(|_| AppError::Internal)?
                .to_string_lossy()
                .into_owned();

            entries.push(Entry {
                name,
                r#type,
                size,
                path,
            });
        }
    }

    let response = FilesResponse { entries };

    Ok((StatusCode::OK, Json(response)))
}
