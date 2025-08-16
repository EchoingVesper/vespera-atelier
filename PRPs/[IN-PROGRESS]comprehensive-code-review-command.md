# PRP: Comprehensive Code Review Command Enhancement

## Feature Request

Create a comprehensive, security-first code review command that can handle small-scale to codebase-wide reviews with systematic methodology, multi-language support, and actionable reporting. This enhanced command should replace the current basic `review-general.md` with a professional-grade code review system.

## Research Summary

### External Research Integration

**GitHub AI Code Review Prompts Analysis**:
- Comprehensive analysis dimensions: Security, Performance, Architecture, Testing
- Structured severity categorization (Critical/High/Medium/Low)
- Systematic review framework with root cause analysis
- Specific, actionable recommendations with implementation steps

**2024 Modern Code Review Best Practices**:
- Constructive feedback approach with context-aware communication
- Small review sizes (under 400 lines) with timely feedback
- Technological integration with automation tools
- Cultural considerations for learning-oriented environments

**OWASP Security Code Review Methodology**:
- Manual security reviews remain critical despite automation
- Focus on OWASP Top 10 vulnerabilities
- "Red flags" identification approach
- Secure coding pattern guidance

**10-Point Security Checklist**:
- Input validation, authentication, authorization
- Data encryption, exception handling, dependency management
- API integration, CSRF protection, business logic validation

### Codebase Analysis Results

**Current Limitations**:
- Basic 94-line review with limited scope
- Minimal security checklist (4 basic items)
- No severity categorization framework
- Simple output format without actionable guidance

**Existing Patterns to Leverage**:
- Testing structure: unit/integration/security/performance
- Security testing with XSS/injection prevention
- Clean Architecture validation
- Git workflow integration with mandatory commits
- Status tagging system and validation framework

## Enhanced Context Engineering

### Critical Documentation References

**MANDATORY: Enhanced AI Documentation Integration**:

```yaml
ai_documentation_references:
  - file: PRPs/ai_docs/security-patterns.md
    why: "Security-first design patterns and validation framework"
    sections: ["Input Validation", "Error Sanitization", "Authentication Patterns"]
    
  - file: PRPs/ai_docs/context-engineering-guide.md
    why: "Context engineering methodology for comprehensive analysis"
    sections: ["Context Engineering Principles", "Validation Framework"]
    
  - file: PRPs/validation/security-validation.md
    why: "Security validation framework integration"
    sections: ["Multi-Stage Validation", "Security Gates"]
    
  - file: PRPs/validation/validation-framework.md
    why: "Systematic validation approach"
    sections: ["5-Stage Validation Process", "Quality Gates"]
```

**External Documentation URLs**:
- OWASP Code Review Guide: https://owasp.org/www-project-code-review-guide/
- Spring Boot Security Patterns: https://github.com/fluidfocuschannel/ai-code-review-prompts/tree/main/prompts
- GitKraken 2024 Best Practices: https://www.gitkraken.com/blog/code-review-best-practices-2024
- HackTheBox Security Checklist: https://www.hackthebox.com/blog/secure-code-reviews

### Implementation Context

**Codebase Integration Points**:
```yaml
existing_patterns:
  testing_framework:
    unit_tests: "packages/vespera-scriptorium/tests/unit/"
    security_tests: "packages/vespera-scriptorium/tests/security/"
    validation_gates: "packages/vespera-scriptorium/tests/validation_gates/"
    
  quality_tools:
    formatting: "black (line-length: 88), isort (profile: black)"
    testing: "pytest with asyncio, coverage, timeout markers"
    linting: "mypy for type checking"
    
  command_structure:
    location: ".claude/commands/code-quality/"
    argument_pattern: "$ARGUMENTS variable for flexible scope"
    output_format: "Markdown with severity categorization"
    report_storage: "PRPs/code_reviews/ with numbered reports"
```

## Implementation Specification

### Enhanced Code Review Methodology

**1. Multi-Dimensional Analysis Framework**:
```yaml
analysis_dimensions:
  security:
    - OWASP Top 10 vulnerability assessment
    - Input validation and sanitization
    - Authentication and authorization patterns
    - Encryption and data protection
    - Error handling and information disclosure
    
  architecture:
    - Clean Architecture layer compliance
    - Dependency injection patterns
    - Repository pattern implementation
    - Domain-driven design principles
    - Vertical slice boundaries
    
  quality:
    - Code readability and maintainability
    - Type safety with Pydantic v2
    - Error handling completeness
    - Performance optimization
    - Testing coverage and quality
    
  language_specific:
    python:
      - PEP 8 compliance
      - Type hints on all functions
      - Pydantic v2 patterns (ConfigDict, field_validator)
      - No print() statements (use logging)
      - Google-style docstrings
    typescript:
      - ESLint compliance
      - Type safety with strict mode
      - Proper error boundaries
      - Performance patterns
    general:
      - Resource management
      - Async/await patterns
      - Database N+1 query prevention
```

