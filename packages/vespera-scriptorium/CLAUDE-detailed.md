
# CLAUDE-detailed.md

**[CURRENT]** Comprehensive Clean Architecture & Development Guide for MCP Task Orchestrator

📋 **Quick Reference**: See [CLAUDE.md](./CLAUDE.md) for essential commands and quick navigation

#

# Clean Architecture Overview

The MCP Task Orchestrator follows **Clean Architecture** and **Domain-Driven Design** principles with a complete layered structure:

#

## Architecture Layers

**1. Domain Layer** (`mcp_task_orchestrator/domain/`):

- **Entities**: Core business objects (Task, Specialist, OrchestrationSession, WorkItem)

- **Value Objects**: Immutable types (TaskStatus, SpecialistType, ExecutionResult, TimeWindow)

- **Exceptions**: Domain-specific error hierarchy with severity levels and recovery strategies

- **Services**: Domain business logic (TaskBreakdownService, SpecialistAssignmentService, etc.)

- **Repositories**: Abstract interfaces for data access (TaskRepository, StateRepository, SpecialistRepository)

**2. Application Layer** (`mcp_task_orchestrator/application/`):

- **Use Cases**: Orchestrate business workflows (OrchestrateTask, ManageSpecialists, TrackProgress)

- **DTOs**: Data transfer objects for clean boundaries between layers

- **Interfaces**: External service contracts (NotificationService, ExternalApiClient)

**3. Infrastructure Layer** (`mcp_task_orchestrator/infrastructure/`):

- **Database**: SQLite implementations of repository interfaces

- **MCP Protocol**: Request/response adapters and server implementation

- **Configuration**: Environment-aware config management and validation

- **Monitoring**: Comprehensive health checks, metrics, and diagnostics

- **Error Handling**: Centralized error processing, retry logic, and recovery strategies

- **Dependency Injection**: Service container with lifetime management

**4. Presentation Layer** (`mcp_task_orchestrator/presentation/`):

- **MCP Server**: Clean architecture entry point with DI integration

- **CLI Interface**: Command-line tools with health checks and configuration management

#

## Key Architectural Components

**1. Dependency Injection System**:

- ServiceContainer with lifetime management (singleton, transient, scoped)

- Fluent service registration API with automatic dependency resolution

- Hybrid mode supporting both clean architecture and legacy compatibility

**2. Error Handling Infrastructure**:

- Comprehensive exception hierarchy with severity levels (LOW, MEDIUM, HIGH, CRITICAL)

- Automatic retry policies (exponential backoff, linear, fixed delay)

- Intelligent recovery strategies for tasks, specialists, and infrastructure

- Centralized error logging with structured analytics

**3. Monitoring and Diagnostics**:

- Real-time system monitoring with configurable alerts

- Performance metrics collection with trend analysis

- Comprehensive health checks for all system components

- Diagnostic tools with automated recommendations

**4. Task Orchestration System** (`mcp_task_orchestrator/orchestrator/`):

- `task_orchestration_service.py`: Core orchestration logic (renamed from core.py)

- `specialist_management_service.py`: Role-based specialist implementations (renamed from specialists.py)

- `orchestration_state_manager.py`: State management (renamed from state.py)

- `maintenance.py`: Automated cleanup and optimization features

- `generic_models.py`: Flexible task model supporting any task type

**5. Database Layer** (`mcp_task_orchestrator/db/` + `infrastructure/database/`):

- Repository pattern with abstract interfaces and SQLite implementations

- Automatic migrations with rollback capabilities

- Connection management with resource cleanup

- Workspace-aware database organization

**6. Installation System** (`mcp_task_orchestrator_cli/`):

- Modular client detection and configuration

- Support for Claude Desktop, Cursor, Windsurf, VS Code

- Secure installation with validation and rollback

**7. Testing Infrastructure** (`testing_utils/`):

- File-based output system to prevent truncation

- Alternative test runners for reliability

- Comprehensive hang detection and resource management

#

## Domain-Driven Design Implementation

**Ubiquitous Language**: Core domain concepts consistently used across all layers

- **Task**: Unit of work with lifecycle, complexity, and specialist requirements

- **Specialist**: Role-based AI persona with specific capabilities and context

- **Orchestration Session**: Bounded context for related tasks and state

- **Work Item**: Atomic unit of executable work within a task

- **Artifact**: Stored output from task execution to prevent context limits

**Domain Services** (`domain/services/`):

- `TaskBreakdownService`: Handles task planning and decomposition

- `SpecialistAssignmentService`: Manages specialist selection and context

- `ProgressTrackingService`: Tracks task status and progress

- `ResultSynthesisService`: Combines results from subtasks

- `OrchestrationCoordinator`: Composes all services for complete workflows

#

## Clean Architecture Task Flow

1. **Presentation** → **Application**: MCP request received, validated, and routed to use case

