use crate::utils::{
    ContentDisposition, content_disposition, extract_http_mimetype, handle_if_modified_since,
    parse_range_header, validate_path,
};
use crate::{error::AppError, state::AppState};
use axum::{
    body::Body,
    extract::{Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::SystemTime;
use std::{io::SeekFrom, os::unix::fs::MetadataExt, path::Path};
use tokio::fs::File;
use tokio::{
    fs::OpenOptions,
    io::{AsyncReadExt, AsyncSeekExt},
};
use tokio_util::io::ReaderStream;

struct PreparedFile {
    file: File,
    size: u64,
    start: u64,
    end: u64,
    last_modified: SystemTime,
    mime: String,
    is_partial: bool,
}

async fn prepare_file(path: PathBuf, headers: &HeaderMap) -> Result<PreparedFile, AppError> {
    if !path.is_file() {
        tracing::warn!(reason = "not_a_file", "file request rejected");
        return Err(AppError::BadRequest(
            "Provided path isn't a valid file".to_string(),
        ));
    }

    let file = OpenOptions::new()
        .read(true)
        .open(&path)
        .await
        .map_err(|error| {
            tracing::error!(%error, operation = "open_file", "filesystem operation failed");
            AppError::Internal
        })?;

    let metadata = file.metadata().await.map_err(|e| {
        tracing::error!(%e, operation = "get_file_metadata", "filesystem operation failed");
        AppError::Internal
    })?;

    let last_modified = metadata.modified().map_err(|e| {
        tracing::error!(%e, operation = "get_file_metadata", "filesystem operation failed");
        AppError::Internal
    })?;

    let size = metadata.size();

    let mut start = 0;
    let mut end = size.saturating_sub(1);
    let mut is_partial = false;

    if let Some(range) = headers.get(header::RANGE) {
        (start, end) = parse_range_header(range, size)?;
        is_partial = true;
    }

    let mime = path
        .extension()
        .map(|s| extract_http_mimetype(s.to_string_lossy().to_string()))
        .unwrap_or("application/octet-stream".to_string());

    Ok(PreparedFile {
        file,
        size,
        start,
        end,
        last_modified,
        mime,
        is_partial,
    })
}

#[derive(Serialize, Deserialize, PartialEq, Eq, Clone)]
pub enum Mode {
    #[serde(rename = "d")]
    Download,
    #[serde(rename = "p")]
    Preview,
}

#[derive(Deserialize, Clone)]
pub struct DownloadQuery {
    path: String,
    mode: Option<Mode>,
}

#[tracing::instrument(skip_all)]
pub async fn download_handler(
    State(state): State<AppState>,
    Query(query): Query<DownloadQuery>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let path = validate_path(&state.root, &query.path).await?;

    let mut f = prepare_file(path, &headers).await?;

    if let Some(response) = handle_if_modified_since(&headers, f.last_modified) {
        return Ok(response);
    }

    let length = if f.size == 0 { 0 } else { f.end - f.start + 1 };

    f.file
        .seek(SeekFrom::Start(f.start))
        .await
        .map_err(|error| {
            tracing::error!(%error, operation = "open_file", "filesystem operation failed");
            AppError::Internal
        })?;

    let stream = ReaderStream::new(f.file.take(length));
    let body = Body::from_stream(stream);

    tracing::info!(content_type = %f.mime, "file stream response prepared");

    let status_code = match f.is_partial {
        true => StatusCode::PARTIAL_CONTENT,
        false => StatusCode::OK,
    };

    let mut response = (
        status_code,
        [
            (header::CONTENT_TYPE, f.mime),
            (header::CONTENT_LENGTH, length.to_string()),
            (
                header::CONTENT_RANGE,
                format!("bytes {}-{}/{}", f.start, f.end, f.size),
            ),
            (header::ACCEPT_RANGES, "bytes".to_string()),
            (
                header::LAST_MODIFIED,
                httpdate::fmt_http_date(f.last_modified),
            ),
        ],
        body,
    )
        .into_response();

    if !f.is_partial {
        response.headers_mut().remove(header::CONTENT_RANGE);
    }

    if let Some(mode) = query.mode
        && mode == Mode::Download
    {
        let filename = Path::new(&query.path)
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| "download".to_string());

        response.headers_mut().insert(
            header::CONTENT_DISPOSITION,
            HeaderValue::from_str(&content_disposition(
                &filename,
                ContentDisposition::Attachment,
            ))
            .map_err(|error| {
                tracing::error!(%error, "failed to build attachment header");
                AppError::Internal
            })?,
        );
    }

    tracing::info!("download response prepared");
    Ok(response)
}

#[tracing::instrument(skip_all)]
pub async fn download_metadata_handler(
    State(state): State<AppState>,
    Query(query): Query<DownloadQuery>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let path = validate_path(&state.root, &query.path).await?;

    let f = prepare_file(path, &headers).await?;

    if let Some(response) = handle_if_modified_since(&headers, f.last_modified) {
        return Ok(response);
    }

    let status_code = match f.is_partial {
        true => StatusCode::PARTIAL_CONTENT,
        false => StatusCode::OK,
    };

    let mut response = (
        status_code,
        [
            (header::CONTENT_TYPE, f.mime),
            (
                header::CONTENT_LENGTH,
                (if f.size == 0 { 0 } else { f.end - f.start + 1 }).to_string(),
            ),
            (
                header::CONTENT_RANGE,
                format!("bytes {}-{}/{}", f.start, f.end, f.size),
            ),
            (header::ACCEPT_RANGES, "bytes".to_string()),
            (
                header::LAST_MODIFIED,
                httpdate::fmt_http_date(f.last_modified),
            ),
        ],
    )
        .into_response();

    if !f.is_partial {
        response.headers_mut().remove(header::CONTENT_RANGE);
    }

    Ok(response)
}

#[tracing::instrument(skip_all)]
pub async fn media_handler(
    State(state): State<AppState>,
    Query(mut query): Query<DownloadQuery>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    query.mode = Some(Mode::Preview);

    let mut response = download_handler(State(state), Query(query.clone()), headers).await?;

    let filename = Path::new(&query.path)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "download".to_string());

    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&content_disposition(&filename, ContentDisposition::Inline))
            .map_err(|_| AppError::Internal)?,
    );

    Ok(response)
}
