use axum::Json;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::IntoResponse;
use serde::Serialize;
use std::error::Error;

#[derive(Debug)]
pub enum AppError {
    Internal,
    BadRequest(String),
    InvalidByteRange(u64),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Internal => write!(f, "Internal Server Error"),
            Self::BadRequest(m) => write!(f, "{m}"),
            Self::InvalidByteRange(_) => write!(f, "Range Not Satisfiable"),
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
        if let AppError::InvalidByteRange(file_size) = self {
            let mut response = StatusCode::RANGE_NOT_SATISFIABLE.into_response();
            let value = format!("bytes */{file_size}");

            response.headers_mut().insert(
                header::CONTENT_RANGE,
                HeaderValue::from_str(&value)
                    .expect("file size produces a valid Content-Range header"),
            );

            return response;
        }

        let (status, m) = match self {
            AppError::Internal => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal Server Error".to_string(),
            ),
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m),
            AppError::InvalidByteRange(_) => unreachable!(),
        };

        (status, Json(ErrorBody { error: m })).into_response()
    }
}
