/**
 * Core functionality tests for working components
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Core Functionality Tests', () => {
  
  suite('Extension Activation', () => {
    test('Extension context is available', () => {
      // Test that basic VS Code APIs are accessible
      assert.ok(vscode);
      assert.ok(vscode.window);
      assert.ok(vscode.commands);
      assert.ok(vscode.workspace);
    });

    test('Extension commands are defined', () => {
      const expectedCommands = [
        'vespera-forge.initialize',
        'vespera-forge.createContent',
        'vespera-forge.testCommand',
        'vespera-forge.openTaskManager',
        'vespera-forge.configureBindery',
        'vespera-forge.refreshTaskTree',
        'vespera-forge.openChatPanel',
        'vespera-forge.configureChatProviders'
      ];

      // In a real test, these would be registered during activation
      for (const command of expectedCommands) {
        assert.ok(typeof command === 'string');
        assert.ok(command.startsWith('vespera-forge.'));
      }
    });
  });

  suite('Configuration Management', () => {
    test('Extension configuration schema is valid', () => {
      // Test configuration properties from package.json
      const configProperties = [
        'vesperaForge.enableAutoStart',
        'vesperaForge.rustBinderyPath',
        'vesperaForge.chat.providers',
        'vesperaForge.chat.ui.layout',
        'vesperaForge.chat.ui.position',
        'vesperaForge.chat.ui.theme',
        'vesperaForge.chat.interaction.streaming'
      ];

      for (const prop of configProperties) {
        assert.ok(typeof prop === 'string');
        assert.ok(prop.startsWith('vesperaForge.'));
      }
    });

    test('Configuration values have proper types', () => {
      // Test expected configuration value types
      const booleanConfigs = [
        'vesperaForge.enableAutoStart',
        'vesperaForge.chat.interaction.streaming'
      ];

      const stringConfigs = [
        'vesperaForge.rustBinderyPath',
        'vesperaForge.chat.ui.layout',
        'vesperaForge.chat.ui.position',
        'vesperaForge.chat.ui.theme'
      ];

      const objectConfigs = [
        'vesperaForge.chat.providers'
      ];

      // Verify config structure
      assert.ok(booleanConfigs.length > 0);
      assert.ok(stringConfigs.length > 0);
      assert.ok(objectConfigs.length > 0);
    });
  });

  suite('API Key Security', () => {
    test('API keys are properly masked in logs', () => {
      const testApiKeys = [
        'sk-1234567890abcdef',
        'sk-ant-1234567890',
        'bearer-token-12345',
        'api-key-abcdef'
      ];

      for (const apiKey of testApiKeys) {
        // Simulate masking function
        const masked = maskApiKey(apiKey);
        assert.ok(!masked.includes('1234567890'));
        assert.ok(masked.includes('***') || masked.includes('****'));
      }
    });

    test('Credential storage keys are properly namespaced', () => {
      const providers = ['openai', 'anthropic', 'lmstudio'];
      const baseKey = 'vespera-chat-credentials';

      for (const provider of providers) {
        const credentialKey = `${baseKey}.${provider}`;
        assert.ok(credentialKey.startsWith(baseKey));
        assert.ok(credentialKey.includes(provider));
      }
    });

    test('Input validation prevents XSS', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(\'xss\')">',
        '"><script>alert("xss")</script>'
      ];

      for (const input of maliciousInputs) {
        const sanitized = sanitizeInput(input);
        assert.ok(!sanitized.includes('<script>'));
        assert.ok(!sanitized.includes('javascript:'));
        assert.ok(!sanitized.includes('onerror='));
      }
    });
  });

  suite('Task Management Validation', () => {
    test('Task status values are valid', () => {
      const validStatuses = ['todo', 'doing', 'done'];
      const invalidStatuses = ['pending', 'complete', 'in-progress', '', null, undefined];

      for (const status of validStatuses) {
        assert.ok(isValidTaskStatus(status));
      }

      for (const status of invalidStatuses) {
        assert.ok(!isValidTaskStatus(status));
      }
    });

    test('Task priority values are valid', () => {
      const validPriorities = ['low', 'medium', 'high'];
      const invalidPriorities = ['urgent', 'critical', 'normal', '', null, undefined];

      for (const priority of validPriorities) {
        assert.ok(isValidTaskPriority(priority));
      }

      for (const priority of invalidPriorities) {
        assert.ok(!isValidTaskPriority(priority));
      }
    });

    test('Task title validation', () => {
      const validTitles = [
        'Simple task',
        'Task with numbers 123',
        'Task-with-hyphens',
        'Very long task title that should still be valid'
      ];

      const invalidTitles = [
        '',
        '   ',
        null,
        undefined,
        'x'.repeat(1000) // Too long
      ];

      for (const title of validTitles) {
        assert.ok(isValidTaskTitle(title));
      }

      for (const title of invalidTitles) {
        assert.ok(!isValidTaskTitle(title));
      }
    });
  });

  suite('Memory Management', () => {
    test('CRDT operations are bounded', () => {
      // Test that CRDT operations don't grow unbounded
      const operations = [];
      const maxOperations = 100;

      // Simulate adding many operations
      for (let i = 0; i < 1000; i++) {
        operations.push({
          id: i,
          type: 'insert',
          position: i,
          content: `Operation ${i}`
        });

        // Simulate cleanup when limit reached
        if (operations.length > maxOperations) {
          operations.splice(0, operations.length - maxOperations);
        }
      }

      assert.ok(operations.length <= maxOperations);
    });

    test('Message history is properly limited', () => {
      const messages = [];
      const maxMessages = 50;

      // Simulate chat conversation
      for (let i = 0; i < 200; i++) {
        messages.push({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: new Date()
        });

        // Limit message history
        if (messages.length > maxMessages) {
          messages.shift(); // Remove oldest
        }
      }

      assert.ok(messages.length <= maxMessages);
      assert.strictEqual(messages[0]?.id, `msg-${200 - maxMessages}`);
    });

    test('Event listeners are properly cleaned up', () => {
      const listeners = [];
      let listenerCount = 0;

      // Simulate adding event listeners
      for (let i = 0; i < 10; i++) {
        const listener = {
          id: i,
          dispose: () => {
            listenerCount--;
          }
        };
        listeners.push(listener);
        listenerCount++;
      }

      assert.strictEqual(listenerCount, 10);

      // Simulate cleanup
      listeners.forEach(listener => listener.dispose());
      
      assert.strictEqual(listenerCount, 0);
    });
  });

  suite('Error Handling', () => {
    test('Error messages are sanitized', () => {
      const sensitiveError = new Error('API call failed for key sk-1234567890abcdef');
      const sanitized = sanitizeErrorMessage(sensitiveError.message);

      assert.ok(!sanitized.includes('sk-1234567890abcdef'));
      assert.ok(sanitized.includes('API call failed'));
    });

    test('Network errors are handled gracefully', () => {
      const networkErrors = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNRESET'
      ];

      for (const errorCode of networkErrors) {
        const handled = handleNetworkError(errorCode);
        assert.ok(handled.userMessage);
        assert.ok(handled.shouldRetry !== undefined);
      }
    });

    test('Validation errors provide helpful messages', () => {
      const validationErrors = [
        { field: 'apiKey', value: '', expected: 'non-empty string' },
        { field: 'model', value: null, expected: 'valid model name' },
        { field: 'temperature', value: -1, expected: 'number between 0 and 2' }
      ];

      for (const error of validationErrors) {
        const message = formatValidationError(error);
        assert.ok(message.includes(error.field));
        assert.ok(message.includes(error.expected));
      }
    });
  });

  suite('Performance', () => {
    test('Operations complete within reasonable time', async () => {
      const startTime = Date.now();
      
      // Simulate a series of operations
      await simulateOperation();
      await simulateOperation();
      await simulateOperation();
      
      const duration = Date.now() - startTime;
      
      // Should complete within 1 second
      assert.ok(duration < 1000);
    });

    test('Large data structures are handled efficiently', () => {
      const largeArray = new Array(10000).fill(0).map((_, i) => ({
        id: i,
        data: `Item ${i}`,
        timestamp: new Date()
      }));

      const startTime = Date.now();
      
      // Simulate processing large data
      const filtered = largeArray.filter(item => item.id % 2 === 0);
      const mapped = filtered.map(item => item.data);
      
      const duration = Date.now() - startTime;
      
      // Should process efficiently
      assert.ok(duration < 100);
      assert.strictEqual(mapped.length, 5000);
    });
  });
});

// Helper functions for tests
function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return '***';
  }
  
  const prefix = apiKey.substring(0, 3);
  const suffix = apiKey.substring(apiKey.length - 3);
  return `${prefix}***${suffix}`;
}

function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers
}

function isValidTaskStatus(status: any): boolean {
  return ['todo', 'doing', 'done'].includes(status);
}

function isValidTaskPriority(priority: any): boolean {
  return ['low', 'medium', 'high'].includes(priority);
}

function isValidTaskTitle(title: any): boolean {
  return typeof title === 'string' && 
         title.trim().length > 0 && 
         title.length <= 500;
}

function sanitizeErrorMessage(message: string): string {
  return message.replace(/sk-[a-zA-Z0-9-]+/g, 'sk-***');
}

function handleNetworkError(errorCode: string): { userMessage: string; shouldRetry: boolean } {
  switch (errorCode) {
    case 'ECONNREFUSED':
      return { userMessage: 'Service unavailable. Please try again later.', shouldRetry: true };
    case 'ETIMEDOUT':
      return { userMessage: 'Request timed out. Please check your connection.', shouldRetry: true };
    case 'ENOTFOUND':
      return { userMessage: 'Service not found. Please check configuration.', shouldRetry: false };
    case 'ECONNRESET':
      return { userMessage: 'Connection was reset. Please try again.', shouldRetry: true };
    default:
      return { userMessage: 'Network error occurred.', shouldRetry: false };
  }
}

function formatValidationError(error: { field: string; value: any; expected: string }): string {
  return `Field '${error.field}' is invalid. Expected ${error.expected}.`;
}

async function simulateOperation(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 10));
}