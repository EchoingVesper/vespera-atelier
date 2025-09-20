//! Benchmark Utilities and Test Data Generators
//!
//! This module provides shared utilities, test data generators, and helper functions
//! for benchmark suites to ensure consistent and realistic test scenarios.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use rand::{Rng, SeedableRng};
use rand_xorshift::XorShiftRng;
use tempfile::TempDir;

use vespera_bindery::{
    types::{CodexId, UserId, Template, VectorClock},
    crdt::{CRDTOperation, OperationType},
    task_management::{TaskInput, TaskPriority, TaskStatus},
    role_management::{RoleDefinition, Capability, ToolGroup},
    rag::{DocumentMetadata, DocumentType, DocumentChunk},
};

/// Seeded random number generator for reproducible benchmarks
pub struct BenchmarkRng {
    rng: XorShiftRng,
}

impl BenchmarkRng {
    /// Create a new seeded RNG for reproducible results
    pub fn new(seed: u64) -> Self {
        Self {
            rng: XorShiftRng::seed_from_u64(seed),
        }
    }

    /// Generate a random integer in range
    pub fn gen_range<R>(&mut self, range: R) -> R::Output
    where
        R: rand::distributions::uniform::SampleRange<R::Output>,
        R::Output: rand::distributions::uniform::SampleUniform,
    {
        self.rng.gen_range(range)
    }

    /// Generate a random boolean with given probability
    pub fn gen_bool(&mut self, probability: f64) -> bool {
        self.rng.gen_bool(probability)
    }

    /// Choose a random element from a slice
    pub fn choose<T>(&mut self, items: &[T]) -> Option<&T> {
        if items.is_empty() {
            None
        } else {
            Some(&items[self.gen_range(0..items.len())])
        }
    }
}

/// Test data scale configuration
#[derive(Debug, Clone)]
pub struct DataScale {
    pub users: usize,
    pub documents: usize,
    pub tasks: usize,
    pub roles: usize,
    pub operations_per_user: usize,
}

impl DataScale {
    pub fn small() -> Self {
        Self {
            users: 3,
            documents: 10,
            tasks: 20,
            roles: 4,
            operations_per_user: 5,
        }
    }

    pub fn medium() -> Self {
        Self {
            users: 10,
            documents: 100,
            tasks: 200,
            roles: 8,
            operations_per_user: 20,
        }
    }

    pub fn large() -> Self {
        Self {
            users: 50,
            documents: 1000,
            tasks: 2000,
            roles: 12,
            operations_per_user: 50,
        }
    }
}

/// Comprehensive test data generator
pub struct TestDataGenerator {
    rng: BenchmarkRng,
    scale: DataScale,
    temp_dir: Option<TempDir>,
}

impl TestDataGenerator {
    /// Create a new generator with specified scale and seed
    pub fn new(scale: DataScale, seed: Option<u64>) -> Self {
        let seed = seed.unwrap_or(42); // Default seed for reproducibility
        Self {
            rng: BenchmarkRng::new(seed),
            scale,
            temp_dir: None,
        }
    }

    /// Generate a set of test user IDs
    pub fn generate_users(&mut self) -> Vec<UserId> {
        (0..self.scale.users)
            .map(|_| UserId::new_v4())
            .collect()
    }

