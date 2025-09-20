//! Comprehensive tests for CRDT functionality
//!
//! This module tests all CRDT layers: text, tree, metadata, and reference layers,
//! including convergence properties, conflict resolution, and edge cases.

use std::collections::HashMap;
use chrono::{DateTime, Utc, Duration};
use uuid::Uuid;

use crate::{
    crdt::{
        VesperaCRDT, CRDTOperation, OperationType, TemplateValue, CodexReference,
        ReferenceType, CRDTLayer, TextFormat
    },
    types::{CodexId, UserId, VectorClock},
    tests::utils::{create_test_crdt, TestDataGenerator, assert_crdt_convergence, PerformanceTest},
};

#[cfg(test)]
mod crdt_core_tests {
    use super::*;

    #[tokio::test]
    async fn test_crdt_creation() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let crdt = VesperaCRDT::new(codex_id, user_id.clone());

        assert_eq!(crdt.codex_id, codex_id);
        assert_eq!(crdt.created_by, user_id);
        assert_eq!(crdt.updated_by, user_id);
        assert!(crdt.operation_log.is_empty());
        assert_eq!(crdt.vector_clock.len(), 1);
        assert_eq!(crdt.vector_clock.get(&user_id), Some(&0));
    }

    #[tokio::test]
    async fn test_vector_clock_updates() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        // Create and apply an operation
        let operation = crdt.create_operation(
            OperationType::MetadataSet {
                key: "test".to_string(),
                value: TemplateValue::Text {
                    value: "test_value".to_string(),
                    timestamp: Utc::now(),
                    user_id: user_id.clone(),
                },
            },
            user_id.clone(),
        );

        let initial_clock = crdt.vector_clock.get(&user_id).copied().unwrap_or(0);
        crdt.apply_operation(operation).expect("Operation should succeed");

        let updated_clock = crdt.vector_clock.get(&user_id).copied().unwrap_or(0);
        assert!(updated_clock > initial_clock, "Vector clock should increment");
    }

    #[tokio::test]
    async fn test_operation_log_growth() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        // Apply many operations to test bounded growth
        for i in 0..50 {
            let operation = crdt.create_operation(
                OperationType::MetadataSet {
                    key: format!("key_{}", i),
                    value: TemplateValue::Text {
                        value: format!("value_{}", i),
                        timestamp: Utc::now(),
                        user_id: user_id.clone(),
                    },
                },
                user_id.clone(),
            );
            crdt.apply_operation(operation).expect("Operation should succeed");
        }

        assert!(crdt.operation_log.len() <= 50, "Operation log should not exceed reasonable bounds");

        // Test explicit GC
        let removed = crdt.gc_operation_log(25);
        assert_eq!(crdt.operation_log.len(), 25, "Should have exactly 25 operations after GC");
        assert_eq!(removed, 25, "Should have removed 25 operations");
    }
}

#[cfg(test)]
mod metadata_layer_tests {
    use super::*;

    #[tokio::test]
    async fn test_metadata_set_get() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        let key = "test_key".to_string();
        let value = TemplateValue::Text {
            value: "test_value".to_string(),
            timestamp: Utc::now(),
            user_id: user_id.clone(),
        };

        // Set metadata
        crdt.set_metadata(key.clone(), value.clone()).expect("Should set metadata");

