/**
 * Test Claude Code Provider Integration
 * This is a simple test file to verify the Claude Code provider works correctly
 */
import { ClaudeCodeProvider } from './providers/ClaudeCodeProvider';
import { CLAUDE_CODE_TEMPLATE, createDefaultConfig } from './templates/providers/index';

export async function testClaudeCodeProvider(): Promise<boolean> {
  try {
    console.log('[Test] Starting Claude Code provider test...');
    
    // Create default configuration from template
    const defaultConfig = createDefaultConfig(CLAUDE_CODE_TEMPLATE);
    console.log('[Test] Created default config:', defaultConfig);
    
    // Instantiate provider
    const provider = new ClaudeCodeProvider(CLAUDE_CODE_TEMPLATE, defaultConfig);
    console.log('[Test] Claude Code provider instantiated');
    
    // Test connection
    console.log('[Test] Testing connection...');
    await provider.connect();
    console.log('[Test] Connection successful');
    
    // Test basic configuration
    const status = provider.getStatus();
    const capabilities = provider.getCapabilities();
    const template = provider.getTemplate();
    
    console.log('[Test] Provider status:', status);
    console.log('[Test] Provider capabilities:', capabilities);
    console.log('[Test] Provider template ID:', template.template_id);
    
    // Test configuration validation
    const validation = provider.validateConfig(defaultConfig);
    console.log('[Test] Configuration validation:', validation);
    
    if (!validation.valid) {
      console.error('[Test] Configuration validation failed:', validation.errors);
      return false;
    }
    
    // Test connection test method
    const connectionTest = await provider.testConnection();
    console.log('[Test] Connection test result:', connectionTest);
    
    // Clean up
    await provider.disconnect();
    provider.dispose();
    console.log('[Test] Provider cleaned up successfully');
    
    console.log('[Test] ✅ All tests passed! Claude Code provider is working correctly.');
    return true;
    
  } catch (error) {
    console.error('[Test] ❌ Claude Code provider test failed:', error);
    return false;
  }
}

// Test message creation and formatting
export function testMessageFormatting(): boolean {
  try {
    console.log('[Test] Testing message formatting...');
    
    const defaultConfig = createDefaultConfig(CLAUDE_CODE_TEMPLATE);
    const provider = new ClaudeCodeProvider(CLAUDE_CODE_TEMPLATE, defaultConfig);
    
    // Test creating a response (this uses protected methods)
    const testResponse = provider['createResponse']('Test response content', {
      model: 'claude-sonnet-4',
      provider: 'claude-code'
    });
    
    console.log('[Test] Created test response:', {
      id: testResponse.id,
      content: testResponse.content.substring(0, 50) + '...',
      role: testResponse.role,
      hasTimestamp: !!testResponse.timestamp
    });
    
    // Test ID generation
    const id1 = provider['generateMessageId']();
    const id2 = provider['generateMessageId']();
    
    if (id1 === id2) {
      console.error('[Test] Message ID generation failed - IDs are not unique');
      return false;
    }
    
    console.log('[Test] ✅ Message formatting tests passed');
    return true;
    
  } catch (error) {
    console.error('[Test] ❌ Message formatting test failed:', error);
    return false;
  }
}

// For manual testing from VS Code developer console
export async function runAllTests(): Promise<void> {
  console.log('[Test] 🚀 Starting Claude Code provider test suite...');
  
  const formattingResult = testMessageFormatting();
  const providerResult = await testClaudeCodeProvider();
  
  if (formattingResult && providerResult) {
    console.log('[Test] 🎉 All tests passed! Claude Code provider is ready to use.');
  } else {
    console.log('[Test] ❌ Some tests failed. Please check the logs above.');
  }
}