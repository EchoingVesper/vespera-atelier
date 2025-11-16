//! Tests for Codex management functionality
//!
//! This module tests Codex creation, template application, versioning,
//! and format handling.

use std::collections::HashMap;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::{
    codex::{Codex, CodexManagerExt, CodexFormat, CodexSerializer, VersionManager, CodexVersion},
    templates::{TemplateId, TemplateValue as SimpleTemplateValue},
    crdt::TemplateValue as CrdtTemplateValue,
    types::{CodexId, CodexContent, TemplateFieldValue, ContentSection, ContentType, ContentHash, UserId},
    tests::utils::{create_test_manager, TestFixture},
    CodexManager, BinderyConfig,
};

// Helper functions to create CodexContent instances
fn create_text_content(text: &str) -> CodexContent {
    let mut template_fields = HashMap::new();
    template_fields.insert(
        "content".to_string(),
        TemplateFieldValue::Text { value: text.to_string() }
    );

    CodexContent {
        template_fields,
        content_sections: HashMap::new(),
        attachments: Vec::new(),
    }
}

fn create_structured_content(value: serde_json::Value) -> CodexContent {
    let mut template_fields = HashMap::new();
    template_fields.insert(
        "data".to_string(),
        TemplateFieldValue::Structured { value }
    );

    CodexContent {
        template_fields,
        content_sections: HashMap::new(),
        attachments: Vec::new(),
    }
}

