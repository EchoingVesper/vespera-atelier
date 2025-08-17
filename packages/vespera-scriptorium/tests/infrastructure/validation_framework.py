"""
Test Validation Framework

Provides automated validation hooks and quality gates to prevent
architectural drift and ensure Clean Architecture compliance.
"""

import ast
import inspect
import importlib
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Type, Union, Callable
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class ValidationLevel(Enum):
    """Validation strictness levels."""
    BASIC = "basic"
    STANDARD = "standard"
    STRICT = "strict"
    COMPREHENSIVE = "comprehensive"


class ValidationResult(Enum):
    """Validation result status."""
    PASS = "pass"
    WARNING = "warning"
    FAIL = "fail"
    SKIP = "skip"


@dataclass
class ValidationIssue:
    """Represents a validation issue."""
    rule_name: str
    severity: ValidationResult
    message: str
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    suggestion: Optional[str] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class ValidationReport:
    """Comprehensive validation report."""
    total_checks: int
    passed: int
    warnings: int
    failures: int
    skipped: int
    issues: List[ValidationIssue]
    execution_time: float
    validation_level: ValidationLevel
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        if self.total_checks == 0:
            return 0.0
        return (self.passed + self.warnings) / self.total_checks
    
    @property
    def has_failures(self) -> bool:
        """Check if there are any failures."""
        return self.failures > 0
    
    def get_issues_by_severity(self, severity: ValidationResult) -> List[ValidationIssue]:
        """Get issues by severity level."""
        return [issue for issue in self.issues if issue.severity == severity]


class ValidationRule(ABC):
    """Abstract base class for validation rules."""
    
    def __init__(self, name: str, description: str, level: ValidationLevel = ValidationLevel.STANDARD):
        self.name = name
        self.description = description
        self.level = level
    
    @abstractmethod
    def validate(self, target: Any, context: Dict[str, Any] = None) -> List[ValidationIssue]:
        """Execute validation rule."""
        pass
    
    def is_applicable(self, target: Any, context: Dict[str, Any] = None) -> bool:
        """Check if rule applies to target."""
        return True


