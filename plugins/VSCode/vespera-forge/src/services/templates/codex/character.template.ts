/**
 * Character Template
 * Character profile for creative writing
 */

export const CHARACTER_TEMPLATE = `{
  // Character Template
  // For character profiles in creative writing projects

  template_id: "character",
  version: "1.0.0",
  name: "Character",
  description: "Character profile for creative writing",
  icon: "👤",
  color: "#F59E0B",

  // Tags for organization
  tags: ["character", "creative-writing", "profile"],

  // Template fields
  fields: {
    title: {
      type: "text",
      label: "Character Name",
      description: "Full name of the character",
      required: true,
      default: "Unnamed Character"
    },

    role: {
      type: "select",
      label: "Character Role",
      description: "Role in the story",
      required: false,
      default: "supporting",
      options: [
        { value: "protagonist", label: "Protagonist" },
        { value: "antagonist", label: "Antagonist" },
        { value: "supporting", label: "Supporting Character" },
        { value: "minor", label: "Minor Character" }
      ]
    },

    description: {
      type: "markdown",
      label: "Physical Description",
      description: "Appearance and physical characteristics",
      required: false,
      default: ""
    },

    personality: {
      type: "markdown",
      label: "Personality",
      description: "Personality traits, quirks, and mannerisms",
      required: false,
      default: ""
    },

    background: {
      type: "markdown",
      label: "Background",
      description: "Character history and backstory",
      required: false,
      default: ""
    },

    relationships: {
      type: "list",
      label: "Relationships",
      description: "Connections to other characters",
      required: false,
      default: [],
      item_type: "codex_reference",
      filter: {
        template_id: "character"
      }
    },

    notes: {
      type: "markdown",
      label: "Character Notes",
      description: "Additional notes and development ideas",
      required: false,
      default: ""
    },

    tags: {
      type: "list",
      label: "Tags",
      description: "Tags for organizing this character",
      required: false,
      default: [],
      item_type: "text"
    }
  },

  // UI rendering hints
  ui_hints: {
    form_layout: "vertical",
    show_preview: true,
    hide_in_navigator: false,
    collapsible_sections: ["notes", "relationships"]
  }
}`;
