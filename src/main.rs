mod config;
mod error;
mod handlers;
mod state;
mod telemetry;
mod utils;

use axum::{Router, middleware, routing::get};
use state::AppState;
use std::error::Error;

use crate::handlers::download::*;
use crate::handlers::files::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let subscriber = tracing_subscriber::FmtSubscriber::new();
    tracing::subscriber::set_global_default(subscriber)?;

    config::load()?;

    let state = AppState {
        root: config::root()?,
    };

    let api_router = Router::new()
        .route(
            "download",
            get(download_handler).head(download_metadata_handler),
        )
        .route("files", get(files_handler))
        .route("media", get(media_handler));

    let router = Router::new()
        .nest("/api/v2", api_router)
        .layer(middleware::from_fn(telemetry::log_request))
        .with_state(state);

    let tcp_socket = tokio::net::TcpListener::bind("0.0.0.0:5000").await?;

    tracing::info!(address = %tcp_socket.local_addr()?, "server is listening");

    axum::serve(tcp_socket, router).await?;

    Ok(())
}
