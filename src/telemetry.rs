use axum::{extract::Request, http::HeaderValue, middleware::Next, response::Response};
use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::Instant,
};
use tracing::Instrument;

static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(1);

pub async fn log_request(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_owned();
    let started = Instant::now();
    let request_id = REQUEST_COUNTER.fetch_add(1, Ordering::Relaxed);

    let span = tracing::info_span!(
        "http_request",
        id = %request_id,
        method = %method,
        path = %path,
    );

    let mut response = next.run(request).instrument(span.clone()).await;
    response
        .headers_mut()
        .insert("X-Request-ID", HeaderValue::from(request_id));

    {
        let _guard = span.enter();
        tracing::info!(
            status = response.status().as_u16(),
            elapsed_ms = started.elapsed().as_secs_f64() * 1000.0,
            "request handled"
        );
    }

    response
}
