// Integration test for secrets module
// This is a standalone test file that doesn't depend on broken test modules

use anyhow::Result;
use vespera_bindery::secrets::{BackendType, SecretManager, KeyringBackend, SecretBackend};

#[tokio::test]
async fn test_keyring_backend_store_and_retrieve() -> Result<()> {
    let backend = KeyringBackend::new("vespera-test")?;

    // Store a secret
    backend.store_secret("test/integration/key", "test-value").await?;

    // Retrieve it
    let value = backend.get_secret("test/integration/key").await?;
    assert_eq!(value, "test-value");

    // Cleanup
    backend.delete_secret("test/integration/key").await?;

    Ok(())
}

#[tokio::test]
async fn test_secret_manager_vault_resolution() -> Result<()> {
    let manager = SecretManager::new(BackendType::Keyring)?;

    // Store a secret
    manager.store_secret("anthropic/api_key", "sk-ant-test").await?;

    // Resolve vault reference
    let resolved = manager.resolve("vault://anthropic/api_key").await?;
    assert_eq!(resolved, "sk-ant-test");

    // Cleanup
    manager.delete_secret("anthropic/api_key").await?;

    Ok(())
}

#[tokio::test]
async fn test_invalid_vault_reference_format() -> Result<()> {
    let manager = SecretManager::new(BackendType::Keyring)?;

    // Test missing vault:// prefix
    let result = manager.resolve("anthropic/api_key").await;
    assert!(result.is_err(), "Should reject invalid reference format");

    // Test wrong prefix
    let result = manager.resolve("http://anthropic/api_key").await;
    assert!(result.is_err(), "Should reject non-vault:// prefix");

    Ok(())
}

#[tokio::test]
async fn test_backend_availability() -> Result<()> {
    let backend = KeyringBackend::new("vespera-test")?;

    let is_available = backend.is_available().await;
    println!("Backend available: {}", is_available);

    // Should return boolean without panicking
    Ok(())
}

#[tokio::test]
async fn test_multiple_providers_isolation() -> Result<()> {
    let manager = SecretManager::new(BackendType::Keyring)?;

    // Store keys for multiple providers
    manager.store_secret("anthropic/api_key", "anthropic-key").await?;
    manager.store_secret("openai/api_key", "openai-key").await?;

    // Resolve each independently
    assert_eq!(
        manager.resolve("vault://anthropic/api_key").await?,
        "anthropic-key"
    );
    assert_eq!(
        manager.resolve("vault://openai/api_key").await?,
        "openai-key"
    );

    // Cleanup
    manager.delete_secret("anthropic/api_key").await?;
    manager.delete_secret("openai/api_key").await?;

    Ok(())
}
