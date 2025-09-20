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
use tracing::{info, warn, error, debug};

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
    pub fn new(service_name: String, config: CircuitBreakerConfig) -> Self {
        info!("Initializing circuit breaker for service: {}", service_name);
        
        Self {
            service_name,
            config,
            metrics: Arc::new(Mutex::new(CircuitBreakerMetrics::default())),
        }
    }

    /// Execute a function with circuit breaker protection
    pub async fn execute<F, T, E>(&self, operation: F) -> Result<T>
    where
        F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T, E>> + Send>> + Send + Sync,
        E: std::error::Error + Send + Sync + 'static,
        T: Send,
    {
        // Check if circuit is open
        if self.should_reject_request().await? {
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

            match result {
                Ok(Ok(value)) => {
                    self.record_success().await?;
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
        self.record_failure().await?;
        
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
                        info!("Transitioning circuit breaker to HALF_OPEN for service: {}", self.service_name);
                        metrics.state = CircuitState::HalfOpen;
                        metrics.success_count = 0;
                        metrics.state_transitions += 1;
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

    /// Increment total request counter
    async fn increment_total_requests(&self) {
        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.total_requests += 1;
        }
    }

    /// Get total request count
    async fn get_total_requests(&self) -> u64 {
        self.metrics.lock().map(|m| m.total_requests).unwrap_or(0)
    }

    /// Get current metrics
    pub async fn get_metrics(&self) -> Result<CircuitBreakerMetrics> {
        let metrics = self.metrics.lock().map_err(|_| {
            anyhow::anyhow!("Failed to acquire metrics lock")
        })?;
        Ok(metrics.clone())
    }

    /// Get current state
    pub async fn get_state(&self) -> Result<CircuitState> {
        let metrics = self.metrics.lock().map_err(|_| {
            anyhow::anyhow!("Failed to acquire metrics lock")
        })?;
        Ok(metrics.state.clone())
    }

    /// Manually reset the circuit breaker
    pub async fn reset(&self) -> Result<()> {
        let mut metrics = self.metrics.lock().map_err(|_| {
            anyhow::anyhow!("Failed to acquire metrics lock")
        })?;
        
        info!("Manually resetting circuit breaker for service: {}", self.service_name);
        
        metrics.state = CircuitState::Closed;
        metrics.failure_count = 0;
        metrics.success_count = 0;
        metrics.state_transitions += 1;
        
        Ok(())
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

    /// Get service name
    pub fn service_name(&self) -> &str {
        &self.service_name
    }

    /// Get configuration
    pub fn config(&self) -> &CircuitBreakerConfig {
        &self.config
    }
}

/// Circuit breaker registry for managing multiple services
pub struct CircuitBreakerRegistry {
    breakers: Arc<Mutex<HashMap<String, Arc<CircuitBreaker>>>>,
    default_config: CircuitBreakerConfig,
}

impl CircuitBreakerRegistry {
    /// Create a new registry
    pub fn new(default_config: CircuitBreakerConfig) -> Self {
        Self {
            breakers: Arc::new(Mutex::new(HashMap::new())),
            default_config,
        }
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
            ));
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
            ));
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
            if let Ok(breaker_metrics) = breaker.get_metrics().await {
                metrics.insert(name.clone(), breaker_metrics);
            }
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
            if let Ok(metrics) = breaker.get_metrics().await {
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
        }

        Ok(health_status)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};
    use tokio::time::timeout;

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

        let breaker = CircuitBreaker::new("test_service".to_string(), config);
        
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

        let breaker = CircuitBreaker::new("test_service".to_string(), config);
        
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

        let breaker = CircuitBreaker::new("test_service".to_string(), config);
        
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
        let registry = CircuitBreakerRegistry::new(config);
        
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

        let breaker = CircuitBreaker::new("test_service".to_string(), config);
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

        let breaker = CircuitBreaker::new("test_service".to_string(), config);
        
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
}