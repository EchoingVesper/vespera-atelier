# Comprehensive Code Review

Perform a systematic, security-first code review using multi-dimensional analysis framework. This enhanced command replaces the basic review-general.md with professional-grade code review capabilities.

## Review Scope

$ARGUMENTS

## Enhanced Review Process

### Stage 1: Preparation and Automated Analysis

1. **Determine Review Scope**:
   - If no arguments: Review staged changes (`git diff --staged`)
   - If file paths: Review specific files
   - If directory: Review directory contents recursively
   - If "codebase" or "all": Review entire codebase
   - If PR number: Review PR changes (`gh pr view $ARGUMENTS --json files`)

2. **Run Automated Tools**:
   ```bash
   # Python projects - syntax and linting
   black --check . && isort --check-only . && ruff check .
   
   # Type checking
   mypy . || echo "Type checking issues found"
   
   # Security baseline scanning
   bandit -r . -f json || echo "Security issues detected"
   safety check || echo "Dependency vulnerabilities found"
   
   # Multi-language support
   # JavaScript/TypeScript
   if [ -f "package.json" ]; then
     npm audit || echo "Node.js vulnerabilities found"
     if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ]; then
       npx eslint . || echo "ESLint issues found"
     fi
   fi
   ```

3. **Security Baseline Check**:
   ```bash
   # Check for hardcoded secrets
   git secrets --scan . || echo "Potential secrets detected"
   
   # Check file permissions
   find . -type f -perm /o+w -not -path "./.git/*" | head -10
   ```

### Stage 2: Multi-Dimensional Security Analysis

#### 🔒 OWASP Top 10 Security Analysis

**CRITICAL: Security-First Review Checklist**

1. **Input Validation & Injection Prevention**:
   - [ ] **XSS Prevention**: All user inputs sanitized, no dangerous HTML/JavaScript patterns
   - [ ] **SQL Injection Prevention**: Parameterized queries used, no dynamic SQL construction
   - [ ] **Command Injection Prevention**: No user input passed to system commands
   - [ ] **Path Traversal Prevention**: File paths validated, no "../" or "~/" patterns
   - [ ] **LDAP Injection Prevention**: LDAP queries properly escaped
   - [ ] **Server-Side Validation**: All inputs validated on server-side, not just client-side

2. **Authentication & Session Management**:
   - [ ] **Secure Authentication**: Strong password requirements, account lockout mechanisms
   - [ ] **Session Security**: Secure session management, proper timeout, session regeneration
   - [ ] **Multi-Factor Authentication**: MFA implemented where appropriate
   - [ ] **Password Storage**: Passwords properly hashed with salt using bcrypt/Argon2
   - [ ] **Rate Limiting**: Authentication endpoints protected against brute force
   - [ ] **No Information Leakage**: Error messages don't reveal user existence

3. **Authorization & Access Control**:
   - [ ] **Role-Based Access Control**: Proper RBAC implementation
   - [ ] **Principle of Least Privilege**: Users granted minimum necessary permissions
   - [ ] **Authorization Checks**: Every resource access properly authorized
   - [ ] **Horizontal Privilege Escalation Prevention**: Users can't access others' data
   - [ ] **Vertical Privilege Escalation Prevention**: Regular users can't perform admin actions
   - [ ] **Resource-Level Authorization**: Fine-grained access control implemented

4. **Data Protection & Privacy**:
   - [ ] **Encryption at Rest**: Sensitive data encrypted in database
   - [ ] **Encryption in Transit**: HTTPS/TLS used for all communications
   - [ ] **Key Management**: Encryption keys properly managed and rotated
   - [ ] **PII Protection**: Personal data handled according to privacy regulations
   - [ ] **Data Masking**: Sensitive data masked in logs and responses
   - [ ] **Secure Configuration**: No hardcoded secrets, secure defaults

5. **Error Handling & Logging**:
   - [ ] **Error Sanitization**: No sensitive information in error messages
   - [ ] **Comprehensive Logging**: Security events properly logged
   - [ ] **Log Security**: Logs don't contain sensitive information
   - [ ] **Audit Trail**: User actions trackable for security analysis
   - [ ] **Error Recovery**: Graceful error handling without system exposure
   - [ ] **Information Disclosure Prevention**: Stack traces not exposed to users

