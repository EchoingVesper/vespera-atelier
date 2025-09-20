//! # Logging and Metrics for Circuit Breakers
//!
//! Provides structured logging and metrics collection for circuit breaker operations,
//! external API calls, and system health monitoring.

use std::collections::HashMap;
use std::time::{Duration, Instant};
use serde::{Serialize, Deserialize};
use tracing::{info, warn, error, debug, instrument};
use chrono::{DateTime, Utc};

use super::{
    circuit_breaker::{CircuitState},
    health_monitor::{SystemHealthStatus},
};

/// Metrics collector for circuit breaker operations
#[derive(Debug, Clone)]
pub struct MetricsCollector {
    request_metrics: HashMap<String, RequestMetrics>,
    circuit_breaker_events: Vec<CircuitBreakerEvent>,
    health_events: Vec<HealthEvent>,
    start_time: Instant,
}

/// Metrics for a specific service
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestMetrics {
    pub service_name: String,
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub timeout_requests: u64,
    pub circuit_breaker_rejections: u64,
    pub fallback_activations: u64,
    pub avg_response_time_ms: f64,
    pub min_response_time_ms: u64,
    pub max_response_time_ms: u64,
    pub last_request_time: Option<DateTime<Utc>>,
}

impl RequestMetrics {
    fn new(service_name: String) -> Self {
        Self {
            service_name,
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            timeout_requests: 0,
            circuit_breaker_rejections: 0,
            fallback_activations: 0,
            avg_response_time_ms: 0.0,
            min_response_time_ms: u64::MAX,
            max_response_time_ms: 0,
            last_request_time: None,
        }
    }
}

/// Circuit breaker state change event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitBreakerEvent {
    pub service_name: String,
    pub timestamp: DateTime<Utc>,
    pub event_type: CircuitBreakerEventType,
    pub previous_state: CircuitState,
    pub new_state: CircuitState,
    pub failure_count: u32,
    pub context: String,
}

/// Types of circuit breaker events
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CircuitBreakerEventType {
    /// Circuit opened due to failures
    Opened,
    /// Circuit closed after recovery
    Closed,
    /// Circuit transitioned to half-open for testing
    HalfOpened,
    /// Request rejected due to open circuit
    RequestRejected,
    /// Request succeeded during half-open state
    HalfOpenSuccess,
    /// Request failed during half-open state
    HalfOpenFailure,
    /// Circuit breaker was manually reset
    ManualReset,
    /// Circuit breaker was forcibly opened
    ForceOpen,
}

/// Health monitoring event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthEvent {
    pub timestamp: DateTime<Utc>,
    pub service_name: String,
    pub event_type: HealthEventType,
    pub status: SystemHealthStatus,
    pub response_time_ms: Option<u64>,
    pub error_message: Option<String>,
}

/// Types of health events
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum HealthEventType {
    /// Health check started
    CheckStarted,
    /// Health check completed successfully
    CheckPassed,
    /// Health check failed
    CheckFailed,
    /// Service status changed
    StatusChanged,
    /// Fallback mechanism activated
    FallbackActivated,
    /// Service recovered
    ServiceRecovered,
}

impl MetricsCollector {
    /// Create a new metrics collector
    pub fn new() -> Self {
        info!("Initializing metrics collector");
        
        Self {
            request_metrics: HashMap::new(),
            circuit_breaker_events: Vec::new(),
            health_events: Vec::new(),
            start_time: Instant::now(),
        }
    }
    
    /// Record a request attempt
    #[instrument(skip(self))]
    pub fn record_request_start(&mut self, service_name: &str) {
        let metrics = self.request_metrics
            .entry(service_name.to_string())
            .or_insert_with(|| RequestMetrics::new(service_name.to_string()));
        
        metrics.total_requests += 1;
        metrics.last_request_time = Some(Utc::now());
        
        debug!("Recording request start for service: {}", service_name);
    }
    
