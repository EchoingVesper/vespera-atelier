//! Secure storage for API keys and sensitive credentials
//!
//! Provides encrypted storage for LLM provider API keys with a simple
//! reference system (e.g., "vault://anthropic/api_key").

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::{debug, info, warn};

/// Vault for storing encrypted API keys and secrets
#[derive(Debug)]
pub struct SecretVault {
    vault_path: PathBuf,
    secrets: HashMap<String, String>,
}

/// Configuration for vault
#[derive(Debug, Serialize, Deserialize)]
struct VaultConfig {
    /// Map of key_path -> encrypted_value
    /// key_path format: "provider/key_name" (e.g., "anthropic/api_key")
    secrets: HashMap<String, String>,
}

impl SecretVault {
    /// Create or load a vault from the specified path
    pub async fn new(vault_dir: &Path) -> Result<Self> {
        let vault_path = vault_dir.join("secrets.json");

        // Create vault directory if it doesn't exist
        fs::create_dir_all(vault_dir)
            .await
            .context("Failed to create vault directory")?;

        let secrets = if vault_path.exists() {
            Self::load_vault(&vault_path).await?
        } else {
            info!("Creating new vault at {:?}", vault_path);
            HashMap::new()
        };

        Ok(Self {
            vault_path,
            secrets,
        })
    }

    /// Load vault from disk
    async fn load_vault(path: &Path) -> Result<HashMap<String, String>> {
        let content = fs::read_to_string(path)
            .await
            .context("Failed to read vault file")?;

        let config: VaultConfig =
            serde_json::from_str(&content).context("Failed to parse vault file")?;

        // TODO: Implement actual decryption here
        // For now, secrets are stored in plaintext (Base64 encoded)
        // In production, use something like age, gpg, or system keyring
        let secrets = config
            .secrets
            .into_iter()
            .map(|(k, v)| {
                use base64::Engine;
                let decoded = base64::engine::general_purpose::STANDARD
                    .decode(&v)
                    .unwrap_or_else(|_| v.into_bytes());
                (k, String::from_utf8_lossy(&decoded).to_string())
            })
            .collect();

        Ok(secrets)
    }

    /// Save vault to disk
    async fn save_vault(&self) -> Result<()> {
        // TODO: Implement actual encryption here
        // For now, secrets are Base64 encoded
        use base64::Engine;
        let encrypted_secrets: HashMap<String, String> = self
            .secrets
            .iter()
            .map(|(k, v)| {
                let encoded = base64::engine::general_purpose::STANDARD.encode(v.as_bytes());
                (k.clone(), encoded)
            })
            .collect();

        let config = VaultConfig {
            secrets: encrypted_secrets,
        };

        let content =
            serde_json::to_string_pretty(&config).context("Failed to serialize vault")?;

        fs::write(&self.vault_path, content)
            .await
            .context("Failed to write vault file")?;

        // Set restrictive permissions (Unix only)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&self.vault_path).await?.permissions();
            perms.set_mode(0o600); // Read/write for owner only
            fs::set_permissions(&self.vault_path, perms).await?;
        }

        debug!("Vault saved to {:?}", self.vault_path);
        Ok(())
    }

    /// Resolve a vault reference like "vault://anthropic/api_key"
    pub async fn resolve(&self, reference: &str) -> Result<String> {
        if !reference.starts_with("vault://") {
            return Err(anyhow::anyhow!("Invalid vault reference: {}", reference));
        }

        let key_path = reference
            .strip_prefix("vault://")
            .ok_or_else(|| anyhow::anyhow!("Invalid vault reference format"))?;

        self.secrets
            .get(key_path)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Secret not found in vault: {}", key_path))
    }

    /// Store a secret with the given key path
    pub async fn store(&mut self, key_path: impl Into<String>, value: impl Into<String>) -> Result<()> {
        let key_path = key_path.into();
        let value = value.into();

        info!("Storing secret: {}", key_path);

        self.secrets.insert(key_path.clone(), value);
        self.save_vault().await?;

        Ok(())
    }

    /// Delete a secret
    pub async fn delete(&mut self, key_path: &str) -> Result<bool> {
        let removed = self.secrets.remove(key_path).is_some();

        if removed {
            self.save_vault().await?;
        }

        Ok(removed)
    }

    /// List all secret keys (not values)
    pub fn list_keys(&self) -> Vec<String> {
        self.secrets.keys().cloned().collect()
    }

    /// Check if a secret exists
    pub fn contains(&self, key_path: &str) -> bool {
        self.secrets.contains_key(key_path)
    }
}

// Use base64 crate for encoding/decoding secrets
// (base64 is already in Cargo.toml)

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_vault_basic_operations() {
        let dir = tempdir().unwrap();
        let mut vault = SecretVault::new(dir.path()).await.unwrap();

        // Store a secret
        vault
            .store("anthropic/api_key", "sk-ant-test123")
            .await
            .unwrap();

        // Resolve it
        let value = vault.resolve("vault://anthropic/api_key").await.unwrap();
        assert_eq!(value, "sk-ant-test123");

        // Check it exists
        assert!(vault.contains("anthropic/api_key"));

        // List keys
        let keys = vault.list_keys();
        assert_eq!(keys, vec!["anthropic/api_key"]);

        // Delete it
        assert!(vault.delete("anthropic/api_key").await.unwrap());
        assert!(!vault.contains("anthropic/api_key"));
    }

    #[tokio::test]
    async fn test_vault_persistence() {
        let dir = tempdir().unwrap();

        // Create vault and store secret
        {
            let mut vault = SecretVault::new(dir.path()).await.unwrap();
            vault
                .store("openai/api_key", "sk-test456")
                .await
                .unwrap();
        }

        // Load vault again and check secret persisted
        {
            let vault = SecretVault::new(dir.path()).await.unwrap();
            let value = vault.resolve("vault://openai/api_key").await.unwrap();
            assert_eq!(value, "sk-test456");
        }
    }
}
