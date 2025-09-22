"""
Code Analyzer for Vespera V2 RAG System

Analyzes Python code for imports, classes, methods, and functions
to enable hallucination detection and code validation.

Inspired by crawl4ai-rag's AST-based approach.
"""

import ast
import logging
from typing import Dict, List, Optional, Set, Any, Tuple
from pathlib import Path
from dataclasses import dataclass
import json

logger = logging.getLogger(__name__)


@dataclass
class ImportInfo:
    """Information about an import statement."""
    module: str
    names: List[str]  # Empty for 'import module', populated for 'from module import names'
    aliases: Dict[str, str]  # Mapping of original name to alias
    line_number: int
    is_from_import: bool


@dataclass
class FunctionInfo:
    """Information about a function definition."""
    name: str
    parameters: List[str]
    decorators: List[str]
    line_number: int
    docstring: Optional[str] = None
    is_async: bool = False
    return_type: Optional[str] = None


@dataclass
class ClassInfo:
    """Information about a class definition."""
    name: str
    bases: List[str]  # Base classes
    methods: List[FunctionInfo]
    attributes: List[str]
    decorators: List[str]
    line_number: int
    docstring: Optional[str] = None


@dataclass
class MethodCallInfo:
    """Information about a method call."""
    object_name: str
    method_name: str
    line_number: int
    arguments: List[str]


@dataclass
class CodeAnalysis:
    """Complete analysis of a Python code file."""
    file_path: str
    imports: List[ImportInfo]
    functions: List[FunctionInfo]
    classes: List[ClassInfo]
    method_calls: List[MethodCallInfo]
    variables: Set[str]
    constants: Set[str]
    analysis_timestamp: str