    /// Generate a realistic template for testing
    pub fn generate_template(&mut self, template_type: &str) -> Template {
        let field_configs = match template_type {
            "task" => vec![
                ("title", "string", true),
                ("description", "text", false),
                ("priority", "enum", true),
                ("status", "enum", true),
                ("assignee", "user", false),
                ("due_date", "datetime", false),
                ("tags", "array", false),
            ],
            "document" => vec![
                ("title", "string", true),
                ("content", "text", true),
                ("author", "user", true),
                ("created_at", "datetime", true),
                ("document_type", "enum", true),
                ("tags", "array", false),
                ("metadata", "object", false),
            ],
            "note" => vec![
                ("title", "string", true),
                ("content", "text", true),
                ("notebook", "string", false),
                ("tags", "array", false),
            ],
            _ => vec![
                ("title", "string", true),
                ("content", "text", false),
            ],
        };

        let mut fields = HashMap::new();
        for (field_name, field_type, required) in field_configs {
            let field_config = match field_type {
                "string" => serde_json::json!({
                    "type": "string",
                    "required": required,
                    "max_length": self.rng.gen_range(50..500)
                }),
                "text" => serde_json::json!({
                    "type": "text",
                    "required": required,
                    "max_length": self.rng.gen_range(1000..10000)
                }),
                "enum" => {
                    let values = match field_name {
                        "priority" => vec!["low", "medium", "high", "urgent"],
                        "status" => vec!["todo", "in_progress", "review", "done"],
                        "document_type" => vec!["note", "task", "reference", "draft"],
                        _ => vec!["option1", "option2", "option3"],
                    };
                    serde_json::json!({
                        "type": "enum",
                        "required": required,
                        "values": values
                    })
                },
                "user" => serde_json::json!({
                    "type": "user",
                    "required": required
                }),
                "datetime" => serde_json::json!({
                    "type": "datetime",
                    "required": required
                }),
                "array" => serde_json::json!({
                    "type": "array",
                    "required": required,
                    "items": { "type": "string" }
                }),
                "object" => serde_json::json!({
                    "type": "object",
                    "required": required
                }),
                _ => serde_json::json!({
                    "type": "string",
                    "required": required
                }),
            };

            fields.insert(field_name.to_string(), field_config);
        }

        Template {
            id: Uuid::new_v4(),
            name: format!("{}_template", template_type),
            version: "1.0.0".to_string(),
            description: Some(format!("Template for {} entities", template_type)),
            fields,
            metadata: {
                let mut metadata = HashMap::new();
                metadata.insert("generated_for".to_string(),
                    serde_json::Value::String("benchmarking".to_string()));
                metadata.insert("template_type".to_string(),
                    serde_json::Value::String(template_type.to_string()));
                metadata
            },
        }
    }

    /// Generate realistic CRDT operations
    pub fn generate_crdt_operations(&mut self, users: &[UserId], count: usize) -> Vec<CRDTOperation> {
        let mut operations = Vec::with_capacity(count);

        for i in 0..count {
            let user_id = *self.rng.choose(users).unwrap_or(&users[0]);
            let mut vector_clock = VectorClock::new();
            vector_clock.increment(&user_id);

            let operation_type = match self.rng.gen_range(0..5) {
                0 => OperationType::TextInsert {
                    position: self.rng.gen_range(0..1000),
                    content: self.generate_realistic_text_content(
                        self.rng.gen_range(10..200)
                    ),
                },
                1 => OperationType::TextDelete {
                    position: self.rng.gen_range(0..1000),
                    length: self.rng.gen_range(1..50),
                },
                2 => OperationType::MetadataUpdate {
                    key: self.generate_metadata_key(),
                    value: self.generate_metadata_value(),
                },
                3 => OperationType::ReferenceAdd {
                    reference: format!("ref_{}_{}", i, self.rng.gen_range(1000..9999)),
                },
                _ => OperationType::ReferenceRemove {
                    reference: format!("ref_{}_{}", i, self.rng.gen_range(1000..9999)),
                },
            };

            operations.push(CRDTOperation {
                id: Uuid::new_v4(),
                user_id,
                timestamp: Utc::now(),
                vector_clock,
                operation_type,
                causally_ready: true,
            });
        }

        operations
    }

