# Secret Storage Setup Guide

## Overview

Vespera Bindery uses **system keyring backend** for secure storage of sensitive credentials like API keys, tokens, and passwords. This ensures secrets are:

- **Never stored in plain text** configuration files
- **Never committed to Git** repositories
- **Platform-integrated** with OS-native secure storage
- **Encrypted at rest** using OS-provided mechanisms

## Platform-Specific Setup

### Linux

Linux systems use the **Secret Service API** provided by:
- GNOME Keyring (GNOME desktop environments)
- KWallet (KDE desktop environments)
- Other compatible secret service implementations

#### Prerequisites

**GNOME Keyring** (Ubuntu, Fedora, Debian with GNOME):
```bash
# Check if gnome-keyring is installed
dpkg -l | grep gnome-keyring

# Install if missing
sudo apt install gnome-keyring  # Ubuntu/Debian
sudo dnf install gnome-keyring  # Fedora
```

**KWallet** (KDE desktop environments):
```bash
# Check if kwallet is installed
dpkg -l | grep kwalletmanager

# Install if missing
sudo apt install kwalletmanager5  # Ubuntu/Debian
sudo dnf install kwalletmanager5  # Fedora
```

#### Verification

Test keyring access:
```bash
# Using secret-tool (GNOME Keyring)
secret-tool store --label='Test Secret' application vespera-test
# Enter a test password when prompted

# Retrieve the secret
secret-tool lookup application vespera-test

# Delete the test secret
secret-tool clear application vespera-test
```

#### Headless/Server Environments

For headless systems without a desktop environment, use **gnome-keyring daemon**:

```bash
# Install gnome-keyring
sudo apt install gnome-keyring

# Start keyring daemon (in your shell startup script)
eval $(gnome-keyring-daemon --start)
export SSH_AUTH_SOCK
export GNOME_KEYRING_CONTROL

# Create a default keyring
echo -n "your-keyring-password" | gnome-keyring-daemon --unlock
```

**Alternative**: Use environment variables for headless setups (less secure):
```bash
# Set secrets via environment (runtime only, not persistent)
export CLAUDE_API_KEY="your-api-key-here"
```

### macOS

macOS uses the native **Keychain** system.

#### Prerequisites

Keychain is built into macOS - no installation required.

#### Verification

Test keyring access:
```bash
# Store a test secret
security add-generic-password \
  -s "vespera-test" \
  -a "test-user" \
  -w "test-password" \
  -U

# Retrieve the secret
security find-generic-password \
  -s "vespera-test" \
  -a "test-user" \
  -w

# Delete the test secret
security delete-generic-password \
  -s "vespera-test" \
  -a "test-user"
```

#### Granting Access

The first time Vespera Bindery accesses the keychain, macOS will prompt for permission. Click **Always Allow** to avoid repeated prompts.

### Windows

Windows uses the **Credential Manager** system.

#### Prerequisites

Credential Manager is built into Windows - no installation required.

#### Verification

Test credential storage via PowerShell:
```powershell
# Store a test credential
cmdkey /generic:"vespera-test" /user:"test-user" /pass:"test-password"

# List stored credentials
cmdkey /list | Select-String "vespera"

# Delete the test credential
cmdkey /delete:"vespera-test"
```

Or via GUI:
1. Open **Control Panel** → **User Accounts** → **Credential Manager**
2. Click **Windows Credentials** → **Add a generic credential**
3. Enter "vespera-test" as the target name
4. View and manage credentials in the GUI

## Configuring Provider Secrets

### Claude Code CLI Provider

#### Interactive Setup (Recommended)

When configuring the Claude Code CLI provider for the first time, Vespera will prompt for your API key:

```bash
# Run provider setup
vespera-bindery setup-provider claude-code-cli

# You'll be prompted:
# Enter Claude API key: **********************
# API key stored securely in system keyring
```

The API key is stored under the service name: `vespera.provider.claude-code-cli`

#### Manual Configuration

Store the API key manually using platform tools:

**Linux (GNOME Keyring)**:
```bash
secret-tool store \
  --label='Claude API Key' \
  service 'vespera.provider.claude-code-cli' \
  username 'api-key'
# Enter your API key when prompted
```

