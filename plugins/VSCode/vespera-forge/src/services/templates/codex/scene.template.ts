/**
 * Scene Template
 * Creative writing scene or chapter template
 */

export const SCENE_TEMPLATE = `{
  // Scene Template
  // For creative writing scenes, chapters, or story beats

  template_id: "scene",
  version: "1.0.0",
  name: "Scene",
  description: "Scene or chapter for creative writing",
  icon: "🎬",
  color: "#8B5CF6",

  // Tags for organization
  tags: ["scene", "creative-writing", "fiction"],

  // Template fields
  fields: {
    title: {
      type: "text",
      label: "Scene Title",
      description: "Name of this scene or chapter",
      required: true,
      default: "Untitled Scene"
    },

    scene_type: {
      type: "select",
      label: "Scene Type",
      description: "Type of scene",
      required: false,
      default: "scene",
      options: [
        { value: "scene", label: "Scene" },
        { value: "chapter", label: "Chapter" },
        { value: "beat", label: "Story Beat" },
        { value: "outline", label: "Outline" }
      ]
    },

    content: {
      type: "markdown",
      label: "Scene Content",
      description: "The actual scene text",
      required: false,
      default: ""
    },

    characters: {
      type: "list",
      label: "Characters",
      description: "Characters appearing in this scene",
      required: false,
      default: [],
      item_type: "codex_reference",
      filter: {
        template_id: "character"
      }
    },

    location: {
      type: "codex_reference",
      label: "Location",
      description: "Where this scene takes place",
      required: false,
      default: "",
      filter: {
        template_id: "location"
      }
    },

    mood: {
      type: "text",
      label: "Mood/Tone",
      description: "Emotional tone or atmosphere of the scene",
      required: false,
      default: ""
    },

    notes: {
      type: "markdown",
      label: "Scene Notes",
      description: "Writer's notes, ideas, or reminders",
      required: false,
      default: ""
    },

    tags: {
      type: "list",
      label: "Tags",
      description: "Tags for organizing this scene",
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
    collapsible_sections: ["notes", "characters", "location"]
  }
}`;