    /// Generate realistic task inputs
    pub fn generate_task_inputs(&mut self, users: &[UserId], count: usize) -> Vec<TaskInput> {
        let mut tasks = Vec::with_capacity(count);
        let task_templates = [
            "Implement user authentication system",
            "Design database schema for user management",
            "Create API endpoints for data retrieval",
            "Write unit tests for business logic",
            "Optimize query performance",
            "Update documentation for new features",
            "Fix bug in payment processing",
            "Add logging and monitoring",
            "Implement error handling",
            "Create user interface mockups",
            "Review code for security vulnerabilities",
            "Deploy application to staging environment",
            "Conduct integration testing",
            "Analyze user feedback and metrics",
            "Refactor legacy code components",
        ];

        let project_areas = [
            "authentication", "database", "api", "frontend", "testing",
            "deployment", "monitoring", "security", "performance", "documentation"
        ];

        for i in 0..count {
            let title_template = self.rng.choose(&task_templates)
                .unwrap_or(&"Generic task");
            let title = if self.rng.gen_bool(0.3) {
                format!("{} #{}", title_template, i + 1)
            } else {
                title_template.to_string()
            };

            let priority = match self.rng.gen_range(0..4) {
                0 => TaskPriority::Low,
                1 => TaskPriority::Medium,
                2 => TaskPriority::High,
                _ => TaskPriority::Urgent,
            };

            let status = match self.rng.gen_range(0..4) {
                0 => TaskStatus::Todo,
                1 => TaskStatus::InProgress,
                2 => TaskStatus::Review,
                _ => TaskStatus::Done,
            };

            let assignee = if self.rng.gen_bool(0.8) {
                Some(*self.rng.choose(users).unwrap_or(&users[0]))
            } else {
                None
            };

            let area = self.rng.choose(&project_areas).unwrap_or(&"general");
            let complexity = ["simple", "moderate", "complex"][self.rng.gen_range(0..3)];

            let mut labels = HashMap::new();
            labels.insert("area".to_string(),
                serde_json::Value::String(area.to_string()));
            labels.insert("complexity".to_string(),
                serde_json::Value::String(complexity.to_string()));
            labels.insert("estimated_hours".to_string(),
                serde_json::Value::Number((self.rng.gen_range(1..40)).into()));

            let mut metadata = HashMap::new();
            metadata.insert("created_by_generator".to_string(),
                serde_json::Value::Bool(true));
            metadata.insert("batch_id".to_string(),
                serde_json::Value::Number((i / 10).into()));

            tasks.push(TaskInput {
                title,
                description: Some(self.generate_task_description(&title, area)),
                priority,
                status,
                assignee,
                parent_id: None, // Will be set separately if needed
                dependencies: vec![],
                labels,
                metadata,
                template_id: Some(Uuid::new_v4()),
            });
        }

        tasks
    }

    /// Generate realistic role definitions
    pub fn generate_role_definitions(&mut self) -> Vec<RoleDefinition> {
        vec![
            RoleDefinition {
                name: "developer".to_string(),
                description: "Software developer with code access".to_string(),
                capabilities: vec![
                    Capability::FileRead,
                    Capability::FileWrite,
                    Capability::CommandExecution,
                    Capability::DataProcessing,
                ],
                tool_groups: vec![
                    ToolGroup::FileOperations,
                    ToolGroup::SystemCommands,
                    ToolGroup::DataProcessing,
                ],
                file_patterns: vec![
                    "*.rs".to_string(),
                    "*.py".to_string(),
                    "*.js".to_string(),
                    "*.ts".to_string(),
                    "*.json".to_string(),
                    "*.yaml".to_string(),
                    "*.toml".to_string(),
                ],
                restrictions: {
                    let mut restrictions = HashMap::new();
                    restrictions.insert("max_file_size_mb".to_string(),
                        serde_json::Value::Number(100.into()));
                    restrictions.insert("allowed_directories".to_string(),
                        serde_json::json!(["/src", "/tests", "/docs"]));
                    restrictions
                },
            },
            RoleDefinition {
                name: "data_analyst".to_string(),
                description: "Data analyst with limited system access".to_string(),
                capabilities: vec![
                    Capability::FileRead,
                    Capability::DataProcessing,
                    Capability::NetworkAccess,
                ],
                tool_groups: vec![
                    ToolGroup::DataProcessing,
                    ToolGroup::Analysis,
                    ToolGroup::NetworkOperations,
                ],
                file_patterns: vec![
                    "*.csv".to_string(),
                    "*.json".to_string(),
                    "*.parquet".to_string(),
                    "*.xlsx".to_string(),
                ],
                restrictions: {
                    let mut restrictions = HashMap::new();
                    restrictions.insert("memory_limit_mb".to_string(),
                        serde_json::Value::Number(2048.into()));
                    restrictions.insert("cpu_limit_percent".to_string(),
                        serde_json::Value::Number(75.into()));
                    restrictions.insert("network_domains".to_string(),
                        serde_json::json!(["api.data.com", "analytics.service.com"]));
                    restrictions
                },
            },
            RoleDefinition {
                name: "content_editor".to_string(),
                description: "Content editor with document access".to_string(),
                capabilities: vec![
                    Capability::FileRead,
                    Capability::FileWrite,
                ],
                tool_groups: vec![
                    ToolGroup::FileOperations,
                ],
                file_patterns: vec![
                    "*.md".to_string(),
                    "*.txt".to_string(),
                    "*.doc".to_string(),
                    "*.docx".to_string(),
                ],
                restrictions: {
                    let mut restrictions = HashMap::new();
                    restrictions.insert("read_only_patterns".to_string(),
                        serde_json::json!(["*.config.*", "*.env.*"]));
                    restrictions
                },
            },
            RoleDefinition {
                name: "system_admin".to_string(),
                description: "System administrator with broad access".to_string(),
                capabilities: vec![
                    Capability::FileRead,
                    Capability::FileWrite,
                    Capability::DirectoryAccess,
                    Capability::CommandExecution,
                    Capability::ProcessManagement,
                    Capability::NetworkAccess,
                ],
                tool_groups: vec![
                    ToolGroup::FileOperations,
                    ToolGroup::SystemCommands,
                    ToolGroup::NetworkOperations,
                    ToolGroup::ProcessManagement,
                ],
                file_patterns: vec!["*".to_string()],
                restrictions: {
                    let mut restrictions = HashMap::new();
                    restrictions.insert("require_confirmation".to_string(),
                        serde_json::Value::Bool(true));
                    restrictions.insert("audit_all_actions".to_string(),
                        serde_json::Value::Bool(true));
                    restrictions
                },
            },
        ]
    }

