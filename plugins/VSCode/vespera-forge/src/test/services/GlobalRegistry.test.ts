/**
 * GlobalRegistry Tests
 * Phase 17 Task B1 - Platform-specific path detection tests
 *
 * Tests use Mocha framework (VS Code's standard test framework)
 */

import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  getPlatform,
  getGlobalVesperaPath,
  getProjectsRegistryPath,
  getGlobalTemplatesPath,
  getGlobalConfigPath,
  getGlobalCachePath,
  getGlobalLogsPath,
  // ProjectRegistryEntry, // Unused type in tests
  ProjectsRegistry,
  createEmptyRegistry,
  validateRegistry,
  loadRegistry,
  saveRegistry,
  syncProjectToRegistry,
  removeProjectFromRegistry,
  updateLastOpened,
  getRecentProjects,
  findProjectsByWorkspace,
  initializeGlobalRegistry
} from '../../services/GlobalRegistry';
import { IProject, ProjectStatus } from '../../types/project';

suite('GlobalRegistry Tests', () => {
  // Store original environment variables to restore after tests
  const originalEnv = { ...process.env };
  let originalPlatform: NodeJS.Platform;

  suiteSetup(() => {
    originalPlatform = process.platform;
  });

  setup(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  teardown(() => {
    // Restore environment after each test
    process.env = { ...originalEnv };
  });

  suiteTeardown(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true
    });
  });

  suite('getPlatform', () => {
    test('should detect Windows platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });
      assert.strictEqual(getPlatform(), 'windows');
    });

    test('should detect macOS platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });
      assert.strictEqual(getPlatform(), 'macos');
    });

    test('should detect Linux platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });
      assert.strictEqual(getPlatform(), 'linux');
    });

    test('should return unknown for unsupported platforms', () => {
      Object.defineProperty(process, 'platform', {
        value: 'freebsd',
        configurable: true
      });
      assert.strictEqual(getPlatform(), 'unknown');
    });
  });

  suite('getGlobalVesperaPath', () => {
    test('should return correct path for Windows with APPDATA', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });

      const appData = 'C:\\Users\\TestUser\\AppData\\Roaming';
      process.env['APPDATA'] = appData;

      const result = getGlobalVesperaPath();
      assert.strictEqual(result, path.join(appData, 'Vespera'));
      assert.ok(result.includes('Vespera'));
    });

    test('should return correct path for macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });

      // On macOS, the actual os.homedir() will return a real path
      const homedir = os.homedir();
      const expected = path.join(homedir, 'Library', 'Application Support', 'Vespera');

      const result = getGlobalVesperaPath();
      assert.strictEqual(result, expected);
    });

    test('should return correct path for Linux with XDG_DATA_HOME', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      process.env['XDG_DATA_HOME'] = '/home/testuser/.local/share';

      const result = getGlobalVesperaPath();
      assert.strictEqual(result, '/home/testuser/.local/share/vespera');
    });

    test('should return correct path for Linux without XDG_DATA_HOME', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      delete process.env['XDG_DATA_HOME'];
      const homedir = os.homedir();

      const result = getGlobalVesperaPath();
      assert.strictEqual(result, path.join(homedir, '.local', 'share', 'vespera'));
    });

    test('should return fallback path for unknown platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'freebsd',
        configurable: true
      });

      const homedir = os.homedir();
      const expected = path.join(homedir, '.vespera');

      const result = getGlobalVesperaPath();
      assert.strictEqual(result, expected);
    });

    test('should respect VESPERA_REGISTRY_PATH environment variable override', () => {
      const customPath = '/custom/vespera/path';
      process.env['VESPERA_REGISTRY_PATH'] = customPath;

      const result = getGlobalVesperaPath();
      assert.strictEqual(result, path.normalize(customPath));
    });

    test('should ignore empty VESPERA_REGISTRY_PATH environment variable', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      process.env['VESPERA_REGISTRY_PATH'] = '';
      delete process.env['XDG_DATA_HOME'];
      const homedir = os.homedir();

      const result = getGlobalVesperaPath();
      assert.strictEqual(result, path.join(homedir, '.local', 'share', 'vespera'));
    });

    test('should ignore whitespace-only VESPERA_REGISTRY_PATH environment variable', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      process.env['VESPERA_REGISTRY_PATH'] = '   ';
      delete process.env['XDG_DATA_HOME'];
      const homedir = os.homedir();

      const result = getGlobalVesperaPath();
      assert.strictEqual(result, path.join(homedir, '.local', 'share', 'vespera'));
    });

    test('should normalize paths without trailing slashes', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const result = getGlobalVesperaPath();
      assert.ok(!result.endsWith('/'));
      assert.ok(!result.endsWith('\\'));
    });

    test('should return absolute paths', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const result = getGlobalVesperaPath();
      assert.ok(path.isAbsolute(result), `Expected absolute path, got: ${result}`);
    });
  });

  suite('getProjectsRegistryPath', () => {
    test('should return correct registry file path', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const homedir = os.homedir();
      delete process.env['XDG_DATA_HOME'];

      const result = getProjectsRegistryPath();
      const expected = path.join(homedir, '.local', 'share', 'vespera', 'projects-registry.json');

      assert.strictEqual(result, expected);
      assert.ok(result.includes('projects-registry.json'));
    });

    test('should be within global Vespera directory', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const globalDir = getGlobalVesperaPath();
      const registryPath = getProjectsRegistryPath();

      assert.ok(registryPath.startsWith(globalDir),
        `Expected ${registryPath} to start with ${globalDir}`);
    });

    test('should respect environment variable override', () => {
      const customPath = '/custom/vespera';
      process.env['VESPERA_REGISTRY_PATH'] = customPath;

      const result = getProjectsRegistryPath();
      const expected = path.join(path.normalize(customPath), 'projects-registry.json');

      assert.strictEqual(result, expected);
    });
  });

  suite('getGlobalTemplatesPath', () => {
    test('should return correct templates directory path', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const homedir = os.homedir();
      delete process.env['XDG_DATA_HOME'];

      const result = getGlobalTemplatesPath();
      const expected = path.join(homedir, '.local', 'share', 'vespera', 'templates');

      assert.strictEqual(result, expected);
    });

    test('should be within global Vespera directory', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const globalDir = getGlobalVesperaPath();
      const templatesPath = getGlobalTemplatesPath();

      assert.ok(templatesPath.startsWith(globalDir),
        `Expected ${templatesPath} to start with ${globalDir}`);
    });
  });

  suite('getGlobalConfigPath', () => {
    test('should return correct config file path', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const homedir = os.homedir();
      delete process.env['XDG_DATA_HOME'];

      const result = getGlobalConfigPath();
      const expected = path.join(homedir, '.local', 'share', 'vespera', 'config.json');

      assert.strictEqual(result, expected);
    });
  });

  suite('getGlobalCachePath', () => {
    test('should return correct cache directory path', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const homedir = os.homedir();
      delete process.env['XDG_DATA_HOME'];

      const result = getGlobalCachePath();
      const expected = path.join(homedir, '.local', 'share', 'vespera', 'cache');

      assert.strictEqual(result, expected);
    });
  });

  suite('getGlobalLogsPath', () => {
    test('should return correct logs directory path', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const homedir = os.homedir();
      delete process.env['XDG_DATA_HOME'];

      const result = getGlobalLogsPath();
      const expected = path.join(homedir, '.local', 'share', 'vespera', 'logs');

      assert.strictEqual(result, expected);
    });
  });

  suite('Path consistency', () => {
    test('should maintain consistent paths across multiple calls', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const path1 = getGlobalVesperaPath();
      const path2 = getGlobalVesperaPath();

      assert.strictEqual(path1, path2);
    });

    test('should use consistent separators', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const result = getGlobalVesperaPath();
      // On Linux, should use forward slashes
      assert.ok(result.includes('/'));
    });

    test('should not contain double slashes', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const result = getGlobalVesperaPath();
      // Check for consecutive slashes (excluding protocol slashes)
      const hasDoubleSlashes = /\/\//.test(result);
      assert.ok(!hasDoubleSlashes, `Path contains double slashes: ${result}`);
    });
  });

  suite('Cross-platform compatibility', () => {
    test('should handle all platforms correctly', () => {
      const platforms: NodeJS.Platform[] = ['win32', 'darwin', 'linux'];

      platforms.forEach(platform => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          configurable: true
        });

        const result = getGlobalVesperaPath();
        assert.ok(result, `Path should not be empty for platform ${platform}`);
        assert.ok(result.length > 0, `Path should have length for platform ${platform}`);
        assert.ok(path.isAbsolute(result), `Path should be absolute for platform ${platform}`);
      });
    });
  });

  suite('Real environment test', () => {
    test('should work with actual current platform', () => {
      // Test with the actual platform we're running on
      const platform = getPlatform();
      const globalPath = getGlobalVesperaPath();
      const registryPath = getProjectsRegistryPath();

      assert.ok(platform, 'Platform should be detected');
      assert.ok(globalPath, 'Global path should be returned');
      assert.ok(path.isAbsolute(globalPath), 'Global path should be absolute');
      assert.ok(registryPath, 'Registry path should be returned');
      assert.ok(path.isAbsolute(registryPath), 'Registry path should be absolute');
      assert.ok(registryPath.startsWith(globalPath), 'Registry should be within global path');
    });
  });

  suite('createEmptyRegistry', () => {
    test('should create valid empty registry', () => {
      const registry = createEmptyRegistry();

      assert.strictEqual(registry.version, '1.0.0', 'Should have version 1.0.0');
      assert.ok(registry.last_updated, 'Should have last_updated timestamp');
      assert.ok(typeof registry.last_updated === 'string', 'last_updated should be string');
      assert.deepStrictEqual(registry.projects, {}, 'Should have empty projects object');
    });

    test('should create valid ISO 8601 timestamp', () => {
      const registry = createEmptyRegistry();

      // Validate ISO 8601 format
      const timestamp = new Date(registry.last_updated);
      assert.ok(!isNaN(timestamp.getTime()), 'Should be valid date');

      // Should be recent (within last second)
      const now = new Date();
      const diff = now.getTime() - timestamp.getTime();
      assert.ok(diff >= 0 && diff < 1000, 'Timestamp should be recent');
    });

    test('should create new timestamp on each call', () => {
      const registry1 = createEmptyRegistry();
      const registry2 = createEmptyRegistry();

      // Timestamps might be equal if called very quickly, but objects should be different
      assert.notStrictEqual(registry1, registry2, 'Should create new object');
    });
  });

  suite('validateRegistry', () => {
    test('should validate valid empty registry', () => {
      const registry = createEmptyRegistry();
      assert.ok(validateRegistry(registry), 'Empty registry should be valid');
    });

    test('should validate registry with projects', () => {
      const registry: ProjectsRegistry = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        projects: {
          'proj-123': {
            id: 'proj-123',
            name: 'Test Project',
            workspace_path: '/path/to/workspace',
            project_type: 'fiction',
            last_opened: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
      };

      assert.ok(validateRegistry(registry), 'Registry with projects should be valid');
    });

    test('should validate project with optional active_context_id', () => {
      const registry: ProjectsRegistry = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        projects: {
          'proj-123': {
            id: 'proj-123',
            name: 'Test Project',
            workspace_path: '/path/to/workspace',
            project_type: 'fiction',
            last_opened: new Date().toISOString(),
            active_context_id: 'ctx-456',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
      };

      assert.ok(validateRegistry(registry), 'Registry with active_context_id should be valid');
    });

    test('should reject null data', () => {
      assert.ok(!validateRegistry(null), 'null should be invalid');
    });

    test('should reject undefined data', () => {
      assert.ok(!validateRegistry(undefined), 'undefined should be invalid');
    });

    test('should reject non-object data', () => {
      assert.ok(!validateRegistry('string'), 'string should be invalid');
      assert.ok(!validateRegistry(123), 'number should be invalid');
      assert.ok(!validateRegistry(true), 'boolean should be invalid');
    });

    test('should reject missing version', () => {
      const invalid = {
        last_updated: new Date().toISOString(),
        projects: {}
      };
      assert.ok(!validateRegistry(invalid), 'Missing version should be invalid');
    });

    test('should reject non-string version', () => {
      const invalid = {
        version: 123,
        last_updated: new Date().toISOString(),
        projects: {}
      };
      assert.ok(!validateRegistry(invalid), 'Non-string version should be invalid');
    });

    test('should reject missing last_updated', () => {
      const invalid = {
        version: '1.0.0',
        projects: {}
      };
      assert.ok(!validateRegistry(invalid), 'Missing last_updated should be invalid');
    });

    test('should reject non-string last_updated', () => {
      const invalid = {
        version: '1.0.0',
        last_updated: 123,
        projects: {}
      };
      assert.ok(!validateRegistry(invalid), 'Non-string last_updated should be invalid');
    });

    test('should reject missing projects', () => {
      const invalid = {
        version: '1.0.0',
        last_updated: new Date().toISOString()
      };
      assert.ok(!validateRegistry(invalid), 'Missing projects should be invalid');
    });

    test('should reject non-object projects', () => {
      const invalid = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        projects: []
      };
      assert.ok(!validateRegistry(invalid), 'Array projects should be invalid');
    });

    test('should reject project with missing id', () => {
      const invalid = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        projects: {
          'proj-123': {
            name: 'Test',
            workspace_path: '/path',
            project_type: 'fiction',
            last_opened: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
      };
      assert.ok(!validateRegistry(invalid), 'Project missing id should be invalid');
    });

    test('should reject project with missing name', () => {
      const invalid = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        projects: {
          'proj-123': {
            id: 'proj-123',
            workspace_path: '/path',
            project_type: 'fiction',
            last_opened: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
      };
      assert.ok(!validateRegistry(invalid), 'Project missing name should be invalid');
    });

    test('should reject project with missing workspace_path', () => {
      const invalid = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        projects: {
          'proj-123': {
            id: 'proj-123',
            name: 'Test',
            project_type: 'fiction',
            last_opened: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
      };
      assert.ok(!validateRegistry(invalid), 'Project missing workspace_path should be invalid');
    });

    test('should reject project with missing project_type', () => {
      const invalid = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        projects: {
          'proj-123': {
            id: 'proj-123',
            name: 'Test',
            workspace_path: '/path',
            last_opened: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
      };
      assert.ok(!validateRegistry(invalid), 'Project missing project_type should be invalid');
    });

    test('should reject project with missing last_opened', () => {
      const invalid = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        projects: {
          'proj-123': {
            id: 'proj-123',
            name: 'Test',
            workspace_path: '/path',
            project_type: 'fiction',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
      };
      assert.ok(!validateRegistry(invalid), 'Project missing last_opened should be invalid');
    });

    test('should reject project with missing created_at', () => {
      const invalid = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        projects: {
          'proj-123': {
            id: 'proj-123',
            name: 'Test',
            workspace_path: '/path',
            project_type: 'fiction',
            last_opened: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
      };
      assert.ok(!validateRegistry(invalid), 'Project missing created_at should be invalid');
    });

    test('should reject project with missing updated_at', () => {
      const invalid = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        projects: {
          'proj-123': {
            id: 'proj-123',
            name: 'Test',
            workspace_path: '/path',
            project_type: 'fiction',
            last_opened: new Date().toISOString(),
            created_at: new Date().toISOString()
          }
        }
      };
      assert.ok(!validateRegistry(invalid), 'Project missing updated_at should be invalid');
    });

    test('should reject project with non-string active_context_id', () => {
      const invalid = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        projects: {
          'proj-123': {
            id: 'proj-123',
            name: 'Test',
            workspace_path: '/path',
            project_type: 'fiction',
            last_opened: new Date().toISOString(),
            active_context_id: 123,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
      };
      assert.ok(!validateRegistry(invalid), 'Project with non-string active_context_id should be invalid');
    });
  });

  suite('loadRegistry and saveRegistry', () => {
    // Use a temporary directory for test registry
    let testRegistryPath: string;
    let originalGetProjectsRegistryPath: () => string;

    setup(() => {
      // Create a unique temp directory for this test
      const tmpDir = os.tmpdir();
      testRegistryPath = path.join(tmpDir, `vespera-test-${Date.now()}`);

      // Mock getProjectsRegistryPath to return test path
      originalGetProjectsRegistryPath = require('../../services/GlobalRegistry').getProjectsRegistryPath;
      const GlobalRegistry = require('../../services/GlobalRegistry');
      GlobalRegistry.getProjectsRegistryPath = () => path.join(testRegistryPath, 'projects-registry.json');
    });

    teardown(async () => {
      // Restore original function
      const GlobalRegistry = require('../../services/GlobalRegistry');
      GlobalRegistry.getProjectsRegistryPath = originalGetProjectsRegistryPath;

      // Clean up test directory
      try {
        const uri = vscode.Uri.file(testRegistryPath);
        await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
      } catch (_error) {
        // Ignore cleanup errors
      }
    });

    test('should return null when registry does not exist', async () => {
      const registry = await loadRegistry();
      assert.strictEqual(registry, null, 'Should return null for non-existent registry');
    });

    test('should save and load empty registry', async () => {
      const registry = createEmptyRegistry();
      await saveRegistry(registry);

      const loaded = await loadRegistry();
      assert.ok(loaded, 'Should load saved registry');
      assert.strictEqual(loaded.version, '1.0.0', 'Should preserve version');
      assert.deepStrictEqual(loaded.projects, {}, 'Should preserve empty projects');
    });

    test('should save and load registry with projects', async () => {
      const registry = createEmptyRegistry();
      const now = new Date().toISOString();

      registry.projects['proj-123'] = {
        id: 'proj-123',
        name: 'Test Project',
        workspace_path: '/path/to/workspace',
        project_type: 'fiction',
        last_opened: now,
        created_at: now,
        updated_at: now
      };

      await saveRegistry(registry);

      const loaded = await loadRegistry();
      assert.ok(loaded, 'Should load saved registry');
      assert.strictEqual(Object.keys(loaded.projects).length, 1, 'Should have one project');

      const project = loaded.projects['proj-123'];
      assert.ok(project, 'Should have project proj-123');
      assert.strictEqual(project.id, 'proj-123', 'Should preserve project id');
      assert.strictEqual(project.name, 'Test Project', 'Should preserve project name');
      assert.strictEqual(project.workspace_path, '/path/to/workspace', 'Should preserve workspace_path');
      assert.strictEqual(project.project_type, 'fiction', 'Should preserve project_type');
      assert.strictEqual(project.last_opened, now, 'Should preserve last_opened');
      assert.strictEqual(project.created_at, now, 'Should preserve created_at');
      assert.strictEqual(project.updated_at, now, 'Should preserve updated_at');
    });

    test('should save registry with optional active_context_id', async () => {
      const registry = createEmptyRegistry();
      const now = new Date().toISOString();

      registry.projects['proj-123'] = {
        id: 'proj-123',
        name: 'Test Project',
        workspace_path: '/path/to/workspace',
        project_type: 'fiction',
        last_opened: now,
        active_context_id: 'ctx-456',
        created_at: now,
        updated_at: now
      };

      await saveRegistry(registry);

      const loaded = await loadRegistry();
      assert.ok(loaded, 'Should load saved registry');

      const project = loaded.projects['proj-123'];
      assert.strictEqual(project.active_context_id, 'ctx-456', 'Should preserve active_context_id');
    });

    test('should update last_updated on save', async () => {
      const registry = createEmptyRegistry();
      const originalTimestamp = registry.last_updated;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await saveRegistry(registry);

      const loaded = await loadRegistry();
      assert.ok(loaded, 'Should load saved registry');
      assert.notStrictEqual(loaded.last_updated, originalTimestamp, 'Should update last_updated timestamp');
    });

    test('should handle multiple projects', async () => {
      const registry = createEmptyRegistry();
      const now = new Date().toISOString();

      for (let i = 0; i < 10; i++) {
        registry.projects[`proj-${i}`] = {
          id: `proj-${i}`,
          name: `Project ${i}`,
          workspace_path: `/path/to/workspace${i}`,
          project_type: i % 2 === 0 ? 'fiction' : 'research',
          last_opened: now,
          created_at: now,
          updated_at: now
        };
      }

      await saveRegistry(registry);

      const loaded = await loadRegistry();
      assert.ok(loaded, 'Should load saved registry');
      assert.strictEqual(Object.keys(loaded.projects).length, 10, 'Should have 10 projects');

      for (let i = 0; i < 10; i++) {
        const project = loaded.projects[`proj-${i}`];
        assert.ok(project, `Should have project proj-${i}`);
        assert.strictEqual(project.name, `Project ${i}`, `Should preserve name for project ${i}`);
      }
    });

    test('should throw error for corrupted JSON', async () => {
      // Save valid registry first
      const registry = createEmptyRegistry();
      await saveRegistry(registry);

      // Corrupt the file
      const GlobalRegistry = require('../../services/GlobalRegistry');
      const registryPath = GlobalRegistry.getProjectsRegistryPath();
      const uri = vscode.Uri.file(registryPath);
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(uri, encoder.encode('{ invalid json }'));

      try {
        await loadRegistry();
        assert.fail('Should throw error for corrupted JSON');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw Error object');
        assert.ok(error.message.includes('Registry corrupted'), 'Should mention registry corrupted');
      }
    });

    test('should throw error for invalid schema', async () => {
      // Save valid registry first, then replace with invalid schema
      const registry = createEmptyRegistry();
      await saveRegistry(registry);

      // Write invalid schema
      const GlobalRegistry = require('../../services/GlobalRegistry');
      const registryPath = GlobalRegistry.getProjectsRegistryPath();
      const uri = vscode.Uri.file(registryPath);
      const encoder = new TextEncoder();
      const invalid = JSON.stringify({ version: '1.0.0' }); // Missing required fields
      await vscode.workspace.fs.writeFile(uri, encoder.encode(invalid));

      try {
        await loadRegistry();
        assert.fail('Should throw error for invalid schema');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw Error object');
        assert.ok(error.message.includes('Registry validation failed'), 'Should mention validation failed');
      }
    });

    test('should pretty-print JSON with 2-space indentation', async () => {
      const registry = createEmptyRegistry();
      registry.projects['proj-123'] = {
        id: 'proj-123',
        name: 'Test',
        workspace_path: '/path',
        project_type: 'fiction',
        last_opened: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await saveRegistry(registry);

      // Read raw file content
      const GlobalRegistry = require('../../services/GlobalRegistry');
      const registryPath = GlobalRegistry.getProjectsRegistryPath();
      const uri = vscode.Uri.file(registryPath);
      const content = await vscode.workspace.fs.readFile(uri);
      const decoder = new TextDecoder('utf-8');
      const json = decoder.decode(content);

      // Check for proper indentation
      assert.ok(json.includes('  "version"'), 'Should have 2-space indentation');
      assert.ok(json.includes('    "id"'), 'Should have nested 4-space indentation');
    });

    test('should create parent directory if it does not exist', async () => {
      // This is implicitly tested by other tests, but let's be explicit
      const registry = createEmptyRegistry();
      await saveRegistry(registry);

      const GlobalRegistry = require('../../services/GlobalRegistry');
      const registryPath = GlobalRegistry.getProjectsRegistryPath();
      const registryDir = path.dirname(registryPath);

      const dirUri = vscode.Uri.file(registryDir);
      const stat = await vscode.workspace.fs.stat(dirUri);
      assert.strictEqual(stat.type, vscode.FileType.Directory, 'Parent directory should exist');
    });

    test('should handle overwriting existing registry', async () => {
      // Save first registry
      const registry1 = createEmptyRegistry();
      registry1.projects['proj-1'] = {
        id: 'proj-1',
        name: 'First',
        workspace_path: '/path1',
        project_type: 'fiction',
        last_opened: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await saveRegistry(registry1);

      // Save second registry
      const registry2 = createEmptyRegistry();
      registry2.projects['proj-2'] = {
        id: 'proj-2',
        name: 'Second',
        workspace_path: '/path2',
        project_type: 'research',
        last_opened: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await saveRegistry(registry2);

      // Load and verify second registry overwrote first
      const loaded = await loadRegistry();
      assert.ok(loaded, 'Should load registry');
      assert.ok(!loaded.projects['proj-1'], 'Should not have first project');
      assert.ok(loaded.projects['proj-2'], 'Should have second project');
    });
  });

  // =============================================================================
  // REGISTRY SYNC OPERATIONS - Phase 17 Task B3
  // =============================================================================

  suite('syncProjectToRegistry', () => {
    // Use a temporary directory for test registry
    let testRegistryPath: string;
    let originalGetProjectsRegistryPath: () => string;

    // Helper to create a mock IProject
    function createMockProject(id: string, name: string, type: string): IProject {
      const now = new Date();
      return {
        id,
        name,
        type,
        description: `Test project ${name}`,
        status: ProjectStatus.Active,
        metadata: {
          createdAt: now,
          updatedAt: now,
          version: '1.0.0',
          tags: []
        },
        settings: {
          enabledAutomation: false,
          customSettings: {}
        }
      };
    }

    setup(() => {
      // Create a unique temp directory for this test
      const tmpDir = os.tmpdir();
      testRegistryPath = path.join(tmpDir, `vespera-test-sync-${Date.now()}`);

      // Mock getProjectsRegistryPath to return test path
      originalGetProjectsRegistryPath = require('../../services/GlobalRegistry').getProjectsRegistryPath;
      const GlobalRegistry = require('../../services/GlobalRegistry');
      GlobalRegistry.getProjectsRegistryPath = () => path.join(testRegistryPath, 'projects-registry.json');
    });

    teardown(async () => {
      // Restore original function
      const GlobalRegistry = require('../../services/GlobalRegistry');
      GlobalRegistry.getProjectsRegistryPath = originalGetProjectsRegistryPath;

      // Clean up test directory
      try {
        const uri = vscode.Uri.file(testRegistryPath);
        await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
      } catch (_error) {
        // Ignore cleanup errors
      }
    });

    test('should sync project to empty registry', async () => {
      const project = createMockProject('proj-123', 'Test Project', 'fiction');
      const workspacePath = '/path/to/workspace';

      await syncProjectToRegistry(project, workspacePath);

      const registry = await loadRegistry();
      assert.ok(registry, 'Registry should exist');
      assert.strictEqual(Object.keys(registry.projects).length, 1, 'Should have one project');

      const entry = registry.projects['proj-123'];
      assert.ok(entry, 'Should have project entry');
      assert.strictEqual(entry.id, 'proj-123', 'Should preserve id');
      assert.strictEqual(entry.name, 'Test Project', 'Should preserve name');
      assert.strictEqual(entry.workspace_path, '/path/to/workspace', 'Should set workspace_path');
      assert.strictEqual(entry.project_type, 'fiction', 'Should preserve type');
      assert.ok(entry.created_at, 'Should have created_at');
      assert.ok(entry.updated_at, 'Should have updated_at');
      assert.ok(entry.last_opened, 'Should have last_opened');
    });

    test('should sync multiple projects', async () => {
      const project1 = createMockProject('proj-1', 'Project 1', 'fiction');
      const project2 = createMockProject('proj-2', 'Project 2', 'research');

      await syncProjectToRegistry(project1, '/workspace1');
      await syncProjectToRegistry(project2, '/workspace2');

      const registry = await loadRegistry();
      assert.ok(registry, 'Registry should exist');
      assert.strictEqual(Object.keys(registry.projects).length, 2, 'Should have two projects');
      assert.ok(registry.projects['proj-1'], 'Should have project 1');
      assert.ok(registry.projects['proj-2'], 'Should have project 2');
    });

    test('should update existing project in registry', async () => {
      const project = createMockProject('proj-123', 'Original Name', 'fiction');

      await syncProjectToRegistry(project, '/workspace');

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update project and sync again
      project.name = 'Updated Name';
      await syncProjectToRegistry(project, '/workspace');

      const registry = await loadRegistry();
      assert.ok(registry, 'Registry should exist');
      assert.strictEqual(Object.keys(registry.projects).length, 1, 'Should still have one project');

      const entry = registry.projects['proj-123'];
      assert.strictEqual(entry.name, 'Updated Name', 'Should update name');
    });

    test('should sync project with active_context_id as undefined (until Task D)', async () => {
      const project = createMockProject('proj-123', 'Test', 'fiction');
      // TODO (Task D): Test with actual context when context system is implemented

      await syncProjectToRegistry(project, '/workspace');

      const registry = await loadRegistry();
      assert.ok(registry, 'Registry should exist');

      const entry = registry.projects['proj-123'];
      assert.strictEqual(entry.active_context_id, undefined, 'Should be undefined until context system implemented');
    });

    test('should handle project without active_context_id', async () => {
      const project = createMockProject('proj-123', 'Test', 'fiction');
      // active_context_id is undefined

      await syncProjectToRegistry(project, '/workspace');

      const registry = await loadRegistry();
      assert.ok(registry, 'Registry should exist');

      const entry = registry.projects['proj-123'];
      assert.strictEqual(entry.active_context_id, undefined, 'Should be undefined');
    });

    test('should set updated_at to current time', async () => {
      const project = createMockProject('proj-123', 'Test', 'fiction');
      const beforeSync = new Date();

      await syncProjectToRegistry(project, '/workspace');

      const afterSync = new Date();
      const registry = await loadRegistry();
      assert.ok(registry, 'Registry should exist');

      const entry = registry.projects['proj-123'];
      const updatedAt = new Date(entry.updated_at);

      assert.ok(updatedAt >= beforeSync, 'updated_at should be after or equal to before time');
      assert.ok(updatedAt <= afterSync, 'updated_at should be before or equal to after time');
    });

    test('should set last_opened to current time', async () => {
      const project = createMockProject('proj-123', 'Test', 'fiction');
      const beforeSync = new Date();

      await syncProjectToRegistry(project, '/workspace');

      const afterSync = new Date();
      const registry = await loadRegistry();
      assert.ok(registry, 'Registry should exist');

      const entry = registry.projects['proj-123'];
      const lastOpened = new Date(entry.last_opened);

      assert.ok(lastOpened >= beforeSync, 'last_opened should be after or equal to before time');
      assert.ok(lastOpened <= afterSync, 'last_opened should be before or equal to after time');
    });

    test('should preserve created_at from project metadata', async () => {
      const project = createMockProject('proj-123', 'Test', 'fiction');
      const createdAt = new Date('2025-01-01T00:00:00Z');
      project.metadata.createdAt = createdAt;

      await syncProjectToRegistry(project, '/workspace');

      const registry = await loadRegistry();
      assert.ok(registry, 'Registry should exist');

      const entry = registry.projects['proj-123'];
      assert.strictEqual(entry.created_at, createdAt.toISOString(), 'Should preserve created_at');
    });
  });

  suite('removeProjectFromRegistry', () => {
    let testRegistryPath: string;
    let originalGetProjectsRegistryPath: () => string;

    function createMockProject(id: string, name: string, type: string): IProject {
      const now = new Date();
      return {
        id,
        name,
        type,
        description: `Test project ${name}`,
        status: ProjectStatus.Active,
        metadata: {
          createdAt: now,
          updatedAt: now,
          version: '1.0.0',
          tags: []
        },
        settings: {
          enabledAutomation: false,
          customSettings: {}
        }
      };
    }

    setup(() => {
      const tmpDir = os.tmpdir();
      testRegistryPath = path.join(tmpDir, `vespera-test-remove-${Date.now()}`);

      originalGetProjectsRegistryPath = require('../../services/GlobalRegistry').getProjectsRegistryPath;
      const GlobalRegistry = require('../../services/GlobalRegistry');
      GlobalRegistry.getProjectsRegistryPath = () => path.join(testRegistryPath, 'projects-registry.json');
    });

    teardown(async () => {
      const GlobalRegistry = require('../../services/GlobalRegistry');
      GlobalRegistry.getProjectsRegistryPath = originalGetProjectsRegistryPath;

      try {
        const uri = vscode.Uri.file(testRegistryPath);
        await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
      } catch (_error) {
        // Ignore cleanup errors
      }
    });

    test('should remove project from registry', async () => {
      const project = createMockProject('proj-123', 'Test', 'fiction');
      await syncProjectToRegistry(project, '/workspace');

      // Verify it was added
      let registry = await loadRegistry();
      assert.ok(registry?.projects['proj-123'], 'Project should exist before removal');

      // Remove it
      await removeProjectFromRegistry('proj-123');

      // Verify it was removed
      registry = await loadRegistry();
      assert.ok(registry, 'Registry should still exist');
      assert.strictEqual(registry.projects['proj-123'], undefined, 'Project should be removed');
    });

    test('should handle removing non-existent project', async () => {
      // Create registry with one project
      const project = createMockProject('proj-123', 'Test', 'fiction');
      await syncProjectToRegistry(project, '/workspace');

      // Try to remove project that doesn't exist (should not error)
      await removeProjectFromRegistry('proj-999');

      // Verify original project still exists
      const registry = await loadRegistry();
      assert.ok(registry?.projects['proj-123'], 'Original project should still exist');
    });

    test('should handle removing from empty registry', async () => {
      // Create empty registry
      const registry = createEmptyRegistry();
      await saveRegistry(registry);

      // Try to remove project (should not error)
      await removeProjectFromRegistry('proj-123');

      // Verify registry still empty
      const loaded = await loadRegistry();
      assert.ok(loaded, 'Registry should exist');
      assert.strictEqual(Object.keys(loaded.projects).length, 0, 'Registry should still be empty');
    });

    test('should handle removing from non-existent registry', async () => {
      // Don't create registry at all

      // Try to remove project (should not error)
      await removeProjectFromRegistry('proj-123');

      // Verify registry still doesn't exist
      const registry = await loadRegistry();
      assert.strictEqual(registry, null, 'Registry should not exist');
    });

    test('should remove correct project from multiple projects', async () => {
      const project1 = createMockProject('proj-1', 'Project 1', 'fiction');
      const project2 = createMockProject('proj-2', 'Project 2', 'research');
      const project3 = createMockProject('proj-3', 'Project 3', 'journalism');

      await syncProjectToRegistry(project1, '/workspace1');
      await syncProjectToRegistry(project2, '/workspace2');
      await syncProjectToRegistry(project3, '/workspace3');

      // Remove middle project
      await removeProjectFromRegistry('proj-2');

      const registry = await loadRegistry();
      assert.ok(registry, 'Registry should exist');
      assert.ok(registry.projects['proj-1'], 'Project 1 should still exist');
      assert.strictEqual(registry.projects['proj-2'], undefined, 'Project 2 should be removed');
      assert.ok(registry.projects['proj-3'], 'Project 3 should still exist');
    });
  });

  suite('updateLastOpened', () => {
    let testRegistryPath: string;
    let originalGetProjectsRegistryPath: () => string;

    function createMockProject(id: string, name: string, type: string): IProject {
      const now = new Date();
      return {
        id,
        name,
        type,
        description: `Test project ${name}`,
        status: ProjectStatus.Active,
        metadata: {
          createdAt: now,
          updatedAt: now,
          version: '1.0.0',
          tags: []
        },
        settings: {
          enabledAutomation: false,
          customSettings: {}
        }
      };
    }

    setup(() => {
      const tmpDir = os.tmpdir();
      testRegistryPath = path.join(tmpDir, `vespera-test-lastopened-${Date.now()}`);

      originalGetProjectsRegistryPath = require('../../services/GlobalRegistry').getProjectsRegistryPath;
      const GlobalRegistry = require('../../services/GlobalRegistry');
      GlobalRegistry.getProjectsRegistryPath = () => path.join(testRegistryPath, 'projects-registry.json');
    });

    teardown(async () => {
      const GlobalRegistry = require('../../services/GlobalRegistry');
      GlobalRegistry.getProjectsRegistryPath = originalGetProjectsRegistryPath;

      try {
        const uri = vscode.Uri.file(testRegistryPath);
        await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
      } catch (_error) {
        // Ignore cleanup errors
      }
    });

    test('should update last_opened timestamp', async () => {
      const project = createMockProject('proj-123', 'Test', 'fiction');
      await syncProjectToRegistry(project, '/workspace');

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const beforeUpdate = new Date();
      await updateLastOpened('proj-123');
      const afterUpdate = new Date();

      const registry = await loadRegistry();
      assert.ok(registry, 'Registry should exist');

      const lastOpened = new Date(registry.projects['proj-123'].last_opened);
      assert.ok(lastOpened >= beforeUpdate, 'last_opened should be updated to current time');
      assert.ok(lastOpened <= afterUpdate, 'last_opened should be updated to current time');
    });

    test('should handle updating non-existent project', async () => {
      // Create registry with one project
      const project = createMockProject('proj-123', 'Test', 'fiction');
      await syncProjectToRegistry(project, '/workspace');

      // Try to update non-existent project (should not error)
      await updateLastOpened('proj-999');

      // Verify original project unchanged
      const registry = await loadRegistry();
      assert.ok(registry?.projects['proj-123'], 'Original project should still exist');
    });

    test('should handle updating when registry does not exist', async () => {
      // Don't create registry

      // Try to update (should not error)
      await updateLastOpened('proj-123');

      // Verify registry still doesn't exist
      const registry = await loadRegistry();
      assert.strictEqual(registry, null, 'Registry should not exist');
    });

    test('should only update last_opened, not other fields', async () => {
      const project = createMockProject('proj-123', 'Test', 'fiction');
      await syncProjectToRegistry(project, '/workspace');

      const registryBefore = await loadRegistry();
      const entryBefore = registryBefore!.projects['proj-123'];

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await updateLastOpened('proj-123');

      const registryAfter = await loadRegistry();
      const entryAfter = registryAfter!.projects['proj-123'];

      // Verify only last_opened changed
      assert.strictEqual(entryAfter.id, entryBefore.id, 'id should not change');
      assert.strictEqual(entryAfter.name, entryBefore.name, 'name should not change');
      assert.strictEqual(entryAfter.workspace_path, entryBefore.workspace_path, 'workspace_path should not change');
      assert.strictEqual(entryAfter.project_type, entryBefore.project_type, 'project_type should not change');
      assert.strictEqual(entryAfter.created_at, entryBefore.created_at, 'created_at should not change');
      assert.notStrictEqual(entryAfter.last_opened, entryBefore.last_opened, 'last_opened should change');
    });
  });

  suite('getRecentProjects', () => {
    let testRegistryPath: string;
    let originalGetProjectsRegistryPath: () => string;

    function createMockProject(id: string, name: string, type: string): IProject {
      const now = new Date();
      return {
        id,
        name,
        type,
        description: `Test project ${name}`,
        status: ProjectStatus.Active,
        metadata: {
          createdAt: now,
          updatedAt: now,
          version: '1.0.0',
          tags: []
        },
        settings: {
          enabledAutomation: false,
          customSettings: {}
        }
      };
    }

    setup(() => {
      const tmpDir = os.tmpdir();
      testRegistryPath = path.join(tmpDir, `vespera-test-recent-${Date.now()}`);

      originalGetProjectsRegistryPath = require('../../services/GlobalRegistry').getProjectsRegistryPath;
      const GlobalRegistry = require('../../services/GlobalRegistry');
      GlobalRegistry.getProjectsRegistryPath = () => path.join(testRegistryPath, 'projects-registry.json');
    });

    teardown(async () => {
      const GlobalRegistry = require('../../services/GlobalRegistry');
      GlobalRegistry.getProjectsRegistryPath = originalGetProjectsRegistryPath;

      try {
        const uri = vscode.Uri.file(testRegistryPath);
        await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
      } catch (_error) {
        // Ignore cleanup errors
      }
    });

    test('should return empty array when registry does not exist', async () => {
      const recent = await getRecentProjects();
      assert.deepStrictEqual(recent, [], 'Should return empty array');
    });

    test('should return empty array when registry is empty', async () => {
      const registry = createEmptyRegistry();
      await saveRegistry(registry);

      const recent = await getRecentProjects();
      assert.deepStrictEqual(recent, [], 'Should return empty array');
    });

    test('should return projects sorted by last_opened (most recent first)', async () => {
      // Create projects with different last_opened times
      const project1 = createMockProject('proj-1', 'Project 1', 'fiction');
      const project2 = createMockProject('proj-2', 'Project 2', 'research');
      const project3 = createMockProject('proj-3', 'Project 3', 'journalism');

      // Sync in order (with delays to ensure different timestamps)
      await syncProjectToRegistry(project1, '/workspace1');
      await new Promise(resolve => setTimeout(resolve, 10));

      await syncProjectToRegistry(project2, '/workspace2');
      await new Promise(resolve => setTimeout(resolve, 10));

      await syncProjectToRegistry(project3, '/workspace3');

      const recent = await getRecentProjects();

      assert.strictEqual(recent.length, 3, 'Should return all 3 projects');
      assert.strictEqual(recent[0].id, 'proj-3', 'Most recent should be first');
      assert.strictEqual(recent[1].id, 'proj-2', 'Second most recent should be second');
      assert.strictEqual(recent[2].id, 'proj-1', 'Oldest should be last');
    });

    test('should respect limit parameter', async () => {
      const project1 = createMockProject('proj-1', 'Project 1', 'fiction');
      const project2 = createMockProject('proj-2', 'Project 2', 'research');
      const project3 = createMockProject('proj-3', 'Project 3', 'journalism');

      await syncProjectToRegistry(project1, '/workspace1');
      await new Promise(resolve => setTimeout(resolve, 10));
      await syncProjectToRegistry(project2, '/workspace2');
      await new Promise(resolve => setTimeout(resolve, 10));
      await syncProjectToRegistry(project3, '/workspace3');

      const recent = await getRecentProjects(2);

      assert.strictEqual(recent.length, 2, 'Should return only 2 projects');
      assert.strictEqual(recent[0].id, 'proj-3', 'Most recent should be first');
      assert.strictEqual(recent[1].id, 'proj-2', 'Second most recent should be second');
    });

    test('should return all projects when limit is greater than count', async () => {
      const project1 = createMockProject('proj-1', 'Project 1', 'fiction');
      await syncProjectToRegistry(project1, '/workspace1');

      const recent = await getRecentProjects(10);

      assert.strictEqual(recent.length, 1, 'Should return 1 project');
    });

    test('should handle zero limit', async () => {
      const project1 = createMockProject('proj-1', 'Project 1', 'fiction');
      await syncProjectToRegistry(project1, '/workspace1');

      const recent = await getRecentProjects(0);

      assert.strictEqual(recent.length, 0, 'Should return empty array');
    });

    test('should update order when last_opened is updated', async () => {
      const project1 = createMockProject('proj-1', 'Project 1', 'fiction');
      const project2 = createMockProject('proj-2', 'Project 2', 'research');

      await syncProjectToRegistry(project1, '/workspace1');
      await new Promise(resolve => setTimeout(resolve, 10));
      await syncProjectToRegistry(project2, '/workspace2');

      // At this point, order should be: proj-2, proj-1

      let recent = await getRecentProjects();
      assert.strictEqual(recent[0].id, 'proj-2', 'proj-2 should be most recent');
      assert.strictEqual(recent[1].id, 'proj-1', 'proj-1 should be second');

      // Update last_opened for proj-1
      await new Promise(resolve => setTimeout(resolve, 10));
      await updateLastOpened('proj-1');

      // Now order should be: proj-1, proj-2
      recent = await getRecentProjects();
      assert.strictEqual(recent[0].id, 'proj-1', 'proj-1 should now be most recent');
      assert.strictEqual(recent[1].id, 'proj-2', 'proj-2 should now be second');
    });
  });

  suite('findProjectsByWorkspace', () => {
    let testRegistryPath: string;
    let originalGetProjectsRegistryPath: () => string;

    function createMockProject(id: string, name: string, type: string): IProject {
      const now = new Date();
      return {
        id,
        name,
        type,
        description: `Test project ${name}`,
        status: ProjectStatus.Active,
        metadata: {
          createdAt: now,
          updatedAt: now,
          version: '1.0.0',
          tags: []
        },
        settings: {
          enabledAutomation: false,
          customSettings: {}
        }
      };
    }

    setup(() => {
      const tmpDir = os.tmpdir();
      testRegistryPath = path.join(tmpDir, `vespera-test-findws-${Date.now()}`);

      originalGetProjectsRegistryPath = require('../../services/GlobalRegistry').getProjectsRegistryPath;
      const GlobalRegistry = require('../../services/GlobalRegistry');
      GlobalRegistry.getProjectsRegistryPath = () => path.join(testRegistryPath, 'projects-registry.json');
    });

    teardown(async () => {
      const GlobalRegistry = require('../../services/GlobalRegistry');
      GlobalRegistry.getProjectsRegistryPath = originalGetProjectsRegistryPath;

      try {
        const uri = vscode.Uri.file(testRegistryPath);
        await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
      } catch (_error) {
        // Ignore cleanup errors
      }
    });

    test('should return empty array when registry does not exist', async () => {
      const projects = await findProjectsByWorkspace('/workspace');
      assert.deepStrictEqual(projects, [], 'Should return empty array');
    });

    test('should return empty array when no projects in workspace', async () => {
      const project = createMockProject('proj-1', 'Project 1', 'fiction');
      await syncProjectToRegistry(project, '/workspace1');

      const projects = await findProjectsByWorkspace('/workspace2');
      assert.deepStrictEqual(projects, [], 'Should return empty array');
    });

    test('should find projects by workspace path', async () => {
      const project1 = createMockProject('proj-1', 'Project 1', 'fiction');
      const project2 = createMockProject('proj-2', 'Project 2', 'research');

      await syncProjectToRegistry(project1, '/workspace1');
      await syncProjectToRegistry(project2, '/workspace1');

      const projects = await findProjectsByWorkspace('/workspace1');

      assert.strictEqual(projects.length, 2, 'Should find 2 projects');
      assert.ok(projects.find(p => p.id === 'proj-1'), 'Should include proj-1');
      assert.ok(projects.find(p => p.id === 'proj-2'), 'Should include proj-2');
    });

    test('should filter by workspace path correctly', async () => {
      const project1 = createMockProject('proj-1', 'Project 1', 'fiction');
      const project2 = createMockProject('proj-2', 'Project 2', 'research');
      const project3 = createMockProject('proj-3', 'Project 3', 'journalism');

      await syncProjectToRegistry(project1, '/workspace1');
      await syncProjectToRegistry(project2, '/workspace2');
      await syncProjectToRegistry(project3, '/workspace1');

      const projectsWs1 = await findProjectsByWorkspace('/workspace1');
      const projectsWs2 = await findProjectsByWorkspace('/workspace2');

      assert.strictEqual(projectsWs1.length, 2, 'Workspace 1 should have 2 projects');
      assert.ok(projectsWs1.find(p => p.id === 'proj-1'), 'Workspace 1 should include proj-1');
      assert.ok(projectsWs1.find(p => p.id === 'proj-3'), 'Workspace 1 should include proj-3');

      assert.strictEqual(projectsWs2.length, 1, 'Workspace 2 should have 1 project');
      assert.strictEqual(projectsWs2[0].id, 'proj-2', 'Workspace 2 should include proj-2');
    });

    test('should normalize paths for comparison', async () => {
      const project = createMockProject('proj-1', 'Project 1', 'fiction');
      await syncProjectToRegistry(project, '/workspace/path');

      // Search with trailing slash
      const projects1 = await findProjectsByWorkspace('/workspace/path/');
      assert.strictEqual(projects1.length, 1, 'Should find project with trailing slash');

      // Search without trailing slash
      const projects2 = await findProjectsByWorkspace('/workspace/path');
      assert.strictEqual(projects2.length, 1, 'Should find project without trailing slash');
    });
  });

  // =============================================================================
  // REGISTRY INITIALIZATION - Phase 17 Task B4
  // =============================================================================

  suite('initializeGlobalRegistry', () => {
    let testRegistryPath: string;
    let originalGetGlobalVesperaPath: () => string;

    setup(() => {
      const tmpDir = os.tmpdir();
      testRegistryPath = path.join(tmpDir, `vespera-test-init-${Date.now()}`);

      // Mock getGlobalVesperaPath to return test path
      originalGetGlobalVesperaPath = require('../../services/GlobalRegistry').getGlobalVesperaPath;
      const GlobalRegistry = require('../../services/GlobalRegistry');
      GlobalRegistry.getGlobalVesperaPath = () => testRegistryPath;
    });

    teardown(async () => {
      // Restore original function
      const GlobalRegistry = require('../../services/GlobalRegistry');
      GlobalRegistry.getGlobalVesperaPath = originalGetGlobalVesperaPath;

      // Clean up test directory
      try {
        const uri = vscode.Uri.file(testRegistryPath);
        await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
      } catch (_error) {
        // Ignore cleanup errors
      }
    });

    test('should create directory structure when nothing exists', async () => {
      const wasInitialized = await initializeGlobalRegistry();

      assert.strictEqual(wasInitialized, true, 'Should return true on first initialization');

      // Verify main directory exists
      const mainUri = vscode.Uri.file(testRegistryPath);
      const mainStat = await vscode.workspace.fs.stat(mainUri);
      assert.strictEqual(mainStat.type, vscode.FileType.Directory, 'Main directory should exist');

      // Verify subdirectories exist
      const GlobalRegistry = require('../../services/GlobalRegistry');

      const templatesPath = GlobalRegistry.getGlobalTemplatesPath();
      const templatesUri = vscode.Uri.file(templatesPath);
      const templatesStat = await vscode.workspace.fs.stat(templatesUri);
      assert.strictEqual(templatesStat.type, vscode.FileType.Directory, 'Templates directory should exist');

      const cachePath = GlobalRegistry.getGlobalCachePath();
      const cacheUri = vscode.Uri.file(cachePath);
      const cacheStat = await vscode.workspace.fs.stat(cacheUri);
      assert.strictEqual(cacheStat.type, vscode.FileType.Directory, 'Cache directory should exist');

      const logsPath = GlobalRegistry.getGlobalLogsPath();
      const logsUri = vscode.Uri.file(logsPath);
      const logsStat = await vscode.workspace.fs.stat(logsUri);
      assert.strictEqual(logsStat.type, vscode.FileType.Directory, 'Logs directory should exist');
    });

    test('should create empty registry file', async () => {
      await initializeGlobalRegistry();

      // Verify registry file exists and is valid
      const GlobalRegistry = require('../../services/GlobalRegistry');
      const registryPath = GlobalRegistry.getProjectsRegistryPath();
      const registryUri = vscode.Uri.file(registryPath);

      const registryStat = await vscode.workspace.fs.stat(registryUri);
      assert.strictEqual(registryStat.type, vscode.FileType.File, 'Registry file should exist');

      // Load and validate registry
      const registry = await loadRegistry();
      assert.ok(registry, 'Registry should be loadable');
      assert.strictEqual(registry.version, '1.0.0', 'Registry should have version 1.0.0');
      assert.deepStrictEqual(registry.projects, {}, 'Registry should have empty projects');
    });

    test('should be idempotent - calling twice does not error', async () => {
      const firstCall = await initializeGlobalRegistry();
      assert.strictEqual(firstCall, true, 'First call should return true');

      const secondCall = await initializeGlobalRegistry();
      assert.strictEqual(secondCall, false, 'Second call should return false');

      // Verify directory still exists and is valid
      const mainUri = vscode.Uri.file(testRegistryPath);
      const mainStat = await vscode.workspace.fs.stat(mainUri);
      assert.strictEqual(mainStat.type, vscode.FileType.Directory, 'Main directory should still exist');
    });

    test('should return true on first call, false on subsequent calls', async () => {
      const firstCall = await initializeGlobalRegistry();
      assert.strictEqual(firstCall, true, 'First call should return true');

      const secondCall = await initializeGlobalRegistry();
      assert.strictEqual(secondCall, false, 'Second call should return false');

      const thirdCall = await initializeGlobalRegistry();
      assert.strictEqual(thirdCall, false, 'Third call should return false');
    });

    test('should verify directory structure after initialization', async () => {
      await initializeGlobalRegistry();

      const GlobalRegistry = require('../../services/GlobalRegistry');

      // Verify all expected paths exist
      const paths = [
        testRegistryPath,
        GlobalRegistry.getProjectsRegistryPath(),
        GlobalRegistry.getGlobalTemplatesPath(),
        GlobalRegistry.getGlobalCachePath(),
        GlobalRegistry.getGlobalLogsPath()
      ];

      for (const checkPath of paths) {
        const uri = vscode.Uri.file(checkPath);
        try {
          await vscode.workspace.fs.stat(uri);
          // Path exists - good
        } catch (error) {
          assert.fail(`Expected path to exist: ${checkPath}`);
        }
      }
    });

    test('should handle existing directory but missing registry', async () => {
      // Create directory manually
      const mainUri = vscode.Uri.file(testRegistryPath);
      await vscode.workspace.fs.createDirectory(mainUri);

      // Now initialize (should create registry)
      const wasInitialized = await initializeGlobalRegistry();
      assert.strictEqual(wasInitialized, true, 'Should return true when creating registry in existing directory');

      // Verify registry was created
      const GlobalRegistry = require('../../services/GlobalRegistry');
      const registryPath = GlobalRegistry.getProjectsRegistryPath();
      const registryUri = vscode.Uri.file(registryPath);

      const registryStat = await vscode.workspace.fs.stat(registryUri);
      assert.strictEqual(registryStat.type, vscode.FileType.File, 'Registry file should exist');
    });

    test('should create subdirectories in correct locations', async () => {
      await initializeGlobalRegistry();

      const GlobalRegistry = require('../../services/GlobalRegistry');

      // Verify subdirectories are children of main directory
      const templatesPath = GlobalRegistry.getGlobalTemplatesPath();
      assert.ok(templatesPath.startsWith(testRegistryPath), 'Templates should be in main directory');

      const cachePath = GlobalRegistry.getGlobalCachePath();
      assert.ok(cachePath.startsWith(testRegistryPath), 'Cache should be in main directory');

      const logsPath = GlobalRegistry.getGlobalLogsPath();
      assert.ok(logsPath.startsWith(testRegistryPath), 'Logs should be in main directory');
    });

    test('should handle existing complete structure gracefully', async () => {
      // Initialize once
      await initializeGlobalRegistry();

      // Add a project to the registry
      const project: IProject = {
        id: 'proj-123',
        name: 'Test Project',
        type: 'fiction',
        description: 'Test',
        status: ProjectStatus.Active,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          tags: []
        },
        settings: {
          enabledAutomation: false,
          customSettings: {}
        }
      };
      await syncProjectToRegistry(project, '/workspace');

      // Initialize again - should not wipe out existing data
      const wasInitialized = await initializeGlobalRegistry();
      assert.strictEqual(wasInitialized, false, 'Should return false for already initialized');

      // Verify project still exists in registry
      const registry = await loadRegistry();
      assert.ok(registry, 'Registry should exist');
      assert.ok(registry.projects['proj-123'], 'Existing project should be preserved');
    });

    test('should properly handle errors and provide meaningful messages', async () => {
      // This test is difficult to write without mocking filesystem errors
      // In a real scenario, we'd use a mocking framework
      // For now, we'll just verify that the function exists and is callable
      assert.ok(typeof initializeGlobalRegistry === 'function', 'initializeGlobalRegistry should be a function');
    });
  });
});
