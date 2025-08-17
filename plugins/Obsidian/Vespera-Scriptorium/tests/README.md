# MCP Configuration - Testing Strategy

This directory contains the test suite for the MCP (Model Communication Protocol) Configuration components.

## Test Structure

```
tests/
├── integration/                  # Integration tests
│   ├── providers/               # Provider-specific tests
│   │   └── OllamaProvider.test.ts
│   └── failure-scenarios.test.ts # Failure scenario tests
├── load/                        # Load testing scripts
│   └── ollama-load-test.js
├── security/                    # Security tests
│   └── security-tests.ts
└── __mocks__/                   # Test utilities and mocks
    └── test-utils.ts
```

## Running Tests

### Unit Tests

Run all unit tests:

```bash
npm test
```

Run a specific test file:

```bash
npm test tests/integration/providers/OllamaProvider.test.ts
```

### Integration Tests

Run all integration tests:

```bash
npm run test:integration
```

### Security Tests

Run security tests:

```bash
npm run test:security
```

### Load Testing

1. Install k6:

```bash
# macOS
brew install k6

# Windows (using Chocolatey)
choco install k6
```

2. Run the load test:

```bash
k6 run tests/load/ollama-load-test.js
```

With custom parameters:

```bash
k6 run -e VUS=20 -e DURATION=1m tests/load/ollama-load-test.js
```

## Test Coverage

To generate a test coverage report:

```bash
npm run test:coverage
```

This will generate a coverage report in the `coverage` directory.

## Writing Tests

### Unit Tests

- Test one thing per test case
- Mock external dependencies
- Follow the Arrange-Act-Assert pattern
- Use descriptive test names

### Integration Tests

- Test interactions between components
- Use real dependencies when possible
- Test happy paths and error cases
- Clean up after tests

### Security Tests

- Test input validation
- Test authentication and authorization
- Test for common vulnerabilities
- Test error handling

### Load Tests

- Test with realistic workloads
- Monitor system resources
- Set appropriate thresholds
- Document test scenarios

## Test Data

Test data should be stored in the `__fixtures__` directory next to the test files that use them.

## Continuous Integration

Tests are automatically run on push and pull requests. See the `.github/workflows` directory for CI configuration.
