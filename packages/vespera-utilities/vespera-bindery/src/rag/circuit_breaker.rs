//! # Circuit Breaker for External API Calls
//!
//! Implements circuit breaker pattern to prevent cascading failures
//! when external services are unavailable or degraded.

use std::time::{Duration, Instant};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use anyhow::Result;
use serde::{Serialize, Deserialize};
use tokio::time::sleep;
use tracing::{info, warn, error, debug, instrument};
use crate::{BinderyError, BinderyResult};
use crate::observability::metrics::BinderyMetrics;

/// Circuit breaker state
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CircuitState {
    /// Circuit is closed - requests pass through normally
    Closed,
    /// Circuit is open - requests fail fast
    Open,
    /// Circuit is half-open - testing if service has recovered
    HalfOpen,
}

impl CircuitState {
    /// Convert state to numeric value for metrics
    pub fn to_metric_value(&self) -> f64 {
        match self {
            CircuitState::Closed => 0.0,
            CircuitState::Open => 1.0,
            CircuitState::HalfOpen => 0.5,
        }
    }

    /// Get state name for logging
    pub fn name(&self) -> &'static str {
        match self {
            CircuitState::Closed => "closed",
            CircuitState::Open => "open",
            CircuitState::HalfOpen => "half_open",
        }
    }
}

/// Circuit breaker configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitBreakerConfig {
    /// Number of failures before opening the circuit
    pub failure_threshold: u32,
    /// Time to wait before transitioning from Open to HalfOpen
    pub recovery_timeout: Duration,
    /// Timeout for individual requests
    pub request_timeout: Duration,
    /// Maximum number of retry attempts
    pub max_retries: u32,
    /// Initial backoff delay for retries
    pub initial_backoff: Duration,
    /// Maximum backoff delay
    pub max_backoff: Duration,
    /// Backoff multiplier for exponential backoff
    pub backoff_multiplier: f64,
    /// Success threshold for transitioning from HalfOpen to Closed
    pub success_threshold: u32,
}

impl Default for CircuitBreakerConfig {
    fn default() -> Self {
        Self {
            failure_threshold: 5,
            recovery_timeout: Duration::from_secs(30),
            request_timeout: Duration::from_secs(30),
            max_retries: 3,
            initial_backoff: Duration::from_millis(100),
            max_backoff: Duration::from_secs(30),
            backoff_multiplier: 2.0,
            success_threshold: 3,
        }
    }
}

