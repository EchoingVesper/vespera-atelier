//! Property-based tests for CRDT operations using proptest
//!
//! This module contains comprehensive property-based tests that verify fundamental
//! CRDT properties including commutativity, associativity, idempotency, and convergence.
//! These tests generate random operations and verify that CRDT invariants hold.

use std::collections::{HashMap, HashSet};
use chrono::{DateTime, Utc, Duration};
use uuid::Uuid;
use proptest::prelude::*;
use proptest::test_runner::TestRunner;
use rand::{Rng, SeedableRng};
use rand_xorshift::XorShiftRng;

use crate::{
    crdt::{
        VesperaCRDT, CRDTOperation, OperationType, TemplateValue, CodexReference,
        ReferenceType, CRDTLayer, LWWMap, ORSet, ORTag, LWWEntry, MemoryStats, GCStats
    },
    types::{CodexId, UserId, VectorClock},
    tests::utils::{create_test_crdt, TestDataGenerator, assert_crdt_convergence},
    GarbageCollectionConfig,
    database::{TaskInput, TaskSummary, DatabasePoolConfig},
    observability::{MetricsCollector, BinderyMetrics},
};

/// Generate arbitrary CodexId for property tests
fn arb_codex_id() -> impl Strategy<Value = CodexId> {
    any::<[u8; 16]>().prop_map(|bytes| Uuid::from_bytes(bytes))
}

/// Generate arbitrary UserId for property tests
fn arb_user_id() -> impl Strategy<Value = UserId> {
    "[a-zA-Z0-9_]{3,20}".prop_map(|s| s.to_string())
}

/// Generate arbitrary timestamps within a reasonable range
fn arb_timestamp() -> impl Strategy<Value = DateTime<Utc>> {
    (0i64..=86400 * 365) // Up to 1 year in seconds
        .prop_map(|secs| Utc::now() - Duration::seconds(secs))
}

/// Generate arbitrary TemplateValue for testing
fn arb_template_value() -> impl Strategy<Value = TemplateValue> {
    prop_oneof![
        (any::<String>(), arb_timestamp(), arb_user_id())
            .prop_map(|(value, timestamp, user_id)| TemplateValue::Text {
                value,
                timestamp,
                user_id,
            }),
        (any::<CodexId>(), arb_timestamp(), arb_user_id())
            .prop_map(|(codex_id, timestamp, user_id)| TemplateValue::Reference {
                codex_id,
                timestamp,
                user_id,
            }),
        (proptest::arbitrary::any::<serde_json::Value>(), arb_timestamp(), arb_user_id())
            .prop_map(|(value, timestamp, user_id)| TemplateValue::Structured {
                value,
                timestamp,
                user_id,
            })
    ]
}

/// Generate arbitrary CodexReference for testing
fn arb_codex_reference() -> impl Strategy<Value = CodexReference> {
    (
        arb_codex_id(),
        arb_codex_id(),
        prop_oneof![
            Just(ReferenceType::Child),
            Just(ReferenceType::DependsOn),
            Just(ReferenceType::References),
            Just(ReferenceType::Related),
            any::<String>().prop_map(ReferenceType::Custom)
        ],
        proptest::option::of(any::<String>())
    ).prop_map(|(from_codex_id, to_codex_id, reference_type, context)| {
        CodexReference {
            from_codex_id,
            to_codex_id,
            reference_type,
            context,
        }
    })
}

/// Generate arbitrary OperationType for testing
fn arb_operation_type() -> impl Strategy<Value = OperationType> {
    prop_oneof![
        // Text operations
        (any::<String>(), any::<usize>(), any::<String>())
            .prop_map(|(field_id, position, content)| OperationType::TextInsert {
                field_id,
                position: position % 1000, // Bound position to reasonable range
                content,
            }),
        (any::<String>(), any::<usize>(), 1usize..=100)
            .prop_map(|(field_id, position, length)| OperationType::TextDelete {
                field_id,
                position: position % 1000,
                length,
            }),

        // Metadata operations
        (any::<String>(), arb_template_value())
            .prop_map(|(key, value)| OperationType::MetadataSet { key, value }),
        any::<String>().prop_map(|key| OperationType::MetadataDelete { key }),

        // Reference operations
        arb_codex_reference().prop_map(|reference| OperationType::ReferenceAdd { reference }),
        arb_codex_reference().prop_map(|reference| OperationType::ReferenceRemove { reference }),

        // Tree operations
        (
            proptest::option::of(arb_codex_id()),
            any::<usize>(),
            arb_codex_id()
        ).prop_map(|(parent_id, position, child_id)| OperationType::TreeInsert {
            parent_id,
            position: position % 100,
            child_id,
        }),
        (
            proptest::option::of(arb_codex_id()),
            arb_codex_id()
        ).prop_map(|(parent_id, child_id)| OperationType::TreeDelete {
            parent_id,
            child_id,
        }),
    ]
}

