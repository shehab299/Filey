use crate::{error::AppError, state::AppState, utils::validate_path};
use axum::response::Response;
use axum::{
    extract::{Multipart, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::Deserialize;
use tokio::fs::OpenOptions;
use tokio::io::AsyncWriteExt;

#[derive(Deserialize)]
pub struct UploadQuery {
    path: Option<String>,
}

#[tracing::instrument(skip_all)]
pub async fn upload_handler(
    State(state): State<AppState>,
    Query(query): Query<UploadQuery>,
    mut multipart: Multipart,
) -> Result<Response, Response> {
    let dir = validate_path(&state.root, query.path.as_deref().unwrap_or(""))
        .await
        .map_err(IntoResponse::into_response)?;

    if !dir.is_dir() {
        return Err(
            AppError::BadRequest("Provided path isn't a valid folder".to_string()).into_response(),
        );
    }

    let mut upload_counter = 0usize;

    while let Some(mut field) = multipart
        .next_field()
        .await
        .map_err(IntoResponse::into_response)?
    {
        let Some(filename) = field.file_name().map(str::to_owned) else {
            continue;
        };

        if filename.is_empty()
            || filename == "."
            || filename == ".."
            || filename.contains(['/', '\\', '\0'])
        {
            return Err(AppError::BadRequest("Invalid upload filename".to_string()).into_response());
        }

        let destination_path = dir.join(filename);

        if destination_path.exists() {
            return Err(
                AppError::BadRequest("There exists a file with this name".to_string())
                    .into_response(),
            );
        }

        let mut destination_file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&destination_path)
            .await
            .map_err(|error| {
                tracing::error!(%error, "failed to create upload");
                AppError::Internal.into_response()
            })?;

        let result: Result<(), Response> = async {
            while let Some(chunk) = field.chunk().await.map_err(IntoResponse::into_response)? {
                destination_file.write_all(&chunk).await.map_err(|error| {
                    tracing::error!(%error, "failed to write upload");
                    AppError::Internal.into_response()
                })?;
            }

            destination_file.flush().await.map_err(|error| {
                tracing::error!(%error, "failed to flush upload");
                AppError::Internal.into_response()
            })
        }
        .await;

        drop(destination_file);

        if let Err(response) = result {
            if let Err(error) = tokio::fs::remove_file(&destination_path).await {
                tracing::error!(%error, "failed to remove incomplete upload");
            }
            return Err(response);
        }

        upload_counter += 1;
    }

    if upload_counter == 0 {
        return Err(AppError::BadRequest("No files were uploaded".to_owned()).into_response());
    }

    tracing::info!(file_count = upload_counter, "upload completed");
    Ok(StatusCode::CREATED.into_response())
}
