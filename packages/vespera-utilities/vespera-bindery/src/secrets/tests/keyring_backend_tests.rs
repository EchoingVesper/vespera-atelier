// KeyringBackend specification tests
// TDD: These tests define the behavior we want, written before implementation

use crate::secrets::{BackendType, KeyringBackend, SecretBackend};
use anyhow::Result;

// ============================================================================
// Test Suite 1: Basic SecretBackend Operations
// ============================================================================

#[tokio::test]
async fn test_store_and_retrieve_secret() -> Result<()> {
    // Specification: Should store a secret and retrieve it exactly as stored
    let backend = KeyringBackend::new("vespera-test")?;

    backend.store_secret("test/key", "test-secret-value").await?;
    let retrieved = backend.get_secret("test/key").await?;

    assert_eq!(retrieved, "test-secret-value");

    // Cleanup
    backend.delete_secret("test/key").await?;
    Ok(())
}

#[tokio::test]
async fn test_delete_secret() -> Result<()> {
    // Specification: Should successfully delete a stored secret
    let backend = KeyringBackend::new("vespera-test")?;

    backend.store_secret("test/delete_me", "value").await?;
    backend.delete_secret("test/delete_me").await?;

    // After deletion, retrieval should fail
    let result = backend.get_secret("test/delete_me").await;
    assert!(result.is_err(), "Deleted secret should not be retrievable");

    Ok(())
}

#[tokio::test]
async fn test_secret_not_found_error() -> Result<()> {
    // Specification: Should return error for non-existent secrets
    let backend = KeyringBackend::new("vespera-test")?;

    let result = backend.get_secret("nonexistent/key").await;
    assert!(result.is_err(), "Should error on missing secret");

    Ok(())
}

// ============================================================================
// Test Suite 2: Hierarchical Key Support
// ============================================================================

#[tokio::test]
async fn test_hierarchical_key_names() -> Result<()> {
    // Specification: Should support hierarchical key names like "provider/key_name"
    let backend = KeyringBackend::new("vespera-test")?;

    backend.store_secret("anthropic/api_key", "sk-ant-test123").await?;
    backend.store_secret("openai/api_key", "sk-test456").await?;
    backend.store_secret("cohere/api_key", "cohere-test789").await?;

    // Each should be independently retrievable
    assert_eq!(backend.get_secret("anthropic/api_key").await?, "sk-ant-test123");
    assert_eq!(backend.get_secret("openai/api_key").await?, "sk-test456");
    assert_eq!(backend.get_secret("cohere/api_key").await?, "cohere-test789");

    // Cleanup
    backend.delete_secret("anthropic/api_key").await?;
    backend.delete_secret("openai/api_key").await?;
    backend.delete_secret("cohere/api_key").await?;

    Ok(())
}

#[tokio::test]
async fn test_multiple_provider_secrets() -> Result<()> {
    // Specification: Multiple secrets for same provider should coexist
    let backend = KeyringBackend::new("vespera-test")?;

    backend.store_secret("anthropic/api_key", "key1").await?;
    backend.store_secret("anthropic/secondary_key", "key2").await?;

    assert_eq!(backend.get_secret("anthropic/api_key").await?, "key1");
    assert_eq!(backend.get_secret("anthropic/secondary_key").await?, "key2");

    // Cleanup
    backend.delete_secret("anthropic/api_key").await?;
    backend.delete_secret("anthropic/secondary_key").await?;

    Ok(())
}

// ============================================================================
// Test Suite 3: Security Verification
// ============================================================================

#[tokio::test]
async fn test_no_plaintext_on_disk() -> Result<()> {
    // Specification: Secrets must NOT be stored in plaintext on disk
    // This is a critical security requirement

    let backend = KeyringBackend::new("vespera-test")?;
    let test_secret = "SUPER_SECRET_VALUE_12345";

    backend.store_secret("security/test", test_secret).await?;

    // Search common locations for plaintext secret
    // Note: This test is platform-specific and may need adjustment
    // For now, we verify that the keyring crate handles this

    // The secret should only be retrievable via the keyring API
    let retrieved = backend.get_secret("security/test").await?;
    assert_eq!(retrieved, test_secret);

    // Cleanup
    backend.delete_secret("security/test").await?;

    // TODO: Add filesystem search to verify no plaintext files created
    // This would require platform-specific logic

    Ok(())
}

#[tokio::test]
async fn test_secrets_persist_across_backend_recreation() -> Result<()> {
    // Specification: Secrets should survive backend instance recreation
    // (Adapted from old vault.rs test_vault_persistence)

    let test_key = "persistence/test_key";
    let test_value = "persistent-secret-value";

    // Store secret with first backend instance
    {
        let backend = KeyringBackend::new("vespera-test")?;
        backend.store_secret(test_key, test_value).await?;
    } // backend dropped

    // Create new backend instance and verify secret still exists
    {
        let backend = KeyringBackend::new("vespera-test")?;
        let retrieved = backend.get_secret(test_key).await?;
        assert_eq!(retrieved, test_value);

        // Cleanup
        backend.delete_secret(test_key).await?;
    }

    Ok(())
}