class CodeAnalyzer:
    """
    Analyzes Python code using AST to extract structural information
    for use in RAG systems and hallucination detection.
    """
    
    def __init__(self):
        """Initialize the code analyzer."""
        self.logger = logger
    
    def analyze_file(self, file_path: Path) -> Optional[CodeAnalysis]:
        """
        Analyze a Python file and extract structural information.
        
        Args:
            file_path: Path to Python file
            
        Returns:
            CodeAnalysis object or None if analysis fails
        """
        try:
            if not file_path.exists():
                self.logger.error(f"File not found: {file_path}")
                return None
            
            if not file_path.suffix == '.py':
                self.logger.error(f"Not a Python file: {file_path}")
                return None
            
            # Read file content
            try:
                content = file_path.read_text(encoding='utf-8')
            except UnicodeDecodeError:
                self.logger.error(f"Cannot decode file: {file_path}")
                return None
            
            return self.analyze_code(content, str(file_path))
            
        except Exception as e:
            self.logger.error(f"Failed to analyze file {file_path}: {e}")
            return None
    
    def analyze_code(self, code: str, file_path: str = "<string>") -> Optional[CodeAnalysis]:
        """
        Analyze Python code string and extract structural information.
        
        Args:
            code: Python code as string
            file_path: File path for reference
            
        Returns:
            CodeAnalysis object or None if analysis fails
        """
        try:
            # Parse AST
            tree = ast.parse(code, filename=file_path)
            
            # Extract information using AST visitor
            visitor = CodeVisitor()
            visitor.visit(tree)
            
            # Create analysis result
            analysis = CodeAnalysis(
                file_path=file_path,
                imports=visitor.imports,
                functions=visitor.functions,
                classes=visitor.classes,
                method_calls=visitor.method_calls,
                variables=visitor.variables,
                constants=visitor.constants,
                analysis_timestamp=visitor.analysis_timestamp
            )
            
            self.logger.debug(f"Analyzed {file_path}: {len(analysis.imports)} imports, "
                            f"{len(analysis.functions)} functions, {len(analysis.classes)} classes")
            
            return analysis
            
        except SyntaxError as e:
            self.logger.error(f"Syntax error in {file_path}: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Failed to analyze code in {file_path}: {e}")
            return None
    
    def extract_dependencies(self, analysis: CodeAnalysis) -> Dict[str, List[str]]:
        """
        Extract dependencies from code analysis.
        
        Args:
            analysis: CodeAnalysis object
            
        Returns:
            Dictionary mapping dependency types to lists of dependencies
        """
        dependencies = {
            "stdlib_modules": [],
            "third_party_modules": [],
            "local_modules": [],
            "method_calls": [],
            "class_instantiations": []
        }
        
        # Standard library modules (common ones)
        stdlib_modules = {
            'os', 'sys', 'json', 'datetime', 'time', 'math', 'random', 
            'itertools', 'functools', 'collections', 'pathlib', 'typing',
            'logging', 'asyncio', 'threading', 'multiprocessing', 'sqlite3',
            'urllib', 'http', 'email', 'xml', 'csv', 'configparser',
            'argparse', 'unittest', 'dataclasses', 'enum', 'abc'
        }
        
        # Categorize imports
        for import_info in analysis.imports:
            module = import_info.module.split('.')[0]  # Get top-level module
            
            if module in stdlib_modules:
                dependencies["stdlib_modules"].append(import_info.module)
            elif import_info.module.startswith('.'):
                dependencies["local_modules"].append(import_info.module)
            else:
                dependencies["third_party_modules"].append(import_info.module)
        
        # Extract method calls and instantiations
        for call in analysis.method_calls:
            if call.method_name == call.method_name.capitalize():  # Likely a class instantiation
                dependencies["class_instantiations"].append(f"{call.object_name}.{call.method_name}")
            else:
                dependencies["method_calls"].append(f"{call.object_name}.{call.method_name}")
        
        return dependencies
    
    def find_potential_issues(self, analysis: CodeAnalysis) -> List[Dict[str, Any]]:
        """
        Find potential issues in the code that might indicate hallucinations.
        
        Args:
            analysis: CodeAnalysis object
            
        Returns:
            List of potential issues found
        """
        issues = []
        
        # Check for imports without usage (potential hallucination)
        imported_names = set()
        for import_info in analysis.imports:
            if import_info.names:
                imported_names.update(import_info.names)
            else:
                imported_names.add(import_info.module.split('.')[-1])
        
        # Check if imported names are used in method calls
        used_names = set()
        for call in analysis.method_calls:
            used_names.add(call.object_name)
        
        # Find potentially unused imports
        potentially_unused = imported_names - used_names
        for unused in potentially_unused:
            issues.append({
                "type": "potentially_unused_import",
                "severity": "low",
                "message": f"Import '{unused}' might not be used",
                "suggestion": "Verify if this import is actually needed"
            })
        
        # Check for common hallucination patterns
        for call in analysis.method_calls:
            # Check for non-existent common methods
            suspicious_patterns = [
                ("client", "create_completion"),  # Common AI hallucination
                ("model", "predict"),
                ("api", "call"),
                ("service", "execute")
            ]
            
            for obj_pattern, method_pattern in suspicious_patterns:
                if obj_pattern in call.object_name.lower() and method_pattern in call.method_name.lower():
                    issues.append({
                        "type": "suspicious_method_call",
                        "severity": "medium",
                        "message": f"Suspicious method call: {call.object_name}.{call.method_name}",
                        "line_number": call.line_number,
                        "suggestion": "Verify this method exists in the actual API"
                    })
        
        return issues
    
    def to_graph_format(self, analysis: CodeAnalysis) -> Dict[str, Any]:
        """
        Convert code analysis to format suitable for knowledge graph storage.
        
        Args:
            analysis: CodeAnalysis object
            
        Returns:
            Dictionary in graph-compatible format
        """
        return {
            "file_path": analysis.file_path,
            "imports": [
                {
                    "module": imp.module,
                    "names": imp.names,
                    "aliases": imp.aliases,
                    "line_number": imp.line_number,
                    "is_from_import": imp.is_from_import
                }
                for imp in analysis.imports
            ],
            "functions": [
                {
                    "name": func.name,
                    "parameters": func.parameters,
                    "decorators": func.decorators,
                    "line_number": func.line_number,
                    "docstring": func.docstring,
                    "is_async": func.is_async,
                    "return_type": func.return_type
                }
                for func in analysis.functions
            ],
            "classes": [
                {
                    "name": cls.name,
                    "bases": cls.bases,
                    "methods": [
                        {
                            "name": method.name,
                            "parameters": method.parameters,
                            "decorators": method.decorators,
                            "line_number": method.line_number,
                            "is_async": method.is_async
                        }
                        for method in cls.methods
                    ],
                    "attributes": cls.attributes,
                    "decorators": cls.decorators,
                    "line_number": cls.line_number,
                    "docstring": cls.docstring
                }
                for cls in analysis.classes
            ],
            "method_calls": [
                {
                    "object_name": call.object_name,
                    "method_name": call.method_name,
                    "line_number": call.line_number,
                    "arguments": call.arguments
                }
                for call in analysis.method_calls
            ],
            "variables": list(analysis.variables),
            "constants": list(analysis.constants),
            "analysis_timestamp": analysis.analysis_timestamp
        }


