/**
 * Note Template
 * Simple note or document template for general content
 */

export const NOTE_TEMPLATE = `{
  // Note Template
  // A simple note or document for general content

  template_id: "note",
  version: "1.0.0",
  name: "Note",
  description: "Simple note or document",
  icon: "📝",
  color: "#3B82F6",

  // Tags for organization
  tags: ["note", "document", "content"],

  // Template fields
  fields: {
    title: {
      type: "text",
      label: "Title",
      description: "Note title",
      required: true,
      default: "Untitled Note"
    },

    content: {
      type: "markdown",
      label: "Content",
      description: "Main note content",
      required: false,
      default: ""
    },

    tags: {
      type: "list",
      label: "Tags",
      description: "Tags for organizing this note",
      required: false,
      default: [],
      item_type: "text"
    },

    references: {
      type: "list",
      label: "References",
      description: "Links to related codices or resources",
      required: false,
      default: [],
      item_type: "codex_reference"
    }
  },

  // UI rendering hints
  ui_hints: {
    form_layout: "vertical",
    show_preview: true,
    hide_in_navigator: false,
    collapsible_sections: ["references"]
  }
}`;
