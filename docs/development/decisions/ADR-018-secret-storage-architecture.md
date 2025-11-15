# ADR-018: Secret Storage Architecture

**Status**: Accepted ✅
**Date**: 2025-11-15
**Related Phase**: [Phase 17.5: Provider System Reconciliation](../phases/PHASE_17.5_PLAN.md)
**Related PR**: #85 - Scriptorium Backend Improvements and LLM Provider Module
**Supersedes**: None
**Related**: [ADR-017: Provider System Unification](./ADR-017-provider-system-unification.md)

---

## Context and Problem Statement

LLM providers require API keys and authentication secrets that must be stored securely. PR #85 introduced a vault system for secret storage, but with a **critical security vulnerability**:

```rust
// vault.rs:60-80
// TODO: Implement actual decryption here
// For now, secrets are stored in plaintext (Base64 encoded)
```

**The Problem**: How do we securely store API keys for Claude, Anthropic, OpenAI, and Ollama providers without exposing them in plaintext files?

**Risk Assessment**:
- **Severity**: HIGH - API keys provide full account access
- **Likelihood**: HIGH - Filesystem access = immediate compromise
- **Impact**: Account takeover, unauthorized API usage, financial loss

---

## Decision Drivers

1. **Security First** - No plaintext or reversible encoding (Base64)
2. **Cross-Platform** - Linux, macOS, Windows support
3. **User Experience** - Minimal friction for developers
4. **Flexibility** - Support multiple security models
5. **Future-Proof** - Pluggable architecture for new backends

---

## Considered Options

### Option A: System Keyring (OS-Native) ⭐ PRIORITY
**Approach**: Use operating system's native credential storage

**Implementation**:
- **Linux**: libsecret / Secret Service API
- **macOS**: Keychain
- **Windows**: Windows Credential Manager
- **Rust crate**: `keyring` (cross-platform abstraction)

**Pros**:
- ✅ **Most Secure**: OS-level encryption, hardware-backed on some systems
- ✅ **Zero Config**: No key management by user
- ✅ **Standard Practice**: Used by git, npm, docker, etc.
- ✅ **Cross-Platform**: Single API for all OS
- ✅ **Battle-Tested**: `keyring` crate well-maintained

**Cons**:
- ⚠️ Requires OS keyring to be set up (usually automatic)
- ⚠️ Headless servers may need manual setup
- ⚠️ Different UX per platform (password prompts vary)

**Example Code**:
```rust
use keyring::Entry;

let entry = Entry::new("vespera-bindery", "anthropic-api-key")?;
entry.set_password("sk-ant-...")?;
let api_key = entry.get_password()?;
```

### Option B: Age Encryption
**Approach**: Modern, simple encryption using age standard

**Implementation**:
- **Rust crate**: `age`
- **Key Derivation**: User password → age key
- **Storage**: Encrypted file in `.vespera/secrets/`

**Pros**:
- ✅ Simple, modern encryption standard
- ✅ Works on all platforms including headless
- ✅ Human-readable format
- ✅ Strong cryptography (X25519, ChaCha20-Poly1305)

**Cons**:
- ⚠️ User must remember encryption password
- ⚠️ Password lost = secrets lost
- ⚠️ Manual key rotation needed
- ⚠️ Not OS-integrated

**Example Code**:
```rust
use age::secrecy::Secret;
use age::Encryptor;

let passphrase = Secret::new(b"user-password".to_vec());
let encryptor = Encryptor::with_user_passphrase(passphrase);
// Encrypt secret...
```

### Option C: AES-256-GCM with Key Derivation
**Approach**: Industry-standard symmetric encryption

**Implementation**:
- **Rust crates**: `aes-gcm`, `argon2`
- **Key Derivation**: Workspace-specific salt + password → AES key
- **Storage**: Encrypted file with IV and auth tag

**Pros**:
- ✅ Industry standard algorithm
- ✅ Flexible key management
- ✅ Works everywhere including headless
- ✅ NIST-approved

