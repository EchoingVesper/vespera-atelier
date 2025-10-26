/**
 * Core Project Type Definitions for Vespera Forge
 * Phase 16a Round 3 - Comprehensive project-centric architecture
 *
 * Projects are the foundational organizational unit in the Vespera Atelier system.
 * All content (Codices, templates, tasks, workflows) exists within the context of a project.
 *
 * @module types/project
 * @see {@link docs/architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md} for architectural overview
 * @see {@link docs/architecture/core/HIERARCHICAL_TEMPLATE_SYSTEM.md} for template integration
 */

import { ProjectId, UserId, WorkspaceId } from './bindery';
import { ContextId } from './context';

// =============================================================================
// PROJECT TYPE SYSTEM - EXTENSIBLE, NOT HARDCODED
// =============================================================================

/**
 * Project type identifier - EXTENSIBLE string type
 *
 * CRITICAL: Project types are NOT hardcoded enums. They are strings that reference
 * ProjectTypeDefinitions registered in the ProjectTypeRegistry.
 *
 * This allows:
 * - Custom project types without code changes
 * - Plugin-contributed project types
 * - User-defined project types
 * - Domain-specific project types
 *
 * @see {@link ProjectTypeDefinition} for type registration
 * @see {@link DEFAULT_PROJECT_TYPES} for built-in types
 */
export type ProjectType = string;

/**
 * @deprecated Legacy union type - Use string-based ProjectType instead
 * Kept for backward compatibility only. Will be removed in Phase 16c.
 */
export type LegacyProjectType =
  | 'journalism'      // Interviews, sources, articles, fact-checking
  | 'research'        // Papers, notes, references, experiments
  | 'fiction'         // Characters, scenes, chapters, worldbuilding
  | 'documentation'   // Technical docs, guides, API references
  | 'general';        // Flexible catch-all for custom workflows

/**
 * Project lifecycle status
 *
 * Determines how the project is treated in the UI and which operations are allowed.
 */
export enum ProjectStatus {
  /** Active project - normal operations allowed */
  Active = 'active',

  /** Archived project - read-only, hidden from default views */
  Archived = 'archived',

  /** Template project - used as a starting point for new projects */
  Template = 'template',

  /** Paused project - visible but marked as temporarily inactive */
  Paused = 'paused'
}

// =============================================================================
// PROJECT TYPE DEFINITION SYSTEM
// =============================================================================

/**
 * Project type definition for extensible type registration
 *
 * CRITICAL: Project types are NOT hardcoded enums. They are registered dynamically
 * via the ProjectTypeRegistry, allowing users and plugins to define custom types.
 *
 * @example
 * ```typescript
 * const visualNovelType: ProjectTypeDefinition = {
 *   id: "visual-novel",
 *   name: "Visual Novel",
 *   description: "Interactive fiction with branching narrative",
 *   icon: "game-controller",
 *   category: "Interactive Fiction",
 *   defaultSettings: {
 *     defaultCodexTemplate: "character-route",
 *     enabledAutomation: true
 *   },
 *   templateCategories: ["characters", "scenes", "choices", "routes"],
 *   requiredFields: ["title", "protagonist"],
 *   recommendedPlugins: ["choice-flow-visualizer"]
 * };
 * ```
 */
export interface ProjectTypeDefinition {
  /** Unique type identifier (kebab-case recommended, e.g., "novel", "research-project") */
  id: string;

  /** Human-readable type name */
  name: string;

  /** Description of what this project type is for */
  description: string;

  /** Icon identifier for this project type */
  icon?: string;

  /** Optional category for grouping related types (e.g., "Creative Writing", "Research") */
  category?: string;

  /** Default settings applied when creating projects of this type */
  defaultSettings?: Partial<ProjectSettings>;

  /**
   * Template categories relevant to this project type
   *
   * When filtering templates, only categories in this list (plus global categories)
   * will be shown for projects of this type.
   *
   * @example ["creative-writing", "characters", "worldbuilding"] for fiction projects
   */
  templateCategories?: string[];