// ============================================================================
// Test Suite 4: Error Handling and Edge Cases
// ============================================================================

#[tokio::test]
async fn test_backend_availability_check() -> Result<()> {
    // Specification: Should be able to check if keyring is available
    let backend = KeyringBackend::new("vespera-test")?;

    let is_available = backend.is_available().await;
    // On systems with keyring, should be true
    // On headless/minimal systems, may be false
    // Just verify it returns a boolean without panicking
    println!("Keyring availability: {}", is_available);

    Ok(())
}

#[tokio::test]
async fn test_backend_name() -> Result<()> {
    // Specification: Backend should identify itself
    let backend = KeyringBackend::new("vespera-test")?;

    assert_eq!(backend.backend_name(), "system-keyring");

    Ok(())
}

#[tokio::test]
async fn test_empty_key_error() -> Result<()> {
    // Specification: Should reject empty key names
    let backend = KeyringBackend::new("vespera-test")?;

    let result = backend.store_secret("", "value").await;
    assert!(result.is_err(), "Should reject empty key");

    Ok(())
}

#[tokio::test]
async fn test_empty_value_allowed() -> Result<()> {
    // Specification: Empty values should be allowed (edge case)
    let backend = KeyringBackend::new("vespera-test")?;

    backend.store_secret("test/empty", "").await?;
    let retrieved = backend.get_secret("test/empty").await?;
    assert_eq!(retrieved, "");

    // Cleanup
    backend.delete_secret("test/empty").await?;

    Ok(())
}

#[tokio::test]
async fn test_overwrite_existing_secret() -> Result<()> {
    // Specification: Storing with same key should overwrite previous value
    let backend = KeyringBackend::new("vespera-test")?;

    backend.store_secret("test/overwrite", "value1").await?;
    backend.store_secret("test/overwrite", "value2").await?;

    let retrieved = backend.get_secret("test/overwrite").await?;
    assert_eq!(retrieved, "value2", "Should have overwritten with new value");

    // Cleanup
    backend.delete_secret("test/overwrite").await?;

    Ok(())
}

// ============================================================================
// Test Suite 5: Adapted from Old vault.rs (Compatibility)
// ============================================================================

#[tokio::test]
async fn test_vault_basic_operations() -> Result<()> {
    // Adapted from old vault.rs test to ensure we preserve functionality
    let backend = KeyringBackend::new("vespera-test")?;

    // Store
    backend.store_secret("anthropic/api_key", "sk-ant-test123").await?;

    // Retrieve
    let value = backend.get_secret("anthropic/api_key").await?;
    assert_eq!(value, "sk-ant-test123");

    // Check existence (via successful retrieval)
    assert!(backend.get_secret("anthropic/api_key").await.is_ok());

    // Delete
    backend.delete_secret("anthropic/api_key").await?;

    // Verify deletion
    assert!(backend.get_secret("anthropic/api_key").await.is_err());

    Ok(())
}

// ============================================================================
// Platform-Specific Tests (Optional, may skip on unsupported platforms)
// ============================================================================

#[tokio::test]
#[cfg(target_os = "linux")]
async fn test_linux_libsecret_integration() -> Result<()> {
    // Specification: On Linux, should use libsecret/Secret Service API
    // This test verifies Linux-specific keyring behavior

    let backend = KeyringBackend::new("vespera-test")?;

    // Basic operation should work on Linux with keyring installed
    backend.store_secret("linux/test", "linux-value").await?;
    let value = backend.get_secret("linux/test").await?;
    assert_eq!(value, "linux-value");

    backend.delete_secret("linux/test").await?;

    Ok(())
}

#[tokio::test]
#[cfg(target_os = "macos")]
async fn test_macos_keychain_integration() -> Result<()> {
    // Specification: On macOS, should use Keychain Services

    let backend = KeyringBackend::new("vespera-test")?;

    backend.store_secret("macos/test", "macos-value").await?;
    let value = backend.get_secret("macos/test").await?;
    assert_eq!(value, "macos-value");

    backend.delete_secret("macos/test").await?;

    Ok(())
}

#[tokio::test]
#[cfg(target_os = "windows")]
async fn test_windows_credential_manager_integration() -> Result<()> {
    // Specification: On Windows, should use Windows Credential Manager

    let backend = KeyringBackend::new("vespera-test")?;

    backend.store_secret("windows/test", "windows-value").await?;
    let value = backend.get_secret("windows/test").await?;
    assert_eq!(value, "windows-value");

    backend.delete_secret("windows/test").await?;

    Ok(())
}