impl CircuitBreakerConfig {
    /// Validate the circuit breaker configuration
    pub fn validate(&self) -> BinderyResult<()> {
        // Validate failure threshold
        if self.failure_threshold == 0 {
            return Err(BinderyError::ConfigurationError(
                "failure_threshold must be greater than 0".to_string()
            ));
        }

        if self.failure_threshold > 1000 {
            return Err(BinderyError::ConfigurationError(
                "failure_threshold should not exceed 1000 to avoid excessive sensitivity".to_string()
            ));
        }

        // Validate success threshold
        if self.success_threshold == 0 {
            return Err(BinderyError::ConfigurationError(
                "success_threshold must be greater than 0".to_string()
            ));
        }

        if self.success_threshold > 100 {
            return Err(BinderyError::ConfigurationError(
                "success_threshold should not exceed 100 for practical recovery".to_string()
            ));
        }

        // Validate recovery timeout
        if self.recovery_timeout.as_secs() == 0 {
            return Err(BinderyError::ConfigurationError(
                "recovery_timeout must be greater than 0 seconds".to_string()
            ));
        }

        if self.recovery_timeout > Duration::from_secs(3600) {
            return Err(BinderyError::ConfigurationError(
                "recovery_timeout should not exceed 1 hour (3600 seconds) for responsiveness".to_string()
            ));
        }

        // Validate request timeout
        if self.request_timeout.as_secs() == 0 {
            return Err(BinderyError::ConfigurationError(
                "request_timeout must be greater than 0 seconds".to_string()
            ));
        }

        if self.request_timeout > Duration::from_secs(300) {
            return Err(BinderyError::ConfigurationError(
                "request_timeout should not exceed 5 minutes (300 seconds) for user experience".to_string()
            ));
        }

        // Validate max retries
        if self.max_retries > 10 {
            return Err(BinderyError::ConfigurationError(
                "max_retries should not exceed 10 to avoid excessive delays".to_string()
            ));
        }

        // Validate backoff configuration
        if self.initial_backoff.as_millis() == 0 {
            return Err(BinderyError::ConfigurationError(
                "initial_backoff must be greater than 0 milliseconds".to_string()
            ));
        }

        if self.initial_backoff > self.max_backoff {
            return Err(BinderyError::ConfigurationError(
                format!(
                    "initial_backoff ({:?}) cannot be greater than max_backoff ({:?})",
                    self.initial_backoff, self.max_backoff
                )
            ));
        }

        if self.max_backoff > Duration::from_secs(300) {
            return Err(BinderyError::ConfigurationError(
                "max_backoff should not exceed 5 minutes (300 seconds)".to_string()
            ));
        }

        // Validate backoff multiplier
        if self.backoff_multiplier <= 1.0 {
            return Err(BinderyError::ConfigurationError(
                "backoff_multiplier must be greater than 1.0 for exponential backoff".to_string()
            ));
        }

        if self.backoff_multiplier > 10.0 {
            return Err(BinderyError::ConfigurationError(
                "backoff_multiplier should not exceed 10.0 to avoid extremely long delays".to_string()
            ));
        }

        // Validate timeout relationships
        if self.request_timeout > self.recovery_timeout {
            tracing::warn!(
                "request_timeout ({:?}) is greater than recovery_timeout ({:?}). This may cause unexpected behavior",
                self.request_timeout, self.recovery_timeout
            );
        }

        Ok(())
    }

    /// Create a new circuit breaker configuration with validation
    pub fn new() -> BinderyResult<Self> {
        let config = Self::default();
        config.validate()?;
        Ok(config)
    }

    /// Set failure threshold with validation
    pub fn with_failure_threshold(mut self, threshold: u32) -> BinderyResult<Self> {
        if threshold == 0 {
            return Err(BinderyError::ConfigurationError(
                "failure_threshold must be greater than 0".to_string()
            ));
        }
        if threshold > 1000 {
            return Err(BinderyError::ConfigurationError(
                "failure_threshold should not exceed 1000".to_string()
            ));
        }
        self.failure_threshold = threshold;
        Ok(self)
    }

    /// Set success threshold with validation
    pub fn with_success_threshold(mut self, threshold: u32) -> BinderyResult<Self> {
        if threshold == 0 {
            return Err(BinderyError::ConfigurationError(
                "success_threshold must be greater than 0".to_string()
            ));
        }
        if threshold > 100 {
            return Err(BinderyError::ConfigurationError(
                "success_threshold should not exceed 100".to_string()
            ));
        }
        self.success_threshold = threshold;
        Ok(self)
    }

    /// Set timeouts with validation
    pub fn with_timeouts(
        mut self,
        recovery_timeout: Duration,
        request_timeout: Duration
    ) -> BinderyResult<Self> {
        if recovery_timeout.as_secs() == 0 {
            return Err(BinderyError::ConfigurationError(
                "recovery_timeout must be greater than 0 seconds".to_string()
            ));
        }
        if request_timeout.as_secs() == 0 {
            return Err(BinderyError::ConfigurationError(
                "request_timeout must be greater than 0 seconds".to_string()
            ));
        }
        if recovery_timeout > Duration::from_secs(3600) {
            return Err(BinderyError::ConfigurationError(
                "recovery_timeout should not exceed 1 hour".to_string()
            ));
        }
        if request_timeout > Duration::from_secs(300) {
            return Err(BinderyError::ConfigurationError(
                "request_timeout should not exceed 5 minutes".to_string()
            ));
        }

        self.recovery_timeout = recovery_timeout;
        self.request_timeout = request_timeout;
        Ok(self)
    }

