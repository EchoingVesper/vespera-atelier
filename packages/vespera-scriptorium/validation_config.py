"""
Validation Configuration Manager

Manages ignore patterns for validation system to reduce false positives
when analyzing framework code and legitimate libraries.
"""

import json
import re
import logging
from pathlib import Path
from typing import Dict, List, Optional, Set, Pattern
from dataclasses import dataclass
import fnmatch


logger = logging.getLogger(__name__)


@dataclass
class ValidationConfig:
    """Configuration for validation ignore patterns."""
    functions: List[str]
    imports: List[str] 
    classes: List[str]
    attributes: List[str]
    file_patterns: List[str]
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'ValidationConfig':
        """Create ValidationConfig from dictionary."""
        return cls(
            functions=data.get('functions', []),
            imports=data.get('imports', []),
            classes=data.get('classes', []),
            attributes=data.get('attributes', []),
            file_patterns=data.get('file_patterns', [])
        )
    
    def to_dict(self) -> Dict:
        """Convert ValidationConfig to dictionary."""
        return {
            'functions': self.functions,
            'imports': self.imports,
            'classes': self.classes,
            'attributes': self.attributes,
            'file_patterns': self.file_patterns
        }


class PatternMatcher:
    """
    Handles compilation and matching of ignore patterns.
    
    Supports both glob-like patterns (*.py, test_*) and regex patterns
    with proper anchoring for exact matches.
    """
    
    def __init__(self, max_cache_size: int = 10000, lazy_compilation: bool = True):
        self.compiled_patterns: Dict[str, List[Pattern]] = {
            'functions': [],
            'imports': [],
            'classes': [],
            'attributes': [],
            'file_patterns': []
        }
        self.pattern_cache: Dict[str, bool] = {}
        self.max_cache_size = max_cache_size
        self.cache_hits = 0
        self.cache_misses = 0
        self.lazy_compilation = lazy_compilation
        self._raw_patterns: Optional[ValidationConfig] = None
        self._patterns_compiled = False
    
    def compile_patterns(self, config: ValidationConfig) -> None:
        """Compile all patterns for efficient matching."""
        self._raw_patterns = config
        
        if self.lazy_compilation:
            # Store patterns but don't compile until first use
            self._patterns_compiled = False
            logger.debug("Stored patterns for lazy compilation")
        else:
            # Compile immediately
            self._compile_patterns_now()
    
    def _compile_patterns_now(self) -> None:
        """Actually compile the patterns."""
        if self._patterns_compiled or not self._raw_patterns:
            return
            
        logger.debug("Compiling validation ignore patterns")
        config = self._raw_patterns
        
        # Clear existing patterns
        self.compiled_patterns = {
            'functions': [],
            'imports': [],
            'classes': [],
            'attributes': [],
            'file_patterns': []
        }
        self.pattern_cache.clear()
        
        # Compile function patterns
        for pattern in config.functions:
            try:
                regex_pattern = self._convert_to_regex(pattern)
                compiled = re.compile(regex_pattern, re.IGNORECASE)
                self.compiled_patterns['functions'].append(compiled)
                logger.debug(f"Compiled function pattern: {pattern} -> {regex_pattern}")
            except re.error as e:
                logger.warning(f"Invalid function pattern '{pattern}': {e}")
        
        # Compile import patterns  
        for pattern in config.imports:
            try:
                regex_pattern = self._convert_to_regex(pattern)
                compiled = re.compile(regex_pattern, re.IGNORECASE)
                self.compiled_patterns['imports'].append(compiled)
                logger.debug(f"Compiled import pattern: {pattern} -> {regex_pattern}")
            except re.error as e:
                logger.warning(f"Invalid import pattern '{pattern}': {e}")
        
        # Compile class patterns
        for pattern in config.classes:
            try:
                regex_pattern = self._convert_to_regex(pattern)
                compiled = re.compile(regex_pattern, re.IGNORECASE)
                self.compiled_patterns['classes'].append(compiled)
                logger.debug(f"Compiled class pattern: {pattern} -> {regex_pattern}")
            except re.error as e:
                logger.warning(f"Invalid class pattern '{pattern}': {e}")
        
        # Compile attribute patterns
        for pattern in config.attributes:
            try:
                regex_pattern = self._convert_to_regex(pattern)
                compiled = re.compile(regex_pattern, re.IGNORECASE)
                self.compiled_patterns['attributes'].append(compiled)
                logger.debug(f"Compiled attribute pattern: {pattern} -> {regex_pattern}")
            except re.error as e:
                logger.warning(f"Invalid attribute pattern '{pattern}': {e}")
        
        # Compile file patterns (use fnmatch for file paths)
        for pattern in config.file_patterns:
            try:
                # File patterns use fnmatch instead of regex for path matching
                self.compiled_patterns['file_patterns'].append(pattern)
                logger.debug(f"Added file pattern: {pattern}")
            except Exception as e:
                logger.warning(f"Invalid file pattern '{pattern}': {e}")
        
        self._patterns_compiled = True
        logger.info(f"Compiled {sum(len(patterns) for patterns in self.compiled_patterns.values())} validation patterns")
    
    def _convert_to_regex(self, pattern: str) -> str:
        """
        Convert glob-like pattern to regex with proper anchoring.
        
        Handles:
        - * for any characters
        - ? for single character
        - @ for decorator patterns
        - . for literal dots in module names
        """
        # Handle decorator patterns specially
        if pattern.startswith('@'):
            # @app.* becomes ^@app\..*$
            escaped = re.escape(pattern)
            escaped = escaped.replace('\\*', '.*')
            escaped = escaped.replace('\\?', '.')
            return f"^{escaped}$"
        
        # Handle module/attribute patterns (contain dots)
        if '.' in pattern:
            # fastapi.* becomes ^fastapi\..*$
            escaped = re.escape(pattern)
            escaped = escaped.replace('\\*', '.*')
            escaped = escaped.replace('\\?', '.')
            return f"^{escaped}$"
        
        # Handle simple wildcard patterns
        if '*' in pattern or '?' in pattern:
            escaped = re.escape(pattern)
            escaped = escaped.replace('\\*', '.*')
            escaped = escaped.replace('\\?', '.')
            return f"^{escaped}$"
        
        # Exact match for simple patterns
        return f"^{re.escape(pattern)}$"
    
    def should_ignore_function(self, function_name: str) -> bool:
        """Check if function should be ignored based on patterns."""
        if self.lazy_compilation and not self._patterns_compiled:
            self._compile_patterns_now()
            
        cache_key = f"func:{function_name}"
        if cache_key in self.pattern_cache:
            self.cache_hits += 1
            return self.pattern_cache[cache_key]
        
        self.cache_misses += 1
        for pattern in self.compiled_patterns['functions']:
            if pattern.match(function_name):
                logger.debug(f"Function '{function_name}' matched ignore pattern: {pattern.pattern}")
                self._add_to_cache(cache_key, True)
                return True
        
        self._add_to_cache(cache_key, False)
        return False
    
    def should_ignore_import(self, import_name: str) -> bool:
        """Check if import should be ignored based on patterns."""
        if self.lazy_compilation and not self._patterns_compiled:
            self._compile_patterns_now()
            
        cache_key = f"import:{import_name}"
        if cache_key in self.pattern_cache:
            self.cache_hits += 1
            return self.pattern_cache[cache_key]
        
        self.cache_misses += 1
        for pattern in self.compiled_patterns['imports']:
            if pattern.match(import_name):
                logger.debug(f"Import '{import_name}' matched ignore pattern: {pattern.pattern}")
                self._add_to_cache(cache_key, True)
                return True
        
        self._add_to_cache(cache_key, False)
        return False
    
    def should_ignore_class(self, class_name: str) -> bool:
        """Check if class should be ignored based on patterns."""
        if self.lazy_compilation and not self._patterns_compiled:
            self._compile_patterns_now()
            
        cache_key = f"class:{class_name}"
        if cache_key in self.pattern_cache:
            self.cache_hits += 1
            return self.pattern_cache[cache_key]
        
        self.cache_misses += 1
        for pattern in self.compiled_patterns['classes']:
            if pattern.match(class_name):
                logger.debug(f"Class '{class_name}' matched ignore pattern: {pattern.pattern}")
                self._add_to_cache(cache_key, True)
                return True
        
        self._add_to_cache(cache_key, False)
        return False
    
    def should_ignore_attribute(self, attribute_name: str) -> bool:
        """Check if attribute should be ignored based on patterns."""
        if self.lazy_compilation and not self._patterns_compiled:
            self._compile_patterns_now()
            
        cache_key = f"attr:{attribute_name}"
        if cache_key in self.pattern_cache:
            self.cache_hits += 1
            return self.pattern_cache[cache_key]
        
        self.cache_misses += 1
        for pattern in self.compiled_patterns['attributes']:
            if pattern.match(attribute_name):
                logger.debug(f"Attribute '{attribute_name}' matched ignore pattern: {pattern.pattern}")
                self._add_to_cache(cache_key, True)
                return True
        
        self._add_to_cache(cache_key, False)
        return False
    
    def should_ignore_file(self, file_path: str) -> bool:
        """Check if file should be ignored based on file patterns."""
        if self.lazy_compilation and not self._patterns_compiled:
            self._compile_patterns_now()
            
        cache_key = f"file:{file_path}"
        if cache_key in self.pattern_cache:
            self.cache_hits += 1
            return self.pattern_cache[cache_key]
        
        self.cache_misses += 1
        for pattern in self.compiled_patterns['file_patterns']:
            if fnmatch.fnmatch(file_path, pattern) or fnmatch.fnmatch(Path(file_path).name, pattern):
                logger.debug(f"File '{file_path}' matched ignore pattern: {pattern}")
                self._add_to_cache(cache_key, True)
                return True
        
        self._add_to_cache(cache_key, False)
        return False
    
    def _add_to_cache(self, key: str, value: bool) -> None:
        """Add entry to cache with size management."""
        if len(self.pattern_cache) >= self.max_cache_size:
            # Remove oldest entries (simple FIFO eviction)
            oldest_keys = list(self.pattern_cache.keys())[:self.max_cache_size // 4]
            for old_key in oldest_keys:
                del self.pattern_cache[old_key]
            logger.debug(f"Cache evicted {len(oldest_keys)} entries to stay under {self.max_cache_size} limit")
        
        self.pattern_cache[key] = value
    
    def get_statistics(self) -> Dict[str, int]:
        """Get pattern matching statistics."""
        cache_total = self.cache_hits + self.cache_misses
        hit_rate = (self.cache_hits / cache_total * 100) if cache_total > 0 else 0
        
        return {
            'function_patterns': len(self.compiled_patterns['functions']),
            'import_patterns': len(self.compiled_patterns['imports']),
            'class_patterns': len(self.compiled_patterns['classes']),
            'attribute_patterns': len(self.compiled_patterns['attributes']),
            'file_patterns': len(self.compiled_patterns['file_patterns']),
            'cache_entries': len(self.pattern_cache),
            'cache_hits': self.cache_hits,
            'cache_misses': self.cache_misses,
            'cache_hit_rate_percent': round(hit_rate, 2),
            'max_cache_size': self.max_cache_size,
            'lazy_compilation': self.lazy_compilation,
            'patterns_compiled': self._patterns_compiled
        }


class ValidationConfigManager:
    """
    Manages loading, saving, and access to validation configuration.
    
    Handles configuration file management and pattern compilation
    for the validation ignore system.
    """
    
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or Path(".vespera/validation_config.json")
        self.config: Optional[ValidationConfig] = None
        self.pattern_matcher = PatternMatcher()
        self._load_config()
    
    def _load_config(self) -> None:
        """Load configuration from file or create default."""
        try:
            if self.config_path.exists():
                with open(self.config_path, 'r') as f:
                    data = json.load(f)
                
                # Validate configuration structure
                if not self._validate_config_structure(data):
                    logger.error(f"Invalid configuration structure in {self.config_path}")
                    raise ValueError("Invalid configuration structure")
                
                self.config = ValidationConfig.from_dict(data)
                logger.info(f"Loaded validation config from {self.config_path}")
            else:
                logger.info(f"Config file not found at {self.config_path}, creating default")
                self.config = self._get_default_config()
                self.save_config()
            
            # Compile patterns for efficient matching
            self.pattern_matcher.compile_patterns(self.config)
            
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Error loading validation config (malformed JSON or structure): {e}")
            logger.info("Using default configuration due to malformed config file")
            self.config = self._get_default_config()
            self.pattern_matcher.compile_patterns(self.config)
        except Exception as e:
            logger.error(f"Unexpected error loading validation config: {e}")
            logger.info("Using default configuration")
            self.config = self._get_default_config()
            self.pattern_matcher.compile_patterns(self.config)
    
    def _get_default_config(self) -> ValidationConfig:
        """Get default validation configuration with common framework patterns."""
        return ValidationConfig(
            functions=[
                # FastAPI decorators and functions
                "@app.*", "@router.*", "FastAPI", "APIRouter",
                # Pydantic validators and functions
                "Field", "validator", "root_validator", "parse_obj", "BaseModel.*",
                # SQLAlchemy patterns
                "Column", "relationship", "sessionmaker", "declarative_base",
                # Pytest patterns
                "pytest.*", "@pytest.*", "fixture", "mark", "param",
                # General framework patterns
                "@.*", "test_*", "*_test", "setup_*", "teardown_*"
            ],
            imports=[
                # FastAPI imports
                "fastapi.*", "starlette.*", "uvicorn.*",
                # Pydantic imports
                "pydantic.*", "pydantic_core.*",
                # SQLAlchemy imports
                "sqlalchemy.*", "alembic.*",
                # Testing imports
                "pytest.*", "unittest.*", "mock.*", "fixtures.*",
                # Common framework imports
                "django.*", "flask.*", "requests.*", "httpx.*"
            ],
            classes=[
                # FastAPI classes
                "HTTPException", "FastAPI", "APIRouter", "Request", "Response",
                "Depends", "Security", "OAuth2PasswordBearer", "HTTPBearer",
                # Pydantic classes
                "BaseModel", "BaseSettings", "Field", "Query", "Path", "Body",
                "Form", "File", "UploadFile", "ValidationError",
                # SQLAlchemy classes
                "Base", "Model", "Session", "Engine", "MetaData", "Table",
                # Testing classes
                "TestCase", "Mock", "MagicMock", "patch"
            ],
            attributes=[
                # FastAPI route decorators
                "app.get", "app.post", "app.put", "app.delete", "app.patch",
                "router.get", "router.post", "router.put", "router.delete",
                # Common framework attributes
                "*.config", "*.settings", "*.metadata", "*.session",
                "*.query", "*.filter", "*.order_by", "*.group_by"
            ],
            file_patterns=[
                # Test files
                "test_*.py", "*_test.py", "tests/*.py", "test/*.py",
                # Configuration files
                "config.py", "settings.py", "conftest.py",
                # Migration files
                "**/migrations/*.py", "**/alembic/versions/*.py",
                # Framework-specific files
                "manage.py", "wsgi.py", "asgi.py", "__init__.py"
            ]
        )
    
    def save_config(self) -> None:
        """Save current configuration to file."""
        try:
            # Ensure directory exists
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.config_path, 'w') as f:
                json.dump(self.config.to_dict(), f, indent=2)
            
            logger.info(f"Saved validation config to {self.config_path}")
            
        except Exception as e:
            logger.error(f"Error saving validation config: {e}")
    
    def reload_config(self) -> None:
        """Reload configuration from file."""
        self._load_config()
    
    def add_pattern(self, category: str, pattern: str) -> bool:
        """Add a new pattern to the specified category with validation."""
        if not self.config:
            return False
        
        category_list = getattr(self.config, category, None)
        if category_list is None:
            logger.error(f"Invalid category: {category}")
            return False
        
        # Validate pattern syntax before adding
        if not self._validate_pattern_syntax(category, pattern):
            logger.error(f"Invalid pattern syntax for '{pattern}' in category '{category}'")
            return False
        
        if pattern not in category_list:
            category_list.append(pattern)
            self.pattern_matcher.compile_patterns(self.config)
            logger.info(f"Added pattern '{pattern}' to category '{category}'")
            return True
        
        logger.warning(f"Pattern '{pattern}' already exists in category '{category}'")
        return False
    
    def remove_pattern(self, category: str, pattern: str) -> bool:
        """Remove a pattern from the specified category."""
        if not self.config:
            return False
        
        category_list = getattr(self.config, category, None)
        if category_list is None:
            logger.error(f"Invalid category: {category}")
            return False
        
        if pattern in category_list:
            category_list.remove(pattern)
            self.pattern_matcher.compile_patterns(self.config)
            logger.info(f"Removed pattern '{pattern}' from category '{category}'")
            return True
        
        logger.warning(f"Pattern '{pattern}' not found in category '{category}'")
        return False
    
    def should_ignore(self, item_type: str, item_name: str) -> bool:
        """Check if an item should be ignored based on its type and name."""
        if item_type == 'function':
            return self.pattern_matcher.should_ignore_function(item_name)
        elif item_type == 'import':
            return self.pattern_matcher.should_ignore_import(item_name)
        elif item_type == 'class':
            return self.pattern_matcher.should_ignore_class(item_name)
        elif item_type == 'attribute':
            return self.pattern_matcher.should_ignore_attribute(item_name)
        elif item_type == 'file':
            return self.pattern_matcher.should_ignore_file(item_name)
        else:
            logger.warning(f"Unknown item type: {item_type}")
            return False
    
    def get_config_summary(self) -> Dict:
        """Get summary of current configuration."""
        if not self.config:
            return {"error": "No configuration loaded"}
        
        stats = self.pattern_matcher.get_statistics()
        
        return {
            "config_path": str(self.config_path),
            "exists": self.config_path.exists(),
            "patterns": {
                "functions": len(self.config.functions),
                "imports": len(self.config.imports), 
                "classes": len(self.config.classes),
                "attributes": len(self.config.attributes),
                "file_patterns": len(self.config.file_patterns)
            },
            "compiled_patterns": stats,
            "total_patterns": sum(stats.values()) - stats['cache_entries']
        }


    def _validate_config_structure(self, data: Dict) -> bool:
        """Validate configuration file structure."""
        required_keys = ['functions', 'imports', 'classes', 'attributes', 'file_patterns']
        
        for key in required_keys:
            if key not in data:
                logger.error(f"Missing required configuration key: {key}")
                return False
            
            if not isinstance(data[key], list):
                logger.error(f"Configuration key '{key}' must be a list")
                return False
        
        return True
    
    def _validate_pattern_syntax(self, category: str, pattern: str) -> bool:
        """Validate pattern syntax before adding to configuration."""
        try:
            if category == 'file_patterns':
                # File patterns use fnmatch, test basic validity
                if not pattern or pattern.isspace():
                    return False
                # Test basic fnmatch pattern
                fnmatch.fnmatch('test.py', pattern)
                return True
            else:
                # Other patterns are converted to regex, test compilation
                if not pattern or pattern.isspace():
                    return False
                # Test regex compilation with our conversion logic
                if pattern.startswith('@'):
                    escaped = re.escape(pattern)
                    escaped = escaped.replace('\\*', '.*')
                    escaped = escaped.replace('\\?', '.')
                    regex_pattern = f"^{escaped}$"
                elif '.' in pattern or '*' in pattern or '?' in pattern:
                    escaped = re.escape(pattern)
                    escaped = escaped.replace('\\*', '.*')
                    escaped = escaped.replace('\\?', '.')
                    regex_pattern = f"^{escaped}$"
                else:
                    regex_pattern = f"^{re.escape(pattern)}$"
                
                # Test compilation
                re.compile(regex_pattern, re.IGNORECASE)
                return True
                
        except (re.error, Exception) as e:
            logger.warning(f"Pattern validation failed for '{pattern}': {e}")
            return False


# Global instance for easy access
_validation_config_manager: Optional[ValidationConfigManager] = None


def get_validation_config() -> ValidationConfigManager:
    """Get the global validation configuration manager."""
    global _validation_config_manager
    if _validation_config_manager is None:
        _validation_config_manager = ValidationConfigManager()
    return _validation_config_manager


def reset_validation_config() -> None:
    """Reset the global validation configuration manager for testing."""
    global _validation_config_manager
    _validation_config_manager = None


def should_ignore_validation(item_type: str, item_name: str) -> bool:
    """Convenience function to check if validation should be ignored."""
    return get_validation_config().should_ignore(item_type, item_name)