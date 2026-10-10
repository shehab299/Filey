mod config;
mod error;
mod handlers;
mod state;
mod telemetry;
mod utils;

use axum::{Router, middleware, routing::get};
use handlers::{download::*, files::*, root_handler};
use state::AppState;
use std::error::Error;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let subscriber = tracing_subscriber::FmtSubscriber::new();
    tracing::subscriber::set_global_default(subscriber)?;

    config::load()?;

    let state = AppState {
        root: config::root()?,
    };

    let router = Router::new()
        .route("/health", get(root_handler))
        .route("/download", get(download_handler).post(preview_handler))
        .route("/files", get(files_handler))
        .layer(middleware::from_fn(telemetry::log_request))
        .with_state(state);

    let tcp_socket = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;

    tracing::info!(address = %tcp_socket.local_addr()?, "server is listening");

    axum::serve(tcp_socket, router).await?;

    Ok(())
}