    /// Set retry configuration with validation
    pub fn with_retry_config(
        mut self,
        max_retries: u32,
        initial_backoff: Duration,
        max_backoff: Duration,
        backoff_multiplier: f64
    ) -> BinderyResult<Self> {
        if max_retries > 10 {
            return Err(BinderyError::ConfigurationError(
                "max_retries should not exceed 10".to_string()
            ));
        }
        if initial_backoff.as_millis() == 0 {
            return Err(BinderyError::ConfigurationError(
                "initial_backoff must be greater than 0 milliseconds".to_string()
            ));
        }
        if initial_backoff > max_backoff {
            return Err(BinderyError::ConfigurationError(
                "initial_backoff cannot be greater than max_backoff".to_string()
            ));
        }
        if backoff_multiplier <= 1.0 {
            return Err(BinderyError::ConfigurationError(
                "backoff_multiplier must be greater than 1.0".to_string()
            ));
        }
        if backoff_multiplier > 10.0 {
            return Err(BinderyError::ConfigurationError(
                "backoff_multiplier should not exceed 10.0".to_string()
            ));
        }

        self.max_retries = max_retries;
        self.initial_backoff = initial_backoff;
        self.max_backoff = max_backoff;
        self.backoff_multiplier = backoff_multiplier;
        Ok(self)
    }
}

/// Circuit breaker metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitBreakerMetrics {
    pub state: CircuitState,
    pub failure_count: u32,
    pub success_count: u32,
    pub total_requests: u64,
    pub failed_requests: u64,
    #[serde(skip)] // Skip serializing Instant as it doesn't implement Serialize/Deserialize
    pub last_failure_time: Option<Instant>,
    #[serde(skip)] // Skip serializing Instant as it doesn't implement Serialize/Deserialize
    pub last_success_time: Option<Instant>,
    pub state_transitions: u64,
}

impl Default for CircuitBreakerMetrics {
    fn default() -> Self {
        Self {
            state: CircuitState::Closed,
            failure_count: 0,
            success_count: 0,
            total_requests: 0,
            failed_requests: 0,
            last_failure_time: None,
            last_success_time: None,
            state_transitions: 0,
        }
    }
}

/// Circuit breaker implementation
pub struct CircuitBreaker {
    service_name: String,
    config: CircuitBreakerConfig,
    metrics: Arc<Mutex<CircuitBreakerMetrics>>,
}

impl CircuitBreaker {
    /// Create a new circuit breaker for a service
    pub fn new(service_name: String, config: CircuitBreakerConfig) -> BinderyResult<Self> {
        // Validate configuration before creating the circuit breaker
        config.validate()?;

        info!("Initializing circuit breaker for service: {}", service_name);

        Ok(Self {
            service_name,
            config,
            metrics: Arc::new(Mutex::new(CircuitBreakerMetrics::default())),
        })
    }

    /// Execute a function with circuit breaker protection
    #[instrument(skip(self, operation), fields(service = %self.service_name))]
    pub async fn execute<F, T, E>(&self, operation: F) -> Result<T>
    where
        F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T, E>> + Send>> + Send + Sync,
        E: std::error::Error + Send + Sync + 'static,
        T: Send,
    {
        let start_time = Instant::now();

        // Check if circuit is open
        if self.should_reject_request().await? {
            // Record metrics for rejected request
            BinderyMetrics::record_circuit_breaker_request(
                &self.service_name,
                "rejected",
                Duration::ZERO,
                false,
            );

            return Err(anyhow::anyhow!(
                "Circuit breaker is OPEN for service: {}",
                self.service_name
            ));
        }

        // Execute with retries and exponential backoff
        let mut last_error = None;
        let mut backoff = self.config.initial_backoff;

        for attempt in 0..=self.config.max_retries {
            self.increment_total_requests().await;

            debug!(
                "Attempting request {} for service: {} (attempt {}/{})",
                self.get_total_requests().await,
                self.service_name,
                attempt + 1,
                self.config.max_retries + 1
            );

            // Execute with timeout
            let result = tokio::time::timeout(
                self.config.request_timeout,
                operation()
            ).await;

            let operation_duration = start_time.elapsed();

            match result {
                Ok(Ok(value)) => {
                    self.record_success().await?;

                    // Record successful request metrics
                    BinderyMetrics::record_circuit_breaker_request(
                        &self.service_name,
                        "execute",
                        operation_duration,
                        true,
                    );

                    return Ok(value);
                }
                Ok(Err(e)) => {
                    last_error = Some(anyhow::anyhow!("Operation failed: {}", e));
                }
                Err(_) => {
                    last_error = Some(anyhow::anyhow!(
                        "Request timeout after {}ms",
                        self.config.request_timeout.as_millis()
                    ));
                }
            }

            // Don't sleep after the last attempt
            if attempt < self.config.max_retries {
                debug!(
                    "Request failed for service: {}, backing off for {}ms",
                    self.service_name,
                    backoff.as_millis()
                );
                sleep(backoff).await;

                // Exponential backoff with jitter
                backoff = Duration::from_millis(
                    std::cmp::min(
                        (backoff.as_millis() as f64 * self.config.backoff_multiplier) as u64,
                        self.config.max_backoff.as_millis() as u64
                    )
                );
            }
        }

        // All retries failed
        let error = last_error.unwrap_or_else(|| anyhow::anyhow!("Unknown error"));
        let total_duration = start_time.elapsed();

        self.record_failure().await?;

        // Record failed request metrics
        BinderyMetrics::record_circuit_breaker_request(
            &self.service_name,
            "execute",
            total_duration,
            false,
        );

        Err(error.context(format!(
            "All {} retry attempts failed for service: {}",
            self.config.max_retries + 1,
            self.service_name
        )))
    }

