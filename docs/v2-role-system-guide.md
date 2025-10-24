# Vespera Scriptorium V2 Role System Guide

---

## ⚠️ IMPLEMENTATION STATUS WARNING

**THIS DOCUMENT DESCRIBES AN UNIMPLEMENTED ROLE SYSTEM**

This guide describes a planned V2 role-based execution system with tool groups and file pattern restrictions that **has not been implemented**. The role system, tool groups, and validation mechanisms described here are aspirational designs.

**Current Reality (Phase 15 - October 2025)**:
- ❌ Tool group-based role system: **NOT IMPLEMENTED**
- ❌ File pattern restrictions: **NOT IMPLEMENTED**
- ❌ Runtime capability validation: **NOT IMPLEMENTED**
- ❌ 10 predefined roles (architect, implementer, etc.): **NOT IMPLEMENTED**
- ✅ Basic role assignment to tasks: **IMPLEMENTED** (without enforcement)
- ✅ `list_roles` MCP tool: **IMPLEMENTED** (returns placeholder data)

**Actual Role System**: Currently roles are metadata-only with no enforcement or restrictions

**This document is preserved for reference and future security architecture design.**

---

## Overview

The V2 Role System provides capability-restricted execution inspired by Roo Code's tool group architecture. Instead of granular permissions, roles organize capabilities into logical tool groups with file pattern restrictions for enhanced security and workflow organization.

## Architecture Principles

### Tool Groups Over Individual Capabilities
V2 replaces individual capability flags with coherent tool groups that represent logical workflow categories.

### File Pattern Restrictions
Roles can restrict file access using regex patterns, ensuring team members work within appropriate boundaries.

### Runtime Validation
All role assignments and executions are validated at runtime to prevent capability violations.

---

## Tool Groups

### 📖 READ
**Purpose**: Information gathering and file reading  
**Capabilities**:
- Read files and directories
- Search and grep operations
- List directory contents
- View git status and logs
- Browse documentation

**Use Cases**: Research, analysis, code review, documentation reading

---

### ✏️ EDIT  
**Purpose**: File modification and content creation  
**Capabilities**:
- Create, modify, and delete files
- Edit existing content
- MultiEdit operations
- File organization and restructuring

**Use Cases**: Code implementation, documentation writing, configuration updates

**Security Note**: Often combined with file pattern restrictions to limit edit scope

---

### ⚡ COMMAND
**Purpose**: Shell command execution  
**Capabilities**:
- Execute bash commands
- Run build and test scripts
- Perform system operations
- Git operations (commit, push, pull)
- Package management (pip, npm, etc.)

**Use Cases**: Build processes, testing, deployment, system administration

**Security Note**: Most powerful group - use with careful role design

---

### 🌐 BROWSER
**Purpose**: Web browsing and external research  
**Capabilities**:
- Fetch web content
- Navigate websites
- Download external resources
- API interactions
- Web search operations

**Use Cases**: Research, external documentation, API integration, market analysis

---

### 🔗 MCP
**Purpose**: MCP tool integration and coordination  
**Capabilities**:
- Access other MCP servers
- Cross-system coordination
- Tool chain integration
- External service connections

**Use Cases**: Multi-tool workflows, service orchestration, system integration

---

### 🎯 COORDINATION
**Purpose**: Cross-system orchestration and workflow management  
**Capabilities**:
- Task delegation
- Workflow coordination
- Team communication
- Progress tracking
- Resource allocation

**Use Cases**: Project management, team coordination, complex workflow orchestration

---

## Predefined Roles

### 🏗️ architect
**Tool Groups**: `READ`, `EDIT`  
**File Restrictions**: 
- `.*\.md$` (Markdown files)
- `docs/.*` (Documentation directories)
- `.*\.yaml$` (Configuration files)

**Responsibilities**:
- System design and architecture
- Documentation creation and maintenance
- Configuration management
- Technical specifications

**File Access**: Limited to documentation and configuration files for security

---

### 👨‍💻 implementer
**Tool Groups**: `READ`, `EDIT`, `COMMAND`  
**File Restrictions**: 
- `.*\.(py|js|ts|java|cpp|c|h)$` (Source code files)
- `src/.*` (Source directories)
- `lib/.*` (Library directories)

**Responsibilities**:
- Feature implementation
- Code development
- Bug fixes
- Technical debt reduction

**File Access**: Source code and development directories only

---

### 🧪 tester
**Tool Groups**: `READ`, `COMMAND`  
**File Restrictions**:
- `.*test.*` (Test files)
- `spec/.*` (Specification directories)
- `.*\.(test|spec)\.(py|js|ts)$` (Test files)

