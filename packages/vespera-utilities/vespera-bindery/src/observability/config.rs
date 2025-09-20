//! Logging and observability configuration
//!
//! Provides configuration structures and initialization functions for
//! setting up structured logging, OpenTelemetry, and metrics collection.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Registry};
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use anyhow::Result;

/// Configuration for logging behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    /// Log level (trace, debug, info, warn, error)
    pub level: String,
    /// Whether to output logs to console
    pub console: bool,
    /// File logging configuration
    pub file: Option<FileLoggingConfig>,
    /// JSON formatting for logs
    pub json_format: bool,
    /// Include source code locations in logs
    pub with_source_location: bool,
    /// Include thread names in logs
    pub with_thread_names: bool,
    /// Include span events in logs
    pub with_span_events: bool,
}

/// Configuration for file-based logging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileLoggingConfig {
    /// Directory for log files
    pub directory: PathBuf,
    /// Base filename for log files
    pub filename: String,
    /// Log rotation strategy
    pub rotation: LogRotation,
    /// Maximum number of log files to keep
    pub max_files: Option<usize>,
}

/// Log file rotation strategies
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogRotation {
    Never,
    Hourly,
    Daily,
    Weekly,
}

impl From<LogRotation> for Rotation {
    fn from(rotation: LogRotation) -> Self {
        match rotation {
            LogRotation::Never => Rotation::NEVER,
            LogRotation::Hourly => Rotation::HOURLY,
            LogRotation::Daily => Rotation::DAILY,
            LogRotation::Weekly => Rotation::DAILY, // Approximation
        }
    }
}

/// OpenTelemetry configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenTelemetryConfig {
    /// Whether OpenTelemetry is enabled
    pub enabled: bool,
    /// Service name for tracing
    pub service_name: String,
    /// Service version
    pub service_version: String,
    /// Jaeger configuration
    pub jaeger: Option<JaegerConfig>,
    /// OTLP configuration
    pub otlp: Option<OtlpConfig>,
}

/// Jaeger tracing configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JaegerConfig {
    /// Jaeger agent endpoint
    pub agent_endpoint: String,
    /// Sample rate (0.0 to 1.0)
    pub sample_rate: f64,
}

/// OTLP (OpenTelemetry Protocol) configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OtlpConfig {
    /// OTLP endpoint
    pub endpoint: String,
    /// API key for authentication
    pub api_key: Option<String>,
}

/// Metrics configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsConfig {
    /// Whether metrics collection is enabled
    pub enabled: bool,
    /// Prometheus exporter configuration
    pub prometheus: Option<PrometheusConfig>,
}

/// Prometheus metrics exporter configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrometheusConfig {
    /// Port for metrics endpoint
    pub port: u16,
    /// Path for metrics endpoint
    pub path: String,
}

/// Combined observability configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservabilityConfig {
    /// Logging configuration
    pub logging: LoggingConfig,
    /// OpenTelemetry configuration
    pub opentelemetry: Option<OpenTelemetryConfig>,
    /// Metrics configuration
    pub metrics: Option<MetricsConfig>,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: "info".to_string(),
            console: true,
            file: None,
            json_format: false,
            with_source_location: true,
            with_thread_names: true,
            with_span_events: true,
        }
    }
}

impl Default for ObservabilityConfig {
    fn default() -> Self {
        Self {
            logging: LoggingConfig::default(),
            opentelemetry: None,
            metrics: None,
        }
    }
}

