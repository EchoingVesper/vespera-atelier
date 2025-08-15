#!/usr/bin/env python3
"""
Vespera Atelier Alerting System

Monitors system metrics and sends alerts based on configurable thresholds.
Supports multiple notification channels and severity levels.
"""

import asyncio
import json
import smtplib
import time
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
import logging
import argparse
import subprocess
from dataclasses import dataclass, asdict
from enum import Enum

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AlertSeverity(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class NotificationChannel(Enum):
    """Available notification channels."""
    EMAIL = "email"
    SLACK = "slack"
    WEBHOOK = "webhook"
    FILE = "file"
    CONSOLE = "console"

@dataclass
class Alert:
    """Represents a system alert."""
    id: str
    title: str
    message: str
    severity: AlertSeverity
    component: str
    timestamp: str
    resolved: bool = False
    resolution_time: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class AlertRule:
    """Defines conditions for triggering alerts."""
    id: str
    name: str
    component: str
    condition: str
    severity: AlertSeverity
    threshold: Any
    enabled: bool = True
    cooldown_minutes: int = 60
    last_triggered: Optional[str] = None

class MetricsCollector:
    """Collects system metrics for monitoring."""
    
    def __init__(self, repo_root: Path):
        self.repo_root = repo_root
    
    def run_command(self, command: str, cwd: Path = None) -> Dict[str, Any]:
        """Execute a command and return structured result."""
        start_time = time.time()
        cwd = cwd or self.repo_root
        
        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            return {
                'success': result.returncode == 0,
                'returncode': result.returncode,
                'stdout': result.stdout.strip(),
                'stderr': result.stderr.strip(),
                'duration': time.time() - start_time
            }
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'returncode': -1,
                'stdout': '',
                'stderr': 'Command timeout',
                'duration': time.time() - start_time
            }
        except Exception as e:
            return {
                'success': False,
                'returncode': -1,
                'stdout': '',
                'stderr': str(e),
                'duration': time.time() - start_time
            }
    
    def collect_git_metrics(self) -> Dict[str, Any]:
        """Collect Git repository metrics."""
        status_result = self.run_command("git status --porcelain")
        branch_result = self.run_command("git branch --show-current")
        
        changed_files = len(status_result['stdout'].split('\n')) if status_result['stdout'] else 0
        
        return {
            'clean_repository': changed_files == 0,
            'changed_files_count': changed_files,
            'current_branch': branch_result['stdout'] if branch_result['success'] else 'unknown'
        }
    
    def collect_dependency_metrics(self) -> Dict[str, Any]:
        """Collect dependency health metrics."""
        metrics = {}
        
        # Python dependencies
        python_check = self.run_command(
            "pip list --outdated --format=json",
            cwd=self.repo_root / "packages" / "vespera-scriptorium"
        )
        
        if python_check['success']:
            try:
                outdated = json.loads(python_check['stdout']) if python_check['stdout'] else []
                metrics['python_outdated_count'] = len(outdated)
            except json.JSONDecodeError:
                metrics['python_outdated_count'] = -1
        else:
            metrics['python_outdated_count'] = -1
        
        # Node.js vulnerabilities
        for package_path, package_name in [
            (self.repo_root / "vespera-utilities", "utilities"),
            (self.repo_root / "plugins" / "Obsidian" / "Vespera-Scriptorium", "obsidian")
        ]:
            if package_path.exists():
                audit_result = self.run_command(
                    "npm audit --audit-level=high --json",
                    cwd=package_path
                )
                
                if audit_result['success'] and audit_result['stdout']:
                    try:
                        audit_data = json.loads(audit_result['stdout'])
                        vulnerabilities = audit_data.get('metadata', {}).get('vulnerabilities', {})
                        high_critical = vulnerabilities.get('high', 0) + vulnerabilities.get('critical', 0)
                        metrics[f'{package_name}_vulnerabilities'] = high_critical
                    except (json.JSONDecodeError, KeyError):
                        metrics[f'{package_name}_vulnerabilities'] = -1
                else:
                    metrics[f'{package_name}_vulnerabilities'] = -1
        
        return metrics
    
    def collect_build_metrics(self) -> Dict[str, Any]:
        """Collect build status metrics."""
        metrics = {}
        
        # Check build artifacts
        packages = [
            ("scriptorium", self.repo_root / "packages" / "vespera-scriptorium" / "dist"),
            ("utilities", self.repo_root / "vespera-utilities" / "dist"),
            ("obsidian", self.repo_root / "plugins" / "Obsidian" / "Vespera-Scriptorium" / "dist")
        ]
        
        for package_name, dist_path in packages:
            if dist_path.exists():
                try:
                    # Find latest build artifact
                    files = list(dist_path.rglob('*'))
                    if files:
                        latest_file = max(files, key=lambda x: x.stat().st_mtime)
                        age_hours = (time.time() - latest_file.stat().st_mtime) / 3600
                        metrics[f'{package_name}_build_age_hours'] = age_hours
                        metrics[f'{package_name}_built'] = True
                    else:
                        metrics[f'{package_name}_build_age_hours'] = -1
                        metrics[f'{package_name}_built'] = False
                except (ValueError, OSError):
                    metrics[f'{package_name}_build_age_hours'] = -1
                    metrics[f'{package_name}_built'] = False
            else:
                metrics[f'{package_name}_build_age_hours'] = -1
                metrics[f'{package_name}_built'] = False
        
        return metrics
    
    def collect_health_metrics(self) -> Dict[str, Any]:
        """Collect system health metrics."""
        health_script = self.repo_root / "packages" / "vespera-scriptorium" / "tools" / "diagnostics" / "health_check.py"
        
        if not health_script.exists():
            return {
                'health_check_available': False,
                'overall_healthy': False
            }
        
        health_result = self.run_command(
            f"python {health_script} --health --json",
            cwd=self.repo_root / "packages" / "vespera-scriptorium"
        )
        
        if health_result['success'] and health_result['stdout']:
            try:
                health_data = json.loads(health_result['stdout'])
                return {
                    'health_check_available': True,
                    'health_check_duration': health_result['duration'],
                    'overall_healthy': health_data.get('health_checks', {}).get('overall_healthy', False)
                }
            except json.JSONDecodeError:
                return {
                    'health_check_available': True,
                    'health_check_duration': health_result['duration'],
                    'overall_healthy': False
                }
        else:
            return {
                'health_check_available': True,
                'health_check_duration': health_result['duration'],
                'overall_healthy': False
            }
    
    def collect_all_metrics(self) -> Dict[str, Any]:
        """Collect all system metrics."""
        metrics = {
            'timestamp': datetime.now().isoformat(),
            'collection_duration': 0
        }
        
        start_time = time.time()
        
        # Collect metrics from different components
        try:
            metrics.update(self.collect_git_metrics())
            metrics.update(self.collect_dependency_metrics())
            metrics.update(self.collect_build_metrics())
            metrics.update(self.collect_health_metrics())
        except Exception as e:
            logger.error(f"Error collecting metrics: {e}")
            metrics['collection_error'] = str(e)
        
        metrics['collection_duration'] = time.time() - start_time
        
        return metrics

