//! Tests for Sync protocol functionality
//!
//! This module tests synchronization, conflict resolution, offline handling,
//! and real-time collaboration features.

use std::collections::HashMap;
use chrono::{DateTime, Utc, Duration};
use uuid::Uuid;

use crate::{
    sync::{SyncManager, SyncProtocol, ConflictResolver, OfflineManager},
    crdt::{VesperaCRDT, CRDTOperation, OperationType, TemplateValue, CodexReference, ReferenceType},
    types::{CodexId, UserId},
    tests::utils::{create_test_crdt, assert_crdt_convergence, TestFixture, PerformanceTest},
    BinderyConfig,
};

#[cfg(test)]
mod sync_manager_tests {
    use super::*;

    #[tokio::test]
    async fn test_sync_manager_creation() {
        let config = BinderyConfig {
            collaboration_enabled: true,
            ..Default::default()
        };

        let sync_manager = SyncManager::new(config).expect("Should create sync manager");
        let stats = sync_manager.get_stats();

        assert_eq!(stats.registered_codices, 0);
        assert_eq!(stats.active_connections, 0);
    }

    #[tokio::test]
    async fn test_sync_manager_codex_registration() {
        let config = BinderyConfig {
            collaboration_enabled: true,
            ..Default::default()
        };

        let sync_manager = SyncManager::new(config).expect("Should create sync manager");
        let codex_id = Uuid::new_v4();
        let user_id = "test_user".to_string();
        let crdt = std::sync::Arc::new(VesperaCRDT::new(codex_id, user_id));

        // Register codex
        sync_manager.register_codex(codex_id, crdt.clone()).await
            .expect("Should register codex");

        let stats = sync_manager.get_stats();
        assert_eq!(stats.registered_codices, 1);

        // Unregister codex
        sync_manager.unregister_codex(&codex_id).await
            .expect("Should unregister codex");

        let stats_after = sync_manager.get_stats();
        assert_eq!(stats_after.registered_codices, 0);
    }

    #[tokio::test]
    async fn test_sync_manager_connections() {
        let config = BinderyConfig {
            collaboration_enabled: true,
            ..Default::default()
        };

        let sync_manager = SyncManager::new(config).expect("Should create sync manager");

        // Register connections
        sync_manager.register_connection("conn_1".to_string(), Some("peer_1".to_string()))
            .expect("Should register connection");
        sync_manager.register_connection("conn_2".to_string(), Some("peer_2".to_string()))
            .expect("Should register connection");

        let stats = sync_manager.get_stats();
        assert_eq!(stats.active_connections, 2);

        // Unregister connection
        let unregistered = sync_manager.unregister_connection("conn_1")
            .expect("Should unregister connection");
        assert!(unregistered);

        let stats_after = sync_manager.get_stats();
        assert_eq!(stats_after.active_connections, 1);

        // Try to unregister non-existent connection
        let not_found = sync_manager.unregister_connection("conn_999")
            .expect("Should not error");
        assert!(!not_found);
    }

    #[tokio::test]
    async fn test_sync_manager_cleanup() {
        let config = BinderyConfig {
            collaboration_enabled: true,
            ..Default::default()
        };

        let sync_manager = SyncManager::new(config).expect("Should create sync manager");

        // Create and register some codices
        for i in 0..5 {
            let codex_id = Uuid::new_v4();
            let user_id = format!("user_{}", i);
            let crdt = std::sync::Arc::new(VesperaCRDT::new(codex_id, user_id));

            sync_manager.register_codex(codex_id, crdt).await
                .expect("Should register codex");
        }

        let stats_before = sync_manager.get_stats();
        assert_eq!(stats_before.registered_codices, 5);

        // Clean up dead references (in this case, all are still alive)
        let cleaned = sync_manager.cleanup_dead_references();
        assert_eq!(cleaned, 0, "No references should be cleaned since they're all alive");

        // Stop the sync manager
        sync_manager.stop().await.expect("Should stop sync manager");

        let stats_final = sync_manager.get_stats();
        assert_eq!(stats_final.active_connections, 0);
        assert_eq!(stats_final.registered_codices, 0);
    }
}

#[cfg(test)]
mod conflict_resolution_tests {
    use super::*;

