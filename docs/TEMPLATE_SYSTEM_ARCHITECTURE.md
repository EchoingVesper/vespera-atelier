# Template System Architecture

## Executive Summary

The **Vespera Template System** addresses the critical architectural gap identified in the Codex architecture by providing a **universal, dynamic template system** that replaces hardcoded enums with flexible, shareable template files. This system enables users to have "templates for *everything*" as requested - from tasks and character archetypes to worldbuilding components and entire project workflows - all while supporting multi-project vaults and seamless template sharing.

The template system transforms the Vespera platform from a fixed-type system to a **user-extensible content platform** where anyone can define new content types, workflows, and organizational structures through simple JSON5 template files.

## Core Vision: Templates for Everything

### Universal Template Principle

```text
Traditional System:                    Template-Driven System:
├── Hardcoded CodexTypes              ├── Dynamic CodexTypes (.json5 templates)
│   ├── task (fixed)                  │   ├── custom_task_type.json5
│   ├── character (fixed)             │   ├── fantasy_character.json5
│   └── scene (fixed)                 │   ├── academic_paper_section.json5
└── Fixed UI Forms                    │   └── worldbuilding_location.json5
                                      ├── Template Inheritance
                                      │   ├── base_character.json5
                                      │   ├── npc_character.json5 (extends base)
                                      │   └── protagonist.json5 (extends base)
                                      └── Cross-Project Templates
                                          ├── coding_project_templates/
                                          ├── worldbuilding_templates/
                                          └── academic_templates/
```

**Key Innovation**: Instead of developers defining content types, **users define them** through template files, making the system infinitely extensible and customizable to any workflow.

## 1. Template File Format Specification

### 1.1 Core Template Structure (.json5)

Every template is stored as a `.json5` file enabling comments, trailing commas, and human-friendly syntax:

```json5
{
  // Template Metadata
  "template_id": "fantasy_character_v1",
  "name": "Fantasy Character",
  "description": "Complete fantasy character archetype with relationships, backstory, and progression",
  "version": "1.2.0",
  "author": "user@example.com",
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T14:45:00Z",
  
  // Template Inheritance
  "extends": "base_character_v1", // Optional parent template
  "category": "worldbuilding",
  "tags": ["character", "fantasy", "rpg", "worldbuilding"],
  
  // Dynamic CodexType Definition
  "codex_type": {
    "name": "fantasy_character",
    "display_name": "Fantasy Character",
    "icon": "user-circle",
    "color": "#8B5CF6",
    "plural": "fantasy_characters"
  },
  
  // Content Structure Definition
  "field_schema": {
    // Basic Information
    "character_name": {
      "type": "string",
      "required": true,
      "display_name": "Character Name",
      "placeholder": "Enter character's full name",
      "validation": {
        "min_length": 2,
        "max_length": 100
      }
    },
    
    "aliases": {
      "type": "array",
      "subtype": "string",
      "display_name": "Known As",
      "description": "Other names, titles, or aliases",
      "default": []
    },
    
    // Physical Characteristics
    "appearance": {
      "type": "object",
      "display_name": "Appearance",
      "fields": {
        "age": {"type": "number", "min": 0, "max": 10000},
        "height": {"type": "string", "placeholder": "5'8\""},
        "build": {
          "type": "select", 
          "options": ["slim", "athletic", "stocky", "muscular", "heavy"],
          "allow_custom": true
        },
        "distinguishing_features": {
          "type": "text",
          "placeholder": "Scars, tattoos, unique features..."
        }
      }
    },
    
    // Fantasy-Specific Fields
    "race_species": {
      "type": "string",
      "display_name": "Race/Species",
      "suggestions": ["Human", "Elf", "Dwarf", "Halfling", "Orc", "Dragonborn"],
      "allow_custom": true
    },
    
    "class_profession": {
      "type": "string", 
      "display_name": "Class/Profession",
      "suggestions": ["Warrior", "Mage", "Rogue", "Cleric", "Ranger", "Bard"],
      "allow_custom": true
    },
    
    "magical_abilities": {
      "type": "array",
      "subtype": "object",
      "display_name": "Magical Abilities",
      "fields": {
        "ability_name": {"type": "string", "required": true},
        "description": {"type": "text"},
        "power_level": {
          "type": "select",
          "options": ["Cantrip", "Minor", "Major", "Legendary"]
        }
      }
    },
    
    // Relationship System (Cross-Template References)
    "relationships": {
      "type": "array",
      "subtype": "object",
      "display_name": "Relationships",
      "fields": {
        "character_ref": {
          "type": "codex_reference",
          "filter": {"codex_type": ["fantasy_character", "character"]},
          "display_name": "Character"
        },
        "relationship_type": {
          "type": "select",
          "options": ["Family", "Friend", "Enemy", "Rival", "Ally", "Romantic", "Mentor", "Student"],
          "allow_custom": true
        },
        "description": {"type": "text", "placeholder": "Nature of the relationship..."},
        "strength": {
          "type": "range", 
          "min": 1, 
          "max": 10, 
          "display_name": "Relationship Strength"
        }
      }
    },
    
    // Backstory and Development
    "backstory": {
      "type": "rich_text",
      "display_name": "Backstory",
      "template_content": "## Early Life\n\n## Formative Events\n\n## Recent History\n\n"
    },
    
    "character_arc": {
      "type": "object",
      "display_name": "Character Development",
      "fields": {
        "current_goal": {"type": "text", "required": true},
        "internal_conflict": {"type": "text"},
        "character_growth": {"type": "text"},
        "resolution": {"type": "text"}
      }
    },
    
    // Location References
    "home_location": {
      "type": "codex_reference",
      "filter": {"codex_type": ["location", "worldbuilding_location"]},
      "display_name": "Home Location",
      "optional": true
    }
  },
  
  // UI Layout Configuration
  "ui_layout": {
    "view_modes": [
      {
        "name": "character_sheet",
        "display_name": "Character Sheet",
        "icon": "scroll",
        "layout": "tabs",
        "tabs": [
          {
            "name": "basics",
            "display_name": "Basics",
            "fields": ["character_name", "aliases", "appearance", "race_species", "class_profession"]
          },
          {
            "name": "abilities",
            "display_name": "Abilities", 
            "fields": ["magical_abilities"]
          },
          {
            "name": "relationships",
            "display_name": "Relationships",
            "fields": ["relationships"]
          },
          {
            "name": "story",
            "display_name": "Story",
            "fields": ["backstory", "character_arc", "home_location"]
          }
        ]
      },
      {
        "name": "relationship_map",
        "display_name": "Relationship Map",
        "icon": "network",
        "component": "relationship_graph_view"
      },
      {
        "name": "quick_reference",
        "display_name": "Quick Reference",
        "icon": "bookmark",
        "layout": "compact",
        "fields": ["character_name", "race_species", "class_profession", "current_goal"]
      }
    ],
    "default_view": "character_sheet",
    "card_view": {
      "title_field": "character_name",
      "subtitle_field": "race_species",
      "description_field": "current_goal",
      "image_field": "portrait_url"
    }
  },
  
  // Automation Rules
  "automation_rules": [
    {
      "trigger": "field_changed",
      "field": "home_location",
      "action": "update_linked_codices",
      "params": {
        "add_relationship": {
          "type": "location_resident",
          "bidirectional": true
        }
      }
    },
    {
      "trigger": "created",
      "action": "create_related_tasks",
      "params": {
        "tasks": [
          {
            "title": "Develop {{character_name}}'s Backstory",
            "type": "task",
            "priority": "normal",
            "template_id": "character_development_task"
          }
        ]
      }
    }
  ],
  
  // Template Parameters (for instantiation)
  "parameters": [
    {
      "name": "PROJECT_NAME",
      "type": "string",
      "required": true,
      "display_name": "Project Name",
      "description": "Name of the project this character belongs to"
    },
    {
      "name": "SETTING_TYPE", 
      "type": "select",
      "options": ["high_fantasy", "low_fantasy", "urban_fantasy", "historical"],
      "default": "high_fantasy",
      "display_name": "Setting Type"
    }
  ],
  
  // Export and Sharing
  "sharing": {
    "shareable": true,
    "license": "CC-BY-SA-4.0",
    "attribution_required": true,
    "modifications_allowed": true
  }
}
```

