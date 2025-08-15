# Vespera Atelier Monitoring Infrastructure

This directory contains the comprehensive monitoring and alerting infrastructure for the Vespera Atelier monorepo. The monitoring system provides real-time visibility into system health, automated alerting, and maintenance automation.

## Overview

The monitoring infrastructure consists of:

1. **Dashboard System** - Real-time monitoring dashboard
2. **Alerting System** - Configurable alerts and notifications  
3. **Health Checks** - Automated health monitoring
4. **Documentation Automation** - Automated documentation maintenance
5. **GitHub Workflows** - CI/CD integrated monitoring

## Quick Start

### Setup Monitoring

```bash
# Install monitoring dependencies
make monitor-setup

# Run one-time system check
make monitor

# Start continuous monitoring dashboard
make dashboard
```

### Check System Health

```bash
# Quick health check
make health-check

# Generate detailed health report
make health-report

# Check for alerts
make alerts
```

### Maintenance

```bash
# Run basic maintenance
make maintenance

# Run comprehensive maintenance
make maintenance-full

# Validate documentation
make docs
```

## Components

### 1. Dashboard System (`dashboard.py`)

The monitoring dashboard provides real-time visibility into:

- Git repository status
- Dependency health (Python & Node.js)
- Build status and artifact ages
- Internal health checks
- CI/CD workflow status

**Usage:**
```bash
# One-time dashboard view
python tools/monitoring/dashboard.py

# Continuous monitoring (refreshes every 30s)
python tools/monitoring/dashboard.py --continuous

# Export metrics to JSON
python tools/monitoring/dashboard.py --export metrics.json
```

**Features:**
- Rich terminal interface (if available)
- Fallback to simple text output
- Automatic repository root detection
- Cached dependency checks
- Performance metrics

### 2. Alerting System (`alerts.py`)

Configurable alerting system with multiple notification channels:

- **Alert Rules**: Define conditions that trigger alerts
- **Severity Levels**: INFO, WARNING, ERROR, CRITICAL
- **Notification Channels**: Console, File, Email, Webhook
- **Cooldown Periods**: Prevent alert spam

**Configuration:**
```bash
# Create default configuration
python tools/monitoring/alerts.py --test

# Run continuous monitoring
python tools/monitoring/alerts.py --monitor

# View alert summary
python tools/monitoring/alerts.py --summary
```

**Alert Rules:**
- High vulnerability count (>5 vulnerabilities)
- Outdated dependencies (>10 Python packages)
- Stale builds (>7 days old)
- Health check failures
- Excessive uncommitted changes (>50 files)

### 3. Documentation Automation (`auto-docs.py`)

Automated documentation maintenance system:

- **Markdown Validation**: Uses markdownlint for consistency
- **Link Checking**: Validates internal and external links
- **Auto-Updates**: Timestamps, table of contents, badges
- **Index Generation**: Creates README files for directories

**Usage:**
```bash
# Comprehensive documentation check
python tools/documentation/auto-docs.py --comprehensive

# Validate markdown only
python tools/documentation/auto-docs.py --validate

# Check links only
python tools/documentation/auto-docs.py --check-links

# Update documentation content
python tools/documentation/auto-docs.py --update

# Generate missing index pages
python tools/documentation/auto-docs.py --generate
```

## GitHub Workflows

### Health Check Workflow (`.github/workflows/health-check.yml`)

**Schedule**: Daily at 6 AM UTC
**Triggers**: Push to main, manual dispatch

**Checks:**
- Repository structure validation
- Dependency installation verification
- Build process validation
- Test suite execution
- Security vulnerability scanning
- Internal health diagnostics

**Outputs:**
- Health check reports (artifacts)
- Automated issue creation on failures
- Security scan results

### Maintenance Workflow (`.github/workflows/maintenance.yml`)

**Schedule**: Weekly on Sundays at 2 AM UTC
**Triggers**: Manual dispatch with options

**Tasks:**
- Dependency updates with automated PRs
- Repository cleanup (cache, artifacts, temp files)
- Security scanning and reporting
- Documentation validation and updates
- Database maintenance

### Enhanced CI Workflow (`.github/workflows/enhanced-ci.yml`)

Enhanced CI/CD pipeline with maintenance integration:

**Features:**
- Pre-build health checks
- Error recovery mechanisms
- Post-test cleanup
- Security threshold enforcement
- Automated linting fixes (on main branch)
- Post-CI maintenance tasks

## Configuration

### Alert Configuration (`alerts-config.json`)

```json
{
  "notification_channels": {
    "console": {"enabled": true},
    "file": {"enabled": true, "log_path": "alerts.log"},
    "email": {
      "enabled": false,
      "smtp_server": "smtp.gmail.com",
      "smtp_port": 587,
      "from_email": "alerts@yourcompany.com",
      "to_emails": ["admin@yourcompany.com"]
    }
  },
  "alert_rules": [
    {
      "id": "high_vulnerability_count",
      "name": "High Vulnerability Count",
      "component": "dependencies",
      "condition": "utilities_vulnerabilities > 5 OR obsidian_vulnerabilities > 5",
      "severity": "error",
      "threshold": 5,
      "cooldown_minutes": 60
    }
  ]
}
```

### Documentation Configuration (`docs-config.json`)

