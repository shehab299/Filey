mod error;
mod handlers;
mod state;

use axum::{Router, routing::get};
use handlers::*;
use state::AppState;
use std::{error::Error, path::PathBuf, str::FromStr};

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let state = AppState {
        root: PathBuf::from_str("./assets")?,
    };

    let router = Router::new()
        .route("/health", get(root_handler))
        .route("/download", get(download_handler))
        .route("/files", get(files_handler))
        .with_state(state);

    let tcp_socket = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;

    axum::serve(tcp_socket, router).await?;

    Ok(())
}