class ArchitecturalLayerValidator(ValidationRule):
    """Validates Clean Architecture layer separation."""
    
    def __init__(self):
        super().__init__(
            "architectural_layer_separation",
            "Ensures proper separation between domain, application, and infrastructure layers",
            ValidationLevel.STRICT
        )
        
        # Define allowed dependencies between layers
        self.allowed_dependencies = {
            "domain": [],  # Domain depends on nothing
            "application": ["domain"],  # Application can depend on domain
            "infrastructure": ["domain", "application"],  # Infrastructure can depend on both
            "presentation": ["application", "domain"]  # Presentation can depend on application and domain
        }
    
    def validate(self, target: Any, context: Dict[str, Any] = None) -> List[ValidationIssue]:
        """Validate architectural layer dependencies."""
        issues = []
        
        if isinstance(target, str) and Path(target).exists():
            # Validate file path
            issues.extend(self._validate_file_dependencies(Path(target)))
        elif inspect.ismodule(target):
            # Validate module
            issues.extend(self._validate_module_dependencies(target))
        elif inspect.isclass(target):
            # Validate class
            issues.extend(self._validate_class_dependencies(target))
        
        return issues
    
    def _validate_file_dependencies(self, file_path: Path) -> List[ValidationIssue]:
        """Validate dependencies in a Python file."""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Parse AST to find imports
            tree = ast.parse(content)
            
            # Determine file's layer
            file_layer = self._determine_layer_from_path(file_path)
            if not file_layer:
                return issues
            
            # Check imports
            for node in ast.walk(tree):
                if isinstance(node, (ast.Import, ast.ImportFrom)):
                    import_issues = self._validate_import_node(node, file_layer, file_path)
                    issues.extend(import_issues)
        
        except Exception as e:
            issues.append(ValidationIssue(
                rule_name=self.name,
                severity=ValidationResult.WARNING,
                message=f"Could not analyze file {file_path}: {str(e)}",
                file_path=str(file_path)
            ))
        
        return issues
    
    def _validate_module_dependencies(self, module) -> List[ValidationIssue]:
        """Validate module dependencies."""
        issues = []
        
        module_path = getattr(module, '__file__', None)
        if not module_path:
            return issues
        
        module_layer = self._determine_layer_from_path(Path(module_path))
        if not module_layer:
            return issues
        
        # Check module imports
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if inspect.ismodule(attr):
                attr_path = getattr(attr, '__file__', None)
                if attr_path:
                    attr_layer = self._determine_layer_from_path(Path(attr_path))
                    if attr_layer and not self._is_dependency_allowed(module_layer, attr_layer):
                        issues.append(ValidationIssue(
                            rule_name=self.name,
                            severity=ValidationResult.FAIL,
                            message=f"Invalid dependency: {module_layer} layer cannot depend on {attr_layer} layer",
                            file_path=module_path,
                            suggestion=f"Consider moving dependency to appropriate layer or using dependency injection"
                        ))
        
        return issues
    
    def _validate_class_dependencies(self, cls: Type) -> List[ValidationIssue]:
        """Validate class dependencies."""
        issues = []
        
        # Check class module location
        class_module = inspect.getmodule(cls)
        if not class_module:
            return issues
        
        class_path = getattr(class_module, '__file__', None)
        if not class_path:
            return issues
        
        class_layer = self._determine_layer_from_path(Path(class_path))
        if not class_layer:
            return issues
        
        # Check constructor dependencies
        try:
            sig = inspect.signature(cls.__init__)
            for param_name, param in sig.parameters.items():
                if param_name == 'self':
                    continue
                
                # Check parameter type annotations
                if param.annotation != inspect.Parameter.empty:
                    param_issues = self._validate_type_dependency(
                        param.annotation, class_layer, class_path
                    )
                    issues.extend(param_issues)
        
        except Exception as e:
            issues.append(ValidationIssue(
                rule_name=self.name,
                severity=ValidationResult.WARNING,
                message=f"Could not analyze class {cls.__name__}: {str(e)}",
                file_path=class_path
            ))
        
        return issues
    
    def _determine_layer_from_path(self, file_path: Path) -> Optional[str]:
        """Determine architectural layer from file path."""
        path_str = str(file_path).lower()
        
        if '/domain/' in path_str or '\\domain\\' in path_str:
            return 'domain'
        elif '/application/' in path_str or '\\application\\' in path_str:
            return 'application'
        elif '/infrastructure/' in path_str or '\\infrastructure\\' in path_str:
            return 'infrastructure'
        elif '/presentation/' in path_str or '\\presentation\\' in path_str:
            return 'presentation'
        elif '/tests/' in path_str or '\\tests\\' in path_str:
            return 'tests'  # Tests can depend on anything
        
        return None
    
    def _is_dependency_allowed(self, from_layer: str, to_layer: str) -> bool:
        """Check if dependency between layers is allowed."""
        if from_layer == 'tests':
            return True  # Tests can depend on anything
        
        allowed = self.allowed_dependencies.get(from_layer, [])
        return to_layer in allowed
    
    def _validate_import_node(self, node: Union[ast.Import, ast.ImportFrom], file_layer: str, file_path: Path) -> List[ValidationIssue]:
        """Validate import statement."""
        issues = []
        
        try:
            if isinstance(node, ast.ImportFrom):
                module_name = node.module
            else:
                module_name = node.names[0].name if node.names else None
            
            if not module_name:
                return issues
            
            # Skip standard library and third-party imports
            if not module_name.startswith('vespera_scriptorium'):
                return issues
            
            # Determine imported module's layer
            imported_layer = self._determine_layer_from_module_name(module_name)
            if imported_layer and not self._is_dependency_allowed(file_layer, imported_layer):
                issues.append(ValidationIssue(
                    rule_name=self.name,
                    severity=ValidationResult.FAIL,
                    message=f"Invalid import: {file_layer} layer cannot import from {imported_layer} layer",
                    file_path=str(file_path),
                    line_number=node.lineno,
                    suggestion=f"Use dependency injection or move import to appropriate layer"
                ))
        
        except Exception:
            pass  # Skip problematic imports
        
        return issues
    
    def _determine_layer_from_module_name(self, module_name: str) -> Optional[str]:
        """Determine layer from module name."""
        if '.domain.' in module_name:
            return 'domain'
        elif '.application.' in module_name:
            return 'application'
        elif '.infrastructure.' in module_name:
            return 'infrastructure'
        elif '.presentation.' in module_name:
            return 'presentation'
        
        return None
    
    def _validate_type_dependency(self, type_annotation: Any, class_layer: str, class_path: str) -> List[ValidationIssue]:
        """Validate type annotation dependency."""
        issues = []
        
        try:
            # Get the module of the type
            if hasattr(type_annotation, '__module__'):
                type_module = type_annotation.__module__
                type_layer = self._determine_layer_from_module_name(type_module)
                
                if type_layer and not self._is_dependency_allowed(class_layer, type_layer):
                    issues.append(ValidationIssue(
                        rule_name=self.name,
                        severity=ValidationResult.FAIL,
                        message=f"Invalid type dependency: {class_layer} layer cannot depend on {type_layer} type",
                        file_path=class_path,
                        suggestion=f"Use interface abstraction or move to appropriate layer"
                    ))
        
        except Exception:
            pass  # Skip problematic types
        
        return issues


