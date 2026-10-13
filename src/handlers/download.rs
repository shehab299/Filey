use crate::utils::{handle_if_modified_since, validate_path};
use crate::{error::AppError, state::AppState};
use axum::{
    Json,
    body::Body,
    extract::{Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use std::{io::SeekFrom, os::unix::fs::MetadataExt, path::Path};
use tokio::{
    fs::OpenOptions,
    io::{AsyncReadExt, AsyncSeekExt},
};
use tokio_util::io::ReaderStream;

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

#[tracing::instrument(skip_all)]
pub async fn download_handler(
    State(state): State<AppState>,
    Query(body): Query<DownloadQuery>,
    req_headers: HeaderMap,
) -> Result<Response, AppError> {
    let filename = Path::new(&body.path)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "download".to_string());

    let rbody = DownloadRequest { path: body.path };

    let mut response = preview_handler(State(state), req_headers, Json(rbody))
        .await?
        .into_response();

    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&attachment_header(&filename)).map_err(|error| {
            tracing::error!(%error, "failed to build attachment header");
            AppError::Internal
        })?,
    );

    tracing::info!("download response prepared");

    Ok(response)
}

#[derive(Deserialize)]
pub struct DownloadRequest {
    path: String,
}

fn parse_range_header(range: &str, file_size: u64) -> Result<(u64, u64), AppError> {
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
        return Err(AppError::InvalidByteRange(file_size));
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

#[tracing::instrument(skip_all)]
pub async fn preview_handler(
    State(state): State<AppState>,
    req_headers: HeaderMap,
    Json(body): Json<DownloadRequest>,
) -> Result<impl IntoResponse, AppError> {
    let path = validate_path(&state.root, &body.path).await?;

    if !path.is_file() {
        tracing::warn!(reason = "not_a_file", "file request rejected");
        return Err(AppError::BadRequest(
            "Provided path isn't a valid file".to_string(),
        ));
    }

    let mut f = OpenOptions::new()
        .read(true)
        .open(&path)
        .await
        .map_err(|error| {
            tracing::error!(%error, operation = "open_file", "filesystem operation failed");
            AppError::Internal
        })?;

    let metadata = f.metadata().await.map_err(|e| {
        tracing::error!(%e, operation = "get_file_metadata", "filesystem operation failed");
        AppError::Internal
    })?;

    let last_modified = metadata.modified().map_err(|e| {
        tracing::error!(%e, operation = "get_file_metadata", "filesystem operation failed");
        AppError::Internal
    })?;

    if let Some(response) = handle_if_modified_since(&req_headers, last_modified) {
        return Ok(response);
    }


    let size = metadata.size();

    let mut start = 0;
    let mut end = size - 1;
    let is_partial = true;

    if let Some(range) = req_headers.get(header::RANGE) {
        let range_str = range.to_str().map_err(|_| {
            tracing::warn!(reason = "range header invalid");
            AppError::InvalidByteRange(size)
        })?;

        (start, end) = parse_range_header(range_str, size)?;
    }

    let length = end - start + 1;

    f.seek(SeekFrom::Start(start)).await.map_err(|error| {
        tracing::error!(%error, operation = "open_file", "filesystem operation failed");
        AppError::Internal
    })?;

    let stream = ReaderStream::new(f.take(end - start + 1));
    let body = Body::from_stream(stream);

    let mime = path
        .extension()
        .map(|s| extract_mimetype(s.to_string_lossy().to_string()))
        .unwrap_or("application/octet-stream".to_string());

    tracing::info!(content_type = %mime, "file stream response prepared");

    let status_code = match is_partial {
        true => StatusCode::PARTIAL_CONTENT,
        false => StatusCode::OK,
    };

    let response = (
        status_code,
        [
            (header::CONTENT_TYPE, mime),
            (header::CONTENT_LENGTH, length.to_string()),
            (
                header::CONTENT_RANGE,
                format!("bytes {start}-{end}/{length}"),
            ),
            (header::ACCEPT_RANGES, "bytes".to_string()),
            (header::LAST_MODIFIED, httpdate::fmt_http_date(last_modified)),
        ],
        body,
    ).into_response();

    Ok(response)
}