    /// Check if requests should be rejected
    async fn should_reject_request(&self) -> Result<bool> {
        let mut metrics = self.metrics.lock().map_err(|_| {
            anyhow::anyhow!("Failed to acquire metrics lock")
        })?;

        match metrics.state {
            CircuitState::Closed => Ok(false),
            CircuitState::Open => {
                // Check if recovery timeout has passed
                if let Some(last_failure) = metrics.last_failure_time {
                    if last_failure.elapsed() >= self.config.recovery_timeout {
                        let old_state = metrics.state.clone();
                        metrics.state = CircuitState::HalfOpen;
                        metrics.state_transitions += 1;

                        // Record state transition
                        BinderyMetrics::record_circuit_breaker_state_change(
                            &self.service_name,
                            old_state.name(),
                            metrics.state.name(),
                            metrics.state.to_metric_value(),
                        );
                        info!("Transitioning circuit breaker to HALF_OPEN for service: {}", self.service_name);
                        metrics.success_count = 0;
                        return Ok(false);
                    }
                }
                Ok(true)
            }
            CircuitState::HalfOpen => Ok(false),
        }
    }

    /// Record a successful operation
    async fn record_success(&self) -> Result<()> {
        let mut metrics = self.metrics.lock().map_err(|_| {
            anyhow::anyhow!("Failed to acquire metrics lock")
        })?;

        metrics.success_count += 1;
        metrics.last_success_time = Some(Instant::now());

        match metrics.state {
            CircuitState::HalfOpen => {
                if metrics.success_count >= self.config.success_threshold {
                    info!("Transitioning circuit breaker to CLOSED for service: {}", self.service_name);
                    metrics.state = CircuitState::Closed;
                    metrics.failure_count = 0;
                    metrics.success_count = 0;
                    metrics.state_transitions += 1;
                }
            }
            CircuitState::Closed => {
                // Reset failure count on successful requests
                metrics.failure_count = 0;
            }
            CircuitState::Open => {
                // This shouldn't happen, but reset anyway
                warn!("Received success while circuit is OPEN for service: {}", self.service_name);
                metrics.failure_count = 0;
            }
        }

        debug!(
            "Recorded success for service: {} (state: {:?}, success_count: {})",
            self.service_name, metrics.state, metrics.success_count
        );

        Ok(())
    }