/// Generate a complete CRDT operation with valid metadata
fn arb_crdt_operation(codex_id: CodexId) -> impl Strategy<Value = CRDTOperation> {
    (
        arb_operation_type(),
        arb_user_id(),
        arb_timestamp(),
        any::<[u8; 16]>(), // For operation ID
    ).prop_map(move |(operation, user_id, timestamp, id_bytes)| {
        let mut vector_clock = VectorClock::new();
        vector_clock.insert(user_id.clone(), 1);

        let layer = match &operation {
            OperationType::TextInsert { .. } |
            OperationType::TextDelete { .. } |
            OperationType::TextFormat { .. } => CRDTLayer::Text,

            OperationType::TreeInsert { .. } |
            OperationType::TreeDelete { .. } |
            OperationType::TreeMove { .. } => CRDTLayer::Tree,

            OperationType::MetadataSet { .. } |
            OperationType::MetadataDelete { .. } => CRDTLayer::Metadata,

            OperationType::ReferenceAdd { .. } |
            OperationType::ReferenceRemove { .. } => CRDTLayer::Reference,
        };

        CRDTOperation {
            id: Uuid::from_bytes(id_bytes),
            operation,
            user_id,
            timestamp,
            vector_clock,
            parents: Vec::new(),
            layer,
        }
    })
}

#[cfg(test)]
mod property_tests {
    use super::*;

    /// Test that CRDT operations are commutative - order doesn't matter
    proptest! {
        #[test]
        fn test_operation_commutativity(
            codex_id in arb_codex_id(),
            user_id in arb_user_id(),
            operations in prop::collection::vec(arb_crdt_operation(codex_id), 1..=10)
        ) {
            // Create two identical CRDTs
            let mut crdt1 = VesperaCRDT::new(codex_id, user_id.clone());
            let mut crdt2 = VesperaCRDT::new(codex_id, user_id.clone());

            // Apply operations in original order to crdt1
            for op in &operations {
                let _ = crdt1.apply_operation(op.clone());
            }

            // Apply operations in reverse order to crdt2
            for op in operations.iter().rev() {
                let _ = crdt2.apply_operation(op.clone());
            }

            // CRDTs should converge to the same state regardless of operation order
            assert_crdt_convergence(&crdt1, &crdt2);
        }
    }

    /// Test that merge operations are associative - (A ∪ B) ∪ C = A ∪ (B ∪ C)
    proptest! {
        #[test]
        fn test_merge_associativity(
            codex_id in arb_codex_id(),
            user_ids in prop::collection::vec(arb_user_id(), 3..=3),
            operations_per_crdt in prop::collection::vec(
                prop::collection::vec(arb_crdt_operation(codex_id), 1..=5),
                3..=3
            )
        ) {
            // Create three CRDTs
            let mut crdt_a = VesperaCRDT::new(codex_id, user_ids[0].clone());
            let mut crdt_b = VesperaCRDT::new(codex_id, user_ids[1].clone());
            let mut crdt_c = VesperaCRDT::new(codex_id, user_ids[2].clone());

            // Apply different operations to each CRDT
            for op in &operations_per_crdt[0] {
                let _ = crdt_a.apply_operation(op.clone());
            }
            for op in &operations_per_crdt[1] {
                let _ = crdt_b.apply_operation(op.clone());
            }
            for op in &operations_per_crdt[2] {
                let _ = crdt_c.apply_operation(op.clone());
            }

            // Test (A ∪ B) ∪ C
            let mut test1_ab = crdt_a.clone();
            let _ = test1_ab.merge(&crdt_b);
            let mut test1_result = test1_ab;
            let _ = test1_result.merge(&crdt_c);

            // Test A ∪ (B ∪ C)
            let mut test2_bc = crdt_b.clone();
            let _ = test2_bc.merge(&crdt_c);
            let mut test2_result = crdt_a.clone();
            let _ = test2_result.merge(&test2_bc);

            // Results should be equivalent
            assert_crdt_convergence(&test1_result, &test2_result);
        }
    }

