# Vespera V2 Test Suite

This directory contains the comprehensive test suite for the Vespera Scriptorium V2 system.

## Test Structure

```
tests/
├── unit/           # Unit tests for individual components
├── integration/    # Integration tests for component interactions  
├── system/         # End-to-end system tests
└── README.md       # This file
```

## Running Tests

### Run All Tests
```bash
./run_tests.py
```

### Run Specific Test Suite
```bash
./run_tests.py --suite unit
./run_tests.py --suite integration  
./run_tests.py --suite system
```

### Run Without MCP Virtual Environment
```bash
./run_tests.py --no-mcp-venv
```

## Test Categories

### Unit Tests
- Individual component testing
- Isolated functionality validation
- Mock dependencies
- Fast execution

### Integration Tests  
- Component interaction testing
- MCP tool integration
- Database persistence
- Cross-module dependencies

### System Tests
- End-to-end workflows
- Complete feature validation
- Real environment testing
- Performance validation

## Test Requirements

Tests require the MCP virtual environment with all dependencies:
- FastMCP SDK
- Copier template engine
- PyYAML configuration parsing
- SQLite database access

## Adding New Tests

1. Place tests in appropriate directory (`unit/`, `integration/`, `system/`)
2. Use naming convention: `test_*.py`
3. Include docstrings explaining test purpose
4. Use the test runner for validation

## Development Scripts

Temporary development and validation scripts should be placed in:
- `dev-tools/temp-scripts/` (gitignored)
- `dev-tools/scratch/` (gitignored)

These locations are automatically ignored by git and can be used for:
- Quick validation scripts
- Development debugging tools  
- Temporary test experiments
- One-off verification scripts