class CodeVisitor(ast.NodeVisitor):
    """AST visitor to extract code structure information."""
    
    def __init__(self):
        self.imports = []
        self.functions = []
        self.classes = []
        self.method_calls = []
        self.variables = set()
        self.constants = set()
        self.analysis_timestamp = ""
        
        from datetime import datetime
        self.analysis_timestamp = datetime.now().isoformat()
    
    def visit_Import(self, node):
        """Visit import statements."""
        for alias in node.names:
            import_info = ImportInfo(
                module=alias.name,
                names=[],
                aliases={alias.name: alias.asname} if alias.asname else {},
                line_number=node.lineno,
                is_from_import=False
            )
            self.imports.append(import_info)
        self.generic_visit(node)
    
    def visit_ImportFrom(self, node):
        """Visit from-import statements."""
        if node.module:
            names = [alias.name for alias in node.names]
            aliases = {alias.name: alias.asname for alias in node.names if alias.asname}
            
            import_info = ImportInfo(
                module=node.module,
                names=names,
                aliases=aliases,
                line_number=node.lineno,
                is_from_import=True
            )
            self.imports.append(import_info)
        self.generic_visit(node)
    
    def visit_FunctionDef(self, node):
        """Visit function definitions."""
        # Extract parameters
        parameters = []
        for arg in node.args.args:
            param_name = arg.arg
            if arg.annotation:
                param_name += f": {ast.unparse(arg.annotation)}"
            parameters.append(param_name)
        
        # Extract decorators
        decorators = [ast.unparse(decorator) for decorator in node.decorator_list]
        
        # Extract docstring
        docstring = None
        if (node.body and isinstance(node.body[0], ast.Expr) and 
            isinstance(node.body[0].value, ast.Constant) and 
            isinstance(node.body[0].value.value, str)):
            docstring = node.body[0].value.value
        
        # Extract return type
        return_type = None
        if node.returns:
            return_type = ast.unparse(node.returns)
        
        function_info = FunctionInfo(
            name=node.name,
            parameters=parameters,
            decorators=decorators,
            line_number=node.lineno,
            docstring=docstring,
            is_async=False,
            return_type=return_type
        )
        self.functions.append(function_info)
        self.generic_visit(node)
    
    def visit_AsyncFunctionDef(self, node):
        """Visit async function definitions."""
        # Similar to visit_FunctionDef but mark as async
        parameters = []
        for arg in node.args.args:
            param_name = arg.arg
            if arg.annotation:
                param_name += f": {ast.unparse(arg.annotation)}"
            parameters.append(param_name)
        
        decorators = [ast.unparse(decorator) for decorator in node.decorator_list]
        
        docstring = None
        if (node.body and isinstance(node.body[0], ast.Expr) and 
            isinstance(node.body[0].value, ast.Constant) and 
            isinstance(node.body[0].value.value, str)):
            docstring = node.body[0].value.value
        
        return_type = None
        if node.returns:
            return_type = ast.unparse(node.returns)
        
        function_info = FunctionInfo(
            name=node.name,
            parameters=parameters,
            decorators=decorators,
            line_number=node.lineno,
            docstring=docstring,
            is_async=True,
            return_type=return_type
        )
        self.functions.append(function_info)
        self.generic_visit(node)
    
    def visit_ClassDef(self, node):
        """Visit class definitions."""
        # Extract base classes
        bases = [ast.unparse(base) for base in node.bases]
        
        # Extract decorators
        decorators = [ast.unparse(decorator) for decorator in node.decorator_list]
        
        # Extract docstring
        docstring = None
        if (node.body and isinstance(node.body[0], ast.Expr) and 
            isinstance(node.body[0].value, ast.Constant) and 
            isinstance(node.body[0].value.value, str)):
            docstring = node.body[0].value.value
        
        # Extract methods and attributes
        methods = []
        attributes = []
        
        for item in node.body:
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # Extract method parameters
                parameters = []
                for arg in item.args.args:
                    param_name = arg.arg
                    if arg.annotation:
                        param_name += f": {ast.unparse(arg.annotation)}"
                    parameters.append(param_name)
                
                method_decorators = [ast.unparse(decorator) for decorator in item.decorator_list]
                
                method_info = FunctionInfo(
                    name=item.name,
                    parameters=parameters,
                    decorators=method_decorators,
                    line_number=item.lineno,
                    is_async=isinstance(item, ast.AsyncFunctionDef)
                )
                methods.append(method_info)
            elif isinstance(item, ast.Assign):
                # Class attributes
                for target in item.targets:
                    if isinstance(target, ast.Name):
                        attributes.append(target.id)
        
        class_info = ClassInfo(
            name=node.name,
            bases=bases,
            methods=methods,
            attributes=attributes,
            decorators=decorators,
            line_number=node.lineno,
            docstring=docstring
        )
        self.classes.append(class_info)
        self.generic_visit(node)
    
    def visit_Call(self, node):
        """Visit function/method calls."""
        if isinstance(node.func, ast.Attribute):
            # Method call (obj.method())
            if isinstance(node.func.value, ast.Name):
                object_name = node.func.value.id
                method_name = node.func.attr
                
                # Extract arguments (simplified)
                arguments = []
                for arg in node.args:
                    try:
                        arguments.append(ast.unparse(arg))
                    except:
                        arguments.append("<complex_arg>")
                
                call_info = MethodCallInfo(
                    object_name=object_name,
                    method_name=method_name,
                    line_number=node.lineno,
                    arguments=arguments
                )
                self.method_calls.append(call_info)
        
        self.generic_visit(node)
    
    def visit_Assign(self, node):
        """Visit variable assignments."""
        for target in node.targets:
            if isinstance(target, ast.Name):
                var_name = target.id
                if var_name.isupper():
                    self.constants.add(var_name)
                else:
                    self.variables.add(var_name)
        self.generic_visit(node)