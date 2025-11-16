# Provider Configuration Guide

## Overview

Vespera Bindery uses a **template-driven provider system** that enables flexible LLM backend configuration without code changes. Providers are configured via JSON5 template files that define:

- **Connection parameters** (executable paths, API endpoints, ports)
- **Authentication** (API keys, tokens, credentials)
- **Model settings** (max tokens, temperature, context length)
- **Health checks** (validation commands and patterns)
- **UI configuration** (field labels, help text, validation rules)

## Quick Start

### Configuring Claude Code CLI

1. **Create provider configuration** from template:
   ```bash
   vespera-bindery create-provider \
     --template claude-code-cli \
     --name "My Claude Provider"
   ```

2. **Configure settings** interactively:
   ```
   Executable path [/usr/local/bin/claude]: /usr/local/bin/claude
   Model [claude-sonnet-4]: claude-sonnet-4
   Max tokens [4096]: 8192
   Temperature [0.7]: 0.7
   System prompt (optional): You are a helpful AI assistant.
   ```

3. **Store API key** securely:
   ```bash
   vespera-bindery setup-provider claude-code-cli
   # Enter Claude API key: **********************
   # API key stored securely in system keyring
   ```

4. **Verify health**:
   ```bash
   vespera-bindery health-check claude-code-cli
   # ✓ Executable found: /usr/local/bin/claude
   # ✓ API key retrieved from keyring
   # ✓ Provider healthy
   ```

### Configuring Ollama

1. **Create provider configuration**:
   ```bash
   vespera-bindery create-provider \
     --template ollama \
     --name "Local Ollama"
   ```

2. **Configure settings**:
   ```
   Base URL [http://localhost:11434]: http://localhost:11434
   Model [llama2]: codellama:latest
   Max tokens [2048]: 4096
   Temperature [0.7]: 0.5
   Context window [4096]: 8192
   ```

3. **Verify health**:
   ```bash
   vespera-bindery health-check ollama
   # ✓ Server reachable: http://localhost:11434
   # ✓ Model available: codellama:latest
   # ✓ Provider healthy
   ```

## Provider Templates

### Template Structure

Provider templates are JSON5 files in `templates/providers/`:

```json5
{
  // Template metadata
  templateId: "provider.claude-code-cli",
  name: "Claude Code CLI Provider",
  version: "1.0.0",
  category: "providers",
  description: "Anthropic Claude via official CLI",

  // Field definitions
  fields: {
    executable_path: {
      type: "string",
      label: "Executable Path",
      description: "Path to claude executable",
      default: "/usr/local/bin/claude",
      required: true,
      validation: {
        pattern: "^(/[^/]+)+$",
        message: "Must be absolute path"
      }
    },

    model: {
      type: "enum",
      label: "Model",
      description: "Claude model to use",
      values: [
        { value: "claude-sonnet-4", label: "Claude Sonnet 4 (Recommended)" },
        { value: "claude-opus-4", label: "Claude Opus 4" },
        { value: "claude-haiku-4", label: "Claude Haiku 4" }
      ],
      default: "claude-sonnet-4",
      required: true
    },

    api_key: {
      type: "secret",
      label: "API Key",
      description: "Anthropic API key",
      backend: "system-keyring",
      required: true
    },

    max_tokens: {
      type: "integer",
      label: "Max Tokens",
      description: "Maximum response length",
      default: 4096,
      min: 100,
      max: 200000
    },

    temperature: {
      type: "float",
      label: "Temperature",
      description: "Response randomness (0.0 - 1.0)",
      default: 0.7,
      min: 0.0,
      max: 1.0,
      step: 0.1
    }
  },

  // Health check configuration
  health_check: {
    command: ["{{executable_path}}", "--version"],
    expected_pattern: "claude",
    timeout_seconds: 5
  },

  // UI configuration
  ui: {
    icon: "anthropic",
    color: "#D97757",
    category_label: "Commercial LLMs",
    field_order: ["executable_path", "model", "api_key", "max_tokens", "temperature"]
  }
}
```

