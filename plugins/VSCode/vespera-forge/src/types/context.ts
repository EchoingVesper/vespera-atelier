/**
 * Core Context Type Definitions for Vespera Forge
 * Phase 17 - Workspace/Project/Context hierarchy
 *
 * Contexts are organizational lenses within projects that provide different
 * perspectives on project content (e.g., "Story" context for fiction, "Art" context
 * for visual assets, "Research" context for background material).
 *
 * @module types/context
 * @see {@link docs/development/decisions/ADR-015-workspace-project-context-hierarchy.md} for architecture
 */

import { ProjectId, UserId } from './bindery';

// Re-export for convenience
export type ContextId = string;

// =============================================================================
// CONTEXT TYPE SYSTEM - EXTENSIBLE, NOT HARDCODED
// =============================================================================

/**
 * Context type identifier - EXTENSIBLE string type
 *
 * CRITICAL: Context types are NOT hardcoded enums. They are strings that reference
 * ContextTypeDefinitions registered dynamically.
 *
 * This allows:
 * - Custom context types without code changes
 * - Plugin-contributed context types
 * - Project-specific context types
 * - Domain-specific organizational lenses
 *
 * @see {@link ContextTypeDefinition} for type registration
 * @see {@link DEFAULT_CONTEXT_TYPES} for built-in types
 */
export type ContextType = string;

/**
 * Context lifecycle status
 *
 * Determines how the context is treated in the UI and which operations are allowed.
 */
export enum ContextStatus {
  /** Active context - normal operations allowed */
  Active = 'active',

  /** Archived context - read-only, hidden from default views */
  Archived = 'archived',

  /** Template context - used as a starting point for new contexts */
  Template = 'template',

  /** Paused context - visible but marked as temporarily inactive */
  Paused = 'paused'
}

// =============================================================================
// CONTEXT TYPE DEFINITION SYSTEM
// =============================================================================

/**
 * Context type definition for extensible type registration
 *
 * CRITICAL: Context types are NOT hardcoded enums. They are registered dynamically,
 * allowing users and plugins to define custom organizational lenses.
 *
 * @example
 * ```typescript
 * const artContextType: ContextTypeDefinition = {
 *   id: "art-assets",
 *   name: "Art Assets",
 *   description: "Visual art, concept art, and illustrations",
 *   icon: "palette",
 *   category: "Creative",
 *   defaultSettings: {
 *     defaultCodexTemplate: "artwork",
 *     enabledAutomation: false
 *   },
 *   templateCategories: ["art", "character-design", "environments"],
 *   requiredFields: ["artStyle"],
 *   recommendedPlugins: ["image-gallery-viewer"]
 * };
 * ```
 */
export interface ContextTypeDefinition {
  /** Unique type identifier (kebab-case recommended, e.g., "story", "research-notes") */
  id: string;

  /** Human-readable type name */
  name: string;

  /** Description of what this context type is for */
  description: string;

  /** Icon identifier for this context type */
  icon?: string;

  /** Optional category for grouping related types (e.g., "Creative", "Technical") */
  category?: string;

  /** Default settings applied when creating contexts of this type */
  defaultSettings?: Partial<ContextSettings>;

  /**
   * Template categories relevant to this context type
   *
   * When filtering templates, only categories in this list (plus global categories)
   * will be shown for contexts of this type.
   *
   * @example ["characters", "scenes", "worldbuilding"] for story contexts
   */
  templateCategories?: string[];

  /**
   * Required custom fields that must be set when creating this context type
   *
   * @example ["perspective", "timeframe"] for narrative contexts
   */
  requiredFields?: string[];

  /**
   * Recommended plugins/extensions for this context type
   *
   * UI can suggest installing these when creating a context of this type
   */
  recommendedPlugins?: string[];

  /**
   * Custom metadata schema for this context type
   *
   * JSON Schema definition for type-specific metadata validation
   */
  metadataSchema?: Record<string, any>;
}