  /**
   * Required custom fields that must be set when creating this project type
   *
   * @example ["researchQuestion", "methodology"] for research projects
   */
  requiredFields?: string[];

  /**
   * Recommended plugins/extensions for this project type
   *
   * UI can suggest installing these when creating a project of this type
   */
  recommendedPlugins?: string[];

  /**
   * Custom metadata schema for this project type
   *
   * JSON Schema definition for type-specific metadata validation
   */
  metadataSchema?: Record<string, any>;
}

/**
 * Built-in project type definitions
 *
 * These are the default project types provided by Vespera Forge.
 * Additional types can be registered via plugins or user configuration.
 */
export const DEFAULT_PROJECT_TYPES: ProjectTypeDefinition[] = [
  {
    id: "fiction",
    name: "Fiction Writing",
    description: "Long-form fiction writing project",
    icon: "📖",
    category: "Creative Writing",
    defaultSettings: {
      enabledAutomation: true,
      customSettings: {}
    },
    templateCategories: ["creative-writing", "characters", "worldbuilding", "scenes", "chapters"],
    requiredFields: ["genre"]
  },
  {
    id: "research",
    name: "Research",
    description: "Academic or investigative research project",
    icon: "🔬",
    category: "Academia",
    defaultSettings: {
      enabledAutomation: false,
      customSettings: {}
    },
    templateCategories: ["research", "knowledge-management", "citations", "experiments"],
    requiredFields: ["researchQuestion"]
  },
  {
    id: "journalism",
    name: "Journalism",
    description: "News reporting and journalism project",
    icon: "📰",
    category: "Media",
    defaultSettings: {
      enabledAutomation: true,
      customSettings: {}
    },
    templateCategories: ["journalism", "interviews", "sources", "articles"],
    requiredFields: ["beat"]
  },
  {
    id: "ttrpg-campaign",
    name: "TTRPG Campaign",
    description: "Tabletop roleplaying game campaign management",
    icon: "🎲",
    category: "Gaming",
    defaultSettings: {
      enabledAutomation: true,
      customSettings: {}
    },
    templateCategories: ["ttrpg", "characters", "worldbuilding", "sessions", "npcs", "locations"],
    requiredFields: ["system"]
  },
  {
    id: "documentation",
    name: "Documentation",
    description: "Technical documentation and guides",
    icon: "📚",
    category: "Development",
    defaultSettings: {
      enabledAutomation: false,
      customSettings: {}
    },
    templateCategories: ["documentation", "guides", "api-reference", "tutorials"]
  },
  {
    id: "software-project",
    name: "Software Project",
    description: "Software development project documentation and planning",
    icon: "💻",
    category: "Development",
    defaultSettings: {
      enabledAutomation: true,
      customSettings: {}
    },
    templateCategories: ["software", "requirements", "architecture", "tasks", "sprints"],
    requiredFields: ["repository"]
  },
  {
    id: "knowledge-base",
    name: "Knowledge Base",
    description: "Personal or organizational knowledge management",
    icon: "📚",
    category: "Knowledge Management",
    defaultSettings: {
      enabledAutomation: false,
      customSettings: {}
    },
    templateCategories: ["knowledge-management", "notes", "concepts", "references"]
  },
  {
    id: "general",
    name: "General",
    description: "General-purpose project without specific constraints",
    icon: "📁",
    category: "General",
    defaultSettings: {
      enabledAutomation: false,
      customSettings: {}
    },
    templateCategories: [] // All categories available
  }
];

// =============================================================================
// METADATA AND SETTINGS
// =============================================================================

/**
 * Project metadata for tracking lifecycle and ownership
 *
 * Contains creation timestamp, update timestamp, optional author tracking,
 * versioning, tagging, and extensible custom fields.
 */
export interface ProjectMetadata {
  /** Immutable creation timestamp */
  createdAt: Date;

