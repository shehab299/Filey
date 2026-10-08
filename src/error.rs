use axum::Json;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use serde::Serialize;
use std::error::Error;

#[derive(Debug)]
pub enum AppError {
    Internal,
    NotFound(String),
    BadRequest(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Internal => write!(f, "Internal Server Error"),
            Self::NotFound(m) => write!(f, "{m}"),
            Self::BadRequest(m) => write!(f, "{m}"),
        }
    }
}

impl Error for AppError {}

#[derive(Serialize)]
struct ErrorBody {
    error: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, m) = match self {
            AppError::Internal => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal Server Error".to_string(),
            ),
            AppError::NotFound(m) => (StatusCode::NOT_FOUND, m),
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m),
        };

        (status, Json(ErrorBody { error: m })).into_response()
    }
}
