//! # Health Monitoring System
//!
//! Provides comprehensive health monitoring for all external services
//! including circuit breakers, embedding providers, and fallback mechanisms.

use std::collections::HashMap;
use std::time::{Duration, Instant};
use anyhow::Result;
use serde::{Serialize, Deserialize};
use tracing::{info, warn, error, debug};
use chrono::{DateTime, Utc};
use tokio::time::sleep;

use super::{
    circuit_breaker::{CircuitBreakerHealth},
};

/// Health check configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckConfig {
    /// Interval between health checks
    pub check_interval: Duration,
    /// Timeout for individual health checks
    pub check_timeout: Duration,
    /// Number of consecutive failures before marking as unhealthy
    pub failure_threshold: u32,
    /// Number of consecutive successes to mark as healthy again
    pub recovery_threshold: u32,
    /// Enable automatic circuit breaker reset on recovery
    pub auto_reset_circuit_breakers: bool,
    /// Enable detailed logging of health checks
    pub verbose_logging: bool,
}

impl Default for HealthCheckConfig {
    fn default() -> Self {
        Self {
            check_interval: Duration::from_secs(30),
            check_timeout: Duration::from_secs(10),
            failure_threshold: 3,
            recovery_threshold: 2,
            auto_reset_circuit_breakers: false,
            verbose_logging: false,
        }
    }
}

/// Overall system health status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SystemHealthStatus {
    /// All services are healthy
    Healthy,
    /// Some services are degraded but system is functional
    Degraded,
    /// Critical services are down
    Unhealthy,
    /// Health status unknown (e.g., during startup)
    Unknown,
}

/// Health status for a specific service
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceHealth {
    pub service_name: String,
    pub status: SystemHealthStatus,
    pub last_check: DateTime<Utc>,
    pub last_success: Option<DateTime<Utc>>,
    pub last_failure: Option<DateTime<Utc>>,
    pub consecutive_failures: u32,
    pub consecutive_successes: u32,
    pub total_checks: u64,
    pub success_rate: f64,
    pub error_message: Option<String>,
    pub response_time_ms: Option<u64>,
}

impl ServiceHealth {
    fn new(service_name: String) -> Self {
        Self {
            service_name,
            status: SystemHealthStatus::Unknown,
            last_check: Utc::now(),
            last_success: None,
            last_failure: None,
            consecutive_failures: 0,
            consecutive_successes: 0,
            total_checks: 0,
            success_rate: 0.0,
            error_message: None,
            response_time_ms: None,
        }
    }
}

/// Comprehensive system health report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealthReport {
    pub overall_status: SystemHealthStatus,
    pub timestamp: DateTime<Utc>,
    pub services: HashMap<String, ServiceHealth>,
    pub circuit_breakers: Vec<CircuitBreakerHealth>,
    pub uptime_seconds: u64,
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub system_metrics: SystemMetrics,
}

/// System performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub avg_response_time_ms: f64,
    pub p95_response_time_ms: f64,
    pub p99_response_time_ms: f64,
    pub error_rate: f64,
    pub throughput_rps: f64,
    pub circuit_breaker_trips: u64,
    pub fallback_activations: u64,
}

/// Health monitoring service
pub struct HealthMonitor {
    config: HealthCheckConfig,
    service_health: HashMap<String, ServiceHealth>,
    start_time: Instant,
    total_requests: u64,
    successful_requests: u64,
    failed_requests: u64,
    response_times: Vec<u64>,
    circuit_breaker_trips: u64,
    fallback_activations: u64,
}

impl HealthMonitor {
    /// Create a new health monitor
    pub fn new(config: HealthCheckConfig) -> Self {
        info!("Initializing health monitor with interval: {:?}", config.check_interval);
        
        Self {
            config,
            service_health: HashMap::new(),
            start_time: Instant::now(),
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            response_times: Vec::new(),
            circuit_breaker_trips: 0,
            fallback_activations: 0,
        }
    }
    