  /** Last modification timestamp - updated on any project change */
  updatedAt: Date;

  /** Optional user identifier who created the project (matches UserId from bindery.ts) */
  author?: UserId;

  /**
   * Semantic version string for project schema/structure changes
   * Format: MAJOR.MINOR.PATCH (e.g., "1.2.3")
   */
  version: string;

  /** Project-level tags for organization and filtering */
  tags?: string[];

  /** ID of the project template used to create this project */
  templateId?: string;

  /** Optional icon identifier (emoji or icon name) */
  icon?: string;

  /** Optional color theme for UI customization */
  color?: string;

  /** Additional custom metadata for extensibility */
  [key: string]: any;
}

/**
 * @deprecated Legacy metadata interface - Use enhanced ProjectMetadata
 * Kept for backward compatibility. Will be removed in Phase 16c.
 */
export interface LegacyProjectMetadata {
  templateId?: string;
  tags: string[];
  icon?: string;
  color?: string;
  author?: string;
  [key: string]: any;
}

/**
 * Project settings and configuration
 *
 * Contains user-configurable preferences that affect project behavior,
 * including template defaults, visual appearance, and feature flags.
 */
export interface ProjectSettings {
  /**
   * Default template category for new Codices in this project
   *
   * When a user creates a new Codex in this project without specifying a category,
   * templates from this category will be shown first.
   *
   * @example "creative-writing", "research", "worldbuilding"
   */
  defaultTemplateCategory?: string;

  /** Default Codex template ID for new Codices in this project */
  defaultCodexTemplate?: string;

  /**
   * Project visual identifier - hex color code
   * Used in UI for project badges, tree view items, etc.
   * @example "#4A90E2", "#E24A4A"
   */
  color?: string;

  /**
   * Project visual identifier - icon name
   * Icon identifier compatible with the UI framework icon set
   * @example "book", "microscope", "newspaper", "folder"
   */
  icon?: string;

  /**
   * Feature flags for enabling/disabling project capabilities
   *
   * Allows fine-grained control over which features are available in this project.
   */
  features?: ProjectFeatureFlags;

  /** Whether automation rules are enabled for this project */
  enabledAutomation: boolean;

  /** Default LLM chat provider for this project */
  chatProvider?: string;

  /**
   * Custom user-defined settings specific to project type
   *
   * Allows project type definitions to specify their own settings schema.
   * For example, a "fiction" project might have wordCountGoal: 80000
   */
  customSettings?: Record<string, any>;
}

/**
 * Feature flags for project capabilities
 *
 * Controls which advanced features are enabled for a project.
 * Features can be toggled independently based on user needs and preferences.
 */
export interface ProjectFeatureFlags {
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
// CORE PROJECT INTERFACE
// =============================================================================

/**
 * Core Project interface - the fundamental organizational entity
 *
 * Projects serve as mandatory containers for all content in the system.
 * Every Codex, template application, task, and workflow must be associated with a project.
 *
 * @example
 * ```typescript
 * const novelProject: IProject = {
 *   id: "550e8400-e29b-41d4-a716-446655440000",
 *   name: "The Quantum Prophecy",
 *   type: "fiction",
 *   description: "A sci-fi thriller set in 2145",
 *   metadata: {
 *     createdAt: new Date("2025-01-15T10:00:00Z"),
 *     updatedAt: new Date("2025-01-20T15:30:00Z"),
 *     author: "user-123",
 *     version: "1.0.0",
 *     tags: ["sci-fi", "thriller", "near-future"]
 *   },
 *   settings: {
 *     defaultTemplateCategory: "creative-writing",
 *     color: "#4A90E2",
 *     icon: "book",
 *     enabledAutomation: true,
 *     features: {
 *       automation: true,
 *       aiAssistant: true
 *     }
 *   },
 *   status: ProjectStatus.Active
 * };
 * ```
 */
export interface IProject {
  /** Unique project identifier (UUID) - matches ProjectId from bindery.ts */
  id: ProjectId;