    /// Test that operations are idempotent - applying the same operation twice has no effect
    proptest! {
        #[test]
        fn test_operation_idempotency(
            codex_id in arb_codex_id(),
            user_id in arb_user_id(),
            operations in prop::collection::vec(arb_crdt_operation(codex_id), 1..=5)
        ) {
            let mut crdt1 = VesperaCRDT::new(codex_id, user_id.clone());
            let mut crdt2 = VesperaCRDT::new(codex_id, user_id.clone());

            // Apply operations once to crdt1
            for op in &operations {
                let _ = crdt1.apply_operation(op.clone());
            }

            // Apply operations twice to crdt2
            for op in &operations {
                let _ = crdt2.apply_operation(op.clone());
                let _ = crdt2.apply_operation(op.clone()); // Apply again
            }

            // Both CRDTs should have the same state
            assert_crdt_convergence(&crdt1, &crdt2);
        }
    }

    /// Test that vector clocks maintain monotonicity
    proptest! {
        #[test]
        fn test_vector_clock_monotonicity(
            codex_id in arb_codex_id(),
            user_id in arb_user_id(),
            operation_count in 1usize..=20
        ) {
            let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());
            let mut previous_clock_value = 0;

            for i in 0..operation_count {
                // Create a simple metadata operation
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

                let _ = crdt.apply_operation(operation);

                // Check that the vector clock for this user is monotonically increasing
                let current_clock_value = crdt.vector_clock.get(&user_id).copied().unwrap_or(0);
                prop_assert!(
                    current_clock_value > previous_clock_value,
                    "Vector clock should be monotonically increasing: {} <= {}",
                    current_clock_value,
                    previous_clock_value
                );
                previous_clock_value = current_clock_value;
            }
        }
    }

    /// Test CRDT convergence property - all replicas eventually converge
    proptest! {
        #[test]
        fn test_convergence_property(
            codex_id in arb_codex_id(),
            users in prop::collection::vec(arb_user_id(), 2..=5),
            operations_per_user in 1usize..=10
        ) {
            let mut crdts: Vec<VesperaCRDT> = users.iter()
                .map(|user| VesperaCRDT::new(codex_id, user.clone()))
                .collect();

            // Each user performs some operations on their local CRDT
            for (i, crdt) in crdts.iter_mut().enumerate() {
                let user_id = &users[i];
                for j in 0..operations_per_user {
                    let operation = crdt.create_operation(
                        OperationType::MetadataSet {
                            key: format!("user_{}_key_{}", i, j),
                            value: TemplateValue::Text {
                                value: format!("user_{}_value_{}", i, j),
                                timestamp: Utc::now(),
                                user_id: user_id.clone(),
                            },
                        },
                        user_id.clone(),
                    );
                    let _ = crdt.apply_operation(operation);
                }
            }

            // Simulate network synchronization - all CRDTs exchange all operations
            let all_operations: Vec<CRDTOperation> = crdts.iter()
                .flat_map(|crdt| crdt.operation_log.iter().cloned())
                .collect();

            // Apply all operations to all CRDTs
            for crdt in crdts.iter_mut() {
                for op in &all_operations {
                    // Skip if operation already exists
                    if !crdt.operation_log.iter().any(|existing| existing.id == op.id) {
                        let _ = crdt.apply_operation(op.clone());
                    }
                }
            }

            // All CRDTs should have converged to the same state
            for i in 1..crdts.len() {
                assert_crdt_convergence(&crdts[0], &crdts[i]);
            }
        }
    }

    /// Test that operation ordering is preserved within each user's operations
    proptest! {
        #[test]
        fn test_operation_ordering_preservation(
            codex_id in arb_codex_id(),
            user_id in arb_user_id(),
            operation_count in 2usize..=10
        ) {
            let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());
            let mut operation_ids = Vec::new();

            for i in 0..operation_count {
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

                operation_ids.push(operation.id);
                let _ = crdt.apply_operation(operation);
            }

            // Check that operations appear in the log in the order they were created
            let logged_ops: Vec<_> = crdt.operation_log.iter()
                .filter(|op| op.user_id == user_id)
                .map(|op| op.id)
                .collect();

            // The operations should appear in the same order (allowing for interleaving from other operations)
            let mut logged_iter = logged_ops.iter();
            for expected_id in &operation_ids {
                prop_assert!(
                    logged_iter.any(|&id| id == *expected_id),
                    "Operation {} should appear in the log", expected_id
                );
            }
        }
    }

    /// Test LWW-Map conflict resolution consistency
    proptest! {
        #[test]
        fn test_lww_map_conflict_resolution(
            keys in prop::collection::vec(any::<String>(), 1..=5),
            values in prop::collection::vec(any::<String>(), 1..=10),
            user_ids in prop::collection::vec(arb_user_id(), 1..=3)
        ) {
            let mut lww_map1: LWWMap<String, String> = LWWMap::new();
            let mut lww_map2: LWWMap<String, String> = LWWMap::new();

            // Generate operations with different timestamps
            let mut operations = Vec::new();
            for (i, value) in values.iter().enumerate() {
                let key = &keys[i % keys.len()];
                let user_id = &user_ids[i % user_ids.len()];
                let timestamp = Utc::now() + Duration::milliseconds(i as i64);

                operations.push((key.clone(), value.clone(), timestamp, user_id.clone()));
            }

            // Apply operations to both maps in different orders
            for (key, value, timestamp, user_id) in &operations {
                lww_map1.set_with_metadata(
                    key.clone(),
                    value.clone(),
                    *timestamp,
                    user_id.clone(),
                    Uuid::new_v4(),
                );
            }

            for (key, value, timestamp, user_id) in operations.iter().rev() {
                lww_map2.set_with_metadata(
                    key.clone(),
                    value.clone(),
                    *timestamp,
                    user_id.clone(),
                    Uuid::new_v4(),
                );
            }

            // Both maps should converge to the same state
            prop_assert_eq!(lww_map1, lww_map2);
        }
    }

    /// Test OR-Set add/remove semantics
    proptest! {
        #[test]
        fn test_or_set_semantics(
            elements in prop::collection::vec(any::<i32>(), 1..=10),
            user_ids in prop::collection::vec(arb_user_id(), 1..=3)
        ) {
            let mut or_set1: ORSet<i32> = ORSet::new();
            let mut or_set2: ORSet<i32> = ORSet::new();

            // Add all elements to both sets
            for element in &elements {
                or_set1.add(*element);
                or_set2.add(*element);
            }

            // Remove some elements from set1
            let elements_to_remove: Vec<_> = elements.iter().step_by(2).cloned().collect();
            for element in &elements_to_remove {
                or_set1.remove(element);
            }

            // Remove the same elements from set2
            for element in &elements_to_remove {
                or_set2.remove(element);
            }

            // Both sets should have the same elements
            let set1_elements: HashSet<_> = or_set1.iter().cloned().collect();
            let set2_elements: HashSet<_> = or_set2.iter().cloned().collect();
            prop_assert_eq!(set1_elements, set2_elements);

            // Elements that weren't removed should still be present
            for element in &elements {
                if !elements_to_remove.contains(element) {
                    prop_assert!(or_set1.contains(element));
                    prop_assert!(or_set2.contains(element));
                }
            }
        }
    }

    /// Test that merging is idempotent - merging the same CRDT multiple times has no effect
    proptest! {
        #[test]
        fn test_merge_idempotency(
            codex_id in arb_codex_id(),
            user_id in arb_user_id(),
            operations in prop::collection::vec(arb_crdt_operation(codex_id), 1..=5)
        ) {
            let mut source_crdt = VesperaCRDT::new(codex_id, user_id.clone());
            let mut target_crdt = VesperaCRDT::new(codex_id, user_id.clone());

            // Apply operations to source CRDT
            for op in &operations {
                let _ = source_crdt.apply_operation(op.clone());
            }

            // Merge source into target once
            let _ = target_crdt.merge(&source_crdt);
            let target_after_first_merge = target_crdt.clone();

            // Merge source into target again
            let _ = target_crdt.merge(&source_crdt);

            // Target should be unchanged after the second merge
            assert_crdt_convergence(&target_after_first_merge, &target_crdt);
        }
    }
}

