/**
 * Location Template
 * Place or setting for creative writing
 */

export const LOCATION_TEMPLATE = `{
  // Location Template
  // For places and settings in creative writing projects

  template_id: "location",
  version: "1.0.0",
  name: "Location",
  description: "Place or setting for creative writing",
  icon: "🗺️",
  color: "#EF4444",

  // Tags for organization
  tags: ["location", "worldbuilding", "setting"],

  // Template fields
  fields: {
    title: {
      type: "text",
      label: "Location Name",
      description: "Name of this place",
      required: true,
      default: "Unnamed Location"
    },

    location_type: {
      type: "select",
      label: "Location Type",
      description: "Type of location",
      required: false,
      default: "place",
      options: [
        { value: "city", label: "City/Town" },
        { value: "building", label: "Building/Structure" },
        { value: "natural", label: "Natural Location" },
        { value: "region", label: "Region/Area" },
        { value: "place", label: "Generic Place" }
      ]
    },

    description: {
      type: "markdown",
      label: "Description",
      description: "Physical description and atmosphere",
      required: false,
      default: ""
    },

    history: {
      type: "markdown",
      label: "History",
      description: "Historical background of this location",
      required: false,
      default: ""
    },

    inhabitants: {
      type: "list",
      label: "Inhabitants",
      description: "Characters associated with this location",
      required: false,
      default: [],
      item_type: "codex_reference",
      filter: {
        template_id: "character"
      }
    },

    parent_location: {
      type: "codex_reference",
      label: "Parent Location",
      description: "Larger location this belongs to (e.g., city for a building)",
      required: false,
      default: "",
      filter: {
        template_id: "location"
      }
    },

    notes: {
      type: "markdown",
      label: "Location Notes",
      description: "Additional notes and ideas",
      required: false,
      default: ""
    },

    tags: {
      type: "list",
      label: "Tags",
      description: "Tags for organizing this location",
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
    collapsible_sections: ["notes", "inhabitants", "history"]
  }
}`;
