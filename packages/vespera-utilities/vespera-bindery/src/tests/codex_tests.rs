//! Tests for Codex management functionality
//!
//! This module tests Codex creation, template application, versioning,
//! and format handling.

use std::collections::HashMap;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::{
    codex::{Codex, CodexManagerExt, CodexFormat, CodexSerializer, VersionManager, CodexVersion},
    templates::{TemplateId, TemplateValue},
    types::{CodexId, CodexContent},
    tests::utils::{create_test_manager, TestFixture},
    CodexManager, BinderyConfig,
};

#[cfg(test)]
mod codex_creation_tests {
    use super::*;

    #[tokio::test]
    async fn test_codex_creation() {
        let manager = create_test_manager().await.expect("Should create manager");
        let template_id = TemplateId::from("test-template");

        // Note: This will currently fail because templates don't exist
        // In a real test, we'd need to register templates first
        let result = manager.create_codex_ext("Test Codex".to_string(), template_id).await;

        // For now, we expect this to fail due to template not found
        assert!(result.is_err(), "Should fail when template doesn't exist");
    }

    #[tokio::test]
    async fn test_codex_structure() {
        let codex_id = Uuid::new_v4();
        let template_id = TemplateId::from("test-template");
        let now = Utc::now();

        let codex = Codex {
            id: codex_id,
            title: "Test Codex".to_string(),
            content_type: "text/markdown".to_string(),
            template_id: template_id.clone(),
            created_at: now,
            updated_at: now,
            content: CodexContent::Text("# Test Content".to_string()),
        };

        assert_eq!(codex.id, codex_id);
        assert_eq!(codex.title, "Test Codex");
        assert_eq!(codex.template_id, template_id);
        assert_eq!(codex.content_type, "text/markdown");

        if let CodexContent::Text(text) = &codex.content {
            assert_eq!(text, "# Test Content");
        } else {
            panic!("Expected text content");
        }
    }

    #[tokio::test]
    async fn test_codex_serialization() {
        let codex_id = Uuid::new_v4();
        let template_id = TemplateId::from("test-template");
        let now = Utc::now();

        let codex = Codex {
            id: codex_id,
            title: "Test Codex".to_string(),
            content_type: "application/json".to_string(),
            template_id: template_id.clone(),
            created_at: now,
            updated_at: now,
            content: CodexContent::Structured(serde_json::json!({
                "title": "Test",
                "description": "A test codex"
            })),
        };

        // Test JSON serialization
        let json_str = serde_json::to_string(&codex).expect("Should serialize to JSON");
        assert!(json_str.contains("Test Codex"), "Should contain title");

        let deserialized: Codex = serde_json::from_str(&json_str).expect("Should deserialize from JSON");
        assert_eq!(deserialized.id, codex.id);
        assert_eq!(deserialized.title, codex.title);
    }
}

#[cfg(test)]
mod codex_manager_tests {
    use super::*;

    #[tokio::test]
    async fn test_codex_manager_ext_methods() {
        let manager = create_test_manager().await.expect("Should create manager");
        let codex_id = Uuid::new_v4();

        // Test get_codex_ext (currently returns None)
        let result = manager.get_codex_ext(&codex_id).await.expect("Should not error");
        assert!(result.is_none(), "Should return None for non-existent codex");

        // Test update_codex_fields (currently placeholder)
        let mut fields = HashMap::new();
        fields.insert("title".to_string(), TemplateValue::Text {
            value: "Updated Title".to_string(),
            timestamp: Utc::now(),
            user_id: "test_user".to_string(),
        });

        let result = manager.update_codex_fields(&codex_id, fields).await;
        assert!(result.is_ok(), "Should not error on update");

        // Test delete_codex_ext (currently placeholder)
        let result = manager.delete_codex_ext(&codex_id).await;
        assert!(result.is_ok(), "Should not error on delete");

        // Test list_codices_by_template (currently returns empty)
        let template_id = TemplateId::from("test-template");
        let result = manager.list_codices_by_template(&template_id).await.expect("Should not error");
        assert!(result.is_empty(), "Should return empty list");

        // Test add_codex_reference (currently placeholder)
        let from_id = Uuid::new_v4();
        let to_id = Uuid::new_v4();
        let result = manager.add_codex_reference(&from_id, &to_id, "references", Some("test context".to_string())).await;
        assert!(result.is_ok(), "Should not error on add reference");
    }