class AlertEngine:
    """Core alerting engine that evaluates rules and triggers alerts."""
    
    def __init__(self, config_path: Path):
        self.config_path = config_path
        self.config = self.load_config()
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_history: List[Alert] = []
        
        # Load alert rules
        self.rules = self.load_rules()
        
        # Initialize notification channels
        self.notification_channels = self.initialize_channels()
    
    def load_config(self) -> Dict[str, Any]:
        """Load alerting configuration."""
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                logger.error(f"Failed to load config: {e}")
                return self.get_default_config()
        else:
            # Create default config
            config = self.get_default_config()
            self.save_config(config)
            return config
    
    def get_default_config(self) -> Dict[str, Any]:
        """Get default alerting configuration."""
        return {
            "notification_channels": {
                "console": {
                    "enabled": True
                },
                "file": {
                    "enabled": True,
                    "log_path": "alerts.log"
                },
                "email": {
                    "enabled": False,
                    "smtp_server": "",
                    "smtp_port": 587,
                    "username": "",
                    "password": "",
                    "from_email": "",
                    "to_emails": []
                },
                "webhook": {
                    "enabled": False,
                    "url": "",
                    "headers": {}
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
                    "enabled": True,
                    "cooldown_minutes": 60
                },
                {
                    "id": "outdated_dependencies",
                    "name": "Outdated Dependencies",
                    "component": "dependencies",
                    "condition": "python_outdated_count > 10",
                    "severity": "warning",
                    "threshold": 10,
                    "enabled": True,
                    "cooldown_minutes": 1440  # 24 hours
                },
                {
                    "id": "stale_builds",
                    "name": "Stale Build Artifacts",
                    "component": "builds",
                    "condition": "scriptorium_build_age_hours > 168 OR utilities_build_age_hours > 168",
                    "severity": "warning",
                    "threshold": 168,  # 1 week
                    "enabled": True,
                    "cooldown_minutes": 720  # 12 hours
                },
                {
                    "id": "health_check_failed",
                    "name": "Health Check Failed",
                    "component": "health",
                    "condition": "overall_healthy == False",
                    "severity": "error",
                    "threshold": None,
                    "enabled": True,
                    "cooldown_minutes": 30
                },
                {
                    "id": "dirty_repository",
                    "name": "Repository Has Uncommitted Changes",
                    "component": "git",
                    "condition": "clean_repository == False AND changed_files_count > 50",
                    "severity": "warning",
                    "threshold": 50,
                    "enabled": True,
                    "cooldown_minutes": 360  # 6 hours
                }
            ]
        }
    
    def save_config(self, config: Dict[str, Any]):
        """Save configuration to file."""
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, 'w') as f:
                json.dump(config, f, indent=2)
        except IOError as e:
            logger.error(f"Failed to save config: {e}")
    
    def load_rules(self) -> List[AlertRule]:
        """Load alert rules from configuration."""
        rules = []
        for rule_config in self.config.get('alert_rules', []):
            rule = AlertRule(
                id=rule_config['id'],
                name=rule_config['name'],
                component=rule_config['component'],
                condition=rule_config['condition'],
                severity=AlertSeverity(rule_config['severity']),
                threshold=rule_config.get('threshold'),
                enabled=rule_config.get('enabled', True),
                cooldown_minutes=rule_config.get('cooldown_minutes', 60)
            )
            rules.append(rule)
        
        return rules
    
    def initialize_channels(self) -> Dict[str, Any]:
        """Initialize notification channels based on configuration."""
        channels = {}
        channel_config = self.config.get('notification_channels', {})
        
        # Console channel
        if channel_config.get('console', {}).get('enabled', True):
            channels['console'] = {'type': 'console'}
        
        # File channel
        file_config = channel_config.get('file', {})
        if file_config.get('enabled', True):
            channels['file'] = {
                'type': 'file',
                'log_path': file_config.get('log_path', 'alerts.log')
            }
        
        # Email channel (if configured)
        email_config = channel_config.get('email', {})
        if email_config.get('enabled', False) and email_config.get('smtp_server'):
            channels['email'] = {
                'type': 'email',
                'config': email_config
            }
        
        # Webhook channel (if configured)
        webhook_config = channel_config.get('webhook', {})
        if webhook_config.get('enabled', False) and webhook_config.get('url'):
            channels['webhook'] = {
                'type': 'webhook',
                'config': webhook_config
            }
        
        return channels
    
    def evaluate_condition(self, condition: str, metrics: Dict[str, Any]) -> bool:
        """Evaluate alert condition against metrics."""
        try:
            # Create a safe evaluation environment
            safe_dict = {
                '__builtins__': {},
                **metrics,
                'True': True,
                'False': False,
                'None': None,
                'AND': lambda a, b: a and b,
                'OR': lambda a, b: a or b,
                'NOT': lambda a: not a
            }
            
            # Replace logical operators
            condition = condition.replace(' AND ', ' and ')
            condition = condition.replace(' OR ', ' or ')
            condition = condition.replace(' NOT ', ' not ')
            
            return eval(condition, safe_dict)
        except Exception as e:
            logger.error(f"Failed to evaluate condition '{condition}': {e}")
            return False
    
    def should_trigger_alert(self, rule: AlertRule) -> bool:
        """Check if alert should be triggered based on cooldown."""
        if not rule.last_triggered:
            return True
        
        last_triggered = datetime.fromisoformat(rule.last_triggered)
        cooldown_delta = timedelta(minutes=rule.cooldown_minutes)
        
        return datetime.now() - last_triggered >= cooldown_delta
    
    def create_alert(self, rule: AlertRule, metrics: Dict[str, Any]) -> Alert:
        """Create an alert from a rule and metrics."""
        alert_id = f"{rule.id}_{int(time.time())}"
        
        # Generate alert message based on rule and current metrics
        message_parts = [rule.name]
        
        if rule.component == 'dependencies':
            if 'python_outdated_count' in metrics and metrics['python_outdated_count'] > 0:
                message_parts.append(f"Python: {metrics['python_outdated_count']} outdated packages")
            for pkg in ['utilities', 'obsidian']:
                vuln_key = f'{pkg}_vulnerabilities'
                if vuln_key in metrics and metrics[vuln_key] > 0:
                    message_parts.append(f"{pkg.title()}: {metrics[vuln_key]} vulnerabilities")
        
        elif rule.component == 'builds':
            for pkg in ['scriptorium', 'utilities', 'obsidian']:
                age_key = f'{pkg}_build_age_hours'
                if age_key in metrics and metrics[age_key] > 0:
                    age_days = metrics[age_key] / 24
                    message_parts.append(f"{pkg.title()}: {age_days:.1f} days old")
        
        elif rule.component == 'git':
            if 'changed_files_count' in metrics:
                message_parts.append(f"{metrics['changed_files_count']} uncommitted files")
        
        elif rule.component == 'health':
            message_parts.append("System health check failed")
        
        message = ". ".join(message_parts)
        
        return Alert(
            id=alert_id,
            title=rule.name,
            message=message,
            severity=rule.severity,
            component=rule.component,
            timestamp=datetime.now().isoformat(),
            metadata={
                'rule_id': rule.id,
                'metrics_snapshot': metrics,
                'condition': rule.condition
            }
        )
    
    def send_alert(self, alert: Alert):
        """Send alert through configured notification channels."""
        for channel_name, channel_config in self.notification_channels.items():
            try:
                if channel_config['type'] == 'console':
                    self.send_console_alert(alert)
                elif channel_config['type'] == 'file':
                    self.send_file_alert(alert, channel_config['log_path'])
                elif channel_config['type'] == 'email':
                    self.send_email_alert(alert, channel_config['config'])
                elif channel_config['type'] == 'webhook':
                    self.send_webhook_alert(alert, channel_config['config'])
            except Exception as e:
                logger.error(f"Failed to send alert via {channel_name}: {e}")
    
    def send_console_alert(self, alert: Alert):
        """Send alert to console."""
        severity_icons = {
            AlertSeverity.INFO: "ℹ️",
            AlertSeverity.WARNING: "⚠️",
            AlertSeverity.ERROR: "❌",
            AlertSeverity.CRITICAL: "🚨"
        }
        
        icon = severity_icons.get(alert.severity, "📢")
        timestamp = datetime.fromisoformat(alert.timestamp).strftime("%H:%M:%S")
        
        print(f"{icon} [{timestamp}] [{alert.severity.value.upper()}] {alert.title}")
        print(f"   {alert.message}")
        print(f"   Component: {alert.component}")
        print()
    
    def send_file_alert(self, alert: Alert, log_path: str):
        """Send alert to log file."""
        log_file = Path(log_path)
        log_file.parent.mkdir(parents=True, exist_ok=True)
        
        log_entry = {
            'timestamp': alert.timestamp,
            'severity': alert.severity.value,
            'component': alert.component,
            'title': alert.title,
            'message': alert.message,
            'alert_id': alert.id
        }
        
        with open(log_file, 'a') as f:
            f.write(json.dumps(log_entry) + '\n')
    
    def send_email_alert(self, alert: Alert, email_config: Dict[str, Any]):
        """Send alert via email."""
        # This is a basic implementation - in production, you'd want more robust error handling
        try:
            msg = MIMEMultipart()
            msg['From'] = email_config['from_email']
            msg['To'] = ', '.join(email_config['to_emails'])
            msg['Subject'] = f"[Vespera Atelier] {alert.severity.value.upper()}: {alert.title}"
            
            body = f"""
Alert Details:
- Severity: {alert.severity.value.upper()}
- Component: {alert.component}
- Time: {alert.timestamp}
- Message: {alert.message}

Alert ID: {alert.id}

This is an automated alert from the Vespera Atelier monitoring system.
"""
            
            msg.attach(MIMEText(body, 'plain'))
            
            server = smtplib.SMTP(email_config['smtp_server'], email_config['smtp_port'])
            server.starttls()
            server.login(email_config['username'], email_config['password'])
            server.send_message(msg)
            server.quit()
            
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")
    
    def send_webhook_alert(self, alert: Alert, webhook_config: Dict[str, Any]):
        """Send alert via webhook."""
        import requests
        
        payload = {
            'alert_id': alert.id,
            'title': alert.title,
            'message': alert.message,
            'severity': alert.severity.value,
            'component': alert.component,
            'timestamp': alert.timestamp
        }
        
        try:
            response = requests.post(
                webhook_config['url'],
                json=payload,
                headers=webhook_config.get('headers', {}),
                timeout=10
            )
            response.raise_for_status()
        except Exception as e:
            logger.error(f"Failed to send webhook alert: {e}")
    
    def process_metrics(self, metrics: Dict[str, Any]):
        """Process metrics and trigger alerts if conditions are met."""
        triggered_alerts = []
        
        for rule in self.rules:
            if not rule.enabled:
                continue
            
            try:
                if self.evaluate_condition(rule.condition, metrics):
                    if self.should_trigger_alert(rule):
                        alert = self.create_alert(rule, metrics)
                        self.send_alert(alert)
                        
                        # Update rule last triggered time
                        rule.last_triggered = datetime.now().isoformat()
                        
                        # Store active alert
                        self.active_alerts[alert.id] = alert
                        self.alert_history.append(alert)
                        
                        triggered_alerts.append(alert)
                        
                        logger.info(f"Triggered alert: {alert.title} ({alert.severity.value})")
            
            except Exception as e:
                logger.error(f"Error processing rule {rule.id}: {e}")
        
        return triggered_alerts
    
    def get_alert_summary(self) -> Dict[str, Any]:
        """Get summary of alert status."""
        now = datetime.now()
        recent_alerts = [
            alert for alert in self.alert_history 
            if (now - datetime.fromisoformat(alert.timestamp)).days < 7
        ]
        
        severity_counts = {}
        for severity in AlertSeverity:
            severity_counts[severity.value] = len([
                alert for alert in recent_alerts 
                if alert.severity == severity
            ])
        
        return {
            'active_alerts': len(self.active_alerts),
            'recent_alerts_7d': len(recent_alerts),
            'severity_breakdown': severity_counts,
            'last_alert': recent_alerts[-1].timestamp if recent_alerts else None,
            'enabled_rules': len([rule for rule in self.rules if rule.enabled])
        }