  /**
   * Workspace ID this project belongs to
   *
   * Phase 17: Projects are workspace-level entities stored in database.
   * Each project is associated with exactly one workspace.
   *
   * @see {@link docs/development/decisions/ADR-015-workspace-project-context-hierarchy.md}
   */
  workspace_id: WorkspaceId;

  /** Human-readable project name (1-100 characters, alphanumeric with spaces/hyphens/underscores) */
  name: string;

  /**
   * Project type identifier (e.g., "fiction", "research", "journalism")
   *
   * IMPORTANT: This is NOT a hardcoded enum - project types are registered dynamically
   * via the ProjectTypeRegistry. New types can be added without code changes.
   *
   * @see {@link ProjectTypeDefinition} for type registration
   * @see {@link DEFAULT_PROJECT_TYPES} for built-in types
   */
  type: ProjectType;

  /** Optional project description for context and documentation */
  description?: string;

  /**
   * Currently active context ID within this project
   *
   * Phase 17: Projects contain multiple contexts (organizational lenses).
   * This tracks which context is currently active for this project.
   * Optional - may be null if no context is active.
   *
   * @see {@link docs/development/decisions/ADR-015-workspace-project-context-hierarchy.md}
   */
  active_context_id?: ContextId;

  /** Current project lifecycle status */
  status: ProjectStatus;

  /** Project metadata including timestamps, author, version, and tags */
  metadata: ProjectMetadata;

  /** Project-specific settings and configuration */
  settings: ProjectSettings;
}

/**
 * Legacy interface for backward compatibility
 * @deprecated Use IProject directly - will be removed in Phase 16c
 */
export interface IProjectSettings extends ProjectSettings {}

// =============================================================================
// INPUT AND UPDATE TYPES
// =============================================================================

/**
 * Input for creating a new project
 *
 * Requires name, workspace_id, and type. Other fields are optional or auto-generated:
 * - id: Generated as UUID
 * - metadata: Auto-populated with current timestamp, version "1.0.0"
 * - settings: Merged with project type defaults
 * - status: Defaults to ProjectStatus.Active
 * - active_context_id: Optional, can be set later
 *
 * @example
 * ```typescript
 * const input: CreateProjectInput = {
 *   name: "My Novel",
 *   workspace_id: "ws-123e4567-e89b-12d3-a456-426614174000",
 *   type: "fiction",
 *   description: "A gripping thriller",
 *   settings: {
 *     color: "#E24A4A",
 *     enabledAutomation: false, // Override default
 *     features: { automation: false }
 *   }
 * };
 * ```
 */
export type CreateProjectInput = Pick<IProject, "name" | "workspace_id" | "type"> &
  Partial<Omit<IProject, "id" | "name" | "workspace_id" | "type" | "metadata">>;

/**
 * Input for updating an existing project
 *
 * All fields except id, workspace_id, and metadata are optional.
 * - id: Cannot be changed (immutable identifier)
 * - workspace_id: Cannot be changed (projects cannot move between workspaces)
 * - metadata: Managed by the service (updatedAt, version auto-updated)
 * - active_context_id: Can be updated to switch active context
 *
 * @example
 * ```typescript
 * const update: UpdateProjectInput = {
 *   name: "The Quantum Prophecy (Revised)",
 *   active_context_id: "ctx-456",
 *   settings: {
 *     ...existingSettings,
 *     color: "#5A9FE2"
 *   }
 * };
 * ```
 */
export type UpdateProjectInput = Partial<Omit<IProject, "id" | "workspace_id" | "metadata">>;

/**
 * @deprecated Legacy create input - Use CreateProjectInput
 * Kept for backward compatibility. Will be removed in Phase 16c.
 */
export type ProjectCreateInput = Omit<IProject, 'id' | 'status' | 'metadata'> & {
  id?: ProjectId;
  status?: ProjectStatus;
  metadata?: Partial<ProjectMetadata>;
};

/**
 * @deprecated Legacy update input - Use UpdateProjectInput
 * Kept for backward compatibility. Will be removed in Phase 16c.
 */
export type ProjectUpdateInput = Partial<Omit<IProject, 'id' | 'metadata'>> & {
  id: ProjectId;
  metadata?: Partial<ProjectMetadata>;
};

/**
 * @deprecated Legacy create input interface - Use CreateProjectInput type
 * Will be removed in Phase 16c.
 */
export interface IProjectCreateInput {
  name: string;
  type: string;
  description?: string;
  settings?: Partial<IProjectSettings>;
}

/**
 * @deprecated Legacy update input interface - Use UpdateProjectInput type
 * Will be removed in Phase 16c.
 */
export interface IProjectUpdateInput extends ProjectUpdateInput {}

/**
 * Project list item for efficient listing operations
 * Contains minimal info for navigator/picker displays
 */
export interface ProjectListItem {
  id: ProjectId;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  updatedAt: Date;
  icon?: string;
  color?: string;
}

/**
 * Validation result for project operations
 */
export interface ProjectValidationResult {
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
 * Project query filters for listing operations
 */
export interface ProjectQueryFilters {
  /** Filter by project type */
  type?: ProjectType | ProjectType[];

