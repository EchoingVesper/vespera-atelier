//! # Circuit Breaker Demo
//!
//! Demonstrates the circuit breaker system with external API protection,
//! fallback mechanisms, and comprehensive monitoring.

use std::time::Duration;
use tokio::time::sleep;
use anyhow::Result;
use tracing::{info, warn, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use vespera_bindery::rag::{
    CircuitBreakerConfig, CircuitBreakerRegistry, CircuitState,
    FallbackEmbeddingService, FallbackConfig, FallbackStrategy,
    HealthMonitor, HealthCheckConfig, SystemHealthStatus,
    MetricsCollector, EmbeddingModel,
    DocumentChunk,
};
use uuid::Uuid;
use std::collections::HashMap;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "circuit_breaker_demo=debug,vespera_bindery=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("🔧 Starting Circuit Breaker Demo");

    // 1. Configure circuit breakers for different services
    let openai_config = CircuitBreakerConfig {
        failure_threshold: 3,
        recovery_timeout: Duration::from_secs(10),
        request_timeout: Duration::from_secs(5),
        max_retries: 2,
        initial_backoff: Duration::from_millis(100),
        max_backoff: Duration::from_secs(5),
        backoff_multiplier: 2.0,
        success_threshold: 2,
    };

    let cohere_config = CircuitBreakerConfig {
        failure_threshold: 5,
        recovery_timeout: Duration::from_secs(15),
        request_timeout: Duration::from_secs(10),
        max_retries: 3,
        initial_backoff: Duration::from_millis(200),
        max_backoff: Duration::from_secs(10),
        backoff_multiplier: 1.5,
        success_threshold: 3,
    };

    // Create circuit breaker registry
    let registry = CircuitBreakerRegistry::new(openai_config.clone());
    let openai_breaker = registry.get_breaker_with_config("openai", openai_config).await?;
    let cohere_breaker = registry.get_breaker_with_config("cohere", cohere_config).await?;

    info!("✅ Circuit breakers initialized for OpenAI and Cohere");

    // 2. Set up fallback service
    let fallback_config = FallbackConfig {
        enable_mock_embeddings: true,
        enable_keyword_search: true,
        enable_cached_results: true,
        cache_max_age_seconds: 300, // 5 minutes
        enable_fuzzy_matching: true,
        fuzzy_threshold: 0.7,
    };

    let mut fallback_service = FallbackEmbeddingService::new(fallback_config);

    // Index some sample data for fallback search
    let sample_chunks = create_sample_chunks();
    for chunk in &sample_chunks {
        fallback_service.index_chunk_for_fallback(chunk).await?;
    }

    info!("✅ Fallback service initialized with {} sample chunks", sample_chunks.len());

    // 3. Initialize metrics collector
    let mut metrics = MetricsCollector::new();

    // 4. Demonstrate circuit breaker behavior
    info!("🔄 Demonstrating circuit breaker behavior...");

    // Simulate successful requests
    info!("📊 Testing successful requests...");
    for i in 1..=3 {
        let result = simulate_api_request(&openai_breaker, &mut metrics, "openai", true).await;
        match result {
            Ok(_) => info!("✅ Request {}/3 succeeded", i),
            Err(e) => warn!("❌ Request {}/3 failed: {}", i, e),
        }
        sleep(Duration::from_millis(100)).await;
    }

    // Simulate failing requests to trigger circuit breaker
    info!("📊 Testing failing requests to trigger circuit breaker...");
    for i in 1..=5 {
        let result = simulate_api_request(&openai_breaker, &mut metrics, "openai", false).await;
        match result {
            Ok(_) => info!("✅ Request {}/5 succeeded", i),
            Err(e) => warn!("❌ Request {}/5 failed: {}", i, e),
        }
        
        let state = openai_breaker.get_state().await?;
        info!("🔌 Circuit breaker state: {:?}", state);
        
        if state == CircuitState::Open {
            info!("⚡ Circuit breaker is now OPEN!");
            break;
        }
        
        sleep(Duration::from_millis(100)).await;
    }

    // Demonstrate circuit breaker rejection
    info!("📊 Testing circuit breaker rejection...");
    let result = simulate_api_request(&openai_breaker, &mut metrics, "openai", true).await;
    match result {
        Ok(_) => warn!("⚠️  Request should have been rejected!"),
        Err(e) => {
            if e.to_string().contains("Circuit breaker is OPEN") {
                info!("✅ Request correctly rejected by circuit breaker");
            } else {
                warn!("❓ Request failed for different reason: {}", e);
            }
        }
    }

    // Demonstrate fallback mechanisms
    info!("🔄 Demonstrating fallback mechanisms...");
    
    // Mock embeddings fallback
    info!("📊 Testing mock embeddings fallback...");
    let mock_embeddings = fallback_service.generate_mock_embedding("test query").await?;
    info!("✅ Generated mock embedding with {} dimensions", mock_embeddings.len());

    // Keyword search fallback
    info!("📊 Testing keyword search fallback...");
    let search_results = fallback_service.keyword_search("Rust programming language", 3).await?;
    info!("✅ Keyword search found {} results", search_results.len());
    for (i, result) in search_results.iter().enumerate() {
        info!("  {}. Score: {:.3} - {}", 
              i + 1, 
              result.score, 
              result.content.chars().take(50).collect::<String>());
    }

    // 5. Wait for circuit breaker recovery and test
    info!("⏰ Waiting for circuit breaker recovery...");
    sleep(Duration::from_secs(11)).await; // Wait longer than recovery timeout

    info!("📊 Testing circuit breaker recovery...");
    let result = simulate_api_request(&openai_breaker, &mut metrics, "openai", true).await;
    match result {
        Ok(_) => {
            info!("✅ Circuit breaker recovered and request succeeded!");
            let state = openai_breaker.get_state().await?;
            info!("🔌 Circuit breaker state: {:?}", state);
        }
        Err(e) => warn!("❌ Recovery test failed: {}", e),
    }

    // 6. Generate comprehensive metrics report
    info!("📈 Generating metrics report...");
    let report = metrics.generate_metrics_report();
    info!("📊 Metrics Summary:");
    info!("   • Total requests: {}", report.total_requests);
    info!("   • Successful requests: {}", report.successful_requests);
    info!("   • Failed requests: {}", report.failed_requests);
    info!("   • Circuit breaker rejections: {}", report.circuit_breaker_rejections);
    info!("   • Success rate: {:.1}%", report.success_rate * 100.0);
    info!("   • Error rate: {:.1}%", report.error_rate * 100.0);
    info!("   • Services monitored: {}", report.services_monitored);

    // 7. Demonstrate health monitoring
    info!("🏥 Testing health monitoring...");
    let health_config = HealthCheckConfig {
        check_interval: Duration::from_secs(1),
        check_timeout: Duration::from_millis(500),
        failure_threshold: 2,
        recovery_threshold: 1,
        auto_reset_circuit_breakers: false,
        verbose_logging: true,
    };

    // Get circuit breaker health status
    let cb_health = registry.get_health_status().await?;
    info!("🔌 Circuit Breaker Health Status:");
    for health in &cb_health {
        info!("   • {}: {:?} (healthy: {})", 
              health.service_name, 
              health.state, 
              health.is_healthy);
        if let Some(failure_time) = &health.last_failure {
            info!("     Last failure: {:?} ago", failure_time);
        }
    }

    // 8. Test manual circuit breaker operations
    info!("🔧 Testing manual circuit breaker operations...");
    
    // Force open
    cohere_breaker.force_open().await?;
    let state = cohere_breaker.get_state().await?;
    info!("🔌 Cohere circuit breaker forced open: {:?}", state);
    
    // Reset
    cohere_breaker.reset().await?;
    let state = cohere_breaker.get_state().await?;
    info!("🔌 Cohere circuit breaker reset: {:?}", state);

    // 9. Export metrics
    info!("💾 Exporting metrics...");
    let metrics_json = metrics.export_metrics_json()?;
    println!("\n📋 Exported Metrics (JSON):");
    println!("{}", metrics_json);

    info!("✅ Circuit Breaker Demo completed successfully!");
    
    // Summary of demonstrated features
    println!("\n🎯 Demo Summary:");
    println!("✅ Circuit breaker pattern implementation");
    println!("✅ Retry logic with exponential backoff");
    println!("✅ Timeout configurations");
    println!("✅ Fallback mechanisms (mock embeddings, keyword search)");
    println!("✅ Health checks and monitoring");
    println!("✅ Comprehensive metrics and logging");
    println!("✅ Manual circuit breaker control");
    println!("✅ Graceful degradation strategies");
    
    Ok(())
}

