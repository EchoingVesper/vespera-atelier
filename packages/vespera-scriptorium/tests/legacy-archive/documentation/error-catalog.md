# Legacy Test Error Catalog

**Catalog Date**: 2025-08-17  
**Analysis Scope**: 6 archived legacy tests + systematic codebase analysis  
**Purpose**: Comprehensive error documentation for future test development prevention

## Executive Summary

Systematic analysis revealed 3 primary error categories affecting legacy tests:
1. **Architectural Mismatch**: Clean Architecture vs Monolithic assumptions
2. **Import Path Failures**: Pre-refactor module structure expectations  
3. **Interface Changes**: Updated APIs and missing legacy components

## Error Category 1: Architectural Mismatch

### Pre-Clean Architecture Assumptions

**Error Pattern**: Tests expect monolithic server.py structure (1407 lines) vs current Clean Architecture (150 lines)

#### test_server.py Failures
```python
# LEGACY EXPECTATION (Failed)
from vespera_scriptorium import server
self.assertIsNotNone(server.app, "Server app is initialized")
self.assertIsNotNone(server.orchestrator, "Orchestrator is initialized") 
self.assertIsNotNone(server.state_manager, "State manager is initialized")
self.assertIsNotNone(server.specialist_manager, "Specialist manager is initialized")
```

**Root Cause**: Attributes moved to dependency injection container and application layer  
**Current Architecture**: Domain/Application/Infrastructure separation  
**Impact**: Complete test failure due to missing attributes

#### test_initialization.py Failures  
```python
# LEGACY EXPECTATION (Failed)
from vespera_scriptorium.orchestrator.orchestration_state_manager import StateManager
from vespera_scriptorium.orchestrator.task_orchestration_service import TaskOrchestrator
from vespera_scriptorium.orchestrator.specialist_management_service import SpecialistManager

# Initialize components
state_manager = StateManager()
specialist_manager = SpecialistManager()  
orchestrator = TaskOrchestrator(state_manager, specialist_manager)
```

**Root Cause**: Direct instantiation replaced with dependency injection  
**Current Architecture**: Services managed through DI container  
**Impact**: AttributeError on _get_parent_task_id and other internal methods

### Clean Architecture Migration Impact

**Domain Layer**: Business logic separated from infrastructure concerns  
**Application Layer**: Use cases coordinating domain and infrastructure  
**Infrastructure Layer**: External systems and frameworks isolated  

**Legacy Test Problem**: Tests mixed all layers without proper boundaries

## Error Category 2: Import Path Failures

### Systematic Import Breakdown

**Scale**: 200+ broken imports across 32 files with "# TODO: Complete this import" comments

#### Missing Module Patterns
```python
# FREQUENT FAILURE PATTERNS

# File tracking modules (test_file_tracking.py)
from vespera_scriptorium.orchestrator.file_tracking_integration import  # TODO: Complete

# Enhanced orchestrator (test_enhanced_integration.py)  
from vespera_scriptorium.orchestrator.enhanced_core import create_enhanced_orchestrator  # DISABLED: Module does not exist

# Work stream integration
from vespera_scriptorium.orchestrator.work_stream_integration import  # TODO: Complete

# Legacy server structure
from vespera_scriptorium.orchestrator import  # TODO: Complete
from vespera_scriptorium.domain.entities.task import  # TODO: Complete
```

#### Refactored Module Locations
```python
# OLD PATHS (Failed)
vespera_scriptorium.orchestrator.file_tracking_integration
vespera_scriptorium.orchestrator.enhanced_core
vespera_scriptorium.orchestrator.work_stream_integration

# NEW CLEAN ARCHITECTURE PATHS (Current)
vespera_scriptorium.domain.services.task_service
vespera_scriptorium.application.usecases.orchestrate_task
vespera_scriptorium.infrastructure.database.repository_factory
```

### Import Resolution Strategy

**Pattern Recognition**: Legacy imports assume orchestrator-centric structure  
**Current Structure**: Domain-driven design with clear layer separation  
**Migration Required**: Complete import path restructuring for Clean Architecture alignment

## Error Category 3: Interface Changes

### API Evolution Impact

