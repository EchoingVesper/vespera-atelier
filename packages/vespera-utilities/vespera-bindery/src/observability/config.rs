//! Logging and observability configuration
//!
//! Provides configuration structures and initialization functions for
//! setting up structured logging, OpenTelemetry, and metrics collection.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Registry};
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use anyhow::Result;
use crate::{BinderyError, BinderyResult};

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

impl LoggingConfig {
    /// Validate the logging configuration
    pub fn validate(&self) -> BinderyResult<()> {
        // Validate log level
        let valid_levels = ["trace", "debug", "info", "warn", "error"];
        if !valid_levels.contains(&self.level.to_lowercase().as_str()) {
            return Err(BinderyError::ConfigurationError(
                format!(
                    "Invalid log level '{}'. Valid levels are: {}",
                    self.level,
                    valid_levels.join(", ")
                )
            ));
        }

        // Validate that at least one output is enabled
        if !self.console && self.file.is_none() {
            return Err(BinderyError::ConfigurationError(
                "At least one output (console or file) must be enabled for logging".to_string()
            ));
        }

        // Validate file configuration if provided
        if let Some(ref file_config) = self.file {
            file_config.validate()?;
        }

        Ok(())
    }

    /// Create a new validated logging configuration
    pub fn new() -> BinderyResult<Self> {
        let config = Self::default();
        config.validate()?;
        Ok(config)
    }

    /// Set log level with validation
    pub fn with_level(mut self, level: impl Into<String>) -> BinderyResult<Self> {
        let level = level.into();
        let valid_levels = ["trace", "debug", "info", "warn", "error"];
        if !valid_levels.contains(&level.to_lowercase().as_str()) {
            return Err(BinderyError::ConfigurationError(
                format!(
                    "Invalid log level '{}'. Valid levels are: {}",
                    level,
                    valid_levels.join(", ")
                )
            ));
        }
        self.level = level;
        Ok(self)
    }

    /// Enable file logging with validation
    pub fn with_file_logging(mut self, file_config: FileLoggingConfig) -> BinderyResult<Self> {
        file_config.validate()?;
        self.file = Some(file_config);
        Ok(self)
    }
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

impl FileLoggingConfig {
    /// Validate the file logging configuration
    pub fn validate(&self) -> BinderyResult<()> {
        // Validate directory
        if self.directory.as_os_str().is_empty() {
            return Err(BinderyError::ConfigurationError(
                "Log directory cannot be empty".to_string()
            ));
        }

        // Check if directory is absolute for better clarity
        if !self.directory.is_absolute() {
            tracing::warn!(
                "Log directory '{}' is not absolute. Logs will be relative to current working directory",
                self.directory.display()
            );
        }

        // Validate filename
        if self.filename.trim().is_empty() {
            return Err(BinderyError::ConfigurationError(
                "Log filename cannot be empty".to_string()
            ));
        }

        // Check for invalid filename characters
        let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
        if self.filename.chars().any(|c| invalid_chars.contains(&c)) {
            return Err(BinderyError::ConfigurationError(
                format!(
                    "Log filename '{}' contains invalid characters. Avoid: {}",
                    self.filename,
                    invalid_chars.iter().collect::<String>()
                )
            ));
        }

        // Validate max_files if specified
        if let Some(max_files) = self.max_files {
            if max_files == 0 {
                return Err(BinderyError::ConfigurationError(
                    "max_files must be greater than 0 if specified".to_string()
                ));
            }
            if max_files > 10000 {
                return Err(BinderyError::ConfigurationError(
                    "max_files should not exceed 10,000 to avoid filesystem issues".to_string()
                ));
            }
        }

        Ok(())
    }

