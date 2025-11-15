// System keyring backend implementation
// Uses OS-native secure storage (libsecret/Keychain/Credential Manager)

use super::SecretBackend;
use anyhow::Result;
use async_trait::async_trait;
use keyring::Entry;

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
    async fn store_secret(&self, key: &str, value: &str) -> Result<()> {
        let service_name = self.service_name.clone();
        let key = key.to_string();
        let value = value.to_string();

        // Run keyring operations in blocking thread pool to avoid tokio/dbus conflicts
        tokio::task::spawn_blocking(move || {
            let entry = Entry::new(&service_name, &key)?;
            entry.set_password(&value)?;
            Ok(())
        })
        .await?
    }

    async fn get_secret(&self, key: &str) -> Result<String> {
        let service_name = self.service_name.clone();
        let key = key.to_string();

        // Run keyring operations in blocking thread pool to avoid tokio/dbus conflicts
        tokio::task::spawn_blocking(move || {
            let entry = Entry::new(&service_name, &key)?;
            let password = entry.get_password()?;
            Ok(password)
        })
        .await?
    }

    async fn delete_secret(&self, key: &str) -> Result<()> {
        let service_name = self.service_name.clone();
        let key = key.to_string();

        // Run keyring operations in blocking thread pool to avoid tokio/dbus conflicts
        tokio::task::spawn_blocking(move || {
            let entry = Entry::new(&service_name, &key)?;
            entry.delete_credential()?;
            Ok(())
        })
        .await?
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
        let service_name = self.service_name.clone();

        // Run keyring operations in blocking thread pool to avoid tokio/dbus conflicts
        let result = tokio::task::spawn_blocking(move || {
            // Try to create a test entry to verify keyring functionality
            let test_key = "__vespera_keyring_test__";
            let test_value = "test";

            // Attempt to store, retrieve, and delete a test credential
            match Entry::new(&service_name, test_key) {
                Ok(entry) => {
                    // Try to set a password
                    if entry.set_password(test_value).is_err() {
                        return false;
                    }

                    // Try to retrieve it
                    if entry.get_password().is_err() {
                        return false;
                    }

                    // Try to delete it (cleanup)
                    let _ = entry.delete_credential();

                    true
                }
                Err(_) => false,
            }
        })
        .await;

        result.unwrap_or(false)
    }
}
