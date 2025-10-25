# ADR-016: Global Registry + Workspace Storage Architecture

**Status**: Accepted
**Date**: 2025-10-25
**Deciders**: Aya (Product Owner), Claude Code
**Technical Story**: [Phase 17: Codex Editor Implementation](../phases/PHASE_17_PLAN.md)

---

## Context and Problem Statement

Where should Vespera store data? How should the system discover and track Projects across multiple workspaces and filesystem locations? How should workspace-specific data be separated from global application state?

**Key Challenge**: Users may:
- Open VS Code at different directory levels (workspace root, project folder, arbitrary subfolder)
- Work on projects in multiple, unrelated filesystem locations
- Have multiple workspaces for different purposes
- Switch between computers and expect consistent project access

**Current Issue**: Phase 16b stores everything in workspace `.vespera/` folder, with no global awareness or cross-workspace discovery.

## Decision Drivers

* **Multi-Workspace Support**: Users work across multiple unrelated workspaces
* **Discovery Flexibility**: Opening VS Code anywhere should "just work"
* **Data Isolation**: Each workspace's data should be self-contained
* **Global Awareness**: System should track all projects user has created
* **Cross-Computer Sync**: Registry should be syncable (future)
* **Familiar Patterns**: Follow conventions from Git, VS Code, Docker
* **Performance**: Fast lookups without scanning entire filesystem

## Considered Options

1. **Workspace-Only Storage** (Phase 16b model)
2. **Global-Only Storage** (Everything in user directory)
3. **Hybrid: Global Registry + Workspace Storage** (Recommended)
4. **Environment Variables** (Registry path in ENV)

## Decision Outcome

Chosen option: **"Hybrid: Global Registry + Workspace Storage"** (Option 3), because it combines the benefits of global awareness with workspace isolation.

**Core Principle**:
- **Global Registry** (`~/.vespera/`): Tracks all projects, global templates, shared config
- **Workspace Storage** (`.vespera/` in workspace): Isolated databases, workspace-specific data
- **Discovery Algorithm**: Check workspace, search up tree, fall back to global registry

### Positive Consequences

* **Discovery Works Everywhere**: Open VS Code anywhere, system finds relevant data
* **Workspace Isolation**: Each workspace has own database, no conflicts
* **Global Awareness**: "Recent Projects" list works across all workspaces
* **Portability**: Workspace folders are self-contained, can move/copy
* **Multi-Computer**: Global registry syncs via cloud (Dropbox, iCloud, etc.)
* **Performance**: Fast local lookups, no filesystem scanning
* **Familiar Pattern**: Same model as Git (`~/.gitconfig` + `.git/`)

### Negative Consequences

* **Two Storage Locations**: Must sync between global registry and workspace
* **Consistency**: Need to handle registry vs workspace conflicts
* **Complexity**: More complex discovery algorithm
* **Migration**: Must move existing data to new structure

## Pros and Cons of the Options

### Option 1: Workspace-Only Storage (Phase 16b Model)

All data stored in workspace `.vespera/` folder.

```
/workspace/
└── .vespera/
    ├── database.sqlite
    ├── projects.json
    └── templates/
```

* Good, because simple model (one storage location)
* Good, because workspace is self-contained
* Good, because no sync issues between locations
* Bad, because no cross-workspace awareness
* Bad, because can't track projects in other locations
* Bad, because opening subfolder doesn't find parent `.vespera/`
* Bad, because no "Recent Projects" across workspaces

### Option 2: Global-Only Storage

All data stored in user directory.

```
~/.vespera/
├── database.sqlite          # ALL projects in one DB
├── projects/
│   ├── project-123/
│   └── project-456/
└── templates/
```

* Good, because single source of truth
* Good, because cross-workspace awareness built-in
* Good, because works from any folder
* Bad, because database bloat (all projects in one DB)
* Bad, because workspace not self-contained
* Bad, because can't move workspace independently
* Bad, because performance issues with large databases
* Bad, because conflicts if working on same project from different computers

