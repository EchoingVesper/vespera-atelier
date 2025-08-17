# Tool Enumeration Testing Patterns

**Extracted From**: test_simple_tools.py, test_rebuilt_package.py  
**Pattern Type**: System validation and tool discovery  
**Applicability**: MCP tool registration, system health checks, CI/CD validation

## Legacy Pattern Analysis

### Original Implementation (test_simple_tools.py)
```python
try:
    from vespera_scriptorium.infrastructure.mcp.tool_definitions import get_all_tools
    tools = get_all_tools()
    print(f"SUCCESS: Found {len(tools)} tools")
    for i, tool in enumerate(tools, 1):
        print(f"  {i:2d}. {tool.name}")
    
    if len(tools) == 17:
        print("\n🎉 All 17 tools are available!")
    else:
        print(f"\n⚠️  Expected 17 tools, found {len(tools)}")
        
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
```

### Pattern Strengths
1. **Simple Tool Discovery**: Direct enumeration of available tools
2. **Validation Reporting**: Clear success/failure reporting with counts
3. **Error Handling**: Comprehensive exception handling with traceback
4. **User-Friendly Output**: Numbered list with clear status indicators

### Pattern Weaknesses
1. **Hard-coded Expectations**: Fixed tool count (17) breaks with system evolution
2. **Implementation Coupling**: Direct import from infrastructure layer
3. **No Categorization**: Treats all tools equally without functional grouping
4. **Limited Validation**: Only checks existence, not functionality

## Clean Architecture Adaptations

### Pattern 1: Dynamic Tool Discovery
```python
from vespera_scriptorium.application.interfaces.tool_registry import ToolRegistry
from vespera_scriptorium.infrastructure.di.container import Container

def discover_available_tools():
    """Discover all available MCP tools dynamically."""
    container = Container()
    tool_registry = container.get(ToolRegistry)
    
    try:
        tools = tool_registry.get_available_tools()
        
        print(f"SUCCESS: Found {len(tools)} tools")
        for i, tool in enumerate(tools, 1):
            print(f"  {i:2d}. {tool.name} ({tool.category})")
        
        return tools
        
    except Exception as e:
        print(f"ERROR: Tool discovery failed: {e}")
        import traceback
        traceback.print_exc()
        return []
```

### Pattern 2: Categorized Tool Validation
```python
def validate_tools_by_category():
    """Validate tools organized by functional categories."""
    container = Container()
    tool_registry = container.get(ToolRegistry)
    
    expected_categories = {
        'orchestrator': ['orchestrator_create_task', 'orchestrator_execute_task'],
        'template': ['template_create', 'template_instantiate'],
        'github': ['github_create_repository', 'github_create_pull_request'],
        'search': ['brave_web_search', 'context7_get_library_docs']
    }
    
    tools = tool_registry.get_available_tools()
    tools_by_category = {}
    
    for tool in tools:
        category = tool.category or 'uncategorized'
        if category not in tools_by_category:
            tools_by_category[category] = []
        tools_by_category[category].append(tool.name)
    
    # Validate each category
    validation_results = {}
    for category, expected_tools in expected_categories.items():
        available_tools = tools_by_category.get(category, [])
        missing_tools = set(expected_tools) - set(available_tools)
        
        validation_results[category] = {
            'expected': len(expected_tools),
            'available': len(available_tools),
            'missing': list(missing_tools),
            'complete': len(missing_tools) == 0
        }
        
        print(f"{category.upper()}: {len(available_tools)}/{len(expected_tools)} tools")
        if missing_tools:
            print(f"  Missing: {', '.join(missing_tools)}")
    
    return validation_results
```

### Pattern 3: Tool Functionality Validation
```python
async def validate_tool_functionality():
    """Test that tools can be invoked and return expected responses."""
    container = Container()
    tool_registry = container.get(ToolRegistry)
    mcp_server = container.get(MCPServer)
    
    tools = tool_registry.get_available_tools()
    validation_results = {}
    
    for tool in tools:
        try:
            # Test tool schema validation
            schema_valid = tool.validate_schema()
            
            # Test tool can be invoked (with safe test parameters)
            if hasattr(tool, 'get_test_parameters'):
                test_params = tool.get_test_parameters()
                response = await mcp_server.call_tool(tool.name, test_params)
                invocation_success = response.get('success', False)
            else:
                invocation_success = None  # Skip invocation test
            
            validation_results[tool.name] = {
                'schema_valid': schema_valid,
                'invocation_success': invocation_success,
                'status': 'pass' if schema_valid else 'fail'
            }
            
        except Exception as e:
            validation_results[tool.name] = {
                'schema_valid': False,
                'invocation_success': False,
                'status': 'error',
                'error': str(e)
            }
    
    # Report results
    passed = sum(1 for result in validation_results.values() if result['status'] == 'pass')
    total = len(validation_results)
    
    print(f"Tool Functionality Validation: {passed}/{total} passed")
    for tool_name, result in validation_results.items():
        status_icon = "✅" if result['status'] == 'pass' else "❌"
        print(f"  {status_icon} {tool_name}: {result['status']}")
    
    return validation_results
```

## Testing Implementation Patterns