**macOS**:
```bash
security add-generic-password \
  -s "vespera.provider.claude-code-cli" \
  -a "api-key" \
  -w "your-api-key-here" \
  -U
```

**Windows**:
```powershell
cmdkey /generic:"vespera.provider.claude-code-cli" `
  /user:"api-key" `
  /pass:"your-api-key-here"
```

#### Verification

Test that the provider can retrieve the API key:
```bash
# Run provider health check
vespera-bindery health-check claude-code-cli

# Expected output:
# ✓ Executable found: /usr/local/bin/claude
# ✓ API key retrieved from keyring
# ✓ Provider healthy
```

### Ollama Provider

Ollama typically runs locally without authentication. If you've configured authentication:

**Store Ollama credentials**:
```bash
# Linux (GNOME Keyring)
secret-tool store \
  --label='Ollama API Key' \
  service 'vespera.provider.ollama' \
  username 'api-key'

# macOS
security add-generic-password \
  -s "vespera.provider.ollama" \
  -a "api-key" \
  -w "your-api-key" \
  -U

# Windows
cmdkey /generic:"vespera.provider.ollama" /user:"api-key" /pass:"your-api-key"
```

## Security Best Practices

### 1. Never Commit Secrets

**DO NOT** store secrets in:
- Configuration files (`.json`, `.toml`, `.yaml`)
- Environment variable files (`.env`, `.envrc`)
- Git repositories (even private ones)
- Log files or debug output
- Documentation or examples

### 2. Use Strong Master Passwords

Your system keyring is only as secure as its master password:

- **Use a strong, unique password** for your keyring
- **Enable keyring auto-lock** after inactivity
- **Don't share keyring passwords** between systems

### 3. Rotate Secrets Regularly

Rotate API keys and tokens periodically:

```bash
# Update an existing secret (Linux)
secret-tool store \
  --label='Claude API Key' \
  service 'vespera.provider.claude-code-cli' \
  username 'api-key'
# Enter new API key when prompted

# Or via Vespera's provider setup
vespera-bindery setup-provider claude-code-cli --update
```

### 4. Audit Secret Access

Monitor which applications access your secrets:

**Linux**:
```bash
# View keyring access logs (if available)
journalctl -u gnome-keyring -f
```

**macOS**:
```bash
# Keychain access logs
log show --predicate 'process == "securityd"' --last 1h
```

**Windows**:
```powershell
# Event Viewer → Windows Logs → Security
# Filter for Event ID 5379 (Credential Manager access)
```

### 5. Backup Your Keyring

**Linux (GNOME Keyring)**:
```bash
# Backup keyring files (encrypted)
tar -czf keyring-backup.tar.gz ~/.local/share/keyrings/

# Restore from backup
tar -xzf keyring-backup.tar.gz -C ~/
```

**macOS**:
```bash
# Backup keychain via Keychain Access app
# File → Export Items → Save as .keychain file
```

**Windows**:
```powershell
# Use Windows Backup or export credentials manually via Credential Manager GUI
```

## Troubleshooting

### Secret Not Found

**Error**: `Failed to retrieve secret from keyring: No matching entry found`

**Cause**: Secret was never stored or service name mismatch.

**Solution**:
```bash
# List all stored secrets to verify service name
# Linux
secret-tool search service vespera

# macOS
security dump-keychain | grep vespera

# Windows
cmdkey /list | Select-String "vespera"

# Store the secret if missing
vespera-bindery setup-provider <provider-name>
```

### Permission Denied

**Error**: `Permission denied accessing keyring`

**Cause**: Keyring daemon not running or locked.

**Solution**:

**Linux**:
```bash
# Check if keyring daemon is running
ps aux | grep gnome-keyring-daemon

# Start if not running
eval $(gnome-keyring-daemon --start)

# Unlock the default keyring
echo -n "your-password" | gnome-keyring-daemon --unlock
```

**macOS**:
```bash
# Unlock keychain if locked
security unlock-keychain ~/Library/Keychains/login.keychain-db
```

### Keyring Not Available (Headless Systems)

**Error**: `No keyring backend available`