### Option 3: Hybrid: Global Registry + Workspace Storage (CHOSEN)

Global registry tracks projects, workspace stores data.

**Global Registry** (`~/.vespera/`):
```
~/.vespera/                           # Linux/macOS
%APPDATA%/Vespera/                    # Windows

├── config.json                       # Global app settings
├── projects-registry.json            # ALL projects user has created
├── templates/                        # Global templates (shared)
│   ├── fiction/
│   ├── research/
│   └── software/
├── cache/                            # Shared cache
│   └── template-index.json
└── logs/                             # App-wide logging
```

**Workspace Storage** (`.vespera/` in workspace):
```
/path/to/workspace/
└── .vespera/
    ├── workspace.json                # Workspace metadata
    ├── database.sqlite               # Codices for THIS workspace
    ├── vectors/                      # Vector embeddings (RAG)
    │   └── embeddings.db
    ├── graph/                        # Graph database
    │   └── relationships.db
    ├── templates/                    # Workspace-local templates
    └── projects/                     # Projects in workspace
        ├── project-123/
        │   ├── config.json
        │   ├── contexts.json
        │   └── files/
        └── project-456/
```

* Good, because combines global awareness with workspace isolation
* Good, because works from any folder (discovery algorithm)
* Good, because workspace is self-contained
* Good, because no database bloat (separate DBs per workspace)
* Good, because enables cross-workspace features (recent projects, search)
* Good, because follows familiar patterns (Git, VS Code)
* Bad, because must sync registry with workspaces
* Bad, because two storage locations to manage

### Option 4: Environment Variables

Registry path in environment variable.

```bash
export VESPERA_REGISTRY="/path/to/registry"
```

* Good, because flexible (user controls location)
* Good, because supports networked storage
* Bad, because requires user configuration
* Bad, because confusing for non-technical users
* Bad, because different across shells/environments
* Neutral, can be added later as advanced option

## Implementation Design

### Platform-Specific Paths

```typescript
function getGlobalVesperaPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE;

  switch (process.platform) {
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(home, 'AppData', 'Roaming'),
        'Vespera'
      );

    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'Vespera');

    case 'linux':
    default:
      // Follow XDG Base Directory Specification
      const xdgData = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
      return path.join(xdgData, 'vespera');
  }
}
```

**Standard Locations**:
- **Windows**: `C:\Users\Username\AppData\Roaming\Vespera`
- **macOS**: `/Users/Username/Library/Application Support/Vespera`
- **Linux**: `~/.local/share/vespera` (XDG) or `~/.vespera` (fallback)

### Global Projects Registry Schema

**`~/.vespera/projects-registry.json`**:
```json5
{
  "version": "1.0.0",
  "last_updated": "2025-10-25T12:34:56Z",

  "projects": [
    {
      "id": "proj-abc123",
      "name": "Mythological RPG Game",
      "workspace_path": "/home/aya/Projects/game-dev/rpg",
      "workspace_type": "absolute",  // or "relative"

      "contexts": [
        { "id": "ctx-1", "name": "Story", "template_type": "fiction" },
        { "id": "ctx-2", "name": "Research", "template_type": "research" },
        { "id": "ctx-3", "name": "Code", "template_type": "software" }
      ],

      "metadata": {
        "created_at": "2025-10-20T10:00:00Z",
        "last_opened": "2025-10-25T12:00:00Z",
        "last_context_id": "ctx-1",
        "tags": ["game", "rpg", "mythology"],
        "pinned": true,
        "color": "#4a90e2",
        "icon": "gamepad"
      }
    },

    {
      "id": "proj-def456",
      "name": "Novel: City of Shadows",
      "workspace_path": "/home/aya/Writing/novels/city-of-shadows",
      "workspace_type": "absolute",

      "contexts": [
        { "id": "ctx-4", "name": "Manuscript", "template_type": "fiction" },
        { "id": "ctx-5", "name": "World Building", "template_type": "research" }
      ],

      "metadata": {
        "created_at": "2025-09-15T08:00:00Z",
        "last_opened": "2025-10-24T15:30:00Z",
        "last_context_id": "ctx-4",
        "tags": ["novel", "fiction", "urban-fantasy"],
        "pinned": false
      }
    }
  ],

  "recent_workspaces": [
    {
      "path": "/home/aya/Projects/game-dev/rpg",
      "last_opened": "2025-10-25T12:00:00Z",
      "project_ids": ["proj-abc123"]
    },
    {
      "path": "/home/aya/Writing/novels/city-of-shadows",
      "last_opened": "2025-10-24T15:30:00Z",
      "project_ids": ["proj-def456"]
    }
  ]
}
```

