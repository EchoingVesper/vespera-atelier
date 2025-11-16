# Provider Templates

This directory contains Codex template definitions for LLM provider configurations. These templates enable dynamic, template-driven provider configuration without hardcoded enums.

## Overview

Provider templates define the schema, validation rules, UI configuration, and capabilities for different LLM providers. This approach allows:

- **Dynamic Provider Types**: Add new providers without code changes
- **Schema Validation**: Ensure configurations conform to expected structure
- **UI Generation**: Auto-generate configuration interfaces from templates
- **Health Checks**: Validate provider setup before instantiation
- **Documentation**: Self-documenting provider capabilities and requirements

## Available Templates

### Claude Code CLI (`claude-code-cli.template.json5`)

**Provider**: Claude Code CLI
**Type**: `claude-code-cli`
**Vendor**: Anthropic
**Authentication**: CLI session (`claude login`)

**Capabilities**:
- ✅ Streaming
- ✅ Tool calling
- ✅ System prompts
- ✅ Vision (model-dependent)
- ✅ 200K context window

**Use Case**: Primary provider for Claude Max subscribers. No API key required, uses local CLI authentication.

**Configuration Fields**:
- `executable_path`: Path to claude CLI (default: `/usr/local/bin/claude`)
- `model`: Model selection (default: `claude-sonnet-4`)
- `system_prompt`: Optional system prompt override
- `max_tokens`: Response length limit (default: `4096`)
- `temperature`: Response randomness (default: `0.7`)
- `timeout`: Request timeout in seconds (default: `120`)

**Setup**:
```bash
# Install Claude CLI
brew install claude

# Authenticate
claude login

# Verify
claude --version
```

### Ollama (`ollama.template.json5`)

**Provider**: Ollama Local LLM Server
**Type**: `ollama`
**Vendor**: Ollama
**Authentication**: None (local server)

**Capabilities**:
- ✅ Streaming
- ❌ Tool calling (model-dependent, most don't support)
- ✅ System prompts
- ❌ Vision (model-dependent)
- ✅ 8K+ context window (model-dependent)

**Use Case**: Cost-effective, privacy-focused local inference. No API costs, runs entirely locally.

**Configuration Fields**:
- `base_url`: Ollama server URL (default: `http://localhost:11434`)
- `model`: Model name (default: `llama3.2`)
- `api_endpoint`: API endpoint path (default: `/api/generate`)
- `temperature`: Response randomness (default: `0.7`)
- `max_tokens`: Response length limit (default: `2048`)
- `context_window`: Model context size (default: `4096`)
- `timeout`: Request timeout (default: `120`)
- `keep_alive`: Model memory persistence (default: `5m`)

**Setup**:
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start server
ollama serve

# Pull a model
ollama pull llama3.2

# Verify
ollama list
```

## Template Structure

Each provider template follows the Vespera Codex template format:

```json5
{
  // Metadata
  template_id: "vespera.templates.provider.<type>",
  template_version: "1.0.0",
  template_name: "Provider Name",
  content_type: "vespera.provider",

  // Provider info
  provider_info: {
    provider_type: "provider-identifier",
    capabilities: { ... },
    models: [ ... ]
  },

  // Field definitions
  fields: {
    field_name: {
      type: "string",
      default: "value",
      ui_hints: { ... },
      validation: { ... }
    }
  },

  // UI configuration
  ui_configuration: {
    field_groups: { ... },
    layout_modes: { ... }
  },

  // Health checks
  health_checks: {
    check_name: { ... }
  },

  // Usage examples
  examples: [ ... ]
}
```

## Using Provider Templates

### 1. Create Provider Codex

Create a Codex instance conforming to a provider template:

```json5
{
  id: "provider_claude_code_001",
  template_id: "vespera.templates.provider.claude_code_cli",
  template_version: "1.0.0",
  content_type: "vespera.provider",

  title: "Claude Sonnet 4 - Default",
  description: "Primary Claude provider using CLI",

  content: {
    executable_path: "/usr/local/bin/claude",
    model: "claude-sonnet-4",
    max_tokens: 4096,
    temperature: 0.7
  }
}
```

### 2. Load via ProviderManager

The ProviderManager loads provider Codices from the database:

```rust
// ProviderManager automatically discovers provider Codices
let manager = ProviderManager::new(database);
manager.load_providers().await?;

// Use provider
let provider = manager.get_provider("provider_claude_code_001").await?;
let response = provider.send_message("Hello!", None, None, None, false).await?;
```

### 3. Template-Based Validation

```rust
// Future: Validate Codex against template schema
let template = load_template("claude-code-cli.template.json5")?;
let is_valid = template.validate_codex(&codex)?;
```

## Migration from ProviderType Enum

**Before** (hardcoded enum in `src/llm/provider.rs`):
```rust
pub enum ProviderType {
    ClaudeCode {
        model: String,
        cli_path: Option<String>,
        // ...
    },
    Ollama {
        model: String,
        endpoint: String,
    }
}
```

**After** (template-driven):
1. Provider configurations stored as Codex entries
2. Templates define schema and validation
3. ProviderManager loads dynamically from database
4. No hardcoded provider types in code

**Benefits**:
- ✅ Add new providers without code changes
- ✅ User-definable provider configurations
- ✅ Template versioning and migration support
- ✅ Consistent with Vespera's template-driven architecture
- ✅ Self-documenting via templates

## Future Providers

Additional provider templates can be created following the same pattern:

- **Anthropic API** (`anthropic-api.template.json5`): Direct API access with key
- **OpenAI API** (`openai.template.json5`): GPT models via API
- **Google Gemini** (`gemini.template.json5`): Google's LLM API
- **Custom Providers**: User-defined provider types

## Development

### Adding a New Provider Template

1. Create `templates/providers/<provider-type>.template.json5`
2. Define metadata, fields, UI config, and health checks
3. Update this README with provider documentation
4. Add corresponding provider implementation in `src/providers/`

### Template Validation

```bash
# Validate JSON5 syntax
node -e "require('json5').parse(require('fs').readFileSync('claude-code-cli.template.json5', 'utf8'))"

# Test provider loading
cargo test --test provider_template_tests
```

## See Also

- [Provider System Architecture](../../docs/architecture/subsystems/MCP_BINDERY_ARCHITECTURE.md)
- [Codex Template System](../../docs/architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md)
- [Phase 17.5 Plan](../../docs/development/phases/PHASE_17.5_PLAN.md)

---

**Template Architecture**: Phase 17.5 Task 7
**Status**: ✅ Complete
**Version**: 1.0.0
**Last Updated**: 2025-01-16
