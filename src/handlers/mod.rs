pub mod v1;
pub mod v2;

use crate::error::AppError;
use axum::{Json, http::StatusCode, response::IntoResponse};

#[tracing::instrument(skip_all)]
pub async fn root_handler() -> Result<impl IntoResponse, AppError> {
    Ok((StatusCode::OK, Json("Hello! I am alive".to_string())))
}