    /// Record a successful request
    #[instrument(skip(self))]
    pub fn record_request_success(
        &mut self,
        service_name: &str,
        response_time: Duration,
    ) {
        let response_time_ms = response_time.as_millis() as u64;
        
        if let Some(metrics) = self.request_metrics.get_mut(service_name) {
            metrics.successful_requests += 1;
            
            // Update response time statistics
            let total_successful = metrics.successful_requests;
            metrics.avg_response_time_ms = (
                metrics.avg_response_time_ms * (total_successful - 1) as f64 + response_time_ms as f64
            ) / total_successful as f64;
            
            metrics.min_response_time_ms = metrics.min_response_time_ms.min(response_time_ms);
            metrics.max_response_time_ms = metrics.max_response_time_ms.max(response_time_ms);
        }
        
        debug!("Request succeeded for service: {} in {}ms", service_name, response_time_ms);
    }
    
    /// Record a failed request
    #[instrument(skip(self))]
    pub fn record_request_failure(
        &mut self,
        service_name: &str,
        error: &str,
        is_timeout: bool,
    ) {
        if let Some(metrics) = self.request_metrics.get_mut(service_name) {
            metrics.failed_requests += 1;
            
            if is_timeout {
                metrics.timeout_requests += 1;
            }
        }
        
        warn!("Request failed for service: {} - Error: {}", service_name, error);
    }
    
    /// Record a circuit breaker rejection
    #[instrument(skip(self))]
    pub fn record_circuit_breaker_rejection(&mut self, service_name: &str) {
        if let Some(metrics) = self.request_metrics.get_mut(service_name) {
            metrics.circuit_breaker_rejections += 1;
        }
        
        // Record circuit breaker event
        let event = CircuitBreakerEvent {
            service_name: service_name.to_string(),
            timestamp: Utc::now(),
            event_type: CircuitBreakerEventType::RequestRejected,
            previous_state: CircuitState::Open, // Assumption since request was rejected
            new_state: CircuitState::Open,
            failure_count: 0, // Not available in this context
            context: "Request rejected due to open circuit".to_string(),
        };
        
        self.circuit_breaker_events.push(event);
        
        warn!("Circuit breaker rejected request for service: {}", service_name);
    }
    
    /// Record a fallback activation
    #[instrument(skip(self))]
    pub fn record_fallback_activation(&mut self, service_name: &str, fallback_type: &str) {
        if let Some(metrics) = self.request_metrics.get_mut(service_name) {
            metrics.fallback_activations += 1;
        }
        
        // Record health event
        let event = HealthEvent {
            timestamp: Utc::now(),
            service_name: service_name.to_string(),
            event_type: HealthEventType::FallbackActivated,
            status: SystemHealthStatus::Degraded,
            response_time_ms: None,
            error_message: Some(format!("Fallback activated: {}", fallback_type)),
        };
        
        self.health_events.push(event);
        
        warn!("Fallback activated for service: {} - Type: {}", service_name, fallback_type);
    }
    
    /// Record a circuit breaker state change
    #[instrument(skip(self))]
    pub fn record_circuit_breaker_state_change(
        &mut self,
        service_name: &str,
        previous_state: CircuitState,
        new_state: CircuitState,
        failure_count: u32,
        context: &str,
    ) {
        let event_type = match (&previous_state, &new_state) {
            (CircuitState::Closed, CircuitState::Open) => CircuitBreakerEventType::Opened,
            (CircuitState::Open, CircuitState::HalfOpen) => CircuitBreakerEventType::HalfOpened,
            (CircuitState::HalfOpen, CircuitState::Closed) => CircuitBreakerEventType::Closed,
            (CircuitState::HalfOpen, CircuitState::Open) => CircuitBreakerEventType::HalfOpenFailure,
            _ => return, // No significant state change
        };
        
        let event = CircuitBreakerEvent {
            service_name: service_name.to_string(),
            timestamp: Utc::now(),
            event_type: event_type.clone(),
            previous_state: previous_state.clone(),
            new_state: new_state.clone(),
            failure_count,
            context: context.to_string(),
        };
        
        self.circuit_breaker_events.push(event);
        
        match event_type {
            CircuitBreakerEventType::Opened => {
                error!("Circuit breaker OPENED for service: {} after {} failures - {}", 
                       service_name, failure_count, context);
            }
            CircuitBreakerEventType::Closed => {
                info!("Circuit breaker CLOSED for service: {} - {}", service_name, context);
            }
            CircuitBreakerEventType::HalfOpened => {
                info!("Circuit breaker HALF-OPEN for service: {} - {}", service_name, context);
            }
            _ => {
                debug!("Circuit breaker state change for service: {} - {:?} -> {:?}",
                      service_name, &previous_state, new_state);
            }
        }
    }
    
