use axum::extract::{Query, State};
use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use tokio::fs;

use crate::{error::AppError, state::AppState, utils::validate_path};

#[derive(Deserialize)]
pub struct DeleteFileBody {
    path: String,
}

pub async fn delete_file(
    State(state): State<AppState>,
    Json(body): Json<DeleteFileBody>,
) -> Result<Response, AppError> {
    let target_file = validate_path(&state.root, &body.path).await?;

    if !target_file.is_file() {
        return Err(AppError::BadRequest("Invalid File".to_string()));
    }

    fs::remove_file(target_file)
        .await
        .map_err(|_| AppError::Internal)?;

    return Ok(StatusCode::NO_CONTENT.into_response());
}