### Discovery Algorithm

When VS Code extension activates:

```typescript
async function discoverVesperaWorkspace(): Promise<VesperaWorkspace> {
  const currentPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  // 1. Load global registry
  const globalRegistry = await loadGlobalRegistry();

  // 2. Check for .vespera in current workspace
  const localVespera = path.join(currentPath, '.vespera');
  if (await exists(localVespera)) {
    const workspace = await loadWorkspace(localVespera);
    await syncWithGlobalRegistry(workspace, globalRegistry);
    return workspace;
  }

  // 3. Search up directory tree (max 5 levels)
  const parentVespera = await searchUpForVespera(currentPath, 5);
  if (parentVespera) {
    const workspace = await loadWorkspace(parentVespera);
    await syncWithGlobalRegistry(workspace, globalRegistry);
    return workspace;
  }

  // 4. Check global registry for projects in this path
  const registeredProject = globalRegistry.findProjectByPath(currentPath);
  if (registeredProject) {
    // Navigate to workspace
    const workspace = await loadWorkspace(registeredProject.workspace_path);
    return workspace;
  }

  // 5. Not found - prompt to initialize
  return await promptInitializeWorkspace(globalRegistry, currentPath);
}

async function searchUpForVespera(
  startPath: string,
  maxLevels: number
): Promise<string | null> {
  let currentPath = startPath;

  for (let i = 0; i < maxLevels; i++) {
    const vesperaPath = path.join(currentPath, '.vespera');
    if (await exists(vesperaPath)) {
      return vesperaPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      // Reached filesystem root
      break;
    }
    currentPath = parentPath;
  }

  return null;
}
```

### Workspace Metadata

**`.vespera/workspace.json`**:
```json5
{
  "id": "ws-xyz789",
  "name": "Game Development Projects",
  "version": "1.0.0",
  "created_at": "2025-10-20T10:00:00Z",

  "settings": {
    "default_project_id": "proj-abc123",
    "auto_sync": true,
    "template_path": "./templates",  // Workspace-local templates
    "enable_rag": true,
    "vector_model": "all-MiniLM-L6-v2"
  },

  "database": {
    "path": "./database.sqlite",
    "version": 3,
    "last_migration": "2025-10-25T12:00:00Z"
  }
}
```

### Sync Strategy

Keep global registry in sync with workspace state:

```typescript
async function syncWithGlobalRegistry(
  workspace: Workspace,
  registry: GlobalRegistry
): Promise<void> {
  // 1. Update workspace's last_opened in registry
  await registry.updateWorkspaceAccess(workspace.path);

  // 2. Sync project metadata
  for (const project of workspace.projects) {
    const registryProject = registry.findProject(project.id);

    if (!registryProject) {
      // New project - add to registry
      await registry.registerProject({
        ...project,
        workspace_path: workspace.path
      });
    } else {
      // Existing project - update metadata
      await registry.updateProject(project.id, {
        last_opened: new Date(),
        last_context_id: project.active_context_id,
        contexts: project.contexts  // Sync context list
      });
    }
  }

  // 3. Detect removed projects
  const registryProjects = registry.getProjectsForWorkspace(workspace.path);
  for (const regProject of registryProjects) {
    if (!workspace.projects.find(p => p.id === regProject.id)) {
      // Project removed from workspace
      await registry.removeProject(regProject.id);
    }
  }
}
```