#### 🏗️ Clean Architecture Compliance

**Architecture Quality Assessment**:

1. **Layer Boundaries**:
   - [ ] **Domain Independence**: Domain logic isolated from infrastructure concerns
   - [ ] **Application Orchestration**: Application layer orchestrates use cases properly
   - [ ] **Infrastructure Implementation**: Infrastructure implements domain interfaces
   - [ ] **Presentation Isolation**: UI/API layer handles external concerns only
   - [ ] **Dependency Direction**: Dependencies point inward toward domain

2. **Design Patterns Compliance**:
   - [ ] **Repository Pattern**: Database access abstracted through repositories
   - [ ] **Dependency Injection**: Dependencies injected, not hard-coded
   - [ ] **Interface Segregation**: Interfaces focused and not bloated
   - [ ] **Single Responsibility**: Classes have single, well-defined purpose
   - [ ] **Open/Closed Principle**: Code open for extension, closed for modification

3. **Vertical Slice Validation**:
   - [ ] **Feature Isolation**: Features self-contained with minimal cross-dependencies
   - [ ] **Shared Components**: Only truly shared code in common modules
   - [ ] **Database Schema**: Proper normalization and relationship design
   - [ ] **API Design**: RESTful/GraphQL best practices followed
   - [ ] **Error Boundaries**: Proper error isolation between components

#### ⚡ Performance & Resource Management

1. **Database Performance**:
   - [ ] **Query Optimization**: No N+1 query problems, efficient SQL
   - [ ] **Index Strategy**: Proper database indexing for query patterns
   - [ ] **Connection Management**: Database connections properly pooled/managed
   - [ ] **Transaction Scope**: Database transactions appropriately scoped
   - [ ] **Pagination**: Large datasets properly paginated

2. **Async/Concurrency Patterns**:
   - [ ] **Proper Async Usage**: async/await used correctly, no blocking calls
   - [ ] **Resource Cleanup**: Resources properly cleaned up in async code
   - [ ] **Concurrency Control**: Race conditions prevented, proper locking
   - [ ] **Memory Management**: No memory leaks in long-running operations
   - [ ] **Thread Safety**: Shared resources properly synchronized

3. **Caching & Optimization**:
   - [ ] **Caching Strategy**: Appropriate caching implemented where beneficial
   - [ ] **Cache Invalidation**: Cache invalidation strategy properly implemented
   - [ ] **Algorithm Efficiency**: Efficient algorithms used, complexity considered
   - [ ] **Resource Limits**: File size limits, request timeouts implemented
   - [ ] **Load Handling**: System designed to handle expected load

#### 🧪 Testing & Quality Assurance

1. **Test Coverage**:
   - [ ] **Unit Tests**: Core business logic covered by unit tests (>80%)
   - [ ] **Integration Tests**: Component interactions tested
   - [ ] **Security Tests**: Security-specific test cases implemented
   - [ ] **Edge Cases**: Error conditions and edge cases covered
   - [ ] **Regression Tests**: Critical paths protected against regressions

2. **Code Quality Metrics**:
   - [ ] **Function Size**: Functions under 20 lines, focused responsibility
   - [ ] **Class Responsibility**: Classes follow single responsibility principle
   - [ ] **Cyclomatic Complexity**: Functions have reasonable complexity (<10)
   - [ ] **Code Duplication**: Minimal code duplication, DRY principle followed
   - [ ] **Documentation**: Code properly documented with docstrings/comments

### Stage 3: Language-Specific Analysis

#### Python-Specific Security & Quality Patterns

1. **Pydantic v2 Security Compliance**:
   - [ ] **ConfigDict Usage**: Using `ConfigDict` instead of deprecated `class Config`
   - [ ] **Field Validators**: Using `field_validator` decorator instead of `@validator`
   - [ ] **Model Serialization**: Using `model_dump()` instead of `dict()`
   - [ ] **Type Annotations**: Proper use of `Annotated` types for validation
   - [ ] **Input Sanitization**: Pydantic validators include security checks

