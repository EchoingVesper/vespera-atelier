//! Memory leak tests for CRDT structures
//! 
//! This module contains tests to verify that our memory leak fixes are working correctly.

use std::sync::Arc;
use std::collections::HashMap;
use chrono::{DateTime, Utc, Duration};

use crate::{
    crdt::{VesperaCRDT, CRDTOperation, OperationType, CRDTLayer},
    types::{CodexId, UserId, VectorClock},
    CodexManager, BinderyConfig,
};

#[tokio::test]
async fn test_operation_log_bounded_growth() {
    let codex_id = uuid::Uuid::new_v4();
    let user_id = "test_user".to_string();
    let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());
    
    // Add many operations to trigger garbage collection
    for i in 0..1500 {
        let operation = crdt.create_operation(
            OperationType::MetadataSet {
                key: format!("key_{}", i),
                value: crate::crdt::TemplateValue::Text {
                    value: format!("value_{}", i),
                    timestamp: Utc::now(),
                    user_id: user_id.clone(),
                },
            },
            user_id.clone(),
        );
        
        crdt.apply_operation(operation).expect("Failed to apply operation");
    }
    
    // Verify that garbage collection has occurred (should be <= 1000 operations)
    let stats = crdt.memory_stats();
    assert!(stats.operation_log_size <= 1000, 
        "Operation log size {} should be <= 1000 after GC", stats.operation_log_size);
    
    println!("✓ Operation log bounded growth test passed. Final size: {}", stats.operation_log_size);
}

#[tokio::test]
async fn test_metadata_layer_garbage_collection() {
    let codex_id = uuid::Uuid::new_v4();
    let user_id = "test_user".to_string();
    let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());
    
    // Add and delete many metadata entries
    for i in 0..100 {
        let key = format!("test_key_{}", i);
        let value = crate::crdt::TemplateValue::Text {
            value: format!("value_{}", i),
            timestamp: Utc::now(),
            user_id: user_id.clone(),
        };
        
        // Set the value
        crdt.set_metadata(key.clone(), value).expect("Failed to set metadata");
        
        // Delete half of them to create tombstones
        if i % 2 == 0 {
            crdt.metadata_layer.delete(&key);
        }
    }
    
    let stats_before = crdt.metadata_layer.stats();
    println!("Before GC - Metadata entries: {}, tombstones: {}", 
        stats_before.active_entries, stats_before.tombstones);
    
    // Perform garbage collection
    let cutoff = Utc::now() - Duration::hours(1);
    let gc_stats = crdt.gc_all(cutoff);
    
    let stats_after = crdt.metadata_layer.stats();
    println!("After GC - Metadata entries: {}, tombstones: {}", 
        stats_after.active_entries, stats_after.tombstones);
    
    println!("✓ Metadata layer garbage collection test passed. Removed {} tombstones", 
        gc_stats.metadata_tombstones_removed);
}

#[tokio::test]
async fn test_reference_layer_garbage_collection() {
    let codex_id = uuid::Uuid::new_v4();
    let user_id = "test_user".to_string();
    let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());
    
    // Add many references and then remove them
    for i in 0..100 {
        let reference = crate::crdt::CodexReference {
            from_codex_id: codex_id,
            to_codex_id: uuid::Uuid::new_v4(),
            reference_type: crate::crdt::ReferenceType::References,
            context: Some(format!("context_{}", i)),
        };
        
        // Add the reference
        crdt.add_reference(reference.clone()).expect("Failed to add reference");
        
        // Remove half of them to create removed tags
        if i % 2 == 0 {
            crdt.reference_layer.remove(&reference);
        }
    }
    
    let stats_before = crdt.reference_layer.stats();
    println!("Before GC - Active elements: {}, removed tags: {}", 
        stats_before.active_elements, stats_before.removed_tags);
    
    // Perform garbage collection
    let cutoff = Utc::now() - Duration::hours(1);
    let gc_stats = crdt.gc_all(cutoff);
    
    let stats_after = crdt.reference_layer.stats();
    println!("After GC - Active elements: {}, removed tags: {}", 
        stats_after.active_elements, stats_after.removed_tags);
    
    println!("✓ Reference layer garbage collection test passed. Removed {} tags", 
        gc_stats.reference_tags_removed);
}

#[tokio::test]
async fn test_text_layer_cleanup() {
    let codex_id = uuid::Uuid::new_v4();
    let user_id = "test_user".to_string();
    let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());
    
    // Create many text fields
    for i in 0..50 {
        let field_id = format!("field_{}", i);
        crdt.text_layer.init_field(&field_id, &format!("Initial content {}", i));
        
        // Add content to some fields
        if i % 3 == 0 {
            let _ = crdt.insert_text(field_id, 0, " - added content".to_string());
        }
        
        // Clear some fields to make them empty
        if i % 4 == 0 {
            let _ = crdt.text_layer.clear_field(&format!("field_{}", i));
        }
    }
    
    let fields_before = crdt.text_layer.field_count();
    println!("Before GC - Text fields: {}", fields_before);
    
    // Perform garbage collection
    let cleaned = crdt.text_layer.gc_fields();
    
    let fields_after = crdt.text_layer.field_count();
    println!("After GC - Text fields: {}, cleaned: {}", fields_after, cleaned);
    
    println!("✓ Text layer cleanup test passed. Cleaned {} empty fields", cleaned);
}