    /// Generate test documents in a temporary directory
    pub fn generate_test_documents(&mut self, count: usize) -> Result<(TempDir, Vec<PathBuf>), std::io::Error> {
        let temp_dir = TempDir::new()?;
        let mut documents = Vec::new();

        for i in 0..count {
            let doc_type = match self.rng.gen_range(0..4) {
                0 => ("md", self.generate_markdown_document(i)),
                1 => ("txt", self.generate_text_document(i)),
                2 => ("rs", self.generate_code_document(i)),
                _ => ("json", self.generate_config_document(i)),
            };

            let file_path = temp_dir.path().join(format!("doc_{}.{}", i, doc_type.0));
            fs::write(&file_path, doc_type.1)?;
            documents.push(file_path);
        }

        Ok((temp_dir, documents))
    }

    /// Generate a realistic text content of specified length
    fn generate_realistic_text_content(&mut self, length: usize) -> String {
        let words = [
            "the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog",
            "implementation", "algorithm", "data", "structure", "performance",
            "optimization", "system", "design", "architecture", "pattern",
            "function", "method", "class", "interface", "module", "component",
            "service", "client", "server", "database", "query", "index",
            "schema", "migration", "validation", "authentication", "authorization",
            "security", "encryption", "protocol", "network", "request", "response",
            "error", "exception", "handling", "logging", "monitoring", "metrics",
            "testing", "unit", "integration", "deployment", "configuration",
            "environment", "development", "production", "staging", "debug",
        ];

        let mut content = String::new();
        let mut current_length = 0;

        while current_length < length {
            let word = self.rng.choose(&words).unwrap_or(&"word");
            if current_length > 0 {
                content.push(' ');
                current_length += 1;
            }
            content.push_str(word);
            current_length += word.len();

            // Occasionally add punctuation
            if self.rng.gen_bool(0.1) && current_length < length - 1 {
                let punct = ['.', ',', ';', '!', '?'][self.rng.gen_range(0..5)];
                content.push(punct);
                current_length += 1;
            }
        }

        content
    }

    /// Generate a metadata key
    fn generate_metadata_key(&mut self) -> String {
        let keys = [
            "author", "created_at", "updated_at", "version", "status",
            "priority", "category", "tags", "description", "notes",
            "project_id", "milestone", "component", "feature", "bug_id",
        ];
        self.rng.choose(&keys).unwrap_or(&"key").to_string()
    }

