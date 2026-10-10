use crate::error::AppError;
use std::path::{Path, PathBuf};
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
