# Vespera Atelier Documentation Implementation Guide

*Free, Open Source Documentation Strategy for Solo Developers*

## Project Context

- **Project**: Vespera Atelier (AGPL-3.0)
- **Component**: Vespera Scriptorium (task orchestration & RAG assistant)
- **Goal**: Professional documentation with $0 budget
- **Philosophy**: Open source, copyleft, community-driven

## 🚨 **ARCHITECTURAL REALITY CHECK (Updated 2025-01-09)**

**CRITICAL**: This guide has been updated to reflect the actual implementation status of Vespera Atelier systems vs. documented aspirational architecture.

### ✅ **IMPLEMENTED & DOCUMENTED SYSTEMS**
- **Hook Agent System**: Fully operational template-driven automation with 7 MCP tools
- **Task Orchestration System**: Complete task management with hierarchical relationships, role-based execution
- **MCP Server V2**: 30+ tools for comprehensive project management via Claude Code integration
- **Background Task Execution**: Non-blocking agent spawning and execution tracking

### ⚠️ **PARTIALLY IMPLEMENTED SYSTEMS**  
- **Dynamic Automation Architecture**: Hook agents operational, but automation engine, events system, and tag-driven automation are planned features
- **Role-Based Execution**: Core role system implemented, template integration planned

### 📋 **PLANNED/THEORETICAL SYSTEMS**
- **Codex Architecture**: Universal content system (.codex.md files) - architectural design complete, implementation planned
- **Template System V2**: User-extensible .json5 templates - V1 archived, V2 redesign in planning
- **Cross-Template Automation Chains**: Depends on Codex + Template system implementation

**Documentation Strategy**: Clearly distinguish between implemented features (ready to document), partially implemented (document with caveats), and planned features (architectural documentation only).

### 🔧 **CURRENT MCP TOOLS AVAILABLE**

The Vespera Scriptorium V2 MCP Server provides **30+ tools** through Claude Code integration:

#### **Task Management Tools (14 tools)**
- `create_task`, `get_task`, `update_task`, `delete_task` - Basic task CRUD
- `create_task_tree`, `get_task_tree` - Hierarchical task structures  
- `execute_task`, `complete_task` - Task execution lifecycle
- `assign_role_to_task`, `list_roles` - Role-based execution
- `add_task_dependency`, `analyze_task_dependencies` - Task relationships
- `get_task_dashboard`, `list_tasks` - Status and metrics

#### **Hook Agent System Tools (7 tools)** ✅ FULLY OPERATIONAL
- `register_hook_agent` - Register hook agents from template automation rules
- `register_timed_agent` - Register timed agents from template schedules  
- `trigger_hook_agent` - Manually trigger hook agent execution
- `get_hook_agent_status` - Get status of all hook and timed agents
- `pause_timed_agent`, `resume_timed_agent` - Timed agent control
- `get_comprehensive_agent_status` - Detailed metrics

#### **File Operations & Context Tools (9+ tools)**
- High-performance file operations with automatic artifact creation
- Project info and context management
- RAG system integration and search

#### **Documentation-Specific MCP Tools (Planned)**
The MCP tools defined in this guide (`docs/audit`, `docs/generate`, `docs/update_batch`, `docs/build`, `docs/analyze_content`) represent the **planned documentation integration**. These are not yet implemented but provide the blueprint for Phase 4 integration.

## Phase 1: Foundation Setup (Week 1)

### Core Technology Stack (100% Free)

```bash
# Install in project venv (no sudo required!)
cd vespera-atelier
source venv/bin/activate  # or your venv activation method

# Documentation Platform
pip install mkdocs mkdocs-material mkdocs-mermaid2-plugin

# Style & Quality Tools (Python alternatives to avoid npm global installs)
pip install textlint-py write-good-py vale-python

# Development Environment Extensions (VS Code)
# - Markdown All in One
# - markdownlint
# - Code Spell Checker
# - Mermaid Preview
```

### Project Dependencies (`requirements.txt` additions)

```txt
# Documentation tools
mkdocs>=1.5.0
mkdocs-material>=9.0.0
mkdocs-mermaid2-plugin>=1.0.0
textlint-py>=0.3.0
vale-python>=3.0.0
```

### Repository Structure

