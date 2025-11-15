// System keyring backend implementation
// Uses OS-native secure storage (libsecret/Keychain/Credential Manager)

use super::SecretBackend;
use anyhow::Result;
use async_trait::async_trait;

/// System keyring backend
///
/// Uses OS-native secret storage:
/// - **Linux**: libsecret / Secret Service API
/// - **macOS**: Keychain Services
/// - **Windows**: Windows Credential Manager
///
/// # Service/Username Mapping
/// - Service: Provided service name (e.g., "vespera-bindery")
/// - Username: Hierarchical key (e.g., "anthropic/api_key")
pub struct KeyringBackend {
    service_name: String,
}

impl KeyringBackend {
    /// Create new keyring backend
    ///
    /// # Arguments
    /// * `service_name` - Name to use for keyring service (e.g., "vespera-bindery")
    ///
    /// # Example
    /// ```rust,no_run
    /// use vespera_bindery::secrets::KeyringBackend;
    ///
    /// let backend = KeyringBackend::new("vespera-bindery")?;
    /// # Ok::<(), anyhow::Error>(())
    /// ```
    pub fn new(service_name: impl Into<String>) -> Result<Self> {
        Ok(Self {
            service_name: service_name.into(),
        })
    }
}

#[async_trait]
impl SecretBackend for KeyringBackend {
    async fn store_secret(&self, _key: &str, _value: &str) -> Result<()> {
        // TODO: Implement actual keyring storage
        unimplemented!("KeyringBackend::store_secret - TDD stub")
    }

    async fn get_secret(&self, _key: &str) -> Result<String> {
        // TODO: Implement actual keyring retrieval
        unimplemented!("KeyringBackend::get_secret - TDD stub")
    }

    async fn delete_secret(&self, _key: &str) -> Result<()> {
        // TODO: Implement actual keyring deletion
        unimplemented!("KeyringBackend::delete_secret - TDD stub")
    }

    async fn list_secrets(&self) -> Result<Vec<String>> {
        // Keyring doesn't support listing natively
        // This is documented as "not supported" in ADR-018
        anyhow::bail!("Listing secrets not supported by system keyring")
    }

    fn backend_name(&self) -> &str {
        "system-keyring"
    }

    async fn is_available(&self) -> bool {
        // TODO: Implement availability check
        // Try to create a test entry to see if keyring works
        unimplemented!("KeyringBackend::is_available - TDD stub")
    }
}