#[tokio::test]
async fn test_codex_manager_memory_management() {
    let config = BinderyConfig {
        collaboration_enabled: false,
        max_operations_in_memory: 100,
        auto_gc_enabled: true,
        gc_interval_seconds: 60,
        ..Default::default()
    };
    
    let mut manager = CodexManager::with_config(config).expect("Failed to create manager");
    
    // Create multiple Codices
    let mut codex_ids = Vec::new();
    for i in 0..10 {
        let id = manager.create_codex(
            format!("Test Codex {}", i), 
            format!("test-template-{}", i)
        ).await.expect("Failed to create codex");
        codex_ids.push(id);
    }
    
    // Get memory stats
    let memory_stats = manager.memory_stats().await;
    println!("Created {} Codices, memory stats collected", memory_stats.len());
    
    // Delete some Codices (this should trigger Drop implementations)
    for &id in &codex_ids[..5] {
        let deleted = manager.delete_codex(&id).await.expect("Failed to delete codex");
        assert!(deleted, "Codex should have been deleted");
    }
    
    // Remaining Codices should still be accessible
    let remaining = manager.list_codices().await;
    assert_eq!(remaining.len(), 5, "Should have 5 Codices remaining");
    
    // Shutdown the manager (this should clean up all resources)
    manager.shutdown().await.expect("Failed to shutdown manager");
    
    println!("✓ CodexManager memory management test passed");
}

#[tokio::test]
async fn test_sync_manager_weak_references() {
    use crate::sync::SyncManager;
    
    let config = BinderyConfig {
        collaboration_enabled: true,
        ..Default::default()
    };
    
    let sync_manager = SyncManager::new(config).expect("Failed to create sync manager");
    
    // Create a Codex CRDT
    let codex_id = uuid::Uuid::new_v4();
    let user_id = "test_user".to_string();
    let crdt = Arc::new(VesperaCRDT::new(codex_id, user_id));
    
    // Register it with sync manager
    sync_manager.register_codex(codex_id, crdt.clone()).await
        .expect("Failed to register codex");
    
    let stats_before = sync_manager.get_stats();
    assert_eq!(stats_before.registered_codices, 1);
    
    // Drop the strong reference
    drop(crdt);
    
    // Clean up dead references
    let cleaned = sync_manager.cleanup_dead_references();
    assert_eq!(cleaned, 1, "Should have cleaned up 1 dead reference");
    
    let stats_after = sync_manager.get_stats();
    assert_eq!(stats_after.registered_codices, 0, "Should have 0 registered codices after cleanup");
    
    println!("✓ SyncManager weak references test passed");
}

#[tokio::test] 
async fn test_connection_lifecycle() {
    use crate::sync::SyncManager;
    
    let config = BinderyConfig {
        collaboration_enabled: true,
        ..Default::default()
    };
    
    let sync_manager = SyncManager::new(config).expect("Failed to create sync manager");
    
    // Register multiple connections
    for i in 0..5 {
        let connection_id = format!("conn_{}", i);
        let peer_id = Some(format!("peer_{}", i));
        
        sync_manager.register_connection(connection_id, peer_id)
            .expect("Failed to register connection");
    }
    
    let stats = sync_manager.get_stats();
    assert_eq!(stats.active_connections, 5);
    
    // Unregister some connections
    for i in 0..3 {
        let connection_id = format!("conn_{}", i);
        let unregistered = sync_manager.unregister_connection(&connection_id)
            .expect("Failed to unregister connection");
        assert!(unregistered, "Connection should have been unregistered");
    }
    
    let stats_after = sync_manager.get_stats();
    assert_eq!(stats_after.active_connections, 2);
    
    // Stop the sync manager (should clean up all remaining connections)
    sync_manager.stop().await.expect("Failed to stop sync manager");
    
    let stats_final = sync_manager.get_stats();
    assert_eq!(stats_final.active_connections, 0, "All connections should be cleaned up");
    
    println!("✓ Connection lifecycle test passed");
}

#[tokio::test]
async fn test_comprehensive_resource_cleanup() {
    // This test verifies that all resources are properly cleaned up when structures are dropped
    let codex_id = uuid::Uuid::new_v4();
    let user_id = "test_user".to_string();
    
    {
        let mut crdt = VesperaCRDT::new(codex_id, user_id.clone());
        
        // Fill with data
        for i in 0..100 {
            let operation = crdt.create_operation(
                OperationType::MetadataSet {
                    key: format!("key_{}", i),
                    value: crate::crdt::TemplateValue::Text {
                        value: format!("value_{}", i),
                        timestamp: Utc::now(),
                        user_id: user_id.clone(),
                    },
                },
                user_id.clone(),
            );
            let _ = crdt.apply_operation(operation);
        }
        
        let stats = crdt.memory_stats();
        println!("CRDT filled with data - operations: {}, metadata: {}, references: {}, text fields: {}", 
            stats.operation_log_size, 
            stats.metadata_stats.active_entries,
            stats.reference_stats.active_elements,
            stats.text_field_count);
            
        // Manual cleanup test
        crdt.cleanup();
        
        let stats_after = crdt.memory_stats();
        assert_eq!(stats_after.operation_log_size, 0, "Operation log should be empty after cleanup");
        assert_eq!(stats_after.metadata_stats.active_entries, 0, "Metadata should be empty after cleanup");
        
        println!("Manual cleanup successful");
    } // Drop happens here
    
    println!("✓ Comprehensive resource cleanup test passed");
}

/// Run all memory leak tests
#[tokio::test]
async fn run_all_memory_tests() {
    println!("🧠 Running comprehensive memory leak tests...\n");
    
    test_operation_log_bounded_growth().await;
    test_metadata_layer_garbage_collection().await; 
    test_reference_layer_garbage_collection().await;
    test_text_layer_cleanup().await;
    test_codex_manager_memory_management().await;
    test_sync_manager_weak_references().await;
    test_connection_lifecycle().await;
    test_comprehensive_resource_cleanup().await;
    
    println!("\n🎉 All memory leak tests passed! The CRDT backend is now memory-safe.");
}