  /** Filter by project status */
  status?: ProjectStatus | ProjectStatus[];

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
 * Project statistics for dashboard/overview
 */
export interface ProjectStats {
  /** Total number of projects */
  total: number;

  /** Count by project type */
  byType: Record<ProjectType, number>;

  /** Count by status */
  byStatus: Record<ProjectStatus, number>;

  /** Most recently updated project */
  recentlyUpdated?: ProjectListItem;

  /** Oldest project */
  oldest?: ProjectListItem;
}

/**
 * Constants for project validation
 */
export const PROJECT_CONSTANTS = {
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
    PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  }
} as const;

/**
 * Project type metadata for UI and validation
 */
export const PROJECT_TYPE_METADATA: Record<ProjectType, {
  label: string;
  description: string;
  icon: string;
  color: string;
  defaultTemplates: string[];
}> = {
  journalism: {
    label: 'Journalism',
    description: 'Interviews, sources, articles, fact-checking',
    icon: '📰',
    color: '#2196F3',
    defaultTemplates: ['interview', 'article', 'source', 'fact-check']
  },
  research: {
    label: 'Research',
    description: 'Papers, notes, references, experiments',
    icon: '🔬',
    color: '#4CAF50',
    defaultTemplates: ['paper', 'experiment', 'note', 'reference']
  },
  fiction: {
    label: 'Fiction Writing',
    description: 'Characters, scenes, chapters, worldbuilding',
    icon: '📖',
    color: '#9C27B0',
    defaultTemplates: ['character', 'scene', 'chapter', 'world']
  },
  documentation: {
    label: 'Documentation',
    description: 'Technical docs, guides, API references',
    icon: '📚',
    color: '#FF9800',
    defaultTemplates: ['guide', 'api-reference', 'tutorial', 'faq']
  },
  general: {
    label: 'General',
    description: 'Flexible project for any purpose',
    icon: '📁',
    color: '#607D8B',
    defaultTemplates: ['note', 'folder', 'task']
  }
};

// =============================================================================
// QUERY AND FILTERING TYPES
// =============================================================================

/**
 * Options for filtering project queries
 *
 * All filters are optional and applied as AND conditions.
 * Used in ProjectService.listProjects() and UI filter controls.
 *
 * @example
 * ```typescript
 * const filters: ProjectFilterOptions = {
 *   type: "fiction",
 *   status: ProjectStatus.Active,
 *   tags: ["sci-fi"],
 *   searchTerm: "quantum"
 * };
 * // Returns active fiction projects tagged "sci-fi" with "quantum" in name/description
 * ```
 */
export interface ProjectFilterOptions {
  /** Filter by project type (exact match) */
  type?: string;

