# Validation Ignore Pattern System

The validation ignore pattern system helps reduce false positives when analyzing code that uses legitimate frameworks and libraries. It provides configurable pattern matching to ignore common framework patterns while still detecting actual security issues.

## Overview

The system consists of several components:

- **ValidationConfig**: Configuration data structure for ignore patterns
- **PatternMatcher**: Efficient regex-based pattern compilation and matching
- **ValidationConfigManager**: Configuration file management and persistence
- **CodeValidator**: Code analysis with ignore pattern integration
- **FileToolsMCP**: MCP tools with validation support

## Configuration

### Configuration File

The validation configuration is stored in `.vespera/validation_config.json`:

```json
{
  "functions": [
    "@app.*",
    "@router.*", 
    "FastAPI",
    "BaseModel.*",
    "pytest.*",
    "test_*"
  ],
  "imports": [
    "fastapi.*",
    "pydantic.*",
    "sqlalchemy.*",
    "pytest.*"
  ],
  "classes": [
    "HTTPException",
    "BaseModel",
    "FastAPI",
    "Session"
  ],
  "attributes": [
    "app.get",
    "app.post",
    "*.config",
    "*.session"
  ],
  "file_patterns": [
    "test_*.py",
    "*_test.py",
    "conftest.py",
    "**/migrations/*.py"
  ]
}
```

### Pattern Types

#### Functions
Patterns for function names and decorators:
- `@app.*` - FastAPI route decorators
- `test_*` - Test functions
- `BaseModel.*` - Pydantic model methods
- `pytest.*` - Pytest functions

#### Imports
Patterns for import statements:
- `fastapi.*` - All FastAPI imports
- `pydantic.*` - All Pydantic imports
- `sqlalchemy.*` - All SQLAlchemy imports

#### Classes
Patterns for class names:
- `HTTPException` - FastAPI exception class
- `BaseModel` - Pydantic base model
- `Session` - SQLAlchemy session

#### Attributes
Patterns for attribute access:
- `app.get` - FastAPI route methods
- `*.config` - Configuration attributes
- `*.metadata` - Metadata attributes

#### File Patterns
Patterns for file paths (uses fnmatch):
- `test_*.py` - Test files
- `**/migrations/*.py` - Database migration files
- `conftest.py` - Pytest configuration

### Pattern Syntax

The system supports several pattern syntaxes:

#### Wildcard Patterns
- `*` - Matches any characters
- `?` - Matches single character
- `test_*` → `^test_.*$` (regex)
- `*_helper` → `^.*_helper$` (regex)
- `get_*_data` → `^get_.*_data$` (regex)

#### Decorator Patterns
- `@app.*` → `^@app\..*$` (regex)
- `@pytest.*` → `^@pytest\..*$` (regex)
- `@router.get` → `^@router\.get$` (regex)
- Handles the `@` symbol specially for Python decorators

#### Module Patterns
- `fastapi.*` → `^fastapi\..*$` (regex)
- `pydantic.models.*` → `^pydantic\.models\..*$` (regex)
- `sqlalchemy.orm.*` → `^sqlalchemy\.orm\..*$` (regex)
- Escapes dots in module names properly