    #[tokio::test]
    async fn test_codex_manager_with_config() {
        let fixture = TestFixture::new().expect("Should create fixture");
        let manager = CodexManager::with_config(fixture.config.clone()).expect("Should create manager");

        // Test that configuration is applied
        let config = manager.config();
        assert_eq!(config.storage_path, fixture.config.storage_path);
        assert_eq!(config.collaboration_enabled, fixture.config.collaboration_enabled);
        assert_eq!(config.max_operations_in_memory, fixture.config.max_operations_in_memory);
    }

    #[tokio::test]
    async fn test_codex_manager_memory_stats() {
        let manager = create_test_manager().await.expect("Should create manager");

        // Get initial memory stats (should be empty)
        let stats = manager.memory_stats().await;
        assert!(stats.is_empty(), "Should start with no codices");

        // Test gc_all_codices
        let gc_result = manager.gc_all_codices().await;
        assert!(gc_result.is_ok(), "GC should not error");

        let gc_stats = gc_result.unwrap();
        assert_eq!(gc_stats.codices_processed, 0, "Should have processed 0 codices");
    }

    #[tokio::test]
    async fn test_codex_manager_lifecycle() {
        let manager = create_test_manager().await.expect("Should create manager");

        // Test initial state
        let codices = manager.list_codices().await;
        assert!(codices.is_empty(), "Should start with no codices");

        // Test shutdown
        let mut manager = manager;
        let result = manager.shutdown().await;
        assert!(result.is_ok(), "Shutdown should not error");
    }
}

#[cfg(test)]
mod codex_format_tests {
    use super::*;

    #[tokio::test]
    async fn test_codex_content_types() {
        // Test text content
        let text_content = CodexContent::Text("Hello, World!".to_string());
        if let CodexContent::Text(text) = &text_content {
            assert_eq!(text, "Hello, World!");
        } else {
            panic!("Expected text content");
        }

        // Test structured content
        let json_data = serde_json::json!({
            "name": "Test",
            "value": 42,
            "tags": ["a", "b", "c"]
        });
        let structured_content = CodexContent::Structured(json_data.clone());

        if let CodexContent::Structured(data) = &structured_content {
            assert_eq!(data["name"], "Test");
            assert_eq!(data["value"], 42);
            assert_eq!(data["tags"].as_array().unwrap().len(), 3);
        } else {
            panic!("Expected structured content");
        }

        // Test binary content
        let binary_data = vec![0u8, 1, 2, 3, 255];
        let binary_content = CodexContent::Binary(binary_data.clone());

        if let CodexContent::Binary(data) = &binary_content {
            assert_eq!(data, &binary_data);
        } else {
            panic!("Expected binary content");
        }
    }

    #[tokio::test]
    async fn test_content_serialization() {
        let contents = vec![
            CodexContent::Text("Test text".to_string()),
            CodexContent::Structured(serde_json::json!({"test": "value"})),
            CodexContent::Binary(vec![0u8, 1, 2, 3]),
        ];

        for content in contents {
            // Test JSON serialization roundtrip
            let json_str = serde_json::to_string(&content).expect("Should serialize");
            let deserialized: CodexContent = serde_json::from_str(&json_str).expect("Should deserialize");

            match (&content, &deserialized) {
                (CodexContent::Text(original), CodexContent::Text(restored)) => {
                    assert_eq!(original, restored, "Text content should roundtrip");
                }
                (CodexContent::Structured(original), CodexContent::Structured(restored)) => {
                    assert_eq!(original, restored, "Structured content should roundtrip");
                }
                (CodexContent::Binary(original), CodexContent::Binary(restored)) => {
                    assert_eq!(original, restored, "Binary content should roundtrip");
                }
                _ => panic!("Content type changed during roundtrip"),
            }
        }
    }
}