        // Get metadata
        let retrieved = crdt.get_metadata(&key);
        assert!(retrieved.is_some(), "Should retrieve metadata");
        assert_eq!(retrieved.unwrap(), &value, "Retrieved value should match");
    }

    #[tokio::test]
    async fn test_metadata_last_writer_wins() {
        let codex_id = Uuid::new_v4();
        let user1 = "user1".to_string();
        let user2 = "user2".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user1.clone());

        let key = "conflict_key".to_string();

        // User1 sets value first
        let value1 = TemplateValue::Text {
            value: "value1".to_string(),
            timestamp: Utc::now(),
            user_id: user1.clone(),
        };
        crdt.set_metadata(key.clone(), value1.clone()).expect("Should set metadata");

        // User2 sets value later (simulating later timestamp)
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        let value2 = TemplateValue::Text {
            value: "value2".to_string(),
            timestamp: Utc::now(),
            user_id: user2.clone(),
        };

        // Manually create operation with user2
        let operation = CRDTOperation {
            id: Uuid::new_v4(),
            operation: OperationType::MetadataSet {
                key: key.clone(),
                value: value2.clone(),
            },
            user_id: user2.clone(),
            timestamp: Utc::now(),
            vector_clock: {
                let mut vc = VectorClock::new();
                vc.insert(user2.clone(), 1);
                vc
            },
            parents: Vec::new(),
            layer: CRDTLayer::Metadata,
        };

        crdt.apply_operation(operation).expect("Should apply operation");

        // The later timestamp should win
        let retrieved = crdt.get_metadata(&key);
        assert!(retrieved.is_some(), "Should retrieve metadata");
        if let TemplateValue::Text { value, .. } = retrieved.unwrap() {
            assert_eq!(value, "value2", "Later value should win");
        } else {
            panic!("Expected Text value");
        }
    }

    #[tokio::test]
    async fn test_metadata_complex_types() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        // Test structured data
        let json_value = serde_json::json!({
            "name": "test",
            "count": 42,
            "tags": ["a", "b", "c"]
        });

        let structured_value = TemplateValue::Structured {
            value: json_value.clone(),
            timestamp: Utc::now(),
            user_id: user_id.clone(),
        };

        crdt.set_metadata("structured".to_string(), structured_value).expect("Should set structured metadata");

        // Test reference value
        let ref_codex_id = Uuid::new_v4();
        let reference_value = TemplateValue::Reference {
            codex_id: ref_codex_id,
            timestamp: Utc::now(),
            user_id: user_id.clone(),
        };

        crdt.set_metadata("reference".to_string(), reference_value).expect("Should set reference metadata");

        // Verify retrieval
        let structured_retrieved = crdt.get_metadata("structured");
        assert!(structured_retrieved.is_some(), "Should retrieve structured metadata");

        let reference_retrieved = crdt.get_metadata("reference");
        assert!(reference_retrieved.is_some(), "Should retrieve reference metadata");

        if let TemplateValue::Reference { codex_id, .. } = reference_retrieved.unwrap() {
            assert_eq!(*codex_id, ref_codex_id, "Reference should match");
        } else {
            panic!("Expected Reference value");
        }
    }
}

#[cfg(test)]
mod reference_layer_tests {
    use super::*;

    #[tokio::test]
    async fn test_reference_add_remove() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        let reference = CodexReference {
            from_codex_id: codex_id,
            to_codex_id: Uuid::new_v4(),
            reference_type: ReferenceType::References,
            context: Some("test reference".to_string()),
        };

        // Add reference
        crdt.add_reference(reference.clone()).expect("Should add reference");

        let references = crdt.get_references();
        assert_eq!(references.len(), 1, "Should have one reference");
        assert_eq!(references[0], &reference, "Reference should match");

        // Remove reference
        let remove_operation = crdt.create_operation(
            OperationType::ReferenceRemove { reference: reference.clone() },
            user_id.clone(),
        );
        crdt.apply_operation(remove_operation).expect("Should remove reference");

        // Note: OR-Set semantics mean the reference is marked as removed, not deleted
        let stats = crdt.reference_layer.stats();
        assert!(stats.removed_tags > 0, "Should have removed tags");
    }

    #[tokio::test]
    async fn test_reference_types() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id);

        let reference_types = vec![
            ReferenceType::Child,
            ReferenceType::DependsOn,
            ReferenceType::References,
            ReferenceType::Related,
            ReferenceType::Custom("custom_type".to_string()),
        ];

        for (i, ref_type) in reference_types.iter().enumerate() {
            let reference = CodexReference {
                from_codex_id: codex_id,
                to_codex_id: Uuid::new_v4(),
                reference_type: ref_type.clone(),
                context: Some(format!("reference_{}", i)),
            };

            crdt.add_reference(reference).expect("Should add reference");
        }

        let references = crdt.get_references();
        assert_eq!(references.len(), 5, "Should have all reference types");

        // Verify all types are represented
        let mut found_types = std::collections::HashSet::new();
        for reference in references {
            found_types.insert(reference.reference_type.clone());
        }
        assert_eq!(found_types.len(), 5, "Should have all unique reference types");
    }
}

#[cfg(test)]
mod text_layer_tests {
    use super::*;

    #[tokio::test]
    async fn test_text_insert_delete() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        let field_id = "content".to_string();

        // Insert text
        crdt.insert_text(field_id.clone(), 0, "Hello".to_string()).expect("Should insert text");
        crdt.insert_text(field_id.clone(), 5, " World".to_string()).expect("Should insert more text");

        // The exact verification depends on the text layer implementation
        // For now, we verify the operations were recorded
        assert!(crdt.operation_log.len() >= 2, "Should have recorded text operations");

        // Delete some text
        crdt.delete_text(field_id.clone(), 5, 6).expect("Should delete text");