  /** Filter by project status (exact match) */
  status?: ProjectStatus;

  /** Filter by tags (project must have ALL specified tags) */
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
   * @example { genre: "sci-fi", wordCount: { $gte: 50000 } }
   */
  customFilters?: Record<string, any>;
}

/**
 * Options for sorting project queries
 *
 * Specifies sort field and direction. Used in ProjectService.listProjects().
 *
 * @example
 * ```typescript
 * const sort: ProjectSortOptions = {
 *   field: "updatedAt",
 *   direction: "desc"
 * };
 * // Returns projects ordered by most recently updated
 * ```
 */
export interface ProjectSortOptions {
  /** Field to sort by */
  field: "name" | "createdAt" | "updatedAt" | "type" | "status";

  /** Sort direction */
  direction: "asc" | "desc";
}

/**
 * Paginated query result for project listings
 *
 * Supports efficient rendering of large project lists with pagination.
 *
 * @example
 * ```typescript
 * const result: ProjectQueryResult = {
 *   projects: [project1, project2, project3],
 *   total: 47,
 *   hasMore: true,
 *   page: 1,
 *   pageSize: 20
 * };
 * ```
 */
export interface ProjectQueryResult {
  /** Projects matching the query (paginated subset) */
  projects: IProject[];

  /** Total number of projects matching the query (unpaginated) */
  total: number;

  /** Whether there are more results beyond this page */
  hasMore: boolean;

  /** Current page number (0-indexed) */
  page?: number;

  /** Number of results per page */
  pageSize?: number;
}

/**
 * @deprecated Legacy query filters - Use ProjectFilterOptions
 * Kept for backward compatibility. Will be removed in Phase 16c.
 */
export interface ProjectQueryFilters {
  type?: ProjectType | ProjectType[];
  status?: ProjectStatus | ProjectStatus[];
  tags?: string[];
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Minimal project information for lightweight operations
 *
 * Used in tree views, dropdowns, and other UI contexts where full project
 * data is unnecessary.
 */
export interface ProjectSummary {
  id: ProjectId;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  color?: string;
  icon?: string;
}

/**
 * Project with relationship counts for dashboard displays
 *
 * Extends IProject with computed statistics about associated content.
 */
export interface ProjectWithStats extends IProject {
  stats: {
    /** Number of Codices in this project */
    codexCount: number;

    /** Number of active tasks in this project */
    activeTaskCount: number;

    /** Number of completed tasks in this project */
    completedTaskCount: number;

    /** Number of templates used in this project */
    templateCount: number;

    /** Last activity timestamp (most recent Codex update) */
    lastActivityAt?: Date;
  };
}

/**
 * @deprecated Legacy list item - Use ProjectSummary
 * Kept for backward compatibility. Will be removed in Phase 16c.
 */
export interface ProjectListItem {
  id: ProjectId;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  updatedAt: Date;
  icon?: string;
  color?: string;
}

/**
 * @deprecated Legacy stats - Use ProjectWithStats
 * Kept for backward compatibility. Will be removed in Phase 16c.
 */
export interface ProjectStats {
  total: number;
  byType: Record<ProjectType, number>;
  byStatus: Record<ProjectStatus, number>;
  recentlyUpdated?: ProjectListItem;
  oldest?: ProjectListItem;
}

// =============================================================================
// SERIALIZATION AND PERSISTENCE
// =============================================================================

/**
 * Serializable project representation
 *
 * Type alias for IProject with Date fields as strings.
 * Useful for type-safe JSON operations.
 */
export type SerializableProject = Omit<IProject, 'metadata'> & {
  metadata: Omit<ProjectMetadata, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
  };
};

/**
 * Serialize project for JSON storage
 *
 * Converts Date objects to ISO 8601 strings for JSON compatibility.
 * Used when persisting projects to workspace storage or files.
 *
 * @param project - Project to serialize
 * @returns JSON string representation
 *
 * @example
 * ```typescript
 * const json = serializeProject(myProject);
 * await workspace.fs.writeFile(uri, Buffer.from(json, 'utf8'));
 * ```
 */
export function serializeProject(project: IProject): string {
  return JSON.stringify(project, (key, value) => {
    // Convert Dates to ISO strings
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }, 2);
}

/**
 * Deserialize project from JSON storage
 *
 * Converts ISO 8601 strings back to Date objects.
 * Used when loading projects from workspace storage or files.
 *
 * @param json - JSON string to deserialize
 * @returns Reconstructed project object
 *
 * @example
 * ```typescript
 * const json = await workspace.fs.readFile(uri);
 * const project = deserializeProject(json.toString());
 * ```
 */
export function deserializeProject(json: string): IProject {
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

  return obj as IProject;
}

// =============================================================================
// TYPE GUARDS AND VALIDATORS
// =============================================================================

/**
 * Type guard to check if an object is a valid IProject
 *
 * Performs runtime type checking for structural validity.
 * Does NOT validate business rules (e.g., name length, type registration).
 *
 * @param obj - Object to check
 * @returns True if object matches IProject structure
 *
 * @example
 * ```typescript
 * if (isProject(data)) {
 *   // TypeScript knows data is IProject
 *   console.log(data.name);
 * }
 * ```
 */
export function isProject(obj: any): obj is IProject {
  return obj &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.type === "string" &&
    obj.metadata &&
    typeof obj.metadata === "object" &&
    obj.metadata.createdAt instanceof Date &&
    obj.metadata.updatedAt instanceof Date &&
    typeof obj.metadata.version === "string" &&
    obj.settings &&
    typeof obj.settings === "object" &&
    typeof obj.status === "string" &&
    Object.values(ProjectStatus).includes(obj.status);
}

/**
 * Validate project name format
 *
 * Rules:
 * - Length: 1-100 characters
 * - Characters: Alphanumeric, spaces, hyphens, underscores
 * - No leading/trailing whitespace
 *
 * @param name - Project name to validate
 * @returns True if valid
 *
 * @example
 * ```typescript
 * validateProjectName("My Novel"); // true
 * validateProjectName("A".repeat(101)); // false
 * validateProjectName(""); // false
 * ```
 */
export function validateProjectName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  const trimmed = name.trim();