**Cons**:
- ⚠️ More complex implementation
- ⚠️ Must manage IVs, salts, auth tags
- ⚠️ User password management required
- ⚠️ Higher risk of implementation bugs

**Example Code**:
```rust
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, NewAead};

let key = Key::from_slice(derived_key);
let cipher = Aes256Gcm::new(key);
let ciphertext = cipher.encrypt(&nonce, plaintext.as_ref())?;
```

---

## Decision Outcome

**Chosen Approach**: **Pluggable Backend System** with prioritized implementation

**Rationale** (user decision):
> "Let's do plan on supporting all three options here. We'll implement whichever is simplest first, and make documents for tasks to add the other types later."

### Implementation Priority

**Phase 17.5** (Immediate):
1. ✅ **System Keyring** (Option A) - Simplest, most secure, best UX

**Future Phases** (Documented Tasks):
2. ⏳ **Age Encryption** (Option B) - For headless/server deployments
3. ⏳ **AES-256-GCM** (Option C) - For maximum control/flexibility

### Pluggable Architecture

**Design**: Abstract `SecretBackend` trait with multiple implementations

```rust
#[async_trait]
pub trait SecretBackend: Send + Sync {
    /// Store a secret securely
    async fn store_secret(&self, key: &str, value: &str) -> Result<()>;

    /// Retrieve a stored secret
    async fn get_secret(&self, key: &str) -> Result<String>;

    /// Delete a secret
    async fn delete_secret(&self, key: &str) -> Result<()>;

    /// List all stored secret keys
    async fn list_secrets(&self) -> Result<Vec<String>>;

    /// Backend name for UI display
    fn backend_name(&self) -> &str;

    /// Check if backend is available on this system
    async fn is_available(&self) -> bool;
}

pub struct KeyringBackend { ... }
pub struct AgeBackend { ... }
pub struct AesGcmBackend { ... }
```

**Configuration**: Users choose backend via Bindery configuration

```json5
// .vespera/config.json5
{
    secret_backend: "keyring", // or "age", "aes-gcm"
    // Backend-specific config...
}
```

---

## Pros and Cons of Chosen Option

### Pros ✅

**Security**:
- OS keyring provides hardware-backed encryption when available
- Each backend uses industry-standard cryptography
- No reversible encoding (Base64) anywhere

**Flexibility**:
- Users can choose security model that fits their deployment
- Headless servers can use age or AES instead of keyring
- Easy to add new backends in future

**User Experience**:
- System keyring "just works" for most users
- Advanced users have control via other backends
- Clear migration path from insecure Base64

**Development**:
- Pluggable design is testable (mock backends)
- Can implement incrementally
- Single interface for all storage code

### Cons ⚠️

**Complexity**:
- More code to maintain than single backend
- Configuration options may confuse users
- Testing matrix grows (3 backends × 3 OS)

**Implementation Time**:
- Phase 17.5 only implements keyring
- Other backends deferred to future work
- Need to document limitations clearly

**Migration**:
- Users with Base64 secrets must re-enter keys
- No automatic migration possible (Base64 not encrypted)

---

## Implementation Details

### Phase 17.5: System Keyring (Week 1)

**Dependencies**:
```toml
[dependencies]
keyring = "3.0" # Cross-platform keyring access
anyhow = "1.0"  # Error handling
async-trait = "0.1"
```

**Code Structure**:
```
packages/vespera-utilities/vespera-bindery/src/
├── secrets/
│   ├── mod.rs          # SecretBackend trait
│   ├── keyring.rs      # KeyringBackend implementation
│   ├── age.rs          # AgeBackend (TODO - future)
│   ├── aes_gcm.rs      # AesGcmBackend (TODO - future)
│   └── manager.rs      # SecretManager (facade)
```

**Example Usage**:
```rust
// In provider code
let secret_manager = SecretManager::new(BackendType::Keyring)?;
secret_manager.store_secret("anthropic-api-key", "sk-ant-...")?;

// Later...
let api_key = secret_manager.get_secret("anthropic-api-key")?;
```

