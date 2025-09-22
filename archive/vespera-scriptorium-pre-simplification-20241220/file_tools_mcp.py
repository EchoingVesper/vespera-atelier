"""
File Tools MCP Server with Validation Support

Provides file manipulation tools with built-in validation ignore pattern support
to reduce false positives when analyzing framework code and legitimate libraries.
"""

import ast
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Any
import json

from validation_config import get_validation_config, should_ignore_validation


logger = logging.getLogger(__name__)


class CodeValidator:
    """
    Validates code files for potential security issues while respecting
    ignore patterns for legitimate framework code.
    """
    
    def __init__(self):
        self.validation_config = get_validation_config()
        self.suspicious_patterns = self._get_suspicious_patterns()
        self.validation_results: List[Dict] = []
    
    def _get_suspicious_patterns(self) -> List[Tuple[str, str, str]]:
        """Get patterns that indicate potentially suspicious code."""
        return [
            # Command execution patterns
            (r'\bos\.system\s*\(', 'os.system() usage', 'high'),
            (r'\bsubprocess\.call\s*\(', 'subprocess.call() usage', 'medium'),
            (r'\bsubprocess\.run\s*\(', 'subprocess.run() usage', 'medium'),
            (r'\bsubprocess\.Popen\s*\(', 'subprocess.Popen() usage', 'medium'),
            (r'\beval\s*\(', 'eval() usage', 'high'),
            (r'\bexec\s*\(', 'exec() usage', 'high'),
            
            # File system patterns
            (r'\bopen\s*\([^)]*["\']w["\']', 'File write operation', 'low'),
            (r'\bunlink\s*\(', 'File deletion', 'medium'),
            (r'\bremove\s*\(', 'File removal', 'medium'),
            (r'\brmdir\s*\(', 'Directory removal', 'medium'),
            (r'\bshutil\.rmtree\s*\(', 'Recursive directory removal', 'high'),
            
            # Network patterns
            (r'\burllib\.request\s*\(', 'URL request', 'low'),
            (r'\brequests\.(get|post|put|delete)', 'HTTP request', 'low'),
            (r'\bsocket\.socket\s*\(', 'Socket creation', 'medium'),
            
            # Cryptographic patterns (suspicious if used improperly)
            (r'\bhashlib\.(md5|sha1)\s*\(', 'Weak hash algorithm', 'low'),
            (r'\brandom\.random\s*\(', 'Weak random number generation', 'low'),
            
            # Dynamic code loading
            (r'\b__import__\s*\(', 'Dynamic import', 'medium'),
            (r'\bimportlib\.import_module\s*\(', 'Dynamic module import', 'medium'),
            
            # Serialization (potential for code execution)
            (r'\bpickle\.loads?\s*\(', 'Pickle deserialization', 'high'),
            (r'\byaml\.load\s*\(', 'YAML loading (potentially unsafe)', 'medium'),
        ]
    
    def validate_file(self, file_path: Path) -> Dict[str, Any]:
        """
        Validate a single file for potential security issues.
        
        Returns validation results with ignore pattern filtering applied.
        """
        logger.debug(f"Validating file: {file_path}")
        
        # Check if entire file should be ignored
        if self.validation_config.should_ignore('file', str(file_path)):
            logger.debug(f"File {file_path} ignored by file pattern")
            return {
                'file_path': str(file_path),
                'ignored': True,
                'reason': 'File pattern match',
                'issues': []
            }
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            return {
                'file_path': str(file_path),
                'error': str(e),
                'issues': []
            }
        
        issues = []
        
        # Parse Python code for detailed analysis
        if file_path.suffix == '.py':
            issues.extend(self._validate_python_code(content, file_path))
        
        # Check for suspicious patterns in any text file
        issues.extend(self._validate_text_patterns(content, file_path))
        
        return {
            'file_path': str(file_path),
            'ignored': False,
            'issues': issues,
            'total_issues': len(issues)
        }
    
    def _validate_python_code(self, content: str, file_path: Path) -> List[Dict[str, Any]]:
        """Validate Python code using AST analysis."""
        issues = []
        
        try:
            tree = ast.parse(content)
            
            for node in ast.walk(tree):
                # Check function definitions
                if isinstance(node, ast.FunctionDef):
                    if not self.validation_config.should_ignore('function', node.name):
                        # Check for suspicious function patterns
                        if node.name.startswith('_') and not node.name.startswith('__'):
                            issues.append({
                                'type': 'function',
                                'severity': 'low',
                                'message': f"Private function '{node.name}' - review for necessity",
                                'line': node.lineno,
                                'item': node.name
                            })
                
                # Check class definitions
                elif isinstance(node, ast.ClassDef):
                    if not self.validation_config.should_ignore('class', node.name):
                        # Custom class validation logic here
                        pass
                
                # Check imports
                elif isinstance(node, (ast.Import, ast.ImportFrom)):
                    for alias in node.names:
                        import_name = alias.name
                        if node.__class__.__name__ == 'ImportFrom' and node.module:
                            import_name = f"{node.module}.{alias.name}"
                        
                        if not self.validation_config.should_ignore('import', import_name):
                            # Check for suspicious imports
                            if any(danger in import_name.lower() for danger in ['subprocess', 'os', 'sys']):
                                issues.append({
                                    'type': 'import',
                                    'severity': 'medium',
                                    'message': f"Potentially dangerous import: {import_name}",
                                    'line': node.lineno,
                                    'item': import_name
                                })
                
                # Check function calls
                elif isinstance(node, ast.Call):
                    if hasattr(node.func, 'id') and node.func.id:
                        func_name = node.func.id
                        if not self.validation_config.should_ignore('function', func_name):
                            # Check for dangerous function calls
                            if func_name in ['eval', 'exec', 'compile']:
                                issues.append({
                                    'type': 'function_call',
                                    'severity': 'high',
                                    'message': f"Dangerous function call: {func_name}",
                                    'line': node.lineno,
                                    'item': func_name
                                })
                    
                    # Check attribute calls (e.g., obj.method())
                    elif hasattr(node.func, 'attr') and node.func.attr:
                        attr_name = node.func.attr
                        if hasattr(node.func, 'value') and hasattr(node.func.value, 'id'):
                            full_name = f"{node.func.value.id}.{attr_name}"
                        else:
                            full_name = attr_name
                        
                        if not self.validation_config.should_ignore('attribute', full_name):
                            # Check for suspicious method calls
                            if attr_name in ['system', 'popen', 'spawn']:
                                issues.append({
                                    'type': 'method_call',
                                    'severity': 'high',
                                    'message': f"Potentially dangerous method call: {full_name}",
                                    'line': node.lineno,
                                    'item': full_name
                                })
        
        except SyntaxError as e:
            logger.warning(f"Syntax error in {file_path}: {e}")
            issues.append({
                'type': 'syntax_error',
                'severity': 'high',
                'message': f"Syntax error: {e}",
                'line': e.lineno or 0,
                'item': 'file'
            })
        
        except Exception as e:
            logger.error(f"Error parsing Python file {file_path}: {e}")
        
        return issues
    
    def _validate_text_patterns(self, content: str, file_path: Path) -> List[Dict[str, Any]]:
        """Validate text content using pattern matching."""
        issues = []
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            for pattern, description, severity in self.suspicious_patterns:
                matches = re.finditer(pattern, line, re.IGNORECASE)
                for match in matches:
                    # Extract the matched content for ignore checking
                    matched_text = match.group(0)
                    
                    # Check if this pattern should be ignored
                    should_ignore = False
                    
                    # Check against function patterns
                    if 'function' in description.lower() or '()' in matched_text:
                        # More robust function name extraction
                        try:
                            # Handle complex patterns like os.system(), app.get(), etc.
                            func_part = matched_text.split('(')[0].strip()
                            # Remove common prefixes and clean the name
                            func_name = re.sub(r'^[^a-zA-Z_]*', '', func_part)
                            func_name = re.sub(r'[^\w.]', '', func_name)
                            if func_name:
                                should_ignore = self.validation_config.should_ignore('function', func_name)
                        except (IndexError, AttributeError):
                            # Fallback to simple extraction
                            func_name = re.sub(r'[^\w.]', '', matched_text.split('(')[0])
                            should_ignore = self.validation_config.should_ignore('function', func_name)
                    
                    # Check against import patterns
                    elif 'import' in description.lower():
                        should_ignore = self.validation_config.should_ignore('import', matched_text)
                    
                    if not should_ignore:
                        issues.append({
                            'type': 'pattern_match',
                            'severity': severity,
                            'message': f"{description}: {matched_text}",
                            'line': line_num,
                            'item': matched_text,
                            'pattern': pattern
                        })
        
        return issues
    
    def validate_directory(self, directory_path: Path, recursive: bool = True) -> Dict[str, Any]:
        """
        Validate all files in a directory.
        
        Returns aggregated validation results.
        """
        logger.info(f"Validating directory: {directory_path}")
        
        results = {
            'directory_path': str(directory_path),
            'files_validated': 0,
            'files_ignored': 0,
            'total_issues': 0,
            'files': {},
            'summary': {
                'high_severity': 0,
                'medium_severity': 0,
                'low_severity': 0
            }
        }
        
        # Get file pattern for iteration
        pattern = "**/*" if recursive else "*"
        
        for file_path in directory_path.glob(pattern):
            if file_path.is_file() and self._should_validate_file(file_path):
                file_result = self.validate_file(file_path)
                results['files'][str(file_path)] = file_result
                
                if file_result.get('ignored'):
                    results['files_ignored'] += 1
                else:
                    results['files_validated'] += 1
                    results['total_issues'] += len(file_result.get('issues', []))
                    
                    # Count severity levels
                    for issue in file_result.get('issues', []):
                        severity = issue.get('severity', 'low')
                        results['summary'][f"{severity}_severity"] += 1
        
        logger.info(f"Validation complete: {results['files_validated']} files validated, "
                   f"{results['files_ignored']} files ignored, {results['total_issues']} issues found")
        
        return results
    
    def _should_validate_file(self, file_path: Path) -> bool:
        """Check if a file should be validated based on extension and patterns."""
        # Only validate text files
        text_extensions = {'.py', '.txt', '.md', '.yml', '.yaml', '.json', '.toml', '.cfg', '.ini'}
        
        if file_path.suffix.lower() not in text_extensions:
            return False
        
        # Check file ignore patterns
        if self.validation_config.should_ignore('file', str(file_path)):
            return False
        
        return True
    
    def get_config_summary(self) -> Dict[str, Any]:
        """Get summary of validation configuration."""
        return self.validation_config.get_config_summary()