class DependencyInjectionValidator(ValidationRule):
    """Validates proper dependency injection usage."""
    
    def __init__(self):
        super().__init__(
            "dependency_injection_compliance",
            "Ensures proper dependency injection patterns are used",
            ValidationLevel.STANDARD
        )
    
    def validate(self, target: Any, context: Dict[str, Any] = None) -> List[ValidationIssue]:
        """Validate dependency injection usage."""
        issues = []
        
        if inspect.isclass(target):
            issues.extend(self._validate_class_di(target))
        elif isinstance(target, str) and Path(target).exists():
            issues.extend(self._validate_file_di(Path(target)))
        
        return issues
    
    def _validate_class_di(self, cls: Type) -> List[ValidationIssue]:
        """Validate class dependency injection."""
        issues = []
        
        try:
            # Check constructor
            sig = inspect.signature(cls.__init__)
            has_di_parameters = False
            
            for param_name, param in sig.parameters.items():
                if param_name == 'self':
                    continue
                
                # Check if parameter has type annotation
                if param.annotation == inspect.Parameter.empty:
                    issues.append(ValidationIssue(
                        rule_name=self.name,
                        severity=ValidationResult.WARNING,
                        message=f"Constructor parameter '{param_name}' in {cls.__name__} lacks type annotation",
                        suggestion="Add type annotation for proper dependency injection"
                    ))
                else:
                    has_di_parameters = True
            
            # Check for singleton pattern misuse
            if hasattr(cls, '__new__') and not has_di_parameters:
                issues.append(ValidationIssue(
                    rule_name=self.name,
                    severity=ValidationResult.WARNING,
                    message=f"Class {cls.__name__} may be using singleton pattern instead of dependency injection",
                    suggestion="Consider using dependency injection container instead of singleton"
                ))
        
        except Exception as e:
            issues.append(ValidationIssue(
                rule_name=self.name,
                severity=ValidationResult.WARNING,
                message=f"Could not analyze dependency injection for {cls.__name__}: {str(e)}"
            ))
        
        return issues
    
    def _validate_file_di(self, file_path: Path) -> List[ValidationIssue]:
        """Validate dependency injection in file."""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check for global variables (potential singletons)
            if 'global ' in content.lower():
                issues.append(ValidationIssue(
                    rule_name=self.name,
                    severity=ValidationResult.WARNING,
                    message=f"File {file_path.name} uses global variables",
                    file_path=str(file_path),
                    suggestion="Consider using dependency injection instead of global state"
                ))
            
            # Check for direct instantiation in application/domain layers
            layer = self._determine_layer_from_path(file_path)
            if layer in ['application', 'domain']:
                if 'Repository()' in content or 'Service()' in content:
                    issues.append(ValidationIssue(
                        rule_name=self.name,
                        severity=ValidationResult.FAIL,
                        message=f"Direct instantiation found in {layer} layer",
                        file_path=str(file_path),
                        suggestion="Use dependency injection instead of direct instantiation"
                    ))
        
        except Exception as e:
            issues.append(ValidationIssue(
                rule_name=self.name,
                severity=ValidationResult.WARNING,
                message=f"Could not analyze file {file_path}: {str(e)}",
                file_path=str(file_path)
            ))
        
        return issues
    
    def _determine_layer_from_path(self, file_path: Path) -> Optional[str]:
        """Determine architectural layer from file path."""
        path_str = str(file_path).lower()
        
        if '/domain/' in path_str or '\\domain\\' in path_str:
            return 'domain'
        elif '/application/' in path_str or '\\application\\' in path_str:
            return 'application'
        elif '/infrastructure/' in path_str or '\\infrastructure\\' in path_str:
            return 'infrastructure'
        
        return None