```
vespera-atelier/
├── docs/                          # MkDocs documentation root
│   ├── index.md                   # Project overview
│   ├── getting-started/           # User onboarding
│   ├── development/               # Developer guides
│   ├── api/                       # API documentation
│   ├── architecture/              # Technical architecture
│   └── assets/                    # Images, diagrams
├── mkdocs.yml                     # MkDocs configuration
├── .github/
│   └── workflows/
│       └── docs.yml               # Auto-deploy to GitHub Pages
├── .vale.ini                      # Style guide enforcement
├── docs-standards/                # Documentation governance
│   ├── STYLE_GUIDE.md            # Writing standards
│   ├── TEMPLATES/                 # Content templates
│   └── LEGAL_GUIDELINES.md       # Risk mitigation
└── scripts/
    └── docs-update.py             # Batch documentation updates
```

## Phase 2: Configuration Files

### MkDocs Configuration (`mkdocs.yml`)

```yaml
site_name: Vespera Atelier
site_description: Task orchestration and RAG assistant toolkit
site_url: https://echoingvesper.github.io/vespera-atelier/
repo_url: https://github.com/EchoingVesper/vespera-atelier
repo_name: EchoingVesper/vespera-atelier
edit_uri: edit/main/docs/

theme:
  name: material
  palette:
    - media: "(prefers-color-scheme: light)"
      scheme: default
      primary: deep purple
      accent: purple
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    - media: "(prefers-color-scheme: dark)"
      scheme: slate
      primary: deep purple
      accent: purple
      toggle:
        icon: material/brightness-4
        name: Switch to light mode
  features:
    - navigation.tabs
    - navigation.sections
    - navigation.expand
    - navigation.top
    - search.suggest
    - search.highlight
    - content.code.copy

plugins:
  - search
  - mermaid2

markdown_extensions:
  - abbr
  - admonition
  - attr_list
  - def_list
  - footnotes
  - md_in_html
  - toc:
      permalink: true
  - pymdownx.arithmatex:
      generic: true
  - pymdownx.betterem:
      smart_enable: all
  - pymdownx.caret
  - pymdownx.details
  - pymdownx.highlight:
      anchor_linings: true
  - pymdownx.inlinehilite
  - pymdownx.keys
  - pymdownx.magiclink:
      repo_url_shorthand: true
      user: EchoingVesper
      repo: vespera-atelier
  - pymdownx.mark
  - pymdownx.smartsymbols
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
  - pymdownx.tabbed:
      alternate_style: true
  - pymdownx.tasklist:
      custom_checkbox: true
  - pymdownx.tilde

nav:
  - Home: index.md
  - Getting Started:
    - Overview: getting-started/overview.md
    - Installation: getting-started/installation.md
    - Quick Start: getting-started/quick-start.md
  - Vespera Scriptorium:
    - Overview: scriptorium/overview.md
    - MCP Server: scriptorium/mcp-server.md
    - RAG Assistant: scriptorium/rag-assistant.md
    - Task Orchestration: scriptorium/task-orchestration.md
  - Development:
    - Contributing: development/contributing.md
    - Architecture: development/architecture.md
    - API Reference: development/api-reference.md
  - Legal: legal/license.md
```

### Style Guide Configuration (`.vale.ini`)

```ini
StylesPath = docs-standards/vale-styles
MinAlertLevel = suggestion

[*.md]
BasedOnStyles = Vale, write-good
vale.Avoid = YES
vale.Repetition = YES
vale.Passive = YES

# Custom rules for Vespera project
[*.{md,rst}]
vespera.Terms = YES
vespera.Tone = YES
```

### GitHub Actions Workflow (`.github/workflows/docs.yml`)

```yaml
name: Deploy Documentation
on:
  push:
    branches: [ main ]
    paths: [ 'docs/**', 'mkdocs.yml' ]
  pull_request:
    paths: [ 'docs/**', 'mkdocs.yml' ]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.x'
        
    - name: Install dependencies
      run: |
        pip install mkdocs-material mkdocs-mermaid2-plugin
        
    - name: Build documentation
      run: mkdocs build --strict
      
    - name: Upload Pages artifact
      uses: actions/upload-pages-artifact@v2
      with:
        path: ./site

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
    - name: Deploy to GitHub Pages
      id: deployment
      uses: actions/deploy-pages@v2
```

## Phase 3: Content Standards & Templates

### Vespera Style Guide (`docs-standards/STYLE_GUIDE.md`)