    /// Generate a metadata value
    fn generate_metadata_value(&mut self) -> serde_json::Value {
        match self.rng.gen_range(0..4) {
            0 => serde_json::Value::String(
                format!("value_{}", self.rng.gen_range(1000..9999))
            ),
            1 => serde_json::Value::Number(
                self.rng.gen_range(1..1000).into()
            ),
            2 => serde_json::Value::Bool(self.rng.gen_bool(0.5)),
            _ => serde_json::json!(vec![
                format!("item_{}", self.rng.gen_range(1..100)),
                format!("item_{}", self.rng.gen_range(100..200)),
            ]),
        }
    }

    /// Generate a task description
    fn generate_task_description(&mut self, title: &str, area: &str) -> String {
        format!(
            "Task: {}\n\nArea: {}\n\nDescription:\n{}\n\nAcceptance Criteria:\n- {}\n- {}\n- {}",
            title,
            area,
            self.generate_realistic_text_content(self.rng.gen_range(100..300)),
            self.generate_realistic_text_content(self.rng.gen_range(20..80)),
            self.generate_realistic_text_content(self.rng.gen_range(20..80)),
            self.generate_realistic_text_content(self.rng.gen_range(20..80)),
        )
    }

    /// Generate a markdown document
    fn generate_markdown_document(&mut self, index: usize) -> String {
        format!(
            "# Document {}\n\n## Overview\n\n{}\n\n## Details\n\n{}\n\n### Code Example\n\n```rust\n{}\n```\n\n## Conclusion\n\n{}",
            index,
            self.generate_realistic_text_content(self.rng.gen_range(100..300)),
            self.generate_realistic_text_content(self.rng.gen_range(200..500)),
            self.generate_code_snippet(),
            self.generate_realistic_text_content(self.rng.gen_range(50..150)),
        )
    }

    /// Generate a text document
    fn generate_text_document(&mut self, index: usize) -> String {
        format!(
            "Text Document {}\n\n{}\n\n{}\n\n{}\n",
            index,
            self.generate_realistic_text_content(self.rng.gen_range(200..400)),
            self.generate_realistic_text_content(self.rng.gen_range(300..600)),
            self.generate_realistic_text_content(self.rng.gen_range(100..250)),
        )
    }

    /// Generate a code document
    fn generate_code_document(&mut self, index: usize) -> String {
        format!(
            "//! Module {}\n//!\n//! {}\n\nuse std::collections::HashMap;\n\n{}\n\n{}\n\n#[cfg(test)]\nmod tests {{\n    use super::*;\n\n    {}\n}}",
            index,
            self.generate_realistic_text_content(self.rng.gen_range(50..150)),
            self.generate_code_snippet(),
            self.generate_code_snippet(),
            self.generate_code_snippet(),
        )
    }

    /// Generate a configuration document
    fn generate_config_document(&mut self, index: usize) -> String {
        serde_json::json!({
            "name": format!("config_{}", index),
            "version": "1.0.0",
            "settings": {
                "timeout": self.rng.gen_range(1000..10000),
                "retries": self.rng.gen_range(1..10),
                "enabled": self.rng.gen_bool(0.8),
                "buffer_size": self.rng.gen_range(1024..8192),
            },
            "features": (0..self.rng.gen_range(3..8)).map(|i| {
                format!("feature_{}", i)
            }).collect::<Vec<_>>(),
            "metadata": {
                "generated": true,
                "index": index,
                "category": ["system", "user", "application"][self.rng.gen_range(0..3)]
            }
        }).to_string()
    }

    /// Generate a code snippet
    fn generate_code_snippet(&mut self) -> String {
        let snippets = [
            "fn process_data(input: &str) -> Result<String, Error> {\n    Ok(input.to_uppercase())\n}",
            "pub struct DataProcessor {\n    buffer: Vec<u8>,\n    capacity: usize,\n}",
            "impl DataProcessor {\n    pub fn new(capacity: usize) -> Self {\n        Self { buffer: Vec::new(), capacity }\n    }\n}",
            "async fn fetch_data() -> Result<Vec<u8>, reqwest::Error> {\n    let response = reqwest::get(\"https://api.example.com/data\").await?;\n    response.bytes().await.map(|b| b.to_vec())\n}",
            "#[derive(Debug, Clone, Serialize, Deserialize)]\npub struct Config {\n    pub name: String,\n    pub timeout: Duration,\n}",
        ];

        self.rng.choose(&snippets).unwrap_or(&"// code here").to_string()
    }
}