/**
 * Built-in context type definitions
 *
 * These are the default context types provided by Vespera Forge.
 * Additional types can be registered via plugins or user configuration.
 */
export const DEFAULT_CONTEXT_TYPES: ContextTypeDefinition[] = [
  {
    id: "story",
    name: "Story",
    description: "Narrative content and story development",
    icon: "📖",
    category: "Creative",
    defaultSettings: {
      enabledAutomation: true,
      customSettings: {}
    },
    templateCategories: ["creative-writing", "characters", "scenes", "chapters", "worldbuilding"]
  },
  {
    id: "research",
    name: "Research",
    description: "Background research and reference materials",
    icon: "🔬",
    category: "Academic",
    defaultSettings: {
      enabledAutomation: false,
      customSettings: {}
    },
    templateCategories: ["research", "knowledge-management", "citations", "notes"]
  },
  {
    id: "art",
    name: "Art Assets",
    description: "Visual assets and artwork",
    icon: "🎨",
    category: "Creative",
    defaultSettings: {
      enabledAutomation: false,
      customSettings: {}
    },
    templateCategories: ["art", "character-design", "environments", "concept-art"]
  },
  {
    id: "code",
    name: "Code",
    description: "Source code and technical documentation",
    icon: "💻",
    category: "Technical",
    defaultSettings: {
      enabledAutomation: true,
      customSettings: {}
    },
    templateCategories: ["code", "architecture", "tasks", "documentation"]
  },
  {
    id: "planning",
    name: "Planning",
    description: "Project planning and organization",
    icon: "📋",
    category: "Organization",
    defaultSettings: {
      enabledAutomation: true,
      customSettings: {}
    },
    templateCategories: ["planning", "tasks", "timelines", "milestones"]
  },
  {
    id: "general",
    name: "General",
    description: "General-purpose context without specific constraints",
    icon: "📁",
    category: "General",
    defaultSettings: {
      enabledAutomation: false,
      customSettings: {}
    },
    templateCategories: [] // All categories available
  },
  {
    id: "documentation",
    name: "Documentation",
    description: "Technical documentation and guides",
    icon: "📚",
    category: "Technical",
    defaultSettings: {
      enabledAutomation: false,
      customSettings: {}
    },
    templateCategories: ["documentation", "guides", "reference", "notes"]
  },
  {
    id: "fiction",
    name: "Fiction",
    description: "Creative fiction writing",
    icon: "✍️",
    category: "Creative",
    defaultSettings: {
      enabledAutomation: true,
      customSettings: {}
    },
    templateCategories: ["creative-writing", "characters", "scenes", "worldbuilding", "plot"]
  },
  {
    id: "software-project",
    name: "Software Project",
    description: "Software development and engineering",
    icon: "⚙️",
    category: "Technical",
    defaultSettings: {
      enabledAutomation: true,
      customSettings: {}
    },
    templateCategories: ["code", "architecture", "tasks", "documentation", "testing"]
  }
];

// =============================================================================
// METADATA AND SETTINGS
// =============================================================================

/**
 * Context metadata for tracking lifecycle and ownership
 *
 * Contains creation timestamp, update timestamp, optional author tracking,
 * versioning, tagging, and extensible custom fields.
 */
export interface ContextMetadata {
  /** Immutable creation timestamp */
  createdAt: Date;

  /** Last modification timestamp - updated on any context change */
  updatedAt: Date;

  /** Optional user identifier who created the context (matches UserId from bindery.ts) */
  author?: UserId;

  /**
   * Semantic version string for context schema/structure changes
   * Format: MAJOR.MINOR.PATCH (e.g., "1.2.3")
   */
  version: string;

  /** Context-level tags for organization and filtering */
  tags?: string[];

  /** ID of the context template used to create this context */
  templateId?: string;

  /** Optional icon identifier (emoji or icon name) */
  icon?: string;

  /** Optional color theme for UI customization */
  color?: string;

  /** Additional custom metadata for extensibility */
  [key: string]: any;
}