**2. Systematic Review Process**:
```yaml
review_stages:
  stage_1_preparation:
    - Determine review scope (staged, files, directories, full codebase)
    - Run automated tools (linting, type checking, security scanning)
    - Generate baseline metrics
    
  stage_2_security_analysis:
    - Input validation assessment
    - Authentication/authorization review
    - Dependency vulnerability scan
    - Error handling security review
    
  stage_3_architecture_review:
    - Layer boundary validation
    - Pattern compliance check
    - Dependency analysis
    - Performance assessment
    
  stage_4_code_quality:
    - Readability and maintainability
    - Test coverage analysis
    - Documentation quality
    - Technical debt assessment
    
  stage_5_reporting:
    - Severity categorization
    - Actionable recommendations
    - Implementation guidance
    - Prevention strategies
```

### Enhanced Command Structure

**File Location**: `.claude/commands/code-quality/review-comprehensive.md`

**Command Implementation**:
```markdown
# Comprehensive Code Review

Perform a systematic, security-first code review using multi-dimensional analysis.

## Review Scope

$ARGUMENTS

## Enhanced Review Process

### Stage 1: Preparation and Automated Analysis

1. **Determine Review Scope**:
   - If no arguments: Review staged changes (`git diff --staged`)
   - If file paths: Review specific files
   - If directory: Review directory contents
   - If "codebase" or "all": Review entire codebase
   - If PR number: Review PR changes (`gh pr view $ARGUMENTS --json files`)

2. **Run Automated Tools**:
   ```bash
   # Python projects
   black --check . && isort --check-only . && pytest -m unit --tb=short
   
   # Multi-language linting
   # Run language-specific linters based on detected files
   ```

3. **Security Baseline**:
   ```bash
   # Check for secrets
   git secrets --scan || true
   
   # Dependency vulnerability check
   # Python: safety check (if available)
   # Node.js: npm audit (if package.json exists)
   ```

### Stage 2: Multi-Dimensional Analysis

#### 🔒 Security Analysis (OWASP-Based)

**Critical Security Checklist**:

1. **Input Validation**:
   - [ ] All external inputs validated (type, length, format, range)
   - [ ] Server-side validation for all user inputs
   - [ ] SQL injection prevention (parameterized queries)
   - [ ] XSS prevention (output encoding, CSP headers)
   - [ ] Command injection prevention
   - [ ] Path traversal protection

2. **Authentication & Authorization**:
   - [ ] Secure session management
   - [ ] Password complexity enforcement
   - [ ] Rate limiting on authentication endpoints
   - [ ] Granular authorization checks
   - [ ] Principle of least privilege
   - [ ] No information leakage in error messages

3. **Data Protection**:
   - [ ] Encryption for sensitive data at rest
   - [ ] TLS for all communications
   - [ ] Secure key management
   - [ ] PII handling compliance
   - [ ] Secure configuration management

4. **Error Handling & Logging**:
   - [ ] Comprehensive error handling
   - [ ] No sensitive information in logs
   - [ ] Security event logging
   - [ ] Error message sanitization

#### 🏗️ Architecture Analysis

**Clean Architecture Compliance**:

1. **Layer Boundaries**:
   - [ ] Domain logic isolated from infrastructure
   - [ ] Application layer orchestrates use cases
   - [ ] Infrastructure implements interfaces
   - [ ] Presentation layer handles external concerns

2. **Dependency Management**:
   - [ ] Dependencies point inward
   - [ ] Dependency injection used properly
   - [ ] No circular dependencies
   - [ ] Interface segregation principle

3. **Vertical Slice Validation**:
   - [ ] Features are self-contained
   - [ ] No cross-feature direct dependencies
   - [ ] Shared components properly abstracted

#### ⚡ Performance Analysis

1. **Database Patterns**:
   - [ ] No N+1 query problems
   - [ ] Proper indexing strategies
   - [ ] Connection pooling implemented
   - [ ] Query optimization

2. **Async Patterns**:
   - [ ] Proper async/await usage
   - [ ] No blocking calls in async contexts
   - [ ] Resource cleanup in async code

#### 🧪 Testing & Quality

1. **Test Coverage**:
   - [ ] Unit tests for business logic
   - [ ] Integration tests for workflows
   - [ ] Security tests for attack vectors
   - [ ] Edge cases covered

2. **Code Quality**:
   - [ ] Functions under 20 lines
   - [ ] Classes with single responsibility
   - [ ] Clear naming conventions
   - [ ] Proper documentation

### Stage 3: Language-Specific Analysis

#### Python-Specific Patterns

1. **Pydantic v2 Compliance**:
   - [ ] Using `ConfigDict` not `class Config`
   - [ ] Using `field_validator` not `@validator`
   - [ ] Using `model_dump()` not `dict()`
   - [ ] Proper use of `Annotated` types

2. **Python Best Practices**:
   - [ ] Type hints on all functions and classes
   - [ ] Google-style docstrings
   - [ ] No `print()` statements (use logging)
   - [ ] PEP 8 compliance
   - [ ] Proper exception handling

#### TypeScript-Specific Patterns

1. **Type Safety**:
   - [ ] Strict mode enabled
   - [ ] No `any` types without justification
   - [ ] Proper interface definitions
   - [ ] Generic type usage

2. **Modern Patterns**:
   - [ ] Proper error boundaries
   - [ ] Async/await over promises
   - [ ] Proper event handling
   - [ ] Memory leak prevention

### Stage 4: Comprehensive Reporting

## Enhanced Review Output

Generate comprehensive review report with:

```markdown
# Code Review Report #[AUTO-INCREMENT]