### Future Implementations

**Age Backend** (Future Phase):
- GitHub issue: "Implement age encryption backend for secret storage"
- Dependencies: `age`, `secrecy`
- Use case: Headless servers, CI/CD environments
- Estimated: 8-12 hours

**AES-GCM Backend** (Future Phase):
- GitHub issue: "Implement AES-256-GCM backend for secret storage"
- Dependencies: `aes-gcm`, `argon2`
- Use case: Maximum control, custom key management
- Estimated: 12-16 hours

---

## Migration from Insecure Base64

### Problem Statement

**Current State** (PR #85):
```rust
// vault.rs - INSECURE
let encoded = base64::encode(secret); // ❌ NOT ENCRYPTION
save_to_file(encoded)?;
```

**User Decision**:
> "The secret handling has never been used by anyone, including me, the only human dev on this project. There's nothing to transfer."

### Migration Strategy

**Approach**: **No Migration Needed** - Fresh Implementation

**Actions**:
1. **Remove Old Code**: Delete insecure `vault.rs` from PR #85
2. **Implement New**: System keyring from scratch
3. **No Data Migration**: No existing secrets to transfer
4. **Documentation**: Warn users NOT to use Base64 approach

**If secrets existed** (they don't):
- Warn users: "Previous secrets stored insecurely, please re-enter"
- Provide CLI tool: `bindery-cli secrets migrate`
- Manual re-entry required (cannot decrypt Base64 safely)

---

## Security Considerations

### Threat Model

**Threats Mitigated**:
1. ✅ **File System Access** - Encrypted/keyring-stored secrets not readable
2. ✅ **Memory Dumps** - Secrets cleared from memory after use
3. ✅ **Source Control Leaks** - No secrets in git repositories
4. ✅ **Log File Exposure** - Secrets never logged in plaintext

**Remaining Threats** (Out of Scope):
- ⚠️ **Process Memory Scanning** - In-memory secrets vulnerable to advanced attacks
- ⚠️ **Compromised OS** - If OS is compromised, keyring may be too
- ⚠️ **Physical Access** - Unlocked workstation gives keyring access
- ⚠️ **Supply Chain** - Malicious dependencies could exfiltrate secrets

### Best Practices

**For System Keyring**:
1. Use OS-level authentication (biometrics, password) when possible
2. Never bypass keyring prompts programmatically
3. Clear secrets from memory immediately after use
4. Log access attempts (without secret values)

**For Age/AES-GCM**:
1. Use strong password (16+ characters, random)
2. Store encryption key separately from encrypted data
3. Rotate keys periodically
4. Never commit key files to source control

**For All Backends**:
1. Principle of least privilege (minimal secret scope)
2. Audit trail for secret access
3. Automatic expiration/rotation where possible
4. Documentation of secret lifecycle

---

## Testing Strategy

### Security Tests

**System Keyring**:
```rust
#[test]
fn test_keyring_roundtrip() {
    let backend = KeyringBackend::new("vespera-test")?;
    backend.store_secret("test-key", "secret-value")?;
    let retrieved = backend.get_secret("test-key")?;
    assert_eq!(retrieved, "secret-value");
    backend.delete_secret("test-key")?;
}

#[test]
fn test_secret_not_in_plaintext() {
    let backend = KeyringBackend::new("vespera-test")?;
    backend.store_secret("test", "super-secret")?;

    // Search disk for plaintext secret (should NOT find it)
    let plaintext_found = search_disk_for_string("super-secret");
    assert!(!plaintext_found, "Secret found in plaintext on disk!");
}
```

**Age/AES-GCM** (Future):
```rust
#[test]
fn test_encryption_strength() {
    // Verify encrypted data is not trivially reversible
    // Verify key derivation uses sufficient iterations
    // Verify IV/nonce uniqueness
}
```

### Integration Tests

```rust
#[tokio::test]
async fn test_provider_with_keyring_secrets() {
    let secret_manager = SecretManager::new(BackendType::Keyring)?;
    secret_manager.store_secret("anthropic-api-key", "sk-ant-test")?;

    let provider = AnthropicProvider::new(&secret_manager)?;
    // Provider should retrieve API key from keyring automatically
    assert!(provider.is_configured());
}
```

---

## Documentation Requirements

### User Documentation

**Setup Guide**: "Configuring Secret Storage"
- How to choose a backend
- Platform-specific keyring setup
- Troubleshooting access denied errors

**Security Guide**: "Secret Management Best Practices"
- Threat model explanation
- When to use which backend
- Key rotation procedures

**Migration Guide**: "Upgrading from Base64 (PR #85)"
- Why migration is required
- Step-by-step re-entry process
- Verification steps

### Developer Documentation

**ADR-018**: This document (architectural decision)

**API Documentation**:
```rust
/// SecretBackend trait - Abstract interface for secret storage
///
/// # Security
/// Implementations MUST:
/// - Encrypt secrets at rest
/// - Clear secrets from memory after use
/// - Never log secret values
/// - Use OS-appropriate security mechanisms
///
/// # Example
/// ```rust
/// let backend = KeyringBackend::new("my-app")?;
/// backend.store_secret("api-key", "sk-...")?;
/// let key = backend.get_secret("api-key")?;
/// ```
pub trait SecretBackend { ... }
```

---

## Alternatives Considered and Rejected

### Environment Variables Only
**Rejected because**: Not persistent, clutters shell config, visible in process lists

### Git-Crypt
**Rejected because**: Requires git repository, complex setup, not runtime-friendly

### HashiCorp Vault
**Rejected because**: Overkill for single-user desktop app, requires server

### Encrypted SQLite Extension
**Rejected because**: Adds dependency, key management still required

---

## Future Enhancements

### Phase 17.5+ (Documented as GitHub Issues)

1. **Age Backend Implementation** (#TBD)
   - Estimated: 8-12 hours
   - Priority: Medium (server deployments)
   - Dependencies: `age`, `secrecy` crates

2. **AES-GCM Backend Implementation** (#TBD)
   - Estimated: 12-16 hours
   - Priority: Low (advanced users)
   - Dependencies: `aes-gcm`, `argon2` crates

3. **Secret Rotation Tool** (#TBD)
   - CLI command: `bindery-cli secrets rotate`
   - Automatic key expiration
   - Rotation reminders

4. **Audit Logging** (#TBD)
   - Log all secret access (without values)
   - Detect unusual access patterns
   - Integration with observability system

5. **Hardware Security Module (HSM) Support** (#TBD)
   - For enterprise deployments
   - YubiKey integration
   - TPM-backed storage

---

## Links

### Related ADRs
- [ADR-017: Provider System Unification](./ADR-017-provider-system-unification.md) - Provider architecture
- [ADR-015: Workspace/Project/Context Hierarchy](./ADR-015-workspace-project-context-hierarchy.md) - Codex storage

### External Resources
- [OWASP Secret Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [keyring crate documentation](https://docs.rs/keyring/latest/keyring/)
- [age encryption format](https://age-encryption.org/)
- [NIST AES-GCM Guidelines](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)

### Code References
**Phase 17.5 Implementation**:
- `packages/vespera-utilities/vespera-bindery/src/secrets/mod.rs` - Trait definition
- `packages/vespera-utilities/vespera-bindery/src/secrets/keyring.rs` - System keyring backend
- `packages/vespera-utilities/vespera-bindery/src/secrets/manager.rs` - SecretManager facade

**PR #85 (TO BE REMOVED)**:
- `packages/vespera-utilities/vespera-bindery/src/llm/vault.rs` - ❌ INSECURE, delete this

---

*ADR created: 2025-11-15*
*Status: Accepted*
*Decision maker: Echoing Vesper (user)*
*Documented by: Claude Code (Sonnet 4.5)*