#[cfg(test)]
mod template_integration_tests {
    use super::*;

    #[tokio::test]
    async fn test_template_value_types() {
        let timestamp = Utc::now();
        let user_id = "test_user".to_string();

        // Test all template value types
        let values = vec![
            TemplateValue::Text {
                value: "Test text".to_string(),
                timestamp,
                user_id: user_id.clone(),
            },
            TemplateValue::RichText {
                content_id: "rich_content_id".to_string(),
            },
            TemplateValue::Structured {
                value: serde_json::json!({"key": "value"}),
                timestamp,
                user_id: user_id.clone(),
            },
            TemplateValue::Reference {
                codex_id: Uuid::new_v4(),
                timestamp,
                user_id: user_id.clone(),
            },
        ];

        for value in values {
            // Test serialization
            let json_str = serde_json::to_string(&value).expect("Should serialize template value");
            let deserialized: TemplateValue = serde_json::from_str(&json_str).expect("Should deserialize template value");

            // Basic equality check (implementation depends on PartialEq for TemplateValue)
            match (&value, &deserialized) {
                (TemplateValue::Text { value: v1, .. }, TemplateValue::Text { value: v2, .. }) => {
                    assert_eq!(v1, v2, "Text values should match");
                }
                (TemplateValue::RichText { content_id: id1 }, TemplateValue::RichText { content_id: id2 }) => {
                    assert_eq!(id1, id2, "Rich text content IDs should match");
                }
                (TemplateValue::Structured { value: v1, .. }, TemplateValue::Structured { value: v2, .. }) => {
                    assert_eq!(v1, v2, "Structured values should match");
                }
                (TemplateValue::Reference { codex_id: id1, .. }, TemplateValue::Reference { codex_id: id2, .. }) => {
                    assert_eq!(id1, id2, "Reference codex IDs should match");
                }
                _ => panic!("Template value type changed during roundtrip"),
            }
        }
    }

    #[tokio::test]
    async fn test_template_id_operations() {
        let template_id = TemplateId::from("test-template");
        assert_eq!(template_id.as_str(), "test-template");

        // Test that template IDs can be used as keys
        let mut template_map = HashMap::new();
        template_map.insert(template_id.clone(), "Template data");
        assert_eq!(template_map.get(&template_id), Some(&"Template data"));

        // Test template ID serialization
        let json_str = serde_json::to_string(&template_id).expect("Should serialize template ID");
        let deserialized: TemplateId = serde_json::from_str(&json_str).expect("Should deserialize template ID");
        assert_eq!(template_id, deserialized);
    }
}

#[cfg(test)]
mod versioning_tests {
    use super::*;

    #[tokio::test]
    async fn test_codex_version_creation() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();

        // Test version creation (these are placeholder implementations for now)
        let version = CodexVersion {
            id: Uuid::new_v4(),
            codex_id,
            version_number: 1,
            created_at: Utc::now(),
            created_by: user_id.clone(),
            description: Some("Initial version".to_string()),
            content_hash: "hash123".to_string(),
        };

        assert_eq!(version.codex_id, codex_id);
        assert_eq!(version.version_number, 1);
        assert_eq!(version.created_by, user_id);
        assert_eq!(version.description, Some("Initial version".to_string()));
    }

    #[tokio::test]
    async fn test_version_manager_placeholder() {
        // Since VersionManager is likely a placeholder, test basic instantiation
        let codex_id = Uuid::new_v4();
        let version_manager = VersionManager::new(codex_id);

        // Test that it was created without error
        assert_eq!(version_manager.codex_id(), codex_id);
    }
}

#[cfg(test)]
mod error_handling_tests {
    use super::*;

