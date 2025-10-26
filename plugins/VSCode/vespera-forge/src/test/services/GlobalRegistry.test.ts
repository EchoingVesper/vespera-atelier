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
  ProjectRegistryEntry,
  ProjectsRegistry,
  createEmptyRegistry,
  validateRegistry,
  loadRegistry,
  saveRegistry
} from '../../services/GlobalRegistry';

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
});
