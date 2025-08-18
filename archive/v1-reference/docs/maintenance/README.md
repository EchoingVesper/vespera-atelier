# Vespera Atelier Maintenance Procedures

This document outlines the maintenance procedures for the Vespera Atelier monorepo, including automated processes, manual procedures, and monitoring practices.

## Overview

The Vespera Atelier monorepo requires regular maintenance to ensure:
- Security vulnerabilities are addressed
- Dependencies stay up-to-date
- System performance remains optimal
- Documentation stays current
- Repository health is maintained

## Automated Maintenance

### GitHub Workflows

#### 1. Health Check Workflow (`.github/workflows/health-check.yml`)

**Schedule:** Daily at 6 AM UTC
**Triggers:** Push to main, manual dispatch

**Checks performed:**
- Repository structure validation
- Dependency installation verification
- Build process validation
- Test suite execution
- Security vulnerability scanning
- Internal health diagnostics

**Outputs:**
- Health check reports
- Automated issue creation on failures
- Security scan artifacts

#### 2. Maintenance Workflow (`.github/workflows/maintenance.yml`)

**Schedule:** Weekly on Sundays at 2 AM UTC
**Triggers:** Manual dispatch with options

**Tasks performed:**
- Dependency updates with automated PRs
- Repository cleanup (cache, artifacts, temp files)
- Security scanning and reporting
- Documentation validation and updates
- Database maintenance

### Dependabot Integration

**Configuration:** `.github/dependabot.yml`

**Scope:**
- Python dependencies in `packages/vespera-scriptorium`
- GitHub Actions in repository root
- Weekly dependency update PRs
- Automatic security updates

## Manual Maintenance Procedures

### Monthly Tasks

#### 1. Dependency Audit
```bash
# Review and update Python dependencies
cd packages/vespera-scriptorium
pip list --outdated
uv lock --upgrade

# Review and update Node.js dependencies
cd ../../vespera-utilities
npm audit
npm outdated
npm update

# Review Obsidian plugin dependencies
cd ../plugins/Obsidian/Vespera-Scriptorium
npm audit
npm outdated
npm update
```

#### 2. Security Review
```bash
# Run comprehensive security scans
make security-check

# Review security reports
cd packages/vespera-scriptorium
bandit -r vespera_scriptorium/ -f json -o security-report.json
safety check --json --output vulnerabilities.json

# Check Node.js vulnerabilities
cd ../../vespera-utilities
npm audit --audit-level=moderate

cd ../plugins/Obsidian/Vespera-Scriptorium
npm audit --audit-level=moderate
```

#### 3. Database Maintenance
```bash
cd packages/vespera-scriptorium

# Clean old tasks and optimize database
python scripts/maintenance/cleanup_old_tasks.py
python scripts/maintenance/cleanup_database.py

# Vacuum and analyze database
python scripts/maintenance/optimize_database.py
```

### Quarterly Tasks

#### 1. Major Dependency Updates
- Review and plan major version updates
- Test compatibility with new versions
- Update CI/CD workflows if needed
- Update documentation for breaking changes

#### 2. Architecture Review
- Review system architecture for improvements
- Identify performance bottlenecks
- Plan refactoring initiatives
- Update architectural documentation

#### 3. Security Hardening
- Review security policies and procedures
- Update authentication and authorization mechanisms
- Audit access controls and permissions
- Review and update security documentation

### Annual Tasks

#### 1. License Compliance Audit
- Review all dependencies for license compatibility
- Update license documentation
- Ensure AGPL-3.0 compliance across packages

#### 2. Documentation Overhaul
- Comprehensive review of all documentation
- Update outdated procedures and examples
- Refresh getting started guides
- Update API documentation

## Emergency Procedures

### System Down Scenarios

#### 1. MCP Server Failure
```bash
# Check server health
cd packages/vespera-scriptorium
python tools/diagnostics/health_check.py

# Restart server with diagnostics
python scripts/diagnostics/emergency_fix.py

# If issues persist, use minimal server
python scripts/maintenance/minimal_server.py
```

#### 2. Database Corruption
```bash
# Create backup of current state
cd packages/vespera-scriptorium
python scripts/maintenance/backup_database.py

# Attempt repair
python scripts/diagnostics/fix_db_simple.py

# If repair fails, restore from backup or recreate
python scripts/maintenance/create_fresh_db.py
```