    /// Start the health monitoring loop
    /// Note: This is a placeholder implementation since ResilientEmbeddingService is disabled
    #[allow(dead_code)]
    pub async fn start_monitoring(
        &mut self,
    ) -> Result<()> {
        info!("Starting health monitoring loop");
        
        loop {
            let check_start = Instant::now();
            
            // Perform health checks (placeholder implementation)
            // self.check_resilient_service(resilient_service).await;
            // self.check_circuit_breakers(resilient_service).await;
            
            let check_duration = check_start.elapsed();
            if self.config.verbose_logging {
                debug!("Health check completed in {:?}", check_duration);
            }
            
            // Generate health report (placeholder)
            // let report = self.generate_health_report(resilient_service).await;
            // self.log_health_summary(&report);
            
            // Sleep until next check
            sleep(self.config.check_interval).await;
        }
    }
    
    /// Check health of the resilient embedding service
    #[allow(dead_code)]
    async fn check_resilient_service(&mut self) {
        let service_name = "resilient_embeddings".to_string();
        let start_time = Instant::now();
        
        self.total_requests += 1;
        
        let health = self.service_health.entry(service_name.clone())
            .or_insert_with(|| ServiceHealth::new(service_name.clone()));
        
        health.total_checks += 1;
        health.last_check = Utc::now();
        
        // Perform health check with timeout (placeholder)
        // let check_result = tokio::time::timeout(
        //     self.config.check_timeout,
        //     service.health_check(),
        // ).await;
        let check_result: Result<Result<(), anyhow::Error>, _> = Ok(Ok(()));
        
        let response_time = start_time.elapsed().as_millis() as u64;
        health.response_time_ms = Some(response_time);
        self.response_times.push(response_time);
        
        // Keep only last 1000 response times for metrics
        if self.response_times.len() > 1000 {
            self.response_times.drain(0..self.response_times.len() - 1000);
        }
        
        match check_result {
            Ok(Ok(_)) => {
                // Service health check succeeded
                health.consecutive_successes += 1;
                health.consecutive_failures = 0;
                health.last_success = Some(Utc::now());
                health.error_message = None;
                self.successful_requests += 1;

                // Placeholder: assume healthy for now
                health.status = SystemHealthStatus::Healthy;

                if self.config.verbose_logging {
                    debug!("Service {} health check passed in {}ms", service_name, response_time);
                }
            }
            Ok(Err(e)) => {
                // Service returned an error
                self.handle_service_failure(health, format!("Health check failed: {}", e));
                self.failed_requests += 1;
            }
            Err(_) => {
                // Timeout
                self.handle_service_failure(health, "Health check timed out".to_string());
                self.failed_requests += 1;
            }
        }
        
        // Update success rate
        health.success_rate = if health.total_checks > 0 {
            (health.total_checks - health.consecutive_failures as u64) as f64 / health.total_checks as f64
        } else {
            0.0
        };
        
        // Update status based on consecutive failures/successes
        if health.consecutive_failures >= self.config.failure_threshold {
            health.status = SystemHealthStatus::Unhealthy;
        } else if health.consecutive_successes >= self.config.recovery_threshold 
            && health.status == SystemHealthStatus::Unhealthy {
            health.status = SystemHealthStatus::Healthy;
        }
    }
    
    /// Handle service failure
    fn handle_service_failure(&mut self, health: &mut ServiceHealth, error_message: String) {
        health.consecutive_failures += 1;
        health.consecutive_successes = 0;
        health.last_failure = Some(Utc::now());
        health.error_message = Some(error_message.clone());
        
        if health.consecutive_failures >= self.config.failure_threshold {
            health.status = SystemHealthStatus::Unhealthy;
            warn!("Service {} marked as unhealthy after {} consecutive failures: {}", 
                  health.service_name, health.consecutive_failures, error_message);
        } else {
            health.status = SystemHealthStatus::Degraded;
            if self.config.verbose_logging {
                debug!("Service {} degraded (failure {}/{}): {}", 
                      health.service_name, health.consecutive_failures, 
                      self.config.failure_threshold, error_message);
            }
        }
    }
    
    /// Check circuit breaker health
    #[allow(dead_code)]
    async fn check_circuit_breakers(&mut self) {
        // Placeholder implementation
        // let registry = service.get_circuit_breaker_registry();
        // Implementation when ResilientEmbeddingService is available
    }
    