2. **Application** → **Domain**: Use case orchestrates domain services with business logic

3. **Domain** → **Infrastructure**: Domain services access data through repository interfaces

4. **Infrastructure** → **Database**: Repository implementations handle data persistence

5. **Domain** ← **Infrastructure**: Results flow back through the layers

6. **Presentation** ← **Application**: Clean response returned to MCP client

#

## SOLID Principles Implementation

- **Single Responsibility**: Each service has one clear purpose (task breakdown, specialist assignment, etc.)

- **Open/Closed**: New specialists and task types can be added without modifying existing code

- **Liskov Substitution**: Repository implementations are interchangeable through interfaces

- **Interface Segregation**: Small, focused interfaces (TaskRepository, StateRepository, etc.)

- **Dependency Inversion**: High-level modules depend on abstractions, not concretions

#

## Key Design Patterns

- **Clean Architecture**: Dependency flow always points inward toward domain

- **Domain-Driven Design**: Rich domain model with ubiquitous language

- **Repository Pattern**: Abstract data access with pluggable implementations

- **Dependency Injection**: Automatic resolution with configurable lifetimes

- **Strategy Pattern**: Pluggable retry policies and recovery strategies

- **Observer Pattern**: Event-driven error handling and metrics collection

- **Command Pattern**: Use cases encapsulate business operations

- **Factory Pattern**: Service creation through DI container

- **Adapter Pattern**: Infrastructure adapters for external services

#

# Clean Architecture Development Practices

#

## Adding a New Domain Entity

1. Create entity in `domain/entities/` with business logic and invariants

2. Add value objects in `domain/value_objects/` for entity properties

3. Define repository interface in `domain/repositories/`

4. Implement repository in `infrastructure/database/sqlite/`

5. Create domain service if complex business logic is needed

6. Register services in DI container configuration

#

## Adding a New Use Case

1. Create use case in `application/usecases/` following command pattern

2. Define request/response DTOs in `application/dto/`

3. Add any required domain services to support the use case

4. Register use case in DI container

5. Create MCP handler in `infrastructure/mcp/handlers.py`

6. Update MCP server tool definitions

#

## Adding a New MCP Tool (Clean Architecture Way)

1. Create use case in `application/usecases/` for the business logic

2. Add MCP handler in `infrastructure/mcp/handlers.py` using the use case

3. Update tool definitions in `mcp_request_handlers.py`

4. Add integration tests covering the full flow

5. Document tool usage and examples

#

## Adding Error Handling

1. Define domain exceptions in `domain/exceptions/` with appropriate severity

2. Use `@handle_errors` decorator for automatic retry and recovery

3. Add specific error handlers in `infrastructure/error_handling/handlers.py`

4. Configure recovery strategies for new error types

5. Test error scenarios and recovery paths

#

## Adding Monitoring

1. Add metrics using `record_metric()`, `increment_counter()`, or `track_performance()`

2. Create health checks in monitoring system for new components

3. Add alerts for critical thresholds using `AlertRule`

4. Include component in diagnostic runner for troubleshooting

#

## Debugging Issues (Modern Tools)

```bash

# Comprehensive health check and diagnostics

python tools/diagnostics/health_check.py

# Real-time performance monitoring

python tools/diagnostics/performance_monitor.py --monitor --duration 120

# Run diagnostic analysis

python tools/diagnostics/health_check.py --diagnostics

# Generate full system report

python tools/diagnostics/health_check.py --report system_report.json

# MCP protocol testing

python scripts/diagnostics/test_mcp_protocol.py

```text

#
# Markdown Guidelines

When creating or editing markdown files, follow these rules to prevent markdownlint warnings:

#
## Structure Rules

- Start files with H1 heading (`
# Title`) on first line (first-line-heading/first-line-h1)

- Use proper heading hierarchy without skipping levels (no-emphasis-as-heading)

- End files with single newline (single-trailing-newline)

#
## Spacing Rules

- Add blank lines before and after headings (blanks-around-headings)

- Add blank lines before and after lists (blanks-around-lists)

- Add blank lines before and after code fences (blanks-around-fences)

#
## List Formatting

- Use consistent ordered list numbering: `1.` for all items (ol-prefix)

- Use `-` for unordered lists consistently (ul-style)

- Start top-level list items at left margin (0 spaces indentation) (ul-indent)

#
## Code Block Guidelines

- Always specify a language for fenced code blocks (fenced-code-language)

- Use `bash`/`shell` for commands, `text` for plain content, `console` for terminal output, `yaml` for configuration, `json` for JSON examples, `python` for Python code

- Add blank lines before and after code blocks (blanks-around-fences)

- When showing code blocks within markdown examples, use indented code blocks (4 spaces) to avoid nesting issues

- Escape special characters in code: use `\_\_init\_\_.py` instead of `__init__.py` to avoid strong formatting