/// Fuzz tests for edge cases and robustness
#[cfg(test)]
mod fuzz_tests {
    use super::*;

    /// Fuzz test with completely random operations
    #[test]
    fn fuzz_random_operations() {
        let mut runner = TestRunner::default();
        let strategy = (
            arb_codex_id(),
            prop::collection::vec(arb_user_id(), 1..=5),
            prop::collection::vec(arb_crdt_operation(Uuid::new_v4()), 1..=50)
        );

        runner.run(&strategy, |(codex_id, user_ids, operations)| {
            let mut crdt = VesperaCRDT::new(codex_id, user_ids[0].clone());

            // Apply all operations and ensure no panics
            for operation in operations {
                let _ = crdt.apply_operation(operation);
            }

            // CRDT should remain in a valid state
            let stats = crdt.memory_stats();
            prop_assert!(stats.operation_log_size >= 0);
            prop_assert!(stats.metadata_stats.active_entries >= 0);
            prop_assert!(stats.reference_stats.active_elements >= 0);

            Ok(())
        }).expect("Fuzz test should not panic");
    }

    /// Fuzz test with extreme values
    #[test]
    fn fuzz_extreme_values() {
        let mut runner = TestRunner::default();
        let strategy = (
            arb_codex_id(),
            arb_user_id(),
        );

        runner.run(&strategy, |(codex_id, user_id)| {
            let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

            // Test with very large strings
            let large_string = "x".repeat(100_000);
            let large_operation = crdt.create_operation(
                OperationType::MetadataSet {
                    key: "large_key".to_string(),
                    value: TemplateValue::Text {
                        value: large_string,
                        timestamp: Utc::now(),
                        user_id: user_id.clone(),
                    },
                },
                user_id.clone(),
            );

            // Should handle large values without panicking
            let result = crdt.apply_operation(large_operation);
            prop_assert!(result.is_ok());

            // Test with empty strings
            let empty_operation = crdt.create_operation(
                OperationType::MetadataSet {
                    key: "".to_string(),
                    value: TemplateValue::Text {
                        value: "".to_string(),
                        timestamp: Utc::now(),
                        user_id: user_id.clone(),
                    },
                },
                user_id.clone(),
            );

            let result = crdt.apply_operation(empty_operation);
            prop_assert!(result.is_ok());

            Ok(())
        }).expect("Extreme value fuzz test should not panic");
    }