2. **Python Security Best Practices**:
   - [ ] **Type Hints**: All functions and classes have proper type hints
   - [ ] **Docstring Standards**: Google-style docstrings for all public methods
   - [ ] **No Debug Code**: No `print()` statements, proper logging used
   - [ ] **PEP 8 Compliance**: Code follows Python style guidelines
   - [ ] **Exception Handling**: Specific exceptions caught, generic catches avoided
   - [ ] **Security Imports**: No dangerous imports (pickle, eval, exec without validation)

#### TypeScript/JavaScript Security Patterns

1. **Type Safety & Security**:
   - [ ] **Strict Mode**: TypeScript strict mode enabled
   - [ ] **No Any Types**: Minimal use of `any` types, proper typing
   - [ ] **Interface Definitions**: Proper interface/type definitions
   - [ ] **Generic Usage**: Appropriate use of generics for type safety
   - [ ] **Null Safety**: Proper null/undefined handling

2. **Modern JavaScript Security**:
   - [ ] **Error Boundaries**: Proper error boundaries implemented (React)
   - [ ] **Async Patterns**: async/await preferred over raw promises
   - [ ] **Event Handling**: Secure event handling, no inline handlers
   - [ ] **Memory Management**: Proper cleanup to prevent memory leaks
   - [ ] **XSS Prevention**: Output encoding, CSP headers, sanitization

#### General Security Patterns (All Languages)

1. **Resource Management**:
   - [ ] **File Operations**: Proper file handling with size limits
   - [ ] **Network Requests**: Timeouts and error handling for external calls
   - [ ] **Memory Usage**: Bounded memory usage, no unbounded collections
   - [ ] **CPU Limits**: Operations have reasonable time complexity
   - [ ] **Cleanup**: Resources properly disposed/cleaned up

2. **Configuration Security**:
   - [ ] **Environment Variables**: Secrets stored in environment variables
   - [ ] **Configuration Validation**: Config values validated at startup
   - [ ] **Default Security**: Secure defaults, explicit security configuration
   - [ ] **Secret Management**: No secrets in code, proper secret management
   - [ ] **Feature Flags**: Secure feature flag implementation

### Stage 4: Comprehensive Analysis & Reporting

## Enhanced Review Output

Generate comprehensive review report with:

```markdown
# Code Review Report #[AUTO-INCREMENT]

**Reviewer**: Claude Code (Comprehensive Review)  
**Review Date**: [Current date]  
**Review Type**: [Scope type]  
**Duration**: [Review duration]

## Executive Summary

[2-3 sentence overview with overall quality assessment]

**Overall Security Score**: [X/100]  
**Architecture Compliance**: [X/10]  
**Code Quality Score**: [X/10]  
**Performance Rating**: [Excellent/Good/Needs Improvement/Poor]

## Review Scope
- **Files Reviewed**: [count]
- **Lines of Code**: [count]  
- **Languages Detected**: [list]
- **Security Tests Run**: [count]
- **Automated Tools Used**: [list]

## Security Analysis Results

### 🔴 Critical Security Issues (MUST FIX IMMEDIATELY)

- **[VULNERABILITY-TYPE]** in `file:line`
  - **OWASP Category**: [A01-A10 classification]
  - **Issue**: [Detailed description of security vulnerability]
  - **Attack Vector**: [How this could be exploited]
  - **Impact**: [Potential damage/data exposure]
  - **Fix**: [Specific remediation steps]
  - **Code Example**:
    ```[language]
    // Current (vulnerable)
    [current vulnerable code]
    
    // Recommended (secure)
    [secure implementation]
    ```
  - **Prevention**: [How to prevent similar issues in the future]
  - **Testing**: [Security test to verify fix]

### 🟡 Important Issues (SHOULD FIX)

- **[ISSUE-TYPE]** in `file:line`
  - **Category**: [Security/Performance/Architecture/Quality]
  - **Issue**: [Description of the problem]
  - **Impact**: [Why this matters for security/performance/maintainability]
  - **Recommendation**: [Specific fix with code example]
  - **Priority**: [High/Medium/Low]
  - **Effort Estimate**: [Time to fix]

### 🟢 Minor Issues (CONSIDER)

- **[IMPROVEMENT-TYPE]** in `file:line`
  - **Suggestion**: [Improvement idea]
  - **Benefit**: [Why this would help]
  - **Optional**: [Can be addressed in future iterations]

## Architecture Analysis

### Clean Architecture Compliance Score: [X/10]

**Layer Violations Found**:
- [List any violations of clean architecture principles]

**Dependency Issues**:
- Circular dependencies: [list]
- Incorrect dependency direction: [list] 
- Missing abstractions: [list]

**Recommendations**:
- [Specific architectural improvements needed]

## Performance Assessment

### Database Performance
- **Query Efficiency**: [Analysis of database queries]
- **N+1 Issues**: [List any N+1 query problems found]
- **Connection Management**: [Assessment of connection handling]
- **Indexing**: [Review of database index usage]

### Resource Management
- **Memory Usage**: [Assessment of memory usage patterns]
- **Async Patterns**: [Review of async/await usage]
- **Error Handling**: [Performance impact of error handling]
- **Resource Cleanup**: [Verification of proper resource cleanup]

## Code Quality Metrics

### Test Coverage Analysis
- **Current Coverage**: X%
- **Required Coverage**: 80%
- **Security Test Coverage**: X%
- **Missing Tests**: 
  - [List areas needing test coverage]
  - [Specific test cases needed]

### Quality Metrics
- **Average Function Length**: X lines
- **Cyclomatic Complexity**: Average X, Max X
- **Code Duplication**: X% duplicated code
- **Documentation Coverage**: X% of public APIs documented
- **Technical Debt**: Estimated X hours

## Security Validation Results

### OWASP Top 10 Compliance
- A01 - Broken Access Control: ✅/❌
- A02 - Cryptographic Failures: ✅/❌  
- A03 - Injection: ✅/❌
- A04 - Insecure Design: ✅/❌
- A05 - Security Misconfiguration: ✅/❌
- A06 - Vulnerable Components: ✅/❌
- A07 - Authentication Failures: ✅/❌
- A08 - Software/Data Integrity: ✅/❌
- A09 - Logging/Monitoring Failures: ✅/❌
- A10 - Server-Side Request Forgery: ✅/❌

### Security Test Results
- **Input Validation Tests**: [X/Y passed]
- **Authentication Tests**: [X/Y passed]
- **Authorization Tests**: [X/Y passed]
- **Error Handling Tests**: [X/Y passed]

## Actionable Recommendations

### Immediate Actions (This Sprint)
1. **[CRITICAL]** Fix SQL injection vulnerability in `file:line`
   - Impact: High - Could allow data theft
   - Solution: Implement parameterized queries
   - Test: Add SQL injection security test

2. **[CRITICAL]** Implement input validation in `file:line`
   - Impact: High - XSS vulnerability
   - Solution: Add Pydantic validation with security checks
   - Test: Add XSS prevention test

### Short-term Improvements (Next Sprint)
1. **[IMPORTANT]** Improve error handling in `file:line`
   - Impact: Medium - Information disclosure risk
   - Solution: Implement error sanitization
   - Test: Add error handling security test

2. **[PERFORMANCE]** Optimize database queries in `file:line`
   - Impact: Medium - Performance degradation
   - Solution: Add database indexes, fix N+1 queries
   - Test: Add performance benchmark test

### Long-term Enhancements (Future Sprints)
1. **[ARCHITECTURE]** Refactor to improve separation of concerns
   - Impact: Low - Technical debt reduction
   - Solution: Apply clean architecture patterns
   - Benefit: Improved maintainability

2. **[QUALITY]** Increase test coverage in [modules]
   - Impact: Low - Quality improvement
   - Solution: Add comprehensive test suite
   - Target: Achieve 90% coverage

## Multi-Stage Validation Commands

Run these commands to verify fixes and validate security:

### Stage 1: Syntax & Security Validation
```bash
# Python projects
black . && isort . && ruff check --fix .
python -m pytest tests/security/ -v
bandit -r . -f json
safety check