/**
 * Context settings and configuration
 *
 * Contains user-configurable preferences that affect context behavior,
 * including template defaults, visual appearance, and feature flags.
 */
export interface ContextSettings {
  /**
   * Default template category for new Codices in this context
   *
   * When a user creates a new Codex in this context without specifying a category,
   * templates from this category will be shown first.
   *
   * @example "creative-writing", "research", "worldbuilding"
   */
  defaultTemplateCategory?: string;

  /** Default Codex template ID for new Codices in this context */
  defaultCodexTemplate?: string;

  /**
   * Context visual identifier - hex color code
   * Used in UI for context badges, tree view items, etc.
   * @example "#4A90E2", "#E24A4A"
   */
  color?: string;

  /**
   * Context visual identifier - icon name
   * Icon identifier compatible with the UI framework icon set
   * @example "book", "microscope", "palette", "folder"
   */
  icon?: string;

  /**
   * Feature flags for enabling/disabling context capabilities
   *
   * Allows fine-grained control over which features are available in this context.
   */
  features?: ContextFeatureFlags;

  /** Whether automation rules are enabled for this context */
  enabledAutomation: boolean;

  /** Default LLM chat provider for this context */
  chatProvider?: string;

  /**
   * Custom user-defined settings specific to context type
   *
   * Allows context type definitions to specify their own settings schema.
   * For example, a "story" context might have narrativeStyle: "first-person"
   */
  customSettings?: Record<string, any>;
}

/**
 * Feature flags for context capabilities
 *
 * Controls which advanced features are enabled for a context.
 * Features can be toggled independently based on user needs and preferences.
 */
export interface ContextFeatureFlags {
  /** Enable tag-driven automation system (future feature) */
  automation?: boolean;

  /** Enable real-time collaboration features (future feature) */
  collaboration?: boolean;

  /** Enable version control integration */
  versionControl?: boolean;

  /** Enable AI assistant features */
  aiAssistant?: boolean;

  /** Enable analytics and insights */
  analytics?: boolean;

  /** Custom feature flags for extensibility */
  [key: string]: boolean | undefined;
}

// =============================================================================
// CORE CONTEXT INTERFACE
// =============================================================================

/**
 * Core Context interface - an organizational lens within a project
 *
 * Contexts provide different perspectives on project content, allowing users to
 * organize and view their work through different lenses (e.g., "Story" vs "Research"
 * vs "Art Assets" for a fiction project).
 *
 * IMPORTANT: Contexts are FILE-BASED (stored in .vespera/contexts/), not database-backed.
 * They belong to a specific project and provide an organizational layer between
 * projects and codices.
 *
 * @example
 * ```typescript
 * const storyContext: IContext = {
 *   id: "ctx-550e8400-e29b-41d4-a716-446655440000",
 *   name: "Main Story",
 *   project_id: "proj-123e4567-e89b-12d3-a456-426614174000",
 *   type: "story",
 *   description: "Primary narrative content and character development",
 *   metadata: {
 *     createdAt: new Date("2025-01-15T10:00:00Z"),
 *     updatedAt: new Date("2025-01-20T15:30:00Z"),
 *     author: "user-123",
 *     version: "1.0.0",
 *     tags: ["narrative", "primary"]
 *   },
 *   settings: {
 *     defaultTemplateCategory: "creative-writing",
 *     color: "#9C27B0",
 *     icon: "book",
 *     enabledAutomation: true,
 *     features: {
 *       automation: true,
 *       aiAssistant: true
 *     }
 *   },
 *   status: ContextStatus.Active
 * };
 * ```
 */
export interface IContext {
  /** Unique context identifier (prefixed with "ctx-" for clarity) */
  id: ContextId;

  /** Human-readable context name (1-100 characters, alphanumeric with spaces/hyphens/underscores) */
  name: string;

  /**
   * Project ID this context belongs to
   *
   * CRITICAL: Contexts must always belong to exactly one project.
   * This establishes the Workspace → Project → Context → Codex hierarchy.
   */
  project_id: ProjectId;