#### 3. CI/CD Pipeline Failure
1. Check GitHub Actions status page
2. Review workflow logs for errors
3. Disable failing workflows temporarily if needed
4. Fix issues and re-enable workflows
5. Monitor subsequent runs

### Security Incident Response

#### 1. Vulnerability Discovery
1. **Assessment:** Evaluate severity and impact
2. **Isolation:** If critical, temporarily disable affected components
3. **Patching:** Apply security updates immediately
4. **Testing:** Verify fixes don't break functionality
5. **Communication:** Update team and users if necessary

#### 2. Dependency Vulnerability
```bash
# Immediate security scan
cd packages/vespera-scriptorium
safety check --json

# For Node.js vulnerabilities
cd ../../vespera-utilities
npm audit fix

# Force updates if critical
npm audit fix --force
```

## Monitoring and Alerting

### Key Metrics to Monitor

#### 1. System Health
- Build success rate
- Test pass rate
- Security scan results
- Dependency freshness

#### 2. Performance Metrics
- Build times
- Test execution times
- Database query performance
- Memory usage patterns

#### 3. Security Indicators
- Number of known vulnerabilities
- Failed authentication attempts
- Unusual access patterns
- Outdated dependencies

### Alert Thresholds

#### Critical Alerts
- Health check failures
- Security vulnerabilities (high/critical)
- Build failures on main branch
- Test failures exceeding 10%

#### Warning Alerts
- Dependencies >30 days outdated
- Test execution time increases >20%
- Documentation validation failures
- Cleanup process failures

## Tools and Scripts

### Health Check Tools
- `tools/diagnostics/health_check.py` - Comprehensive system health check
- `tools/diagnostics/performance_monitor.py` - Performance monitoring
- `make health-check` - Quick health verification

### Maintenance Scripts
- `scripts/maintenance/cleanup_database.py` - Database cleanup
- `scripts/maintenance/automated_cleanup.py` - Repository cleanup
- `scripts/maintenance/maintenance_scheduler.py` - Scheduled maintenance
- `make clean` - Clean all build artifacts

### Diagnostic Tools
- `scripts/diagnostics/diagnose_server.py` - Server diagnostics
- `scripts/diagnostics/check_db_access.py` - Database connectivity
- `scripts/diagnostics/validate_implementation.py` - Implementation validation

## Best Practices

### 1. Regular Monitoring
- Check health dashboards daily
- Review automated maintenance results weekly
- Monitor security alerts continuously

### 2. Proactive Maintenance
- Update dependencies before they become critical
- Address technical debt regularly
- Keep documentation current

### 3. Change Management
- Test all changes in development environment
- Use feature flags for major changes
- Maintain rollback procedures

### 4. Documentation
- Document all manual procedures
- Keep runbooks updated
- Share knowledge across team

## Troubleshooting Guide

### Common Issues

#### 1. "Database locked" errors
```bash
# Kill existing connections
python scripts/diagnostics/cleanup_locks.py

# If persistent, recreate database
python scripts/maintenance/create_fresh_db.py
```

#### 2. Import errors after updates
```bash
# Clear Python cache
find . -type d -name __pycache__ -exec rm -rf {} +

# Reinstall package
cd packages/vespera-scriptorium
pip uninstall vespera-scriptorium
pip install -e ".[dev]"
```

#### 3. Node.js build failures
```bash
# Clear npm cache
npm cache clean --force

# Remove and reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Getting Help

1. **Check logs:** Review workflow logs and error messages
2. **Run diagnostics:** Use built-in diagnostic tools
3. **Search issues:** Check GitHub issues for similar problems
4. **Create issue:** Document problem with reproduction steps

## Maintenance Schedule

### Daily (Automated)
- Health checks
- Security monitoring
- Build verification

### Weekly (Automated)
- Dependency updates
- Repository cleanup
- Security scans
- Documentation validation

### Monthly (Manual)
- Dependency audit
- Performance review
- Documentation updates

### Quarterly (Manual)
- Architecture review
- Security hardening
- Major updates planning

### Annual (Manual)
- License compliance audit
- Documentation overhaul
- Infrastructure review

---

*Last updated: 2025-01-15*
*Next review: 2025-04-15*