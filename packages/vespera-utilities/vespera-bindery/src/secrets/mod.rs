// Secret storage module with pluggable backends
// Implements ADR-018: Secret Storage Architecture

use anyhow::Result;
use async_trait::async_trait;

// Submodules
mod keyring;
mod manager;

#[cfg(test)]
mod tests;

// Public exports
pub use keyring::KeyringBackend;
pub use manager::SecretManager;

// ============================================================================
// SecretBackend Trait (from ADR-018)
// ============================================================================

/// Abstract interface for secret storage backends
///
/// # Security Requirements
/// Implementations MUST:
/// - Encrypt secrets at rest (no plaintext storage)
/// - Clear secrets from memory after use
/// - Never log secret values
/// - Use OS-appropriate security mechanisms
///
/// # Example
/// ```rust,no_run
/// use vespera_bindery::secrets::{SecretBackend, KeyringBackend};
///
/// # async fn example() -> anyhow::Result<()> {
/// let backend = KeyringBackend::new("my-app")?;
/// backend.store_secret("api-key", "sk-...").await?;
/// let key = backend.get_secret("api-key").await?;
/// # Ok(())
/// # }
/// ```
#[async_trait]
pub trait SecretBackend: Send + Sync {
    /// Store a secret securely
    ///
    /// If a secret with the same key already exists, it will be overwritten.
    ///
    /// # Arguments
    /// * `key` - Hierarchical key (e.g., "anthropic/api_key")
    /// * `value` - Secret value to store
    ///
    /// # Errors
    /// Returns error if storage operation fails (e.g., permission denied)
    async fn store_secret(&self, key: &str, value: &str) -> Result<()>;

    /// Retrieve a stored secret
    ///
    /// # Arguments
    /// * `key` - Hierarchical key to retrieve
    ///
    /// # Returns
    /// Secret value if found
    ///
    /// # Errors
    /// Returns error if secret not found or retrieval fails
    async fn get_secret(&self, key: &str) -> Result<String>;

    /// Delete a secret
    ///
    /// # Arguments
    /// * `key` - Hierarchical key to delete
    ///
    /// # Errors
    /// Returns error if deletion fails (secret not found is OK)
    async fn delete_secret(&self, key: &str) -> Result<()>;

    /// List all stored secret keys
    ///
    /// Note: Some backends may not support listing (e.g., system keyring).
    /// In that case, this method should return an error.
    ///
    /// # Returns
    /// Vec of all secret keys if supported
    ///
    /// # Errors
    /// Returns error if listing is not supported or fails
    async fn list_secrets(&self) -> Result<Vec<String>>;

    /// Backend name for UI display
    ///
    /// # Returns
    /// Human-readable backend name (e.g., "system-keyring", "age-encryption")
    fn backend_name(&self) -> &str;

    /// Check if backend is available on this system
    ///
    /// # Returns
    /// `true` if backend can be used, `false` otherwise
    async fn is_available(&self) -> bool;
}

// ============================================================================
// BackendType Enum
// ============================================================================

/// Available secret storage backends
///
/// See ADR-018 for implementation priorities:
/// 1. Keyring (Phase 17.5) - OS-native, most secure
/// 2. Age (Future) - For headless servers
/// 3. AesGcm (Future) - For maximum control
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackendType {
    /// System keyring (Linux: libsecret, macOS: Keychain, Windows: Credential Manager)
    Keyring,

    /// Age encryption (not yet implemented, see Issue #86)
    #[allow(dead_code)]
    Age,

    /// AES-256-GCM encryption (not yet implemented, see Issue #87)
    #[allow(dead_code)]
    AesGcm,
}