  return trimmed.length > 0 &&
         trimmed.length <= 100 &&
         PROJECT_CONSTANTS.NAME.PATTERN.test(trimmed) &&
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
 * Type guard for ProjectTypeDefinition
 *
 * @param obj - Object to check
 * @returns True if object matches ProjectTypeDefinition structure
 */
export function isProjectTypeDefinition(obj: any): obj is ProjectTypeDefinition {
  return obj &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.description === "string";
}

/**
 * @deprecated Legacy type guard - Only checks legacy hardcoded types
 * Use project type registry instead. Will be removed in Phase 16c.
 */
export function isProjectType(type: any): type is LegacyProjectType {
  return ['journalism', 'research', 'fiction', 'documentation', 'general'].includes(type);
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Default project settings factory
 *
 * Creates a ProjectSettings object with sensible defaults.
 *
 * @returns Default ProjectSettings
 */
export function createDefaultProjectSettings(): ProjectSettings {
  return {
    enabledAutomation: false,
    customSettings: {}
  };
}

/**
 * Default project metadata factory
 *
 * Creates a ProjectMetadata object with current timestamps and version 1.0.0.
 *
 * @returns Default ProjectMetadata
 */
export function createDefaultProjectMetadata(): ProjectMetadata {
  const now = new Date();
  return {
    createdAt: now,
    updatedAt: now,
    version: "1.0.0",
    tags: []
  };
}

/**
 * Extract project summary from full project
 *
 * @param project - Full project object
 * @returns Minimal project summary
 */
export function toProjectSummary(project: IProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    type: project.type,
    status: project.status,
    color: project.settings.color || project.metadata.color,
    icon: project.settings.icon || project.metadata.icon
  };
}
