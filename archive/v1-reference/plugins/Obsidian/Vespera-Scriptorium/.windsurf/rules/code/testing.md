---
trigger: glob
globs: *.{test,spec}.{ts,js}
---

# Testing Requirements Rules

## Unit Testing

1. Every component must have comprehensive unit tests
2. Test coverage should be at least 80% for all components
3. Use mock objects for external dependencies
4. Test both success and error paths
5. Follow the AAA pattern (Arrange, Act, Assert) for test organization

## Integration Testing

1. Implement integration tests for all message flows
2. Test the interaction between components
3. Use realistic test data that matches production scenarios
4. Test error handling and recovery mechanisms
5. Verify message validation and type checking

## Test Organization

1. Organize tests to mirror the source code structure
2. Name test files with the `.test.ts` or `.spec.ts` suffix
3. Group related tests using describe blocks
4. Use clear, descriptive test names that explain the expected behavior

## Mocking Standards

1. Create mock implementations for all external services
2. Mock the NATS client for messaging tests
3. Use consistent mocking patterns across the codebase
4. Document the behavior of complex mocks

## Last Updated: 2025-05-25