    /// Create a new file logging configuration with validation
    pub fn new(
        directory: impl Into<PathBuf>,
        filename: impl Into<String>
    ) -> BinderyResult<Self> {
        let config = Self {
            directory: directory.into(),
            filename: filename.into(),
            rotation: LogRotation::Daily,
            max_files: Some(30), // Keep 30 days by default
        };
        config.validate()?;
        Ok(config)
    }
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

impl OpenTelemetryConfig {
    /// Validate the OpenTelemetry configuration
    pub fn validate(&self) -> BinderyResult<()> {
        if !self.enabled {
            return Ok(()); // Skip validation if disabled
        }

        // Validate service name
        if self.service_name.trim().is_empty() {
            return Err(BinderyError::ConfigurationError(
                "service_name cannot be empty when OpenTelemetry is enabled".to_string()
            ));
        }

        // Service name should follow OpenTelemetry naming conventions
        if self.service_name.len() > 256 {
            return Err(BinderyError::ConfigurationError(
                "service_name should not exceed 256 characters".to_string()
            ));
        }

        // Validate service version
        if self.service_version.trim().is_empty() {
            return Err(BinderyError::ConfigurationError(
                "service_version cannot be empty when OpenTelemetry is enabled".to_string()
            ));
        }

        // At least one exporter should be configured
        if self.jaeger.is_none() && self.otlp.is_none() {
            return Err(BinderyError::ConfigurationError(
                "At least one exporter (Jaeger or OTLP) must be configured when OpenTelemetry is enabled".to_string()
            ));
        }

        // Validate Jaeger configuration if provided
        if let Some(ref jaeger_config) = self.jaeger {
            jaeger_config.validate()?;
        }

        // Validate OTLP configuration if provided
        if let Some(ref otlp_config) = self.otlp {
            otlp_config.validate()?;
        }

        Ok(())
    }

    /// Create a new OpenTelemetry configuration with validation
    pub fn new(
        service_name: impl Into<String>,
        service_version: impl Into<String>
    ) -> BinderyResult<Self> {
        let config = Self {
            enabled: true,
            service_name: service_name.into(),
            service_version: service_version.into(),
            jaeger: None,
            otlp: None,
        };
        config.validate()?;
        Ok(config)
    }

    /// Enable Jaeger exporter with validation
    pub fn with_jaeger(mut self, jaeger_config: JaegerConfig) -> BinderyResult<Self> {
        jaeger_config.validate()?;
        self.jaeger = Some(jaeger_config);
        Ok(self)
    }

    /// Enable OTLP exporter with validation
    pub fn with_otlp(mut self, otlp_config: OtlpConfig) -> BinderyResult<Self> {
        otlp_config.validate()?;
        self.otlp = Some(otlp_config);
        Ok(self)
    }
}

/// Jaeger tracing configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JaegerConfig {
    /// Jaeger agent endpoint
    pub agent_endpoint: String,
    /// Sample rate (0.0 to 1.0)
    pub sample_rate: f64,
}

impl JaegerConfig {
    /// Validate the Jaeger configuration
    pub fn validate(&self) -> BinderyResult<()> {
        // Validate agent endpoint
        if self.agent_endpoint.trim().is_empty() {
            return Err(BinderyError::ConfigurationError(
                "Jaeger agent_endpoint cannot be empty".to_string()
            ));
        }

        // Basic URL validation
        if !self.agent_endpoint.starts_with("http://") && !self.agent_endpoint.starts_with("https://") {
            if !self.agent_endpoint.contains(':') {
                return Err(BinderyError::ConfigurationError(
                    format!(
                        "Jaeger agent_endpoint '{}' should be a valid URL (http://.../https://...) or host:port format",
                        self.agent_endpoint
                    )
                ));
            }
        }

        // Validate sample rate
        if !(0.0..=1.0).contains(&self.sample_rate) {
            return Err(BinderyError::ConfigurationError(
                format!(
                    "Jaeger sample_rate {} must be between 0.0 and 1.0",
                    self.sample_rate
                )
            ));
        }

        Ok(())
    }

    /// Create a new Jaeger configuration with validation
    pub fn new(
        agent_endpoint: impl Into<String>,
        sample_rate: f64
    ) -> BinderyResult<Self> {
        let config = Self {
            agent_endpoint: agent_endpoint.into(),
            sample_rate,
        };
        config.validate()?;
        Ok(config)
    }
}

/// OTLP (OpenTelemetry Protocol) configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OtlpConfig {
    /// OTLP endpoint
    pub endpoint: String,
    /// API key for authentication
    pub api_key: Option<String>,
}

