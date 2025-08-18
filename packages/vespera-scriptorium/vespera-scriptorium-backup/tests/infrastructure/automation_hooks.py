"""
Automation Hooks for Test Infrastructure

Provides automated hooks for preventing architectural drift, ensuring test quality,
and maintaining Clean Architecture compliance throughout development.
"""

import ast
import logging
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Callable, Set
from dataclasses import dataclass
from enum import Enum
import json

from .validation_framework import ValidationFramework, ValidationLevel, ValidationResult

logger = logging.getLogger(__name__)


class HookTrigger(Enum):
    """When hooks should be triggered."""
    PRE_COMMIT = "pre_commit"
    PRE_PUSH = "pre_push"
    PRE_TEST = "pre_test"
    POST_TEST = "post_test"
    ON_FILE_CHANGE = "on_file_change"
    ON_IMPORT = "on_import"
    MANUAL = "manual"


class HookPriority(Enum):
    """Hook execution priority."""
    CRITICAL = 1    # Must pass for operation to continue
    HIGH = 2        # Important but non-blocking
    MEDIUM = 3      # Standard validation
    LOW = 4         # Nice-to-have checks


@dataclass
class HookResult:
    """Result of hook execution."""
    hook_name: str
    success: bool
    message: str
    details: Dict[str, Any] = None
    suggestions: List[str] = None
    
    def __post_init__(self):
        if self.details is None:
            self.details = {}
        if self.suggestions is None:
            self.suggestions = []


class AutomationHook:
    """Base class for automation hooks."""
    
    def __init__(
        self, 
        name: str, 
        description: str,
        trigger: HookTrigger,
        priority: HookPriority = HookPriority.MEDIUM
    ):
        self.name = name
        self.description = description
        self.trigger = trigger
        self.priority = priority
        self.enabled = True
    
    def should_execute(self, context: Dict[str, Any]) -> bool:
        """Check if hook should execute given context."""
        return self.enabled
    
    def execute(self, context: Dict[str, Any]) -> HookResult:
        """Execute the hook."""
        raise NotImplementedError("Hook must implement execute method")


class ArchitecturalDriftPreventionHook(AutomationHook):
    """Prevents architectural drift by validating layer dependencies."""
    
    def __init__(self):
        super().__init__(
            "architectural_drift_prevention",
            "Prevents violations of Clean Architecture layer boundaries",
            HookTrigger.PRE_COMMIT,
            HookPriority.CRITICAL
        )
        self.validation_framework = ValidationFramework(ValidationLevel.STRICT)
    
    def should_execute(self, context: Dict[str, Any]) -> bool:
        """Execute if Python files changed."""
        changed_files = context.get('changed_files', [])
        return any(str(f).endswith('.py') for f in changed_files)
    
    def execute(self, context: Dict[str, Any]) -> HookResult:
        """Validate changed files for architectural compliance."""
        changed_files = context.get('changed_files', [])
        python_files = [f for f in changed_files if str(f).endswith('.py')]
        
        all_issues = []
        critical_violations = 0
        
        for file_path in python_files:
            try:
                report = self.validation_framework.validate_file(Path(file_path))
                
                # Count critical violations
                for issue in report.issues:
                    if issue.severity == ValidationResult.FAIL:
                        critical_violations += 1
                        all_issues.append(f"{file_path}: {issue.message}")
            
            except Exception as e:
                logger.error(f"Error validating {file_path}: {e}")
                all_issues.append(f"{file_path}: Validation error - {e}")
        
        success = critical_violations == 0
        message = (
            f"Architectural validation {'passed' if success else 'failed'}: "
            f"{critical_violations} critical violations found"
        )
        
        suggestions = []
        if not success:
            suggestions.extend([
                "Review layer dependencies in flagged files",
                "Ensure domain layer doesn't depend on application/infrastructure",
                "Use dependency injection instead of direct imports",
                "Consider moving code to appropriate architectural layer"
            ])
        
        return HookResult(
            hook_name=self.name,
            success=success,
            message=message,
            details={
                "files_checked": len(python_files),
                "critical_violations": critical_violations,
                "issues": all_issues
            },
            suggestions=suggestions
        )


