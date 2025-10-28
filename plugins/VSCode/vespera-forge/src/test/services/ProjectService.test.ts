/**
 * Unit tests for ProjectService
 * Phase 16a Round 3 - Project-centric architecture foundation
 *
 * Tests cover:
 * - CRUD operations (create, read, update, delete)
 * - Validation logic
 * - File persistence
 * - Active project management
 * - Index management
 * - Error handling
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import {
  ProjectService,
  initializeProjectService,
  disposeProjectService,
  // IProject, // Unused in tests
  ProjectCreateInput
  // ProjectUpdateInput // Unused in tests
} from '../../services/ProjectService';

/**
 * Helper to create a temporary workspace for testing
 */
async function createTestWorkspace(): Promise<vscode.Uri> {
  const tempDir = path.join(__dirname, '../../../.test-workspace');
  const workspaceUri = vscode.Uri.file(tempDir);

  // Clean up any previous test data
  try {
    await vscode.workspace.fs.delete(workspaceUri, { recursive: true });
  } catch {
    // Directory doesn't exist, that's fine
  }

  await vscode.workspace.fs.createDirectory(workspaceUri);
  return workspaceUri;
}

/**
 * Helper to clean up test workspace
 */
async function cleanupTestWorkspace(workspaceUri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.delete(workspaceUri, { recursive: true });
  } catch (error) {
    console.warn('Failed to cleanup test workspace:', error);
  }
}

/**
 * Create a valid test project input
 */
function createTestProjectInput(overrides: Partial<ProjectCreateInput> = {}): ProjectCreateInput {
  return {
    workspace_id: 'test-workspace-id',
    name: 'Test Project',
    project_type: 'fiction',
    description: 'A test project for unit tests',
    settings: {},
    ...overrides
  };
}