/// Performance measurement utilities
pub struct PerformanceMetrics {
    start_time: std::time::Instant,
    measurements: Vec<(String, Duration)>,
}

impl PerformanceMetrics {
    pub fn new() -> Self {
        Self {
            start_time: std::time::Instant::now(),
            measurements: Vec::new(),
        }
    }

    pub fn measure<F, R>(&mut self, operation: &str, f: F) -> R
    where
        F: FnOnce() -> R,
    {
        let start = std::time::Instant::now();
        let result = f();
        let duration = start.elapsed();
        self.measurements.push((operation.to_string(), duration));
        result
    }

    pub fn get_measurements(&self) -> &[(String, Duration)] {
        &self.measurements
    }

    pub fn total_elapsed(&self) -> Duration {
        self.start_time.elapsed()
    }
}

/// Memory usage tracking utilities
pub struct MemoryTracker {
    initial_usage: Option<usize>,
}

impl MemoryTracker {
    pub fn new() -> Self {
        Self {
            initial_usage: Self::get_memory_usage(),
        }
    }

    pub fn current_usage(&self) -> Option<usize> {
        Self::get_memory_usage()
    }

    pub fn memory_delta(&self) -> Option<isize> {
        match (self.initial_usage, self.current_usage()) {
            (Some(initial), Some(current)) => Some(current as isize - initial as isize),
            _ => None,
        }
    }

    #[cfg(target_os = "linux")]
    fn get_memory_usage() -> Option<usize> {
        use std::fs;
        let status = fs::read_to_string("/proc/self/status").ok()?;
        for line in status.lines() {
            if line.starts_with("VmRSS:") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    return parts[1].parse::<usize>().ok().map(|kb| kb * 1024);
                }
            }
        }
        None
    }

    #[cfg(not(target_os = "linux"))]
    fn get_memory_usage() -> Option<usize> {
        // Memory tracking not implemented for this platform
        None
    }
}

/// Benchmark assertion utilities
pub fn assert_performance_bounds(
    actual_duration: Duration,
    expected_max: Duration,
    operation: &str,
) {
    if actual_duration > expected_max {
        panic!(
            "Performance regression detected in {}: took {:?}, expected max {:?}",
            operation, actual_duration, expected_max
        );
    }
}

pub fn assert_memory_bounds(
    memory_delta: Option<isize>,
    expected_max_mb: usize,
    operation: &str,
) {
    if let Some(delta) = memory_delta {
        let delta_mb = (delta.abs() as usize) / (1024 * 1024);
        if delta_mb > expected_max_mb {
            panic!(
                "Memory usage regression detected in {}: used {} MB, expected max {} MB",
                operation, delta_mb, expected_max_mb
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_data_generator() {
        let mut generator = TestDataGenerator::new(DataScale::small(), Some(42));
        let users = generator.generate_users();
        assert_eq!(users.len(), 3);

        let tasks = generator.generate_task_inputs(&users, 5);
        assert_eq!(tasks.len(), 5);

        let roles = generator.generate_role_definitions();
        assert!(!roles.is_empty());
    }

    #[test]
    fn test_performance_metrics() {
        let mut metrics = PerformanceMetrics::new();

        let result = metrics.measure("test_operation", || {
            std::thread::sleep(Duration::from_millis(10));
            42
        });

        assert_eq!(result, 42);
        assert_eq!(metrics.get_measurements().len(), 1);
        assert!(metrics.get_measurements()[0].1 >= Duration::from_millis(10));
    }

    #[test]
    fn test_memory_tracker() {
        let tracker = MemoryTracker::new();
        // Memory tracking may not be available on all platforms
        let _usage = tracker.current_usage();
        let _delta = tracker.memory_delta();
        // Just ensure no panics occur
    }
}