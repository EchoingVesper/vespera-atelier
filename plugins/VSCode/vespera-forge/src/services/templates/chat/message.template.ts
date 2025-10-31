/**
 * Chat Message Template
 * Embedded template for individual chat messages nested within channels
 */

export const MESSAGE_TEMPLATE = `{
  // Chat Message Template (Internal)
  // Represents a single message within a chat conversation
  // Messages are nested within channel Codices and not shown in Navigator

  template_id: "message",
  version: "1.0.0",
  name: "Chat Message",
  description: "A single message in a chat conversation (user or assistant)",
  icon: "💬",
  color: "#6366F1",

  // Internal flag - not shown in Navigator or template selection
  internal: true,

  // Tags for organization
  tags: ["message", "chat", "internal"],

  // Template fields
  fields: {
    role: {
      type: "select",
      label: "Role",
      description: "Who sent this message",
      required: true,
      default: "user",
      options: [
        { value: "user", label: "User" },
        { value: "assistant", label: "Assistant" },
        { value: "system", label: "System" }
      ],
      readonly: true
    },

    content: {
      type: "markdown",
      label: "Content",
      description: "The message text content",
      required: true,
      default: "",
      validation: {
        maxLength: 100000
      }
    },

    timestamp: {
      type: "datetime",
      label: "Timestamp",
      description: "When the message was sent",
      required: true,
      default: "{{now}}",
      readonly: true
    },

    provider_id: {
      type: "text",
      label: "Provider ID",
      description: "ID of the provider that generated this message (for assistant messages)",
      required: false,
      readonly: true
    },

    model: {
      type: "text",
      label: "Model",
      description: "Model used to generate this message (for assistant messages)",
      required: false,
      readonly: true
    },

    usage: {
      type: "json",
      label: "Usage Stats",
      description: "Token usage and cost information",
      required: false,
      readonly: true
    },

    metadata: {
      type: "json",
      label: "Metadata",
      description: "Additional metadata (session_id, etc.)",
      required: false,
      readonly: true
    },

    streaming_complete: {
      type: "boolean",
      label: "Streaming Complete",
      description: "Whether streaming is complete for this message",
      required: false,
      default: false,
      readonly: true
    },

    error: {
      type: "text",
      label: "Error",
      description: "Error message if generation failed",
      required: false,
      readonly: true
    }
  },

  // Nesting configuration
  nesting: {
    can_be_nested: true,
    parent_templates: ["ai-chat"],
    can_have_children: false
  },

  // UI rendering hints
  ui_hints: {
    form_layout: "vertical",
    display_in_navigator: false,
    display_in_editor: false,
    read_only_fields: ["role", "timestamp", "provider_id", "model", "usage", "metadata", "streaming_complete", "error"],
    field_groups: {
      "Message Info": ["role", "content", "timestamp"],
      "Generation Details": ["provider_id", "model", "usage", "metadata"],
      "Status": ["streaming_complete", "error"]
    }
  }
}`;