    #[tokio::test]
    async fn test_invalid_template_ids() {
        let manager = create_test_manager().await.expect("Should create manager");

        // Test with empty template ID
        let empty_template = TemplateId::from("");
        let result = manager.create_codex_ext("Test".to_string(), empty_template).await;
        assert!(result.is_err(), "Should fail with empty template ID");

        // Test with non-existent template ID
        let invalid_template = TemplateId::from("non-existent-template");
        let result = manager.create_codex_ext("Test".to_string(), invalid_template).await;
        assert!(result.is_err(), "Should fail with non-existent template ID");
    }

    #[tokio::test]
    async fn test_invalid_codex_operations() {
        let manager = create_test_manager().await.expect("Should create manager");
        let invalid_id = Uuid::new_v4();

        // Test operations on non-existent codex
        let result = manager.get_codex_ext(&invalid_id).await;
        assert!(result.is_ok(), "Get should not error, just return None");

        let get_result = result.unwrap();
        assert!(get_result.is_none(), "Should return None for non-existent codex");

        // Test update on non-existent codex (currently placeholder, so won't error)
        let fields = HashMap::new();
        let result = manager.update_codex_fields(&invalid_id, fields).await;
        assert!(result.is_ok(), "Update placeholder should not error");

        // Test delete on non-existent codex (currently placeholder, so won't error)
        let result = manager.delete_codex_ext(&invalid_id).await;
        assert!(result.is_ok(), "Delete placeholder should not error");
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;

    #[tokio::test]
    async fn test_codex_workflow() {
        let manager = create_test_manager().await.expect("Should create manager");

        // This test demonstrates the intended workflow, though it will fail
        // with template not found until templates are properly implemented

        // 1. Create a codex (will fail due to missing template)
        let template_id = TemplateId::from("article-template");
        let result = manager.create_codex_ext("My Article".to_string(), template_id.clone()).await;
        assert!(result.is_err(), "Should fail due to missing template");

        // 2. List codices by template (will return empty)
        let codices = manager.list_codices_by_template(&template_id).await.expect("Should not error");
        assert!(codices.is_empty(), "Should return empty list");

        // 3. Test codex references (placeholder implementation)
        let from_id = Uuid::new_v4();
        let to_id = Uuid::new_v4();
        let result = manager.add_codex_reference(&from_id, &to_id, "references", None).await;
        assert!(result.is_ok(), "Reference addition should not error");
    }

    #[tokio::test]
    async fn test_complex_codex_content() {
        let codex_id = Uuid::new_v4();
        let template_id = TemplateId::from("complex-template");

        // Create a complex codex with nested structured content
        let complex_content = serde_json::json!({
            "metadata": {
                "title": "Complex Document",
                "author": "Test Author",
                "created": "2024-01-01T00:00:00Z",
                "tags": ["test", "complex", "document"]
            },
            "sections": [
                {
                    "type": "header",
                    "content": "Introduction",
                    "level": 1
                },
                {
                    "type": "paragraph",
                    "content": "This is a complex document with multiple sections."
                },
                {
                    "type": "code",
                    "language": "rust",
                    "content": "fn main() { println!(\"Hello, World!\"); }"
                }
            ],
            "references": [
                {
                    "type": "external",
                    "url": "https://example.com",
                    "title": "Example Reference"
                }
            ]
        });

        let codex = Codex {
            id: codex_id,
            title: "Complex Document".to_string(),
            content_type: "application/json".to_string(),
            template_id,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            content: CodexContent::Structured(complex_content.clone()),
        };

        // Test serialization of complex content
        let json_str = serde_json::to_string(&codex).expect("Should serialize complex codex");
        let deserialized: Codex = serde_json::from_str(&json_str).expect("Should deserialize complex codex");

        assert_eq!(deserialized.id, codex.id);
        assert_eq!(deserialized.title, codex.title);

        if let CodexContent::Structured(content) = &deserialized.content {
            assert_eq!(content["metadata"]["title"], "Complex Document");
            assert_eq!(content["sections"].as_array().unwrap().len(), 3);
            assert_eq!(content["references"].as_array().unwrap().len(), 1);
        } else {
            panic!("Expected structured content");
        }
    }
}