    /// Record a health check event
    #[instrument(skip(self))]
    pub fn record_health_event(
        &mut self,
        service_name: &str,
        event_type: HealthEventType,
        status: SystemHealthStatus,
        response_time: Option<Duration>,
        error_message: Option<String>,
    ) {
        let event = HealthEvent {
            timestamp: Utc::now(),
            service_name: service_name.to_string(),
            event_type: event_type.clone(),
            status: status.clone(),
            response_time_ms: response_time.map(|d| d.as_millis() as u64),
            error_message,
        };
        
        self.health_events.push(event);
        
        match event_type {
            HealthEventType::CheckFailed => {
                warn!("Health check failed for service: {} - Status: {:?}", service_name, status);
            }
            HealthEventType::StatusChanged => {
                info!("Service status changed: {} - New status: {:?}", service_name, status);
            }
            HealthEventType::ServiceRecovered => {
                info!("Service recovered: {} - Status: {:?}", service_name, status);
            }
            _ => {
                debug!("Health event for service: {} - {:?}", service_name, event_type);
            }
        }
    }
    
    /// Get metrics for a specific service
    pub fn get_service_metrics(&self, service_name: &str) -> Option<&RequestMetrics> {
        self.request_metrics.get(service_name)
    }
    
    /// Get all service metrics
    pub fn get_all_metrics(&self) -> &HashMap<String, RequestMetrics> {
        &self.request_metrics
    }
    
    /// Get recent circuit breaker events
    pub fn get_recent_circuit_breaker_events(&self, limit: usize) -> Vec<&CircuitBreakerEvent> {
        self.circuit_breaker_events
            .iter()
            .rev()
            .take(limit)
            .collect()
    }
    
    /// Get recent health events
    pub fn get_recent_health_events(&self, limit: usize) -> Vec<&HealthEvent> {
        self.health_events
            .iter()
            .rev()
            .take(limit)
            .collect()
    }
    
    /// Generate a comprehensive metrics report
    pub fn generate_metrics_report(&self) -> MetricsReport {
        let uptime = self.start_time.elapsed();
        
        let mut total_requests = 0;
        let mut total_successful = 0;
        let mut total_failed = 0;
        let mut total_circuit_breaker_rejections = 0;
        let mut total_fallback_activations = 0;
        
        for metrics in self.request_metrics.values() {
            total_requests += metrics.total_requests;
            total_successful += metrics.successful_requests;
            total_failed += metrics.failed_requests;
            total_circuit_breaker_rejections += metrics.circuit_breaker_rejections;
            total_fallback_activations += metrics.fallback_activations;
        }
        
        let success_rate = if total_requests > 0 {
            total_successful as f64 / total_requests as f64
        } else {
            0.0
        };
        
        let error_rate = if total_requests > 0 {
            total_failed as f64 / total_requests as f64
        } else {
            0.0
        };
        
        MetricsReport {
            timestamp: Utc::now(),
            uptime_seconds: uptime.as_secs(),
            total_requests,
            successful_requests: total_successful,
            failed_requests: total_failed,
            circuit_breaker_rejections: total_circuit_breaker_rejections,
            fallback_activations: total_fallback_activations,
            success_rate,
            error_rate,
            services_monitored: self.request_metrics.len(),
            circuit_breaker_events_count: self.circuit_breaker_events.len(),
            health_events_count: self.health_events.len(),
            service_metrics: self.request_metrics.clone(),
        }
    }
    
    /// Clean up old events to prevent memory growth
    pub fn cleanup_old_events(&mut self, max_events: usize) {
        if self.circuit_breaker_events.len() > max_events {
            let keep_from = self.circuit_breaker_events.len() - max_events;
            self.circuit_breaker_events.drain(0..keep_from);
        }
        
        if self.health_events.len() > max_events {
            let keep_from = self.health_events.len() - max_events;
            self.health_events.drain(0..keep_from);
        }
        
        debug!("Cleaned up old events, keeping last {} events", max_events);
    }
    
