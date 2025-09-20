//! Test utilities and helper functions for comprehensive testing

use std::collections::HashMap;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::{
    crdt::{VesperaCRDT, OperationType, TemplateValue, CodexReference, ReferenceType},
    types::{CodexId, UserId},
    CodexManager, BinderyConfig,
    task_management::{TaskStatus, TaskPriority, TaskInput},
    role_management::{Role, ToolGroup},
};

/// Create a test CRDT with some initial data
pub fn create_test_crdt(codex_id: CodexId, user_id: &str) -> VesperaCRDT {
    let mut crdt = VesperaCRDT::new(codex_id, user_id.to_string());

    // Add some test metadata
    let _ = crdt.set_metadata(
        "title".to_string(),
        TemplateValue::Text {
            value: "Test Codex".to_string(),
            timestamp: Utc::now(),
            user_id: user_id.to_string(),
        }
    );

    crdt
}

/// Create test configuration for isolated testing
pub fn create_test_config() -> BinderyConfig {
    BinderyConfig {
        storage_path: Some(std::env::temp_dir().join(format!("test_{}", Uuid::new_v4()))),
        collaboration_enabled: false,
        max_operations_in_memory: 100,
        auto_gc_enabled: true,
        gc_interval_seconds: 60,
        compression_enabled: false, // Disable for faster tests
        user_id: Some("test_user".to_string()),
        project_id: Some("test_project".to_string()),
    }
}

/// Create a test CodexManager with isolated configuration
pub async fn create_test_manager() -> anyhow::Result<CodexManager> {
    CodexManager::with_config(create_test_config())
}

/// Generate test data for CRDT operations
pub struct TestDataGenerator {
    pub user_count: usize,
    pub operations_per_user: usize,
}

impl TestDataGenerator {
    pub fn new(user_count: usize, operations_per_user: usize) -> Self {
        Self { user_count, operations_per_user }
    }

    /// Generate a series of test operations
    pub fn generate_operations(&self, codex_id: CodexId) -> Vec<(String, OperationType)> {
        let mut operations = Vec::new();

        for user_idx in 0..self.user_count {
            let user_id = format!("user_{}", user_idx);

            for op_idx in 0..self.operations_per_user {
                // Mix different operation types
                match op_idx % 4 {
                    0 => {
                        // Text operations
                        operations.push((
                            user_id.clone(),
                            OperationType::TextInsert {
                                field_id: "content".to_string(),
                                position: op_idx,
                                content: format!("text_{}_{}_{}", user_idx, op_idx, op_idx),
                            }
                        ));
                    }
                    1 => {
                        // Metadata operations
                        operations.push((
                            user_id.clone(),
                            OperationType::MetadataSet {
                                key: format!("meta_{}_{}", user_idx, op_idx),
                                value: TemplateValue::Text {
                                    value: format!("value_{}", op_idx),
                                    timestamp: Utc::now(),
                                    user_id: user_id.clone(),
                                },
                            }
                        ));
                    }
                    2 => {
                        // Reference operations
                        operations.push((
                            user_id.clone(),
                            OperationType::ReferenceAdd {
                                reference: CodexReference {
                                    from_codex_id: codex_id,
                                    to_codex_id: Uuid::new_v4(),
                                    reference_type: ReferenceType::References,
                                    context: Some(format!("ref_{}_{}", user_idx, op_idx)),
                                },
                            }
                        ));
                    }
                    _ => {
                        // Tree operations
                        operations.push((
                            user_id.clone(),
                            OperationType::TreeInsert {
                                parent_id: Some(codex_id),
                                position: op_idx,
                                child_id: Uuid::new_v4(),
                            }
                        ));
                    }
                }
            }
        }

        operations
    }
}

/// Test fixture for creating consistent test environments
pub struct TestFixture {
    pub temp_dir: tempfile::TempDir,
    pub config: BinderyConfig,
}

impl TestFixture {
    pub fn new() -> anyhow::Result<Self> {
        let temp_dir = tempfile::tempdir()?;
        let mut config = create_test_config();
        config.storage_path = Some(temp_dir.path().to_path_buf());

        Ok(Self { temp_dir, config })
    }

    pub fn path(&self) -> &std::path::Path {
        self.temp_dir.path()
    }
}