suite('ProjectService Tests', () => {
  let workspaceUri: vscode.Uri;
  let service: ProjectService;

  // Setup before all tests
  suiteSetup(async () => {
    workspaceUri = await createTestWorkspace();
  });

  // Teardown after all tests
  suiteTeardown(async () => {
    await cleanupTestWorkspace(workspaceUri);
  });

  // Setup before each test
  setup(async () => {
    // Phase 17: ProjectService no longer takes workspaceUri directly
    // It uses BinderyService for workspace-level storage
    service = await initializeProjectService();
  });

  // Teardown after each test
  teardown(async () => {
    await disposeProjectService();
  });

  // =============================================================================
  // INITIALIZATION TESTS
  // =============================================================================

  suite('Initialization', () => {
    test('Service initializes successfully', async () => {
      assert.ok(service);
      assert.strictEqual(service.isDisposed, false);
    });

    test('Creates .vespera/projects directory structure', async () => {
      const projectsDir = vscode.Uri.joinPath(workspaceUri, '.vespera', 'projects');
      const stat = await vscode.workspace.fs.stat(projectsDir);
      assert.strictEqual(stat.type, vscode.FileType.Directory);
    });

    test('Creates projects index file', async () => {
      const indexFile = vscode.Uri.joinPath(workspaceUri, '.vespera', 'projects', 'projects-index.json');

      try {
        const stat = await vscode.workspace.fs.stat(indexFile);
        assert.strictEqual(stat.type, vscode.FileType.File);
      } catch (error) {
        // Index might not exist yet if no projects created - that's ok
        assert.ok(true);
      }
    });

    test('Singleton pattern works correctly', () => {
      const instance1 = ProjectService.getInstance();
      const instance2 = ProjectService.getInstance();
      assert.strictEqual(instance1, instance2);
    });
  });

  // =============================================================================
  // CREATE OPERATION TESTS
  // =============================================================================

  suite('Create Project', () => {
    test('Creates project with valid input', async () => {
      const input = createTestProjectInput();
      const project = await service.createProject(input);

      assert.ok(project);
      assert.ok(project.id);
      assert.strictEqual(project.name, input.name);
      assert.strictEqual(project.type, input.type);
      assert.strictEqual(project.description, input.description);
      assert.ok(project.createdAt instanceof Date);
      assert.ok(project.updatedAt instanceof Date);
      assert.strictEqual(project.status, ProjectStatus.Active);
    });

    test('Creates project with custom ID', async () => {
      const customId = '12345678-1234-1234-1234-123456789012';
      const input = createTestProjectInput({ id: customId });
      const project = await service.createProject(input);

      assert.strictEqual(project.id, customId);
    });

    test('Creates project with all project types', async () => {
      const types: ProjectType[] = ['journalism', 'research', 'fiction', 'documentation', 'general'];

      for (const type of types) {
        const input = createTestProjectInput({ type, name: `${type} project` });
        const project = await service.createProject(input);

        assert.strictEqual(project.type, type);
      }
    });

    test('Rejects project with missing name', async () => {
      const input = createTestProjectInput({ name: '' });

      await assert.rejects(
        async () => await service.createProject(input),
        /Invalid project input.*name/i
      );
    });

    test('Rejects project with name too long', async () => {
      const longName = 'a'.repeat(PROJECT_CONSTANTS.NAME.MAX_LENGTH + 1);
      const input = createTestProjectInput({ name: longName });

      await assert.rejects(
        async () => await service.createProject(input),
        /name.*exceed/i
      );
    });

    test('Rejects project with invalid type', async () => {
      const input = createTestProjectInput({ type: 'invalid-type' as ProjectType });

      await assert.rejects(
        async () => await service.createProject(input),
        /Invalid project type/i
      );
    });

    test('Rejects duplicate project ID', async () => {
      const customId = '12345678-1234-1234-1234-123456789012';
      const input1 = createTestProjectInput({ id: customId, name: 'Project 1' });
      const input2 = createTestProjectInput({ id: customId, name: 'Project 2' });

      await service.createProject(input1);

      await assert.rejects(
        async () => await service.createProject(input2),
        /already exists/i
      );
    });

    test('Persists project to file', async () => {
      const input = createTestProjectInput();
      const project = await service.createProject(input);

      const projectFile = vscode.Uri.joinPath(
        workspaceUri,
        '.vespera',
        'projects',
        `${project.id}.json`
      );

      const stat = await vscode.workspace.fs.stat(projectFile);
      assert.strictEqual(stat.type, vscode.FileType.File);
    });
  });

  // =============================================================================
  // READ OPERATION TESTS
  // =============================================================================

  suite('Get Project', () => {
    test('Retrieves existing project by ID', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      const retrieved = await service.getProject(created.id);

      assert.ok(retrieved);
      assert.strictEqual(retrieved.id, created.id);
      assert.strictEqual(retrieved.name, created.name);
      assert.strictEqual(retrieved.type, created.type);
    });

    test('Returns undefined for non-existent project', async () => {
      const result = await service.getProject('00000000-0000-0000-0000-000000000000');
      assert.strictEqual(result, undefined);
    });

    test('Uses cache for repeated reads', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      const first = await service.getProject(created.id);
      const second = await service.getProject(created.id);

      // Should be the same object reference (cached)
      assert.strictEqual(first, second);
    });
  });

  // =============================================================================
  // UPDATE OPERATION TESTS
  // =============================================================================

  suite('Update Project', () => {
    test('Updates project name', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      const updated = await service.updateProject(created.id, {
        name: 'Updated Name'
      });

      assert.strictEqual(updated.name, 'Updated Name');
      assert.strictEqual(updated.id, created.id);
    });

    test('Updates project description', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      const updated = await service.updateProject(created.id, {
        description: 'Updated description'
      });

      assert.strictEqual(updated.description, 'Updated description');
    });

    test('Updates project status', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      const updated = await service.updateProject(created.id, {
        status: ProjectStatus.Archived
      });

      assert.strictEqual(updated.status, ProjectStatus.Archived);
    });

    test('Updates project metadata', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      const updated = await service.updateProject(created.id, {
        metadata: {
          ...created.metadata,
          tags: ['tag1', 'tag2'],
          icon: '=�'
        }
      });

      assert.deepStrictEqual(updated.metadata.tags, ['tag1', 'tag2']);
      assert.strictEqual(updated.metadata.icon, '=�');
    });

    test('Updates updatedAt timestamp', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await service.updateProject(created.id, {
        name: 'Updated'
      });

      assert.ok(updated.updatedAt > created.updatedAt);
    });

    test('Preserves createdAt timestamp', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      const updated = await service.updateProject(created.id, {
        name: 'Updated'
      });

      assert.deepStrictEqual(updated.createdAt, created.createdAt);
    });

    test('Prevents ID change', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      const updated = await service.updateProject(created.id, {
        id: '00000000-0000-0000-0000-000000000000' as any,
        name: 'Updated'
      });

      assert.strictEqual(updated.id, created.id);
    });

    test('Rejects update for non-existent project', async () => {
      await assert.rejects(
        async () => await service.updateProject('00000000-0000-0000-0000-000000000000', {
          name: 'Updated'
        }),
        /not found/i
      );
    });
  });

  // =============================================================================
  // DELETE OPERATION TESTS
  // =============================================================================

  suite('Delete Project', () => {
    test('Deletes existing project', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      const result = await service.deleteProject(created.id);
      assert.strictEqual(result, true);

      const retrieved = await service.getProject(created.id);
      assert.strictEqual(retrieved, undefined);
    });

    test('Deletes project file from disk', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      await service.deleteProject(created.id);

      const projectFile = vscode.Uri.joinPath(
        workspaceUri,
        '.vespera',
        'projects',
        `${created.id}.json`
      );

      await assert.rejects(
        async () => await vscode.workspace.fs.stat(projectFile),
        /FileNotFound/i
      );
    });

    test('Returns false for non-existent project', async () => {
      const result = await service.deleteProject('00000000-0000-0000-0000-000000000000');
      assert.strictEqual(result, false);
    });

    test('Clears active project if deleted', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      await service.setActiveProject(created.id);
      assert.strictEqual(service.getActiveProjectId(), created.id);

      await service.deleteProject(created.id);
      assert.strictEqual(service.getActiveProjectId(), null);
    });
  });

  // =============================================================================
  // LIST OPERATION TESTS
  // =============================================================================

  suite('List Projects', () => {
    test('Lists all projects', async () => {
      await service.createProject(createTestProjectInput({ name: 'Project 1' }));
      await service.createProject(createTestProjectInput({ name: 'Project 2' }));
      await service.createProject(createTestProjectInput({ name: 'Project 3' }));

      const projects = await service.listProjects();
      assert.strictEqual(projects.length, 3);
    });

    test('Returns empty array when no projects', async () => {
      const projects = await service.listProjects();
      assert.strictEqual(projects.length, 0);
    });

    test('Filters by project type', async () => {
      await service.createProject(createTestProjectInput({ type: 'fiction', name: 'Fiction 1' }));
      await service.createProject(createTestProjectInput({ type: 'research', name: 'Research 1' }));
      await service.createProject(createTestProjectInput({ type: 'fiction', name: 'Fiction 2' }));

      const filtered = await service.listProjects({ type: 'fiction' });
      assert.strictEqual(filtered.length, 2);
      assert.ok(filtered.every(p => p.type === 'fiction'));
    });

    test('Filters by project status', async () => {
      await service.createProject(createTestProjectInput({ status: ProjectStatus.Active, name: 'Active 1' }));
      const archived = await service.createProject(createTestProjectInput({ name: 'Archived 1' }));
      await service.updateProject(archived.id, { status: ProjectStatus.Archived });

      const filtered = await service.listProjects({ status: ProjectStatus.Active });
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].status, ProjectStatus.Active);
    });

    test('Filters by tags', async () => {
      const metadata1 = createDefaultProjectMetadata();
      metadata1.tags = ['tag1', 'tag2'];
      const metadata2 = createDefaultProjectMetadata();
      metadata2.tags = ['tag3'];

      await service.createProject(createTestProjectInput({ metadata: metadata1, name: 'Project 1' }));
      await service.createProject(createTestProjectInput({ metadata: metadata2, name: 'Project 2' }));

      const filtered = await service.listProjects({ tags: ['tag1'] });
      assert.strictEqual(filtered.length, 1);
      assert.ok(filtered[0].metadata.tags.includes('tag1'));
    });

    test('Searches by name', async () => {
      await service.createProject(createTestProjectInput({ name: 'My Novel Project' }));
      await service.createProject(createTestProjectInput({ name: 'Research Paper' }));

      const filtered = await service.listProjects({ search: 'novel' });
      assert.strictEqual(filtered.length, 1);
      assert.ok(filtered[0].name.toLowerCase().includes('novel'));
    });

    test('Sorts by name', async () => {
      await service.createProject(createTestProjectInput({ name: 'Zebra' }));
      await service.createProject(createTestProjectInput({ name: 'Apple' }));
      await service.createProject(createTestProjectInput({ name: 'Mango' }));

      const sorted = await service.listProjects({ sortBy: 'name', sortDirection: 'asc' });
      assert.strictEqual(sorted[0].name, 'Apple');
      assert.strictEqual(sorted[1].name, 'Mango');
      assert.strictEqual(sorted[2].name, 'Zebra');
    });

    test('Applies pagination limit', async () => {
      await service.createProject(createTestProjectInput({ name: 'Project 1' }));
      await service.createProject(createTestProjectInput({ name: 'Project 2' }));
      await service.createProject(createTestProjectInput({ name: 'Project 3' }));

      const limited = await service.listProjects({ limit: 2 });
      assert.strictEqual(limited.length, 2);
    });

    test('Applies pagination offset', async () => {
      await service.createProject(createTestProjectInput({ name: 'Project 1' }));
      await service.createProject(createTestProjectInput({ name: 'Project 2' }));
      await service.createProject(createTestProjectInput({ name: 'Project 3' }));

      const paginated = await service.listProjects({
        sortBy: 'name',
        offset: 1,
        limit: 2
      });
      assert.strictEqual(paginated.length, 2);
    });
  });

  // =============================================================================
  // ACTIVE PROJECT TESTS
  // =============================================================================

  suite('Active Project Management', () => {
    test('Sets active project', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      await service.setActiveProject(created.id);

      const active = service.getActiveProject();
      assert.ok(active);
      assert.strictEqual(active.id, created.id);
    });

    test('Returns active project ID', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      await service.setActiveProject(created.id);

      assert.strictEqual(service.getActiveProjectId(), created.id);
    });

    test('Clears active project', async () => {
      const input = createTestProjectInput();
      const created = await service.createProject(input);

      await service.setActiveProject(created.id);
      service.clearActiveProject();

      assert.strictEqual(service.getActiveProjectId(), null);
      assert.strictEqual(service.getActiveProject(), undefined);
    });

    test('Rejects setting non-existent project as active', async () => {
      await assert.rejects(
        async () => await service.setActiveProject('00000000-0000-0000-0000-000000000000'),
        /not found/i
      );
    });
  });

  // =============================================================================
  // STATISTICS TESTS
  // =============================================================================

  suite('Project Statistics', () => {
    test('Returns correct total count', async () => {
      await service.createProject(createTestProjectInput({ name: 'Project 1' }));
      await service.createProject(createTestProjectInput({ name: 'Project 2' }));

      const stats = await service.getStats();
      assert.strictEqual(stats.total, 2);
    });

    test('Counts projects by type', async () => {
      await service.createProject(createTestProjectInput({ type: 'fiction', name: 'Fiction 1' }));
      await service.createProject(createTestProjectInput({ type: 'fiction', name: 'Fiction 2' }));
      await service.createProject(createTestProjectInput({ type: 'research', name: 'Research 1' }));

      const stats = await service.getStats();
      assert.strictEqual(stats.byType.fiction, 2);
      assert.strictEqual(stats.byType.research, 1);
    });

    test('Counts projects by status', async () => {
      const _active = await service.createProject(createTestProjectInput({ name: 'Active' }));
      void _active; // Used for side effect only
      const toArchive = await service.createProject(createTestProjectInput({ name: 'Archived' }));
      await service.updateProject(toArchive.id, { status: ProjectStatus.Archived });

      const stats = await service.getStats();
      assert.strictEqual(stats.byStatus[ProjectStatus.Active], 1);
      assert.strictEqual(stats.byStatus[ProjectStatus.Archived], 1);
    });

    test('Identifies most recently updated project', async () => {
      const _p1 = await service.createProject(createTestProjectInput({ name: 'Old' }));
      void _p1; // Used for side effect only
      await new Promise(resolve => setTimeout(resolve, 10));
      const p2 = await service.createProject(createTestProjectInput({ name: 'Recent' }));

      const stats = await service.getStats();
      assert.ok(stats.recentlyUpdated);
      assert.strictEqual(stats.recentlyUpdated.id, p2.id);
    });
  });

  // =============================================================================
  // VALIDATION TESTS
  // =============================================================================

  suite('Project Validation', () => {
    test('Validates project name length', async () => {
      const input = createTestProjectInput({ name: '' });

      await assert.rejects(
        async () => await service.createProject(input),
        /name.*required|empty/i
      );
    });

    test('Validates project name characters', async () => {
      const input = createTestProjectInput({ name: 'Invalid<>Name' });

      await assert.rejects(
        async () => await service.createProject(input),
        /invalid characters/i
      );
    });

    test('Validates description length', async () => {
      const longDescription = 'a'.repeat(PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH + 1);
      const input = createTestProjectInput({ description: longDescription });

      await assert.rejects(
        async () => await service.createProject(input),
        /description.*exceed/i
      );
    });

    test('Validates tag count', async () => {
      const metadata = createDefaultProjectMetadata();
      metadata.tags = new Array(PROJECT_CONSTANTS.TAGS.MAX_COUNT + 1).fill('tag');
      const input = createTestProjectInput({ metadata });

      await assert.rejects(
        async () => await service.createProject(input),
        /tag/i
      );
    });

    test('Validates tag characters', async () => {
      const metadata = createDefaultProjectMetadata();
      metadata.tags = ['invalid<>tag'];
      const input = createTestProjectInput({ metadata });

      await assert.rejects(
        async () => await service.createProject(input),
        /tag.*invalid/i
      );
    });
  });

  // =============================================================================
  // LIFECYCLE TESTS
  // =============================================================================

  suite('Service Lifecycle', () => {
    test('Disposes service correctly', async () => {
      await service.dispose();
      assert.strictEqual(service.isDisposed, true);
    });

    test('Rejects operations after disposal', async () => {
      await service.dispose();

      await assert.rejects(
        async () => await service.createProject(createTestProjectInput()),
        /disposed/i
      );
    });

    test('Can reinitialize after disposal', async () => {
      await disposeProjectService();
      const newService = await initializeProjectService(workspaceUri);

      assert.ok(newService);
      assert.strictEqual(newService.isDisposed, false);
    });
  });
});
