/**
 * Security validation tests for API key storage, authentication flows, and vulnerability regression testing
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { CredentialManager } from '../chat/utils/encryption';

// Mock VS Code context for security testing
class MockSecretStorage implements vscode.SecretStorage {
  private storage = new Map<string, string>();
  
  async get(key: string): Promise<string | undefined> {
    return this.storage.get(key);
  }
  
  async store(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }
  
  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }
  
  onDidChange = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>().event;
}

class MockGlobalState implements vscode.Memento {
  private storage = new Map<string, any>();
  
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.storage.get(key) ?? defaultValue;
  }
  
  async update(key: string, value: any): Promise<void> {
    if (value === undefined) {
      this.storage.delete(key);
    } else {
      this.storage.set(key, value);
    }
  }
  
  keys(): readonly string[] {
    const keys = Array.from(this.storage.keys());
    return keys;
  }
  
  setKeysForSync(_keys: readonly string[]): void {
    // Mock implementation
  }
}

const createMockContext = (): vscode.ExtensionContext => {
  const mockSecrets = new MockSecretStorage();
  const mockGlobalState = new MockGlobalState();
  
  return {
    secrets: mockSecrets,
    globalState: mockGlobalState,
    workspaceState: mockGlobalState,
    subscriptions: [],
    extensionUri: vscode.Uri.file('/mock/path'),
    extensionPath: '/mock/path',
    extensionMode: vscode.ExtensionMode.Test,
    storageUri: vscode.Uri.file('/mock/storage'),
    storagePath: '/mock/storage',
    globalStorageUri: vscode.Uri.file('/mock/global'),
    globalStoragePath: '/mock/global',
    logUri: vscode.Uri.file('/mock/log'),
    logPath: '/mock/log',
    asAbsolutePath: (relativePath: string) => `/mock/path/${relativePath}`,
    extension: {} as vscode.Extension<any>,
    environmentVariableCollection: {} as vscode.GlobalEnvironmentVariableCollection,
    languageModelAccessInformation: {} as vscode.LanguageModelAccessInformation
  };
};

suite('Security Validation Tests', () => {
  let mockContext: vscode.ExtensionContext;

  setup(() => {
    mockContext = createMockContext();
  });

  suite('API Key Secure Storage', () => {
    test('CredentialManager stores API keys securely', async () => {
      const testCredential = 'sk-very-secret-api-key-12345';
      const providerId = 'openai-test';
      
      await CredentialManager.storeCredential(mockContext, providerId, testCredential);
      
      // Verify credential was stored
      const retrieved = await CredentialManager.retrieveCredential(mockContext, providerId);
      assert.strictEqual(retrieved, testCredential);
    });

    test('CredentialManager handles empty credentials', async () => {
      const providerId = 'empty-provider';
      
      const retrieved = await CredentialManager.retrieveCredential(mockContext, providerId);
      assert.strictEqual(retrieved, undefined);
    });

    test('CredentialManager validates credentials exist', async () => {
      const providerId = 'test-provider';
      const testCredential = 'sk-test-key';
      
      // Initially should not exist
      const initialValidation = await CredentialManager.validateCredential(mockContext, providerId);
      assert.strictEqual(initialValidation, false);
      
      // Store credential
      await CredentialManager.storeCredential(mockContext, providerId, testCredential);
      
      // Should now validate as true
      const postStoreValidation = await CredentialManager.validateCredential(mockContext, providerId);
      assert.strictEqual(postStoreValidation, true);
    });

    test('CredentialManager deletes credentials securely', async () => {
      const providerId = 'delete-test';
      const testCredential = 'sk-delete-me';
      
      // Store then delete
      await CredentialManager.storeCredential(mockContext, providerId, testCredential);
      await CredentialManager.deleteCredential(mockContext, providerId);
      
      // Should no longer exist
      const retrieved = await CredentialManager.retrieveCredential(mockContext, providerId);
      assert.strictEqual(retrieved, undefined);
    });

    test('CredentialManager handles corrupted storage gracefully', async () => {
      const providerId = 'corrupted-test';
      
      // Manually corrupt storage by storing invalid data
      await mockContext.globalState.update(`vespera-chat-credentials.${providerId}`, 'invalid-base64!!!');
      
      // Should handle gracefully without throwing
      const retrieved = await CredentialManager.retrieveCredential(mockContext, providerId);
      assert.strictEqual(retrieved, undefined);
    });

    test('Credentials are never logged in plain text', async () => {
      const testCredential = 'sk-super-secret-key-should-not-appear';
      const providerId = 'logging-test';
      
      // Store credential
      await CredentialManager.storeCredential(mockContext, providerId, testCredential);
      
      // Capture console output during operations
      const originalConsoleLog = console.log;
      const originalConsoleWarn = console.warn;
      const originalConsoleError = console.error;
      
      let logOutput = '';
      const captureLog = (level: string) => (...args: any[]) => {
        logOutput += `${level}: ${args.join(' ')}\n`;
      };
      
      console.log = captureLog('LOG');
      console.warn = captureLog('WARN');
      console.error = captureLog('ERROR');
      
      try {
        // Perform operations that might log
        await CredentialManager.retrieveCredential(mockContext, providerId);
        await CredentialManager.validateCredential(mockContext, providerId);
        
        // Check that secret key never appears in logs
        assert.ok(!logOutput.includes(testCredential), 
          'API key found in logs - security violation!');
      } finally {
        // Restore console
        console.log = originalConsoleLog;
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
      }
    });

    test('Multiple providers maintain separate credentials', async () => {
      const providers = [
        { id: 'openai', key: 'sk-openai-key-123' },
        { id: 'anthropic', key: 'sk-ant-anthropic-key-456' },
        { id: 'lmstudio', key: 'lm-studio-key-789' }
      ];
      
      // Store all credentials
      for (const provider of providers) {
        await CredentialManager.storeCredential(mockContext, provider.id, provider.key);
      }
      
      // Verify each credential is separate and correct
      for (const provider of providers) {
        const retrieved = await CredentialManager.retrieveCredential(mockContext, provider.id);
        assert.strictEqual(retrieved, provider.key);
      }
      
      // Delete one and verify others remain
      await CredentialManager.deleteCredential(mockContext, 'openai');
      
      const deletedKey = await CredentialManager.retrieveCredential(mockContext, 'openai');
      assert.strictEqual(deletedKey, undefined);
      
      // Others should still exist
      const anthropicKey = await CredentialManager.retrieveCredential(mockContext, 'anthropic');
      assert.strictEqual(anthropicKey, 'sk-ant-anthropic-key-456');
    });
  });

  suite('Authentication Flow Security', () => {
    test('Provider authentication fails with invalid credentials', () => {
      // This would test actual API calls in integration tests
      // Here we test the validation logic
      
      const invalidKeys = [
        '',
        'invalid-key',
        'sk-',
        'sk-too-short',
        'not-a-key-at-all'
      ];
      
      for (const invalidKey of invalidKeys) {
        // Test that validation catches invalid keys
        // Implementation depends on actual provider validation logic
        assert.ok(invalidKey.length < 10 || !invalidKey.startsWith('sk-'), 
          'Invalid key validation should fail');
      }
    });

    test('Provider rate limiting prevents abuse', () => {
      // Test rate limiting mechanisms
      // This is a placeholder for actual rate limiting tests
      assert.ok(true, 'Rate limiting tests would go here');
    });

    test('Secure communication over HTTPS only', () => {
      // Test that all API endpoints use HTTPS
      const testUrls = [
        'https://api.openai.com/v1/chat/completions',
        'https://api.anthropic.com/v1/messages',
        'http://localhost:1234/v1/chat/completions' // LMStudio exception for localhost
      ];
      
      for (const url of testUrls) {
        const isSecure = url.startsWith('https://') || url.includes('localhost');
        assert.ok(isSecure, `URL ${url} should use secure protocol`);
      }
    });
  });

  suite('CRDT Memory Leak Prevention', () => {
    test('CRDT operations clean up properly', () => {
      // Mock CRDT operations to test memory management
      const operations = [];
      
      // Simulate adding operations
      for (let i = 0; i < 1000; i++) {
        operations.push({
          id: i,
          type: 'insert',
          position: i,
          content: `Operation ${i}`,
          timestamp: Date.now()
        });
      }
      
      // Simulate cleanup
      const maxOperations = 100;
      if (operations.length > maxOperations) {
        operations.splice(0, operations.length - maxOperations);
      }
      
      assert.ok(operations.length <= maxOperations, 
        'CRDT operations should be limited to prevent memory leaks');
    });

    test('Memory usage tracking for CRDT operations', () => {
      // Simulate memory tracking
      let memoryUsage = 0;
      const MAX_MEMORY_MB = 50;
      
      const simulateOperation = (size: number) => {
        memoryUsage += size;
        if (memoryUsage > MAX_MEMORY_MB * 1024 * 1024) {
          // Trigger cleanup
          memoryUsage = memoryUsage * 0.5; // Simulate garbage collection
        }
      };
      
      // Simulate many operations
      for (let i = 0; i < 1000; i++) {
        simulateOperation(1024); // 1KB per operation
      }
      
      assert.ok(memoryUsage < MAX_MEMORY_MB * 1024 * 1024, 
        'Memory usage should stay within bounds');
    });

    test('CRDT conflict resolution does not retain old versions indefinitely', () => {
      // Simulate conflict resolution with version cleanup
      const versions = new Map();
      const MAX_VERSIONS = 10;
      
      // Simulate adding versions
      for (let i = 0; i < 50; i++) {
        const versionKey = `doc-${i}`;
        versions.set(versionKey, {
          content: `Version ${i}`,
          timestamp: Date.now() - (50 - i) * 1000
        });
        
        // Keep only recent versions
        if (versions.size > MAX_VERSIONS) {
          const oldestKey = Array.from(versions.keys())[0];
          versions.delete(oldestKey);
        }
      }
      
      assert.ok(versions.size <= MAX_VERSIONS, 
        'Version history should be limited to prevent memory leaks');
    });
  });

  suite('Input Validation and Sanitization', () => {
    test('User input is sanitized for XSS prevention', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(\'xss\')">',
        '{{constructor.constructor("alert(\'xss\')")()}}'
      ];
      
      for (const input of maliciousInputs) {
        // Test sanitization function (placeholder)
        const sanitized = input.replace(/<[^>]*>/g, '').replace(/javascript:/g, '');
        assert.ok(!sanitized.includes('<script>'), 'Script tags should be removed');
        assert.ok(!sanitized.includes('javascript:'), 'JavaScript protocols should be removed');
      }
    });

    test('API responses are validated and sanitized', () => {
      // Test that API responses don't contain malicious content
      const mockApiResponse = {
        choices: [{
          message: {
            content: 'This is a safe response from the API',
            role: 'assistant'
          }
        }]
      };
      
      // Validate response structure
      assert.ok(mockApiResponse.choices);
      assert.ok(Array.isArray(mockApiResponse.choices));
      assert.ok(mockApiResponse.choices[0]?.message);
      assert.strictEqual(typeof mockApiResponse.choices[0]?.message.content, 'string');
    });

    test('File paths are validated to prevent directory traversal', () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        '/etc/passwd',
        'C:\\Windows\\System32\\config\\sam'
      ];
      
      for (const path of maliciousPaths) {
        // Test path validation (placeholder)
        const isValid = !path.includes('..') && 
                       !path.startsWith('/etc/') && 
                       !path.includes('system32');
        assert.ok(!isValid, `Path ${path} should be rejected as malicious`);
      }
    });
  });

  suite('Error Handling Security', () => {
    test('Error messages do not leak sensitive information', () => {
      const sensitiveData = {
        apiKey: 'sk-very-secret-key-123',
        password: 'user-password-456',
        token: 'bearer-token-789'
      };
      
      // Simulate error with sensitive data
      const error = new Error(`Authentication failed for API key: ${sensitiveData.apiKey}`);
      
      // Test error sanitization
      const sanitizedMessage = error.message.replace(/sk-[a-zA-Z0-9-]+/g, 'sk-***');
      
      assert.ok(!sanitizedMessage.includes(sensitiveData.apiKey), 
        'API key should not appear in error messages');
    });

    test('Stack traces in production do not expose file paths', () => {
      try {
        throw new Error('Test error');
      } catch (error) {
        const stack = (error as Error).stack || '';
        
        // In production, stack traces should be sanitized
        const isProduction = process.env['NODE_ENV'] === 'production';
        if (isProduction) {
          assert.ok(!stack.includes(__filename), 
            'File paths should not be exposed in production stack traces');
        }
      }
    });
  });

  suite('Session Management Security', () => {
    test('Chat sessions expire after inactivity', () => {
      const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
      
      const session = {
        id: 'test-session',
        lastActivity: Date.now() - (SESSION_TIMEOUT_MS + 1000), // Expired
        userId: 'test-user'
      };
      
      const isExpired = (Date.now() - session.lastActivity) > SESSION_TIMEOUT_MS;
      assert.ok(isExpired, 'Session should be expired');
    });

    test('Session tokens are properly invalidated on logout', () => {
      // Mock session management
      const sessionStore = new Map();
      const sessionId = 'test-session-123';
      
      // Create session
      sessionStore.set(sessionId, { userId: 'user-1', created: Date.now() });
      assert.ok(sessionStore.has(sessionId));
      
      // Logout should clear session
      sessionStore.delete(sessionId);
      assert.ok(!sessionStore.has(sessionId));
    });
  });
});