  /**
   * Context type identifier (e.g., "story", "research", "art")
   *
   * IMPORTANT: This is NOT a hardcoded enum - context types are registered dynamically
   * via the ContextTypeRegistry. New types can be added without code changes.
   *
   * @see {@link ContextTypeDefinition} for type registration
   * @see {@link DEFAULT_CONTEXT_TYPES} for built-in types
   */
  type: ContextType;

  /** Optional context description for context and documentation */
  description?: string;

  /** Current context lifecycle status */
  status: ContextStatus;

  /** Context metadata including timestamps, author, version, and tags */
  metadata: ContextMetadata;

  /** Context-specific settings and configuration */
  settings: ContextSettings;
}

// =============================================================================
// INPUT AND UPDATE TYPES
// =============================================================================

/**
 * Input for creating a new context
 *
 * Requires name, project_id, and type. Other fields are optional or auto-generated:
 * - id: Generated with "ctx-" prefix
 * - metadata: Auto-populated with current timestamp, version "1.0.0"
 * - settings: Merged with context type defaults
 * - status: Defaults to ContextStatus.Active
 *
 * @example
 * ```typescript
 * const input: ContextCreateInput = {
 *   name: "Story Context",
 *   project_id: "proj-123e4567-e89b-12d3-a456-426614174000",
 *   type: "story",
 *   description: "Main narrative content",
 *   settings: {
 *     color: "#9C27B0",
 *     enabledAutomation: true,
 *     features: { automation: true }
 *   }
 * };
 * ```
 */
export type ContextCreateInput = Pick<IContext, "name" | "project_id" | "type"> &
  Partial<Omit<IContext, "id" | "name" | "project_id" | "type" | "metadata">>;

/**
 * Input for updating an existing context
 *
 * All fields except id, project_id, and metadata are optional.
 * Metadata fields (updatedAt, version) are managed by the service.
 * project_id cannot be changed after creation (contexts cannot move between projects).
 *
 * @example
 * ```typescript
 * const update: ContextUpdateInput = {
 *   name: "Main Story (Revised)",
 *   settings: {
 *     ...existingSettings,
 *     color: "#A237C0"
 *   }
 * };
 * ```
 */
export type ContextUpdateInput = Partial<Omit<IContext, "id" | "project_id" | "metadata">>;

/**
 * Context list item for efficient listing operations
 * Contains minimal info for navigator/picker displays
 */
export interface ContextListItem {
  id: ContextId;
  name: string;
  project_id: ProjectId;
  type: ContextType;
  status: ContextStatus;
  updatedAt: Date;
  icon?: string;
  color?: string;
}

/**
 * Validation result for context operations
 */
export interface ContextValidationResult {
  /** Whether the validation passed */
  isValid: boolean;

  /** Validation error messages (empty if valid) */
  errors: string[];

  /** Warning messages (non-blocking) */
  warnings?: string[];

  /** Field-specific error map */
  fieldErrors?: Record<string, string>;
}

/**
 * Context query filters for listing operations
 */
export interface ContextQueryFilters {
  /** Filter by project ID (required - contexts are always scoped to a project) */
  project_id?: ProjectId;

  /** Filter by context type */
  type?: ContextType | ContextType[];

  /** Filter by context status */
  status?: ContextStatus | ContextStatus[];

  /** Filter by tags (any match) */
  tags?: string[];

  /** Search query for name/description */
  search?: string;

  /** Sort field */
  sortBy?: 'name' | 'createdAt' | 'updatedAt';

  /** Sort direction */
  sortDirection?: 'asc' | 'desc';

  /** Pagination limit */
  limit?: number;

  /** Pagination offset */
  offset?: number;
}

/**
 * Context statistics for dashboard/overview
 */
export interface ContextStats {
  /** Total number of contexts */
  total: number;

  /** Count by context type */
  byType: Record<ContextType, number>;

