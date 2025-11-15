// SecretManager facade for backend selection and vault reference resolution

use super::{BackendType, KeyringBackend, SecretBackend};
use anyhow::Result;

/// SecretManager provides a facade for secret storage with backend selection
///
/// # Example
/// ```rust,no_run
/// use vespera_bindery::secrets::{SecretManager, BackendType};
///
/// # async fn example() -> anyhow::Result<()> {
/// let manager = SecretManager::new(BackendType::Keyring)?;
///
/// // Store secret
/// manager.store_secret("anthropic/api_key", "sk-ant-...").await?;
///
/// // Resolve vault reference (as provider would do)
/// let api_key = manager.resolve("vault://anthropic/api_key").await?;
/// # Ok(())
/// # }
/// ```
pub struct SecretManager {
    backend: Box<dyn SecretBackend>,
}

impl SecretManager {
    /// Create new SecretManager with specified backend
    ///
    /// # Arguments
    /// * `backend_type` - Which backend to use (Keyring, Age, AesGcm)
    ///
    /// # Errors
    /// Returns error if backend initialization fails
    ///
    /// # Example
    /// ```rust,no_run
    /// use vespera_bindery::secrets::{SecretManager, BackendType};
    ///
    /// let manager = SecretManager::new(BackendType::Keyring)?;
    /// # Ok::<(), anyhow::Error>(())
    /// ```
    pub fn new(backend_type: BackendType) -> Result<Self> {
        let backend: Box<dyn SecretBackend> = match backend_type {
            BackendType::Keyring => Box::new(KeyringBackend::new("vespera-bindery")?),

            BackendType::Age => {
                anyhow::bail!("Age backend not yet implemented (see Issue #86)")
            }

            BackendType::AesGcm => {
                anyhow::bail!("AES-GCM backend not yet implemented (see Issue #87)")
            }
        };

        Ok(Self { backend })
    }

    /// Resolve vault reference to actual secret value
    ///
    /// # Arguments
    /// * `reference` - Vault reference in format "vault://provider/key_name"
    ///
    /// # Returns
    /// Actual secret value
    ///
    /// # Errors
    /// - Returns error if reference format is invalid
    /// - Returns error if secret not found
    ///
    /// # Example
    /// ```rust,no_run
    /// # use vespera_bindery::secrets::{SecretManager, BackendType};
    /// # async fn example() -> anyhow::Result<()> {
    /// # let manager = SecretManager::new(BackendType::Keyring)?;
    /// let api_key = manager.resolve("vault://anthropic/api_key").await?;
    /// // api_key = "sk-ant-abc123..."
    /// # Ok(())
    /// # }
    /// ```
    pub async fn resolve(&self, reference: &str) -> Result<String> {
        // TODO: Implement vault reference resolution
        unimplemented!("SecretManager::resolve - TDD stub: {}", reference)
    }

    /// Store a secret (delegates to backend)
    ///
    /// # Arguments
    /// * `key` - Hierarchical key (e.g., "anthropic/api_key")
    /// * `value` - Secret value
    pub async fn store_secret(&self, key: &str, value: &str) -> Result<()> {
        self.backend.store_secret(key, value).await
    }

    /// Retrieve a secret (delegates to backend)
    ///
    /// # Arguments
    /// * `key` - Hierarchical key to retrieve
    pub async fn get_secret(&self, key: &str) -> Result<String> {
        self.backend.get_secret(key).await
    }

    /// Delete a secret (delegates to backend)
    ///
    /// # Arguments
    /// * `key` - Hierarchical key to delete
    pub async fn delete_secret(&self, key: &str) -> Result<()> {
        self.backend.delete_secret(key).await
    }

    /// List all secret keys (delegates to backend)
    ///
    /// Note: May not be supported by all backends
    pub async fn list_secrets(&self) -> Result<Vec<String>> {
        self.backend.list_secrets().await
    }

    /// Get backend name
    pub fn backend_name(&self) -> &str {
        self.backend.backend_name()
    }

    /// Check if backend is available
    pub async fn is_backend_available(&self) -> bool {
        self.backend.is_available().await
    }
}
