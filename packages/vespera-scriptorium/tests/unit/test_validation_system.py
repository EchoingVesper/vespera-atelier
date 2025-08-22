"""
Comprehensive test suite for the validation ignore pattern system.

Tests pattern compilation, matching effectiveness, framework coverage,
and performance to ensure the validation system works correctly.
"""

import json
import pytest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, mock_open

from validation_config import (
    ValidationConfig, PatternMatcher, ValidationConfigManager,
    get_validation_config, should_ignore_validation
)
from file_tools_mcp import CodeValidator, FileToolsMCP


class TestValidationConfig:
    """Test ValidationConfig data class."""
    
    def test_from_dict(self):
        """Test ValidationConfig creation from dictionary."""
        data = {
            'functions': ['@app.*', 'test_*'],
            'imports': ['fastapi.*', 'pytest.*'],
            'classes': ['BaseModel', 'FastAPI'],
            'attributes': ['app.get', 'app.post'],
            'file_patterns': ['test_*.py', '*.yml']
        }
        
        config = ValidationConfig.from_dict(data)
        
        assert config.functions == ['@app.*', 'test_*']
        assert config.imports == ['fastapi.*', 'pytest.*']
        assert config.classes == ['BaseModel', 'FastAPI']
        assert config.attributes == ['app.get', 'app.post']
        assert config.file_patterns == ['test_*.py', '*.yml']
    
    def test_to_dict(self):
        """Test ValidationConfig conversion to dictionary."""
        config = ValidationConfig(
            functions=['@app.*'],
            imports=['fastapi.*'],
            classes=['BaseModel'],
            attributes=['app.get'],
            file_patterns=['test_*.py']
        )
        
        data = config.to_dict()
        
        assert data['functions'] == ['@app.*']
        assert data['imports'] == ['fastapi.*']
        assert data['classes'] == ['BaseModel']
        assert data['attributes'] == ['app.get']
        assert data['file_patterns'] == ['test_*.py']