### Field Types

#### String Fields

```json5
field_name: {
  type: "string",
  label: "Display Label",
  description: "Help text",
  default: "default value",
  required: true,
  validation: {
    pattern: "^regex$",
    message: "Error message"
  }
}
```

**Use for**: File paths, URLs, identifiers, custom strings.

#### Integer Fields

```json5
field_name: {
  type: "integer",
  label: "Numeric Setting",
  default: 100,
  min: 1,
  max: 1000,
  step: 10
}
```

**Use for**: Token limits, port numbers, timeouts, batch sizes.

#### Float Fields

```json5
field_name: {
  type: "float",
  label: "Decimal Setting",
  default: 0.7,
  min: 0.0,
  max: 1.0,
  step: 0.1
}
```

**Use for**: Temperature, top_p, frequency penalty, confidence thresholds.

#### Boolean Fields

```json5
field_name: {
  type: "boolean",
  label: "Enable Feature",
  default: false
}
```

**Use for**: Feature toggles, streaming enabled, debug mode.

#### Enum Fields

```json5
field_name: {
  type: "enum",
  label: "Select Option",
  values: [
    { value: "option1", label: "Option One" },
    { value: "option2", label: "Option Two" }
  ],
  default: "option1"
}
```

**Use for**: Model selection, API versions, quality levels.

#### Secret Fields

```json5
field_name: {
  type: "secret",
  label: "API Key",
  backend: "system-keyring",  // or "env-var", "file"
  required: true
}
```

**Use for**: API keys, passwords, tokens, credentials.

**Backends**:
- `system-keyring`: OS-native secure storage (recommended)
- `env-var`: Environment variable (CI/CD, containers)
- `file`: Encrypted file (advanced use cases)

#### Text Fields

```json5
field_name: {
  type: "text",
  label: "Multi-line Text",
  description: "Supports newlines",
  default: "Line 1\nLine 2",
  max_length: 5000
}
```

**Use for**: System prompts, descriptions, multi-line configuration.

### Health Check Configuration

#### Command-Based

Execute a command to verify provider health:

```json5
health_check: {
  command: ["{{executable_path}}", "--version"],
  expected_pattern: "claude",
  timeout_seconds: 5
}
```

**Variables**: Use `{{field_name}}` to reference configured fields.

#### HTTP-Based

Check HTTP endpoint availability:

```json5
health_check: {
  method: "GET",
  url: "{{base_url}}/health",
  expected_status: 200,
  timeout_seconds: 3
}
```

#### Custom Script

Run a custom validation script:

```json5
health_check: {
  script: "scripts/check_provider.sh",
  args: ["{{base_url}}", "{{model}}"],
  expected_exit_code: 0
}
```

### UI Configuration

Control how the provider appears in the UI:

```json5
ui: {
  // Icon identifier (from icon library)
  icon: "anthropic",

  // Hex color for provider theme
  color: "#D97757",

  // Category for grouping providers
  category_label: "Commercial LLMs",

  // Field display order
  field_order: ["executable_path", "model", "api_key"],

  // Advanced fields (collapsed by default)
  advanced_fields: ["temperature", "max_tokens", "system_prompt"],

  // Help documentation URL
  help_url: "https://docs.vespera.dev/providers/claude-code-cli"
}
```

## Built-in Provider Templates

### Claude Code CLI

**Template**: `templates/providers/claude-code-cli.template.json5`

**Key Features**:
- Full tool calling support
- Streaming via stream-json format
- 200K token context window
- System prompt support

**Configuration**:
```bash
vespera-bindery create-provider --template claude-code-cli
```

**Fields**:
- `executable_path`: Path to `claude` CLI binary
- `model`: Claude model (sonnet-4, opus-4, haiku-4)
- `api_key`: Anthropic API key (stored in keyring)
- `max_tokens`: Response length limit (100-200000)
- `temperature`: Randomness (0.0-1.0)
- `system_prompt`: Optional system instructions