#### Tool Definition Changes (test_simple_tools.py)
```python
# LEGACY EXPECTATION (Partially Failed)
from vespera_scriptorium.infrastructure.mcp.tool_definitions import get_all_tools
tools = get_all_tools()

# Expected 17 tools, current count varies
if len(tools) == 17:
    print("\n🎉 All 17 tools are available!")
else:
    print(f"\n⚠️  Expected 17 tools, found {len(tools)}")
```

**Issue**: Tool count assumptions and interface changes  
**Current State**: Tool registration through MCP protocol adapters  
**Impact**: Hardcoded tool count expectations fail with architecture changes

#### Server Interface Changes (test_rebuilt_package.py)
```python
# LEGACY EXPECTATION (Failed)  
from vespera_scriptorium.server import DIEnabledMCPServer

# Create server instance
server = DIEnabledMCPServer()
```

**Issue**: DIEnabledMCPServer interface refactored  
**Current Interface**: Clean Architecture MCP server implementation  
**Impact**: Server instantiation patterns completely changed

### Missing Component Analysis

#### File Tracking System
- **Legacy Assumption**: Integrated file tracking orchestrator
- **Current State**: File operations handled through application layer
- **Test Impact**: 151 lines of async file tracking tests unusable

#### Enhanced Orchestrator
- **Legacy Assumption**: Enhanced orchestrator with context continuity
- **Current State**: Clean separation of concerns through domain services
- **Test Impact**: 234 lines of integration tests targeting non-existent modules

## Error Prevention Strategies

### For New Test Development

#### Clean Architecture Alignment
1. **Respect Layer Boundaries**: Test domain/application/infrastructure separately
2. **Use Dependency Injection**: Test through proper DI container setup
3. **Mock External Dependencies**: Isolate unit tests from infrastructure concerns
4. **Integration Test Strategy**: Test layer interactions through application layer

#### Import Path Standards
1. **Follow Current Structure**: Use domain/application/infrastructure paths
2. **Avoid Direct Orchestrator Imports**: Use application layer use cases
3. **Test Interface Contracts**: Focus on public APIs, not internal implementation
4. **Module Existence Verification**: Validate imports before test implementation

#### API Testing Patterns
1. **Dynamic Tool Discovery**: Avoid hardcoded tool counts
2. **Interface Contract Testing**: Test behavior, not specific implementations
3. **Graceful Degradation**: Handle missing or changed components elegantly
4. **Version Compatibility**: Design tests for API evolution

## Lessons Learned

### Architectural Evolution Impact
- **Complete Restructuring**: Clean Architecture required fundamental test rewrite
- **Layer Separation**: Tests must respect domain/application/infrastructure boundaries  
- **Dependency Management**: Direct instantiation replaced with proper DI patterns
- **Interface Stability**: Public APIs more stable than internal implementation details

### Test Design Principles
- **Test Architecture, Not Implementation**: Focus on behavioral contracts
- **Isolate Concerns**: Unit tests for domain, integration tests for workflows
- **Mock External Systems**: Avoid database and file system dependencies in unit tests
- **Design for Change**: Expect API evolution and design tests accordingly

### Technical Debt Prevention
- **Regular Test Maintenance**: Update tests with architectural changes
- **Architectural Decision Recording**: Document test strategy decisions
- **Automated Test Validation**: Prevent regression through CI/CD integration
- **Pattern Documentation**: Establish testing patterns for future development

## Reference Matrix

| Legacy Test | Primary Error | Secondary Error | Tertiary Error |
|-------------|---------------|-----------------|----------------|
| test_simple_tools.py | Tool count assumptions | Import path changes | Interface evolution |
| test_server.py | Monolithic assumptions | Missing attributes | Direct instantiation |
| test_initialization.py | Hard-coded paths | Legacy state manager | Component assumptions |
| test_file_tracking.py | Missing modules | Async pattern mismatch | Database integration |
| test_enhanced_integration.py | Non-existent modules | Complex integration | Work stream assumptions |
| test_rebuilt_package.py | Interface changes | Server API evolution | Package structure |

---

**Error Catalog Complete**: Comprehensive documentation of all error patterns for prevention in Clean Architecture test suite implementation.