### Unit Test Pattern
```python
import pytest
from unittest.mock import Mock

def test_tool_enumeration_unit():
    """Unit test for tool enumeration without external dependencies."""
    # Mock tool registry
    mock_registry = Mock()
    mock_tools = [
        Mock(name='tool1', category='test'),
        Mock(name='tool2', category='test')
    ]
    mock_registry.get_available_tools.return_value = mock_tools
    
    # Test enumeration logic
    tools = mock_registry.get_available_tools()
    
    assert len(tools) == 2
    assert tools[0].name == 'tool1'
    assert tools[1].name == 'tool2'
```

### Integration Test Pattern
```python
@pytest.mark.asyncio
async def test_tool_enumeration_integration():
    """Integration test with real tool registry."""
    container = Container()
    tool_registry = container.get(ToolRegistry)
    
    tools = tool_registry.get_available_tools()
    
    # Behavioral assertions (not specific counts)
    assert len(tools) > 0, "Should have at least some tools"
    assert all(hasattr(tool, 'name') for tool in tools), "All tools should have names"
    assert all(hasattr(tool, 'category') for tool in tools), "All tools should have categories"
    
    # Test specific critical tools exist
    tool_names = [tool.name for tool in tools]
    critical_tools = ['orchestrator_create_task', 'template_create']
    for critical_tool in critical_tools:
        assert critical_tool in tool_names, f"Critical tool {critical_tool} missing"
```

### CI/CD Validation Pattern
```python
def validate_tools_for_ci():
    """Validation suitable for CI/CD pipeline health checks."""
    try:
        container = Container()
        tool_registry = container.get(ToolRegistry)
        
        tools = tool_registry.get_available_tools()
        
        # Basic health checks
        assert len(tools) >= 10, f"Too few tools available: {len(tools)}"
        
        # Check for required tool categories
        categories = set(tool.category for tool in tools if tool.category)
        required_categories = {'orchestrator', 'template', 'github'}
        missing_categories = required_categories - categories
        assert not missing_categories, f"Missing tool categories: {missing_categories}"
        
        # Tool name uniqueness
        tool_names = [tool.name for tool in tools]
        assert len(tool_names) == len(set(tool_names)), "Duplicate tool names detected"
        
        print(f"✅ CI validation passed: {len(tools)} tools, {len(categories)} categories")
        return True
        
    except Exception as e:
        print(f"❌ CI validation failed: {e}")
        return False
```

## Best Practices

### 1. Avoid Hard-coded Counts
```python
# DON'T: Hard-coded expectations
assert len(tools) == 17, "Must have exactly 17 tools"

# DO: Behavioral validation
assert len(tools) > 0, "Should have tools available"
assert 'orchestrator_create_task' in tool_names, "Should have task creation capability"
```

### 2. Use Categorized Validation
```python
# DON'T: Treat all tools equally
tools = get_all_tools()

# DO: Validate by functional category
tools_by_category = group_tools_by_category(tools)
validate_category_completeness(tools_by_category)
```

### 3. Test Interface Contracts
```python
# DON'T: Test implementation details
assert tool.internal_method() == expected_value

# DO: Test public interface contracts
assert tool.name is not None
assert tool.can_execute()
assert tool.get_schema().is_valid()
```

### 4. Provide Diagnostic Information
```python
# DON'T: Silent failures
tools = get_tools()

# DO: Comprehensive reporting
tools = get_tools()
print(f"Found {len(tools)} tools:")
for tool in tools:
    print(f"  - {tool.name} ({tool.category})")
```

## Reusable Components

### Tool Validator Class
```python
class ToolValidator:
    """Reusable tool validation with comprehensive reporting."""
    
    def __init__(self, container: Container):
        self.tool_registry = container.get(ToolRegistry)
    
    def validate_all(self) -> Dict[str, Any]:
        """Comprehensive tool validation."""
        tools = self.tool_registry.get_available_tools()
        
        return {
            'discovery': self._validate_discovery(tools),
            'categorization': self._validate_categorization(tools),
            'functionality': self._validate_functionality(tools),
            'summary': self._generate_summary(tools)
        }
    
    def _validate_discovery(self, tools: List[Tool]) -> Dict[str, Any]:
        """Validate tool discovery."""
        return {
            'total_count': len(tools),
            'tools_found': [tool.name for tool in tools],
            'success': len(tools) > 0
        }
    
    def _validate_categorization(self, tools: List[Tool]) -> Dict[str, Any]:
        """Validate tool categorization."""
        categories = {}
        for tool in tools:
            category = tool.category or 'uncategorized'
            if category not in categories:
                categories[category] = []
            categories[category].append(tool.name)
        
        return {
            'categories': categories,
            'category_count': len(categories),
            'uncategorized_count': len(categories.get('uncategorized', []))
        }
    
    async def _validate_functionality(self, tools: List[Tool]) -> Dict[str, Any]:
        """Validate tool functionality."""
        # Implementation depends on available testing interfaces
        pass
    
    def _generate_summary(self, tools: List[Tool]) -> Dict[str, Any]:
        """Generate validation summary."""
        return {
            'total_tools': len(tools),
            'status': 'healthy' if len(tools) > 0 else 'unhealthy',
            'timestamp': datetime.now().isoformat()
        }
```

---

**Pattern Documentation Complete**: Comprehensive tool enumeration patterns adapted for Clean Architecture with behavioral validation and extensible categorization.