#### Complex Attribute Patterns
- `*.config` → `^.*\.config$` (matches any object's config attribute)
- `app.get` → `^app\.get$` (exact match for app.get method)
- `session.query` → `^session\.query$` (exact SQLAlchemy session query)
- `*.metadata.*` → `^.*\.metadata\..*$` (any metadata sub-attribute)

#### File Pattern Examples
- `test_*.py` → matches `test_user.py`, `test_auth.py`
- `**/migrations/*.py` → matches `db/migrations/001_init.py`
- `conftest.py` → exact match for pytest configuration
- `*_test.py` → matches `user_test.py`, `auth_test.py`

#### Exact Patterns
- `BaseModel` → `^BaseModel$` (regex)
- `HTTPException` → `^HTTPException$` (regex)
- Simple strings become exact matches with anchoring

#### Regex Special Characters
The system automatically escapes special regex characters:
- Dots (`.`) are escaped except in wildcard contexts
- Question marks (`?`) become single character matches
- Asterisks (`*`) become multi-character matches
- Other regex chars (`[](){}^$+|\`) are escaped

## Usage

### Basic Usage

```python
from validation_config import get_validation_config

# Get the global configuration manager
config = get_validation_config()

# Check if items should be ignored
config.should_ignore('function', '@app.get')     # True
config.should_ignore('import', 'fastapi.FastAPI') # True
config.should_ignore('function', 'dangerous_func') # False
```

### File Validation

```python
from file_tools_mcp import FileToolsMCP

tools = FileToolsMCP()

# Validate a single file
result = tools.read_file_safe('app.py', validate=True)
print(f"Issues found: {result['validation']['total_issues']}")

# Validate entire directory
result = tools.validate_directory_tree('src/', recursive=True)
print(f"Files validated: {result['files_validated']}")
print(f"Files ignored: {result['files_ignored']}")
```

### Configuration Management

```python
from validation_config import ValidationConfigManager

manager = ValidationConfigManager()

# Add new patterns
manager.add_pattern('functions', 'custom_test_*')
manager.add_pattern('imports', 'my_framework.*')

# Remove patterns
manager.remove_pattern('functions', 'old_pattern')

# Save configuration
manager.save_config()

# Reload from file
manager.reload_config()
```

## Framework Coverage

### FastAPI
The system automatically ignores common FastAPI patterns:

```python
from fastapi import FastAPI, HTTPException
from fastapi.security import HTTPBearer

app = FastAPI()  # Ignored class

@app.get("/users")  # Ignored decorator and attribute
async def get_users():  # Function name not ignored
    raise HTTPException(404)  # Ignored class
```

### Pydantic
Pydantic models and validators are ignored:

```python
from pydantic import BaseModel, Field, validator

class User(BaseModel):  # Ignored class
    name: str = Field(...)  # Ignored function
    
    @validator('name')  # Ignored decorator
    def validate_name(cls, v):  # Function name not ignored
        return v
```

### SQLAlchemy
SQLAlchemy ORM patterns are ignored:

```python
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship, sessionmaker

class User(Base):
    id = Column(Integer, primary_key=True)  # Ignored function
    posts = relationship("Post")  # Ignored function

Session = sessionmaker(bind=engine)  # Ignored function
```

### Pytest
Test files and pytest patterns are ignored:

```python
import pytest

@pytest.fixture  # Ignored decorator
def user_data():
    return {"name": "test"}

def test_user_creation():  # Ignored by function pattern
    assert True

@pytest.mark.parametrize("input,expected", [...])  # Ignored decorator
def test_with_params(input, expected):  # Ignored by function pattern
    assert input == expected
```

## Performance

### Pattern Compilation
- 500 patterns compile in ~0.1 seconds
- Compilation is done once at startup
- Regex patterns are cached for reuse

### Pattern Matching
- ~50,000 lookups per second typical
- Caching provides 5-10x speedup for repeated lookups
- Memory overhead: ~1-2MB for typical configurations

### File Validation
- ~1,000-5,000 lines per second typical
- Performance scales with pattern count and file complexity
- AST parsing is the main bottleneck for Python files

## Best Practices

### Pattern Design
1. **Be Specific**: Use specific patterns to avoid false positives
   - Good: `@app.get`, `@app.post`
   - Bad: `@*` (too broad)
2. **Use Wildcards Wisely**: `fastapi.*` is better than just `*`
   - Good: `fastapi.security.*`
   - Bad: `*` (matches everything)
3. **Layer Patterns**: Combine specific and wildcard patterns
   - Specific: `HTTPException`, `BaseModel`
   - Wildcard: `test_*`, `*_fixture`
4. **Test Patterns**: Verify patterns work with example code
   ```python
   # Test your patterns
   config = get_validation_config()
   assert config.should_ignore('function', '@app.get')
   assert not config.should_ignore('function', 'dangerous_exec')
   ```
5. **Document Custom Patterns**: Add comments for non-obvious patterns
6. **Avoid Over-Escaping**: The system handles regex escaping automatically
7. **Use Anchoring**: Patterns are automatically anchored with `^` and `$`

### Configuration Management
1. **Version Control**: Include `.vespera/validation_config.json` in VCS
2. **Environment-Specific**: Use different configs for dev/test/prod
3. **Regular Updates**: Update patterns when adding new frameworks
4. **Performance Monitoring**: Watch for pattern count growth

### Security Considerations
1. **Don't Over-Ignore**: Avoid overly broad patterns
2. **Regular Review**: Review ignored patterns periodically
3. **Test Coverage**: Ensure real issues aren't being ignored
4. **Audit Changes**: Review pattern additions/removals

## Testing

### Unit Tests
Run the comprehensive test suite:

```bash
cd packages/vespera-scriptorium
python -m pytest tests/unit/test_validation_system.py -v
```

### Integration Tests
Test with real framework code:

```bash
python examples/validation_test_cases.py
```

### Performance Benchmarks
Measure system performance:

```bash
python examples/validation_performance_benchmark.py
```

## Troubleshooting

### Common Issues

#### Pattern Not Matching
```python
# Debug pattern matching
from validation_config import PatternMatcher, ValidationConfig

config = ValidationConfig(functions=['@app.*'])
matcher = PatternMatcher()
matcher.compile_patterns(config)

# Test pattern
result = matcher.should_ignore_function('@app.get')
print(f"Pattern matched: {result}")

# Check compiled pattern
for pattern in matcher.compiled_patterns['functions']:
    print(f"Compiled: {pattern.pattern}")
    # Test manual matching
    print(f"Manual test: {pattern.match('@app.get')}")

# Test different input variations
test_cases = ['@app.get', 'app.get', '@app.post', '@router.get']
for test in test_cases:
    result = matcher.should_ignore_function(test)
    print(f"'{test}' -> {result}")

# Validate pattern syntax
from validation_config import ValidationConfigManager
manager = ValidationConfigManager()
valid = manager._validate_pattern_syntax('functions', '@app.*')
print(f"Pattern syntax valid: {valid}")
```

#### Performance Issues
```python
# Check pattern statistics
from validation_config import get_validation_config

config = get_validation_config()
stats = config.pattern_matcher.get_statistics()
print(f"Pattern statistics: {stats}")

# Monitor cache usage
print(f"Cache entries: {stats['cache_entries']}")
```

#### Configuration Problems
```python
# Validate configuration
from validation_config import ValidationConfigManager

manager = ValidationConfigManager()
summary = manager.get_config_summary()
print(f"Config summary: {summary}")

# Check file existence
print(f"Config file exists: {manager.config_path.exists()}")
```

### Logging

Enable debug logging to see pattern matching details:

```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('validation_config')
logger.setLevel(logging.DEBUG)
```

### Performance Optimization

For large codebases:

1. **Limit Pattern Count**: Keep patterns focused and minimal
2. **Use Caching**: Patterns are cached automatically
3. **Batch Operations**: Validate directories rather than individual files
4. **Profile Patterns**: Use benchmark tools to identify slow patterns

## Advanced Configuration

### Custom Pattern Types
Extend the system with custom pattern categories:

```python
from validation_config import ValidationConfig

# Add custom categories
config = ValidationConfig(
    functions=[...],
    imports=[...],
    classes=[...],
    attributes=[...],
    file_patterns=[...],
    # Custom extensions could be added here
)
```

### Integration with CI/CD
Use in continuous integration:

```bash
# Validate all Python files in CI
python -c "
from file_tools_mcp import FileToolsMCP
tools = FileToolsMCP()
result = tools.validate_directory_tree('src/')
exit(1 if result['total_issues'] > 10 else 0)
"
```

### MCP Tool Integration
The validation system integrates with MCP tools:

```python
# MCP tools automatically use validation
from file_tools_mcp import FileToolsMCP

tools = FileToolsMCP()
# Reading files automatically validates with ignore patterns
result = tools.read_file_safe('app.py', validate=True)
```

## API Reference

### ValidationConfig
- `from_dict(data)` - Create from dictionary
- `to_dict()` - Convert to dictionary

### PatternMatcher
- `compile_patterns(config)` - Compile all patterns
- `should_ignore_function(name)` - Check function patterns
- `should_ignore_import(name)` - Check import patterns
- `should_ignore_class(name)` - Check class patterns
- `should_ignore_attribute(name)` - Check attribute patterns
- `should_ignore_file(path)` - Check file patterns
- `get_statistics()` - Get performance statistics

### ValidationConfigManager
- `add_pattern(category, pattern)` - Add new pattern
- `remove_pattern(category, pattern)` - Remove pattern
- `save_config()` - Save to file
- `reload_config()` - Reload from file
- `should_ignore(type, name)` - Check if item should be ignored
- `get_config_summary()` - Get configuration summary

### CodeValidator
- `validate_file(path)` - Validate single file
- `validate_directory(path, recursive)` - Validate directory
- `get_config_summary()` - Get validation configuration

### FileToolsMCP
- `read_file_safe(path, validate)` - Read file with validation
- `write_file_safe(path, content, validate)` - Write file with validation
- `validate_directory_tree(path, recursive)` - Validate directory tree
- `update_validation_config(updates)` - Update configuration
- `get_validation_statistics()` - Get system statistics