        assert!(crdt.operation_log.len() >= 3, "Should have recorded delete operation");
    }

    #[tokio::test]
    async fn test_text_field_management() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let crdt = VesperaCRDT::new(codex_id, user_id);

        // Test field count (starts with 0)
        let initial_count = crdt.text_layer.field_count();
        assert_eq!(initial_count, 0, "Should start with no text fields");

        // The text layer implementation would track fields as they're used
    }
}

#[cfg(test)]
mod convergence_tests {
    use super::*;

    #[tokio::test]
    async fn test_two_way_convergence() {
        let codex_id = Uuid::new_v4();
        let user1 = "user1".to_string();
        let user2 = "user2".to_string();

        let mut crdt1 = VesperaCRDT::new(codex_id, user1.clone());
        let mut crdt2 = VesperaCRDT::new(codex_id, user2.clone());

        // User1 makes some changes
        crdt1.set_metadata("key1".to_string(), TemplateValue::Text {
            value: "value1".to_string(),
            timestamp: Utc::now(),
            user_id: user1.clone(),
        }).expect("Should set metadata");

        // User2 makes different changes
        crdt2.set_metadata("key2".to_string(), TemplateValue::Text {
            value: "value2".to_string(),
            timestamp: Utc::now(),
            user_id: user2.clone(),
        }).expect("Should set metadata");

        // Exchange operations
        let ops1 = crdt1.operation_log.clone();
        let ops2 = crdt2.operation_log.clone();

        for op in ops2 {
            crdt1.apply_operation(op).expect("Should apply operation");
        }

        for op in ops1 {
            crdt2.apply_operation(op).expect("Should apply operation");
        }

        // Verify convergence
        assert_crdt_convergence(&crdt1, &crdt2);
    }

    #[tokio::test]
    async fn test_multi_user_convergence() {
        let codex_id = Uuid::new_v4();
        let users = vec!["user1", "user2", "user3", "user4"];
        let mut crdts: Vec<VesperaCRDT> = users.iter()
            .map(|user| VesperaCRDT::new(codex_id, user.to_string()))
            .collect();

        // Each user makes some operations
        for (i, crdt) in crdts.iter_mut().enumerate() {
            let user_id = users[i].to_string();

            // Add metadata
            crdt.set_metadata(format!("user_{}_key", i), TemplateValue::Text {
                value: format!("user_{}_value", i),
                timestamp: Utc::now(),
                user_id: user_id.clone(),
            }).expect("Should set metadata");

            // Add reference
            let reference = CodexReference {
                from_codex_id: codex_id,
                to_codex_id: Uuid::new_v4(),
                reference_type: ReferenceType::References,
                context: Some(format!("user_{}_ref", i)),
            };
            crdt.add_reference(reference).expect("Should add reference");
        }

        // Collect all operations
        let mut all_operations = Vec::new();
        for crdt in &crdts {
            all_operations.extend(crdt.operation_log.iter().cloned());
        }

        // Apply all operations to all CRDTs
        for crdt in crdts.iter_mut() {
            for op in &all_operations {
                if !crdt.operation_log.iter().any(|existing| existing.id == op.id) {
                    crdt.apply_operation(op.clone()).expect("Should apply operation");
                }
            }
        }

        // Verify all CRDTs have converged
        for i in 1..crdts.len() {
            assert_crdt_convergence(&crdts[0], &crdts[i]);
        }
    }

    #[tokio::test]
    async fn test_concurrent_operations() {
        let codex_id = Uuid::new_v4();
        let mut crdt = VesperaCRDT::new(codex_id, "test_user".to_string());

        // Generate concurrent operations
        let generator = TestDataGenerator::new(3, 10);
        let operations = generator.generate_operations(codex_id);

        // Apply operations in random order to simulate concurrency
        use std::collections::HashMap;
        let mut user_crdts: HashMap<String, VesperaCRDT> = HashMap::new();

        for (user_id, operation_type) in operations {
            let user_crdt = user_crdts.entry(user_id.clone())
                .or_insert_with(|| VesperaCRDT::new(codex_id, user_id.clone()));

            let operation = user_crdt.create_operation(operation_type, user_id);
            user_crdt.apply_operation(operation.clone()).expect("Should apply operation");

            // Also apply to main CRDT
            crdt.apply_operation(operation).expect("Should apply operation");
        }

        // Verify the CRDT is in a consistent state
        let stats = crdt.memory_stats();
        assert!(stats.operation_log_size > 0, "Should have operations");
        assert!(stats.metadata_stats.active_entries > 0, "Should have metadata");
    }
}

#[cfg(test)]
mod performance_tests {
    use super::*;