## Executive Summary
[2-3 sentence overview with overall quality score]

## Review Scope
- Files reviewed: [count]
- Lines of code: [count]
- Languages detected: [list]
- Review duration: [time]

## Security Analysis Results

### 🔴 Critical Security Issues (Must Fix Immediately)
- **[VULNERABILITY-TYPE]** in `file:line`
  - **Issue**: [Detailed description]
  - **Risk**: [Potential impact and OWASP category]
  - **Fix**: [Specific remediation steps]
  - **Code Example**:
    ```language
    // Current (vulnerable)
    [current code]
    
    // Recommended (secure)
    [fixed code]
    ```
  - **Prevention**: [How to prevent similar issues]

### 🟡 Important Issues (Should Fix)
- **[ISSUE-TYPE]** in `file:line`
  - **Issue**: [Description]
  - **Impact**: [Why this matters]
  - **Recommendation**: [Specific fix]
  - **Priority**: [High/Medium/Low]

### 🟢 Minor Issues (Consider)
- **[IMPROVEMENT-TYPE]** in `file:line`
  - **Suggestion**: [Improvement idea]
  - **Benefit**: [Why this would help]

## Architecture Analysis

### Clean Architecture Compliance
- **Score**: [X/10]
- **Layer Violations**: [List any violations]
- **Dependency Issues**: [Circular dependencies, etc.]

### Performance Assessment
- **Database Queries**: [N+1 issues found]
- **Async Patterns**: [Issues with async/await]
- **Resource Management**: [Memory/connection leaks]

## Quality Metrics

### Test Coverage
- **Current Coverage**: X%
- **Required Coverage**: 80%
- **Missing Tests**: [List areas needing tests]

### Code Quality
- **Maintainability Index**: [Score]
- **Cyclomatic Complexity**: [Average/Max]
- **Technical Debt**: [Estimated hours]

## Actionable Recommendations

### Immediate Actions (This Sprint)
1. [Critical security fix with file:line]
2. [Important architecture violation with file:line]
3. [Performance issue with file:line]

### Short-term Improvements (Next Sprint)
1. [Code quality improvements]
2. [Test coverage additions]
3. [Documentation updates]

### Long-term Enhancements (Future Sprints)
1. [Architecture refinements]
2. [Performance optimizations]
3. [Technical debt reduction]

## Validation Commands

Run these commands to verify fixes:

```bash
# Security validation
python tests/security_validation.py

# Architecture validation
pytest tests/architecture/ -v

# Performance validation
python tools/performance_benchmark.py

# Quality validation
black . && isort . && mypy . && pytest --cov=app --cov-fail-under=80
```

## Review Quality Score

**Overall Score**: [X/100]
- Security: [X/25]
- Architecture: [X/25]
- Quality: [X/25]
- Testing: [X/25]

## Good Practices Identified
- [List things done well]
- [Positive patterns to continue]
- [Examples others can learn from]

---

**Reviewer**: Claude Code (Comprehensive Review)
**Review Date**: [Current date]
**Review Type**: [Scope type]
**Next Review**: [Recommended timeframe]
```

Save report to `PRPs/code_reviews/review-[YYYY-MM-DD]-[scope].md`

## Enhanced Multi-Stage Validation Framework

**Stage 1: Syntax & Security Validation**
```bash
# Python projects
black . && isort . && ruff check --fix
python -m pytest tests/security/ -v
git secrets --scan