### 1.2 Template Inheritance System

Templates can extend other templates, enabling hierarchical customization:

```json5
// base_character.json5
{
  "template_id": "base_character_v1",
  "name": "Base Character",
  "field_schema": {
    "name": {"type": "string", "required": true},
    "description": {"type": "text"},
    "tags": {"type": "array", "subtype": "string"}
  }
}

// fantasy_character.json5  
{
  "template_id": "fantasy_character_v1",
  "extends": "base_character_v1",
  "field_schema": {
    // Inherits: name, description, tags
    "race": {"type": "string", "required": true},
    "class": {"type": "string"},
    "magical_abilities": {"type": "array"}
  }
}

// npc_character.json5
{
  "template_id": "npc_character_v1", 
  "extends": "fantasy_character_v1",
  "field_schema": {
    // Inherits all fantasy_character + base_character fields
    "interaction_frequency": {
      "type": "select",
      "options": ["one-time", "recurring", "major"]
    },
    "plot_importance": {"type": "range", "min": 1, "max": 10}
  }
}
```

## 2. Dynamic CodexType Registration System

### 2.1 Template-Driven Type Discovery

The system dynamically discovers and registers new CodexTypes from template files:

```typescript
interface DynamicCodexType {
  // Core identification
  id: string                    // Generated from template_id
  name: string                  // From template.codex_type.name
  displayName: string           // From template.codex_type.display_name
  
  // UI Configuration
  icon: string                  // Icon identifier
  color: string                 // Hex color for UI elements
  plural: string                // Plural form for collections
  
  // Schema Definition
  fieldSchema: FieldDefinition[]
  uiLayout: UILayoutConfig
  
  // Template Metadata
  templatePath: string          // Path to defining template file
  version: string              // Template version
  extends?: string             // Parent template ID
  
  // Behavior Configuration
  automationRules: AutomationRule[]
  validationRules: ValidationRule[]
  
  // Methods
  createInstance(data: any): Promise<CodexEntry>
  validateInstance(data: any): ValidationResult
  getAvailableViews(): ViewType[]
}

class CodexTypeRegistry {
  private types = new Map<string, DynamicCodexType>()
  private templateWatcher: FileWatcher
  
  async loadAllTemplates(): Promise<void> {
    // Scan for .json5 files in template directories
    const templateFiles = await this.discoverTemplateFiles()
    
    for (const file of templateFiles) {
      await this.loadTemplate(file)
    }
    
    // Resolve inheritance after all templates loaded
    this.resolveInheritance()
  }
  
  private async loadTemplate(filePath: string): Promise<void> {
    try {
      const content = await this.readTemplateFile(filePath)
      const template = JSON5.parse(content)
      
      const codexType = this.convertTemplateToCodexType(template)
      this.types.set(codexType.id, codexType)
      
      // Watch for changes
      this.templateWatcher.watch(filePath, () => this.reloadTemplate(filePath))
      
    } catch (error) {
      console.error(`Failed to load template ${filePath}:`, error)
    }
  }
  
  private resolveInheritance(): void {
    // Process inheritance chain to merge field schemas
    for (const [id, type] of this.types) {
      if (type.extends) {
        const parentType = this.types.get(type.extends)
        if (parentType) {
          type.fieldSchema = this.mergeFieldSchemas(parentType.fieldSchema, type.fieldSchema)
          type.uiLayout = this.mergeUILayouts(parentType.uiLayout, type.uiLayout)
        }
      }
    }
  }
  
  getType(typeId: string): DynamicCodexType | null {
    return this.types.get(typeId) || null
  }
  
  getAllTypes(): DynamicCodexType[] {
    return Array.from(this.types.values())
  }
  
  getTypesByCategory(category: string): DynamicCodexType[] {
    return this.getAllTypes().filter(type => 
      type.templatePath.includes(`/${category}/`)
    )
  }
}
```

### 2.2 Field Type System

The template system supports rich field types with validation and UI hints:

```typescript
interface FieldDefinition {
  name: string
  type: FieldType
  required?: boolean
  displayName?: string
  description?: string
  placeholder?: string
  
  // Type-specific properties
  validation?: ValidationConfig
  uiHints?: UIHints
  
  // For object and array types
  fields?: Record<string, FieldDefinition>
  subtype?: FieldType
  
  // For select types
  options?: string[]
  allowCustom?: boolean
  suggestions?: string[]
  
  // For reference types
  filter?: CodexFilter
  
  // Default value
  default?: any
}

enum FieldType {
  STRING = "string",
  TEXT = "text",
  RICH_TEXT = "rich_text",
  NUMBER = "number", 
  BOOLEAN = "boolean",
  DATE = "date",
  DATETIME = "datetime",
  SELECT = "select",
  MULTISELECT = "multiselect",
  ARRAY = "array",
  OBJECT = "object",
  CODEX_REFERENCE = "codex_reference",
  CODEX_REFERENCE_LIST = "codex_reference_list",
  FILE_REFERENCE = "file_reference",
  IMAGE = "image",
  URL = "url",
  EMAIL = "email",
  RANGE = "range",
  COLOR = "color",
  JSON = "json"
}

interface ValidationConfig {
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  customValidator?: string  // Name of registered validator function
  required?: boolean
}

interface UIHints {
  widget?: "input" | "textarea" | "select" | "checkbox" | "radio" | "slider" | "color_picker"
  rows?: number           // For textarea
  columns?: number        // For grid layouts
  placeholder?: string
  helpText?: string
  showLabel?: boolean
  inline?: boolean
}
```

## 3. Template Discovery and Loading

### 3.1 Template Directory Structure

