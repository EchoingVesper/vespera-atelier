// SecretManager specification tests
// TDD: These tests define the SecretManager facade behavior

use crate::secrets::{BackendType, SecretManager};
use anyhow::Result;

// ============================================================================
// Test Suite 1: Vault Reference Resolution
// ============================================================================

#[tokio::test]
async fn test_resolve_vault_reference() -> Result<()> {
    // Specification: Should resolve "vault://provider/key" to actual secret value
    let manager = SecretManager::new(BackendType::Keyring)?;

    // Store secret directly
    manager.store_secret("anthropic/api_key", "sk-ant-actual-key").await?;

    // Resolve vault reference
    let resolved = manager.resolve("vault://anthropic/api_key").await?;
    assert_eq!(resolved, "sk-ant-actual-key");

    // Cleanup
    manager.delete_secret("anthropic/api_key").await?;

    Ok(())
}

#[tokio::test]
async fn test_invalid_reference_format_error() -> Result<()> {
    // Specification: Non-vault:// references should return error
    let manager = SecretManager::new(BackendType::Keyring)?;

    // Missing "vault://" prefix
    let result = manager.resolve("anthropic/api_key").await;
    assert!(result.is_err(), "Should reject invalid reference format");

    // Wrong prefix
    let result = manager.resolve("http://anthropic/api_key").await;
    assert!(result.is_err(), "Should reject non-vault:// prefix");

    Ok(())
}

#[tokio::test]
async fn test_resolve_nonexistent_reference() -> Result<()> {
    // Specification: Resolving reference to non-existent secret should error
    let manager = SecretManager::new(BackendType::Keyring)?;

    let result = manager.resolve("vault://nonexistent/key").await;
    assert!(result.is_err(), "Should error when secret doesn't exist");

    Ok(())
}

#[tokio::test]
async fn test_vault_reference_with_complex_path() -> Result<()> {
    // Specification: Should handle complex hierarchical paths
    let manager = SecretManager::new(BackendType::Keyring)?;

    manager.store_secret("provider/production/api_key", "prod-key").await?;
    let resolved = manager.resolve("vault://provider/production/api_key").await?;
    assert_eq!(resolved, "prod-key");

    // Cleanup
    manager.delete_secret("provider/production/api_key").await?;

    Ok(())
}

// ============================================================================
// Test Suite 2: Direct Secret Operations via Manager
// ============================================================================

#[tokio::test]
async fn test_store_via_manager() -> Result<()> {
    // Specification: SecretManager should delegate storage to backend
    let manager = SecretManager::new(BackendType::Keyring)?;

    manager.store_secret("test/manager_store", "value123").await?;
    let retrieved = manager.get_secret("test/manager_store").await?;
    assert_eq!(retrieved, "value123");

    // Cleanup
    manager.delete_secret("test/manager_store").await?;

    Ok(())
}

#[tokio::test]
async fn test_retrieve_via_manager() -> Result<()> {
    // Specification: SecretManager should delegate retrieval to backend
    let manager = SecretManager::new(BackendType::Keyring)?;

    manager.store_secret("test/manager_retrieve", "retrieve-value").await?;

    // Direct retrieval (not via vault:// reference)
    let value = manager.get_secret("test/manager_retrieve").await?;
    assert_eq!(value, "retrieve-value");

    // Cleanup
    manager.delete_secret("test/manager_retrieve").await?;

    Ok(())
}

#[tokio::test]
async fn test_delete_via_manager() -> Result<()> {
    // Specification: SecretManager should delegate deletion to backend
    let manager = SecretManager::new(BackendType::Keyring)?;

    manager.store_secret("test/manager_delete", "to-delete").await?;
    manager.delete_secret("test/manager_delete").await?;

    let result = manager.get_secret("test/manager_delete").await;
    assert!(result.is_err(), "Secret should be deleted");

    Ok(())
}

#[tokio::test]
async fn test_list_secrets_via_manager() -> Result<()> {
    // Specification: SecretManager should delegate listing to backend
    let manager = SecretManager::new(BackendType::Keyring)?;

    // Note: Keyring backend may not support listing
    // This test documents the interface even if it returns empty or errors
    let result = manager.list_secrets().await;

    // Accept either success (with list) or "not supported" error
    match result {
        Ok(keys) => {
            println!("Listed {} keys", keys.len());
        }
        Err(e) => {
            println!("Listing not supported: {}", e);
            // This is acceptable for keyring backend
        }
    }

    Ok(())
}

// ============================================================================
// Test Suite 3: Backend Selection
// ============================================================================

