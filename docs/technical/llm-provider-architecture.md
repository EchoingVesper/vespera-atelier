# LLM Provider Architecture

## Overview

Vespera Scriptorium's multi-provider LLM architecture is designed to support multiple AI providers while maintaining flexibility, compliance, and user choice. Based on extensive research into OAuth token restrictions and Terms of Service requirements, this architecture prioritizes direct API integration with optional CLI fallbacks.

## Design Principles

1. **ToS Compliance**: All integrations respect provider Terms of Service
2. **User Choice**: Multiple authentication methods where possible
3. **Provider Agnostic**: Unified interface across all providers
4. **Extensibility**: Easy to add new providers
5. **Reliability**: Fallback mechanisms for authentication issues

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    LLM Provider Manager                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Anthropic │  │    OpenAI   │  │   Google    │  ...  │
│  │   Provider  │  │   Provider  │  │   Provider  │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
├─────────────────────────────────────────────────────────────┤
│                 Authentication Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  API Keys   │  │ CLI Process │  │   OAuth     │       │
│  │ (Primary)   │  │ (Fallback)  │  │ (Limited)   │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
├─────────────────────────────────────────────────────────────┤
│                   Configuration Store                      │
└─────────────────────────────────────────────────────────────┘
```

## Provider Implementations

### Anthropic/Claude Integration

**Primary Method: Direct API**
```typescript
interface ClaudeProvider {
  authenticate(apiKey: string): Promise<boolean>
  generateResponse(prompt: string, options: RequestOptions): Promise<Response>
  validateToken(): Promise<boolean>
}
```

**Fallback Method: CLI Integration**
```typescript
interface ClaudeCLIProvider {
  executeCommand(systemPrompt: string, userMessage: string): Promise<Response>
  validateCLIAccess(): Promise<boolean>
}
```

**OAuth Method: Not Recommended**
- Research findings: Violates Anthropic ToS
- Technical restriction: "OAuth tokens are only authorized for use with Claude Code"
- Risk: Account suspension

### OpenAI Integration

```typescript
interface OpenAIProvider {
  authenticate(apiKey: string): Promise<boolean>
  generateResponse(messages: Message[], model: string): Promise<Response>
  listModels(): Promise<Model[]>
}
```

### Google/Vertex AI Integration

```typescript
interface VertexAIProvider {
  authenticate(credentials: ServiceAccountKey): Promise<boolean>
  generateResponse(prompt: string, model: string): Promise<Response>
  configureProject(projectId: string, location: string): void
}
```

## Configuration Schema

```typescript
interface ProviderConfig {
  id: string
  name: string
  type: 'anthropic' | 'openai' | 'google' | 'custom'
  authentication: {
    method: 'api_key' | 'cli' | 'oauth' | 'service_account'
    config: Record<string, any>
  }
  models: Model[]
  endpoints?: {
    base_url?: string
    custom_headers?: Record<string, string>
  }
  limits?: {
    requests_per_minute?: number
    tokens_per_minute?: number
  }
}
```

## Authentication Flow

### API Key Authentication (Primary)

```typescript
async function authenticateWithAPIKey(provider: string, apiKey: string) {
  const providerInstance = getProvider(provider)
  
  try {
    const isValid = await providerInstance.validateAPIKey(apiKey)
    if (isValid) {
      await securelyStoreCredentials(provider, { type: 'api_key', key: apiKey })
      return { success: true }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
```

### CLI Authentication (Fallback)

```typescript
async function authenticateWithCLI(provider: string) {
  if (provider !== 'anthropic') {
    throw new Error('CLI authentication only supported for Anthropic/Claude')
  }
  
  try {
    // Test CLI access
    const testResult = await executeCLICommand('claude --version')
    if (testResult.success) {
      return { success: true, method: 'cli' }
    }
  } catch (error) {
    return { success: false, error: 'Claude CLI not available' }
  }
}
```

## Usage Examples

### Basic Provider Setup

```typescript
const providerManager = new LLMProviderManager()

// Add Anthropic with API key
await providerManager.addProvider({
  id: 'claude',
  type: 'anthropic',
  authentication: {
    method: 'api_key',
    config: { api_key: 'sk-...' }
  }
})

// Add OpenAI
await providerManager.addProvider({
  id: 'gpt',
  type: 'openai', 
  authentication: {
    method: 'api_key',
    config: { api_key: 'sk-...' }
  }
})
```

### Making Requests

```typescript
// Unified interface across providers
const response = await providerManager.generateResponse('claude', {
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello, world!' }
  ],
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1000
})
```

### Provider Fallbacks

```typescript
// Try API key first, fallback to CLI for Claude
async function getClaudeResponse(prompt: string) {
  try {
    return await providerManager.generateResponse('claude-api', prompt)
  } catch (error) {
    console.log('API failed, trying CLI fallback...')
    return await providerManager.generateResponse('claude-cli', prompt)
  }
}
```

## Security Considerations

### Credential Storage

- **API Keys**: Encrypted storage in user's system keychain
- **Service Account Keys**: Secure file system storage with restricted permissions
- **Temporary Tokens**: In-memory only, never persisted

### Network Security

- **HTTPS Only**: All API communications use TLS
- **Certificate Validation**: Strict certificate checking
- **Request Signing**: Where supported by provider

### Access Control

- **Least Privilege**: Each provider gets minimal required permissions
- **Token Rotation**: Automatic rotation where supported
- **Audit Logging**: All provider interactions logged for debugging

## Testing Strategy

### Unit Tests

```typescript
describe('AnthropicProvider', () => {
  it('should authenticate with valid API key', async () => {
    const provider = new AnthropicProvider()
    const result = await provider.authenticate('valid-key')
    expect(result).toBe(true)
  })
  
  it('should handle invalid API key gracefully', async () => {
    const provider = new AnthropicProvider() 
    const result = await provider.authenticate('invalid-key')
    expect(result).toBe(false)
  })
})
```

### Integration Tests

- End-to-end authentication flows
- Real API calls with test credentials
- Error handling and fallback scenarios
- Rate limiting compliance

## Migration Path

### Phase 1: Core Architecture
1. Implement provider interface
2. Add Anthropic API key support
3. Add OpenAI support
4. Basic configuration management

### Phase 2: Enhanced Features
1. Add Claude CLI fallback
2. Implement Google Vertex AI
3. Add provider health monitoring
4. Implement request routing/load balancing

### Phase 3: Advanced Capabilities
1. Custom provider support
2. Advanced rate limiting
3. Cost tracking per provider
4. Performance analytics

## Research References

- **Roo Code Analysis**: CLI subprocess approach (`claude -p --system-prompt`)
- **OpenCode Investigation**: Special beta headers, OAuth restrictions
- **Anthropic ToS**: Restrictions on automated access without permission
- **GitHub Issues**: Multiple examples of OAuth token restrictions

## Conclusion

This architecture provides a robust, compliant, and extensible foundation for multi-provider LLM integration. By prioritizing direct API access and providing CLI fallbacks where appropriate, we maintain both technical flexibility and legal compliance.

The research clearly shows that OAuth token reuse violates Terms of Service and faces technical restrictions. The recommended approach using direct API keys and optional CLI integration provides the best balance of functionality, compliance, and user experience.