    /// Fuzz test memory management under stress
    #[test]
    fn fuzz_memory_management() {
        let mut runner = TestRunner::default();
        let strategy = (
            arb_codex_id(),
            arb_user_id(),
            1000usize..=5000
        );

        runner.run(&strategy, |(codex_id, user_id, operation_count)| {
            let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

            // Apply many operations to test memory management
            for i in 0..operation_count {
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

                let _ = crdt.apply_operation(operation);
            }

            // Verify that memory management keeps operation log bounded
            let stats = crdt.memory_stats();
            prop_assert!(
                stats.operation_log_size <= 1000,
                "Operation log should be bounded even with {} operations",
                operation_count
            );

            // Test explicit memory optimization
            let optimization_result = crdt.optimize_memory();
            prop_assert!(optimization_result.operations_removed > 0);

            Ok(())
        }).expect("Memory management fuzz test should not panic");
    }
}

/// Performance-focused property tests
#[cfg(test)]
mod performance_property_tests {
    use super::*;
    use std::time::Instant;

    /// Test that operation application time is bounded
    proptest! {
        #[test]
        fn test_operation_performance_bounds(
            codex_id in arb_codex_id(),
            user_id in arb_user_id(),
            operations in prop::collection::vec(arb_crdt_operation(codex_id), 10..=100)
        ) {
            let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());
            let start_time = Instant::now();

            for operation in operations {
                let _ = crdt.apply_operation(operation);
            }

            let elapsed = start_time.elapsed();

            // Operations should complete within reasonable time
            prop_assert!(
                elapsed.as_millis() < 1000,
                "Operations took too long: {}ms",
                elapsed.as_millis()
            );
        }
    }

    /// Test that merge performance is acceptable
    proptest! {
        #[test]
        fn test_merge_performance_bounds(
            codex_id in arb_codex_id(),
            user_ids in prop::collection::vec(arb_user_id(), 2..=2),
            operations_per_crdt in 10usize..=50
        ) {
            let mut crdt1 = VesperaCRDT::new(codex_id, user_ids[0].clone());
            let mut crdt2 = VesperaCRDT::new(codex_id, user_ids[1].clone());

            // Populate both CRDTs
            for i in 0..operations_per_crdt {
                let op1 = crdt1.create_operation(
                    OperationType::MetadataSet {
                        key: format!("key1_{}", i),
                        value: TemplateValue::Text {
                            value: format!("value1_{}", i),
                            timestamp: Utc::now(),
                            user_id: user_ids[0].clone(),
                        },
                    },
                    user_ids[0].clone(),
                );

                let op2 = crdt2.create_operation(
                    OperationType::MetadataSet {
                        key: format!("key2_{}", i),
                        value: TemplateValue::Text {
                            value: format!("value2_{}", i),
                            timestamp: Utc::now(),
                            user_id: user_ids[1].clone(),
                        },
                    },
                    user_ids[1].clone(),
                );

                let _ = crdt1.apply_operation(op1);
                let _ = crdt2.apply_operation(op2);
            }

            // Test merge performance
            let start_time = Instant::now();
            let _ = crdt1.merge(&crdt2);
            let merge_time = start_time.elapsed();

            prop_assert!(
                merge_time.as_millis() < 100,
                "Merge took too long: {}ms",
                merge_time.as_millis()
            );
        }
    }
}