fn create_content_with_section(section_id: &str, section_title: &str, content: &str) -> CodexContent {
    let mut content_sections = HashMap::new();
    content_sections.insert(
        section_id.to_string(),
        ContentSection {
            id: section_id.to_string(),
            title: section_title.to_string(),
            content_type: ContentType::Markdown,
            content: content.to_string(),
            operations: Vec::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    );

    CodexContent {
        template_fields: HashMap::new(),
        content_sections,
        attachments: Vec::new(),
    }
}

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
            content: create_text_content("# Test Content"),
        };

        assert_eq!(codex.id, codex_id);
        assert_eq!(codex.title, "Test Codex");
        assert_eq!(codex.template_id, template_id);
        assert_eq!(codex.content_type, "text/markdown");

        // Verify content structure
        if let Some(TemplateFieldValue::Text { value }) = codex.content.template_fields.get("content") {
            assert_eq!(value, "# Test Content");
        } else {
            panic!("Expected text content in template_fields");
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
            content: create_structured_content(serde_json::json!({
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
        fields.insert("title".to_string(), SimpleTemplateValue::Text("Updated Title".to_string()));

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
        // Test text content via template field
        let text_content = create_text_content("Hello, World!");
        if let Some(TemplateFieldValue::Text { value }) = text_content.template_fields.get("content") {
            assert_eq!(value, "Hello, World!");
        } else {
            panic!("Expected text content in template_fields");
        }

        // Test structured content via template field
        let json_data = serde_json::json!({
            "name": "Test",
            "value": 42,
            "tags": ["a", "b", "c"]
        });
        let structured_content = create_structured_content(json_data.clone());

        if let Some(TemplateFieldValue::Structured { value }) = structured_content.template_fields.get("data") {
            assert_eq!(value["name"], "Test");
            assert_eq!(value["value"], 42);
            assert_eq!(value["tags"].as_array().unwrap().len(), 3);
        } else {
            panic!("Expected structured content in template_fields");
        }

        // Test content section
        let section_content = create_content_with_section("main", "Main Section", "Section content");
        if let Some(section) = section_content.content_sections.get("main") {
            assert_eq!(section.title, "Main Section");
            assert_eq!(section.content, "Section content");
        } else {
            panic!("Expected content section");
        }
    }

    #[tokio::test]
    async fn test_content_serialization() {
        let contents = vec![
            create_text_content("Test text"),
            create_structured_content(serde_json::json!({"test": "value"})),
            create_content_with_section("test", "Test Section", "Test content"),
        ];

        for content in contents {
            // Test JSON serialization roundtrip
            let json_str = serde_json::to_string(&content).expect("Should serialize");
            let deserialized: CodexContent = serde_json::from_str(&json_str).expect("Should deserialize");

            // Verify structure preserved
            assert_eq!(content.template_fields.len(), deserialized.template_fields.len(),
                       "Template fields count should match");
            assert_eq!(content.content_sections.len(), deserialized.content_sections.len(),
                       "Content sections count should match");
            assert_eq!(content.attachments.len(), deserialized.attachments.len(),
                       "Attachments count should match");
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
            CrdtTemplateValue::Text {
                value: "Test text".to_string(),
                timestamp,
                user_id: user_id.clone(),
            },
            CrdtTemplateValue::RichText {
                content_id: "rich_content_id".to_string(),
            },
            CrdtTemplateValue::Structured {
                value: serde_json::json!({"key": "value"}),
                timestamp,
                user_id: user_id.clone(),
            },
            CrdtTemplateValue::Reference {
                codex_id: Uuid::new_v4(),
                timestamp,
                user_id: user_id.clone(),
            },
        ];

        for value in values {
            // Test serialization
            let json_str = serde_json::to_string(&value).expect("Should serialize template value");
            let deserialized: CrdtTemplateValue = serde_json::from_str(&json_str).expect("Should deserialize template value");

            // Basic equality check (implementation depends on PartialEq for TemplateValue)
            match (&value, &deserialized) {
                (CrdtTemplateValue::Text { value: v1, .. }, CrdtTemplateValue::Text { value: v2, .. }) => {
                    assert_eq!(v1, v2, "Text values should match");
                }
                (CrdtTemplateValue::RichText { content_id: id1 }, CrdtTemplateValue::RichText { content_id: id2 }) => {
                    assert_eq!(id1, id2, "Rich text content IDs should match");
                }
                (CrdtTemplateValue::Structured { value: v1, .. }, CrdtTemplateValue::Structured { value: v2, .. }) => {
                    assert_eq!(v1, v2, "Structured values should match");
                }
                (CrdtTemplateValue::Reference { codex_id: id1, .. }, CrdtTemplateValue::Reference { codex_id: id2, .. }) => {
                    assert_eq!(id1, id2, "Reference codex IDs should match");
                }
                _ => panic!("Template value type changed during roundtrip"),
            }
        }
    }

    #[tokio::test]
    async fn test_template_id_operations() {
        let template_id = TemplateId::from("test-template");
        assert_eq!(template_id.to_string(), "test-template");

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
        let user_id = UserId::from("test_user");

        // Test version creation using the actual CodexVersion struct fields
        let version = CodexVersion {
            version_id: "v1_abc123".to_string(),
            codex_id,
            parents: vec![],
            content_hash: ContentHash::from("hash123"),
            message: "Initial version".to_string(),
            author: user_id.clone(),
            timestamp: Utc::now(),
            diff: None,
            snapshot: Some(vec![1, 2, 3]), // Example snapshot data
        };

        assert_eq!(version.codex_id, codex_id);
        assert_eq!(version.version_id, "v1_abc123");
        assert_eq!(version.author, user_id);
        assert_eq!(version.message, "Initial version");
        assert_eq!(version.parents.len(), 0);
        assert!(version.snapshot.is_some());
    }

    #[tokio::test]
    async fn test_version_manager_placeholder() {
        // Since VersionManager is a placeholder, test basic instantiation
        let version_manager = VersionManager::new();

        // Test that the manager can retrieve an empty history for a codex
        let codex_id = Uuid::new_v4();
        let history = version_manager.get_history(codex_id);
        assert!(history.is_empty(), "New version manager should have empty history");
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
            content: create_structured_content(complex_content.clone()),
        };

        // Test serialization of complex content
        let json_str = serde_json::to_string(&codex).expect("Should serialize complex codex");
        let deserialized: Codex = serde_json::from_str(&json_str).expect("Should deserialize complex codex");

        assert_eq!(deserialized.id, codex.id);
        assert_eq!(deserialized.title, codex.title);

        // Verify the structured content
        if let Some(TemplateFieldValue::Structured { value: content }) = deserialized.content.template_fields.get("data") {
            assert_eq!(content["metadata"]["title"], "Complex Document");
            assert_eq!(content["sections"].as_array().unwrap().len(), 3);
            assert_eq!(content["references"].as_array().unwrap().len(), 1);
        } else {
            panic!("Expected structured content in template_fields");
        }
    }
}