class TestCoverageEnforcementHook(AutomationHook):
    """Enforces minimum test coverage for new/changed code."""
    
    def __init__(self, min_coverage: float = 0.8):
        super().__init__(
            "test_coverage_enforcement",
            f"Ensures minimum {min_coverage*100:.0f}% test coverage for changes",
            HookTrigger.PRE_COMMIT,
            HookPriority.HIGH
        )
        self.min_coverage = min_coverage
    
    def should_execute(self, context: Dict[str, Any]) -> bool:
        """Execute if source files changed."""
        changed_files = context.get('changed_files', [])
        return any(
            str(f).endswith('.py') and '/tests/' not in str(f)
            for f in changed_files
        )
    
    def execute(self, context: Dict[str, Any]) -> HookResult:
        """Check test coverage for changed files."""
        changed_files = context.get('changed_files', [])
        source_files = [
            f for f in changed_files 
            if str(f).endswith('.py') and '/tests/' not in str(f)
        ]
        
        coverage_issues = []
        missing_tests = []
        
        for file_path in source_files:
            test_file = self._find_test_file(Path(file_path))
            if not test_file:
                missing_tests.append(str(file_path))
            else:
                # Check if test file covers the source file adequately
                coverage = self._estimate_coverage(Path(file_path), test_file)
                if coverage < self.min_coverage:
                    coverage_issues.append(
                        f"{file_path}: {coverage:.1%} coverage (min: {self.min_coverage:.1%})"
                    )
        
        total_issues = len(missing_tests) + len(coverage_issues)
        success = total_issues == 0
        
        message = (
            f"Test coverage check {'passed' if success else 'failed'}: "
            f"{len(missing_tests)} missing tests, {len(coverage_issues)} low coverage"
        )
        
        suggestions = []
        if missing_tests:
            suggestions.append("Create test files for new source files")
        if coverage_issues:
            suggestions.append("Add more test cases to improve coverage")
            suggestions.append("Test edge cases and error conditions")
        
        return HookResult(
            hook_name=self.name,
            success=success,
            message=message,
            details={
                "files_checked": len(source_files),
                "missing_tests": missing_tests,
                "coverage_issues": coverage_issues
            },
            suggestions=suggestions
        )
    
    def _find_test_file(self, source_file: Path) -> Optional[Path]:
        """Find corresponding test file."""
        # Check various test file patterns and locations
        test_patterns = [
            f"test_{source_file.stem}.py",
            f"{source_file.stem}_test.py"
        ]
        
        search_dirs = [
            source_file.parent / "tests",
            source_file.parent.parent / "tests",
            Path("tests") / source_file.parent.name
        ]
        
        for search_dir in search_dirs:
            if search_dir.exists():
                for pattern in test_patterns:
                    test_file = search_dir / pattern
                    if test_file.exists():
                        return test_file
        
        return None
    
    def _estimate_coverage(self, source_file: Path, test_file: Path) -> float:
        """Estimate test coverage (simplified heuristic)."""
        try:
            # Count functions/classes in source
            source_content = source_file.read_text()
            source_tree = ast.parse(source_content)
            
            source_items = []
            for node in ast.walk(source_tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    if not node.name.startswith('_'):  # Skip private items
                        source_items.append(node.name)
            
            if not source_items:
                return 1.0  # No testable items
            
            # Count test functions
            test_content = test_file.read_text()
            test_tree = ast.parse(test_content)
            
            test_functions = []
            for node in ast.walk(test_tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    if node.name.startswith('test_'):
                        test_functions.append(node.name)
            
            # Simple heuristic: assume each test covers one item
            coverage = min(1.0, len(test_functions) / len(source_items))
            return coverage
        
        except Exception:
            return 0.5  # Default to medium coverage if analysis fails


class DependencyInjectionValidationHook(AutomationHook):
    """Validates proper dependency injection usage."""
    
    def __init__(self):
        super().__init__(
            "dependency_injection_validation",
            "Ensures proper dependency injection patterns are followed",
            HookTrigger.PRE_COMMIT,
            HookPriority.HIGH
        )
    
    def should_execute(self, context: Dict[str, Any]) -> bool:
        """Execute for application and domain layer changes."""
        changed_files = context.get('changed_files', [])
        return any(
            ('/domain/' in str(f) or '/application/' in str(f)) and str(f).endswith('.py')
            for f in changed_files
        )
    
    def execute(self, context: Dict[str, Any]) -> HookResult:
        """Validate dependency injection usage."""
        changed_files = context.get('changed_files', [])
        relevant_files = [
            f for f in changed_files
            if ('/domain/' in str(f) or '/application/' in str(f)) and str(f).endswith('.py')
        ]
        
        violations = []
        
        for file_path in relevant_files:
            file_violations = self._check_di_violations(Path(file_path))
            violations.extend([(str(file_path), v) for v in file_violations])
        
        success = len(violations) == 0
        message = (
            f"Dependency injection validation {'passed' if success else 'failed'}: "
            f"{len(violations)} violations found"
        )
        
        suggestions = []
        if violations:
            suggestions.extend([
                "Use constructor injection instead of direct instantiation",
                "Add type annotations for injected dependencies",
                "Avoid singleton patterns in favor of DI container",
                "Use interfaces for dependencies between layers"
            ])
        
        return HookResult(
            hook_name=self.name,
            success=success,
            message=message,
            details={
                "files_checked": len(relevant_files),
                "violations": violations
            },
            suggestions=suggestions
        )
    
    def _check_di_violations(self, file_path: Path) -> List[str]:
        """Check file for DI violations."""
        violations = []
        
        try:
            content = file_path.read_text()
            tree = ast.parse(content)
            
            # Check for direct instantiation of repositories/services
            for node in ast.walk(tree):
                if isinstance(node, ast.Call):
                    if isinstance(node.func, ast.Name):
                        if (node.func.id.endswith('Repository') or 
                            node.func.id.endswith('Service')):
                            violations.append(
                                f"Direct instantiation of {node.func.id} on line {node.lineno}"
                            )
                
                # Check for global variables
                elif isinstance(node, ast.Global):
                    violations.append(f"Global variable usage on line {node.lineno}")
        
        except Exception as e:
            violations.append(f"Analysis error: {e}")
        
        return violations


class TestQualityEnforcementHook(AutomationHook):
    """Enforces test quality standards."""
    
    def __init__(self):
        super().__init__(
            "test_quality_enforcement",
            "Ensures test files follow quality standards",
            HookTrigger.PRE_COMMIT,
            HookPriority.MEDIUM
        )
    
    def should_execute(self, context: Dict[str, Any]) -> bool:
        """Execute if test files changed."""
        changed_files = context.get('changed_files', [])
        return any('/tests/' in str(f) and str(f).endswith('.py') for f in changed_files)
    
    def execute(self, context: Dict[str, Any]) -> HookResult:
        """Validate test file quality."""
        changed_files = context.get('changed_files', [])
        test_files = [
            f for f in changed_files 
            if '/tests/' in str(f) and str(f).endswith('.py')
        ]
        
        quality_issues = []
        
        for file_path in test_files:
            issues = self._check_test_quality(Path(file_path))
            quality_issues.extend([(str(file_path), issue) for issue in issues])
        
        success = len(quality_issues) == 0
        message = (
            f"Test quality check {'passed' if success else 'failed'}: "
            f"{len(quality_issues)} issues found"
        )
        
        suggestions = []
        if quality_issues:
            suggestions.extend([
                "Use descriptive test function names",
                "Add docstrings to test functions",
                "Use appropriate test base classes",
                "Follow AAA pattern (Arrange, Act, Assert)",
                "Use proper async test decorators"
            ])
        
        return HookResult(
            hook_name=self.name,
            success=success,
            message=message,
            details={
                "files_checked": len(test_files),
                "quality_issues": quality_issues
            },
            suggestions=suggestions
        )
    
    def _check_test_quality(self, file_path: Path) -> List[str]:
        """Check test file quality."""
        issues = []
        
        try:
            content = file_path.read_text()
            tree = ast.parse(content)
            
            test_functions = []
            has_pytest_import = 'import pytest' in content
            
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    if node.name.startswith('test_'):
                        test_functions.append(node)
                        
                        # Check for docstring
                        if not ast.get_docstring(node):
                            issues.append(f"Test function {node.name} lacks docstring")
                        
                        # Check for descriptive name
                        if len(node.name) < 10:
                            issues.append(f"Test function {node.name} has non-descriptive name")
                        
                        # Check async functions have proper decorators
                        if isinstance(node, ast.AsyncFunctionDef):
                            has_async_marker = any(
                                isinstance(d, ast.Call) and
                                isinstance(d.func, ast.Attribute) and
                                d.func.attr == 'asyncio'
                                for d in node.decorator_list
                            )
                            if not has_async_marker and not has_pytest_import:
                                issues.append(f"Async test {node.name} may need @pytest.mark.asyncio")
            
            if not test_functions:
                issues.append("No test functions found")
        
        except Exception as e:
            issues.append(f"Analysis error: {e}")
        
        return issues


class HookManager:
    """Manages and executes automation hooks."""
    
    def __init__(self):
        self.hooks: Dict[HookTrigger, List[AutomationHook]] = {}
        self._register_default_hooks()
    
    def _register_default_hooks(self):
        """Register default automation hooks."""
        self.register_hook(ArchitecturalDriftPreventionHook())
        self.register_hook(TestCoverageEnforcementHook())
        self.register_hook(DependencyInjectionValidationHook())
        self.register_hook(TestQualityEnforcementHook())
    
    def register_hook(self, hook: AutomationHook):
        """Register a hook for execution."""
        if hook.trigger not in self.hooks:
            self.hooks[hook.trigger] = []
        self.hooks[hook.trigger].append(hook)
    
    def unregister_hook(self, hook_name: str):
        """Unregister a hook."""
        for trigger, hooks in self.hooks.items():
            self.hooks[trigger] = [h for h in hooks if h.name != hook_name]
    
    def execute_hooks(self, trigger: HookTrigger, context: Dict[str, Any]) -> List[HookResult]:
        """Execute all hooks for a trigger."""
        if trigger not in self.hooks:
            return []
        
        hooks = self.hooks[trigger]
        # Sort by priority
        hooks.sort(key=lambda h: h.priority.value)
        
        results = []
        for hook in hooks:
            if hook.should_execute(context):
                try:
                    result = hook.execute(context)
                    results.append(result)
                    
                    # Stop on critical failures
                    if hook.priority == HookPriority.CRITICAL and not result.success:
                        logger.error(f"Critical hook {hook.name} failed: {result.message}")
                        break
                
                except Exception as e:
                    logger.error(f"Hook {hook.name} execution failed: {e}")
                    results.append(HookResult(
                        hook_name=hook.name,
                        success=False,
                        message=f"Hook execution error: {e}"
                    ))
        
        return results
    
    def get_failed_hooks(self, results: List[HookResult]) -> List[HookResult]:
        """Get failed hook results."""
        return [r for r in results if not r.success]
    
    def get_critical_failures(self, results: List[HookResult]) -> List[HookResult]:
        """Get critical failure results."""
        critical_hooks = {h.name for hooks in self.hooks.values() for h in hooks 
                         if h.priority == HookPriority.CRITICAL}
        return [r for r in results if not r.success and r.hook_name in critical_hooks]


# Git integration functions

def get_changed_files() -> List[Path]:
    """Get list of changed files from git."""
    try:
        # Get staged files
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            capture_output=True,
            text=True,
            check=True
        )
        
        staged_files = [Path(f.strip()) for f in result.stdout.split('\n') if f.strip()]
        
        # Get unstaged files
        result = subprocess.run(
            ["git", "diff", "--name-only"],
            capture_output=True,
            text=True,
            check=True
        )
        
        unstaged_files = [Path(f.strip()) for f in result.stdout.split('\n') if f.strip()]
        
        # Combine and deduplicate
        all_files = list(set(staged_files + unstaged_files))
        return [f for f in all_files if f.exists()]
    
    except subprocess.CalledProcessError:
        logger.warning("Could not get changed files from git")
        return []


def create_pre_commit_hook() -> str:
    """Create pre-commit hook script."""
    script = '''#!/usr/bin/env python3
"""
Pre-commit hook for Vespera Scriptorium.
Runs architectural validation and quality checks.
"""

import sys
from pathlib import Path

# Add project to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from tests.infrastructure.automation_hooks import HookManager, HookTrigger, get_changed_files

def main():
    hook_manager = HookManager()
    changed_files = get_changed_files()
    
    context = {
        'changed_files': changed_files,
        'trigger': HookTrigger.PRE_COMMIT
    }
    
    results = hook_manager.execute_hooks(HookTrigger.PRE_COMMIT, context)
    
    # Check for critical failures
    critical_failures = hook_manager.get_critical_failures(results)
    if critical_failures:
        print("❌ Critical validation failures:")
        for failure in critical_failures:
            print(f"   {failure.hook_name}: {failure.message}")
            for suggestion in failure.suggestions:
                print(f"   💡 {suggestion}")
        return 1
    
    # Report all results
    failed_hooks = hook_manager.get_failed_hooks(results)
    if failed_hooks:
        print("⚠️  Validation warnings:")
        for failure in failed_hooks:
            print(f"   {failure.hook_name}: {failure.message}")
    else:
        print("✅ All validation checks passed")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
'''
    return script


def install_git_hooks():
    """Install git hooks for automation."""
    git_dir = Path(".git")
    if not git_dir.exists():
        logger.error("Not in a git repository")
        return False
    
    hooks_dir = git_dir / "hooks"
    hooks_dir.mkdir(exist_ok=True)
    
    # Install pre-commit hook
    pre_commit_hook = hooks_dir / "pre-commit"
    pre_commit_hook.write_text(create_pre_commit_hook())
    pre_commit_hook.chmod(0o755)
    
    logger.info("Git hooks installed successfully")
    return True


# Convenience functions for integration

def run_pre_commit_validation() -> bool:
    """Run pre-commit validation manually."""
    hook_manager = HookManager()
    changed_files = get_changed_files()
    
    context = {
        'changed_files': changed_files,
        'trigger': HookTrigger.PRE_COMMIT
    }
    
    results = hook_manager.execute_hooks(HookTrigger.PRE_COMMIT, context)
    critical_failures = hook_manager.get_critical_failures(results)
    
    return len(critical_failures) == 0


def run_test_validation(test_files: List[Path]) -> bool:
    """Run validation for test files."""
    hook_manager = HookManager()
    
    context = {
        'changed_files': test_files,
        'trigger': HookTrigger.PRE_TEST
    }
    
    results = hook_manager.execute_hooks(HookTrigger.PRE_TEST, context)
    failed_hooks = hook_manager.get_failed_hooks(results)
    
    return len(failed_hooks) == 0


# Global hook manager instance
global_hook_manager = HookManager()