  /** Count by status */
  byStatus: Record<ContextStatus, number>;

  /** Most recently updated context */
  recentlyUpdated?: ContextListItem;

  /** Oldest context */
  oldest?: ContextListItem;
}

/**
 * Constants for context validation
 */
export const CONTEXT_CONSTANTS = {
  NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
    PATTERN: /^[a-zA-Z0-9\s\-_.,!?'"()]+$/
  },
  DESCRIPTION: {
    MAX_LENGTH: 1000
  },
  TAGS: {
    MAX_COUNT: 20,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9\-_]+$/
  },
  ID: {
    PREFIX: 'ctx-',
    PATTERN: /^ctx-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  }
} as const;

/**
 * Context type metadata for UI and validation
 */
export const CONTEXT_TYPE_METADATA: Record<ContextType, {
  label: string;
  description: string;
  icon: string;
  color: string;
  defaultTemplates: string[];
}> = {
  story: {
    label: 'Story',
    description: 'Narrative content and story development',
    icon: '📖',
    color: '#9C27B0',
    defaultTemplates: ['character', 'scene', 'chapter', 'location']
  },
  research: {
    label: 'Research',
    description: 'Background research and reference materials',
    icon: '🔬',
    color: '#4CAF50',
    defaultTemplates: ['note', 'reference', 'experiment', 'source']
  },
  art: {
    label: 'Art Assets',
    description: 'Visual assets and artwork',
    icon: '🎨',
    color: '#E91E63',
    defaultTemplates: ['artwork', 'character-design', 'environment', 'concept']
  },
  code: {
    label: 'Code',
    description: 'Source code and technical documentation',
    icon: '💻',
    color: '#2196F3',
    defaultTemplates: ['code-file', 'architecture-doc', 'task', 'bug']
  },
  planning: {
    label: 'Planning',
    description: 'Project planning and organization',
    icon: '📋',
    color: '#FF9800',
    defaultTemplates: ['task', 'milestone', 'timeline', 'checklist']
  },
  general: {
    label: 'General',
    description: 'General-purpose context',
    icon: '📁',
    color: '#607D8B',
    defaultTemplates: ['note', 'folder', 'task']
  }
};

// =============================================================================
// QUERY AND FILTERING TYPES
// =============================================================================

/**
 * Options for filtering context queries
 *
 * All filters are optional and applied as AND conditions.
 * Used in ContextService.listContexts() and UI filter controls.
 *
 * @example
 * ```typescript
 * const filters: ContextFilterOptions = {
 *   project_id: "proj-123",
 *   type: "story",
 *   status: ContextStatus.Active,
 *   tags: ["narrative"],
 *   searchTerm: "chapter"
 * };
 * // Returns active story contexts in project-123 tagged "narrative" with "chapter" in name/description
 * ```
 */
export interface ContextFilterOptions {
  /** Filter by project ID (contexts are scoped to a project) */
  project_id?: ProjectId;

  /** Filter by context type (exact match) */
  type?: string;

  /** Filter by context status (exact match) */
  status?: ContextStatus;

  /** Filter by tags (context must have ALL specified tags) */
  tags?: string[];

  /**
   * Search term for fuzzy matching against name and description
   *
   * Case-insensitive substring search
   */
  searchTerm?: string;

  /** Filter by author (exact match on metadata.author) */
  author?: UserId;

  /**
   * Filter by creation date range
   */
  createdAfter?: Date;
  createdBefore?: Date;

  /**
   * Filter by update date range
   */
  updatedAfter?: Date;
  updatedBefore?: Date;

  /**
   * Custom metadata filters
   *
   * Allows filtering on custom metadata fields.
   * @example { narrativeStyle: "first-person", perspective: "protagonist" }
   */
  customFilters?: Record<string, any>;
}

/**
 * Options for sorting context queries
 *
 * Specifies sort field and direction. Used in ContextService.listContexts().
 *
 * @example
 * ```typescript
 * const sort: ContextSortOptions = {
 *   field: "updatedAt",
 *   direction: "desc"
 * };
 * // Returns contexts ordered by most recently updated
 * ```
 */