    /// Generate comprehensive health report
    #[allow(dead_code)]
    pub async fn generate_health_report(
        &self,
    ) -> SystemHealthReport {
        let mut overall_status = SystemHealthStatus::Healthy;
        
        // Determine overall status from individual services
        for health in self.service_health.values() {
            match health.status {
                SystemHealthStatus::Unhealthy => {
                    overall_status = SystemHealthStatus::Unhealthy;
                    break;
                }
                SystemHealthStatus::Degraded => {
                    if overall_status == SystemHealthStatus::Healthy {
                        overall_status = SystemHealthStatus::Degraded;
                    }
                }
                SystemHealthStatus::Unknown => {
                    if overall_status == SystemHealthStatus::Healthy {
                        overall_status = SystemHealthStatus::Unknown;
                    }
                }
                SystemHealthStatus::Healthy => {}
            }
        }
        
        // Get circuit breaker health (placeholder)
        let circuit_breakers = Vec::new();
        
        // Calculate metrics
        let system_metrics = self.calculate_metrics();
        
        SystemHealthReport {
            overall_status,
            timestamp: Utc::now(),
            services: self.service_health.clone(),
            circuit_breakers,
            uptime_seconds: self.start_time.elapsed().as_secs(),
            total_requests: self.total_requests,
            successful_requests: self.successful_requests,
            failed_requests: self.failed_requests,
            system_metrics,
        }
    }
    
    /// Calculate system performance metrics
    fn calculate_metrics(&self) -> SystemMetrics {
        let avg_response_time = if !self.response_times.is_empty() {
            self.response_times.iter().sum::<u64>() as f64 / self.response_times.len() as f64
        } else {
            0.0
        };
        
        let mut sorted_times = self.response_times.clone();
        sorted_times.sort_unstable();
        
        let p95_response_time = if !sorted_times.is_empty() {
            let index = (sorted_times.len() as f64 * 0.95) as usize;
            sorted_times.get(index).copied().unwrap_or(0) as f64
        } else {
            0.0
        };
        
        let p99_response_time = if !sorted_times.is_empty() {
            let index = (sorted_times.len() as f64 * 0.99) as usize;
            sorted_times.get(index).copied().unwrap_or(0) as f64
        } else {
            0.0
        };
        
        let error_rate = if self.total_requests > 0 {
            self.failed_requests as f64 / self.total_requests as f64
        } else {
            0.0
        };
        
        let uptime_seconds = self.start_time.elapsed().as_secs();
        let throughput_rps = if uptime_seconds > 0 {
            self.total_requests as f64 / uptime_seconds as f64
        } else {
            0.0
        };
        
        SystemMetrics {
            avg_response_time_ms: avg_response_time,
            p95_response_time_ms: p95_response_time,
            p99_response_time_ms: p99_response_time,
            error_rate,
            throughput_rps,
            circuit_breaker_trips: self.circuit_breaker_trips,
            fallback_activations: self.fallback_activations,
        }
    }
    
    /// Log health summary
    fn log_health_summary(&self, report: &SystemHealthReport) {
        match report.overall_status {
            SystemHealthStatus::Healthy => {
                if self.config.verbose_logging {
                    info!("System health: HEALTHY - {} services, {:.1}% uptime, {:.0}ms avg response",
                          report.services.len(),
                          (1.0 - report.system_metrics.error_rate) * 100.0,
                          report.system_metrics.avg_response_time_ms);
                }
            }
            SystemHealthStatus::Degraded => {
                warn!("System health: DEGRADED - Error rate: {:.1}%, Circuit breaker trips: {}",
                      report.system_metrics.error_rate * 100.0,
                      report.system_metrics.circuit_breaker_trips);
            }
            SystemHealthStatus::Unhealthy => {
                error!("System health: UNHEALTHY - {} failed services, {:.1}% error rate",
                       report.services.values().filter(|s| s.status == SystemHealthStatus::Unhealthy).count(),
                       report.system_metrics.error_rate * 100.0);
            }
            SystemHealthStatus::Unknown => {
                warn!("System health: UNKNOWN - Health status could not be determined");
            }
        }
    }
    
    /// Record a fallback activation
    pub fn record_fallback_activation(&mut self) {
        self.fallback_activations += 1;
        debug!("Fallback activated, total activations: {}", self.fallback_activations);
    }
    
    /// Get current health statistics
    pub fn get_health_stats(&self) -> HealthStats {
        HealthStats {
            total_requests: self.total_requests,
            successful_requests: self.successful_requests,
            failed_requests: self.failed_requests,
            circuit_breaker_trips: self.circuit_breaker_trips,
            fallback_activations: self.fallback_activations,
            uptime_seconds: self.start_time.elapsed().as_secs(),
            services_monitored: self.service_health.len(),
        }
    }
}