impl OtlpConfig {
    /// Validate the OTLP configuration
    pub fn validate(&self) -> BinderyResult<()> {
        // Validate endpoint
        if self.endpoint.trim().is_empty() {
            return Err(BinderyError::ConfigurationError(
                "OTLP endpoint cannot be empty".to_string()
            ));
        }

        // OTLP endpoint should be a valid URL
        if !self.endpoint.starts_with("http://") && !self.endpoint.starts_with("https://") {
            return Err(BinderyError::ConfigurationError(
                format!(
                    "OTLP endpoint '{}' must be a valid HTTP/HTTPS URL",
                    self.endpoint
                )
            ));
        }

        // Validate API key if provided
        if let Some(ref api_key) = self.api_key {
            if api_key.trim().is_empty() {
                return Err(BinderyError::ConfigurationError(
                    "OTLP api_key cannot be empty if specified".to_string()
                ));
            }
            if api_key.len() < 8 {
                return Err(BinderyError::ConfigurationError(
                    "OTLP api_key should be at least 8 characters for security".to_string()
                ));
            }
        }

        Ok(())
    }

    /// Create a new OTLP configuration with validation
    pub fn new(endpoint: impl Into<String>) -> BinderyResult<Self> {
        let config = Self {
            endpoint: endpoint.into(),
            api_key: None,
        };
        config.validate()?;
        Ok(config)
    }

    /// Set API key with validation
    pub fn with_api_key(mut self, api_key: impl Into<String>) -> BinderyResult<Self> {
        let api_key = api_key.into();
        if api_key.trim().is_empty() {
            return Err(BinderyError::ConfigurationError(
                "OTLP api_key cannot be empty".to_string()
            ));
        }
        if api_key.len() < 8 {
            return Err(BinderyError::ConfigurationError(
                "OTLP api_key should be at least 8 characters for security".to_string()
            ));
        }
        self.api_key = Some(api_key);
        Ok(self)
    }
}

/// Metrics configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsConfig {
    /// Whether metrics collection is enabled
    pub enabled: bool,
    /// Prometheus exporter configuration
    pub prometheus: Option<PrometheusConfig>,
}

impl MetricsConfig {
    /// Validate the metrics configuration
    pub fn validate(&self) -> BinderyResult<()> {
        if !self.enabled {
            return Ok(()); // Skip validation if disabled
        }

        // At least one exporter should be configured when enabled
        if self.prometheus.is_none() {
            return Err(BinderyError::ConfigurationError(
                "At least one metrics exporter (Prometheus) must be configured when metrics are enabled".to_string()
            ));
        }

        // Validate Prometheus configuration if provided
        if let Some(ref prometheus_config) = self.prometheus {
            prometheus_config.validate()?;
        }

        Ok(())
    }

    /// Create a new metrics configuration with validation
    pub fn new() -> BinderyResult<Self> {
        let config = Self {
            enabled: true,
            prometheus: Some(PrometheusConfig::default()),
        };
        config.validate()?;
        Ok(config)
    }

    /// Enable Prometheus exporter with validation
    pub fn with_prometheus(mut self, prometheus_config: PrometheusConfig) -> BinderyResult<Self> {
        prometheus_config.validate()?;
        self.prometheus = Some(prometheus_config);
        Ok(self)
    }
}

/// Prometheus metrics exporter configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrometheusConfig {
    /// Port for metrics endpoint
    pub port: u16,
    /// Path for metrics endpoint
    pub path: String,
}

impl PrometheusConfig {
    /// Validate the Prometheus configuration
    pub fn validate(&self) -> BinderyResult<()> {
        // Validate port
        if self.port == 0 {
            return Err(BinderyError::ConfigurationError(
                "Prometheus port cannot be 0".to_string()
            ));
        }

        // Warn about privileged ports
        if self.port < 1024 {
            tracing::warn!(
                "Prometheus port {} is a privileged port and may require elevated permissions",
                self.port
            );
        }

        // Validate path
        if self.path.trim().is_empty() {
            return Err(BinderyError::ConfigurationError(
                "Prometheus path cannot be empty".to_string()
            ));
        }

        if !self.path.starts_with('/') {
            return Err(BinderyError::ConfigurationError(
                format!(
                    "Prometheus path '{}' must start with '/'",
                    self.path
                )
            ));
        }

        // Check for common invalid characters in paths
        if self.path.contains("//") {
            return Err(BinderyError::ConfigurationError(
                format!(
                    "Prometheus path '{}' contains double slashes '//'",
                    self.path
                )
            ));
        }

        Ok(())
    }

