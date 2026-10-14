use crate::error::AppError;
use axum::{
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use std::{
    path::{Path, PathBuf},
    time::SystemTime,
};
use tokio::fs;

#[tracing::instrument(level = "debug", skip_all)]
pub async fn validate_path(root: &PathBuf, path: &str) -> Result<PathBuf, AppError> {
    let requested = Path::new(&path);

    if requested.is_absolute() {
        tracing::warn!(reason = "absolute_path", "path validation rejected");
        return Err(AppError::BadRequest(
            "Absolute paths are not allowed".to_string(),
        ));
    }

    let root = fs::canonicalize(root).await.map_err(|error| {
        tracing::error!(%error, operation = "canonicalize_root", "filesystem operation failed");
        AppError::Internal
    })?;

    let path = root.join(path);

    if !path.exists() {
        tracing::warn!(reason = "path_missing", "path validation rejected");
        return Err(AppError::BadRequest("Path doesn't exist".to_string()));
    }

    let candidate = fs::canonicalize(root.join(path))
        .await
        .map_err(|error| {
            tracing::error!(%error, operation = "canonicalize_requested_path", "filesystem operation failed");
            AppError::Internal
        })?;

    if !candidate.starts_with(&root) {
        tracing::warn!(reason = "outside_root", "path validation rejected");
        return Err(AppError::BadRequest("Path doesn't exist".to_string()));
    }

    Ok(candidate)
}

// HTTP UTILS

pub fn handle_if_modified_since(
    headers: &HeaderMap,
    last_modified: SystemTime,
) -> Option<Response> {
    let if_modified_since = headers
        .get(header::IF_MODIFIED_SINCE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| httpdate::parse_http_date(value).ok());

    if let Some(if_modified_since) = if_modified_since
        && last_modified <= if_modified_since
    {
        let response = (
            StatusCode::NOT_MODIFIED,
            [(
                header::LAST_MODIFIED,
                httpdate::fmt_http_date(last_modified),
            )],
        )
            .into_response();

        return Some(response);
    }

    None
}

pub fn parse_range_header(range: &HeaderValue, file_size: u64) -> Result<(u64, u64), AppError> {
    if file_size == 0 {
        return Err(AppError::InvalidByteRange(file_size));
    }
    let range = range.to_str().map_err(|_| {
        tracing::warn!(reason = "range header invalid");
        AppError::InvalidByteRange(file_size)
    })?;

    let (unit, rng) = range
        .split_once("=")
        .ok_or(AppError::InvalidByteRange(file_size))?;

    if !unit.eq_ignore_ascii_case("bytes") {
        return Err(AppError::InvalidByteRange(file_size));
    }

    let (start, end) = rng
        .split_once("-")
        .ok_or(AppError::InvalidByteRange(file_size))?;

    if start.is_empty() {
        let suffix = end
            .trim()
            .parse::<u64>()
            .map_err(|_| AppError::InvalidByteRange(file_size))?;
        if suffix == 0 {
            return Err(AppError::InvalidByteRange(file_size));
        }
        return Ok((file_size.saturating_sub(suffix), file_size - 1));
    }

    let start = start
        .trim()
        .parse::<u64>()
        .map_err(|_| AppError::InvalidByteRange(file_size))?;

    if start >= file_size {
        return Err(AppError::InvalidByteRange(file_size));
    }

    if end.is_empty() {
        return Ok((start, file_size - 1));
    }

    let end = end
        .trim()
        .parse::<u64>()
        .map_err(|_| AppError::InvalidByteRange(file_size))?;

    if end < start {
        return Err(AppError::InvalidByteRange(file_size));
    }

    let end = end.min(file_size - 1);

    Ok((start, end))
}

pub enum ContentDisposition {
    Inline,
    Attachment,
    FormData,
}

impl std::fmt::Display for ContentDisposition {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ContentDisposition::Inline => write!(f, "inline"),
            ContentDisposition::Attachment => write!(f, "attachment"),
            ContentDisposition::FormData => write!(f, "form-data"),
        }
    }
}

pub fn content_disposition(filename: &str, disposition: ContentDisposition) -> String {
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

    format!("{disposition}; filename=\"{fallback}\"; filename*=UTF-8''{encoded}")
}

pub fn extract_http_mimetype(extension: String) -> String {
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
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "m4v" => "video/mp4",
        "mov" => "video/quicktime",
        "mkv" => "video/x-matroska",
        "zip" => "application/zip",
        "gz" => "application/gzip",
        _ => "application/octet-stream",
    }
    .to_string()
}