class TestPatternMatcher:
    """Test PatternMatcher compilation and matching."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.matcher = PatternMatcher()
        self.test_config = ValidationConfig(
            functions=['@app.*', 'test_*', 'BaseModel.*', 'pytest.*'],
            imports=['fastapi.*', 'pydantic.*', 'pytest.*'],
            classes=['HTTPException', 'BaseModel', 'FastAPI'],
            attributes=['app.get', 'app.post', '*.config'],
            file_patterns=['test_*.py', '*_test.py', 'conftest.py']
        )
    
    def test_pattern_compilation(self):
        """Test regex pattern compilation from glob-like patterns."""
        self.matcher.compile_patterns(self.test_config)
        
        # Check that patterns are compiled
        assert len(self.matcher.compiled_patterns['functions']) == 4
        assert len(self.matcher.compiled_patterns['imports']) == 3
        assert len(self.matcher.compiled_patterns['classes']) == 3
        assert len(self.matcher.compiled_patterns['attributes']) == 3
        assert len(self.matcher.compiled_patterns['file_patterns']) == 3
    
    def test_convert_to_regex(self):
        """Test glob-to-regex conversion."""
        # Decorator patterns
        assert self.matcher._convert_to_regex('@app.*') == '^@app\\..*$'
        
        # Module patterns with dots
        assert self.matcher._convert_to_regex('fastapi.*') == '^fastapi\\..*$'
        
        # Simple wildcard patterns
        assert self.matcher._convert_to_regex('test_*') == '^test_.*$'
        
        # Exact match patterns
        assert self.matcher._convert_to_regex('BaseModel') == '^BaseModel$'
    
    def test_function_pattern_matching(self):
        """Test function pattern matching."""
        self.matcher.compile_patterns(self.test_config)
        
        # Should match
        assert self.matcher.should_ignore_function('@app.get')
        assert self.matcher.should_ignore_function('@app.post')
        assert self.matcher.should_ignore_function('test_user_creation')
        assert self.matcher.should_ignore_function('test_api_endpoint')
        assert self.matcher.should_ignore_function('BaseModel.parse_obj')
        assert self.matcher.should_ignore_function('pytest.fixture')
        
        # Should not match
        assert not self.matcher.should_ignore_function('dangerous_function')
        assert not self.matcher.should_ignore_function('user_input_handler')
        assert not self.matcher.should_ignore_function('exec_command')
    
    def test_import_pattern_matching(self):
        """Test import pattern matching."""
        self.matcher.compile_patterns(self.test_config)
        
        # Should match
        assert self.matcher.should_ignore_import('fastapi.FastAPI')
        assert self.matcher.should_ignore_import('fastapi.HTTPException')
        assert self.matcher.should_ignore_import('pydantic.BaseModel')
        assert self.matcher.should_ignore_import('pydantic.Field')
        assert self.matcher.should_ignore_import('pytest.fixture')
        
        # Should not match
        assert not self.matcher.should_ignore_import('os.system')
        assert not self.matcher.should_ignore_import('subprocess.call')
        assert not self.matcher.should_ignore_import('pickle.loads')
    
    def test_class_pattern_matching(self):
        """Test class pattern matching."""
        self.matcher.compile_patterns(self.test_config)
        
        # Should match
        assert self.matcher.should_ignore_class('HTTPException')
        assert self.matcher.should_ignore_class('BaseModel')
        assert self.matcher.should_ignore_class('FastAPI')
        
        # Should not match (case insensitive)
        assert self.matcher.should_ignore_class('httpexception')  # Case insensitive
        assert not self.matcher.should_ignore_class('DangerousClass')
        assert not self.matcher.should_ignore_class('UserInputHandler')
    
    def test_attribute_pattern_matching(self):
        """Test attribute pattern matching."""
        self.matcher.compile_patterns(self.test_config)
        
        # Should match
        assert self.matcher.should_ignore_attribute('app.get')
        assert self.matcher.should_ignore_attribute('app.post')
        assert self.matcher.should_ignore_attribute('settings.config')
        assert self.matcher.should_ignore_attribute('database.config')
        
        # Should not match
        assert not self.matcher.should_ignore_attribute('system.execute')
        assert not self.matcher.should_ignore_attribute('os.system')
    
    def test_file_pattern_matching(self):
        """Test file pattern matching."""
        self.matcher.compile_patterns(self.test_config)
        
        # Should match
        assert self.matcher.should_ignore_file('test_user.py')
        assert self.matcher.should_ignore_file('api_test.py')
        assert self.matcher.should_ignore_file('conftest.py')
        assert self.matcher.should_ignore_file('/path/to/test_something.py')
        
        # Should not match
        assert not self.matcher.should_ignore_file('main.py')
        assert not self.matcher.should_ignore_file('user_handler.py')
        assert not self.matcher.should_ignore_file('dangerous_script.py')
    
    def test_pattern_caching(self):
        """Test pattern matching caching for performance."""
        self.matcher.compile_patterns(self.test_config)
        
        # First call should compute and cache
        result1 = self.matcher.should_ignore_function('test_function')
        
        # Second call should use cache
        result2 = self.matcher.should_ignore_function('test_function')
        
        assert result1 == result2 == True
        assert 'func:test_function' in self.matcher.pattern_cache
    
    def test_statistics(self):
        """Test pattern statistics collection."""
        self.matcher.compile_patterns(self.test_config)
        
        # Trigger some cache entries
        self.matcher.should_ignore_function('test_func')
        self.matcher.should_ignore_import('fastapi.FastAPI')
        
        stats = self.matcher.get_statistics()
        
        assert stats['function_patterns'] == 4
        assert stats['import_patterns'] == 3
        assert stats['class_patterns'] == 3
        assert stats['attribute_patterns'] == 3
        assert stats['file_patterns'] == 3
        assert stats['cache_entries'] >= 2


class TestValidationConfigManager:
    """Test ValidationConfigManager functionality."""
    
    def setup_method(self):
        """Set up test fixtures with temporary config file."""
        self.temp_dir = Path(tempfile.mkdtemp())
        self.config_path = self.temp_dir / "validation_config.json"
        self.manager = ValidationConfigManager(self.config_path)
    
    def teardown_method(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.temp_dir)
    
    def test_default_config_creation(self):
        """Test default configuration creation when no file exists."""
        # Config should be created with defaults
        assert self.manager.config is not None
        assert len(self.manager.config.functions) > 0
        assert len(self.manager.config.imports) > 0
        assert len(self.manager.config.classes) > 0
        
        # File should be created
        assert self.config_path.exists()
    
    def test_config_loading_and_saving(self):
        """Test configuration loading and saving."""
        # Modify config
        original_functions = self.manager.config.functions.copy()
        self.manager.config.functions.append('new_pattern_*')
        
        # Save config
        self.manager.save_config()
        
        # Create new manager to test loading
        new_manager = ValidationConfigManager(self.config_path)
        
        # Should load the modified config
        assert 'new_pattern_*' in new_manager.config.functions
        assert len(new_manager.config.functions) == len(original_functions) + 1
    
    def test_pattern_addition_and_removal(self):
        """Test adding and removing patterns."""
        # Add pattern
        result = self.manager.add_pattern('functions', 'new_test_*')
        assert result == True
        assert 'new_test_*' in self.manager.config.functions
        
        # Try to add duplicate
        result = self.manager.add_pattern('functions', 'new_test_*')
        assert result == False
        
        # Remove pattern
        result = self.manager.remove_pattern('functions', 'new_test_*')
        assert result == True
        assert 'new_test_*' not in self.manager.config.functions
        
        # Try to remove non-existent pattern
        result = self.manager.remove_pattern('functions', 'non_existent_*')
        assert result == False
    
    def test_should_ignore_integration(self):
        """Test should_ignore method integration."""
        # Test function ignoring
        assert self.manager.should_ignore('function', 'test_something')
        assert not self.manager.should_ignore('function', 'dangerous_function')
        
        # Test import ignoring
        assert self.manager.should_ignore('import', 'fastapi.FastAPI')
        assert not self.manager.should_ignore('import', 'os.system')
        
        # Test class ignoring
        assert self.manager.should_ignore('class', 'BaseModel')
        assert not self.manager.should_ignore('class', 'DangerousClass')
        
        # Test file ignoring
        assert self.manager.should_ignore('file', 'test_user.py')
        assert not self.manager.should_ignore('file', 'main.py')
    
    def test_config_summary(self):
        """Test configuration summary generation."""
        summary = self.manager.get_config_summary()
        
        assert 'config_path' in summary
        assert 'exists' in summary
        assert 'patterns' in summary
        assert 'compiled_patterns' in summary
        assert 'total_patterns' in summary
        
        assert summary['exists'] == True
        assert summary['patterns']['functions'] > 0
        assert summary['total_patterns'] > 0


class TestCodeValidator:
    """Test CodeValidator functionality."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.validator = CodeValidator()
        self.temp_dir = Path(tempfile.mkdtemp())
    
    def teardown_method(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.temp_dir)
    
    def test_fastapi_code_validation(self):
        """Test validation of legitimate FastAPI code."""
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
        
        # Write to temp file
        test_file = self.temp_dir / "test_api.py"
        test_file.write_text(fastapi_code)
        
        # Validate
        result = self.validator.validate_file(test_file)
        
        # Should have minimal issues due to ignore patterns
        assert result['ignored'] == False
        assert result['total_issues'] <= 2  # Should be very few or no issues
        
        # Check that FastAPI patterns are ignored
        issues = result['issues']
        fastapi_related = [
            issue for issue in issues 
            if any(keyword in issue.get('message', '').lower() 
                  for keyword in ['fastapi', 'basemodel', '@app'])
        ]
        assert len(fastapi_related) == 0  # FastAPI code should be ignored
    
    def test_suspicious_code_validation(self):
        """Test validation of code with actual security issues."""
        suspicious_code = '''
import os
import subprocess
import pickle

def dangerous_function(user_input):
    # These should trigger warnings
    os.system(f"rm -rf {user_input}")
    subprocess.call(["wget", user_input])
    eval(user_input)
    
def unsafe_deserialization(data):
    return pickle.loads(data)  # Unsafe
'''
        
        # Write to temp file
        test_file = self.temp_dir / "suspicious.py"
        test_file.write_text(suspicious_code)
        
        # Validate
        result = self.validator.validate_file(test_file)
        
        # Should have multiple high-severity issues
        assert result['total_issues'] > 3
        
        high_severity_issues = [
            issue for issue in result['issues']
            if issue.get('severity') == 'high'
        ]
        assert len(high_severity_issues) >= 2  # eval() and pickle.loads() at minimum
    
    def test_test_file_validation(self):
        """Test validation of test files (should be mostly ignored)."""
        test_code = '''
import pytest
from unittest.mock import Mock, patch

def test_user_creation():
    user = {"name": "test", "email": "test@example.com"}
    assert user["name"] == "test"

@pytest.fixture
def mock_database():
    return Mock()

@pytest.mark.parametrize("input,expected", [
    ("test", "test"),
    ("hello", "hello")
])
def test_string_processing(input, expected):
    assert input == expected
'''
        
        # Write to test file (matches file pattern)
        test_file = self.temp_dir / "test_users.py"
        test_file.write_text(test_code)
        
        # Validate
        result = self.validator.validate_file(test_file)
        
        # Test file should be ignored by file pattern
        assert result['ignored'] == True
        assert result['reason'] == 'File pattern match'
    
    def test_directory_validation(self):
        """Test directory tree validation."""
        # Create test directory structure
        (self.temp_dir / "src").mkdir()
        (self.temp_dir / "tests").mkdir()
        
        # Create legitimate API file
        api_file = self.temp_dir / "src" / "api.py"
        api_file.write_text('''
from fastapi import FastAPI
app = FastAPI()

@app.get("/health")
def health_check():
    return {"status": "ok"}
''')
        
        # Create suspicious file
        suspicious_file = self.temp_dir / "src" / "backdoor.py"
        suspicious_file.write_text('''
import os
def execute_command(cmd):
    os.system(cmd)  # Dangerous
''')
        
        # Create test file (should be ignored)
        test_file = self.temp_dir / "tests" / "test_api.py"
        test_file.write_text('''
def test_health():
    assert True
''')
        
        # Validate directory
        result = self.validator.validate_directory(self.temp_dir)
        
        assert result['files_validated'] >= 2  # api.py and backdoor.py
        assert result['files_ignored'] >= 1   # test_api.py
        assert result['total_issues'] >= 1    # from backdoor.py
        
        # Check that legitimate API has few/no issues
        api_result = result['files'][str(api_file)]
        assert api_result['total_issues'] <= 1
        
        # Check that suspicious file has issues
        suspicious_result = result['files'][str(suspicious_file)]
        assert suspicious_result['total_issues'] >= 1