```json
{
  "docs_paths": [
    "README.md",
    "docs/",
    "packages/vespera-scriptorium/docs/"
  ],
  "link_check": {
    "enabled": true,
    "check_external": true,
    "cache_duration_hours": 24
  },
  "auto_update": {
    "enabled": true,
    "update_timestamps": true,
    "update_toc": true
  }
}
```

## Makefile Integration

### Basic Commands
- `make monitor` - Run monitoring dashboard
- `make dashboard` - Start continuous monitoring
- `make alerts` - Check system alerts
- `make health-check` - Run health check
- `make maintenance` - Run basic maintenance
- `make docs` - Validate and update documentation

### Advanced Commands
- `make health-report` - Generate detailed health report
- `make maintenance-full` - Run comprehensive maintenance
- `make docs-report` - Generate documentation report
- `make alerts-monitor` - Start continuous alert monitoring
- `make system-status` - Complete system status overview

### Emergency Commands
- `make emergency-health` - Emergency health check
- `make emergency-cleanup` - Emergency cleanup
- `make monitor-setup` - Setup monitoring infrastructure

## Monitoring Workflow

### Daily Operations

1. **Morning Health Check**
   ```bash
   make health-check
   ```

2. **Monitor Throughout Day**
   ```bash
   make dashboard  # Keep running in terminal
   ```

3. **Evening Review**
   ```bash
   make system-status
   ```

### Weekly Maintenance

1. **Run Full Maintenance**
   ```bash
   make maintenance-full
   ```

2. **Update Documentation**
   ```bash
   make docs
   ```

3. **Review Security Reports**
   - Check GitHub Actions artifacts
   - Review alert summaries

### Monthly Reviews

1. **Generate Comprehensive Reports**
   ```bash
   make health-report
   make docs-report
   ```

2. **Review Alert Configuration**
   ```bash
   python tools/monitoring/alerts.py --summary
   ```

3. **Update Monitoring Thresholds** (if needed)
   - Edit `alerts-config.json`
   - Test with `python tools/monitoring/alerts.py --test`

## Troubleshooting

### Common Issues

#### "Rich not available" error
```bash
pip install rich
```

#### "Health check tool not found"
```bash
cd packages/vespera-scriptorium
pip install -e ".[dev]"
```

#### Alerts not triggering
1. Check configuration: `cat tools/monitoring/alerts-config.json`
2. Run test: `python tools/monitoring/alerts.py --test`
3. Check logs: `tail -f alerts.log`

#### Dashboard shows "No data"
1. Check repository root detection
2. Run with explicit path: `python tools/monitoring/dashboard.py --repo-root /path/to/repo`
3. Check permissions on repository files

### Performance Optimization

For large repositories:

1. **Enable caching**
   - Link checking automatically caches for 24 hours
   - Dependency checks cache results

2. **Reduce check frequency**
   - Adjust workflow schedules in `.github/workflows/`
   - Increase alert cooldown periods

3. **Selective monitoring**
   - Customize `docs_paths` in configuration
   - Use ignore patterns for build artifacts

## Integration Examples

### Custom Alert Rules

```json
{
  "id": "custom_build_failure",
  "name": "Build Artifacts Missing",
  "component": "builds",
  "condition": "scriptorium_built == False OR utilities_built == False",
  "severity": "error",
  "threshold": null,
  "cooldown_minutes": 120
}
```

### External Monitoring

```bash
# Export metrics for external systems
python tools/monitoring/dashboard.py --export | curl -X POST -d @- http://monitoring-system/metrics
```

### Slack Integration

```json
{
  "notification_channels": {
    "webhook": {
      "enabled": true,
      "url": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
      "headers": {
        "Content-Type": "application/json"
      }
    }
  }
}
```

## Architecture

```
tools/monitoring/
├── dashboard.py         # Main monitoring dashboard
├── alerts.py           # Alerting system
├── auto-docs.py        # Documentation automation
└── README.md          # This file

.github/workflows/
├── health-check.yml    # Daily health checks
├── maintenance.yml     # Weekly maintenance
└── enhanced-ci.yml     # CI with maintenance hooks

Configuration Files:
├── alerts-config.json  # Alert configuration
├── docs-config.json   # Documentation configuration
└── .docs-cache.json   # Documentation cache
```

## Security Considerations

- **Secrets Management**: Store email passwords and webhook URLs in GitHub Secrets
- **Access Control**: Limit who can modify alert configurations
- **Audit Logging**: All alerts are logged with timestamps
- **Rate Limiting**: Cooldown periods prevent alert spam
- **External Links**: Link checking respects timeouts and retries

## Contributing

When adding new monitoring features:

1. **Follow Patterns**: Use the existing structure and error handling
2. **Add Tests**: Include test modes for new functionality
3. **Update Documentation**: Update this README and any relevant docs
4. **Configuration**: Make features configurable where possible
5. **Error Handling**: Graceful degradation for missing dependencies

## Support

For monitoring issues:

1. **Check Logs**: Review alert logs and workflow runs
2. **Run Diagnostics**: Use `make emergency-health`
3. **Create Issue**: Include monitoring output and configuration
4. **Emergency**: Use `make emergency-cleanup` for severe issues

---

*Last updated: 2025-01-15*  
*Next review: 2025-04-15*