class FileToolsMCP:
    """
    MCP file tools with integrated validation support.
    
    Provides secure file operations with pattern-based ignore functionality
    to reduce false positives when working with framework code.
    """
    
    def __init__(self):
        self.validator = CodeValidator()
        self.validation_config = get_validation_config()
    
    def read_file_safe(self, file_path: str, validate: bool = True) -> Dict[str, Any]:
        """
        Safely read a file with optional validation.
        
        Args:
            file_path: Path to the file to read
            validate: Whether to run validation on the file content
            
        Returns:
            Dictionary containing file content and validation results
        """
        path = Path(file_path)
        
        result = {
            'file_path': file_path,
            'success': False,
            'content': None,
            'validation': None,
            'error': None
        }
        
        try:
            # Check if file exists
            if not path.exists():
                result['error'] = 'File does not exist'
                return result
            
            # Read file content
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            result['content'] = content
            result['success'] = True
            
            # Optional validation
            if validate:
                validation_result = self.validator.validate_file(path)
                result['validation'] = validation_result
                
                # Add warning if issues found
                if validation_result.get('total_issues', 0) > 0:
                    result['warning'] = f"Found {validation_result['total_issues']} potential issues"
            
            logger.info(f"Successfully read file: {file_path}")
            
        except Exception as e:
            result['error'] = str(e)
            logger.error(f"Error reading file {file_path}: {e}")
        
        return result
    
    def write_file_safe(self, file_path: str, content: str, validate: bool = True) -> Dict[str, Any]:
        """
        Safely write content to a file with optional validation.
        
        Args:
            file_path: Path to write the file
            content: Content to write
            validate: Whether to validate the content before writing
            
        Returns:
            Dictionary containing operation results
        """
        path = Path(file_path)
        
        result = {
            'file_path': file_path,
            'success': False,
            'validation': None,
            'error': None
        }
        
        temp_path = None
        try:
            # Optional pre-write validation
            if validate:
                # Create a temporary validation by writing to a temp file
                import tempfile
                with tempfile.NamedTemporaryFile(mode='w', suffix=path.suffix, delete=False) as temp_file:
                    temp_file.write(content)
                    temp_path = Path(temp_file.name)
                
                validation_result = self.validator.validate_file(temp_path)
                result['validation'] = validation_result
                
                # Check for high-severity issues
                high_severity_issues = [
                    issue for issue in validation_result.get('issues', [])
                    if issue.get('severity') == 'high'
                ]
                
                if high_severity_issues:
                    result['error'] = f"High-severity security issues detected: {len(high_severity_issues)} issues"
                    result['validation']['blocked'] = True
                    return result
            
            # Ensure parent directory exists
            path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write file
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            result['success'] = True
            logger.info(f"Successfully wrote file: {file_path}")
            
        except Exception as e:
            result['error'] = str(e)
            logger.error(f"Error writing file {file_path}: {e}")
        
        finally:
            # Ensure temporary file is always cleaned up
            if temp_path and temp_path.exists():
                try:
                    temp_path.unlink()
                    logger.debug(f"Cleaned up temporary file: {temp_path}")
                except Exception as cleanup_error:
                    logger.warning(f"Failed to cleanup temporary file {temp_path}: {cleanup_error}")
        
        return result
    
    def validate_directory_tree(self, directory_path: str, recursive: bool = True) -> Dict[str, Any]:
        """
        Validate all files in a directory tree.
        
        Args:
            directory_path: Root directory to validate
            recursive: Whether to validate subdirectories
            
        Returns:
            Comprehensive validation results
        """
        path = Path(directory_path)
        
        if not path.exists():
            return {
                'error': 'Directory does not exist',
                'directory_path': directory_path
            }
        
        if not path.is_dir():
            return {
                'error': 'Path is not a directory',
                'directory_path': directory_path
            }
        
        return self.validator.validate_directory(path, recursive)
    
    def update_validation_config(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update validation configuration.
        
        Args:
            updates: Dictionary of configuration updates
            
        Returns:
            Updated configuration summary
        """
        result = {
            'success': False,
            'updated_patterns': [],
            'error': None
        }
        
        try:
            # Handle pattern additions
            if 'add_patterns' in updates:
                for category, patterns in updates['add_patterns'].items():
                    for pattern in patterns:
                        if self.validation_config.add_pattern(category, pattern):
                            result['updated_patterns'].append(f"Added {category}: {pattern}")
            
            # Handle pattern removals
            if 'remove_patterns' in updates:
                for category, patterns in updates['remove_patterns'].items():
                    for pattern in patterns:
                        if self.validation_config.remove_pattern(category, pattern):
                            result['updated_patterns'].append(f"Removed {category}: {pattern}")
            
            # Save configuration
            self.validation_config.save_config()
            result['success'] = True
            
        except Exception as e:
            result['error'] = str(e)
            logger.error(f"Error updating validation config: {e}")
        
        return result
    
    def get_validation_statistics(self) -> Dict[str, Any]:
        """Get comprehensive validation system statistics."""
        return {
            'config_summary': self.validator.get_config_summary(),
            'pattern_statistics': self.validation_config.pattern_matcher.get_statistics(),
            'suspicious_patterns': len(self.validator.suspicious_patterns)
        }


# Example usage and testing functions
def example_validate_fastapi_code():
    """Example validation of FastAPI code that should be ignored."""
    fastapi_code = '''
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class User(BaseModel):
    name: str
    email: str

@app.get("/users")
async def get_users():
    return {"users": []}

@app.post("/users")
async def create_user(user: User):
    return user
'''
    
    tools = FileToolsMCP()
    
    # Write the code to a temp file and validate
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(fastapi_code)
        temp_path = f.name
    
    result = tools.read_file_safe(temp_path, validate=True)
    Path(temp_path).unlink()  # Clean up
    
    return result


def example_validate_suspicious_code():
    """Example validation of code with actual security issues."""
    suspicious_code = '''
import os
import subprocess

def dangerous_function(user_input):
    # This should trigger validation warnings
    os.system(f"rm -rf {user_input}")
    subprocess.call(["wget", user_input])
    eval(user_input)
    
def unsafe_file_ops():
    import pickle
    with open("data.pkl", "rb") as f:
        return pickle.load(f)  # Unsafe deserialization
'''
    
    tools = FileToolsMCP()
    
    # Write the code to a temp file and validate
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(suspicious_code)
        temp_path = f.name
    
    result = tools.read_file_safe(temp_path, validate=True)
    Path(temp_path).unlink()  # Clean up
    
    return result


if __name__ == "__main__":
    # Example usage
    print("=== FastAPI Code Validation (should have minimal issues) ===")
    fastapi_result = example_validate_fastapi_code()
    print(json.dumps(fastapi_result, indent=2))
    
    print("\n=== Suspicious Code Validation (should have many issues) ===")
    suspicious_result = example_validate_suspicious_code()
    print(json.dumps(suspicious_result, indent=2))
    
    print("\n=== Validation Statistics ===")
    tools = FileToolsMCP()
    stats = tools.get_validation_statistics()
    print(json.dumps(stats, indent=2))