    /// Record a failed operation
    async fn record_failure(&self) -> Result<()> {
        let mut metrics = self.metrics.lock().map_err(|_| {
            anyhow::anyhow!("Failed to acquire metrics lock")
        })?;

        metrics.failure_count += 1;
        metrics.failed_requests += 1;
        metrics.last_failure_time = Some(Instant::now());

        match metrics.state {
            CircuitState::Closed => {
                if metrics.failure_count >= self.config.failure_threshold {
                    warn!("Opening circuit breaker for service: {} (failures: {})",
                          self.service_name, metrics.failure_count);
                    metrics.state = CircuitState::Open;
                    metrics.state_transitions += 1;
                }
            }
            CircuitState::HalfOpen => {
                warn!("Reopening circuit breaker for service: {} (half-open test failed)",
                      self.service_name);
                metrics.state = CircuitState::Open;
                metrics.state_transitions += 1;
            }
            CircuitState::Open => {
                // Already open, just record the failure
            }
        }

        debug!(
            "Recorded failure for service: {} (state: {:?}, failure_count: {})",
            self.service_name, metrics.state, metrics.failure_count
        );

        Ok(())
    }

    /// Get current failure rate as percentage
    async fn get_failure_rate(&self) -> f64 {
        let metrics = match self.metrics.lock() {
            Ok(m) => m,
            Err(_) => return 0.0,
        };

        if metrics.total_requests == 0 {
            0.0
        } else {
            (metrics.failed_requests as f64 / metrics.total_requests as f64) * 100.0
        }
    }

    /// Get current state
    pub async fn get_state(&self) -> CircuitState {
        match self.metrics.lock() {
            Ok(metrics) => metrics.state.clone(),
            Err(_) => CircuitState::Closed, // Default to closed on error
        }
    }

    /// Get comprehensive metrics
    pub async fn get_metrics(&self) -> CircuitBreakerMetrics {
        match self.metrics.lock() {
            Ok(metrics) => metrics.clone(),
            Err(_) => CircuitBreakerMetrics::default(),
        }
    }

    /// Get total request count
    async fn get_total_requests(&self) -> u64 {
        match self.metrics.lock() {
            Ok(metrics) => metrics.total_requests,
            Err(_) => 0,
        }
    }

    /// Increment total request counter
    async fn increment_total_requests(&self) {
        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.total_requests += 1;
        }
    }

    /// Reset metrics
    pub async fn reset(&self) -> Result<()> {
        let mut metrics = self.metrics.lock().map_err(|_| {
            anyhow::anyhow!("Failed to acquire metrics lock")
        })?;

        let old_state = metrics.state.clone();
        *metrics = CircuitBreakerMetrics::default();

        // Record state transition if state changed
        if old_state != CircuitState::Closed {
            BinderyMetrics::record_circuit_breaker_state_change(
                &self.service_name,
                old_state.name(),
                "closed",
                0.0,
            );
        }

        info!("Reset circuit breaker for service: {}", self.service_name);
        Ok(())
    }

    /// Get service name
    pub fn service_name(&self) -> &str {
        &self.service_name
    }

    /// Get configuration
    pub fn config(&self) -> &CircuitBreakerConfig {
        &self.config
    }

    /// Force circuit open (for testing/maintenance)
    pub async fn force_open(&self) -> Result<()> {
        let mut metrics = self.metrics.lock().map_err(|_| {
            anyhow::anyhow!("Failed to acquire metrics lock")
        })?;

        warn!("Manually forcing circuit breaker OPEN for service: {}", self.service_name);

        metrics.state = CircuitState::Open;
        metrics.last_failure_time = Some(Instant::now());
        metrics.state_transitions += 1;

        Ok(())
    }
}

/// Circuit breaker registry for managing multiple services
pub struct CircuitBreakerRegistry {
    breakers: Arc<Mutex<HashMap<String, Arc<CircuitBreaker>>>>,
    default_config: CircuitBreakerConfig,
}

impl CircuitBreakerRegistry {
    /// Create a new registry
    pub fn new(default_config: CircuitBreakerConfig) -> BinderyResult<Self> {
        // Validate the default configuration
        default_config.validate()?;

        Ok(Self {
            breakers: Arc::new(Mutex::new(HashMap::new())),
            default_config,
        })
    }