/// Health monitoring statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStats {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub circuit_breaker_trips: u64,
    pub fallback_activations: u64,
    pub uptime_seconds: u64,
    pub services_monitored: usize,
}

/// Health check result for external APIs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalAPIHealth {
    pub service_name: String,
    pub endpoint: String,
    pub status: SystemHealthStatus,
    pub response_time_ms: Option<u64>,
    pub last_check: DateTime<Utc>,
    pub error_message: Option<String>,
}

/// Utility function to check external API health
#[cfg(feature = "reqwest")]
pub async fn check_external_api_health(
    service_name: &str,
    endpoint: &str,
    timeout: Duration,
) -> ExternalAPIHealth {
    let start_time = Instant::now();
    let mut result = ExternalAPIHealth {
        service_name: service_name.to_string(),
        endpoint: endpoint.to_string(),
        status: SystemHealthStatus::Unknown,
        response_time_ms: None,
        last_check: Utc::now(),
        error_message: None,
    };

    // Simple HTTP health check
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build();

    match client {
        Ok(client) => {
            match client.get(endpoint).send().await {
                Ok(response) => {
                    let response_time = start_time.elapsed().as_millis() as u64;
                    result.response_time_ms = Some(response_time);

                    if response.status().is_success() {
                        result.status = SystemHealthStatus::Healthy;
                        debug!("External API {} health check passed in {}ms", service_name, response_time);
                    } else {
                        result.status = SystemHealthStatus::Degraded;
                        result.error_message = Some(format!("HTTP {}", response.status()));
                        warn!("External API {} returned HTTP {}", service_name, response.status());
                    }
                }
                Err(e) => {
                    result.status = SystemHealthStatus::Unhealthy;
                    result.error_message = Some(e.to_string());
                    error!("External API {} health check failed: {}", service_name, e);
                }
            }
        }
        Err(e) => {
            result.status = SystemHealthStatus::Unhealthy;
            result.error_message = Some(format!("Failed to create HTTP client: {}", e));
            error!("Failed to create HTTP client for {}: {}", service_name, e);
        }
    }

    result
}

/// Utility function to check external API health (no-op version when reqwest is not available)
#[cfg(not(feature = "reqwest"))]
pub async fn check_external_api_health(
    service_name: &str,
    endpoint: &str,
    _timeout: Duration,
) -> ExternalAPIHealth {
    ExternalAPIHealth {
        service_name: service_name.to_string(),
        endpoint: endpoint.to_string(),
        status: SystemHealthStatus::Unknown,
        response_time_ms: None,
        last_check: Utc::now(),
        error_message: Some("HTTP client not available (reqwest feature disabled)".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    
    #[test]
    fn test_service_health_creation() {
        let health = ServiceHealth::new("test_service".to_string());
        assert_eq!(health.service_name, "test_service");
        assert_eq!(health.status, SystemHealthStatus::Unknown);
        assert_eq!(health.consecutive_failures, 0);
        assert_eq!(health.total_checks, 0);
    }
    
    #[test]
    fn test_health_monitor_creation() {
        let config = HealthCheckConfig::default();
        let monitor = HealthMonitor::new(config);
        assert_eq!(monitor.total_requests, 0);
        assert_eq!(monitor.service_health.len(), 0);
    }
    
    #[test]
    fn test_metrics_calculation() {
        let config = HealthCheckConfig::default();
        let mut monitor = HealthMonitor::new(config);
        
        // Add some response times
        monitor.response_times = vec![100, 200, 300, 400, 500];
        monitor.total_requests = 10;
        monitor.successful_requests = 8;
        monitor.failed_requests = 2;
        
        let metrics = monitor.calculate_metrics();
        assert_eq!(metrics.avg_response_time_ms, 300.0);
        assert_eq!(metrics.error_rate, 0.2);
    }
    
    #[tokio::test]
    async fn test_external_api_health_check() {
        // Test with a non-existent endpoint
        let health = check_external_api_health(
            "test_service",
            "http://localhost:99999/health",
            Duration::from_millis(100),
        ).await;
        
        assert_eq!(health.service_name, "test_service");
        assert_eq!(health.status, SystemHealthStatus::Unhealthy);
        assert!(health.error_message.is_some());
    }
}