    /// Create a new Prometheus configuration with validation
    pub fn new(port: u16, path: impl Into<String>) -> BinderyResult<Self> {
        let config = Self {
            port,
            path: path.into(),
        };
        config.validate()?;
        Ok(config)
    }
}

impl Default for PrometheusConfig {
    fn default() -> Self {
        Self {
            port: 9090,
            path: "/metrics".to_string(),
        }
    }
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

impl ObservabilityConfig {
    /// Validate the complete observability configuration
    pub fn validate(&self) -> BinderyResult<()> {
        // Validate logging configuration
        self.logging.validate().map_err(|e| BinderyError::ConfigurationError(
            format!("Logging configuration error: {}", e)
        ))?;

        // Validate OpenTelemetry configuration if provided
        if let Some(ref otel_config) = self.opentelemetry {
            otel_config.validate().map_err(|e| BinderyError::ConfigurationError(
                format!("OpenTelemetry configuration error: {}", e)
            ))?;
        }

        // Validate metrics configuration if provided
        if let Some(ref metrics_config) = self.metrics {
            metrics_config.validate().map_err(|e| BinderyError::ConfigurationError(
                format!("Metrics configuration error: {}", e)
            ))?;
        }

        // Check for port conflicts
        self.check_port_conflicts()?;

        Ok(())
    }

    /// Check for port conflicts between different components
    fn check_port_conflicts(&self) -> BinderyResult<()> {
        let mut used_ports = std::collections::HashSet::new();

        // Check Prometheus port
        if let Some(ref metrics) = self.metrics {
            if let Some(ref prometheus) = metrics.prometheus {
                if !used_ports.insert(prometheus.port) {
                    return Err(BinderyError::ConfigurationError(
                        format!("Port {} is used by multiple services", prometheus.port)
                    ));
                }
            }
        }

        // Future: Add checks for other services that might use ports

        Ok(())
    }

    /// Create a new observability configuration with validation
    pub fn new() -> BinderyResult<Self> {
        let config = Self::default();
        config.validate()?;
        Ok(config)
    }

    /// Set logging configuration with validation
    pub fn with_logging(mut self, logging_config: LoggingConfig) -> BinderyResult<Self> {
        logging_config.validate()?;
        self.logging = logging_config;
        Ok(self)
    }

    /// Enable OpenTelemetry with validation
    pub fn with_opentelemetry(mut self, otel_config: OpenTelemetryConfig) -> BinderyResult<Self> {
        otel_config.validate()?;
        self.opentelemetry = Some(otel_config);
        Ok(self)
    }

    /// Enable metrics with validation
    pub fn with_metrics(mut self, metrics_config: MetricsConfig) -> BinderyResult<Self> {
        metrics_config.validate()?;
        self.metrics = Some(metrics_config);
        Ok(self)
    }
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
    // Validate configuration before initialization
    config.validate().map_err(|e| anyhow::anyhow!("Logging configuration validation failed: {}", e))?;

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
        // Create directory if it doesn't exist
        if !file_config.directory.exists() {
            std::fs::create_dir_all(&file_config.directory)
                .map_err(|e| anyhow::anyhow!(
                    "Failed to create log directory '{}': {}",
                    file_config.directory.display(),
                    e
                ))?;
        }

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
    // Validate configuration before initialization
    config.validate().map_err(|e| anyhow::anyhow!("Observability configuration validation failed: {}", e))?;

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

    // Validate configuration
    config.validate().map_err(|e| anyhow::anyhow!("OpenTelemetry configuration validation failed: {}", e))?;

    // We need at least one exporter configured
    if let Some(ref jaeger_config) = config.jaeger {
        let tracer = opentelemetry_sdk::trace::TracerProvider::builder()
            .with_batch_exporter(
                opentelemetry_jaeger::new_agent_pipeline()
                    .with_service_name(&config.service_name)
                    .with_endpoint(&jaeger_config.agent_endpoint)
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
            jaeger_endpoint = %jaeger_config.agent_endpoint,
            "OpenTelemetry with Jaeger initialized"
        );
    } else if config.otlp.is_some() {
        // TODO: Implement OTLP initialization
        tracing::warn!("OTLP exporter not yet implemented");
    }

