/**
 * LLM Provider Configuration Template
 * Embedded template for LLM provider configuration
 */

export const LLM_PROVIDER_TEMPLATE = `{
  // LLM Provider Configuration Template
  // Defines configuration for various LLM providers (Claude Code, Ollama, Anthropic, OpenAI)

  template_id: "llm-provider",
  version: "1.0.0",
  name: "LLM Provider",
  description: "Configuration for LLM providers used by the AI chat system",
  icon: "🤖",
  color: "#7C3AED",

  // Tags for organization and automation
  tags: ["llm", "provider", "config"],

  // Template fields that will be filled in Codex instances
  fields: {
    provider_type: {
      type: "select",
      label: "Provider Type",
      description: "The LLM provider to use",
      required: true,
      default: "claude-code",
      options: [
        { value: "claude-code", label: "Claude Code CLI (Recommended - Uses Max Subscription)" },
        { value: "ollama", label: "Ollama (Local LLMs - Cost Free)" },
        { value: "anthropic", label: "Anthropic API (Paid - Direct API)" },
        { value: "openai", label: "OpenAI API (Paid - Direct API)" }
      ]
    },

    model: {
      type: "text",
      label: "Model Name",
      description: "The specific model to use (e.g., 'claude-sonnet-4', 'llama3.1:70b', 'gpt-4')",
      required: true,
      default: "claude-sonnet-4",
      conditional: {
        show_when: { provider_type: ["claude-code", "ollama", "anthropic", "openai"] }
      }
    },

    // Claude Code specific fields
    cli_path: {
      type: "text",
      label: "CLI Path",
      description: "Path to the Claude CLI binary (auto-detected if not specified)",
      required: false,
      default: "",
      conditional: {
        show_when: { provider_type: "claude-code" }
      }
    },

    max_turns: {
      type: "number",
      label: "Max Turns",
      description: "Maximum conversation turns for Claude Code CLI",
      required: false,
      default: 20,
      conditional: {
        show_when: { provider_type: "claude-code" }
      }
    },

    allowed_tools: {
      type: "list",
      label: "Allowed Tools",
      description: "Tools the Claude CLI is allowed to use (comma-separated)",
      required: false,
      default: ["read", "write", "bash", "edit"],
      conditional: {
        show_when: { provider_type: "claude-code" }
      }
    },

    // Ollama specific fields
    endpoint: {
      type: "text",
      label: "Endpoint URL",
      description: "Ollama server endpoint",
      required: false,
      default: "http://localhost:11434",
      conditional: {
        show_when: { provider_type: "ollama" }
      }
    },

    // API provider fields (Anthropic, OpenAI)
    api_key_ref: {
      type: "vault_reference",
      label: "API Key Reference",
      description: "Vault reference to API key (e.g., 'vault://anthropic/api_key')",
      required: false,
      default: "",
      conditional: {
        show_when: { provider_type: ["anthropic", "openai"] }
      }
    },

    base_url: {
      type: "text",
      label: "Base URL",
      description: "Custom API base URL (optional, for proxies or custom endpoints)",
      required: false,
      default: "",
      conditional: {
        show_when: { provider_type: ["anthropic", "openai"] }
      }
    }
  },

  // Content sections (for additional metadata or documentation)
  content_sections: {
    notes: {
      type: "markdown",
      label: "Configuration Notes",
      description: "Additional notes about this provider configuration",
      required: false
    }
  },

  // Automation hooks (optional - for future use)
  hooks: {
    on_create: [],
    on_update: [],
    on_delete: []
  },

  // UI rendering hints
  ui_hints: {
    form_layout: "vertical",
    show_preview: true,
    collapsible_sections: ["notes"]
  }
}`;
