mod config;
mod error;
mod handlers;
mod state;
mod telemetry;
mod utils;

use axum::{Router, middleware, routing::get};
use state::AppState;
use std::error::Error;

use crate::handlers::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let subscriber = tracing_subscriber::FmtSubscriber::new();
    tracing::subscriber::set_global_default(subscriber)?;

    config::load()?;

    let state = AppState {
        root: config::root()?,
    };

    let api_v2_router =
        Router::new().route("/api/v2/download", get(v2::download::download_handler));

    let api_v1_router = Router::new()
        .route(
            "/download",
            get(v1::download::download_handler).post(v1::download::preview_handler),
        )
        .route("/files", get(v1::files::files_handler));

    let router = Router::new()
        .route("/health", get(root_handler))
        .merge(api_v1_router)
        .merge(api_v2_router)
        .layer(middleware::from_fn(telemetry::log_request))
        .with_state(state);

    let tcp_socket = tokio::net::TcpListener::bind("0.0.0.0:5000").await?;

    tracing::info!(address = %tcp_socket.local_addr()?, "server is listening");

    axum::serve(tcp_socket, router).await?;

    Ok(())
}