    /// Get or create a circuit breaker for a service
    pub async fn get_breaker(&self, service_name: &str) -> Result<Arc<CircuitBreaker>> {
        let mut breakers = self.breakers.lock().map_err(|_| {
            anyhow::anyhow!("Failed to acquire breakers lock")
        })?;

        if let Some(breaker) = breakers.get(service_name) {
            Ok(Arc::clone(breaker))
        } else {
            let breaker = Arc::new(CircuitBreaker::new(
                service_name.to_string(),
                self.default_config.clone(),
            )?);
            breakers.insert(service_name.to_string(), Arc::clone(&breaker));
            Ok(breaker)
        }
    }

    /// Get or create a circuit breaker with custom config
    pub async fn get_breaker_with_config(
        &self,
        service_name: &str,
        config: CircuitBreakerConfig,
    ) -> Result<Arc<CircuitBreaker>> {
        let mut breakers = self.breakers.lock().map_err(|_| {
            anyhow::anyhow!("Failed to acquire breakers lock")
        })?;

        if let Some(breaker) = breakers.get(service_name) {
            Ok(Arc::clone(breaker))
        } else {
            let breaker = Arc::new(CircuitBreaker::new(
                service_name.to_string(),
                config,
            )?);
            breakers.insert(service_name.to_string(), Arc::clone(&breaker));
            Ok(breaker)
        }
    }

    /// Get all breakers and their metrics
    pub async fn get_all_metrics(&self) -> Result<HashMap<String, CircuitBreakerMetrics>> {
        let breakers = self.breakers.lock().map_err(|_| {
            anyhow::anyhow!("Failed to acquire breakers lock")
        })?;

        let mut metrics = HashMap::new();
        for (name, breaker) in breakers.iter() {
            let breaker_metrics = breaker.get_metrics().await;
            metrics.insert(name.clone(), breaker_metrics);
        }

        Ok(metrics)
    }

    /// Reset all circuit breakers
    pub async fn reset_all(&self) -> Result<()> {
        let breakers = self.breakers.lock().map_err(|_| {
            anyhow::anyhow!("Failed to acquire breakers lock")
        })?;

        for (name, breaker) in breakers.iter() {
            if let Err(e) = breaker.reset().await {
                error!("Failed to reset circuit breaker for {}: {}", name, e);
            }
        }

        Ok(())
    }

    /// Get service names
    pub async fn get_service_names(&self) -> Result<Vec<String>> {
        let breakers = self.breakers.lock().map_err(|_| {
            anyhow::anyhow!("Failed to acquire breakers lock")
        })?;

        Ok(breakers.keys().cloned().collect())
    }
}

/// Health status for circuit breaker
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitBreakerHealth {
    pub service_name: String,
    pub state: CircuitState,
    pub is_healthy: bool,
    pub failure_rate: f64,
    pub last_failure: Option<Duration>,
    pub uptime: Duration,
}

impl CircuitBreakerRegistry {
    /// Get health status for all circuit breakers
    pub async fn get_health_status(&self) -> Result<Vec<CircuitBreakerHealth>> {
        let breakers = self.breakers.lock().map_err(|_| {
            anyhow::anyhow!("Failed to acquire breakers lock")
        })?;

        let mut health_status = Vec::new();
        let now = Instant::now();

        for (name, breaker) in breakers.iter() {
            let metrics = breaker.get_metrics().await;
            let failure_rate = if metrics.total_requests > 0 {
                metrics.failed_requests as f64 / metrics.total_requests as f64
            } else {
                0.0
            };

            let last_failure = metrics.last_failure_time
                .map(|t| now.duration_since(t));

            let uptime = metrics.last_success_time
                .map(|t| now.duration_since(t))
                .unwrap_or(Duration::from_secs(0));

            let is_healthy = matches!(metrics.state, CircuitState::Closed | CircuitState::HalfOpen)
                && failure_rate < 0.5;

            health_status.push(CircuitBreakerHealth {
                service_name: name.clone(),
                state: metrics.state,
                is_healthy,
                failure_rate,
                last_failure,
                uptime,
            });
        }

        Ok(health_status)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};
    use tokio::time::timeout;