**Responsibilities**:
- Quality assurance
- Test automation
- Bug verification
- Performance testing

**File Access**: Test files and specifications only, cannot modify source code

---

### 📝 documenter
**Tool Groups**: `READ`, `EDIT`  
**File Restrictions**:
- `.*\.md$` (Markdown files)
- `docs/.*` (Documentation directories)
- `README.*` (README files)

**Responsibilities**:
- Documentation creation
- User guides and tutorials
- API documentation
- Knowledge base maintenance

**File Access**: Documentation files only

---

### 🔍 researcher
**Tool Groups**: `READ`, `BROWSER`  
**File Restrictions**: None (read-only across all files)

**Responsibilities**:
- Market research
- Technology analysis
- Competitive intelligence
- Requirements gathering

**File Access**: Read-only access to all files, plus web browsing capabilities

---

### 👁️ reviewer
**Tool Groups**: `READ`  
**File Restrictions**: None (read-only across all files)

**Responsibilities**:
- Code review
- Quality control
- Standards compliance
- Security review

**File Access**: Read-only access for thorough review without modification risk

---

### 🤝 coordinator
**Tool Groups**: `READ`, `MCP`, `COORDINATION`  
**File Restrictions**: 
- `.*\.(yaml|json|config)$` (Configuration files)
- `project/.*` (Project management files)

**Responsibilities**:
- Project coordination
- Cross-team communication
- Workflow orchestration
- Resource allocation

**File Access**: Configuration and project management files

---

### ⚡ optimizer
**Tool Groups**: `READ`, `EDIT`, `COMMAND`  
**File Restrictions**:
- `.*\.(py|js|ts|yaml|json)$` (Code and config files)
- `perf/.*` (Performance directories)

**Responsibilities**:
- Performance optimization
- Resource efficiency
- Build optimization
- System tuning

**File Access**: Code and configuration files for optimization work

---

### 🔧 troubleshooter
**Tool Groups**: `READ`, `COMMAND`, `BROWSER`  
**File Restrictions**: None (broad access needed for debugging)

**Responsibilities**:
- Issue diagnosis
- Bug investigation
- System debugging
- Problem resolution

**File Access**: Broad read access plus command execution for comprehensive debugging

---

### 📊 analyst
**Tool Groups**: `READ`, `BROWSER`  
**File Restrictions**:
- `data/.*` (Data directories)
- `reports/.*` (Report directories)
- `.*\.(csv|json|yaml)$` (Data files)

**Responsibilities**:
- Data analysis
- Reporting
- Metrics collection
- Trend analysis

**File Access**: Data and reporting files

---

## Role Configuration

### Role Definition Structure
```yaml
role_name:
  tool_groups:
    - READ
    - EDIT
    - COMMAND
  file_restrictions:
    - "pattern1"
    - "pattern2"
  description: "Role description"
```

### Example: Custom DevOps Role
```yaml
devops:
  tool_groups:
    - READ
    - EDIT
    - COMMAND
    - BROWSER
  file_restrictions:
    - ".*\.(yaml|yml|json|toml)$"    # Configuration files
    - "docker/.*"                     # Docker files
    - "k8s/.*"                       # Kubernetes manifests
    - ".github/workflows/.*"         # CI/CD workflows
    - "scripts/.*"                   # Deployment scripts
  description: "DevOps and infrastructure management"
```

---

## File Pattern Restrictions

### Pattern Syntax
Uses Python regex patterns for maximum flexibility:

```yaml
file_restrictions:
  - ".*\\.py$"           # Python files only
  - "src/.*"             # Anything in src directory
  - ".*test.*"           # Files containing 'test'
  - "docs/.*\\.md$"      # Markdown files in docs
  - "^config/.*"         # Files starting with config/
```

### Common Patterns
```yaml
# Source code files
- ".*\\.(py|js|ts|java|cpp|c|h)$"

# Documentation files  
- ".*\\.(md|rst|txt)$"

# Configuration files
- ".*\\.(yaml|yml|json|toml|ini)$"

# Test files
- ".*\\.test\\.(py|js|ts)$"
- "test_.*\\.py$"
- ".*_test\\.go$"

# Specific directories
- "src/.*"              # Source directory
- "docs/.*"             # Documentation directory
- "tests?/.*"           # Test directories (test or tests)
- "config/.*"           # Configuration directory

# Multiple extensions
- ".*\\.(png|jpg|gif|svg)$"    # Image files
- ".*\\.(html|css|scss)$"      # Web files
```