export interface ContextSortOptions {
  /** Field to sort by */
  field: "name" | "createdAt" | "updatedAt" | "type" | "status";

  /** Sort direction */
  direction: "asc" | "desc";
}

/**
 * Paginated query result for context listings
 *
 * Supports efficient rendering of large context lists with pagination.
 *
 * @example
 * ```typescript
 * const result: ContextQueryResult = {
 *   contexts: [context1, context2, context3],
 *   total: 15,
 *   hasMore: true,
 *   page: 0,
 *   pageSize: 10
 * };
 * ```
 */
export interface ContextQueryResult {
  /** Contexts matching the query (paginated subset) */
  contexts: IContext[];

  /** Total number of contexts matching the query (unpaginated) */
  total: number;

  /** Whether there are more results beyond this page */
  hasMore: boolean;

  /** Current page number (0-indexed) */
  page?: number;

  /** Number of results per page */
  pageSize?: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Minimal context information for lightweight operations
 *
 * Used in tree views, dropdowns, and other UI contexts where full context
 * data is unnecessary.
 */
export interface ContextSummary {
  id: ContextId;
  name: string;
  project_id: ProjectId;
  type: ContextType;
  status: ContextStatus;
  color?: string;
  icon?: string;
}

/**
 * Context with relationship counts for dashboard displays
 *
 * Extends IContext with computed statistics about associated content.
 */
export interface ContextWithStats extends IContext {
  stats: {
    /** Number of Codices in this context */
    codexCount: number;

    /** Number of active tasks in this context */
    activeTaskCount: number;

    /** Number of completed tasks in this context */
    completedTaskCount: number;

    /** Number of templates used in this context */
    templateCount: number;

    /** Last activity timestamp (most recent Codex update) */
    lastActivityAt?: Date;
  };
}

// =============================================================================
// SERIALIZATION AND PERSISTENCE
// =============================================================================

/**
 * Serializable context representation
 *
 * Type alias for IContext with Date fields as strings.
 * Useful for type-safe JSON operations (file-based storage).
 */
export type SerializableContext = Omit<IContext, 'metadata'> & {
  metadata: Omit<ContextMetadata, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
  };
};

/**
 * Serialize context for JSON storage
 *
 * Converts Date objects to ISO 8601 strings for JSON compatibility.
 * Used when persisting contexts to .vespera/contexts/ directory.
 *
 * @param context - Context to serialize
 * @returns JSON string representation
 *
 * @example
 * ```typescript
 * const json = serializeContext(myContext);
 * await workspace.fs.writeFile(uri, Buffer.from(json, 'utf8'));
 * ```
 */
export function serializeContext(context: IContext): string {
  return JSON.stringify(context, (_key, value) => {
    // Convert Dates to ISO strings
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }, 2);
}

/**
 * Deserialize context from JSON storage
 *
 * Converts ISO 8601 strings back to Date objects.
 * Used when loading contexts from .vespera/contexts/ directory.
 *
 * @param json - JSON string to deserialize
 * @returns Reconstructed context object
 *
 * @example
 * ```typescript
 * const json = await workspace.fs.readFile(uri);
 * const context = deserializeContext(json.toString());
 * ```
 */
export function deserializeContext(json: string): IContext {
  const obj = JSON.parse(json);

  // Convert ISO strings back to Dates
  if (obj.metadata) {
    if (obj.metadata.createdAt) {
      obj.metadata.createdAt = new Date(obj.metadata.createdAt);
    }
    if (obj.metadata.updatedAt) {
      obj.metadata.updatedAt = new Date(obj.metadata.updatedAt);
    }
  }

  return obj as IContext;
}

// =============================================================================
// TYPE GUARDS AND VALIDATORS
// =============================================================================