    #[test]
    fn test_circuit_breaker_config_validation() {
        // Valid config
        let config = CircuitBreakerConfig::default();
        assert!(config.validate().is_ok());

        // Invalid failure threshold
        let mut config = CircuitBreakerConfig::default();
        config.failure_threshold = 0;
        assert!(config.validate().is_err());

        // Invalid success threshold
        let mut config = CircuitBreakerConfig::default();
        config.success_threshold = 0;
        assert!(config.validate().is_err());

        // Invalid backoff multiplier
        let mut config = CircuitBreakerConfig::default();
        config.backoff_multiplier = 0.5;
        assert!(config.validate().is_err());

        // Invalid backoff timing
        let mut config = CircuitBreakerConfig::default();
        config.initial_backoff = Duration::from_secs(10);
        config.max_backoff = Duration::from_secs(5);
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_circuit_breaker_config_builder_methods() {
        // Test with_failure_threshold
        let config = CircuitBreakerConfig::default()
            .with_failure_threshold(10)
            .unwrap();
        assert_eq!(config.failure_threshold, 10);

        // Test invalid failure threshold
        let result = CircuitBreakerConfig::default()
            .with_failure_threshold(0);
        assert!(result.is_err());

        // Test with_timeouts
        let config = CircuitBreakerConfig::default()
            .with_timeouts(
                Duration::from_secs(60),
                Duration::from_secs(20)
            )
            .unwrap();
        assert_eq!(config.recovery_timeout, Duration::from_secs(60));
        assert_eq!(config.request_timeout, Duration::from_secs(20));
    }

    #[tokio::test]
    async fn test_circuit_breaker_success() {
        let config = CircuitBreakerConfig {
            failure_threshold: 3,
            recovery_timeout: Duration::from_millis(100),
            request_timeout: Duration::from_millis(1000),
            max_retries: 2,
            initial_backoff: Duration::from_millis(10),
            max_backoff: Duration::from_millis(100),
            backoff_multiplier: 2.0,
            success_threshold: 2,
        };

        let breaker = CircuitBreaker::new("test_service".to_string(), config).unwrap();

        // Test successful operation
        let result = breaker.execute(|| {
            Box::pin(async { Ok::<i32, anyhow::Error>(42) })
        }).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);

        let metrics = breaker.get_metrics().await.unwrap();
        assert_eq!(metrics.state, CircuitState::Closed);
        assert_eq!(metrics.total_requests, 1);
        assert_eq!(metrics.failed_requests, 0);
    }

    #[tokio::test]
    async fn test_circuit_breaker_failure_threshold() {
        let config = CircuitBreakerConfig {
            failure_threshold: 2,
            recovery_timeout: Duration::from_millis(100),
            request_timeout: Duration::from_millis(100),
            max_retries: 0, // No retries for this test
            initial_backoff: Duration::from_millis(10),
            max_backoff: Duration::from_millis(100),
            backoff_multiplier: 2.0,
            success_threshold: 1,
        };

        let breaker = CircuitBreaker::new("test_service".to_string(), config).unwrap();

        // First failure
        let result1 = breaker.execute(|| {
            Box::pin(async { Err::<i32, anyhow::Error>(anyhow::anyhow!("test error")) })
        }).await;
        assert!(result1.is_err());

        let metrics = breaker.get_metrics().await.unwrap();
        assert_eq!(metrics.state, CircuitState::Closed);
        assert_eq!(metrics.failure_count, 1);

        // Second failure - should open circuit
        let result2 = breaker.execute(|| {
            Box::pin(async { Err::<i32, anyhow::Error>(anyhow::anyhow!("test error")) })
        }).await;
        assert!(result2.is_err());

        let metrics = breaker.get_metrics().await.unwrap();
        assert_eq!(metrics.state, CircuitState::Open);

        // Third request should be rejected immediately
        let result3 = breaker.execute(|| {
            Box::pin(async { Ok::<i32, anyhow::Error>(42) })
        }).await;
        assert!(result3.is_err());
        assert!(result3.unwrap_err().to_string().contains("Circuit breaker is OPEN"));
    }