class TestCoverageValidator(ValidationRule):
    """Validates test coverage and quality."""
    
    def __init__(self):
        super().__init__(
            "test_coverage_validation",
            "Ensures adequate test coverage across architectural layers",
            ValidationLevel.STANDARD
        )
    
    def validate(self, target: Any, context: Dict[str, Any] = None) -> List[ValidationIssue]:
        """Validate test coverage."""
        issues = []
        
        if isinstance(target, str) and Path(target).is_dir():
            issues.extend(self._validate_directory_coverage(Path(target)))
        elif isinstance(target, str) and Path(target).exists():
            issues.extend(self._validate_file_coverage(Path(target)))
        
        return issues
    
    def _validate_directory_coverage(self, directory: Path) -> List[ValidationIssue]:
        """Validate test coverage for directory."""
        issues = []
        
        # Find all Python files
        python_files = list(directory.rglob("*.py"))
        test_files = [f for f in python_files if self._is_test_file(f)]
        source_files = [f for f in python_files if not self._is_test_file(f) and not self._is_excluded_file(f)]
        
        # Calculate coverage ratio
        if source_files:
            coverage_ratio = len(test_files) / len(source_files)
            
            if coverage_ratio < 0.8:  # Less than 80% coverage
                issues.append(ValidationIssue(
                    rule_name=self.name,
                    severity=ValidationResult.WARNING,
                    message=f"Low test coverage ratio: {coverage_ratio:.2%} ({len(test_files)} test files for {len(source_files)} source files)",
                    suggestion="Add more test files to improve coverage"
                ))
        
        # Check for missing test categories
        layer_tests = self._categorize_test_files(test_files)
        required_categories = ['domain', 'application', 'infrastructure', 'integration']
        
        for category in required_categories:
            if category not in layer_tests:
                issues.append(ValidationIssue(
                    rule_name=self.name,
                    severity=ValidationResult.WARNING,
                    message=f"Missing {category} layer tests",
                    suggestion=f"Add tests for {category} layer components"
                ))
        
        return issues
    
    def _validate_file_coverage(self, file_path: Path) -> List[ValidationIssue]:
        """Validate test coverage for specific file."""
        issues = []
        
        if self._is_test_file(file_path):
            # Validate test file structure
            issues.extend(self._validate_test_file_structure(file_path))
        else:
            # Check if source file has corresponding test
            test_file = self._find_corresponding_test_file(file_path)
            if not test_file:
                issues.append(ValidationIssue(
                    rule_name=self.name,
                    severity=ValidationResult.WARNING,
                    message=f"No test file found for {file_path.name}",
                    file_path=str(file_path),
                    suggestion=f"Create test file for {file_path.name}"
                ))
        
        return issues
    
    def _is_test_file(self, file_path: Path) -> bool:
        """Check if file is a test file."""
        return (
            file_path.name.startswith('test_') or
            file_path.name.endswith('_test.py') or
            '/tests/' in str(file_path) or
            '\\tests\\' in str(file_path)
        )
    
    def _is_excluded_file(self, file_path: Path) -> bool:
        """Check if file should be excluded from coverage analysis."""
        exclusions = ['__init__.py', '__main__.py', 'conftest.py']
        return (
            file_path.name in exclusions or
            file_path.name.startswith('_') or
            'migration' in file_path.name.lower()
        )
    
    def _categorize_test_files(self, test_files: List[Path]) -> Dict[str, List[Path]]:
        """Categorize test files by layer."""
        categories = {}
        
        for test_file in test_files:
            path_str = str(test_file).lower()
            
            if '/domain/' in path_str or 'domain' in test_file.name:
                categories.setdefault('domain', []).append(test_file)
            elif '/application/' in path_str or 'application' in test_file.name:
                categories.setdefault('application', []).append(test_file)
            elif '/infrastructure/' in path_str or 'infrastructure' in test_file.name:
                categories.setdefault('infrastructure', []).append(test_file)
            elif 'integration' in test_file.name or 'e2e' in test_file.name:
                categories.setdefault('integration', []).append(test_file)
            else:
                categories.setdefault('other', []).append(test_file)
        
        return categories
    
    def _find_corresponding_test_file(self, source_file: Path) -> Optional[Path]:
        """Find corresponding test file for source file."""
        # Common test file patterns
        test_patterns = [
            f"test_{source_file.stem}.py",
            f"{source_file.stem}_test.py",
            f"test_{source_file.stem}_*.py"
        ]
        
        # Search in various test directories
        search_dirs = [
            source_file.parent / 'tests',
            source_file.parent.parent / 'tests',
            source_file.parent.parent.parent / 'tests'
        ]
        
        for search_dir in search_dirs:
            if search_dir.exists():
                for pattern in test_patterns:
                    matches = list(search_dir.glob(pattern))
                    if matches:
                        return matches[0]
        
        return None
    
    def _validate_test_file_structure(self, test_file: Path) -> List[ValidationIssue]:
        """Validate test file structure."""
        issues = []
        
        try:
            with open(test_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check for test functions
            test_function_count = content.count('def test_')
            if test_function_count == 0:
                issues.append(ValidationIssue(
                    rule_name=self.name,
                    severity=ValidationResult.FAIL,
                    message=f"Test file {test_file.name} contains no test functions",
                    file_path=str(test_file),
                    suggestion="Add test functions starting with 'test_'"
                ))
            
            # Check for proper test structure
            if 'import pytest' not in content and '@pytest' in content:
                issues.append(ValidationIssue(
                    rule_name=self.name,
                    severity=ValidationResult.WARNING,
                    message=f"Test file {test_file.name} uses pytest decorators without importing pytest",
                    file_path=str(test_file),
                    suggestion="Add 'import pytest' at the top of the file"
                ))
        
        except Exception as e:
            issues.append(ValidationIssue(
                rule_name=self.name,
                severity=ValidationResult.WARNING,
                message=f"Could not analyze test file {test_file}: {str(e)}",
                file_path=str(test_file)
            ))
        
        return issues


class ValidationFramework:
    """Main validation framework orchestrator."""
    
    def __init__(self, level: ValidationLevel = ValidationLevel.STANDARD):
        self.level = level
        self.rules: List[ValidationRule] = []
        self._register_default_rules()
    
    def _register_default_rules(self):
        """Register default validation rules."""
        self.rules.append(ArchitecturalLayerValidator())
        self.rules.append(DependencyInjectionValidator())
        self.rules.append(TestCoverageValidator())
    
    def add_rule(self, rule: ValidationRule):
        """Add custom validation rule."""
        self.rules.append(rule)
    
    def remove_rule(self, rule_name: str):
        """Remove validation rule by name."""
        self.rules = [rule for rule in self.rules if rule.name != rule_name]
    
    def validate(self, target: Any, context: Dict[str, Any] = None) -> ValidationReport:
        """Execute all applicable validation rules."""
        import time
        start_time = time.time()
        
        all_issues = []
        passed = 0
        warnings = 0
        failures = 0
        skipped = 0
        total_checks = 0
        
        for rule in self.rules:
            # Skip rules that don't match validation level
            if self._should_skip_rule(rule):
                skipped += 1
                continue
            
            try:
                if rule.is_applicable(target, context):
                    issues = rule.validate(target, context)
                    all_issues.extend(issues)
                    
                    # Count results
                    rule_failures = len([i for i in issues if i.severity == ValidationResult.FAIL])
                    rule_warnings = len([i for i in issues if i.severity == ValidationResult.WARNING])
                    
                    if rule_failures > 0:
                        failures += 1
                    elif rule_warnings > 0:
                        warnings += 1
                    else:
                        passed += 1
                    
                    total_checks += 1
                else:
                    skipped += 1
            
            except Exception as e:
                logger.error(f"Error executing validation rule {rule.name}: {e}")
                all_issues.append(ValidationIssue(
                    rule_name=rule.name,
                    severity=ValidationResult.FAIL,
                    message=f"Rule execution failed: {str(e)}"
                ))
                failures += 1
                total_checks += 1
        
        execution_time = time.time() - start_time
        
        return ValidationReport(
            total_checks=total_checks,
            passed=passed,
            warnings=warnings,
            failures=failures,
            skipped=skipped,
            issues=all_issues,
            execution_time=execution_time,
            validation_level=self.level
        )
    
    def _should_skip_rule(self, rule: ValidationRule) -> bool:
        """Check if rule should be skipped based on validation level."""
        level_priority = {
            ValidationLevel.BASIC: 1,
            ValidationLevel.STANDARD: 2,
            ValidationLevel.STRICT: 3,
            ValidationLevel.COMPREHENSIVE: 4
        }
        
        return level_priority[rule.level] > level_priority[self.level]
    
    def validate_project(self, project_path: Path) -> ValidationReport:
        """Validate entire project."""
        return self.validate(str(project_path))
    
    def validate_file(self, file_path: Path) -> ValidationReport:
        """Validate single file."""
        return self.validate(str(file_path))
    
    def validate_class(self, cls: Type) -> ValidationReport:
        """Validate single class."""
        return self.validate(cls)
    
    def create_validation_hook(self) -> Callable:
        """Create validation hook for pytest."""
        def validation_hook(session):
            """Pytest hook for validation."""
            # This would be called by pytest
            project_path = Path.cwd()
            report = self.validate_project(project_path)
            
            if report.has_failures:
                logger.error(f"Validation failed: {report.failures} failures, {report.warnings} warnings")
                for issue in report.get_issues_by_severity(ValidationResult.FAIL):
                    logger.error(f"  {issue.message}")
            else:
                logger.info(f"Validation passed: {report.passed} rules passed, {report.warnings} warnings")
        
        return validation_hook


# Convenience functions for common validation scenarios

def validate_clean_architecture(project_path: Union[str, Path], level: ValidationLevel = ValidationLevel.STANDARD) -> ValidationReport:
    """Validate Clean Architecture compliance for project."""
    framework = ValidationFramework(level)
    return framework.validate_project(Path(project_path))


def validate_file_architecture(file_path: Union[str, Path], level: ValidationLevel = ValidationLevel.STANDARD) -> ValidationReport:
    """Validate Clean Architecture compliance for single file."""
    framework = ValidationFramework(level)
    return framework.validate_file(Path(file_path))


def create_architectural_validation_hook(level: ValidationLevel = ValidationLevel.STANDARD) -> Callable:
    """Create pytest hook for architectural validation."""
    framework = ValidationFramework(level)
    return framework.create_validation_hook()


# Global validation framework instance
default_validation_framework = ValidationFramework(ValidationLevel.STANDARD)