# Multi-language linting
eslint . --fix || true  # TypeScript/JavaScript
```

**Stage 2: Architecture & Testing Validation**
```bash
# Architecture tests
pytest tests/architecture/ -v

# Unit testing with coverage
pytest tests/unit/ -v --cov=app --cov-fail-under=70

# Integration testing
pytest tests/integration/ -v
```

**Stage 3: Performance & Resource Validation**
```bash
# Performance monitoring
python tools/diagnostics/performance_monitor.py --duration 60

# Resource cleanup validation
python tests/test_resource_cleanup.py
```

**Stage 4: Security Penetration Testing**
```bash
# Security validation
pytest tests/security/test_input_validation.py -v
pytest tests/security/test_attack_vectors.py -v

# OWASP compliance check
python tools/security/owasp_compliance_check.py
```

**Stage 5: Production Readiness Validation**
```bash
# Health check
python tools/diagnostics/health_check.py

# Documentation validation
markdownlint . --fix

# Final integration test
pytest tests/validation_gates/ -v
```

**Git Commit After Validation**:
```bash
git add -A
git commit -m "feat(code-review): implement comprehensive review command with security-first design

🚀 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Security Integration Requirements

**XSS Prevention**:
- Output encoding validation
- CSP header implementation
- Input sanitization verification

**SQL Injection Prevention**:
- Parameterized query validation
- ORM usage verification
- Dynamic query analysis

**Authentication Security**:
- Session management review
- Token validation patterns
- Authorization boundary checks

**Error Sanitization**:
- Error message content review
- Log sanitization verification
- Information disclosure prevention

## Performance Requirements

**Database Optimization**:
- Query efficiency analysis
- N+1 query detection
- Index usage validation

**Resource Management**:
- Memory leak detection
- Connection pool validation
- Async pattern optimization

## Implementation Tasks

### Task 1: Create Enhanced Command File
- **Location**: `.claude/commands/code-quality/review-comprehensive.md`
- **Content**: Full implementation following specification above
- **Integration**: Replace current `review-general.md` usage

### Task 2: Security Validation Integration
- **Reference**: `PRPs/validation/security-validation.md`
- **Implementation**: Integrate OWASP-based security checks
- **Testing**: Validate with existing security test suite

### Task 3: Multi-Language Support
- **Languages**: Python, TypeScript, JavaScript, general patterns
- **Detection**: Automatic language detection from file extensions
- **Patterns**: Language-specific best practices integration

### Task 4: Reporting Enhancement
- **Format**: Markdown with severity categorization
- **Storage**: `PRPs/code_reviews/` with auto-incrementing numbers
- **Metrics**: Quality scoring and trend tracking

### Task 5: Validation Framework Integration
- **5-Stage Process**: Implement comprehensive validation pipeline
- **Security Gates**: Critical security validation requirements
- **Performance Benchmarks**: Resource and speed optimization validation

## Expected Outcomes

### One-Pass Implementation Success Criteria

1. **Comprehensive Analysis**: Multi-dimensional review covering security, architecture, quality, and performance
2. **Actionable Output**: Specific recommendations with file:line references and code examples
3. **Security-First Design**: OWASP-compliant security analysis integrated throughout
4. **Scalable Scope**: Handle small files to full codebase reviews
5. **Professional Reporting**: Industry-standard review reports with metrics

### Context Engineering Validation

**Context Completeness Score**: 9/10
- All enhanced AI documentation referenced
- External research comprehensively integrated
- Codebase patterns thoroughly analyzed
- Implementation path clearly defined

**Security Integration Score**: 10/10
- OWASP methodology integrated
- Security-first design throughout
- Comprehensive security validation gates
- Attack vector analysis included

**Overall Confidence Score**: 9/10
- Systematic approach ensuring one-pass success
- Comprehensive context for AI agent
- Professional-grade implementation specification
- Integration with existing patterns validated

## Post-Implementation Validation

After implementation, validate with:

1. **Test on small file**: Single Python file review
2. **Test on directory**: Package-level review
3. **Test on codebase**: Full monorepo review
4. **Security validation**: Run security test suite
5. **Performance check**: Monitor command execution time
6. **Report quality**: Verify actionable recommendations

**Success Metrics**:
- Review completion time under 5 minutes for typical files
- 100% security checklist completion
- Actionable recommendations with specific fixes
- Integration with existing validation framework
- Professional-quality reporting output