#
## Example

```text
markdown

# Document Title

#
# Section Heading

This is content with proper spacing.

- List item 1

- List item 2

#
# Another Section

1. Ordered item 1

1. Ordered item 2

    
# Indented code block example
    echo "This avoids markdown parsing conflicts"

Final paragraph.

```text

#
## Common Violation Patterns and Solutions

1. **Multiple H1 Headings (MD025)**:
- **Issue**: Using `#` for all major sections
- **Solution**: Use `#` only for document title, then `##`, `###` for subsections
- **Pattern**: `
# Title` → `## Section` → `### Subsection`

2. **Missing Blank Lines (MD022)**:
- **Issue**: Headings touching content without spacing
- **Solution**: Always add blank line before and after headings
- **Pattern**: `content\n\n
# Heading\n\ncontent`

3. **Code Block Language Missing (MD040)**:
- **Issue**: Fenced code blocks without language specification
- **Solution**: Always specify appropriate language tag
- **Common Tags**: `bash`, `python`, `yaml`, `json`, `text`, `console`

4. **Inconsistent List Numbering (MD029)**:
- **Issue**: Using incremental numbering (1., 2., 3.)
- **Solution**: Use `1.` for all ordered list items (markdown auto-numbers)

5. **Trailing Spaces and Line Issues (MD009, MD012, MD047)**:
- **Issue**: Extra spaces at line ends, multiple blank lines, missing final newline
- **Solution**: Remove trailing spaces, use single blank lines, ensure file ends with newline

#
## Quick Fix Commands

```text
bash

# Check all markdown files

markdownlint **/*.md

# Fix specific file

markdownlint filename.md

# Common patterns to search and replace

# Multiple H1s: Replace "
# Section" with "## Section" (except first)

# List numbering: Replace "2. item" with "1. item"

# Trailing spaces: Remove all trailing whitespace

```text

#
# Development Workflow

1. Create feature branch from `main`

2. Write tests first (TDD approach)

3. Implement features incrementally

4. Run full test suite before commits

5. Update documentation as needed

6. Submit PR with clear description

#
# Project-Specific Notes

- Workspace detection looks for `.git`, `package.json`, `pyproject.toml`

- `.task_orchestrator/` directory created in project root

- Custom roles can be defined per-project

- Database stored in workspace-specific location

- Supports multiple concurrent MCP clients

#
# Detailed File Organization Guidelines

#
## Root Directory Guidelines

**Keep the root directory clean**. Only place essential files directly in the repository root:

**Allowed in Root:**

- Core project files: `README.md`, `CHANGELOG.md`, `LICENSE`, `CONTRIBUTING.md`

- Configuration files: `pyproject.toml`, `setup.py`, `requirements.txt`

- Critical documentation: `CLAUDE.md`, `QUICK_START.md`, `TESTING_INSTRUCTIONS.md`

- Build artifacts: `build/`, `dist/`, `*.egg-info/`

**NOT Allowed in Root:**

- Test artifacts (`.json` reports, validation files)

- Migration reports and summaries 

- Temporary documentation

- Individual test files

- Backup files

- Log files

#
## Proper File Placement

**Test Files and Artifacts:**

```text
bash
tests/                          
# All test files
docs/archives/test-artifacts/   
# Test validation reports (*.json)
docs/archives/migration-reports/  
# Migration summaries and reports

```text

**Documentation:**

```text
bash
docs/users/           
# User-facing documentation
docs/developers/      
# Developer/contributor documentation  
docs/archives/        
# Historical docs, migration reports, test artifacts

```text

**Scripts and Tools:**

```text
bash
scripts/             
# Utility scripts organized by purpose
tools/               
# Production diagnostic tools

```text

**Configuration and Data:**

```text
bash
mcp_task_orchestrator/  
# Source code only
archives/               
# Legacy code and historical artifacts
backups/               
# Automatic backups

```text

#
## Automated File Placement

When creating files, follow these patterns:

- **Test outputs**: Always save to `docs/archives/test-artifacts/`

- **Migration reports**: Save to `docs/archives/migration-reports/`

- **Temporary test files**: Create in `tests/` with appropriate subdirectories

- **Documentation drafts**: Create in appropriate `docs/` subdirectory, not root

- **Analysis reports**: Save to `docs/archives/` with descriptive subdirectory names

#
## Examples

```text
bash

# Good ✅

docs/archives/test-artifacts/validation_report_20250707.json
tests/integration/test_new_feature.py
docs/developers/architecture/new-design.md

# Bad ❌  

validation_report.json                    
# Move to docs/archives/test-artifacts/
test_something.py                        
# Move to tests/
MIGRATION_SUMMARY.md                     
# Move to docs/archives/migration-reports/
```text

---

📋 **This file contains comprehensive implementation details. For quick reference and essential commands, see [CLAUDE.md](./CLAUDE.md).**