```text
Obsidian Vault Root/
├── .vespera-templates/                 # Template system directory
│   ├── core/                          # Built-in templates
│   │   ├── base_task.json5
│   │   ├── base_character.json5
│   │   └── base_location.json5
│   ├── project_types/                 # Project-specific template collections
│   │   ├── coding/                    # Software development templates
│   │   │   ├── project_templates.json5
│   │   │   ├── bug_report.json5
│   │   │   ├── feature_request.json5
│   │   │   └── code_review.json5
│   │   ├── worldbuilding/             # Fantasy/worldbuilding templates
│   │   │   ├── fantasy_character.json5
│   │   │   ├── location.json5
│   │   │   ├── magic_system.json5
│   │   │   └── timeline_event.json5
│   │   ├── academic/                  # Research and academic templates
│   │   │   ├── research_paper.json5
│   │   │   ├── literature_review.json5
│   │   │   ├── methodology.json5
│   │   │   └── citation.json5
│   │   └── ttrpg/                     # Tabletop RPG templates
│   │       ├── campaign.json5
│   │       ├── session.json5
│   │       ├── encounter.json5
│   │       └── treasure.json5
│   ├── user/                          # User-created templates
│   │   └── custom_templates/
│   └── shared/                        # Shared/downloaded templates
│       └── community_templates/
├── templates/                         # Legacy/Obsidian templates (for migration)
└── Projects/                          # User content organized by project
    ├── My Novel/                      # Uses worldbuilding templates
    │   ├── Characters/
    │   │   ├── Protagonist.codex.md   # Uses fantasy_character template
    │   │   └── Antagonist.codex.md
    │   ├── Locations/
    │   │   └── Capital City.codex.md  # Uses location template
    │   └── Plot/
    │       └── Main Arc.codex.md
    ├── Research Project/              # Uses academic templates
    │   ├── Papers/
    │   └── Citations/
    └── Game Dev Project/              # Uses coding templates
        ├── Features/
        └── Bugs/
```

### 3.2 Template Loading Pipeline

```typescript
class TemplateLoader {
  private loadOrder = [
    'core',           // Load core templates first
    'project_types',  // Then project-specific templates
    'user',          // User templates can override/extend
    'shared'         // Shared templates last
  ]
  
  async loadAllTemplates(): Promise<LoadResult> {
    const results: LoadResult = {
      loaded: [],
      failed: [],
      conflicts: []
    }
    
    for (const directory of this.loadOrder) {
      const dirResults = await this.loadFromDirectory(directory)
      results.loaded.push(...dirResults.loaded)
      results.failed.push(...dirResults.failed)
      
      // Handle conflicts (same template_id from different sources)
      this.resolveConflicts(dirResults.conflicts, directory)
    }
    
    // Post-load processing
    await this.resolveInheritance(results.loaded)
    await this.validateDependencies(results.loaded)
    
    return results
  }
  
  private async loadFromDirectory(directory: string): Promise<LoadResult> {
    const templateFiles = await this.findTemplateFiles(`.vespera-templates/${directory}`)
    const results: LoadResult = { loaded: [], failed: [], conflicts: [] }
    
    for (const file of templateFiles) {
      try {
        const template = await this.parseTemplateFile(file)
        
        // Check for conflicts
        if (this.registry.hasTemplate(template.template_id)) {
          results.conflicts.push({
            templateId: template.template_id,
            existing: this.registry.getTemplate(template.template_id).path,
            new: file.path
          })
        } else {
          this.registry.register(template)
          results.loaded.push(template)
        }
      } catch (error) {
        results.failed.push({ file: file.path, error: error.message })
      }
    }
    
    return results
  }
  
  private resolveConflicts(conflicts: TemplateConflict[], source: string): void {
    // Strategy: later sources in loadOrder override earlier ones
    for (const conflict of conflicts) {
      if (this.shouldOverride(source)) {
        this.registry.override(conflict.templateId, conflict.new)
      }
    }
  }
}
```

## 4. Multi-Project Template Organization

### 4.1 Project Template Switching

The template system supports seamless switching between different project types within the same vault:

```typescript
interface ProjectContext {
  name: string
  type: ProjectType
  activeTemplateSet: string[]
  templateOverrides: Record<string, string>
  defaultCodexTypes: string[]
}

enum ProjectType {
  CODING = "coding",
  WORLDBUILDING = "worldbuilding", 
  ACADEMIC = "academic",
  TTRPG = "ttrpg",
  MIXED = "mixed"
}

class ProjectTemplateManager {
  private activeProject: ProjectContext | null = null
  private projectContexts = new Map<string, ProjectContext>()
  
  async switchProject(projectName: string): Promise<void> {
    const context = await this.loadProjectContext(projectName)
    
    if (context) {
      this.activeProject = context
      await this.activateTemplateSet(context.activeTemplateSet)
      this.updateUI(context)
      
      // Trigger event for UI updates
      this.events.emit('project-switched', context)
    }
  }
  
  private async activateTemplateSet(templateIds: string[]): Promise<void> {
    // Enable only the templates for this project type
    this.registry.setActiveTemplates(templateIds)
    
    // Update available CodexTypes in UI
    const types = templateIds.map(id => this.registry.getType(id)).filter(Boolean)
    this.ui.updateAvailableTypes(types)
  }
  
  async createProjectContext(projectName: string, projectType: ProjectType): Promise<ProjectContext> {
    const templateSets = {
      [ProjectType.CODING]: [
        'base_task', 'bug_report', 'feature_request', 'code_review',
        'sprint', 'epic', 'repository'
      ],
      [ProjectType.WORLDBUILDING]: [
        'fantasy_character', 'location', 'magic_system', 'timeline_event',
        'faction', 'artifact', 'quest'
      ],
      [ProjectType.ACADEMIC]: [
        'research_paper', 'literature_review', 'methodology', 'citation',
        'research_question', 'dataset', 'analysis'
      ],
      [ProjectType.TTRPG]: [
        'campaign', 'session', 'encounter', 'treasure', 'npc',
        'location', 'quest_hook'
      ]
    }
    
    const context: ProjectContext = {
      name: projectName,
      type: projectType,
      activeTemplateSet: templateSets[projectType] || [],
      templateOverrides: {},
      defaultCodexTypes: templateSets[projectType]?.slice(0, 3) || []
    }
    
    this.projectContexts.set(projectName, context)
    await this.saveProjectContext(context)
    
    return context
  }
}
```

### 4.2 Template Set Management

```json5
// .vespera-templates/project_sets/worldbuilding_complete.json5
{
  "set_id": "worldbuilding_complete_v1",
  "name": "Complete Worldbuilding Suite",
  "description": "Comprehensive templates for fantasy worldbuilding projects",
  "version": "1.0.0",
  
  "included_templates": [
    // Character templates
    "fantasy_character_v1",
    "npc_character_v1", 
    "antagonist_v1",
    
    // Location templates
    "location_v1",
    "settlement_v1",
    "dungeon_v1",
    
    // Story templates
    "quest_v1",
    "scene_v1",
    "plot_thread_v1",
    
    // System templates  
    "magic_system_v1",
    "faction_v1",
    "timeline_event_v1",
    "artifact_v1"
  ],
  
  "ui_configuration": {
    "primary_types": ["fantasy_character", "location", "quest"],
    "quick_create_buttons": [
      {"template": "fantasy_character_v1", "label": "Character", "icon": "user"},
      {"template": "location_v1", "label": "Location", "icon": "map-pin"},
      {"template": "quest_v1", "label": "Quest", "icon": "scroll"}
    ],
    "dashboard_widgets": [
      {"type": "character_relationship_graph"},
      {"type": "location_map"}, 
      {"type": "quest_progress"}
    ]
  },
  
  "default_automations": [
    {
      "when": "character_created",
      "create": "character_development_task",
      "link_to": "main_story_project"
    }
  ]
}
```

## 5. Template Sharing Mechanism

