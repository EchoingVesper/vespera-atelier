# Circuit Breaker Implementation for External API Calls

## Overview

This implementation provides comprehensive circuit breaker protection for external API calls in the vespera-bindery system, specifically targeting the RAG (Retrieval-Augmented Generation) embedding services. The implementation prevents cascading failures, provides graceful degradation, and includes extensive monitoring and fallback mechanisms.

## 🎯 Implementation Summary

### External APIs Protected

1. **OpenAI Embeddings API** (`https://api.openai.com/v1/embeddings`)
   - Text embeddings for semantic search
   - Circuit breaker with configurable failure thresholds
   - Retry logic with exponential backoff

2. **Cohere Embeddings API** (`https://api.cohere.ai/v1/embed`)
   - Alternative embedding service
   - Independent circuit breaker configuration
   - Fallback option when OpenAI fails

3. **HuggingFace Hub API** (model downloads)
   - Model file downloads for local inference
   - Protected against download failures
   - Cached model management

4. **Generic HTTP Requests** (via reqwest)
   - Health check endpoints
   - Any custom API integrations
   - Configurable timeouts and retries

## 🔧 Core Components

### 1. Circuit Breaker Implementation (`src/rag/circuit_breaker.rs`)

**Features:**
- **States**: Closed, Open, Half-Open
- **Configurable thresholds**: Failure count, recovery timeout, success threshold
- **Retry logic**: Exponential backoff with jitter
- **Timeout protection**: Request-level timeouts
- **Metrics collection**: Comprehensive state tracking
- **Manual control**: Force open/close, reset capabilities

**Configuration Options:**
```rust
CircuitBreakerConfig {
    failure_threshold: 5,           // Failures before opening
    recovery_timeout: 30s,          // Time before half-open test
    request_timeout: 30s,           // Individual request timeout
    max_retries: 3,                 // Number of retry attempts
    initial_backoff: 100ms,         // Initial retry delay
    max_backoff: 10s,              // Maximum retry delay
    backoff_multiplier: 2.0,        // Exponential backoff factor
    success_threshold: 3,           // Successes to close circuit
}
```

### 2. Fallback Service (`src/rag/fallback_service.rs`)

**Fallback Strategies:**
- **Mock Embeddings**: Deterministic, normalized vectors based on text hash
- **Keyword Search**: TF-IDF style search with fuzzy matching
- **Cached Results**: Time-based caching with configurable TTL
- **Hybrid Strategy**: Cascading fallback mechanisms

**Features:**
- Levenshtein distance for fuzzy matching
- In-memory keyword indexing
- Cache management with automatic cleanup
- Search result highlighting

### 3. Health Monitoring (`src/rag/health_monitor.rs`)

**Monitoring Capabilities:**
- **Service Health Checks**: Regular health polling
- **Response Time Tracking**: P95, P99 percentiles
- **Error Rate Monitoring**: Success/failure ratios
- **Circuit Breaker State Tracking**: Real-time state monitoring
- **Automatic Recovery Detection**: Health-based circuit breaker reset

**Health Status Levels:**
- `Healthy`: All services operational
- `Degraded`: Some services down, fallbacks active
- `Unhealthy`: Critical services unavailable
- `Unknown`: Unable to determine status

### 4. Metrics and Logging (`src/rag/logging.rs`)

**Metrics Collection:**
- Request counts (total, successful, failed)
- Response time statistics
- Circuit breaker events (open/close/half-open)
- Fallback activation tracking
- Health check results

**Structured Logging:**
- Circuit breaker state changes
- API request/response logging
- Health check events
- Performance metrics
- Error tracking with context

**Event Types:**
- `CircuitBreakerEvent`: State transitions, rejections
- `HealthEvent`: Health checks, status changes
- `RequestMetrics`: Per-service statistics

## 🔌 Circuit Breaker States and Transitions

```
[CLOSED] → (failures >= threshold) → [OPEN]
    ↑                                     ↓
    |                            (recovery_timeout)
    |                                     ↓
[CLOSED] ← (successes >= threshold) ← [HALF-OPEN]
    ↑                                     ↓
    |                              (any failure)
    ←─────────────────────────── [OPEN]
```

**State Behaviors:**
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Fast-fail, requests rejected immediately
- **HALF-OPEN**: Testing recovery, limited requests allowed

## ⚙️ Configuration

### Environment Variables

See `.env.example` for comprehensive configuration options:

```bash
# API Keys
OPENAI_API_KEY=sk-...
COHERE_API_KEY=...
HF_API_KEY=hf_...

# Circuit Breaker Settings (per service)
OPENAI_CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
OPENAI_CIRCUIT_BREAKER_RECOVERY_TIMEOUT_SECONDS=30
OPENAI_CIRCUIT_BREAKER_REQUEST_TIMEOUT_SECONDS=30

# Fallback Configuration
FALLBACK_ENABLE_MOCK_EMBEDDINGS=true
FALLBACK_ENABLE_KEYWORD_SEARCH=true
FALLBACK_STRATEGY=hybrid

# Health Monitoring
HEALTH_CHECK_INTERVAL_SECONDS=30
HEALTH_AUTO_RESET_CIRCUIT_BREAKERS=false
```

### Cargo Features

Enable specific embedding backends:
```toml
[features]
embeddings-api = ["reqwest", "dotenvy"]      # External API calls
embeddings-local = ["candle-core", "hf-hub"]  # Local model inference
embeddings-onnx = ["ort", "hf-hub"]          # ONNX runtime
embeddings-all = ["embeddings-api", "embeddings-local", "embeddings-onnx"]
```

## 📊 Metrics and Monitoring

### Available Metrics