**Provider Capabilities**:
- ✅ Streaming
- ✅ Tool calling
- ✅ System prompts
- Max tokens: 4096 (default)
- Context: 200,000 tokens

### Ollama

**Template**: `templates/providers/ollama.template.json5`

**Key Features**:
- Local LLM deployment
- No authentication required
- Configurable models
- Streaming support

**Configuration**:
```bash
vespera-bindery create-provider --template ollama
```

**Fields**:
- `base_url`: Ollama server URL (default: http://localhost:11434)
- `model`: Model name (llama2, codellama, etc.)
- `api_endpoint`: API path (default: /api/generate)
- `max_tokens`: Response length limit
- `temperature`: Randomness
- `context_window`: Context length (4096-8192)

**Provider Capabilities**:
- ✅ Streaming
- ❌ Tool calling (model-dependent)
- ✅ System prompts
- Max tokens: 2048 (default)
- Context: 4,096-8,192 tokens (configurable)

## Creating Custom Provider Templates

### Step 1: Define Template Structure

Create a new JSON5 file in `templates/providers/`:

```bash
touch templates/providers/my-provider.template.json5
```

### Step 2: Define Metadata

```json5
{
  templateId: "provider.my-provider",
  name: "My Custom Provider",
  version: "1.0.0",
  category: "providers",
  description: "Custom LLM provider integration",
  author: "Your Name",
  license: "AGPL-3.0"
}
```

### Step 3: Define Fields

```json5
{
  // ... metadata ...

  fields: {
    // Connection settings
    api_endpoint: {
      type: "string",
      label: "API Endpoint",
      default: "https://api.example.com/v1/chat",
      required: true,
      validation: {
        pattern: "^https?://",
        message: "Must be valid HTTP(S) URL"
      }
    },

    // Authentication
    api_key: {
      type: "secret",
      label: "API Key",
      backend: "system-keyring",
      required: true
    },

    // Model settings
    model: {
      type: "enum",
      label: "Model",
      values: [
        { value: "model-v1", label: "Model V1 (Fast)" },
        { value: "model-v2", label: "Model V2 (Accurate)" }
      ],
      default: "model-v1"
    },

    // Generation parameters
    max_tokens: {
      type: "integer",
      label: "Max Tokens",
      default: 2048,
      min: 1,
      max: 32768
    }
  }
}
```

### Step 4: Configure Health Check

```json5
{
  // ... fields ...

  health_check: {
    method: "GET",
    url: "{{api_endpoint}}/health",
    headers: {
      "Authorization": "Bearer {{api_key}}"
    },
    expected_status: 200,
    timeout_seconds: 5
  }
}
```

### Step 5: Configure UI

```json5
{
  // ... health_check ...

  ui: {
    icon: "custom-provider",
    color: "#4A90E2",
    category_label: "Custom Providers",
    field_order: ["api_endpoint", "api_key", "model", "max_tokens"],
    advanced_fields: [],
    help_url: "https://docs.example.com/provider-setup"
  }
}
```

### Step 6: Implement Provider (Rust)

Create a new provider implementation in `src/providers/`:

```rust
// src/providers/my_provider.rs
use super::{Provider, ProviderResponse, StreamChunk, types::*};
use async_trait::async_trait;
use anyhow::Result;

pub struct MyProvider {
    api_endpoint: String,
    api_key: String,
    model: String,
    max_tokens: u32,
}

impl MyProvider {
    pub fn new(config: serde_json::Value) -> Result<Self> {
        Ok(Self {
            api_endpoint: config["api_endpoint"].as_str().unwrap().to_string(),
            api_key: config["api_key"].as_str().unwrap().to_string(),
            model: config["model"].as_str().unwrap_or("model-v1").to_string(),
            max_tokens: config["max_tokens"].as_u64().unwrap_or(2048) as u32,
        })
    }
}

#[async_trait]
impl Provider for MyProvider {
    async fn send_message(
        &self,
        message: &str,
        model: Option<&str>,
        session_id: Option<&str>,
        system_prompt: Option<&str>,
        stream: bool,
    ) -> Result<ProviderResponse> {
        // Implementation here
        todo!("Implement send_message")
    }

    async fn send_message_stream(
        &self,
        message: &str,
        model: Option<&str>,
        session_id: Option<&str>,
        system_prompt: Option<&str>,
    ) -> Result<Box<dyn futures::Stream<Item = Result<StreamChunk>> + Unpin + Send>> {
        // Implementation here
        todo!("Implement streaming")
    }

    async fn health_check(&self) -> Result<bool> {
        // Implementation here
        todo!("Implement health check")
    }

    fn provider_type(&self) -> &str {
        "my-provider"
    }

    fn display_name(&self) -> &str {
        "My Custom Provider"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_streaming: true,
            supports_tools: false,
            supports_system_prompt: true,
            max_tokens: self.max_tokens,
            max_context_length: 8192,
        }
    }
}
```

### Step 7: Register Provider

Add to `src/providers/mod.rs`:

```rust
pub mod my_provider;
pub use my_provider::MyProvider;
```

Update `src/providers/manager.rs` to load your provider:

```rust
match provider_type {
    "claude-code-cli" => { /* ... */ },
    "ollama" => { /* ... */ },
    "my-provider" => {
        let provider = MyProvider::new(config)?;
        Box::new(provider)
    },
    _ => return Err(anyhow!("Unknown provider type: {}", provider_type)),
}
```

### Step 8: Test Provider

```bash
# Create provider configuration
vespera-bindery create-provider --template my-provider

# Set up secrets
vespera-bindery setup-provider my-provider

# Test health check
vespera-bindery health-check my-provider

# Test sending a message
vespera-bindery test-provider my-provider "Hello!"
```

## Advanced Configuration

### Environment-Specific Overrides

Override defaults per environment:

```json5
{
  fields: {
    api_endpoint: {
      type: "string",
      default: "https://api.example.com/v1",
      overrides: {
        development: "http://localhost:3000",
        staging: "https://staging-api.example.com/v1",
        production: "https://api.example.com/v1"
      }
    }
  }
}
```

### Conditional Fields

Show/hide fields based on other field values:

```json5
{
  fields: {
    use_custom_endpoint: {
      type: "boolean",
      label: "Use Custom Endpoint",
      default: false
    },

    custom_endpoint: {
      type: "string",
      label: "Custom Endpoint URL",
      condition: "use_custom_endpoint == true",
      required: false
    }
  }
}
```

### Field Validation

Complex validation rules:

```json5
{
  fields: {
    api_key: {
      type: "secret",
      validation: {
        pattern: "^sk-[a-zA-Z0-9]{32}$",
        message: "API key must start with 'sk-' and be 32 characters",
        custom: {
          script: "scripts/validate_api_key.sh",
          error_message: "API key validation failed"
        }
      }
    }
  }
}
```

### Template Inheritance

Extend existing templates:

```json5
{
  templateId: "provider.my-custom-claude",
  extends: "provider.claude-code-cli",
  name: "Custom Claude Configuration",

  // Override specific fields
  fields: {
    model: {
      // Use parent definition, just change default
      default: "claude-opus-4"
    },

    custom_field: {
      type: "string",
      label: "My Custom Field",
      default: "custom value"
    }
  }
}
```

## Migration from Hardcoded Enums

### Before (Phase 17)

```rust
// Old: Hardcoded enum
pub enum ProviderType {
    ClaudeCodeCli,
    Ollama,
    // Adding new providers required code changes
}
```

### After (Phase 17.5)

```json5
// New: Template-driven
{
  templateId: "provider.new-provider",
  name: "New Provider",
  // ... configuration ...
}
```

**Benefits**:
- ✅ Add providers without recompiling
- ✅ User-defined custom providers
- ✅ Consistent configuration UI
- ✅ Portable configurations

### Migration Steps

1. **Export existing configuration**:
   ```bash
   vespera-bindery export-config --provider claude-code-cli > claude-config.json
   ```

2. **Create template from config**:
   ```bash
   vespera-bindery create-template \
     --from-config claude-config.json \
     --output templates/providers/my-claude.template.json5
   ```

3. **Verify template**:
   ```bash
   vespera-bindery validate-template templates/providers/my-claude.template.json5
   ```

4. **Apply template**:
   ```bash
   vespera-bindery create-provider --template my-claude
   ```

## Best Practices

### 1. Use Descriptive Field Labels

❌ **Bad**:
```json5
max_tok: { type: "integer", label: "MT" }
```

✅ **Good**:
```json5
max_tokens: {
  type: "integer",
  label: "Max Tokens",
  description: "Maximum length of model response in tokens"
}
```

### 2. Provide Sensible Defaults

```json5
temperature: {
  type: "float",
  default: 0.7,  // Balanced creativity/consistency
  min: 0.0,
  max: 1.0
}
```

### 3. Validate Inputs

```json5
api_key: {
  type: "secret",
  validation: {
    pattern: "^[a-zA-Z0-9_-]{32,}$",
    message: "API key must be at least 32 characters"
  }
}
```

### 4. Document Field Purpose

```json5
system_prompt: {
  type: "text",
  label: "System Prompt",
  description: "Instructions that define the model's behavior and personality. Optional.",
  placeholder: "You are a helpful AI assistant...",
  max_length: 5000
}
```

### 5. Group Related Fields

```json5
ui: {
  field_order: [
    // Connection
    "executable_path",
    "api_endpoint",

    // Authentication
    "api_key",

    // Model settings
    "model",
    "max_tokens",
    "temperature"
  ],
  advanced_fields: ["system_prompt", "stop_sequences"]
}
```

## Troubleshooting

### Template Validation Failed

**Error**: `Template validation failed: Missing required field 'templateId'`

**Solution**: Ensure all required metadata fields are present:
```json5
{
  templateId: "provider.my-provider",  // Required
  name: "My Provider",                 // Required
  version: "1.0.0",                    // Required
  category: "providers"                // Required
}
```

### Health Check Fails

**Error**: `Provider health check failed: Command not found`

**Solution**: Use absolute paths or check PATH:
```json5
health_check: {
  command: ["/usr/local/bin/my-cli", "--version"],  // Absolute path
  // or
  command: ["bash", "-c", "which my-cli && my-cli --version"]  // Check PATH
}
```

### Secret Not Retrieved

**Error**: `Failed to retrieve API key from keyring`

**Solution**: Store secret first:
```bash
vespera-bindery setup-provider my-provider
```

See [SECRET_STORAGE_SETUP.md](./SECRET_STORAGE_SETUP.md) for keyring configuration.

### Invalid Configuration

**Error**: `Invalid provider configuration: Field 'max_tokens' exceeds maximum value`

**Solution**: Check field constraints in template:
```json5
max_tokens: {
  type: "integer",
  min: 1,
  max: 200000,  // Check this limit
  default: 4096
}
```

## Reference

### Complete Template Schema

See `templates/providers/README.md` for the complete JSON5 schema and examples.

### Provider Trait Documentation

See Rust documentation:
```bash
cargo doc --open --package vespera-bindery
# Navigate to vespera_bindery::providers::Provider
```

### Example Provider Implementations

- **Claude Code CLI**: `src/providers/claude_code.rs`
- **Ollama**: `src/providers/ollama.rs`
- **Template Files**: `templates/providers/*.template.json5`

## Further Reading

- **Secret Storage Setup**: [SECRET_STORAGE_SETUP.md](./SECRET_STORAGE_SETUP.md)
- **MCP-Bindery Architecture**: [../architecture/subsystems/MCP_BINDERY_ARCHITECTURE.md](../architecture/subsystems/MCP_BINDERY_ARCHITECTURE.md)
- **Provider Types Reference**: `src/providers/types.rs` documentation
- **Template System**: `templates/providers/README.md`