#[tokio::test]
async fn test_backend_type_keyring() -> Result<()> {
    // Specification: Should create manager with keyring backend
    let manager = SecretManager::new(BackendType::Keyring)?;

    // Verify it works
    manager.store_secret("test/backend_type", "keyring-value").await?;
    let value = manager.get_secret("test/backend_type").await?;
    assert_eq!(value, "keyring-value");

    // Cleanup
    manager.delete_secret("test/backend_type").await?;

    Ok(())
}

// Future test (will fail until Age backend implemented):
// #[tokio::test]
// async fn test_backend_type_age() -> Result<()> {
//     let manager = SecretManager::new(BackendType::Age)?;
//     // ...
// }

// Future test (will fail until AES-GCM backend implemented):
// #[tokio::test]
// async fn test_backend_type_aes_gcm() -> Result<()> {
//     let manager = SecretManager::new(BackendType::AesGcm)?;
//     // ...
// }

// ============================================================================
// Test Suite 4: Round-Trip Integration Tests
// ============================================================================

#[tokio::test]
async fn test_full_workflow_store_resolve_delete() -> Result<()> {
    // Specification: Complete workflow from storage to reference resolution
    let manager = SecretManager::new(BackendType::Keyring)?;

    // 1. Store secret with hierarchical key
    manager.store_secret("anthropic/api_key", "sk-ant-workflow-test").await?;

    // 2. Resolve vault reference (as provider would do)
    let api_key = manager.resolve("vault://anthropic/api_key").await?;
    assert_eq!(api_key, "sk-ant-workflow-test");

    // 3. Verify direct access also works
    let direct = manager.get_secret("anthropic/api_key").await?;
    assert_eq!(direct, "sk-ant-workflow-test");

    // 4. Delete and verify cleanup
    manager.delete_secret("anthropic/api_key").await?;
    let result = manager.resolve("vault://anthropic/api_key").await;
    assert!(result.is_err(), "Should not resolve deleted secret");

    Ok(())
}

#[tokio::test]
async fn test_multiple_providers_isolation() -> Result<()> {
    // Specification: Secrets for different providers should be isolated
    let manager = SecretManager::new(BackendType::Keyring)?;

    // Store keys for multiple providers
    manager.store_secret("anthropic/api_key", "anthropic-key").await?;
    manager.store_secret("openai/api_key", "openai-key").await?;
    manager.store_secret("cohere/api_key", "cohere-key").await?;

    // Resolve each independently
    assert_eq!(
        manager.resolve("vault://anthropic/api_key").await?,
        "anthropic-key"
    );
    assert_eq!(
        manager.resolve("vault://openai/api_key").await?,
        "openai-key"
    );
    assert_eq!(
        manager.resolve("vault://cohere/api_key").await?,
        "cohere-key"
    );

    // Cleanup
    manager.delete_secret("anthropic/api_key").await?;
    manager.delete_secret("openai/api_key").await?;
    manager.delete_secret("cohere/api_key").await?;

    Ok(())
}

#[tokio::test]
async fn test_manager_backend_availability() -> Result<()> {
    // Specification: Manager should expose backend availability check
    let manager = SecretManager::new(BackendType::Keyring)?;

    let is_available = manager.is_backend_available().await;
    println!("Backend available: {}", is_available);

    // Should return boolean without panicking
    Ok(())
}

#[tokio::test]
async fn test_manager_backend_name() -> Result<()> {
    // Specification: Manager should expose backend name
    let manager = SecretManager::new(BackendType::Keyring)?;

    let name = manager.backend_name();
    assert_eq!(name, "system-keyring");

    Ok(())
}

// ============================================================================
// Test Suite 5: Error Message Quality
// ============================================================================

#[tokio::test]
async fn test_error_message_for_missing_secret() -> Result<()> {
    // Specification: Error messages should be helpful for debugging
    let manager = SecretManager::new(BackendType::Keyring)?;

    let result = manager.resolve("vault://missing/secret").await;
    assert!(result.is_err());

    let error = result.unwrap_err();
    let error_msg = format!("{}", error);

    // Error should mention which key was not found
    assert!(
        error_msg.contains("missing/secret") || error_msg.contains("not found"),
        "Error message should be informative: {}",
        error_msg
    );

    Ok(())
}

#[tokio::test]
async fn test_error_message_for_invalid_reference() -> Result<()> {
    // Specification: Invalid vault references should have clear errors
    let manager = SecretManager::new(BackendType::Keyring)?;

    let result = manager.resolve("invalid-reference").await;
    assert!(result.is_err());

    let error = result.unwrap_err();
    let error_msg = format!("{}", error);

    // Error should mention vault:// format
    assert!(
        error_msg.contains("vault://") || error_msg.contains("Invalid"),
        "Error should explain vault:// format: {}",
        error_msg
    );

    Ok(())
}