async def monitor_continuously(alert_engine: AlertEngine, metrics_collector: MetricsCollector, 
                             interval: int = 300):
    """Continuously monitor system and trigger alerts."""
    logger.info(f"Starting continuous monitoring (interval: {interval}s)")
    
    try:
        while True:
            try:
                # Collect metrics
                metrics = metrics_collector.collect_all_metrics()
                logger.debug(f"Collected metrics: {len(metrics)} items")
                
                # Process alerts
                alerts = alert_engine.process_metrics(metrics)
                if alerts:
                    logger.info(f"Triggered {len(alerts)} alerts")
                
                # Wait for next cycle
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"Error in monitoring cycle: {e}")
                await asyncio.sleep(interval)
    
    except KeyboardInterrupt:
        logger.info("Monitoring stopped by user")

def main():
    """Main entry point for the alerting system."""
    parser = argparse.ArgumentParser(description="Vespera Atelier Alerting System")
    parser.add_argument("--config", "-c", type=str, default="alerts-config.json",
                       help="Configuration file path")
    parser.add_argument("--repo-root", "-r", type=str,
                       help="Repository root path")
    parser.add_argument("--monitor", "-m", action="store_true",
                       help="Run in continuous monitoring mode")
    parser.add_argument("--interval", "-i", type=int, default=300,
                       help="Monitoring interval in seconds (default: 300)")
    parser.add_argument("--test", "-t", action="store_true",
                       help="Run a test check and exit")
    parser.add_argument("--summary", "-s", action="store_true",
                       help="Show alert summary and exit")
    
    args = parser.parse_args()
    
    # Determine repository root
    if args.repo_root:
        repo_root = Path(args.repo_root).resolve()
    else:
        current = Path.cwd()
        repo_root = None
        
        for parent in [current] + list(current.parents):
            if (parent / ".git").exists() or (parent / "package.json").exists():
                repo_root = parent
                break
        
        if not repo_root:
            print("❌ Could not find repository root")
            return 1
    
    # Initialize components
    config_path = Path(args.config).resolve()
    alert_engine = AlertEngine(config_path)
    metrics_collector = MetricsCollector(repo_root)
    
    try:
        if args.summary:
            summary = alert_engine.get_alert_summary()
            print("📊 Alert Summary:")
            print(f"  Active alerts: {summary['active_alerts']}")
            print(f"  Recent alerts (7d): {summary['recent_alerts_7d']}")
            print(f"  Enabled rules: {summary['enabled_rules']}")
            if summary['last_alert']:
                print(f"  Last alert: {summary['last_alert']}")
        
        elif args.test:
            print("🧪 Running test check...")
            metrics = metrics_collector.collect_all_metrics()
            alerts = alert_engine.process_metrics(metrics)
            
            if alerts:
                print(f"✅ Test completed. Triggered {len(alerts)} alerts.")
            else:
                print("✅ Test completed. No alerts triggered.")
        
        elif args.monitor:
            asyncio.run(monitor_continuously(alert_engine, metrics_collector, args.interval))
        
        else:
            # Single check
            print("🔍 Running single check...")
            metrics = metrics_collector.collect_all_metrics()
            alerts = alert_engine.process_metrics(metrics)
            
            if alerts:
                print(f"⚠️ {len(alerts)} alerts triggered")
                return 1
            else:
                print("✅ No alerts triggered")
                return 0
    
    except KeyboardInterrupt:
        print("\n👋 Alerting system stopped")
        return 0
    except Exception as e:
        logger.error(f"Alerting system error: {e}")
        return 1

if __name__ == "__main__":
    exit(main())