    /// Export metrics to JSON format
    pub fn export_metrics_json(&self) -> Result<String, serde_json::Error> {
        let report = self.generate_metrics_report();
        serde_json::to_string_pretty(&report)
    }
}

/// Comprehensive metrics report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsReport {
    pub timestamp: DateTime<Utc>,
    pub uptime_seconds: u64,
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub circuit_breaker_rejections: u64,
    pub fallback_activations: u64,
    pub success_rate: f64,
    pub error_rate: f64,
    pub services_monitored: usize,
    pub circuit_breaker_events_count: usize,
    pub health_events_count: usize,
    pub service_metrics: HashMap<String, RequestMetrics>,
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

/// Log a structured circuit breaker event
#[macro_export]
macro_rules! log_circuit_breaker_event {
    ($level:ident, $service:expr, $event:expr, $($key:expr => $value:expr),*) => {
        tracing::$level!(
            service = $service,
            event = ?$event,
            $($key = $value,)*
            "Circuit breaker event"
        );
    };
}

/// Log a structured API request event
#[macro_export]
macro_rules! log_api_request {
    ($level:ident, $service:expr, $method:expr, $url:expr, $status:expr, $duration:expr) => {
        tracing::$level!(
            service = $service,
            method = $method,
            url = $url,
            status = $status,
            duration_ms = $duration.as_millis(),
            "API request completed"
        );
    };
}

/// Log a structured health check event
#[macro_export]
macro_rules! log_health_check {
    ($level:ident, $service:expr, $status:expr, $($key:expr => $value:expr),*) => {
        tracing::$level!(
            service = $service,
            health_status = ?$status,
            $($key = $value,)*
            "Health check completed"
        );
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    
    #[test]
    fn test_metrics_collector_creation() {
        let collector = MetricsCollector::new();
        assert_eq!(collector.request_metrics.len(), 0);
        assert_eq!(collector.circuit_breaker_events.len(), 0);
    }
    
    #[test]
    fn test_request_metrics_recording() {
        let mut collector = MetricsCollector::new();
        
        collector.record_request_start("test_service");
        collector.record_request_success("test_service", Duration::from_millis(100));
        
        let metrics = collector.get_service_metrics("test_service").unwrap();
        assert_eq!(metrics.total_requests, 1);
        assert_eq!(metrics.successful_requests, 1);
        assert_eq!(metrics.avg_response_time_ms, 100.0);
    }
    
    #[test]
    fn test_circuit_breaker_event_recording() {
        let mut collector = MetricsCollector::new();
        
        collector.record_circuit_breaker_state_change(
            "test_service",
            CircuitState::Closed,
            CircuitState::Open,
            5,
            "Too many failures",
        );
        
        let events = collector.get_recent_circuit_breaker_events(10);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].service_name, "test_service");
        assert_eq!(events[0].event_type, CircuitBreakerEventType::Opened);
    }
    
    #[test]
    fn test_metrics_report_generation() {
        let mut collector = MetricsCollector::new();
        
        collector.record_request_start("service1");
        collector.record_request_success("service1", Duration::from_millis(50));
        collector.record_request_start("service1");
        collector.record_request_failure("service1", "timeout", true);
        
        let report = collector.generate_metrics_report();
        assert_eq!(report.total_requests, 2);
        assert_eq!(report.successful_requests, 1);
        assert_eq!(report.failed_requests, 1);
        assert_eq!(report.success_rate, 0.5);
        assert_eq!(report.error_rate, 0.5);
    }
    
    #[test]
    fn test_event_cleanup() {
        let mut collector = MetricsCollector::new();
        
        // Add more events than the limit
        for i in 0..15 {
            collector.record_circuit_breaker_state_change(
                &format!("service_{}", i),
                CircuitState::Closed,
                CircuitState::Open,
                5,
                "test",
            );
        }
        
        assert_eq!(collector.circuit_breaker_events.len(), 15);
        
        collector.cleanup_old_events(10);
        assert_eq!(collector.circuit_breaker_events.len(), 10);
    }
}