    Ok(())
}

#[cfg(feature = "metrics")]
fn init_metrics(config: &MetricsConfig) -> Result<()> {
    if !config.enabled {
        return Ok(());
    }

    // Validate configuration
    config.validate().map_err(|e| anyhow::anyhow!("Metrics configuration validation failed: {}", e))?;

    if let Some(prometheus_config) = &config.prometheus {
        let builder = metrics_exporter_prometheus::PrometheusBuilder::new();
        let _handle = builder
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_logging_config_validation() {
        // Valid config
        let config = LoggingConfig::default();
        assert!(config.validate().is_ok());

        // Invalid log level
        let mut config = LoggingConfig::default();
        config.level = "invalid".to_string();
        assert!(config.validate().is_err());

        // No outputs enabled
        let mut config = LoggingConfig::default();
        config.console = false;
        config.file = None;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_file_logging_config_validation() {
        // Valid config
        let config = FileLoggingConfig {
            directory: PathBuf::from("/tmp/logs"),
            filename: "app.log".to_string(),
            rotation: LogRotation::Daily,
            max_files: Some(30),
        };
        assert!(config.validate().is_ok());

        // Empty directory
        let mut config = config.clone();
        config.directory = PathBuf::from("");
        assert!(config.validate().is_err());

        // Empty filename
        let mut config = config.clone();
        config.filename = "".to_string();
        assert!(config.validate().is_err());

        // Invalid filename characters
        let mut config = config.clone();
        config.filename = "app/log.log".to_string();
        assert!(config.validate().is_err());

        // Invalid max_files
        let mut config = config.clone();
        config.max_files = Some(0);
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_jaeger_config_validation() {
        // Valid config
        let config = JaegerConfig {
            agent_endpoint: "http://localhost:14268".to_string(),
            sample_rate: 0.1,
        };
        assert!(config.validate().is_ok());

        // Empty endpoint
        let mut config = config.clone();
        config.agent_endpoint = "".to_string();
        assert!(config.validate().is_err());

        // Invalid sample rate
        let mut config = config.clone();
        config.sample_rate = 1.5;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_otlp_config_validation() {
        // Valid config
        let config = OtlpConfig {
            endpoint: "https://api.honeycomb.io".to_string(),
            api_key: Some("valid_key_123".to_string()),
        };
        assert!(config.validate().is_ok());

        // Invalid endpoint
        let mut config = config.clone();
        config.endpoint = "invalid-url".to_string();
        assert!(config.validate().is_err());

        // Short API key
        let mut config = config.clone();
        config.api_key = Some("short".to_string());
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_prometheus_config_validation() {
        // Valid config
        let config = PrometheusConfig {
            port: 9090,
            path: "/metrics".to_string(),
        };
        assert!(config.validate().is_ok());

        // Invalid port
        let mut config = config.clone();
        config.port = 0;
        assert!(config.validate().is_err());

        // Invalid path
        let mut config = config.clone();
        config.path = "metrics".to_string(); // Missing leading slash
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_observability_config_validation() {
        // Valid config
        let config = ObservabilityConfig::default();
        assert!(config.validate().is_ok());

        // Invalid logging config should fail
        let mut config = ObservabilityConfig::default();
        config.logging.level = "invalid".to_string();
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_opentelemetry_config_validation() {
        // Disabled config should pass
        let config = OpenTelemetryConfig {
            enabled: false,
            service_name: "".to_string(),
            service_version: "".to_string(),
            jaeger: None,
            otlp: None,
        };
        assert!(config.validate().is_ok());

        // Enabled config without exporters should fail
        let mut config = config.clone();
        config.enabled = true;
        config.service_name = "test-service".to_string();
        config.service_version = "1.0.0".to_string();
        assert!(config.validate().is_err());

        // Enabled config with valid Jaeger should pass
        config.jaeger = Some(JaegerConfig {
            agent_endpoint: "http://localhost:14268".to_string(),
            sample_rate: 0.1,
        });
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_metrics_config_validation() {
        // Disabled config should pass
        let config = MetricsConfig {
            enabled: false,
            prometheus: None,
        };
        assert!(config.validate().is_ok());

        // Enabled config without exporters should fail
        let mut config = config.clone();
        config.enabled = true;
        assert!(config.validate().is_err());

        // Enabled config with valid Prometheus should pass
        config.prometheus = Some(PrometheusConfig::default());
        assert!(config.validate().is_ok());
    }
}