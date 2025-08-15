#!/usr/bin/env python3
"""
Vespera Atelier Monitoring Dashboard

A comprehensive monitoring dashboard for the Vespera Atelier monorepo.
Provides real-time status, metrics, and health information.
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
import subprocess
import sys
from typing import Dict, List, Optional, Any
import argparse

# Try to import rich for better terminal output
try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.layout import Layout
    from rich.live import Live
    from rich.text import Text
    from rich.progress import Progress, SpinnerColumn, TextColumn
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print("Rich not available. Install with: pip install rich")

class MonitoringDashboard:
    """Main monitoring dashboard class."""
    
    def __init__(self, repo_root: Path):
        self.repo_root = repo_root
        self.console = Console() if RICH_AVAILABLE else None
        self.metrics = {}
        self.last_update = None
        
    def run_command(self, command: str, cwd: Path = None) -> Dict[str, Any]:
        """Run a shell command and return result with metrics."""
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
            
            duration = time.time() - start_time
            
            return {
                'success': result.returncode == 0,
                'returncode': result.returncode,
                'stdout': result.stdout.strip(),
                'stderr': result.stderr.strip(),
                'duration': duration,
                'command': command
            }
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'returncode': -1,
                'stdout': '',
                'stderr': 'Command timed out',
                'duration': time.time() - start_time,
                'command': command
            }
        except Exception as e:
            return {
                'success': False,
                'returncode': -1,
                'stdout': '',
                'stderr': str(e),
                'duration': time.time() - start_time,
                'command': command
            }
    
    def check_git_status(self) -> Dict[str, Any]:
        """Check git repository status."""
        git_status = self.run_command("git status --porcelain")
        git_branch = self.run_command("git branch --show-current")
        git_commits = self.run_command("git log --oneline -5")
        
        # Count file changes
        changed_files = len(git_status['stdout'].split('\n')) if git_status['stdout'] else 0
        
        return {
            'status': 'clean' if changed_files == 0 else 'dirty',
            'changed_files': changed_files,
            'current_branch': git_branch['stdout'],
            'recent_commits': git_commits['stdout'].split('\n')[:3],
            'last_commit': git_commits['stdout'].split('\n')[0] if git_commits['stdout'] else 'No commits'
        }
    
    def check_dependencies(self) -> Dict[str, Any]:
        """Check dependency status across all packages."""
        results = {}
        
        # Check Python dependencies
        python_result = self.run_command(
            "pip list --outdated --format=json",
            cwd=self.repo_root / "packages" / "vespera-scriptorium"
        )
        
        python_outdated = 0
        if python_result['success'] and python_result['stdout']:
            try:
                outdated_packages = json.loads(python_result['stdout'])
                python_outdated = len(outdated_packages)
            except json.JSONDecodeError:
                python_outdated = -1
        
        results['python'] = {
            'outdated_count': python_outdated,
            'status': 'ok' if python_outdated == 0 else 'outdated' if python_outdated > 0 else 'error'
        }
        
        # Check Node.js dependencies - utilities
        if (self.repo_root / "vespera-utilities" / "package.json").exists():
            npm_audit = self.run_command(
                "npm audit --audit-level=moderate --json",
                cwd=self.repo_root / "vespera-utilities"
            )
            
            npm_vulnerabilities = 0
            if npm_audit['success'] and npm_audit['stdout']:
                try:
                    audit_data = json.loads(npm_audit['stdout'])
                    vulnerabilities = audit_data.get('metadata', {}).get('vulnerabilities', {})
                    npm_vulnerabilities = sum(vulnerabilities.values())
                except (json.JSONDecodeError, KeyError):
                    npm_vulnerabilities = -1
            
            results['node_utilities'] = {
                'vulnerabilities': npm_vulnerabilities,
                'status': 'ok' if npm_vulnerabilities == 0 else 'vulnerable' if npm_vulnerabilities > 0 else 'error'
            }
        
        # Check Node.js dependencies - Obsidian plugin
        if (self.repo_root / "plugins" / "Obsidian" / "Vespera-Scriptorium" / "package.json").exists():
            npm_audit_obsidian = self.run_command(
                "npm audit --audit-level=moderate --json",
                cwd=self.repo_root / "plugins" / "Obsidian" / "Vespera-Scriptorium"
            )
            
            obsidian_vulnerabilities = 0
            if npm_audit_obsidian['success'] and npm_audit_obsidian['stdout']:
                try:
                    audit_data = json.loads(npm_audit_obsidian['stdout'])
                    vulnerabilities = audit_data.get('metadata', {}).get('vulnerabilities', {})
                    obsidian_vulnerabilities = sum(vulnerabilities.values())
                except (json.JSONDecodeError, KeyError):
                    obsidian_vulnerabilities = -1
            
            results['node_obsidian'] = {
                'vulnerabilities': obsidian_vulnerabilities,
                'status': 'ok' if obsidian_vulnerabilities == 0 else 'vulnerable' if obsidian_vulnerabilities > 0 else 'error'
            }
        
        return results
    
    def check_build_status(self) -> Dict[str, Any]:
        """Check build status for all packages."""
        results = {}
        
        # Check if build artifacts exist
        packages = [
            ("vespera-scriptorium", self.repo_root / "packages" / "vespera-scriptorium" / "dist"),
            ("vespera-utilities", self.repo_root / "vespera-utilities" / "dist"),
            ("obsidian-plugin", self.repo_root / "plugins" / "Obsidian" / "Vespera-Scriptorium" / "dist")
        ]
        
        for package_name, dist_path in packages:
            if dist_path.exists():
                # Check age of build artifacts
                try:
                    latest_file = max(dist_path.rglob('*'), key=lambda x: x.stat().st_mtime)
                    build_age = time.time() - latest_file.stat().st_mtime
                    age_hours = build_age / 3600
                    
                    results[package_name] = {
                        'built': True,
                        'age_hours': age_hours,
                        'status': 'fresh' if age_hours < 24 else 'stale' if age_hours < 168 else 'old'
                    }
                except (ValueError, OSError):
                    results[package_name] = {
                        'built': False,
                        'age_hours': -1,
                        'status': 'missing'
                    }
            else:
                results[package_name] = {
                    'built': False,
                    'age_hours': -1,
                    'status': 'missing'
                }
        
        return results
    
    def check_health_status(self) -> Dict[str, Any]:
        """Check health status using existing health check tools."""
        health_script = self.repo_root / "packages" / "vespera-scriptorium" / "tools" / "diagnostics" / "health_check.py"
        
        if not health_script.exists():
            return {
                'status': 'unknown',
                'message': 'Health check script not found'
            }
        
        # Run health check
        result = self.run_command(
            f"python {health_script} --health --json",
            cwd=self.repo_root / "packages" / "vespera-scriptorium"
        )
        
        if result['success'] and result['stdout']:
            try:
                health_data = json.loads(result['stdout'])
                overall_healthy = health_data.get('health_checks', {}).get('overall_healthy', False)
                
                return {
                    'status': 'healthy' if overall_healthy else 'unhealthy',
                    'message': 'Health check completed',
                    'data': health_data
                }
            except json.JSONDecodeError:
                return {
                    'status': 'error',
                    'message': 'Failed to parse health check output'
                }
        else:
            return {
                'status': 'error',
                'message': f"Health check failed: {result['stderr']}"
            }
    
    def check_ci_status(self) -> Dict[str, Any]:
        """Check CI/CD status by examining workflow files."""
        workflows_dir = self.repo_root / ".github" / "workflows"
        
        if not workflows_dir.exists():
            return {'status': 'missing', 'workflows': []}
        
        workflows = []
        for workflow_file in workflows_dir.glob("*.yml"):
            workflows.append({
                'name': workflow_file.stem,
                'file': workflow_file.name,
                'exists': True
            })
        
        # Check for essential workflows
        essential_workflows = ['ci', 'quality', 'health-check', 'maintenance']
        missing_workflows = []
        
        for essential in essential_workflows:
            if not any(w['name'] == essential for w in workflows):
                missing_workflows.append(essential)
        
        status = 'complete' if not missing_workflows else 'incomplete'
        
        return {
            'status': status,
            'workflows': workflows,
            'missing': missing_workflows,
            'total_count': len(workflows)
        }
    
    def collect_metrics(self) -> Dict[str, Any]:
        """Collect all monitoring metrics."""
        print("Collecting metrics...")
        
        metrics = {
            'timestamp': datetime.now().isoformat(),
            'git': self.check_git_status(),
            'dependencies': self.check_dependencies(),
            'builds': self.check_build_status(),
            'health': self.check_health_status(),
            'ci_cd': self.check_ci_status()
        }
        
        self.metrics = metrics
        self.last_update = datetime.now()
        
        return metrics
    
    def create_status_table(self) -> Table:
        """Create a status summary table."""
        table = Table(title="Vespera Atelier System Status")
        
        table.add_column("Component", style="cyan", no_wrap=True)
        table.add_column("Status", style="green")
        table.add_column("Details", style="yellow")
        
        if not self.metrics:
            table.add_row("No data", "❌", "Run collect_metrics() first")
            return table
        
        # Git status
        git_status = self.metrics['git']['status']
        git_icon = "✅" if git_status == 'clean' else "⚠️"
        git_details = f"Branch: {self.metrics['git']['current_branch']}, Changes: {self.metrics['git']['changed_files']}"
        table.add_row("Git Repository", f"{git_icon} {git_status.title()}", git_details)
        
        # Dependencies
        deps = self.metrics['dependencies']
        all_deps_ok = all(dep['status'] == 'ok' for dep in deps.values())
        deps_icon = "✅" if all_deps_ok else "⚠️"
        deps_details = f"Python: {deps.get('python', {}).get('outdated_count', 'N/A')} outdated"
        table.add_row("Dependencies", f"{deps_icon} {'OK' if all_deps_ok else 'Issues'}", deps_details)
        
        # Builds
        builds = self.metrics['builds']
        all_built = all(build['built'] for build in builds.values())
        builds_icon = "✅" if all_built else "❌"
        build_count = sum(1 for build in builds.values() if build['built'])
        builds_details = f"{build_count}/{len(builds)} packages built"
        table.add_row("Build Status", f"{builds_icon} {'Built' if all_built else 'Missing'}", builds_details)
        
        # Health
        health_status = self.metrics['health']['status']
        health_icon = {"healthy": "✅", "unhealthy": "❌", "error": "⚠️", "unknown": "❓"}.get(health_status, "❓")
        table.add_row("Health Check", f"{health_icon} {health_status.title()}", self.metrics['health']['message'])
        
        # CI/CD
        ci_status = self.metrics['ci_cd']['status']
        ci_icon = "✅" if ci_status == 'complete' else "⚠️"
        ci_details = f"{self.metrics['ci_cd']['total_count']} workflows configured"
        table.add_row("CI/CD", f"{ci_icon} {ci_status.title()}", ci_details)
        
        return table
    
    def create_details_panel(self) -> Panel:
        """Create a detailed information panel."""
        if not self.metrics:
            return Panel("No metrics available", title="Details")
        
        content = []
        
        # Recent commits
        content.append("🔄 Recent Commits:")
        for commit in self.metrics['git']['recent_commits'][:3]:
            content.append(f"  • {commit}")
        
        content.append("")
        
        # Dependency details
        content.append("📦 Dependencies:")
        deps = self.metrics['dependencies']
        for package, info in deps.items():
            status_icon = {"ok": "✅", "outdated": "⚠️", "vulnerable": "❌", "error": "❓"}.get(info['status'], "❓")
            if package == 'python':
                content.append(f"  {status_icon} Python: {info['outdated_count']} outdated packages")
            else:
                content.append(f"  {status_icon} {package}: {info.get('vulnerabilities', 'N/A')} vulnerabilities")
        
        content.append("")
        
        # Build details
        content.append("🔨 Build Status:")
        for package, info in self.metrics['builds'].items():
            status_icon = {"fresh": "✅", "stale": "⚠️", "old": "❌", "missing": "❌"}.get(info['status'], "❓")
            if info['built']:
                age_desc = f"{info['age_hours']:.1f}h ago" if info['age_hours'] >= 0 else "unknown age"
                content.append(f"  {status_icon} {package}: built {age_desc}")
            else:
                content.append(f"  {status_icon} {package}: not built")
        
        return Panel("\n".join(content), title="System Details")
    
    def create_dashboard_layout(self) -> Layout:
        """Create the full dashboard layout."""
        layout = Layout()
        
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="main"),
            Layout(name="footer", size=3)
        )
        
        layout["main"].split_row(
            Layout(name="status"),
            Layout(name="details")
        )
        
        # Header
        header_text = Text("Vespera Atelier Monitoring Dashboard", style="bold blue")
        if self.last_update:
            header_text.append(f"\nLast updated: {self.last_update.strftime('%Y-%m-%d %H:%M:%S')}")
        layout["header"] = Panel(header_text, title="Dashboard")
        
        # Status table
        layout["status"] = Panel(self.create_status_table(), title="Status Overview")
        
        # Details panel
        layout["details"] = self.create_details_panel()
        
        # Footer
        footer_text = "Press Ctrl+C to exit | Run with --continuous for auto-refresh"
        layout["footer"] = Panel(footer_text, title="Controls")
        
        return layout
    
    def display_dashboard(self, continuous: bool = False, refresh_interval: int = 30):
        """Display the monitoring dashboard."""
        if not RICH_AVAILABLE:
            return self.display_simple_dashboard(continuous, refresh_interval)
        
        if continuous:
            with Live(self.create_dashboard_layout(), refresh_per_second=0.1) as live:
                try:
                    while True:
                        self.collect_metrics()
                        live.update(self.create_dashboard_layout())
                        time.sleep(refresh_interval)
                except KeyboardInterrupt:
                    pass
        else:
            self.collect_metrics()
            self.console.print(self.create_dashboard_layout())
    
    def display_simple_dashboard(self, continuous: bool = False, refresh_interval: int = 30):
        """Display a simple text-based dashboard for when rich is not available."""
        def print_dashboard():
            self.collect_metrics()
            
            print("\n" + "="*60)
            print("VESPERA ATELIER MONITORING DASHBOARD")
            print("="*60)
            print(f"Last updated: {self.last_update.strftime('%Y-%m-%d %H:%M:%S') if self.last_update else 'Never'}")
            print()
            
            # Status summary
            print("STATUS SUMMARY:")
            print("-" * 30)
            
            # Git
            git = self.metrics['git']
            git_icon = "✓" if git['status'] == 'clean' else "!"
            print(f"[{git_icon}] Git: {git['status']} ({git['changed_files']} changes)")
            
            # Dependencies
            deps = self.metrics['dependencies']
            all_deps_ok = all(dep['status'] == 'ok' for dep in deps.values())
            deps_icon = "✓" if all_deps_ok else "!"
            print(f"[{deps_icon}] Dependencies: {'OK' if all_deps_ok else 'Issues'}")
            
            # Builds
            builds = self.metrics['builds']
            all_built = all(build['built'] for build in builds.values())
            builds_icon = "✓" if all_built else "!"
            build_count = sum(1 for build in builds.values() if build['built'])
            print(f"[{builds_icon}] Builds: {build_count}/{len(builds)} packages")
            
            # Health
            health = self.metrics['health']
            health_icon = "✓" if health['status'] == 'healthy' else "!"
            print(f"[{health_icon}] Health: {health['status']}")
            
            # CI/CD
            ci = self.metrics['ci_cd']
            ci_icon = "✓" if ci['status'] == 'complete' else "!"
            print(f"[{ci_icon}] CI/CD: {ci['total_count']} workflows")
            
            print()
            print("DETAILS:")
            print("-" * 30)
            
            # Recent commits
            print("Recent commits:")
            for commit in git['recent_commits'][:3]:
                print(f"  • {commit}")
            
            # Dependencies detail
            print("\nDependencies:")
            for package, info in deps.items():
                if package == 'python':
                    print(f"  • Python: {info['outdated_count']} outdated")
                else:
                    print(f"  • {package}: {info.get('vulnerabilities', 'N/A')} vulnerabilities")
            
            print("\n" + "="*60)
        
        if continuous:
            try:
                while True:
                    print_dashboard()
                    time.sleep(refresh_interval)
            except KeyboardInterrupt:
                print("\nDashboard stopped.")
        else:
            print_dashboard()
    
    def export_metrics(self, output_file: Path):
        """Export metrics to JSON file."""
        if not self.metrics:
            self.collect_metrics()
        
        with open(output_file, 'w') as f:
            json.dump(self.metrics, f, indent=2)
        
        print(f"Metrics exported to: {output_file}")

def main():
    """Main entry point for the monitoring dashboard."""
    parser = argparse.ArgumentParser(description="Vespera Atelier Monitoring Dashboard")
    parser.add_argument("--continuous", "-c", action="store_true", 
                       help="Run in continuous mode with auto-refresh")
    parser.add_argument("--interval", "-i", type=int, default=30,
                       help="Refresh interval in seconds (default: 30)")
    parser.add_argument("--export", "-e", type=str,
                       help="Export metrics to JSON file")
    parser.add_argument("--repo-root", "-r", type=str,
                       help="Repository root path (auto-detected if not specified)")
    
    args = parser.parse_args()
    
    # Determine repository root
    if args.repo_root:
        repo_root = Path(args.repo_root).resolve()
    else:
        # Try to find repository root
        current = Path.cwd()
        repo_root = None
        
        for parent in [current] + list(current.parents):
            if (parent / ".git").exists() or (parent / "package.json").exists():
                repo_root = parent
                break
        
        if not repo_root:
            print("❌ Could not find repository root. Please specify with --repo-root")
            sys.exit(1)
    
    print(f"📊 Monitoring repository: {repo_root}")
    
    # Create dashboard
    dashboard = MonitoringDashboard(repo_root)
    
    try:
        if args.export:
            dashboard.export_metrics(Path(args.export))
        else:
            dashboard.display_dashboard(args.continuous, args.interval)
    except KeyboardInterrupt:
        print("\n👋 Dashboard stopped.")
    except Exception as e:
        print(f"❌ Dashboard error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()