class TestFileToolsMCP:
    """Test FileToolsMCP integration."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.tools = FileToolsMCP()
        self.temp_dir = Path(tempfile.mkdtemp())
    
    def teardown_method(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.temp_dir)
    
    def test_safe_file_reading_with_validation(self):
        """Test safe file reading with validation."""
        # Create test file
        test_file = self.temp_dir / "test.py"
        test_file.write_text('print("Hello, World!")')
        
        # Read with validation
        result = self.tools.read_file_safe(str(test_file), validate=True)
        
        assert result['success'] == True
        assert result['content'] == 'print("Hello, World!")'
        assert result['validation'] is not None
        assert result['validation']['total_issues'] == 0
    
    def test_safe_file_writing_with_validation(self):
        """Test safe file writing with validation."""
        test_file = self.temp_dir / "new_file.py"
        
        # Write safe content
        safe_content = '''
from fastapi import FastAPI
app = FastAPI()

@app.get("/")
def root():
    return {"message": "Hello"}
'''
        
        result = self.tools.write_file_safe(str(test_file), safe_content, validate=True)
        
        assert result['success'] == True
        assert result['validation'] is not None
        assert test_file.exists()
        
        # Try to write dangerous content
        dangerous_content = '''
import os
def backdoor(cmd):
    os.system(cmd)  # This should be blocked
    eval(cmd)       # This too
'''
        
        result = self.tools.write_file_safe(str(test_file), dangerous_content, validate=True)
        
        # Should be blocked due to high-severity issues
        assert result['success'] == False
        assert 'High-severity security issues detected' in result['error']
    
    def test_validation_config_updates(self):
        """Test validation configuration updates."""
        # Add new patterns
        updates = {
            'add_patterns': {
                'functions': ['custom_test_*'],
                'imports': ['custom_framework.*']
            }
        }
        
        result = self.tools.update_validation_config(updates)
        
        assert result['success'] == True
        assert len(result['updated_patterns']) == 2
        
        # Test that new patterns work
        assert self.tools.validation_config.should_ignore('function', 'custom_test_something')
        assert self.tools.validation_config.should_ignore('import', 'custom_framework.module')
    
    def test_validation_statistics(self):
        """Test validation statistics retrieval."""
        stats = self.tools.get_validation_statistics()
        
        assert 'config_summary' in stats
        assert 'pattern_statistics' in stats
        assert 'suspicious_patterns' in stats
        
        assert stats['suspicious_patterns'] > 0
        assert stats['config_summary']['total_patterns'] > 0


class TestFrameworkCoverage:
    """Test coverage of specific frameworks and their patterns."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.manager = ValidationConfigManager()
    
    def test_fastapi_coverage(self):
        """Test FastAPI pattern coverage."""
        fastapi_items = [
            ('function', '@app.get'),
            ('function', '@app.post'),
            ('function', 'FastAPI'),
            ('import', 'fastapi.FastAPI'),
            ('import', 'fastapi.HTTPException'),
            ('class', 'HTTPException'),
            ('class', 'FastAPI'),
            ('attribute', 'app.get'),
            ('attribute', 'app.post')
        ]
        
        for item_type, item_name in fastapi_items:
            assert self.manager.should_ignore(item_type, item_name), \
                f"FastAPI {item_type} '{item_name}' should be ignored"
    
    def test_pydantic_coverage(self):
        """Test Pydantic pattern coverage."""
        pydantic_items = [
            ('function', 'BaseModel'),
            ('function', 'Field'),
            ('function', 'validator'),
            ('import', 'pydantic.BaseModel'),
            ('import', 'pydantic.Field'),
            ('class', 'BaseModel'),
            ('class', 'Field'),
            ('class', 'ValidationError')
        ]
        
        for item_type, item_name in pydantic_items:
            assert self.manager.should_ignore(item_type, item_name), \
                f"Pydantic {item_type} '{item_name}' should be ignored"
    
    def test_sqlalchemy_coverage(self):
        """Test SQLAlchemy pattern coverage."""
        sqlalchemy_items = [
            ('function', 'Column'),
            ('function', 'relationship'),
            ('function', 'sessionmaker'),
            ('import', 'sqlalchemy.Column'),
            ('import', 'sqlalchemy.orm'),
            ('class', 'Session'),
            ('class', 'Engine')
        ]
        
        for item_type, item_name in sqlalchemy_items:
            assert self.manager.should_ignore(item_type, item_name), \
                f"SQLAlchemy {item_type} '{item_name}' should be ignored"
    
    def test_pytest_coverage(self):
        """Test pytest pattern coverage."""
        pytest_items = [
            ('function', 'pytest.fixture'),
            ('function', 'test_user_creation'),
            ('function', '@pytest.mark'),
            ('import', 'pytest.fixture'),
            ('import', 'pytest.mark'),
            ('file', 'test_user.py'),
            ('file', 'conftest.py')
        ]
        
        for item_type, item_name in pytest_items:
            assert self.manager.should_ignore(item_type, item_name), \
                f"Pytest {item_type} '{item_name}' should be ignored"