/// Assert that two CRDTs have converged to the same state
pub fn assert_crdt_convergence(crdt1: &VesperaCRDT, crdt2: &VesperaCRDT) {
    assert_eq!(crdt1.codex_id, crdt2.codex_id, "CRDTs should have same codex_id");

    // Check metadata convergence
    for (key, value1) in crdt1.metadata_layer.iter() {
        if let Some(value2) = crdt2.metadata_layer.get(key) {
            assert_eq!(value1, value2, "Metadata key '{}' should converge", key);
        }
    }

    // Check reference convergence
    let refs1: std::collections::HashSet<_> = crdt1.reference_layer.iter().collect();
    let refs2: std::collections::HashSet<_> = crdt2.reference_layer.iter().collect();
    assert_eq!(refs1, refs2, "References should converge");
}

/// Mock task input for testing
pub fn create_mock_task_input(title: &str) -> TaskInput {
    TaskInput {
        title: title.to_string(),
        description: Some(format!("Test task: {}", title)),
        priority: TaskPriority::Medium,
        due_date: None,
        metadata: HashMap::new(),
    }
}

/// Mock role for testing
pub fn create_mock_role(name: &str, tool_groups: Vec<ToolGroup>) -> Role {
    Role {
        name: name.to_string(),
        description: format!("Test role: {}", name),
        tool_groups,
        file_patterns: vec!["*.rs".to_string(), "*.md".to_string()],
        excluded_patterns: vec!["target/*".to_string()],
        max_file_size_mb: 10,
        max_files_per_operation: 100,
    }
}

/// Performance test helper
pub struct PerformanceTest {
    pub name: String,
    pub start_time: std::time::Instant,
}

impl PerformanceTest {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            start_time: std::time::Instant::now(),
        }
    }

    pub fn assert_duration_under(&self, max_duration: std::time::Duration) {
        let elapsed = self.start_time.elapsed();
        assert!(
            elapsed < max_duration,
            "Performance test '{}' took {:?}, expected under {:?}",
            self.name,
            elapsed,
            max_duration
        );
    }

    pub fn finish(self) -> std::time::Duration {
        let elapsed = self.start_time.elapsed();
        println!("Performance test '{}' completed in {:?}", self.name, elapsed);
        elapsed
    }
}

/// Memory leak detection helper
pub struct MemoryLeakDetector {
    pub initial_memory: usize,
    pub name: String,
}

impl MemoryLeakDetector {
    pub fn new(name: &str) -> Self {
        Self {
            initial_memory: Self::get_memory_usage(),
            name: name.to_string(),
        }
    }

    pub fn assert_no_significant_leak(&self, max_increase_mb: f64) {
        let current_memory = Self::get_memory_usage();
        let increase_mb = (current_memory as f64 - self.initial_memory as f64) / 1024.0 / 1024.0;

        assert!(
            increase_mb < max_increase_mb,
            "Memory leak detected in '{}': increased by {:.2}MB, max allowed {:.2}MB",
            self.name,
            increase_mb,
            max_increase_mb
        );
    }

    fn get_memory_usage() -> usize {
        // Simplified memory usage estimate
        // In a real implementation, this would use proper memory profiling
        std::mem::size_of::<VesperaCRDT>() * 1000 // Rough estimate
    }
}

/// Concurrent test helper
pub async fn run_concurrent_operations<F, Fut>(
    operations: Vec<F>,
    max_concurrency: usize,
) -> Vec<anyhow::Result<()>>
where
    F: FnOnce() -> Fut + Send + 'static,
    Fut: std::future::Future<Output = anyhow::Result<()>> + Send + 'static,
{
    use futures::stream::{FuturesUnordered, StreamExt};

    let mut futures = FuturesUnordered::new();
    let mut results = Vec::new();
    let mut pending = 0;

    for operation in operations {
        if pending >= max_concurrency {
            if let Some(result) = futures.next().await {
                results.push(result);
                pending -= 1;
            }
        }

        futures.push(tokio::spawn(async move { operation().await }));
        pending += 1;
    }

    while let Some(result) = futures.next().await {
        results.push(result.unwrap_or_else(|e| Err(anyhow::Error::from(e))));
    }

    results
}

/// Macro for creating parameterized tests
#[macro_export]
macro_rules! test_with_configs {
    ($test_name:ident, $test_fn:expr) => {
        #[tokio::test]
        async fn $test_name() {
            let configs = vec![
                BinderyConfig::default(),
                BinderyConfig {
                    collaboration_enabled: true,
                    ..Default::default()
                },
                BinderyConfig {
                    max_operations_in_memory: 50,
                    auto_gc_enabled: true,
                    ..Default::default()
                },
            ];

            for config in configs {
                $test_fn(config).await;
            }
        }
    };
}