/**
 * Type guard to check if an object is a valid IContext
 *
 * Performs runtime type checking for structural validity.
 * Does NOT validate business rules (e.g., name length, type registration).
 *
 * @param obj - Object to check
 * @returns True if object matches IContext structure
 *
 * @example
 * ```typescript
 * if (isContext(data)) {
 *   // TypeScript knows data is IContext
 *   console.log(data.name);
 * }
 * ```
 */
export function isContext(obj: any): obj is IContext {
  return obj &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.project_id === "string" &&
    typeof obj.type === "string" &&
    obj.metadata &&
    typeof obj.metadata === "object" &&
    obj.metadata.createdAt instanceof Date &&
    obj.metadata.updatedAt instanceof Date &&
    typeof obj.metadata.version === "string" &&
    obj.settings &&
    typeof obj.settings === "object" &&
    typeof obj.status === "string" &&
    Object.values(ContextStatus).includes(obj.status);
}

/**
 * Validate context name format
 *
 * Rules:
 * - Length: 1-100 characters
 * - Characters: Alphanumeric, spaces, hyphens, underscores
 * - No leading/trailing whitespace
 *
 * @param name - Context name to validate
 * @returns True if valid
 *
 * @example
 * ```typescript
 * validateContextName("Story Context"); // true
 * validateContextName("A".repeat(101)); // false
 * validateContextName(""); // false
 * ```
 */
export function validateContextName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  const trimmed = name.trim();

  return trimmed.length > 0 &&
         trimmed.length <= 100 &&
         CONTEXT_CONSTANTS.NAME.PATTERN.test(trimmed) &&
         trimmed === name; // No leading/trailing whitespace
}

/**
 * Validate hex color format
 *
 * Accepts 3-digit (#RGB) or 6-digit (#RRGGBB) hex colors.
 *
 * @param color - Color string to validate
 * @returns True if valid hex color
 *
 * @example
 * ```typescript
 * validateHexColor("#4A90E2"); // true
 * validateHexColor("#abc"); // true
 * validateHexColor("red"); // false
 * ```
 */
export function validateHexColor(color: string): boolean {
  if (!color || typeof color !== 'string') {
    return false;
  }

  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Validate semantic version format
 *
 * Follows MAJOR.MINOR.PATCH format (e.g., "1.2.3").
 *
 * @param version - Version string to validate
 * @returns True if valid semantic version
 *
 * @example
 * ```typescript
 * validateVersion("1.0.0"); // true
 * validateVersion("2.3.1"); // true
 * validateVersion("1.0"); // false
 * ```
 */
export function validateVersion(version: string): boolean {
  if (!version || typeof version !== 'string') {
    return false;
  }

  return /^\d+\.\d+\.\d+$/.test(version);
}

/**
 * Type guard for ContextTypeDefinition
 *
 * @param obj - Object to check
 * @returns True if object matches ContextTypeDefinition structure
 */
export function isContextTypeDefinition(obj: any): obj is ContextTypeDefinition {
  return obj &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.description === "string";
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Default context settings factory
 *
 * Creates a ContextSettings object with sensible defaults.
 *
 * @returns Default ContextSettings
 */
export function createDefaultContextSettings(): ContextSettings {
  return {
    enabledAutomation: false,
    customSettings: {}
  };
}

/**
 * Default context metadata factory
 *
 * Creates a ContextMetadata object with current timestamps and version 1.0.0.
 *
 * @returns Default ContextMetadata
 */
export function createDefaultContextMetadata(): ContextMetadata {
  const now = new Date();
  return {
    createdAt: now,
    updatedAt: now,
    version: "1.0.0",
    tags: []
  };
}

/**
 * Extract context summary from full context
 *
 * @param context - Full context object
 * @returns Minimal context summary
 */
export function toContextSummary(context: IContext): ContextSummary {
  return {
    id: context.id,
    name: context.name,
    project_id: context.project_id,
    type: context.type,
    status: context.status,
    color: context.settings.color || context.metadata.color,
    icon: context.settings.icon || context.metadata.icon
  };
}