class TestPerformance:
    """Test performance characteristics of the validation system."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.manager = ValidationConfigManager()
        self.large_pattern_config = ValidationConfig(
            functions=[f'pattern_{i}_*' for i in range(100)],
            imports=[f'module_{i}.*' for i in range(100)], 
            classes=[f'Class_{i}' for i in range(100)],
            attributes=[f'attr_{i}.*' for i in range(100)],
            file_patterns=[f'*pattern_{i}*.py' for i in range(100)]
        )
    
    def test_pattern_compilation_performance(self):
        """Test that pattern compilation is reasonably fast."""
        import time
        
        matcher = PatternMatcher()
        
        start_time = time.time()
        matcher.compile_patterns(self.large_pattern_config)
        compile_time = time.time() - start_time
        
        # Should compile 500 patterns in under 1 second
        assert compile_time < 1.0, f"Pattern compilation took {compile_time:.2f}s (too slow)"
    
    def test_pattern_matching_performance(self):
        """Test that pattern matching is reasonably fast."""
        import time
        
        matcher = PatternMatcher()
        matcher.compile_patterns(self.large_pattern_config)
        
        # Test 1000 function lookups
        start_time = time.time()
        for i in range(1000):
            matcher.should_ignore_function(f'test_function_{i}')
        lookup_time = time.time() - start_time
        
        # Should do 1000 lookups in under 0.1 seconds
        assert lookup_time < 0.1, f"1000 pattern lookups took {lookup_time:.2f}s (too slow)"
    
    def test_caching_effectiveness(self):
        """Test that caching improves performance."""
        import time
        
        matcher = PatternMatcher()
        matcher.compile_patterns(self.manager.config)
        
        # First lookup (uncached)
        start_time = time.time()
        result1 = matcher.should_ignore_function('test_function')
        first_time = time.time() - start_time
        
        # Second lookup (cached)
        start_time = time.time()
        result2 = matcher.should_ignore_function('test_function')
        second_time = time.time() - start_time
        
        assert result1 == result2
        assert second_time < first_time or second_time < 0.001  # Cached should be faster or negligible


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])