### File Storage Strategy

**Database stores** (in `.vespera/database.sqlite`):
- Codex metadata (id, title, template_id, tags, etc.)
- File path (relative to project root)
- File hash (for change detection)
- Search indexes

**File system stores** (in project folders):
- Actual file content (.md, .ts, .rs, etc.)
- Organized by user/project structure

**Example**:
```
/workspace/
├── .vespera/
│   └── database.sqlite
│       └── codex_123: {
│           "file_path": "projects/rpg/chapters/chapter-1.md",
│           "file_hash": "sha256:abc...",
│           "content_in_database": false
│         }
│
└── projects/
    └── rpg/
        └── chapters/
            └── chapter-1.md  ← Actual content here
```

## Cross-Platform Considerations

### Windows Specifics
- Use `%APPDATA%` for global storage
- Handle path separators (backslash)
- Case-insensitive path comparison

### macOS Specifics
- Use `~/Library/Application Support/` (standard macOS location)
- Handle .DS_Store files gracefully
- iCloud Drive integration (future)

### Linux Specifics
- Follow XDG Base Directory Specification
- Use `~/.local/share/vespera` (preferred) or `~/.vespera` (fallback)
- Respect `$XDG_DATA_HOME` environment variable

## Migration from Phase 16b

**Phase 16b State**:
```
/workspace/
└── .vespera/
    ├── database.sqlite
    └── projects.json
```

**Phase 17 Migration**:
```typescript
async function migratePhase16bToPhase17(): Promise<void> {
  // 1. Initialize global registry
  const globalPath = getGlobalVesperaPath();
  await initializeGlobalRegistry(globalPath);

  // 2. Scan existing workspaces
  const workspaces = await findExistingWorkspaces();

  // 3. Migrate each workspace
  for (const wsPath of workspaces) {
    const oldData = await loadOldWorkspace(wsPath);

    // Convert old "projects" to new Project+Context model
    const migratedProjects = await migrateProjects(oldData.projects);

    // Update workspace schema
    await updateWorkspaceSchema(wsPath, migratedProjects);

    // Register in global registry
    for (const project of migratedProjects) {
      await registerProjectGlobally(project, wsPath);
    }
  }
}
```

## Future Enhancements

### Phase 18: Cloud Sync
- Sync global registry via Dropbox, iCloud, Syncthing
- Conflict resolution for multi-device usage
- Merge strategies for registry updates

### Phase 19: Workspace Collections
- Group related workspaces in registry
- Workspace templates (pre-configured setups)
- Bulk operations across workspaces

### Phase 20: Advanced Discovery
- Filesystem watchers for automatic project detection
- Git integration (auto-discover projects in repos)
- Network locations (SMB, NFS shares)

## Links

* Implements [ADR-015: Workspace/Project/Context Hierarchy](./ADR-015-workspace-project-context-hierarchy.md)
* Relates to [ADR-001: Projects as Fundamental](./ADR-001-projects-fundamental.md)
* Relates to [ADR-012: Codices as File Containers](./ADR-012-codices-as-file-containers.md)
* [Phase 16b Completion](../phases/PHASE_16b_COMPLETE.md)
* [Phase 17 Plan](../phases/PHASE_17_PLAN.md)

---

## Product Owner Notes

From Phase 17 planning discussion:

> "What if we use the user directory from the OS they're on for the larger task of keeping track of different folders the user has created Projects in? (E.g. the Windows %APPDATA% folder and similar things) We can put stuff that the app needs app-wide in a .vespera folder somewhere in there, and leave the current SQLite/vector/graph databases to whatever folders a user opens in VSCode?"

This ADR implements exactly this approach: global registry in OS user directory for cross-workspace awareness, isolated databases per workspace for performance and portability.

---

*Created: 2025-10-25*
*Updated: 2025-10-25*
*Template version: 1.0.0*
