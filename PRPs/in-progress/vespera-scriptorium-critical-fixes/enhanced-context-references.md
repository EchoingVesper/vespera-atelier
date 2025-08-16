# Enhanced Context References for Vespera-Scriptorium Critical Fixes

**Meta-PRP**: `PRPs/in-progress/vespera-scriptorium-critical-fixes/`  
**Purpose**: Essential context and patterns for systematic bug fixing and architecture implementation

## 🧠 Required Context for Agents

### Multi-Agent Coordination Patterns
- **Source**: `PRPs/ai_docs/context-engineering-guide.md` (if exists)
- **Application**: Each specialized agent needs systematic context engineering for effective bug fixing
- **Key Patterns**: Specialist context retrieval, artifact storage, progress coordination

### MCP Protocol Implementation Patterns  
- **Source**: `PRPs/ai_docs/mcp-protocol-patterns.md` (if exists)
- **Application**: Critical for fixing handler migration issues and MCP tool registration problems
- **Key Patterns**: Tool registration, parameter conversion, error handling in MCP context

### Systematic Testing Framework
- **Source**: `PRPs/ai_docs/systematic-testing-framework.md` (if exists)  
- **Application**: Validation of all 32 MCP tools after fixes, regression prevention
- **Key Patterns**: Multi-stage validation, comprehensive testing matrices

## 🔧 Technical Context from Audit

### Handler Migration System Understanding
**Critical Knowledge**: The migration from dictionary-based to Pydantic handlers is causing data structure incompatibilities

**Key Files**:
- `vespera_scriptorium/infrastructure/mcp/handlers/migration_config.py`
- `vespera_scriptorium/infrastructure/mcp/tool_router.py`
- `vespera_scriptorium/infrastructure/mcp/handlers/task_handlers.py`

**Common Patterns Needed**:
- Parameter type conversion between handler formats
- Array and date parameter handling
- Error mapping and recovery strategies

### Database and Persistence Layer Context
**Critical Knowledge**: Task/session lookup failures indicate database path or query issues

**Key Files**:
- `vespera_scriptorium/orchestrator/orchestration_state_manager.py`
- `vespera_scriptorium/infrastructure/database/` (entire layer)
- `vespera_scriptorium/db/generic_repository.py` (legacy, 1180 lines)

**Common Patterns Needed**:
- Database connection management
- Session context isolation
- Query debugging and logging

### Template System Architecture  
**Critical Knowledge**: Template instantiation system can list but not resolve templates

**Key Files**:
- `vespera_scriptorium/infrastructure/template_system/template_engine.py`
- `vespera_scriptorium/infrastructure/template_system/storage_manager.py`  
- `vespera_scriptorium/infrastructure/template_system/mcp_tools.py`

**Common Patterns Needed**:
- Template lookup path resolution
- Category-based template organization
- File system permission handling

## 🎯 Agent Specialist Context Requirements

### Priority 1 Agent (Critical System Bugs)
**Specialist Type**: `coder` with system architecture focus  
**Required Context**:
- Deep understanding of dependency management (`pyproject.toml` patterns)
- Handler migration system architecture and data flow
- Database query debugging and session management
- Template system file resolution and lookup logic

### Priority 2 Agent (Workflow-Critical Bugs)  
**Specialist Type**: `coder` with MCP protocol expertise
**Required Context**:
- MCP tool registration and routing patterns
- Parameter conversion between data formats (arrays, dates)
- Tool discovery and registration debugging
- Handler migration testing and validation

### Priority 3 Agent (Architecture Implementation)
**Specialist Type**: `architect` with background systems design
**Required Context**:
- Background service architecture patterns
- Hook system design and implementation
- Configuration system design
- Production deployment patterns

### Priority 4 Agent (Integration Testing)
**Specialist Type**: `tester` with comprehensive validation expertise
**Required Context**:
- Systematic testing framework patterns
- Performance benchmarking methodologies  
- Regression testing strategies
- Tool success rate measurement and validation

## 📚 Cross-Reference Documentation

### Existing CLAUDE.md Files
- **Main Guide**: `/home/aya/dev/monorepo/vespera-atelier/CLAUDE.md` - Essential monorepo patterns
- **Package Guide**: `/home/aya/dev/monorepo/vespera-atelier/packages/vespera-scriptorium/CLAUDE.md` - Package-specific guidance
- **Package Core**: `/home/aya/dev/monorepo/vespera-atelier/packages/vespera-scriptorium/vespera_scriptorium/CLAUDE.md` - Core implementation details

### Architecture Documentation
- **Clean Architecture Overview** - Understanding the domain/application/infrastructure layers
- **Dependency Injection System** - Service container and lifetime management
- **Error Handling Patterns** - Domain exceptions and recovery strategies

### Testing and Validation Patterns
- **Multi-stage validation** framework requirements
- **Resource cleanup** patterns (critical for database connections)
- **Performance monitoring** for validation overhead

## 🚀 Implementation Guidance

### Context Engineering Best Practices
1. **Load comprehensive context** before starting bug fixes
2. **Reference existing patterns** in codebase for consistency
3. **Document new patterns** discovered during fixes
4. **Share context artifacts** via orchestrator for other agents

### Systematic Approach Requirements
1. **Understand the system** before making changes
2. **Test comprehensively** after each fix  
3. **Validate cross-system impact** of changes
4. **Maintain documentation** throughout fix process

---

**Note**: This enhanced context serves as the foundation for systematic, high-quality bug fixes that maintain system integrity while resolving critical issues.