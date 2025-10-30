/**
 * Task Template
 * Task or todo item template
 */

export const TASK_TEMPLATE = `{
  // Task Template
  // For tasks, todos, and actionable items

  template_id: "task",
  version: "1.0.0",
  name: "Task",
  description: "Task or todo item",
  icon: "✓",
  color: "#06B6D4",

  // Tags for organization
  tags: ["task", "todo", "actionable"],

  // Template fields
  fields: {
    title: {
      type: "text",
      label: "Task Title",
      description: "What needs to be done",
      required: true,
      default: "New Task"
    },

    description: {
      type: "markdown",
      label: "Description",
      description: "Detailed task description",
      required: false,
      default: ""
    },

    status: {
      type: "select",
      label: "Status",
      description: "Current task status",
      required: true,
      default: "todo",
      options: [
        { value: "todo", label: "To Do" },
        { value: "in-progress", label: "In Progress" },
        { value: "blocked", label: "Blocked" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" }
      ]
    },

    priority: {
      type: "select",
      label: "Priority",
      description: "Task priority level",
      required: false,
      default: "medium",
      options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "urgent", label: "Urgent" }
      ]
    },

    due_date: {
      type: "date",
      label: "Due Date",
      description: "When this task should be completed",
      required: false,
      default: ""
    },

    assignee: {
      type: "text",
      label: "Assignee",
      description: "Who is responsible for this task",
      required: false,
      default: ""
    },

    related_items: {
      type: "list",
      label: "Related Items",
      description: "Links to related codices",
      required: false,
      default: [],
      item_type: "codex_reference"
    },

    notes: {
      type: "markdown",
      label: "Notes",
      description: "Additional notes and context",
      required: false,
      default: ""
    },

    tags: {
      type: "list",
      label: "Tags",
      description: "Tags for organizing this task",
      required: false,
      default: [],
      item_type: "text"
    }
  },

  // UI rendering hints
  ui_hints: {
    form_layout: "vertical",
    show_preview: false,
    hide_in_navigator: false,
    collapsible_sections: ["notes", "related_items"]
  }
}`;