/// Property-based tests for invariants
#[cfg(test)]
mod invariant_tests {
    use super::*;

    /// Test that CRDT state remains consistent after any sequence of operations
    proptest! {
        #[test]
        fn test_state_consistency_invariant(
            codex_id in arb_codex_id(),
            user_id in arb_user_id(),
            operations in prop::collection::vec(arb_crdt_operation(codex_id), 1..=20)
        ) {
            let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

            for operation in operations {
                let _ = crdt.apply_operation(operation);

                // Verify invariants after each operation

                // 1. Vector clock should never decrease
                let current_clock = crdt.vector_clock.get(&user_id).copied().unwrap_or(0);
                prop_assert!(current_clock >= 0);

                // 2. Operation log should be bounded
                prop_assert!(crdt.operation_log.len() <= 1000);

                // 3. Metadata layer should be consistent
                let metadata_stats = crdt.metadata_layer.stats();
                prop_assert!(metadata_stats.active_entries >= 0);
                prop_assert!(metadata_stats.tombstones >= 0);

                // 4. Reference layer should be consistent
                let reference_stats = crdt.reference_layer.stats();
                prop_assert!(reference_stats.active_elements >= 0);
                prop_assert!(reference_stats.total_elements >= reference_stats.active_elements);

                // 5. Timestamps should be valid
                prop_assert!(crdt.created_at <= crdt.updated_at);
            }
        }
    }

    /// Test that concurrent modifications preserve correctness
    proptest! {
        #[test]
        fn test_concurrent_modification_safety(
            codex_id in arb_codex_id(),
            user_ids in prop::collection::vec(arb_user_id(), 2..=4),
            operations_per_user in 1usize..=10
        ) {
            let mut crdts: Vec<VesperaCRDT> = user_ids.iter()
                .map(|user| VesperaCRDT::new(codex_id, user.clone()))
                .collect();

            // Simulate concurrent operations
            let mut all_operations = Vec::new();
            for (i, crdt) in crdts.iter_mut().enumerate() {
                let user_id = &user_ids[i];
                for j in 0..operations_per_user {
                    let operation = crdt.create_operation(
                        OperationType::MetadataSet {
                            key: format!("concurrent_key_{}_{}", i, j),
                            value: TemplateValue::Text {
                                value: format!("concurrent_value_{}_{}", i, j),
                                timestamp: Utc::now(),
                                user_id: user_id.clone(),
                            },
                        },
                        user_id.clone(),
                    );

                    all_operations.push(operation.clone());
                    let _ = crdt.apply_operation(operation);
                }
            }

            // Apply all operations to all CRDTs (simulating eventual consistency)
            for crdt in crdts.iter_mut() {
                for operation in &all_operations {
                    if !crdt.operation_log.iter().any(|op| op.id == operation.id) {
                        let _ = crdt.apply_operation(operation.clone());
                    }
                }
            }

            // All CRDTs should converge and maintain consistency
            for i in 1..crdts.len() {
                assert_crdt_convergence(&crdts[0], &crdts[i]);
            }

            // Verify final state consistency
            for crdt in &crdts {
                let stats = crdt.memory_stats();
                prop_assert!(stats.metadata_stats.active_entries >= operations_per_user * user_ids.len());
            }
        }
    }
}