    #[tokio::test]
    async fn test_operation_performance() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        let perf_test = PerformanceTest::new("1000 metadata operations");

        for i in 0..1000 {
            let operation = crdt.create_operation(
                OperationType::MetadataSet {
                    key: format!("key_{}", i),
                    value: TemplateValue::Text {
                        value: format!("value_{}", i),
                        timestamp: Utc::now(),
                        user_id: user_id.clone(),
                    },
                },
                user_id.clone(),
            );
            crdt.apply_operation(operation).expect("Should apply operation");
        }

        perf_test.assert_duration_under(std::time::Duration::from_secs(5));
    }

    #[tokio::test]
    async fn test_memory_usage_bounded() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        // Add many operations
        for i in 0..2000 {
            let operation = crdt.create_operation(
                OperationType::MetadataSet {
                    key: format!("key_{}", i),
                    value: TemplateValue::Text {
                        value: format!("value_{}", i),
                        timestamp: Utc::now(),
                        user_id: user_id.clone(),
                    },
                },
                user_id.clone(),
            );
            crdt.apply_operation(operation).expect("Should apply operation");
        }

        let stats = crdt.memory_stats();

        // Operation log should be bounded by automatic GC
        assert!(stats.operation_log_size <= 1000,
            "Operation log should be bounded, got {}", stats.operation_log_size);

        // Verify memory optimization recommendations
        let recommendations = crdt.memory_optimization_recommendations();
        assert!(recommendations.estimated_memory_usage_mb > 0.0, "Should estimate memory usage");
    }

    #[tokio::test]
    async fn test_gc_performance() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        // Fill with operations
        for i in 0..1000 {
            let operation = crdt.create_operation(
                OperationType::MetadataSet {
                    key: format!("key_{}", i),
                    value: TemplateValue::Text {
                        value: format!("value_{}", i),
                        timestamp: Utc::now(),
                        user_id: user_id.clone(),
                    },
                },
                user_id.clone(),
            );
            crdt.apply_operation(operation).expect("Should apply operation");
        }

        let perf_test = PerformanceTest::new("garbage collection");
        let cutoff = Utc::now() - Duration::hours(1);
        let gc_stats = crdt.gc_all(cutoff);

        perf_test.assert_duration_under(std::time::Duration::from_millis(100));

        assert!(gc_stats.operations_removed > 0, "Should have removed some operations");
    }
}

#[cfg(test)]
mod edge_case_tests {
    use super::*;

    #[tokio::test]
    async fn test_empty_operations() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        // Test empty string operations
        crdt.set_metadata("empty".to_string(), TemplateValue::Text {
            value: "".to_string(),
            timestamp: Utc::now(),
            user_id: user_id.clone(),
        }).expect("Should handle empty string");

        let retrieved = crdt.get_metadata("empty");
        assert!(retrieved.is_some(), "Should retrieve empty value");
    }

    #[tokio::test]
    async fn test_large_values() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        // Test large string value
        let large_value = "x".repeat(10000);
        crdt.set_metadata("large".to_string(), TemplateValue::Text {
            value: large_value.clone(),
            timestamp: Utc::now(),
            user_id: user_id.clone(),
        }).expect("Should handle large value");

        let retrieved = crdt.get_metadata("large");
        assert!(retrieved.is_some(), "Should retrieve large value");

        if let TemplateValue::Text { value, .. } = retrieved.unwrap() {
            assert_eq!(value.len(), 10000, "Large value should be preserved");
        }
    }

    #[tokio::test]
    async fn test_unicode_handling() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        let unicode_value = "🚀 Unicode test: こんにちは 🌟 مرحبا 🎉".to_string();
        crdt.set_metadata("unicode".to_string(), TemplateValue::Text {
            value: unicode_value.clone(),
            timestamp: Utc::now(),
            user_id: user_id.clone(),
        }).expect("Should handle unicode");

        let retrieved = crdt.get_metadata("unicode");
        assert!(retrieved.is_some(), "Should retrieve unicode value");

        if let TemplateValue::Text { value, .. } = retrieved.unwrap() {
            assert_eq!(value, &unicode_value, "Unicode should be preserved");
        }
    }

    #[tokio::test]
    async fn test_null_and_special_values() {
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        // Test JSON null value
        let null_json = serde_json::Value::Null;
        crdt.set_metadata("null_json".to_string(), TemplateValue::Structured {
            value: null_json,
            timestamp: Utc::now(),
            user_id: user_id.clone(),
        }).expect("Should handle JSON null");

        let retrieved = crdt.get_metadata("null_json");
        assert!(retrieved.is_some(), "Should retrieve null JSON value");
    }
}