### 5.1 Hash-Based Template Sharing

Templates can be shared via compact hash strings that encode the template structure:

```typescript
class TemplateShareManager {
  async generateShareHash(template: Template): Promise<string> {
    // Create minimal sharing payload
    const sharePayload: TemplateSharePayload = {
      template_id: template.template_id,
      name: template.name,
      version: template.version,
      field_schema: template.field_schema,
      ui_layout: template.ui_layout,
      automation_rules: template.automation_rules,
      sharing: template.sharing
    }
    
    // Compress and encode
    const compressed = await this.compress(JSON.stringify(sharePayload))
    const hash = this.base64Encode(compressed)
    
    // Store in sharing registry for retrieval
    await this.shareRegistry.store(hash, sharePayload)
    
    return `vespera-template://${hash}`
  }
  
  async importFromHash(shareHash: string): Promise<Template> {
    // Extract hash from URL
    const hash = shareHash.replace('vespera-template://', '')
    
    // Retrieve from registry or decode directly
    let payload: TemplateSharePayload
    if (await this.shareRegistry.exists(hash)) {
      payload = await this.shareRegistry.retrieve(hash)
    } else {
      // Decode directly from hash
      const compressed = this.base64Decode(hash)
      const json = await this.decompress(compressed)
      payload = JSON.parse(json)
    }
    
    // Convert to full template
    const template = this.convertPayloadToTemplate(payload)
    
    // Validate before importing
    const validation = await this.validator.validate(template)
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`)
    }
    
    return template
  }
  
  async shareToClipboard(template: Template): Promise<void> {
    const hash = await this.generateShareHash(template)
    
    const shareText = `# ${template.name}
${template.description}

Import this template by pasting the following into Vespera:
${hash}

Or save as ${template.template_id}.json5 in your .vespera-templates/user/ directory.`
    
    await navigator.clipboard.writeText(shareText)
    this.notifications.show(`Template "${template.name}" copied to clipboard!`)
  }
}
```

### 5.2 File-Based Template Sharing

Templates can also be shared as portable JSON5 files:

```typescript
class TemplateExporter {
  async exportTemplate(template: Template, options: ExportOptions): Promise<ExportedTemplate> {
    const exported: ExportedTemplate = {
      ...template,
      exported_at: new Date().toISOString(),
      exported_by: options.authorInfo,
      export_version: "1.0.0"
    }
    
    if (options.includeContent) {
      // Include sample content created with this template
      exported.sample_content = await this.getSampleContent(template.template_id)
    }
    
    if (options.bundleDependencies) {
      // Include all parent templates in inheritance chain
      exported.dependencies = await this.resolveDependencies(template.extends)
    }
    
    return exported
  }
  
  async importTemplateFile(filePath: string): Promise<ImportResult> {
    try {
      const content = await this.fs.readFile(filePath)
      const template = JSON5.parse(content)
      
      // Validate structure
      const validation = await this.validator.validateImported(template)
      if (!validation.valid) {
        return { success: false, errors: validation.errors }
      }
      
      // Handle dependencies
      if (template.dependencies) {
        await this.importDependencies(template.dependencies)
      }
      
      // Install template
      await this.installer.install(template)
      
      return { success: true, templateId: template.template_id }
      
    } catch (error) {
      return { success: false, errors: [error.message] }
    }
  }
}
```

## 6. Template Inheritance and Customization

### 6.1 Inheritance Resolution Engine

```typescript
class TemplateInheritanceResolver {
  async resolveInheritance(template: Template): Promise<ResolvedTemplate> {
    const inheritanceChain = await this.buildInheritanceChain(template)
    
    // Merge from root to leaf
    let resolved = this.createEmptyTemplate(template.template_id)
    
    for (const ancestorId of inheritanceChain) {
      const ancestor = await this.registry.getTemplate(ancestorId)
      resolved = this.mergeTemplates(resolved, ancestor)
    }
    
    // Apply the final template
    resolved = this.mergeTemplates(resolved, template)
    
    return resolved
  }
  
  private async buildInheritanceChain(template: Template): Promise<string[]> {
    const chain: string[] = []
    let current = template
    
    while (current.extends) {
      if (chain.includes(current.extends)) {
        throw new Error(`Circular inheritance detected: ${chain.join(' -> ')} -> ${current.extends}`)
      }
      
      chain.unshift(current.extends)
      current = await this.registry.getTemplate(current.extends)
      
      if (!current) {
        throw new Error(`Template not found in inheritance chain: ${current.extends}`)
      }
    }
    
    return chain
  }
  
  private mergeTemplates(base: Template, extension: Template): Template {
    return {
      ...base,
      ...extension,
      
      // Deep merge field schemas
      field_schema: this.mergeFieldSchemas(base.field_schema, extension.field_schema),
      
      // Merge UI layouts
      ui_layout: this.mergeUILayouts(base.ui_layout, extension.ui_layout),
      
      // Append automation rules (don't override)
      automation_rules: [...(base.automation_rules || []), ...(extension.automation_rules || [])],
      
      // Merge parameters
      parameters: this.mergeParameters(base.parameters, extension.parameters)
    }
  }
  
  private mergeFieldSchemas(base: FieldSchema, extension: FieldSchema): FieldSchema {
    const merged = { ...base }
    
    for (const [fieldName, fieldDef] of Object.entries(extension)) {
      if (merged[fieldName]) {
        // Merge existing field definition
        merged[fieldName] = { ...merged[fieldName], ...fieldDef }
      } else {
        // Add new field
        merged[fieldName] = fieldDef
      }
    }
    
    return merged
  }
}
```

### 6.2 Template Customization UI

```typescript
class TemplateCustomizer {
  async createCustomizedTemplate(baseTemplateId: string, customizations: TemplateCustomizations): Promise<Template> {
    const baseTemplate = await this.registry.getTemplate(baseTemplateId)
    
    const customized: Template = {
      ...baseTemplate,
      template_id: customizations.newId,
      name: customizations.name,
      extends: baseTemplateId,
      
      // Apply field customizations
      field_schema: this.applyFieldCustomizations(
        baseTemplate.field_schema,
        customizations.fields
      ),
      
      // Apply UI customizations
      ui_layout: this.applyUICustomizations(
        baseTemplate.ui_layout,
        customizations.ui
      ),
      
      // Add custom automation
      automation_rules: [
        ...(baseTemplate.automation_rules || []),
        ...(customizations.automation || [])
      ]
    }
    
    return customized
  }
  
  renderCustomizationUI(container: HTMLElement, baseTemplate: Template): void {
    const customizer = container.createDiv('template-customizer')
    
    // Basic info section
    const basicSection = customizer.createDiv('customizer-section')
    basicSection.createEl('h3', { text: 'Template Information' })
    
    const nameInput = basicSection.createEl('input', {
      type: 'text',
      placeholder: 'Custom template name',
      value: `${baseTemplate.name} (Custom)`
    })
    
    // Field customization section
    const fieldsSection = customizer.createDiv('customizer-section')
    fieldsSection.createEl('h3', { text: 'Field Customizations' })
    
    this.renderFieldCustomizer(fieldsSection, baseTemplate.field_schema)
    
    // UI customization section  
    const uiSection = customizer.createDiv('customizer-section')
    uiSection.createEl('h3', { text: 'UI Customizations' })
    
    this.renderUICustomizer(uiSection, baseTemplate.ui_layout)
    
    // Automation section
    const automationSection = customizer.createDiv('customizer-section')
    automationSection.createEl('h3', { text: 'Custom Automation' })
    
    this.renderAutomationCustomizer(automationSection)
  }
}
```

## 7. Real-World Examples

### 7.1 Academic Research Project Templates

```json5
// research_paper.json5
{
  "template_id": "research_paper_v1",
  "name": "Academic Research Paper",
  "description": "Complete academic paper with methodology, analysis, and citations",
  "category": "academic",
  
  "codex_type": {
    "name": "research_paper",
    "display_name": "Research Paper",
    "icon": "file-text",
    "color": "#0284C7"
  },
  
  "field_schema": {
    "paper_title": {
      "type": "string",
      "required": true,
      "display_name": "Paper Title",
      "validation": {"min_length": 10, "max_length": 200}
    },
    
    "authors": {
      "type": "array",
      "subtype": "object",
      "display_name": "Authors",
      "fields": {
        "name": {"type": "string", "required": true},
        "affiliation": {"type": "string"},
        "email": {"type": "email"},
        "orcid": {"type": "string", "pattern": "\\d{4}-\\d{4}-\\d{4}-\\d{3}[\\dX]"}
      }
    },
    
    "abstract": {
      "type": "rich_text",
      "required": true,
      "display_name": "Abstract",
      "validation": {"min_length": 150, "max_length": 300},
      "template_content": "## Background\n\n## Methods\n\n## Results\n\n## Conclusions\n\n"
    },
    
    "keywords": {
      "type": "array",
      "subtype": "string",
      "display_name": "Keywords",
      "validation": {"min_items": 3, "max_items": 8}
    },
    
    "research_questions": {
      "type": "array",
      "subtype": "codex_reference",
      "filter": {"codex_type": ["research_question"]},
      "display_name": "Research Questions"
    },
    
    "methodology": {
      "type": "codex_reference",
      "filter": {"codex_type": ["methodology"]},
      "display_name": "Methodology",
      "required": true
    },
    
    "datasets": {
      "type": "array",
      "subtype": "codex_reference",
      "filter": {"codex_type": ["dataset"]},
      "display_name": "Datasets Used"
    },
    
    "citations": {
      "type": "array",
      "subtype": "codex_reference", 
      "filter": {"codex_type": ["citation"]},
      "display_name": "Citations"
    },
    
    "sections": {
      "type": "array",
      "subtype": "object",
      "display_name": "Paper Sections",
      "fields": {
        "section_number": {"type": "number", "required": true},
        "title": {"type": "string", "required": true},
        "content": {"type": "rich_text"},
        "word_count": {"type": "number", "readonly": true},
        "completion_status": {
          "type": "select",
          "options": ["not_started", "outline", "draft", "revision", "complete"]
        }
      },
      "default": [
        {"section_number": 1, "title": "Introduction", "completion_status": "not_started"},
        {"section_number": 2, "title": "Literature Review", "completion_status": "not_started"},
        {"section_number": 3, "title": "Methodology", "completion_status": "not_started"},
        {"section_number": 4, "title": "Results", "completion_status": "not_started"},
        {"section_number": 5, "title": "Discussion", "completion_status": "not_started"},
        {"section_number": 6, "title": "Conclusion", "completion_status": "not_started"}
      ]
    },
    
    "submission_status": {
      "type": "select",
      "options": ["planning", "writing", "reviewing", "submitted", "accepted", "published"],
      "default": "planning",
      "display_name": "Submission Status"
    },
    
    "target_journal": {
      "type": "string",
      "display_name": "Target Journal"
    },
    
    "submission_deadline": {
      "type": "date",
      "display_name": "Submission Deadline"
    }
  },
  
  "ui_layout": {
    "view_modes": [
      {
        "name": "paper_overview",
        "display_name": "Paper Overview",
        "layout": "tabs",
        "tabs": [
          {
            "name": "basic_info",
            "display_name": "Basic Info",
            "fields": ["paper_title", "authors", "abstract", "keywords"]
          },
          {
            "name": "structure", 
            "display_name": "Structure",
            "fields": ["sections"]
          },
          {
            "name": "research",
            "display_name": "Research",
            "fields": ["research_questions", "methodology", "datasets"]
          },
          {
            "name": "submission",
            "display_name": "Submission",
            "fields": ["submission_status", "target_journal", "submission_deadline"]
          }
        ]
      },
      {
        "name": "writing_view",
        "display_name": "Writing Mode",
        "component": "research_paper_editor"
      }
    ]
  },
  
  "automation_rules": [
    {
      "trigger": "field_changed",
      "field": "sections[*].completion_status", 
      "action": "update_overall_progress",
      "params": {
        "calculate": "percentage_complete"
      }
    },
    {
      "trigger": "created",
      "action": "create_related_tasks",
      "params": {
        "tasks": [
          {
            "title": "Literature Review for {{paper_title}}",
            "type": "research_task",
            "priority": "high"
          },
          {
            "title": "Data Collection for {{paper_title}}",
            "type": "research_task", 
            "priority": "high"
          }
        ]
      }
    }
  ]
}
```

### 7.2 TTRPG Campaign Management Templates

```json5
// ttrpg_campaign.json5
{
  "template_id": "ttrpg_campaign_v1",
  "name": "TTRPG Campaign",
  "description": "Complete tabletop RPG campaign management with sessions, characters, and plots",
  "category": "ttrpg",
  
  "extends": "base_project_v1",
  
  "field_schema": {
    "campaign_name": {
      "type": "string",
      "required": true,
      "display_name": "Campaign Name"
    },
    
    "game_system": {
      "type": "select",
      "options": ["D&D 5e", "Pathfinder 2e", "Call of Cthulhu", "Vampire: The Masquerade", "Custom"],
      "allow_custom": true,
      "display_name": "Game System"
    },
    
    "setting": {
      "type": "rich_text",
      "display_name": "Campaign Setting",
      "template_content": "## World Overview\n\n## Key Locations\n\n## Important NPCs\n\n## Major Conflicts\n\n"
    },
    
    "player_characters": {
      "type": "array",
      "subtype": "codex_reference",
      "filter": {"codex_type": ["player_character"]},
      "display_name": "Player Characters"
    },
    
    "sessions": {
      "type": "array", 
      "subtype": "codex_reference",
      "filter": {"codex_type": ["game_session"]},
      "display_name": "Sessions"
    },
    
    "main_plot": {
      "type": "codex_reference",
      "filter": {"codex_type": ["plot_thread"]},
      "display_name": "Main Plot Thread"
    },
    
    "side_plots": {
      "type": "array",
      "subtype": "codex_reference", 
      "filter": {"codex_type": ["plot_thread"]},
      "display_name": "Side Plot Threads"
    },
    
    "important_npcs": {
      "type": "array",
      "subtype": "codex_reference",
      "filter": {"codex_type": ["npc_character"]},
      "display_name": "Important NPCs"
    },
    
    "locations": {
      "type": "array",
      "subtype": "codex_reference",
      "filter": {"codex_type": ["location"]}, 
      "display_name": "Key Locations"
    },
    
    "campaign_calendar": {
      "type": "array",
      "subtype": "object",
      "display_name": "Campaign Calendar",
      "fields": {
        "in_game_date": {"type": "string", "required": true},
        "real_world_date": {"type": "date", "required": true},
        "events": {"type": "text"},
        "session_ref": {
          "type": "codex_reference",
          "filter": {"codex_type": ["game_session"]}
        }
      }
    },
    
    "house_rules": {
      "type": "rich_text",
      "display_name": "House Rules & Modifications"
    },
    
    "campaign_status": {
      "type": "select",
      "options": ["planning", "active", "on_hiatus", "completed"],
      "default": "planning",
      "display_name": "Campaign Status"
    }
  },
  
  "ui_layout": {
    "view_modes": [
      {
        "name": "campaign_dashboard",
        "display_name": "Campaign Dashboard",
        "component": "ttrpg_dashboard",
        "layout": "dashboard",
        "widgets": [
          {"type": "session_calendar", "size": "large"},
          {"type": "plot_tracker", "size": "medium"},
          {"type": "npc_quick_reference", "size": "medium"},
          {"type": "player_overview", "size": "small"}
        ]
      },
      {
        "name": "session_planning",
        "display_name": "Session Planning",
        "component": "session_planner"
      }
    ]
  },
  
  "automation_rules": [
    {
      "trigger": "created",
      "action": "create_starter_content",
      "params": {
        "create": [
          {
            "type": "plot_thread",
            "title": "Main Story Arc",
            "field_values": {"plot_type": "main"}
          },
          {
            "type": "location", 
            "title": "Starting Town",
            "field_values": {"location_type": "settlement"}
          }
        ]
      }
    }
  ]
}
```

### 7.3 Software Development Project Templates

```json5
// agile_epic.json5
{
  "template_id": "agile_epic_v1",
  "name": "Agile Epic",
  "description": "Large user story with acceptance criteria and sub-stories",
  "category": "coding",
  
  "extends": "base_task_v1",
  
  "field_schema": {
    "epic_title": {
      "type": "string",
      "required": true,
      "display_name": "Epic Title",
      "placeholder": "As a [user type], I want [goal] so that [benefit]"
    },
    
    "business_value": {
      "type": "rich_text",
      "required": true,
      "display_name": "Business Value",
      "template_content": "## Problem Statement\n\n## Expected Outcome\n\n## Success Metrics\n\n"
    },
    
    "acceptance_criteria": {
      "type": "array",
      "subtype": "object",
      "display_name": "Acceptance Criteria",
      "fields": {
        "given": {"type": "text", "placeholder": "Given [context]"},
        "when": {"type": "text", "placeholder": "When [action]"},
        "then": {"type": "text", "placeholder": "Then [outcome]"},
        "status": {
          "type": "select",
          "options": ["draft", "approved", "implemented", "tested"],
          "default": "draft"
        }
      }
    },
    
    "user_stories": {
      "type": "array",
      "subtype": "codex_reference",
      "filter": {"codex_type": ["user_story"]},
      "display_name": "User Stories"
    },
    
    "technical_tasks": {
      "type": "array",
      "subtype": "codex_reference", 
      "filter": {"codex_type": ["technical_task"]},
      "display_name": "Technical Tasks"
    },
    
    "affected_components": {
      "type": "array",
      "subtype": "string",
      "display_name": "Affected Components",
      "suggestions": ["frontend", "backend", "database", "api", "ui", "auth", "deployment"]
    },
    
    "story_points": {
      "type": "select",
      "options": ["1", "2", "3", "5", "8", "13", "21", "?"],
      "display_name": "Story Points"
    },
    
    "sprint_assignment": {
      "type": "codex_reference",
      "filter": {"codex_type": ["sprint"]},
      "display_name": "Assigned Sprint"
    },
    
    "dependencies": {
      "type": "array",
      "subtype": "codex_reference",
      "filter": {"codex_type": ["epic", "user_story", "technical_task"]},
      "display_name": "Dependencies"
    },
    
    "blocked_by": {
      "type": "array",
      "subtype": "codex_reference",
      "filter": {"codex_type": ["epic", "user_story", "technical_task"]},
      "display_name": "Blocked By"
    },
    
    "testing_notes": {
      "type": "rich_text",
      "display_name": "Testing Considerations"
    }
  },
  
  "ui_layout": {
    "view_modes": [
      {
        "name": "epic_overview", 
        "display_name": "Epic Overview",
        "layout": "tabs",
        "tabs": [
          {
            "name": "definition",
            "display_name": "Definition",
            "fields": ["epic_title", "business_value", "acceptance_criteria"]
          },
          {
            "name": "breakdown",
            "display_name": "Breakdown", 
            "fields": ["user_stories", "technical_tasks", "story_points"]
          },
          {
            "name": "planning",
            "display_name": "Planning",
            "fields": ["sprint_assignment", "dependencies", "blocked_by", "affected_components"]
          },
          {
            "name": "testing",
            "display_name": "Testing",
            "fields": ["testing_notes"]
          }
        ]
      },
      {
        "name": "kanban_card",
        "display_name": "Kanban Card",
        "component": "agile_kanban_card"
      }
    ]
  },
  
  "automation_rules": [
    {
      "trigger": "field_changed",
      "field": "user_stories",
      "action": "calculate_total_story_points",
      "params": {
        "sum_field": "story_points",
        "update_field": "total_story_points"
      }
    },
    {
      "trigger": "acceptance_criteria_all_approved", 
      "action": "update_status",
      "params": {
        "new_status": "ready_for_development"
      }
    }
  ]
}
```

## 8. Integration with Existing Codex Architecture

### 8.1 Codex Entry Extension

The template system extends the existing Codex Entry interface to support dynamic types:

```typescript
interface TemplateAwareCodexEntry extends CodexEntry {
  // Template information
  templateId: string
  templateVersion: string
  
  // Dynamic type information
  dynamicType: DynamicCodexType
  
  // Template-specific data (typed according to template schema)
  templateData: Record<string, any>
  
  // Template validation state
  validationState: TemplateValidationState
  
  // Methods
  validateAgainstTemplate(): ValidationResult
  updateFromTemplate(newTemplate: Template): void
  getAvailableViews(): ViewType[]
}

interface TemplateValidationState {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  lastValidated: Date
  templateVersion: string  // Version validation was performed against
}

class TemplateAwareCodexService extends CodexService {
  async createFromTemplate(templateId: string, templateData: any, baseData?: Partial<CodexEntry>): Promise<TemplateAwareCodexEntry> {
    const template = await this.templateRegistry.getTemplate(templateId)
    
    // Validate data against template schema
    const validation = this.templateValidator.validate(templateData, template.field_schema)
    if (!validation.valid) {
      throw new ValidationError(`Template data invalid: ${validation.errors.join(', ')}`)
    }
    
    // Create the codex entry
    const codex: TemplateAwareCodexEntry = {
      ...this.createBaseCodexEntry(baseData),
      
      // Template-specific properties
      templateId: templateId,
      templateVersion: template.version,
      dynamicType: this.templateRegistry.getCodexType(templateId),
      templateData: templateData,
      validationState: {
        isValid: true,
        errors: [],
        warnings: validation.warnings || [],
        lastValidated: new Date(),
        templateVersion: template.version
      },
      
      // Override type with dynamic type
      type: template.codex_type.name as CodexType
    }
    
    // Process automation rules
    await this.processTemplateAutomation(codex, template.automation_rules, 'created')
    
    return codex
  }
  
  async updateTemplateData(codexId: string, updates: Partial<any>): Promise<TemplateAwareCodexEntry> {
    const codex = await this.getCodex(codexId) as TemplateAwareCodexEntry
    const template = await this.templateRegistry.getTemplate(codex.templateId)
    
    // Merge updates
    const newTemplateData = { ...codex.templateData, ...updates }
    
    // Validate merged data
    const validation = this.templateValidator.validate(newTemplateData, template.field_schema)
    
    codex.templateData = newTemplateData
    codex.validationState = {
      isValid: validation.valid,
      errors: validation.errors || [],
      warnings: validation.warnings || [],
      lastValidated: new Date(),
      templateVersion: template.version
    }
    
    // Process field change automation
    const changedFields = Object.keys(updates)
    await this.processFieldChangeAutomation(codex, template.automation_rules, changedFields)
    
    // Update file
    await this.persistence.writeCodexFile(codex)
    
    return codex
  }
}
```

### 8.2 Template-Aware View System

The existing multi-view architecture is extended to support template-defined views:

```typescript
class TemplateViewRenderer extends ViewRenderer {
  createView(codex: TemplateAwareCodexEntry, viewType: ViewType, context: ViewContext): CodexView {
    // Check if this is a template-defined view
    const templateView = codex.dynamicType.uiLayout.view_modes.find(mode => mode.name === viewType)
    
    if (templateView) {
      return this.createTemplateView(codex, templateView, context)
    }
    
    // Fall back to standard view creation
    return super.createView(codex, viewType, context)
  }
  
  private createTemplateView(codex: TemplateAwareCodexEntry, viewConfig: ViewMode, context: ViewContext): TemplateView {
    switch (viewConfig.layout) {
      case 'tabs':
        return new TabbedTemplateView(codex, viewConfig, context)
      case 'dashboard':
        return new DashboardTemplateView(codex, viewConfig, context)
      case 'compact':
        return new CompactTemplateView(codex, viewConfig, context)
      default:
        // Custom component
        return this.createCustomComponentView(codex, viewConfig, context)
    }
  }
  
  getAvailableViews(codexType: CodexType): ViewType[] {
    const standardViews = super.getAvailableViews(codexType)
    
    // Add template-defined views
    const dynamicType = this.templateRegistry.getCodexType(codexType)
    if (dynamicType) {
      const templateViews = dynamicType.uiLayout.view_modes.map(mode => mode.name as ViewType)
      return [...standardViews, ...templateViews]
    }
    
    return standardViews
  }
}

class TabbedTemplateView extends TemplateView {
  render(container: HTMLElement): void {
    const tabContainer = container.createDiv('template-tab-container')
    
    // Create tab headers
    const tabHeaders = tabContainer.createDiv('tab-headers')
    
    // Create tab content area
    const tabContent = tabContainer.createDiv('tab-content')
    
    this.viewConfig.tabs.forEach((tab, index) => {
      // Create tab header
      const tabHeader = tabHeaders.createDiv('tab-header')
      tabHeader.textContent = tab.display_name
      tabHeader.addEventListener('click', () => this.switchToTab(index))
      
      // Create tab content
      const tabPanel = tabContent.createDiv('tab-panel')
      tabPanel.style.display = index === 0 ? 'block' : 'none'
      
      this.renderFieldGroup(tabPanel, tab.fields)
    })
  }
  
  private renderFieldGroup(container: HTMLElement, fieldNames: string[]): void {
    const fieldGroup = container.createDiv('field-group')
    
    for (const fieldName of fieldNames) {
      const fieldDef = this.codex.dynamicType.fieldSchema.find(f => f.name === fieldName)
      if (fieldDef) {
        const fieldRenderer = this.getFieldRenderer(fieldDef.type)
        fieldRenderer.render(fieldGroup, fieldDef, this.codex.templateData[fieldName])
      }
    }
  }
}
```

## 9. TypeScript Interfaces

### 9.1 Core Template Interfaces

```typescript
// Template definition interfaces
interface Template {
  // Metadata
  template_id: string
  name: string
  description: string
  version: string
  author: string
  created_at: string
  updated_at: string
  
  // Inheritance
  extends?: string
  category: string
  tags: string[]
  
  // Type definition
  codex_type: CodexTypeDefinition
  
  // Schema
  field_schema: Record<string, FieldDefinition>
  ui_layout: UILayoutConfig
  automation_rules: AutomationRule[]
  
  // Parameters for instantiation
  parameters: TemplateParameter[]
  
  // Sharing configuration
  sharing: SharingConfig
}

interface CodexTypeDefinition {
  name: string
  display_name: string
  icon: string
  color: string
  plural: string
}

interface FieldDefinition {
  type: FieldType
  required?: boolean
  display_name?: string
  description?: string
  placeholder?: string
  validation?: ValidationConfig
  ui_hints?: UIHints
  
  // Type-specific properties
  fields?: Record<string, FieldDefinition>  // For object types
  subtype?: FieldType                       // For array types
  options?: string[]                        // For select types
  allow_custom?: boolean                    // For select types
  suggestions?: string[]                    // For string types
  filter?: CodexFilter                      // For reference types
  
  default?: any
}

interface UILayoutConfig {
  view_modes: ViewMode[]
  default_view: string
  card_view?: CardViewConfig
}

interface ViewMode {
  name: string
  display_name: string
  icon?: string
  layout: 'tabs' | 'dashboard' | 'compact' | 'custom'
  component?: string
  
  // Layout-specific configuration
  tabs?: TabConfig[]
  widgets?: WidgetConfig[]
  fields?: string[]
}

interface TabConfig {
  name: string
  display_name: string
  fields: string[]
  layout?: 'grid' | 'vertical' | 'horizontal'
}

interface WidgetConfig {
  type: string
  size: 'small' | 'medium' | 'large'
  config?: Record<string, any>
}

interface CardViewConfig {
  title_field: string
  subtitle_field?: string
  description_field?: string
  image_field?: string
  badge_field?: string
}

interface AutomationRule {
  trigger: AutomationTrigger
  field?: string
  condition?: string
  action: AutomationAction
  params?: Record<string, any>
}

enum AutomationTrigger {
  CREATED = 'created',
  UPDATED = 'updated', 
  DELETED = 'deleted',
  FIELD_CHANGED = 'field_changed',
  STATUS_CHANGED = 'status_changed',
  RELATIONSHIP_ADDED = 'relationship_added',
  RELATIONSHIP_REMOVED = 'relationship_removed'
}

enum AutomationAction {
  UPDATE_FIELD = 'update_field',
  CREATE_RELATED_CODEX = 'create_related_codex',
  CREATE_RELATED_TASKS = 'create_related_tasks',
  UPDATE_LINKED_CODICES = 'update_linked_codices',
  SEND_NOTIFICATION = 'send_notification',
  TRIGGER_WORKFLOW = 'trigger_workflow'
}

interface TemplateParameter {
  name: string
  type: ParameterType
  required: boolean
  display_name: string
  description?: string
  default?: any
  options?: string[]  // For select type
  validation?: ValidationConfig
}

enum ParameterType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  DATE = 'date'
}

interface SharingConfig {
  shareable: boolean
  license?: string
  attribution_required?: boolean
  modifications_allowed?: boolean
  commercial_use_allowed?: boolean
}
```

### 9.2 Template System Service Interfaces

```typescript
// Template management services
interface TemplateRegistry {
  // Registration
  register(template: Template): Promise<void>
  unregister(templateId: string): Promise<void>
  override(templateId: string, newTemplatePath: string): Promise<void>
  
  // Retrieval
  getTemplate(templateId: string): Promise<Template | null>
  getAllTemplates(): Promise<Template[]>
  getTemplatesByCategory(category: string): Promise<Template[]>
  getTemplatesByTag(tag: string): Promise<Template[]>
  
  // Type system integration
  getCodexType(templateId: string): DynamicCodexType | null
  getAllCodexTypes(): DynamicCodexType[]
  
  // Inheritance
  resolveTemplate(templateId: string): Promise<ResolvedTemplate>
  getInheritanceChain(templateId: string): Promise<string[]>
  
  // Watching
  watchTemplate(templateId: string, callback: TemplateChangeCallback): void
  unwatchTemplate(templateId: string): void
}

interface TemplateLoader {
  loadAllTemplates(): Promise<LoadResult>
  loadFromDirectory(directoryPath: string): Promise<LoadResult>
  loadTemplate(filePath: string): Promise<Template>
  reloadTemplate(templateId: string): Promise<void>
}

interface TemplateValidator {
  validateTemplate(template: Template): ValidationResult
  validateTemplateData(data: any, fieldSchema: Record<string, FieldDefinition>): ValidationResult
  validateInheritance(templateId: string): ValidationResult
  validateCircularDependency(templateId: string): ValidationResult
}

interface TemplateInstantiator {
  createFromTemplate(templateId: string, parameterValues: Record<string, any>): Promise<TemplateAwareCodexEntry>
  getRequiredParameters(templateId: string): TemplateParameter[]
  validateParameters(templateId: string, parameters: Record<string, any>): ValidationResult
}

interface TemplateShareManager {
  generateShareHash(template: Template): Promise<string>
  importFromHash(shareHash: string): Promise<Template>
  exportTemplate(template: Template, options: ExportOptions): Promise<ExportedTemplate>
  importTemplateFile(filePath: string): Promise<ImportResult>
  
  shareToClipboard(template: Template): Promise<void>
  shareToFile(template: Template, filePath: string): Promise<void>
  shareToUrl(template: Template): Promise<string>
}

// Result and utility types
interface LoadResult {
  loaded: Template[]
  failed: LoadFailure[]
  conflicts: TemplateConflict[]
}

interface LoadFailure {
  file: string
  error: string
}

interface TemplateConflict {
  templateId: string
  existing: string
  new: string
}

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

interface ValidationError {
  field?: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

interface ValidationWarning extends ValidationError {
  severity: 'warning'
}

interface ResolvedTemplate extends Template {
  resolved_field_schema: Record<string, FieldDefinition>
  resolved_ui_layout: UILayoutConfig
  inheritance_chain: string[]
}

interface ExportOptions {
  includeContent?: boolean
  bundleDependencies?: boolean
  authorInfo?: AuthorInfo
}

interface ExportedTemplate extends Template {
  exported_at: string
  exported_by?: AuthorInfo
  export_version: string
  sample_content?: CodexEntry[]
  dependencies?: Template[]
}

interface ImportResult {
  success: boolean
  templateId?: string
  errors?: string[]
  warnings?: string[]
}

interface AuthorInfo {
  name: string
  email?: string
  url?: string
}

type TemplateChangeCallback = (template: Template) => void
```

## 10. Implementation Plan

### Phase 1: Foundation (Weeks 1-2)
1. **Core Template Infrastructure**
   - Implement `Template` and related interfaces
   - Create `TemplateRegistry` service
   - Build JSON5 file parser and validator
   - Set up template directory structure

2. **Basic Template Loading**
   - Implement `TemplateLoader` with file system integration
   - Create template discovery and parsing pipeline
   - Add basic inheritance resolution
   - Set up template file watching

### Phase 2: Dynamic Type System (Weeks 3-4)
1. **Dynamic CodexType Registration**
   - Extend existing `CodexType` enum to support dynamic types
   - Implement `DynamicCodexType` creation from templates
   - Update `CodexService` to work with template-based types
   - Create template-aware codex entry creation

2. **Field System Implementation**
   - Build field type system with validation
   - Create field renderers for each supported type
   - Implement cross-reference field types
   - Add validation pipeline

### Phase 3: Template Views and UI (Weeks 5-6)
1. **Template-Driven Views**
   - Extend `ViewRenderer` to support template-defined views
   - Implement tabbed, dashboard, and compact layouts
   - Create field group rendering system
   - Add custom component support

2. **Template Editor**
   - Build template creation and editing UI
   - Implement visual template designer
   - Add template testing and preview
   - Create template customization interface

### Phase 4: Advanced Features (Weeks 7-8)
1. **Template Sharing System**
   - Implement hash-based sharing
   - Create import/export functionality
   - Build template marketplace UI
   - Add template validation and security

2. **Project Template Management**
   - Create project context system
   - Implement template set management
   - Build project switching interface
   - Add template discovery by project type

### Phase 5: Integration and Polish (Weeks 9-10)
1. **Automation Integration**
   - Connect template automation rules to existing automation system
   - Implement template-triggered workflows
   - Add template lifecycle hooks
   - Create template performance monitoring

2. **Migration and Compatibility**
   - Create migration tools for existing content
   - Build compatibility layer for existing views
   - Add template update and versioning system
   - Implement rollback capabilities

## Success Metrics

1. **Template System Adoption**: 80% of new codex entries use custom templates within 30 days
2. **Template Creation**: Users create average of 5+ custom templates per project
3. **Template Sharing**: 50+ templates shared in community within 60 days
4. **Performance**: Template instantiation under 200ms, template loading under 100ms
5. **User Satisfaction**: 4.5+ star rating for template system features

## Conclusion

The Vespera Template System represents a fundamental architectural innovation that transforms the platform from a fixed-type system into a **user-extensible content ecosystem**. By enabling "templates for everything" through JSON5 files, dynamic type registration, and comprehensive sharing mechanisms, this system delivers exactly what the user requested: a universal template system that supports any workflow, any project type, and any organizational structure.

The template system's key innovations include:

1. **Complete User Control**: Users define content types, not developers
2. **Universal Application**: Templates work for tasks, characters, worldbuilding, academic research, TTRPG campaigns, and any other domain
3. **Seamless Multi-Project Support**: Switch between coding, worldbuilding, and academic projects in the same vault
4. **Rich Inheritance System**: Build complex templates from simpler ones
5. **Effortless Sharing**: Share workflows via hash strings or portable files
6. **Native Obsidian Integration**: Templates feel like natural extensions of Obsidian

This architecture ensures that the Vespera platform can grow and adapt to any user need while maintaining the simplicity and power that makes it effective for executive dysfunction support and creative workflow management. The template system becomes the foundation that enables truly personalized, scalable knowledge orchestration.