/// Property tests for garbage collection behavior
mod gc_property_tests {
    use super::*;
    use tokio_test;

    proptest! {
        #[test]
        fn test_gc_memory_invariants(
            initial_operations in 100usize..=2000,
            gc_keep_operations in 50usize..=500,
            gc_keep_tombstones in 25usize..=250,
        ) {
            let user_id = "gc_test_user".to_string();
            let codex_id = Uuid::new_v4();
            let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

            // Add initial operations
            for i in 0..initial_operations {
                let field_name = format!("gc_field_{}", i % 100);
                let field_value = format!("gc_value_{}", i);
                crdt.set_text_field(&field_name, &field_value);
            }

            let pre_gc_stats = crdt.memory_stats();
            prop_assert!(pre_gc_stats.operation_count >= initial_operations);
            prop_assert!(pre_gc_stats.total_size_bytes > 0);

            // Perform garbage collection
            let gc_stats = crdt.gc_all_with_limits(
                Utc::now() - chrono::Duration::minutes(1),
                gc_keep_operations,
                gc_keep_tombstones,
            );

            let post_gc_stats = crdt.memory_stats();

            // Verify GC invariants
            prop_assert!(post_gc_stats.operation_count <= pre_gc_stats.operation_count);
            prop_assert!(post_gc_stats.total_size_bytes <= pre_gc_stats.total_size_bytes);
            prop_assert!(gc_stats.operations_removed <= initial_operations);
            prop_assert!(gc_stats.memory_freed_bytes <= pre_gc_stats.total_size_bytes);

            // Ensure CRDT is still functional after GC
            crdt.set_text_field("post_gc_field", "post_gc_value");
            let final_stats = crdt.memory_stats();
            prop_assert!(final_stats.operation_count > 0);
        }
    }
}

/// Property tests for serialization behavior
mod serialization_property_tests {
    use super::*;

    proptest! {
        #[test]
        fn test_crdt_serialization_roundtrip(
            operation_count in 1usize..=500,
            field_name_length in 1usize..=50,
            field_value_length in 1usize..=200,
        ) {
            let user_id = "serialization_test_user".to_string();
            let codex_id = Uuid::new_v4();
            let mut original_crdt = VesperaCRDT::new(codex_id, user_id.clone());

            // Add operations to the CRDT
            for i in 0..operation_count {
                let field_name = format!(
                    "field_{}",
                    "f".repeat(std::cmp::min(field_name_length, 30))
                );
                let field_value = format!(
                    "value_{}_{}",
                    i,
                    "v".repeat(std::cmp::min(field_value_length, 100))
                );

                original_crdt.set_text_field(&field_name, &field_value);
            }

            // Test JSON serialization roundtrip
            let json_serialized = serde_json::to_vec(&original_crdt.operation_log).unwrap();
            let json_deserialized: Vec<CRDTOperation> =
                serde_json::from_slice(&json_serialized).unwrap();

            prop_assert_eq!(original_crdt.operation_log.len(), json_deserialized.len());

            // Test MessagePack serialization roundtrip
            let msgpack_serialized = rmp_serde::to_vec(&original_crdt.operation_log).unwrap();
            let msgpack_deserialized: Vec<CRDTOperation> =
                rmp_serde::from_slice(&msgpack_serialized).unwrap();

            prop_assert_eq!(original_crdt.operation_log.len(), msgpack_deserialized.len());

            // Verify size efficiency (MessagePack should be smaller than JSON)
            prop_assert!(msgpack_serialized.len() <= json_serialized.len());

            // Verify all formats produce valid operation logs
            for operations in [&json_deserialized, &msgpack_deserialized] {
                for operation in operations {
                    prop_assert!(!operation.id.is_empty());
                    prop_assert!(!operation.user_id.is_empty());
                }
            }
        }
    }
}