/// Initialize logging with the given configuration
pub fn init_logging(config: &LoggingConfig) -> Result<()> {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(&config.level));

    let mut layers = Vec::new();

    // Console layer
    if config.console {
        let console_layer = if config.json_format {
            tracing_subscriber::fmt::layer()
                .json()
                .with_source_location(config.with_source_location)
                .with_thread_names(config.with_thread_names)
                .with_span_events(
                    if config.with_span_events {
                        tracing_subscriber::fmt::format::FmtSpan::FULL
                    } else {
                        tracing_subscriber::fmt::format::FmtSpan::NONE
                    }
                )
                .boxed()
        } else {
            tracing_subscriber::fmt::layer()
                .with_source_location(config.with_source_location)
                .with_thread_names(config.with_thread_names)
                .with_span_events(
                    if config.with_span_events {
                        tracing_subscriber::fmt::format::FmtSpan::FULL
                    } else {
                        tracing_subscriber::fmt::format::FmtSpan::NONE
                    }
                )
                .boxed()
        };
        layers.push(console_layer);
    }

    // File layer
    if let Some(file_config) = &config.file {
        let file_appender = RollingFileAppender::new(
            file_config.rotation.clone().into(),
            &file_config.directory,
            &file_config.filename,
        );

        let file_layer = if config.json_format {
            tracing_subscriber::fmt::layer()
                .json()
                .with_writer(file_appender)
                .with_source_location(config.with_source_location)
                .with_thread_names(config.with_thread_names)
                .with_span_events(
                    if config.with_span_events {
                        tracing_subscriber::fmt::format::FmtSpan::FULL
                    } else {
                        tracing_subscriber::fmt::format::FmtSpan::NONE
                    }
                )
                .boxed()
        } else {
            tracing_subscriber::fmt::layer()
                .with_writer(file_appender)
                .with_source_location(config.with_source_location)
                .with_thread_names(config.with_thread_names)
                .with_span_events(
                    if config.with_span_events {
                        tracing_subscriber::fmt::format::FmtSpan::FULL
                    } else {
                        tracing_subscriber::fmt::format::FmtSpan::NONE
                    }
                )
                .boxed()
        };
        layers.push(file_layer);
    }

    // Initialize subscriber
    Registry::default()
        .with(env_filter)
        .with(layers)
        .try_init()?;

    tracing::info!(
        level = %config.level,
        console = config.console,
        json_format = config.json_format,
        "Logging initialized"
    );

    Ok(())
}

/// Initialize full observability stack
pub fn init_observability(config: &ObservabilityConfig) -> Result<()> {
    // Initialize logging
    init_logging(&config.logging)?;

    // Initialize OpenTelemetry if configured
    #[cfg(feature = "observability")]
    if let Some(otel_config) = &config.opentelemetry {
        init_opentelemetry(otel_config)?;
    }

    // Initialize metrics if configured
    #[cfg(feature = "metrics")]
    if let Some(metrics_config) = &config.metrics {
        init_metrics(metrics_config)?;
    }

    tracing::info!("Observability stack initialized");
    Ok(())
}

#[cfg(feature = "observability")]
fn init_opentelemetry(config: &OpenTelemetryConfig) -> Result<()> {
    use opentelemetry_sdk::{runtime::Tokio, trace::TracerProvider};
    use tracing_opentelemetry::OpenTelemetryLayer;

    if !config.enabled {
        return Ok(());
    }

    let tracer = opentelemetry_sdk::trace::TracerProvider::builder()
        .with_batch_exporter(
            opentelemetry_jaeger::new_agent_pipeline()
                .with_service_name(&config.service_name)
                .with_endpoint(&config.jaeger.as_ref().unwrap().agent_endpoint)
                .build_simple()?,
            Tokio,
        )
        .build()
        .tracer(&config.service_name);

    let telemetry_layer = OpenTelemetryLayer::new(tracer);

    // Register the OpenTelemetry layer with the existing subscriber
    tracing_subscriber::registry()
        .with(telemetry_layer)
        .try_init()?;

    tracing::info!(
        service_name = %config.service_name,
        service_version = %config.service_version,
        "OpenTelemetry initialized"
    );

    Ok(())
}

#[cfg(feature = "metrics")]
fn init_metrics(config: &MetricsConfig) -> Result<()> {
    if !config.enabled {
        return Ok(());
    }

    if let Some(prometheus_config) = &config.prometheus {
        let builder = metrics_exporter_prometheus::PrometheusBuilder::new();
        let handle = builder
            .with_http_listener(([0, 0, 0, 0], prometheus_config.port))
            .install()?;

        tracing::info!(
            port = prometheus_config.port,
            path = %prometheus_config.path,
            "Prometheus metrics exporter initialized"
        );

        // Store the handle for later use
        // TODO: Add proper handle management
    }

    Ok(())
}

#[cfg(not(feature = "observability"))]
fn init_opentelemetry(_config: &OpenTelemetryConfig) -> Result<()> {
    tracing::warn!("OpenTelemetry support not compiled in");
    Ok(())
}

#[cfg(not(feature = "metrics"))]
fn init_metrics(_config: &MetricsConfig) -> Result<()> {
    tracing::warn!("Metrics support not compiled in");
    Ok(())
}