/// Simulate an API request with circuit breaker protection
async fn simulate_api_request(
    circuit_breaker: &vespera_bindery::rag::CircuitBreaker,
    metrics: &mut MetricsCollector,
    service_name: &str,
    should_succeed: bool,
) -> Result<String> {
    metrics.record_request_start(service_name);
    
    let start_time = std::time::Instant::now();
    
    let result = circuit_breaker.execute(|| {
        let should_succeed = should_succeed;
        Box::pin(async move {
            // Simulate network delay
            sleep(Duration::from_millis(50 + rand::random::<u64>() % 100)).await;
            
            if should_succeed {
                Ok("API response data".to_string())
            } else {
                Err(anyhow::anyhow!("Simulated API failure"))
            }
        })
    }).await;
    
    let duration = start_time.elapsed();
    
    match &result {
        Ok(_) => {
            metrics.record_request_success(service_name, duration);
        }
        Err(e) => {
            if e.to_string().contains("Circuit breaker is OPEN") {
                metrics.record_circuit_breaker_rejection(service_name);
            } else {
                let is_timeout = e.to_string().contains("timeout");
                metrics.record_request_failure(service_name, &e.to_string(), is_timeout);
            }
        }
    }
    
    result
}

/// Create sample document chunks for fallback testing
fn create_sample_chunks() -> Vec<DocumentChunk> {
    let doc_id = Uuid::new_v4();
    let mut chunks = Vec::new();
    
    let sample_texts = vec![
        "Rust is a systems programming language that runs blazingly fast.",
        "Python is a high-level programming language with dynamic semantics.",
        "JavaScript is a programming language that conforms to the ECMAScript specification.",
        "Machine learning is a method of data analysis that automates analytical model building.",
        "Artificial intelligence refers to the simulation of human intelligence in machines.",
    ];
    
    for (i, text) in sample_texts.iter().enumerate() {
        chunks.push(DocumentChunk {
            id: format!("chunk_{}", i),
            document_id: doc_id,
            content: text.to_string(),
            chunk_index: i,
            total_chunks: sample_texts.len(),
            start_char: 0,
            end_char: text.len(),
            metadata: HashMap::new(),
        });
    }
    
    chunks
}