```rust
MetricsReport {
    total_requests: u64,
    successful_requests: u64,
    failed_requests: u64,
    circuit_breaker_rejections: u64,
    fallback_activations: u64,
    success_rate: f64,
    error_rate: f64,
    avg_response_time_ms: f64,
    p95_response_time_ms: f64,
    p99_response_time_ms: f64,
}
```

### Health Monitoring

```rust
SystemHealthReport {
    overall_status: SystemHealthStatus,
    services: HashMap<String, ServiceHealth>,
    circuit_breakers: Vec<CircuitBreakerHealth>,
    system_metrics: SystemMetrics,
}
```

### Logging Macros

```rust
// Circuit breaker events
log_circuit_breaker_event!(info, "openai", CircuitBreakerEventType::Opened, 
                           "failure_count" => 5);

// API requests
log_api_request!(info, "openai", "POST", "/v1/embeddings", 200, duration);

// Health checks
log_health_check!(warn, "cohere", SystemHealthStatus::Degraded, 
                  "error" => "timeout");
```

## 🚀 Usage Examples

### Basic Circuit Breaker Usage

```rust
use vespera_bindery::rag::{
    CircuitBreakerConfig, CircuitBreakerRegistry
};

// Create circuit breaker registry
let config = CircuitBreakerConfig::default();
let registry = CircuitBreakerRegistry::new(config);
let breaker = registry.get_breaker("openai").await?;

// Execute protected operation
let result = breaker.execute(|| {
    Box::pin(async {
        // Your API call here
        reqwest::get("https://api.openai.com/health").await
    })
}).await;
```

### Fallback Service Usage

```rust
use vespera_bindery::rag::{
    FallbackEmbeddingService, FallbackConfig, FallbackStrategy
};

// Create fallback service
let config = FallbackConfig::default();
let mut fallback = FallbackEmbeddingService::new(config);

// Generate mock embeddings
let embedding = fallback.generate_mock_embedding("sample text").await?;

// Perform keyword search
let results = fallback.keyword_search("rust programming", 5).await?;
```

### Health Monitoring

```rust
use vespera_bindery::rag::{
    HealthMonitor, HealthCheckConfig
};

// Create health monitor
let config = HealthCheckConfig::default();
let mut monitor = HealthMonitor::new(config);

// Generate health report
let report = monitor.generate_health_report(&service).await;
info!("System health: {:?}", report.overall_status);
```

## 🔄 Demo Script

Run the comprehensive demo:

```bash
cd packages/vespera-utilities/vespera-bindery
cargo run --example circuit_breaker_demo --features "embeddings-api"
```

The demo demonstrates:
- Circuit breaker state transitions
- Retry logic with exponential backoff
- Fallback mechanism activation
- Health monitoring
- Metrics collection
- Manual circuit breaker control

## 📁 File Structure

```
src/rag/
├── circuit_breaker.rs      # Core circuit breaker implementation
├── fallback_service.rs     # Fallback mechanisms
├── health_monitor.rs       # Health monitoring system
├── logging.rs              # Metrics and structured logging
├── embeddings_impl.rs      # Enhanced with circuit breaker support
└── mod.rs                  # Module exports and configuration

examples/
└── circuit_breaker_demo.rs # Comprehensive demonstration

.env.example                 # Configuration template
CIRCUIT_BREAKER_IMPLEMENTATION.md  # This documentation
```

## ✨ Key Benefits

1. **Prevents Cascading Failures**: Circuit breakers stop failed requests from overwhelming external services

2. **Graceful Degradation**: Multiple fallback strategies ensure system remains functional

3. **Performance Protection**: Timeouts and retries prevent resource exhaustion

4. **Comprehensive Monitoring**: Real-time visibility into system health and performance

5. **Automatic Recovery**: Smart recovery detection with configurable thresholds

6. **Operational Control**: Manual circuit breaker management for maintenance scenarios

7. **Production Ready**: Extensive testing, logging, and metrics collection

## 🔒 Error Handling Strategy

1. **Primary Service Available**: Normal operation through circuit breaker
2. **Primary Service Degraded**: Retry with exponential backoff
3. **Primary Service Failed**: Circuit opens, requests rejected
4. **Fallback Activation**: Mock embeddings or keyword search
5. **All Services Failed**: Graceful error responses with context

## 📈 Performance Considerations

- **Memory Usage**: Configurable event history limits
- **CPU Impact**: Efficient state management with minimal overhead
- **Network Efficiency**: Request batching and connection pooling
- **Latency**: Fast-fail for open circuits, optimized retry logic
- **Scalability**: Thread-safe implementation with Arc/Mutex

## 🐛 Testing

Run the test suite:

```bash
# Unit tests
cargo test circuit_breaker
cargo test fallback_service
cargo test health_monitor
cargo test logging

# Integration tests
cargo test --test integration_tests

# Demo with mock failures
TEST_SIMULATE_FAILURES=true cargo run --example circuit_breaker_demo
```

## 🔍 Future Enhancements

1. **Adaptive Thresholds**: Machine learning-based threshold adjustment
2. **Distributed Circuit Breakers**: Coordination across multiple instances
3. **Webhook Notifications**: External alerting for circuit breaker events
4. **Dashboard UI**: Real-time circuit breaker status visualization
5. **Custom Fallback Strategies**: Plugin system for domain-specific fallbacks
6. **Advanced Metrics**: Histogram-based latency tracking
7. **Circuit Breaker Policies**: Time-based, request-based, and custom policies

---

**Implementation completed successfully!** ✅

The circuit breaker system provides robust protection against external API failures while maintaining system functionality through intelligent fallback mechanisms and comprehensive monitoring.