# TypeScript/JavaScript projects  
npx eslint . --fix
npm audit
npx tsc --noEmit  # Type checking
```

### Stage 2: Unit Testing with Security Focus
```bash
# Run all unit tests with coverage
pytest tests/unit/ -v --cov=. --cov-report=term-missing --cov-fail-under=80

# Run security-specific tests
pytest tests/unit/ -m "security" -v

# Run error handling tests
pytest tests/unit/ -k "test_error" -v
```

### Stage 3: Integration & Database Testing  
```bash
# Integration tests
pytest tests/integration/ -v

# Database validation
python scripts/validate_database_schema.py

# MCP protocol compliance (if applicable)
python scripts/test_mcp_compliance.py
```

### Stage 4: Security & Performance Validation
```bash
# Security audit
python scripts/security_audit.py

# Performance benchmarks
python scripts/performance_benchmark.py

# Load testing (if applicable)
locust -f tests/load/locustfile.py --headless -u 10 -r 2 -t 30s
```

### Stage 5: Production Readiness
```bash
# End-to-end validation
python scripts/e2e_validation.py

# Health checks
python scripts/health_check_validation.py

# Documentation validation
markdownlint . --fix
```

## Review Quality Score

**Overall Score**: [X/100]

**Breakdown**:
- **Security**: [X/30] - Weighted heavily due to critical importance
- **Architecture**: [X/25] - Clean architecture compliance
- **Quality**: [X/25] - Code quality and maintainability  
- **Performance**: [X/20] - Performance and resource management

**Deployment Recommendation**: 
- ✅ **APPROVED FOR DEPLOYMENT** (Score ≥ 80, no critical security issues)
- ⚠️ **CONDITIONAL APPROVAL** (Score 60-79, minor issues only)
- ❌ **BLOCKED FOR DEPLOYMENT** (Score < 60 or critical security issues)

## Good Practices Identified

### Security Best Practices
- [List security practices done well]
- [Examples of proper input validation]
- [Good error handling examples]

### Architecture Patterns
- [Clean architecture implementation examples]
- [Good separation of concerns]
- [Proper dependency injection usage]

### Code Quality Examples
- [Well-written functions/classes]
- [Good test coverage examples]
- [Clear documentation examples]

## Learning Opportunities

### Security Knowledge Sharing
- [Security patterns team should adopt]
- [Training recommendations for team]
- [Security tools to integrate]

### Architecture Improvements
- [Architecture patterns to standardize]
- [Refactoring opportunities for technical debt]
- [Design patterns to adopt team-wide]

---

**Next Review Recommended**: [Date based on criticality]  
**Follow-up Required**: [Yes/No with specific items]

## Appendix: Detailed Security Analysis

### Input Validation Analysis
[Detailed analysis of all input validation patterns found]

### Authentication/Authorization Review  
[Detailed analysis of auth implementation]

### Error Handling Security Review
[Analysis of error handling for information disclosure]

Save this report to: `PRPs/code_reviews/review-[YYYY-MM-DD]-[scope].md`
```

## Implementation Notes

### Multi-Language Support
- **Python**: Focus on Pydantic v2, type hints, PEP 8, security patterns
- **TypeScript**: Emphasize type safety, modern patterns, XSS prevention
- **JavaScript**: Focus on security, async patterns, error boundaries
- **General**: Universal security principles, resource management, performance

### Security Integration Points
- Integrates with existing security test suite in `tests/security/`
- References security patterns from `PRPs/ai_docs/security-patterns.md`
- Uses validation framework from `PRPs/validation/security-validation.md`
- Applies OWASP Top 10 methodology consistently

### Validation Framework Integration
- Connects to 5-stage validation process from `PRPs/validation/validation-framework.md`
- Uses security-first approach throughout all stages
- Provides executable commands for each validation stage
- Enables continuous improvement through metrics and reporting

### Report Generation
- Auto-increments review numbers
- Stores reports in `PRPs/code_reviews/` with consistent naming
- Provides actionable recommendations with specific file:line references
- Includes validation commands for immediate use

This comprehensive review command transforms the basic 94-line review-general.md into a professional-grade, security-first code review system that can handle everything from single files to entire codebases while maintaining consistency with the enhanced PRP methodology and context engineering principles.