**Cause**: No desktop environment or keyring daemon on headless system.

**Solution**: Use environment variables as fallback (less secure):

```bash
# Create a .env file (DO NOT COMMIT)
cat > .vespera-secrets.env <<EOF
CLAUDE_API_KEY=your-api-key-here
OLLAMA_API_KEY=your-ollama-key-here
EOF

# Load secrets before running Vespera
source .vespera-secrets.env

# Secure the file
chmod 600 .vespera-secrets.env
```

**Better alternative**: Set up gnome-keyring daemon in headless mode (see Linux Headless section above).

### Cross-Platform Synchronization

**Problem**: Secrets don't sync between development machines.

**Solution**: Secrets are intentionally stored per-machine. To share across machines:

1. **Export secrets manually** on each machine
2. Use a **password manager** (1Password, Bitwarden) to store API keys
3. Copy secrets to each machine's keyring during setup

**DO NOT** sync keyring files directly - they're encrypted with machine-specific keys.

## Development Workflow

### Local Development

1. **Store secrets once** during initial setup
2. **Access automatically** in all Vespera sessions
3. **No environment variables needed** in shell startup files

### CI/CD Pipelines

For automated testing, use environment variables (secrets stored in CI system):

```yaml
# GitHub Actions example
env:
  CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
  OLLAMA_API_KEY: ${{ secrets.OLLAMA_API_KEY }}
```

### Team Collaboration

**Each team member**:
1. Gets their own API keys from provider dashboards
2. Stores keys in their local system keyring
3. Never shares keys via Slack, email, or Git

**For shared dev environments**:
- Use a dedicated "development" API key with limited permissions
- Store in the shared machine's keyring
- Rotate when team members leave

## Migration from Environment Variables

If you're currently using environment variables:

1. **Extract current secrets**:
   ```bash
   echo $CLAUDE_API_KEY
   echo $OLLAMA_API_KEY
   ```

2. **Store in keyring**:
   ```bash
   # Interactive setup
   vespera-bindery setup-provider claude-code-cli
   # Paste your API key when prompted
   ```

3. **Remove from environment**:
   ```bash
   # Edit ~/.bashrc, ~/.zshrc, or ~/.profile
   # Remove lines like:
   # export CLAUDE_API_KEY="..."

   # Reload shell
   source ~/.bashrc
   ```

4. **Delete .env files**:
   ```bash
   # DO NOT commit these!
   rm .env .env.local .vespera-secrets

   # Add to .gitignore
   echo "*.env" >> .gitignore
   echo ".vespera-secrets*" >> .gitignore
   ```

5. **Verify**:
   ```bash
   # Ensure environment is clean
   env | grep -i api_key  # Should return nothing

   # Test provider can still access secrets
   vespera-bindery health-check claude-code-cli
   ```

## Reference

### Keyring Service Names

Vespera uses the following service name pattern:

```
vespera.provider.<provider-type>
```

Examples:
- `vespera.provider.claude-code-cli`
- `vespera.provider.ollama`
- `vespera.provider.openai` (future)

### Supported Secret Fields

Providers may store multiple secrets:

| Field | Description | Example Service Name |
|-------|-------------|---------------------|
| `api_key` | API authentication key | `vespera.provider.claude-code-cli` |
| `api_secret` | API secret (for OAuth) | `vespera.provider.claude-code-cli.secret` |
| `oauth_token` | OAuth access token | `vespera.provider.claude-code-cli.oauth` |

Check provider template documentation for specific fields.

## Further Reading

- **Linux Secret Service API**: https://specifications.freedesktop.org/secret-service/
- **macOS Keychain**: https://developer.apple.com/documentation/security/keychain_services
- **Windows Credential Manager**: https://docs.microsoft.com/en-us/windows/win32/secauthn/credential-manager
- **Provider Configuration Guide**: [PROVIDER_CONFIGURATION.md](./PROVIDER_CONFIGURATION.md)
- **MCP-Bindery Architecture**: [../architecture/subsystems/MCP_BINDERY_ARCHITECTURE.md](../architecture/subsystems/MCP_BINDERY_ARCHITECTURE.md)