    #[tokio::test]
    async fn test_concurrent_metadata_updates() {
        let codex_id = Uuid::new_v4();
        let user1 = "user1".to_string();
        let user2 = "user2".to_string();

        let mut crdt1 = VesperaCRDT::new(codex_id, user1.clone());
        let mut crdt2 = VesperaCRDT::new(codex_id, user2.clone());

        // Both users update the same key at roughly the same time
        let timestamp1 = Utc::now();
        let timestamp2 = timestamp1 + Duration::milliseconds(1); // Slightly later

        // User1 sets a value
        crdt1.set_metadata("title".to_string(), TemplateValue::Text {
            value: "User1's Title".to_string(),
            timestamp: timestamp1,
            user_id: user1.clone(),
        }).expect("Should set metadata");

        // User2 sets a different value (with later timestamp)
        crdt2.set_metadata("title".to_string(), TemplateValue::Text {
            value: "User2's Title".to_string(),
            timestamp: timestamp2,
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

        // Verify convergence - later timestamp should win (Last Writer Wins)
        assert_crdt_convergence(&crdt1, &crdt2);

        // Check that User2's value wins due to later timestamp
        let final_value = crdt1.get_metadata("title");
        assert!(final_value.is_some());
        if let TemplateValue::Text { value, .. } = final_value.unwrap() {
            assert_eq!(value, "User2's Title");
        }
    }

    #[tokio::test]
    async fn test_reference_conflicts() {
        let codex_id = Uuid::new_v4();
        let user1 = "user1".to_string();
        let user2 = "user2".to_string();

        let mut crdt1 = VesperaCRDT::new(codex_id, user1.clone());
        let mut crdt2 = VesperaCRDT::new(codex_id, user2.clone());

        let target_codex = Uuid::new_v4();

        // Both users add a reference to the same codex
        let reference = CodexReference {
            from_codex_id: codex_id,
            to_codex_id: target_codex,
            reference_type: ReferenceType::References,
            context: Some("shared reference".to_string()),
        };

        crdt1.add_reference(reference.clone()).expect("Should add reference");
        crdt2.add_reference(reference.clone()).expect("Should add reference");

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

        // Both should have the reference (OR-Set semantics allow duplicate adds)
        let references1 = crdt1.get_references();
        let references2 = crdt2.get_references();

        assert_eq!(references1.len(), references2.len());
        assert!(references1.contains(&&reference));
        assert!(references2.contains(&&reference));
    }

    #[tokio::test]
    async fn test_add_remove_conflict() {
        let codex_id = Uuid::new_v4();
        let user1 = "user1".to_string();
        let user2 = "user2".to_string();

        let mut crdt1 = VesperaCRDT::new(codex_id, user1.clone());
        let mut crdt2 = VesperaCRDT::new(codex_id, user2.clone());

        let target_codex = Uuid::new_v4();
        let reference = CodexReference {
            from_codex_id: codex_id,
            to_codex_id: target_codex,
            reference_type: ReferenceType::References,
            context: Some("test reference".to_string()),
        };

        // User1 adds a reference
        crdt1.add_reference(reference.clone()).expect("Should add reference");

        // Sync to User2
        let ops1 = crdt1.operation_log.clone();
        for op in ops1 {
            crdt2.apply_operation(op).expect("Should apply operation");
        }

        // Now User1 removes the reference, while User2 adds it again
        let remove_op = crdt1.create_operation(
            OperationType::ReferenceRemove { reference: reference.clone() },
            user1.clone(),
        );
        crdt1.apply_operation(remove_op).expect("Should remove reference");

        crdt2.add_reference(reference.clone()).expect("Should add reference again");

        // Exchange final operations
        let final_ops1 = crdt1.operation_log.iter().skip(1).cloned().collect::<Vec<_>>();
        let final_ops2 = crdt2.operation_log.iter().skip(1).cloned().collect::<Vec<_>>();

        for op in final_ops2 {
            crdt1.apply_operation(op).expect("Should apply operation");
        }

        for op in final_ops1 {
            crdt2.apply_operation(op).expect("Should apply operation");
        }

        // In OR-Set semantics, add should win over remove when concurrent
        // Both CRDTs should converge to the same state
        assert_crdt_convergence(&crdt1, &crdt2);
    }
}

#[cfg(test)]
mod offline_handling_tests {
    use super::*;

    #[tokio::test]
    async fn test_offline_operation_queue() {
        let codex_id = Uuid::new_v4();
        let user_id = "offline_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        // Simulate offline operations
        let offline_operations = vec![
            OperationType::MetadataSet {
                key: "offline_key1".to_string(),
                value: TemplateValue::Text {
                    value: "offline_value1".to_string(),
                    timestamp: Utc::now(),
                    user_id: user_id.clone(),
                },
            },
            OperationType::MetadataSet {
                key: "offline_key2".to_string(),
                value: TemplateValue::Text {
                    value: "offline_value2".to_string(),
                    timestamp: Utc::now(),
                    user_id: user_id.clone(),
                },
            },
            OperationType::TextInsert {
                field_id: "content".to_string(),
                position: 0,
                content: "Offline edit".to_string(),
            },
        ];

        // Apply operations while "offline"
        for operation_type in offline_operations {
            let operation = crdt.create_operation(operation_type, user_id.clone());
            crdt.apply_operation(operation).expect("Should apply offline operation");
        }

        // Verify operations were recorded
        assert_eq!(crdt.operation_log.len(), 3);

        // Simulate coming back online and syncing
        let online_crdt = VesperaCRDT::new(codex_id, "online_user".to_string());
        let mut offline_crdt = crdt;

        // Merge offline operations into online state
        let applied_ops = offline_crdt.merge(&online_crdt).expect("Should merge");
        assert_eq!(applied_ops.len(), 0); // No new operations from online CRDT

        // Verify offline changes are preserved
        assert!(offline_crdt.get_metadata("offline_key1").is_some());
        assert!(offline_crdt.get_metadata("offline_key2").is_some());
    }

    #[tokio::test]
    async fn test_network_partition_recovery() {
        let codex_id = Uuid::new_v4();
        let user1 = "partition1_user".to_string();
        let user2 = "partition2_user".to_string();

        let mut crdt1 = VesperaCRDT::new(codex_id, user1.clone());
        let mut crdt2 = VesperaCRDT::new(codex_id, user2.clone());

        // Both sides start with the same initial state
        crdt1.set_metadata("shared_key".to_string(), TemplateValue::Text {
            value: "initial_value".to_string(),
            timestamp: Utc::now(),
            user_id: "system".to_string(),
        }).expect("Should set initial metadata");

        // Sync initial state
        let initial_ops = crdt1.operation_log.clone();
        for op in initial_ops {
            crdt2.apply_operation(op).expect("Should apply initial operation");
        }

        // Clear operation logs to simulate starting from synced state
        crdt1.operation_log.clear();
        crdt2.operation_log.clear();

        // Simulate network partition - both sides make independent changes

        // Partition 1 changes
        for i in 0..5 {
            crdt1.set_metadata(format!("partition1_key_{}", i), TemplateValue::Text {
                value: format!("partition1_value_{}", i),
                timestamp: Utc::now(),
                user_id: user1.clone(),
            }).expect("Should set partition1 metadata");
        }

        // Partition 2 changes
        for i in 0..3 {
            crdt2.set_metadata(format!("partition2_key_{}", i), TemplateValue::Text {
                value: format!("partition2_value_{}", i),
                timestamp: Utc::now(),
                user_id: user2.clone(),
            }).expect("Should set partition2 metadata");
        }

        // Both sides modify the same key (conflict)
        crdt1.set_metadata("conflict_key".to_string(), TemplateValue::Text {
            value: "partition1_conflict_value".to_string(),
            timestamp: Utc::now(),
            user_id: user1.clone(),
        }).expect("Should set conflict metadata");

        crdt2.set_metadata("conflict_key".to_string(), TemplateValue::Text {
            value: "partition2_conflict_value".to_string(),
            timestamp: Utc::now() + Duration::milliseconds(1), // Slightly later
            user_id: user2.clone(),
        }).expect("Should set conflict metadata");

        // Network partition heals - exchange all operations
        let partition1_ops = crdt1.operation_log.clone();
        let partition2_ops = crdt2.operation_log.clone();

        for op in partition2_ops {
            crdt1.apply_operation(op).expect("Should apply partition2 operation");
        }

        for op in partition1_ops {
            crdt2.apply_operation(op).expect("Should apply partition1 operation");
        }

        // Verify convergence
        assert_crdt_convergence(&crdt1, &crdt2);

        // Check that all non-conflicting changes are preserved
        for i in 0..5 {
            assert!(crdt1.get_metadata(&format!("partition1_key_{}", i)).is_some());
            assert!(crdt2.get_metadata(&format!("partition1_key_{}", i)).is_some());
        }

        for i in 0..3 {
            assert!(crdt1.get_metadata(&format!("partition2_key_{}", i)).is_some());
            assert!(crdt2.get_metadata(&format!("partition2_key_{}", i)).is_some());
        }

        // Check conflict resolution (later timestamp wins)
        let conflict_value = crdt1.get_metadata("conflict_key");
        assert!(conflict_value.is_some());
        if let TemplateValue::Text { value, .. } = conflict_value.unwrap() {
            assert_eq!(value, "partition2_conflict_value"); // Later timestamp wins
        }
    }
}

#[cfg(test)]
mod sync_protocol_tests {
    use super::*;

    #[tokio::test]
    async fn test_sync_protocol_handshake() {
        // Test that sync protocol can establish connections
        // Note: This is a placeholder test since actual protocol implementation may vary

        let config = BinderyConfig {
            collaboration_enabled: true,
            ..Default::default()
        };

        let sync_manager = SyncManager::new(config).expect("Should create sync manager");

        // Simulate protocol handshake
        let connection_id = "test_connection".to_string();
        let peer_id = Some("test_peer".to_string());

        let result = sync_manager.register_connection(connection_id.clone(), peer_id);
        assert!(result.is_ok(), "Connection registration should succeed");

        let stats = sync_manager.get_stats();
        assert_eq!(stats.active_connections, 1);
    }

    #[tokio::test]
    async fn test_operation_broadcast() {
        let config = BinderyConfig {
            collaboration_enabled: true,
            ..Default::default()
        };

        let sync_manager = SyncManager::new(config).expect("Should create sync manager");
        let codex_id = Uuid::new_v4();
        let user_id = "broadcast_user".to_string();
        let crdt = std::sync::Arc::new(VesperaCRDT::new(codex_id, user_id.clone()));

        // Register codex and connections
        sync_manager.register_codex(codex_id, crdt.clone()).await
            .expect("Should register codex");

        sync_manager.register_connection("conn1".to_string(), Some("peer1".to_string()))
            .expect("Should register connection");
        sync_manager.register_connection("conn2".to_string(), Some("peer2".to_string()))
            .expect("Should register connection");

        // Test that operation broadcast mechanism exists
        // (Actual implementation would test real broadcasting)
        let stats = sync_manager.get_stats();
        assert_eq!(stats.registered_codices, 1);
        assert_eq!(stats.active_connections, 2);
    }
}

#[cfg(test)]
mod performance_tests {
    use super::*;

    #[tokio::test]
    async fn test_large_operation_sync() {
        let codex_id = Uuid::new_v4();
        let user1 = "perf_user1".to_string();
        let user2 = "perf_user2".to_string();

        let mut crdt1 = VesperaCRDT::new(codex_id, user1.clone());
        let mut crdt2 = VesperaCRDT::new(codex_id, user2.clone());

        let perf_test = PerformanceTest::new("large operation sync");

        // User1 generates many operations
        for i in 0..1000 {
            crdt1.set_metadata(format!("key_{}", i), TemplateValue::Text {
                value: format!("value_{}", i),
                timestamp: Utc::now(),
                user_id: user1.clone(),
            }).expect("Should set metadata");
        }

        // User2 generates some operations too
        for i in 0..100 {
            crdt2.set_metadata(format!("user2_key_{}", i), TemplateValue::Text {
                value: format!("user2_value_{}", i),
                timestamp: Utc::now(),
                user_id: user2.clone(),
            }).expect("Should set metadata");
        }

        // Sync operations
        let ops1 = crdt1.operation_log.clone();
        let ops2 = crdt2.operation_log.clone();

        for op in ops2 {
            crdt1.apply_operation(op).expect("Should apply operation");
        }

        for op in ops1 {
            crdt2.apply_operation(op).expect("Should apply operation");
        }

        perf_test.assert_duration_under(std::time::Duration::from_secs(5));

        // Verify convergence
        assert_crdt_convergence(&crdt1, &crdt2);
    }

    #[tokio::test]
    async fn test_concurrent_user_simulation() {
        let codex_id = Uuid::new_v4();
        let num_users = 10;
        let operations_per_user = 50;

        let perf_test = PerformanceTest::new("concurrent user simulation");

        // Create multiple CRDTs simulating different users
        let mut crdts: Vec<VesperaCRDT> = (0..num_users)
            .map(|i| VesperaCRDT::new(codex_id, format!("user_{}", i)))
            .collect();

        // Each user performs operations
        for (user_idx, crdt) in crdts.iter_mut().enumerate() {
            for op_idx in 0..operations_per_user {
                crdt.set_metadata(
                    format!("user_{}_key_{}", user_idx, op_idx),
                    TemplateValue::Text {
                        value: format!("user_{}_value_{}", user_idx, op_idx),
                        timestamp: Utc::now(),
                        user_id: format!("user_{}", user_idx),
                    }
                ).expect("Should set metadata");
            }
        }

        // Collect all operations
        let mut all_operations = Vec::new();
        for crdt in &crdts {
            all_operations.extend(crdt.operation_log.iter().cloned());
        }

        // Apply all operations to all CRDTs (simulate full sync)
        for crdt in crdts.iter_mut() {
            for op in &all_operations {
                if !crdt.operation_log.iter().any(|existing| existing.id == op.id) {
                    crdt.apply_operation(op.clone()).expect("Should apply operation");
                }
            }
        }

        perf_test.assert_duration_under(std::time::Duration::from_secs(10));

        // Verify all CRDTs converged
        for i in 1..crdts.len() {
            assert_crdt_convergence(&crdts[0], &crdts[i]);
        }

        // Verify total operation count
        let expected_total_ops = num_users * operations_per_user;
        let final_metadata_count = crdts[0].metadata_layer.stats().active_entries;

        // Should have all unique operations (no conflicts in this test)
        assert_eq!(final_metadata_count, expected_total_ops);
    }
}

#[cfg(test)]
mod edge_case_tests {
    use super::*;

    #[tokio::test]
    async fn test_empty_sync() {
        let codex_id = Uuid::new_v4();
        let user1 = "empty_user1".to_string();
        let user2 = "empty_user2".to_string();

        let crdt1 = VesperaCRDT::new(codex_id, user1);
        let crdt2 = VesperaCRDT::new(codex_id, user2);

        // Test syncing empty CRDTs
        assert_crdt_convergence(&crdt1, &crdt2);

        // Operation logs should be empty
        assert!(crdt1.operation_log.is_empty());
        assert!(crdt2.operation_log.is_empty());
    }

    #[tokio::test]
    async fn test_same_timestamp_conflict() {
        let codex_id = Uuid::new_v4();
        let user1 = "timestamp_user1".to_string();
        let user2 = "timestamp_user2".to_string();

        let mut crdt1 = VesperaCRDT::new(codex_id, user1.clone());
        let mut crdt2 = VesperaCRDT::new(codex_id, user2.clone());

        let same_timestamp = Utc::now();

        // Both users set the same key with the exact same timestamp
        crdt1.set_metadata("same_time_key".to_string(), TemplateValue::Text {
            value: "user1_value".to_string(),
            timestamp: same_timestamp,
            user_id: user1.clone(),
        }).expect("Should set metadata");

        crdt2.set_metadata("same_time_key".to_string(), TemplateValue::Text {
            value: "user2_value".to_string(),
            timestamp: same_timestamp,
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

        // Should still converge (tiebreaker might be user ID lexicographic order)
        assert_crdt_convergence(&crdt1, &crdt2);

        // Both should have the same final value
        let value1 = crdt1.get_metadata("same_time_key");
        let value2 = crdt2.get_metadata("same_time_key");
        assert_eq!(value1, value2);
    }

    #[tokio::test]
    async fn test_sync_manager_disabled() {
        let config = BinderyConfig {
            collaboration_enabled: false,
            ..Default::default()
        };

        // When collaboration is disabled, sync manager creation should still work
        // but might have limited functionality
        let result = SyncManager::new(config);

        // The exact behavior depends on implementation
        // For now, we just test that it doesn't panic
        match result {
            Ok(_sync_manager) => {
                // Success case
            }
            Err(_err) => {
                // Expected for disabled collaboration
            }
        }
    }

    #[tokio::test]
    async fn test_malformed_operation_handling() {
        let codex_id = Uuid::new_v4();
        let user_id = "malform_user".to_string();
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());

        // Create a malformed operation (this is more of a conceptual test)
        // In practice, the type system prevents most malformed operations

        // Test with empty field ID
        let result = crdt.insert_text("".to_string(), 0, "test".to_string());

        // Should handle gracefully (either succeed or fail predictably)
        match result {
            Ok(_) => {
                // Empty field ID was accepted
            }
            Err(_) => {
                // Empty field ID was rejected, which is also fine
            }
        }

        // Test with very large position
        let result = crdt.insert_text("field".to_string(), usize::MAX, "test".to_string());

        // Should not panic
        match result {
            Ok(_) => {
                // Large position was handled
            }
            Err(_) => {
                // Large position was rejected
            }
        }
    }
}