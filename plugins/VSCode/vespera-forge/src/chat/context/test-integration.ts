/**
 * Integration Test for File Context System
 * Manual test script to validate file context functionality
 */

import * as vscode from 'vscode';
import { FileContextCollector, FileContextManager } from './index';

/**
 * Test the file context integration manually
 * Run this from VS Code extension development host
 */
export async function testFileContextIntegration(): Promise<void> {
  console.log('[FileContextTest] Starting integration tests...');

  try {
    // Test 1: Basic context collection
    console.log('[FileContextTest] Test 1: Basic context collection');
    const collector = new FileContextCollector();
    const items = await collector.collectContext();
    
    console.log(`[FileContextTest] Collected ${items.length} context items:`, 
      items.map(item => `${item.type}: ${item.filepath} (${item.content.length} chars, priority ${item.priority})`));

    // Test 2: Context manager formatting
    console.log('[FileContextTest] Test 2: Context manager formatting');
    const manager = new FileContextManager({
      enabled: true,
      autoCollect: true
    });
    
    const testMessage = "Explain this code and suggest improvements";
    const contextualMessage = await manager.createContextualMessage(testMessage);
    
    console.log('[FileContextTest] Contextual message created:', {
      hasContext: contextualMessage.hasContext,
      contextSummary: contextualMessage.contextSummary,
      originalLength: contextualMessage.originalMessage.length,
      contextualLength: contextualMessage.contextualContent.length
    });

    // Test 3: Configuration handling
    console.log('[FileContextTest] Test 3: Configuration handling');
    const currentConfig = manager.getConfig();
    console.log('[FileContextTest] Current config:', currentConfig);

    // Update configuration
    manager.updateConfig({
      contextOptions: {
        ...currentConfig.contextOptions,
        maxFileSize: 5000,
        cursorContextLines: 5
      }
    });

    const updatedConfig = manager.getConfig();
    console.log('[FileContextTest] Updated config applied:', {
      maxFileSize: updatedConfig.contextOptions.maxFileSize,
      cursorContextLines: updatedConfig.contextOptions.cursorContextLines
    });

    // Test 4: Context size limiting
    console.log('[FileContextTest] Test 4: Context size limiting');
    const limitedManager = new FileContextManager({
      enabled: true,
      contextOptions: {
        maxTotalSize: 1000, // Very small limit for testing
        maxFileSize: 500
      }
    });

    const limitedContextualMessage = await limitedManager.createContextualMessage("Test with limits");
    console.log('[FileContextTest] Limited context:', {
      hasContext: limitedContextualMessage.hasContext,
      contextLength: limitedContextualMessage.contextualContent.length,
      contextSummary: limitedContextualMessage.contextSummary
    });

    // Test 5: Error handling
    console.log('[FileContextTest] Test 5: Error handling');
    const disabledManager = new FileContextManager({
      enabled: false
    });

    const disabledContextualMessage = await disabledManager.createContextualMessage("Test with disabled context");
    console.log('[FileContextTest] Disabled context result:', {
      hasContext: disabledContextualMessage.hasContext,
      contextSummary: disabledContextualMessage.contextSummary
    });

    // Cleanup
    manager.dispose();
    limitedManager.dispose();
    disabledManager.dispose();

    console.log('[FileContextTest] All integration tests completed successfully! ✅');
    
    // Show results in VS Code
    vscode.window.showInformationMessage(
      `File Context Integration Tests Passed! Found ${items.length} context items. Check console for details.`
    );

  } catch (error) {
    console.error('[FileContextTest] Integration test failed:', error);
    vscode.window.showErrorMessage(`File Context Integration Test Failed: ${error}`);
    throw error;
  }
}

/**
 * Test specific VS Code editor states
 */
export async function testEditorStateScenarios(): Promise<void> {
  console.log('[FileContextTest] Testing specific editor state scenarios...');

  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showWarningMessage('No active editor found. Open a file to test file context.');
    return;
  }

  const collector = new FileContextCollector({
    includeActiveFile: true,
    includeSelection: true,
    includeCursorArea: true,
    includeOpenTabs: true,
    cursorContextLines: 10
  });

  // Test different editor scenarios
  const scenarios = [
    'No Selection (cursor area only)',
    'With Selection',
    'Multiple Open Tabs'
  ];

  for (const scenario of scenarios) {
    console.log(`[FileContextTest] Scenario: ${scenario}`);
    
    const items = await collector.collectContext();
    console.log(`[FileContextTest] ${scenario} - Collected ${items.length} items:`, 
      items.map(item => ({
        type: item.type,
        filepath: item.filepath.split('/').pop(), // Show filename only
        lines: item.startLine && item.endLine ? `${item.startLine}-${item.endLine}` : 'full',
        size: `${Math.round(item.content.length / 100) / 10}k chars`,
        priority: item.priority
      }))
    );
  }

  vscode.window.showInformationMessage('Editor state scenarios tested! Check console for results.');
}

/**
 * Register test commands in VS Code
 */
export function registerTestCommands(context: vscode.ExtensionContext): void {
  // Main integration test
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.testFileContextIntegration', async () => {
      await testFileContextIntegration();
    })
  );

  // Editor state scenarios test
  context.subscriptions.push(
    vscode.commands.registerCommand('vespera-forge.testEditorStateScenarios', async () => {
      await testEditorStateScenarios();
    })
  );

  console.log('[FileContextTest] Test commands registered:');
  console.log('  - vespera-forge.testFileContextIntegration');
  console.log('  - vespera-forge.testEditorStateScenarios');
}