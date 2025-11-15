/**
 * Claude Code CLI Provider Template
 * Embedded template for Claude Code CLI provider configuration
 */

export const CLAUDE_CODE_CLI_PROVIDER_TEMPLATE = `{
  // Claude Code CLI Provider Template
  // Defines schema for provider Codex entries that use Claude Code in headless mode

  template_id: "claude-code-cli",
  name: "Claude Code CLI Provider",
  description: "Uses Claude Code CLI in headless mode with JSON-RPC transport. Leverages your Claude Max subscription without additional API costs.",
  category: "providers",
  icon: "🤖",
  version: "1.0.0",

  // Provider type identifier for backend routing
  provider_type: "claude-code-cli",

  // Field definitions for provider configuration
  fields: [
    {
      id: "provider_type",
      name: "Provider Type",
      type: "select",
      required: true,
      options: ["claude-code-cli"],
      defaultValue: "claude-code-cli",
      description: "Type of LLM provider (fixed for this template)",
      readonly: true
    },
    {
      id: "executable_path",
      name: "Executable Path",
      type: "text",
      required: true,
      defaultValue: "/usr/local/bin/claude",
      description: "Path to Claude Code CLI binary",
      validation: {
        pattern: "^/.+$",
        message: "Must be an absolute path"
      },
      placeholder: "/usr/local/bin/claude"
    },
    {
      id: "transport",
      name: "Transport Method",
      type: "select",
      required: true,
      options: ["json-rpc", "stdio"],
      defaultValue: "json-rpc",
      description: "Communication protocol for Claude Code CLI",
      helpText: "json-rpc is recommended for structured communication"
    },
    {
      id: "headless_mode",
      name: "Headless Mode",
      type: "checkbox",
      required: false,
      defaultValue: true,
      description: "Run Claude Code without interactive prompts",
      readonly: true
    },
    {
      id: "model",
      name: "Model",
      type: "select",
      required: false,
      options: ["claude-sonnet-4", "claude-opus-4", "claude-haiku-4"],
      defaultValue: "claude-sonnet-4",
      description: "Claude model to use (if supported by CLI)"
    },
    {
      id: "max_tokens",
      name: "Max Tokens",
      type: "number",
      required: false,
      defaultValue: 4096,
      description: "Maximum tokens in response",
      validation: {
        min: 256,
        max: 200000,
        step: 256
      }
    },
    {
      id: "temperature",
      name: "Temperature",
      type: "number",
      required: false,
      defaultValue: 0.7,
      description: "Controls randomness in responses (0.0-1.0)",
      validation: {
        min: 0.0,
        max: 1.0,
        step: 0.1
      }
    },
    {
      id: "system_prompt",
      name: "Default System Prompt",
      type: "rich_text",
      required: false,
      defaultValue: "You are a helpful AI assistant.",
      description: "Default system prompt for conversations with this provider",
      placeholder: "You are Claude, a helpful AI assistant...",
      validation: {
        maxLength: 5000
      }
    },
    {
      id: "enable_thinking",
      name: "Show Thinking Process",
      type: "checkbox",
      required: false,
      defaultValue: false,
      description: "Display Claude's internal thinking process"
    },
    {
      id: "enable_tool_visibility",
      name: "Show Tool Usage",
      type: "checkbox",
      required: false,
      defaultValue: true,
      description: "Display when Claude is using tools"
    },
    {
      id: "allowed_tools",
      name: "Allowed Tools",
      type: "select",
      required: false,
      options: [
        "All",
        "Read,Write,Bash,Grep,Glob",
        "Read,Write,Bash",
        "Read,Write",
        "Read,Bash,WebSearch"
      ],
      defaultValue: "Read,Write,Bash,Grep,Glob",
      description: "Which tools Claude can use"
    },
    {
      id: "max_turns",
      name: "Max Conversation Turns",
      type: "number",
      required: false,
      defaultValue: 5,
      description: "Maximum back-and-forth exchanges per conversation",
      validation: {
        min: 1,
        max: 20,
        step: 1
      }
    },
    {
      id: "timeout",
      name: "Request Timeout (seconds)",
      type: "number",
      required: false,
      defaultValue: 120,
      description: "Maximum time to wait for a response",
      validation: {
        min: 30,
        max: 600,
        step: 30
      }
    }
  ],

  // Provider capabilities
  capabilities: {
    streaming: true,
    function_calling: true,
    image_analysis: true,
    code_execution: true,
    web_search: true,
    max_context_window: 200000
  },

  // Backend integration hints
  backend_integration: {
    spawn_command: "{{executable_path}} code --print --output-format stream-json --verbose",
    communication: {
      type: "stdio",
      protocol: "stream-json",
      stdin: true,
      stdout: true,
      stderr: "log",
      note: "Uses Claude Code custom stream-json format (NOT JSON-RPC)",
      event_types: ["system.init", "assistant.message", "result.success"]
    },
    health_check: {
      method: "simple_ping",
      test_command: "echo 'ping' | {{executable_path}} code --print --output-format json",
      interval: 60,
      timeout: 10
    },
    restart_policy: {
      on_failure: true,
      max_retries: 3,
      backoff: "exponential"
    }
  },

  // UI presentation
  ui_hints: {
    primary_fields: ["executable_path", "system_prompt"],
    secondary_fields: ["model", "max_tokens", "temperature"],
    advanced_fields: ["allowed_tools", "max_turns", "timeout", "enable_thinking", "enable_tool_visibility"],
    field_groups: {
      "Basic Configuration": ["provider_type", "executable_path", "transport", "model"],
      "Generation Settings": ["max_tokens", "temperature", "system_prompt"],
      "Advanced Options": ["allowed_tools", "max_turns", "timeout"],
      "UI Preferences": ["enable_thinking", "enable_tool_visibility"]
    }
  }
}`;