```markdown
# Vespera Atelier Documentation Style Guide

## Voice & Tone
- **Inclusive**: Use accessible language for diverse technical backgrounds
- **Empowering**: Help users succeed, don't intimidate
- **Open**: Encourage contribution and collaboration
- **Precise**: Technical accuracy without unnecessary jargon

## Content Structure (Diátaxis Framework)
- **Tutorials**: Step-by-step learning paths
- **How-to Guides**: Problem-solving instructions  
- **Reference**: Technical specifications and API docs
- **Explanation**: Conceptual understanding

## Writing Standards
- Use sentence case for headings
- Write in active voice
- Use "you" to address the reader
- Include code examples for all procedures
- Provide both CLI and programmatic examples where applicable

## Legal-Safe Language
❌ Avoid: "guaranteed", "bulletproof", "enterprise-grade", "production-ready"
✅ Use: "designed for", "aims to provide", "typically performs", "intended for"

## Markdown Conventions
- Use ATX-style headings (`#` syntax)
- Include alt text for all images
- Use descriptive link text (not "click here")
- Format code with appropriate syntax highlighting
```

### Content Templates

#### API Documentation Template

```markdown
---
title: API Method Name
category: reference
complexity: beginner|intermediate|advanced
last_updated: YYYY-MM-DD
---

# API Method Name

## Purpose
Brief description of what this method accomplishes.

## Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| param1    | str  | Yes      | Description |

## Request Example
```python
# Code example here
```

## Response Format

```json
{
  "example": "response"
}
```

## Error Handling

Common error codes and their meanings.

## Related Methods

- [Related Method 1](./related-method.md)
- [Related Method 2](./related-method.md)

```

#### Tutorial Template
```markdown
---
title: Tutorial Title
category: tutorial
difficulty: beginner
time_estimate: "15 minutes"
prerequisites: ["basic-python", "git-basics"]
---

# Tutorial Title

## What You'll Learn
- Objective 1
- Objective 2
- Objective 3

## Prerequisites
- [Prerequisite 1](./link)
- [Prerequisite 2](./link)

## Step 1: Setup
Clear, actionable instructions.

```bash
# Command examples
```

## Step 2: Implementation

Detailed walkthrough.

## Validation

How to verify the tutorial worked.

## Next Steps

- [Related Tutorial](./link)
- [Advanced Guide](./link)

```

## Phase 3B: Current System Integration (IMPLEMENTED)

### Hook Agent System Documentation

**✅ FULLY IMPLEMENTED**: The template-driven hook agent system is operational and should be documented as a core Vespera Atelier capability.

#### Key Documentation Areas

**Hook Agent Architecture** (`docs/technical/HOOK_AGENT_SYSTEM_IMPLEMENTATION.md`)
- ✅ Complete and accurate - can be used as authoritative reference
- Documents 824 lines of production-ready implementation
- Covers TemplateContext, HookAgentDefinition, TimedAgentDefinition classes
- Real Claude Code agent spawning via BackgroundTaskExecutionManager

**MCP Integration Guide**
```bash
# Available Hook Agent MCP Tools via Claude Code
mcp__vespera-scriptorium__register_hook_agent      # From template automation rules
mcp__vespera-scriptorium__register_timed_agent     # Scheduled template agents  
mcp__vespera-scriptorium__trigger_hook_agent       # Manual execution
mcp__vespera-scriptorium__get_hook_agent_status    # System status
mcp__vespera-scriptorium__pause_timed_agent        # Control timed agents
mcp__vespera-scriptorium__resume_timed_agent       # Resume paused agents
mcp__vespera-scriptorium__get_comprehensive_agent_status  # Detailed metrics
```

**Template-Driven Automation Examples** 
- Pre-task setup hooks (git worktree creation)
- Post-task documentation updates
- Scheduled standup preparation agents
- Cross-template automation chains (when template system V2 is implemented)

**Performance Characteristics** (Documented Metrics)
- Agent spawn time: <100ms simple hooks, <500ms complex
- Memory footprint: <50MB per active agent  
- Background processing: Non-blocking with priority queuing
- Real-time status updates every 30 seconds

### Current Task Orchestration System

**✅ FULLY IMPLEMENTED**: V2 task management system with 14 MCP tools

**Documentation Priority Topics**:
- Hierarchical task trees with parent-child relationships
- Role-based execution with capability restrictions
- Task dependency analysis and management
- Real-time dashboard with metrics and progress tracking
- Integration with hook agent system for automation

## Phase 4: Vespera Scriptorium MCP Integration (PLANNED)

### MCP Documentation Server Architecture

**🚧 IMPLEMENTATION STATUS: PLANNED/DESIGN PHASE**

This section defines the **planned integration** of documentation management as first-class MCP tools in the Vespera Scriptorium V2 system. The tools described below are **design blueprints** for future implementation, building on the existing MCP architecture that currently supports 30+ tools for task management, hook agents, and file operations.

The Vespera Scriptorium should integrate documentation management as first-class MCP tools. This transforms documentation from a separate process into a core development capability.

#### Core MCP Tools Definition
```python
#!/usr/bin/env python3
"""
Vespera Scriptorium: Documentation MCP Server Extension
Integrate documentation management into the RAG-assisted development workflow.
"""

