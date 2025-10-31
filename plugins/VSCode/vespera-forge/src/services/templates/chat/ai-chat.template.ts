/**
 * AI Chat Session Configuration Template
 * Embedded template for AI chat session configuration
 */

export const AI_CHAT_TEMPLATE = `{
  // AI Chat Session Template
  // Defines an interactive chat session with an LLM provider

  template_id: "ai-chat",
  version: "1.0.0",
  name: "AI Chat Session",
  description: "Interactive chat session with an AI assistant",
  icon: "💬",
  color: "#10B981",

  // Tags for organization and automation
  tags: ["chat", "ai", "conversation"],

  // Template fields
  fields: {
    provider_id: {
      type: "text",
      label: "Provider ID",
      description: "ID of the selected LLM provider Codex",
      required: false,
      default: ""
    },

    model: {
      type: "text",
      label: "Model",
      description: "Model to use with this provider (e.g., claude-sonnet-4, llama3.2:3b)",
      required: false,
      default: ""
    },

    system_prompt: {
      type: "markdown",
      label: "System Prompt",
      description: "System prompt override for this channel",
      required: false,
      default: ""
    },

    provider_ref: {
      type: "codex_reference",
      label: "LLM Provider (Legacy)",
      description: "Reference to LLM provider configuration",
      required: false,
      default: "",
      filter: {
        template_id: "llm-provider"
      }
    },

    system_prompt_ref: {
      type: "codex_reference",
      label: "System Prompt Reference (Legacy)",
      description: "Reference to system prompt file (.md)",
      required: false,
      default: "",
      filter: {
        content_type: "text/markdown",
        tags: ["system-prompt"]
      }
    },

    channel_name: {
      type: "text",
      label: "Channel Name",
      description: "Display name for this chat channel",
      required: true,
      default: "New Chat"
    },

    channel_type: {
      type: "select",
      label: "Channel Type",
      description: "Type of chat channel",
      required: true,
      default: "user-chat",
      options: [
        { value: "user-chat", label: "User Chat (Manual conversation)" },
        { value: "agent-task", label: "Agent Task (Automated task execution)" }
      ]
    },

    status: {
      type: "select",
      label: "Status",
      description: "Current status of the chat channel",
      required: true,
      default: "active",
      options: [
        { value: "active", label: "Active (Currently in use)" },
        { value: "idle", label: "Idle (No recent activity)" },
        { value: "archived", label: "Archived (Completed or inactive)" }
      ]
    },

    context_files: {
      type: "list",
      label: "Context Files",
      description: "List of file paths or Codex references to include in context",
      required: false,
      default: [],
      item_type: "text"
    },

    max_tokens: {
      type: "number",
      label: "Max Tokens",
      description: "Maximum tokens for LLM responses",
      required: false,
      default: 4096
    },

    temperature: {
      type: "number",
      label: "Temperature",
      description: "Sampling temperature (0.0-1.0)",
      required: false,
      default: 0.7,
      validation: {
        min: 0.0,
        max: 1.0
      }
    },

    tools_enabled: {
      type: "boolean",
      label: "Enable Tools",
      description: "Allow the LLM to use tools/functions",
      required: false,
      default: true
    },

    parent_task_ref: {
      type: "codex_reference",
      label: "Parent Task",
      description: "Reference to parent task (for agent-spawned chats)",
      required: false,
      default: "",
      conditional: {
        show_when: { channel_type: "agent-task" }
      },
      filter: {
        template_id: ["task-orchestrator", "task-code-writer"]
      }
    }
  },

  // Content sections
  content_sections: {
    messages: {
      type: "structured",
      label: "Message History",
      description: "Chat message history (managed programmatically)",
      required: true,
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["system", "user", "assistant", "tool"] },
            content: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
            tool_calls: { type: "array", items: { type: "object" } }
          }
        }
      }
    },

    summary: {
      type: "markdown",
      label: "Conversation Summary",
      description: "Auto-generated summary of the conversation",
      required: false
    }
  },

  // Automation hooks
  hooks: {
    on_create: [
      {
        action: "initialize_chat",
        description: "Initialize chat session with system prompt"
      }
    ],

    on_update: [
      {
        trigger: "field_changed:messages",
        condition: "last_message.role === 'user'",
        action: "llm_process_message",
        description: "Process user message and generate LLM response",
        params: {
          streaming: true,
          emit_events: true
        }
      }
    ],

    on_delete: [
      {
        action: "archive_conversation",
        description: "Archive conversation to database before deletion"
      }
    ]
  },

  // UI rendering hints
  ui_hints: {
    form_layout: "vertical",
    show_preview: false,
    hide_in_navigator: false,
    custom_renderer: "ChatChannelRenderer",
    collapsible_sections: ["summary"],
    read_only_fields: ["messages"] // Messages managed by chat UI
  },

  // Activity tracking
  activity: {
    track_last_message_time: true,
    idle_threshold_minutes: 30,
    auto_archive_days: 90
  }
}`;