### Security Considerations
- **Principle of Least Privilege**: Grant minimal file access required
- **Directory Boundaries**: Use directory patterns to contain access
- **File Type Restrictions**: Limit to relevant file types
- **No Unrestricted Access**: Avoid empty file_restrictions unless necessary

---

## Runtime Validation

### Assignment Validation
When assigning roles to tasks:
1. **Role Exists**: Verify role is defined in role templates
2. **Tool Group Compatibility**: Check role has required tool groups for task type
3. **File Access Validation**: Ensure role can access relevant files

### Execution Validation  
During task execution:
1. **Capability Check**: Verify required tool groups are available
2. **File Pattern Matching**: Validate file access against restrictions
3. **Runtime Enforcement**: Block operations that violate role constraints

### Error Handling
```json
{
  "error": "ROLE_VALIDATION_ERROR",
  "message": "Role 'tester' cannot edit source files",
  "details": {
    "role": "tester",
    "attempted_file": "src/main.py", 
    "allowed_patterns": [".*test.*", "spec/.*"],
    "suggested_roles": ["implementer", "optimizer"]
  }
}
```

---

## Custom Role Creation

### 1. Define Role Template
Create or modify `roles/templates/enhanced_roles.yaml`:

```yaml
custom_role:
  tool_groups:
    - READ
    - EDIT
  file_restrictions:
    - "custom/.*"
    - ".*\\.custom$"
  description: "Custom role for specific workflows"
```

### 2. Test Role Definition
```bash
python test_role_system.py
```

### 3. Assign to Tasks
```python
# Via MCP tool
assign_role_to_task(task_id="task_123", role_name="custom_role")
```

### 4. Validate in Practice
Monitor role execution and adjust restrictions as needed.

---

## Best Practices

### Role Design
- **Single Responsibility**: Each role should have a clear, focused purpose
- **Minimal Permissions**: Grant only necessary tool groups and file access
- **Logical Groupings**: Organize tool groups that make sense together
- **Clear Boundaries**: Use file patterns to create clear work boundaries

### File Restrictions
- **Start Restrictive**: Begin with tight restrictions and loosen as needed
- **Use Directory Patterns**: Prefer directory-based restrictions for clarity
- **Test Thoroughly**: Validate patterns match intended files
- **Document Patterns**: Comment complex regex patterns for maintainability

### Team Workflows
- **Role Consistency**: Use consistent role assignments across similar tasks
- **Clear Communication**: Document role responsibilities and limitations
- **Regular Review**: Periodically review and update role definitions
- **Training**: Ensure team understands role system and constraints

### Security Guidelines
- **No Admin Roles**: Avoid roles with unrestricted access
- **Audit Trail**: Monitor role assignments and execution patterns
- **Principle of Least Privilege**: Default to minimal access requirements
- **Separation of Concerns**: Use different roles for different workflow phases

---

## Troubleshooting

### Common Issues

#### Role Assignment Failures
```
Error: Role 'implementer' cannot be assigned to documentation task
Solution: Use 'documenter' role for documentation tasks
```

#### File Access Violations
```
Error: Role 'tester' attempted to edit src/main.py
Solution: Assign 'implementer' role for source code modifications
```

#### Missing Tool Groups
```
Error: Role 'reviewer' lacks COMMAND tool group for test execution
Solution: Create specialized 'test_runner' role or modify reviewer permissions
```

### Debugging Role Issues
1. **Check Role Definition**: Verify role exists in templates
2. **Validate Patterns**: Test file restrictions with sample paths
3. **Tool Group Alignment**: Ensure role has required capabilities
4. **Task Type Compatibility**: Match role capabilities to task requirements

---

## Migration & Compatibility

### V1 to V2 Migration
- **No Automatic Migration**: V2 roles are incompatible with V1 capabilities
- **Fresh Start**: Reassign roles using V2 system
- **Pattern Conversion**: Convert V1 file permissions to V2 patterns
- **Tool Group Mapping**: Map V1 capabilities to V2 tool groups

### Future Compatibility
- **Stable Interface**: Role definition format designed for longevity
- **Extensible Design**: New tool groups can be added without breaking existing roles
- **Backward Compatibility**: Role templates maintain compatibility across V2 updates

---

The V2 Role System provides powerful, flexible, and secure workflow management while maintaining simplicity and clarity for everyday use. By organizing capabilities into logical tool groups and enforcing file access boundaries, teams can work confidently within their designated responsibilities while maintaining system security and workflow integrity.