import asyncio
import subprocess
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
import tempfile

class DocumentationMCP:
    """MCP tools for intelligent documentation management"""
    
    def __init__(self, project_root: Path, rag_context: Any = None):
        self.project_root = project_root
        self.docs_path = project_root / "docs"
        self.rag = rag_context  # Your existing RAG system
        
    @mcp_tool("docs/audit")
    async def audit_documentation(
        self, 
        path: str = "docs/",
        include_suggestions: bool = True
    ) -> Dict[str, Any]:
        """
        Comprehensive documentation audit with RAG-enhanced insights.
        
        Args:
            path: Directory to audit (relative to project root)
            include_suggestions: Whether to include AI-generated improvement suggestions
            
        Returns:
            Audit report with issues, metrics, and recommendations
        """
        audit_path = self.project_root / path
        issues = []
        metrics = {}
        
        # Basic compliance checks
        for md_file in audit_path.rglob("*.md"):
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
            
            # Legal risk detection
            risky_terms = [
                'guaranteed', 'bulletproof', 'never fails', 'enterprise-grade',
                'production-ready', '100% secure', 'completely safe'
            ]
            
            for i, line in enumerate(lines, 1):
                for term in risky_terms:
                    if term.lower() in line.lower():
                        issues.append({
                            'file': str(md_file.relative_to(self.project_root)),
                            'line': i,
                            'type': 'legal_risk',
                            'severity': 'high',
                            'description': f'Contains risky term: "{term}"',
                            'suggestion': 'Replace with descriptive, non-warranty language'
                        })
            
            # Style guide compliance
            if not content.startswith('---'):
                issues.append({
                    'file': str(md_file.relative_to(self.project_root)),
                    'line': 1,
                    'type': 'missing_frontmatter',
                    'severity': 'medium',
                    'description': 'Missing YAML frontmatter',
                    'suggestion': 'Add metadata header with title, category, etc.'
                })
        
        # RAG-enhanced analysis (if available)
        if self.rag and include_suggestions:
            rag_insights = await self._get_rag_insights(audit_path)
            issues.extend(rag_insights.get('issues', []))
            metrics.update(rag_insights.get('metrics', {}))
        
        return {
            'timestamp': datetime.now().isoformat(),
            'path_audited': path,
            'total_files': len(list(audit_path.rglob("*.md"))),
            'issues_found': len(issues),
            'issues': issues,
            'metrics': metrics,
            'recommendations': await self._generate_recommendations(issues)
        }
    
    @mcp_tool("docs/generate")
    async def generate_documentation(
        self,
        doc_type: str,
        title: str,
        output_path: str,
        context: Optional[str] = None,
        auto_populate: bool = True
    ) -> Dict[str, Any]:
        """
        Generate documentation from templates with RAG enhancement.
        
        Args:
            doc_type: Type of documentation (api, tutorial, howto, reference)
            title: Document title
            output_path: Where to save the file (relative to docs/)
            context: Additional context for content generation
            auto_populate: Whether to use RAG to pre-populate content
            
        Returns:
            Generation result with file path and content preview
        """
        templates = {
            "api": self._get_api_template(),
            "tutorial": self._get_tutorial_template(),
            "howto": self._get_howto_template(),
            "reference": self._get_reference_template()
        }
        
        if doc_type not in templates:
            raise ValueError(f"Unknown template type: {doc_type}. Available: {list(templates.keys())}")
        
        template = templates[doc_type]
        
        # RAG-enhanced content population
        if auto_populate and self.rag:
            enhanced_content = await self._enhance_template_with_rag(
                template, title, context, doc_type
            )
        else:
            enhanced_content = template.format(
                title=title,
                date=datetime.now().strftime("%Y-%m-%d")
            )
        
        # Save the file
        full_output_path = self.docs_path / output_path
        full_output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(full_output_path, 'w', encoding='utf-8') as f:
            f.write(enhanced_content)
        
        return {
            'doc_type': doc_type,
            'title': title,
            'file_path': str(full_output_path.relative_to(self.project_root)),
            'content_preview': enhanced_content[:500] + "..." if len(enhanced_content) > 500 else enhanced_content,
            'auto_populated': auto_populate and self.rag is not None
        }
    
    @mcp_tool("docs/update_batch")
    async def batch_update_documentation(
        self,
        updates: List[Dict[str, str]],
        dry_run: bool = True,
        backup: bool = True
    ) -> Dict[str, Any]:
        """
        Apply batch updates to documentation with safety checks.
        
        Args:
            updates: List of {pattern, replacement, files} dictionaries
            dry_run: Preview changes without applying them
            backup: Create backup before applying changes
            
        Returns:
            Update results with files modified and changes made
        """
        results = {
            'dry_run': dry_run,
            'backup_created': False,
            'files_affected': [],
            'changes_made': 0,
            'warnings': []
        }
        
        # Create backup if requested and not dry run
        if backup and not dry_run:
            backup_path = await self._create_docs_backup()
            results['backup_path'] = str(backup_path)
            results['backup_created'] = True
        
        for update in updates:
            pattern = update.get('pattern')
            replacement = update.get('replacement')
            file_pattern = update.get('files', '*.md')
            
            # RAG validation of changes
            if self.rag:
                validation = await self._validate_change_with_rag(pattern, replacement)
                if validation.get('risk_level') == 'high':
                    results['warnings'].append(f"High-risk change detected: {validation['reason']}")
                    continue
            
            # Apply changes
            for md_file in self.docs_path.rglob(file_pattern):
                if await self._apply_update_to_file(md_file, pattern, replacement, dry_run):
                    results['files_affected'].append(str(md_file.relative_to(self.project_root)))
                    results['changes_made'] += 1
        
        return results
    
    @mcp_tool("docs/build")
    async def build_documentation(
        self,
        serve_locally: bool = False,
        validate_links: bool = True
    ) -> Dict[str, Any]:
        """
        Build and optionally serve documentation with validation.
        
        Args:
            serve_locally: Start local development server after build
            validate_links: Check for broken links
            
        Returns:
            Build results with status, warnings, and server info
        """
        build_result = {
            'build_success': False,
            'warnings': [],
            'errors': [],
            'server_running': False,
            'server_url': None
        }
        
        try:
            # Run MkDocs build
            process = await asyncio.create_subprocess_exec(
                'mkdocs', 'build', '--strict',
                cwd=self.project_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                build_result['build_success'] = True
            else:
                build_result['errors'].append(stderr.decode())
                return build_result
            
            # Run style validation
            style_results = await self._run_style_validation()
            build_result['style_warnings'] = style_results
            
            # Validate links if requested
            if validate_links:
                link_results = await self._validate_links()
                build_result['link_validation'] = link_results
            
            # Start local server if requested
            if serve_locally:
                server_info = await self._start_local_server()
                build_result.update(server_info)
            
        except Exception as e:
            build_result['errors'].append(str(e))
        
        return build_result
    
    @mcp_tool("docs/analyze_content")
    async def analyze_content_gaps(
        self,
        compare_with_code: bool = True
    ) -> Dict[str, Any]:
        """
        Analyze documentation for content gaps using RAG insights.
        
        Args:
            compare_with_code: Whether to compare docs with actual codebase
            
        Returns:
            Analysis of missing content, outdated sections, and recommendations
        """
        if not self.rag:
            return {'error': 'RAG system required for content gap analysis'}
        
        analysis = {
            'missing_api_docs': [],
            'outdated_content': [],
            'knowledge_gaps': [],
            'recommendations': []
        }
        
        # Analyze codebase vs documentation coverage
        if compare_with_code:
            code_analysis = await self._analyze_code_coverage()
            analysis['code_coverage'] = code_analysis
        
        # Use RAG to identify conceptual gaps
        content_analysis = await self._rag_content_analysis()
        analysis.update(content_analysis)
        
        return analysis
    
    # Helper methods
    async def _get_rag_insights(self, path: Path) -> Dict:
        """Use RAG to provide enhanced documentation insights"""
        # Implementation depends on your RAG system
        return {'issues': [], 'metrics': {}}
    
    async def _enhance_template_with_rag(
        self, template: str, title: str, context: str, doc_type: str
    ) -> str:
        """Use RAG to auto-populate template content"""
        # Your RAG can analyze existing patterns and suggest content
        enhanced = template.format(
            title=title,
            date=datetime.now().strftime("%Y-%m-%d")
        )
        return enhanced
    
    async def _generate_recommendations(self, issues: List) -> List[str]:
        """Generate actionable recommendations from audit issues"""
        recommendations = []
        
        if any(issue['type'] == 'legal_risk' for issue in issues):
            recommendations.append("Review and update legal disclaimers")
            recommendations.append("Replace warranty language with descriptive terms")
        
        if any(issue['type'] == 'missing_frontmatter' for issue in issues):
            recommendations.append("Add YAML frontmatter to all documentation files")
        
        return recommendations
    
    def _get_api_template(self) -> str:
        return """---
title: {title}
category: reference
complexity: beginner
last_updated: {date}
---

# {title}

## Purpose
Brief description of what this API method accomplishes.

## Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|

## Request Example
```python
# Add example usage here
```

## Response Format

```json
{{
  "status": "success"
}}
```

## Error Handling

Document common error scenarios and responses.

## Related Methods

- [Related method](./related.md)
"""

    def _get_tutorial_template(self) -> str:
        return """---
title: {title}
category: tutorial
difficulty: beginner
time_estimate: "X minutes"
prerequisites: []
last_updated: {date}

---

# {title}

## What You'll Learn

- Learning objective 1
- Learning objective 2

## Prerequisites

- [Prerequisite](./link)

## Step 1: Setup

Provide setup instructions and context.

## Step 2: Implementation

Clear, actionable steps with code examples.

## Validation

How to verify the tutorial worked correctly.

## Next Steps

- [Related tutorial](./link)
- [Advanced guide](./link)
"""

    def _get_howto_template(self) -> str:
        return """---
title: {title}
category: how-to
difficulty: intermediate
last_updated: {date}

---

# How to {title}

## Problem

Describe the specific problem this guide solves.

## Solution Overview

High-level approach and strategy.

## Implementation Steps

### 1. Preparation

What you need before starting.

### 2. Implementation

Step-by-step instructions with examples.

### 3. Verification

How to confirm the solution worked.

## Troubleshooting

Common issues and their solutions.

## Related Guides

- [Related guide](./link)
"""

    def _get_reference_template(self) -> str:
        return """---
title: {title}
category: reference
last_updated: {date}

---

# {title} Reference

## Overview

Brief description of this reference material.

## Syntax

```
# Basic syntax or usage pattern
```

## Parameters/Options

Detailed parameter documentation.

## Examples

Practical usage examples.

## See Also

- [Related reference](./link)
"""

# Usage in Claude Code

async def setup_documentation_mcp(project_root: Path, rag_system = None):
    """Initialize documentation MCP tools for vespera-scriptorium"""
    docs_mcp = DocumentationMCP(project_root, rag_system)

    # Register MCP tools
    register_mcp_tool("docs/audit", docs_mcp.audit_documentation)
    register_mcp_tool("docs/generate", docs_mcp.generate_documentation)  
    register_mcp_tool("docs/update_batch", docs_mcp.batch_update_documentation)
    register_mcp_tool("docs/build", docs_mcp.build_documentation)
    register_mcp_tool("docs/analyze", docs_mcp.analyze_content_gaps)
    
    return docs_mcp

```

### Claude Code Integration Commands

Once integrated into your Vespera Scriptorium MCP server, you'll have these commands available in Claude Code:

```bash
# Audit all documentation for issues
@scriptorium docs/audit --include-suggestions true

# Generate new API documentation with auto-population
@scriptorium docs/generate api "User Authentication API" api/auth.md --auto-populate true

# Batch update risky legal language across all docs
@scriptorium docs/update_batch '[{"pattern": "guaranteed", "replacement": "designed to provide"}]' --dry-run false

# Build documentation and start local server for editing
@scriptorium docs/build --serve-locally true --validate-links true

# Analyze content gaps compared to codebase
@scriptorium docs/analyze --compare-with-code true
```

## Phase 5: Automated Documentation Workflows

### Standalone Scripts (Alternative to MCP Integration)

If you prefer to start with standalone scripts before full MCP integration:

#### 1. Standalone Content Audit Tool

```python
#!/usr/bin/env python3
"""
Standalone Documentation Audit Tool
Can be integrated into Vespera Scriptorium MCP later
"""

from pathlib import Path
import json
from datetime import datetime

def audit_documentation_standalone(docs_path: Path = Path("docs")) -> dict:
    """Standalone version of documentation audit"""
    issues = []
    
    risky_terms = [
        'guaranteed', 'bulletproof', 'never fails', 'enterprise-grade',
        'production-ready', '100% secure', 'completely safe'
    ]
    
    for md_file in docs_path.rglob("*.md"):
        with open(md_file, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')
            
        for i, line in enumerate(lines, 1):
            for term in risky_terms:
                if term.lower() in line.lower():
                    issues.append({
                        'file': str(md_file.relative_to(docs_path.parent)),
                        'line': i,
                        'type': 'legal_risk',
                        'description': f'Contains risky term: "{term}"',
                        'suggestion': 'Replace with descriptive, non-warranty language'
                    })
    
    return {
        'timestamp': datetime.now().isoformat(),
        'total_files': len(list(docs_path.rglob("*.md"))),
        'issues_found': len(issues),
        'issues': issues
    }

if __name__ == "__main__":
    result = audit_documentation_standalone()
    print(json.dumps(result, indent=2))
```

#### 2. MCP-Ready Template Generator

```python
#!/usr/bin/env python3
"""
Documentation Template Generator - MCP Ready
"""

from pathlib import Path
from datetime import datetime
from typing import Dict, Optional

class DocumentationTemplates:
    """Template generator that can be integrated into MCP server"""
    
    @staticmethod
    def get_templates() -> Dict[str, str]:
        return {
            "api": """---
title: {title}
category: reference
complexity: beginner
last_updated: {date}
---

# {title}

## Purpose
Brief description of what this API method accomplishes.

## Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|

## Request Example
```python
# Add example usage here
```

## Response Format

```json
{{
  "status": "success"
}}
```

## Error Handling

Document common error scenarios and responses.

## Related Methods

- [Related method](./related.md)
""",

            "tutorial": """---

title: {title}
category: tutorial
difficulty: beginner
time_estimate: "X minutes"
prerequisites: []
last_updated: {date}
---

# {title}

## What You'll Learn

- Learning objective 1
- Learning objective 2

## Prerequisites

- [Prerequisite](./link)

## Step 1: Setup

Provide setup instructions and context.

## Step 2: Implementation

Clear, actionable steps with code examples.

## Validation

How to verify the tutorial worked correctly.

## Next Steps

- [Related tutorial](./link)
- [Advanced guide](./link)
""",

            "howto": """---

title: {title}
category: how-to
difficulty: intermediate
last_updated: {date}
---

# How to {title}

## Problem

Describe the specific problem this guide solves.

## Solution Overview

High-level approach and strategy.

## Implementation Steps

### 1. Preparation

What you need before starting.

### 2. Implementation

Step-by-step instructions with examples.

### 3. Verification

How to confirm the solution worked.

## Troubleshooting

Common issues and their solutions.

## Related Guides

- [Related guide](./link)
""",

            "reference": """---

title: {title}
category: reference
last_updated: {date}
---

# {title} Reference

## Overview

Brief description of this reference material.

## Syntax

```
# Basic syntax or usage pattern
```

## Parameters/Options

Detailed parameter documentation.

## Examples

Practical usage examples.

## See Also

- [Related reference](./link)
"""
        }

    def create_documentation(
        self,
        doc_type: str,
        title: str,
        output_path: Path,
        project_root: Path = Path(".")
    ) -> Dict[str, str]:
        """Create documentation file from template"""
        templates = self.get_templates()

        if doc_type not in templates:
            raise ValueError(f"Unknown template type: {doc_type}")
        
        content = templates[doc_type].format(
            title=title,
            date=datetime.now().strftime("%Y-%m-%d")
        )
        
        full_path = project_root / "docs" / output_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return {
            'doc_type': doc_type,
            'title': title,
            'file_path': str(full_path),
            'content_preview': content[:200] + "..." if len(content) > 200 else content
        }

# CLI interface for standalone use

if **name** == "**main**":
    import sys
    import json

    if len(sys.argv) != 4:
        print("Usage: python create_doc.py <type> <title> <output_file>")
        print("Types: api, tutorial, howto, reference")
        sys.exit(1)
    
    doc_type, title, output_file = sys.argv[1:4]
    templates = DocumentationTemplates()
    result = templates.create_documentation(doc_type, title, Path(output_file))
    print(json.dumps(result, indent=2))

```

## Phase 5: Legal Protection Framework

### AGPL-3.0 Compatible Disclaimers
```markdown
## License & Warranty Disclaimer

Vespera Atelier is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

## Documentation Disclaimer

This documentation is provided "as is" for informational purposes only.
The authors make no warranties about the completeness, reliability, or
accuracy of this information. Any action you take based on the information
in this documentation is strictly at your own risk.

Features described in this documentation:
- Are provided without warranty of any kind
- May change without notice in future versions  
- Should be tested in your specific environment
- May not work as expected in all configurations

## Contribution Guidelines

By contributing to this documentation, you agree that your contributions
will be licensed under the same AGPL-3.0 license as the project.
```

## Implementation Timeline

### Week 1: Foundation & Environment Setup

- [ ] Set up MkDocs with Material theme in project venv
- [ ] Configure GitHub Pages deployment with Actions
- [ ] Create basic site structure and navigation
- [ ] Install and configure style validation tools
- [ ] Add documentation dependencies to requirements.txt

### Week 2: Content Standards & Legal Framework  

- [ ] Write comprehensive style guide with legal guidelines
- [ ] Create content templates for all document types
- [ ] Set up automated style checking with Vale
- [ ] Document AGPL-3.0 compatible disclaimer language
- [ ] Create legal language audit checklist

### Week 3: Vespera Scriptorium MCP Integration

- [ ] Design MCP tool interfaces for documentation
- [ ] Implement core MCP documentation tools in Scriptorium
- [ ] Create RAG-enhanced content generation capabilities
- [ ] Build automated audit and validation tools
- [ ] Test MCP integration with Claude Code commands

### Week 4: Content Migration & Automation

- [ ] Audit existing documentation using new MCP tools
- [ ] Apply automated fixes where possible using batch tools
- [ ] Manual review and refinement of flagged content
- [ ] Deploy updated documentation with new standards
- [ ] Set up analytics and monitoring

### Ongoing: Continuous Improvement

- [ ] Weekly: Review usage analytics and user feedback
- [ ] Monthly: Run comprehensive audits with Scriptorium
- [ ] Quarterly: Legal review and style guide updates
- [ ] As needed: Template and automation refinements

## Maintenance Strategy

### Daily (Automated)

- Style guide enforcement on commits
- Link checking and validation
- Automatic deployment of changes

### Weekly (Manual)

- Review analytics for user behavior
- Check for broken external links
- Update outdated screenshots/examples

### Monthly (Strategic)

- Content audit with Vespera Scriptorium
- User feedback review and integration
- Legal compliance check
- Template and style guide refinement

## Quick Start: MCP Integration

### Step 1: Add to Vespera Scriptorium

```python
# In your vespera-scriptorium MCP server
from .documentation_mcp import DocumentationMCP

class VesperaScriptorium:
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.docs_mcp = DocumentationMCP(project_root, self.rag_system)
        
    def register_documentation_tools(self):
        """Register documentation MCP tools"""
        self.register_tool("docs/audit", self.docs_mcp.audit_documentation)
        self.register_tool("docs/generate", self.docs_mcp.generate_documentation)
        self.register_tool("docs/build", self.docs_mcp.build_documentation)
        # ... register other tools
```

### Step 2: Test in Claude Code

```bash
# Test basic functionality
@scriptorium docs/audit

# Generate your first documentation
@scriptorium docs/generate tutorial "Getting Started with Vespera" getting-started/overview.md

# Build and preview
@scriptorium docs/build --serve-locally true
```

### Step 3: Iterative Enhancement

The MCP integration allows you to incrementally enhance documentation capabilities:

1. **Start Simple**: Basic template generation and audit
2. **Add RAG**: Enhanced content suggestions based on existing docs
3. **Code Analysis**: Compare documentation coverage with actual codebase
4. **User Analytics**: Integrate usage data for continuous improvement

## Success Metrics (Free Analytics)

### Google Analytics 4 Goals

- Time spent on documentation pages
- Tutorial completion rates (via scroll depth)
- Search query analysis
- Most accessed content identification

### GitHub Metrics

- Documentation-related issues/PRs
- Community contributions to docs
- Star/fork growth correlation with doc quality

### Internal Metrics

- Support question reduction
- Feature adoption rates post-documentation
- Developer onboarding time improvement

## Community & Growth Strategy

### Open Source Documentation Leadership

- **Share your MCP integration approach** on dev.to and GitHub discussions
- **Create reusable templates** that other AGPL projects can adopt
- **Contribute documentation improvements** to the MCP ecosystem
- **Mentor other solo developers** building open source documentation

### AGPL-3.0 Community Benefits

- **Template library**: Share your documentation templates as AGPL resources
- **MCP tools**: Open source your documentation MCP integration for others
- **Best practices**: Document your process for other accessibility-focused developers
- **Case studies**: Share metrics and improvements with the community

### Funding & Sustainability

- **GitHub Sponsors**: Highlight your documentation excellence as a sponsorship driver
- **Patreon content**: Create educational content about documentation best practices
- **Grant applications**: Documentation accessibility improvements qualify for many tech grants
- **Consultation**: Your MCP-integrated approach becomes a unique service offering
- **Speaking opportunities**: Present at Write the Docs and accessibility conferences

### Recognition Opportunities

- **Hacktoberfest**: Contribute documentation improvements to earn recognition
- **Google Season of Docs**: Mentor projects or contribute to major open source docs
- **Write the Docs**: Share your RAG-assisted documentation approach
- **Accessibility awards**: Many organizations recognize inclusive documentation efforts

---

*This implementation guide is released under AGPL-3.0 - fork it, improve it, and share your enhancements with the community! Your documentation approach could help countless other solo developers build professional, legally-safe documentation.*
