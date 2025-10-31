/**
 * Ollama Local Provider Template
 * Embedded template for Ollama local LLM provider configuration
 */

export const OLLAMA_PROVIDER_TEMPLATE = `{
  // Ollama Local Provider Template
  // Defines schema for provider Codex entries that use Ollama for local LLM inference

  template_id: "ollama",
  name: "Ollama Local Provider",
  description: "Local LLM provider using Ollama. Run models like Llama, Mistral, and others on your own hardware.",
  category: "providers",
  icon: "🦙",
  version: "1.0.0",

  // Provider type identifier for backend routing
  provider_type: "ollama",

  // Field definitions for provider configuration
  fields: [
    {
      id: "provider_type",
      name: "Provider Type",
      type: "select",
      required: true,
      options: ["ollama"],
      defaultValue: "ollama",
      description: "Type of LLM provider (fixed for this template)",
      readonly: true
    },
    {
      id: "base_url",
      name: "Base URL",
      type: "text",
      required: true,
      defaultValue: "http://localhost:11434",
      description: "Ollama server URL (ensure Ollama is running)",
      validation: {
        pattern: "^https?://.+$",
        message: "Must be a valid HTTP/HTTPS URL"
      },
      placeholder: "http://localhost:11434"
    },
    {
      id: "model",
      name: "Model",
      type: "text",
      required: true,
      defaultValue: "llama2",
      description: "Model name (e.g., llama2, mistral, codellama)",
      placeholder: "llama2",
      helpText: "Run 'ollama list' to see available models"
    },
    {
      id: "api_endpoint",
      name: "API Endpoint",
      type: "select",
      required: false,
      options: ["/api/generate", "/api/chat"],
      defaultValue: "/api/generate",
      description: "Ollama API endpoint to use",
      helpText: "/api/chat for conversational models, /api/generate for completion"
    },
    {
      id: "temperature",
      name: "Temperature",
      type: "number",
      required: false,
      defaultValue: 0.7,
      description: "Controls randomness in responses (0.0-2.0)",
      validation: {
        min: 0.0,
        max: 2.0,
        step: 0.1
      }
    },
    {
      id: "max_tokens",
      name: "Max Tokens",
      type: "number",
      required: false,
      defaultValue: 2048,
      description: "Maximum tokens in response",
      validation: {
        min: 256,
        max: 32768,
        step: 256
      }
    },
    {
      id: "top_p",
      name: "Top P",
      type: "number",
      required: false,
      defaultValue: 0.9,
      description: "Nucleus sampling parameter (0.0-1.0)",
      validation: {
        min: 0.0,
        max: 1.0,
        step: 0.05
      }
    },
    {
      id: "top_k",
      name: "Top K",
      type: "number",
      required: false,
      defaultValue: 40,
      description: "Number of highest probability tokens to consider",
      validation: {
        min: 1,
        max: 100,
        step: 1
      }
    },
    {
      id: "system_prompt",
      name: "Default System Prompt",
      type: "rich_text",
      required: false,
      defaultValue: "You are a helpful AI assistant.",
      description: "Default system message for conversations",
      placeholder: "You are a helpful assistant...",
      validation: {
        maxLength: 5000
      }
    },
    {
      id: "context_window",
      name: "Context Window",
      type: "number",
      required: false,
      defaultValue: 4096,
      description: "Number of tokens to keep in context",
      validation: {
        min: 512,
        max: 32768,
        step: 512
      }
    },
    {
      id: "repeat_penalty",
      name: "Repeat Penalty",
      type: "number",
      required: false,
      defaultValue: 1.1,
      description: "Penalty for repeating tokens (1.0 = no penalty)",
      validation: {
        min: 0.0,
        max: 2.0,
        step: 0.1
      }
    },
    {
      id: "timeout",
      name: "Request Timeout (seconds)",
      type: "number",
      required: false,
      defaultValue: 120,
      description: "Maximum time to wait for a response (higher for slower hardware)",
      validation: {
        min: 30,
        max: 600,
        step: 30
      }
    },
    {
      id: "stream_response",
      name: "Stream Response",
      type: "checkbox",
      required: false,
      defaultValue: true,
      description: "Enable streaming responses for progressive updates"
    },
    {
      id: "keep_alive",
      name: "Keep Model Loaded",
      type: "checkbox",
      required: false,
      defaultValue: true,
      description: "Keep model in memory between requests"
    }
  ],

  // Provider capabilities
  capabilities: {
    streaming: true,
    function_calling: false,
    image_analysis: false,
    code_execution: false,
    web_search: false,
    max_context_window: 4096 // Model-dependent
  },

  // Backend integration hints
  backend_integration: {
    api_url: "{{base_url}}{{api_endpoint}}",
    communication: {
      type: "http",
      protocol: "rest",
      method: "POST",
      content_type: "application/json",
      streaming: "newline-delimited-json"
    },
    health_check: {
      method: "GET",
      endpoint: "{{base_url}}/api/tags",
      interval: 60,
      timeout: 10
    },
    restart_policy: {
      on_failure: false,
      max_retries: 3,
      backoff: "linear"
    },
    request_format: {
      model: "{{model}}",
      prompt: "{{message}}",
      system: "{{system_prompt}}",
      stream: "{{stream_response}}",
      options: {
        temperature: "{{temperature}}",
        num_predict: "{{max_tokens}}",
        top_p: "{{top_p}}",
        top_k: "{{top_k}}",
        repeat_penalty: "{{repeat_penalty}}"
      }
    }
  },

  // UI presentation
  ui_hints: {
    primary_fields: ["base_url", "model", "system_prompt"],
    secondary_fields: ["temperature", "max_tokens", "context_window"],
    advanced_fields: ["top_p", "top_k", "repeat_penalty", "timeout"],
    field_groups: {
      "Connection Settings": ["provider_type", "base_url", "model", "api_endpoint"],
      "Generation Settings": ["temperature", "max_tokens", "top_p", "top_k"],
      "Context & Memory": ["system_prompt", "context_window", "repeat_penalty"],
      "Performance": ["timeout", "stream_response", "keep_alive"]
    }
  },

  // Additional notes and requirements
  requirements: {
    external_service: true,
    service_name: "Ollama",
    installation_url: "https://ollama.ai",
    prerequisites: [
      "Ollama must be installed and running",
      "Model must be downloaded (ollama pull <model>)",
      "Ollama server must be accessible at configured URL"
    ]
  }
}`;
