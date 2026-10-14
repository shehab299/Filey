mod config;
mod error;
mod handlers;
mod state;
mod telemetry;
mod utils;

use axum::{
    Router,
    extract::DefaultBodyLimit,
    middleware,
    routing::{delete, get, post},
};
use state::AppState;
use std::error::Error;

use crate::handlers::{
    directory::{create_dir, delete_dir, list_directory},
    download::*,
};
use crate::handlers::{file::delete_file, upload::*};

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let subscriber = tracing_subscriber::FmtSubscriber::new();
    tracing::subscriber::set_global_default(subscriber)?;

    config::load()?;

    let state = AppState {
        root: config::root()?,
    };

    let api_router = Router::new()
        .route("/upload", post(upload_handler))
        .layer(DefaultBodyLimit::max(1024 * 1024 * 1024))
        .route(
            "/download",
            get(download_handler).head(download_metadata_handler),
        )
        .route("/media", get(media_handler))
        .route(
            "/directory",
            post(create_dir).delete(delete_dir).get(list_directory),
        )
        .route("/file", delete(delete_file));

    let router = Router::new()
        .nest("/api/v2", api_router)
        .layer(middleware::from_fn(telemetry::log_request))
        .with_state(state);

    let tcp_socket = tokio::net::TcpListener::bind("0.0.0.0:5000").await?;

    tracing::info!(address = %tcp_socket.local_addr()?, "server is listening");

    axum::serve(tcp_socket, router).await?;

    Ok(())
}