    #[tokio::test]
    async fn test_circuit_breaker_recovery() {
        let config = CircuitBreakerConfig {
            failure_threshold: 1,
            recovery_timeout: Duration::from_millis(50),
            request_timeout: Duration::from_millis(100),
            max_retries: 0,
            initial_backoff: Duration::from_millis(10),
            max_backoff: Duration::from_millis(100),
            backoff_multiplier: 2.0,
            success_threshold: 1,
        };

        let breaker = CircuitBreaker::new("test_service".to_string(), config).unwrap();

        // Cause failure to open circuit
        let _ = breaker.execute(|| {
            Box::pin(async { Err::<i32, anyhow::Error>(anyhow::anyhow!("test error")) })
        }).await;

        let metrics = breaker.get_metrics().await.unwrap();
        assert_eq!(metrics.state, CircuitState::Open);

        // Wait for recovery timeout
        sleep(Duration::from_millis(60)).await;

        // Next request should transition to half-open and succeed
        let result = breaker.execute(|| {
            Box::pin(async { Ok::<i32, anyhow::Error>(42) })
        }).await;
        assert!(result.is_ok());

        let metrics = breaker.get_metrics().await.unwrap();
        assert_eq!(metrics.state, CircuitState::Closed);
    }

    #[tokio::test]
    async fn test_circuit_breaker_registry() {
        let config = CircuitBreakerConfig::default();
        let registry = CircuitBreakerRegistry::new(config).unwrap();

        // Get breaker for service1
        let breaker1 = registry.get_breaker("service1").await.unwrap();
        let breaker1_again = registry.get_breaker("service1").await.unwrap();

        // Should be the same instance
        assert_eq!(breaker1.service_name(), breaker1_again.service_name());

        // Get breaker for service2
        let breaker2 = registry.get_breaker("service2").await.unwrap();
        assert_ne!(breaker1.service_name(), breaker2.service_name());

        // Check service names
        let names = registry.get_service_names().await.unwrap();
        assert_eq!(names.len(), 2);
        assert!(names.contains(&"service1".to_string()));
        assert!(names.contains(&"service2".to_string()));
    }

    #[tokio::test]
    async fn test_exponential_backoff() {
        let config = CircuitBreakerConfig {
            failure_threshold: 10, // High threshold so circuit stays closed
            recovery_timeout: Duration::from_secs(10),
            request_timeout: Duration::from_millis(50),
            max_retries: 3,
            initial_backoff: Duration::from_millis(10),
            max_backoff: Duration::from_millis(100),
            backoff_multiplier: 2.0,
            success_threshold: 1,
        };

        let breaker = CircuitBreaker::new("test_service".to_string(), config).unwrap();
        let start_time = Instant::now();

        // This should take at least 10 + 20 + 40 = 70ms due to backoff
        let result = breaker.execute(|| {
            Box::pin(async { Err::<i32, anyhow::Error>(anyhow::anyhow!("test error")) })
        }).await;

        let elapsed = start_time.elapsed();
        assert!(result.is_err());
        assert!(elapsed >= Duration::from_millis(70)); // At least the backoff time
    }

    #[tokio::test]
    async fn test_request_timeout() {
        let config = CircuitBreakerConfig {
            failure_threshold: 10,
            recovery_timeout: Duration::from_secs(10),
            request_timeout: Duration::from_millis(50),
            max_retries: 0,
            initial_backoff: Duration::from_millis(10),
            max_backoff: Duration::from_millis(100),
            backoff_multiplier: 2.0,
            success_threshold: 1,
        };

        let breaker = CircuitBreaker::new("test_service".to_string(), config).unwrap();

        // Operation that takes longer than timeout
        let result = breaker.execute(|| {
            Box::pin(async {
                sleep(Duration::from_millis(100)).await;
                Ok::<i32, anyhow::Error>(42)
            })
        }).await;

        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("timeout"));
    }

    #[test]
    fn test_circuit_breaker_registry_validation() {
        // Valid config should work
        let config = CircuitBreakerConfig::default();
        assert!(CircuitBreakerRegistry::new(config).is_ok());

        // Invalid config should fail
        let mut config = CircuitBreakerConfig::default();
        config.failure_threshold = 0;
        assert!(CircuitBreakerRegistry::new(config).is_err());
    }
}