"""
Performance benchmark for the validation ignore pattern system.

Tests pattern compilation speed, matching performance, and memory usage
to ensure the validation system scales well with large codebases.
"""

import time
import psutil
import statistics
from pathlib import Path
from typing import Dict, List, Tuple
import tempfile
import random
import string

from validation_config import ValidationConfig, PatternMatcher, ValidationConfigManager
from file_tools_mcp import CodeValidator, FileToolsMCP


class PerformanceBenchmark:
    """Benchmark suite for validation system performance."""
    
    def __init__(self):
        self.results: Dict[str, Dict] = {}
    
    def benchmark_pattern_compilation(self, pattern_counts: List[int]) -> Dict[str, List[float]]:
        """Benchmark pattern compilation performance with varying pattern counts."""
        print("🔧 Benchmarking Pattern Compilation Performance")
        
        compilation_times = {count: [] for count in pattern_counts}
        
        for count in pattern_counts:
            print(f"  Testing with {count} patterns per category...")
            
            # Run multiple iterations for statistical significance
            for iteration in range(5):
                # Generate test patterns
                config = self._generate_large_config(count)
                matcher = PatternMatcher()
                
                # Measure compilation time
                start_time = time.time()
                matcher.compile_patterns(config)
                compilation_time = time.time() - start_time
                
                compilation_times[count].append(compilation_time)
                print(f"    Iteration {iteration + 1}: {compilation_time:.4f}s")
        
        # Calculate statistics
        stats = {}
        for count, times in compilation_times.items():
            stats[count] = {
                'mean': statistics.mean(times),
                'median': statistics.median(times),
                'min': min(times),
                'max': max(times),
                'stdev': statistics.stdev(times) if len(times) > 1 else 0
            }
        
        self.results['pattern_compilation'] = stats
        return stats
    
    def benchmark_pattern_matching(self, pattern_count: int, lookup_counts: List[int]) -> Dict[str, Dict]:
        """Benchmark pattern matching performance with varying lookup counts."""
        print(f"\n🎯 Benchmarking Pattern Matching Performance")
        
        # Set up matcher with patterns
        config = self._generate_large_config(pattern_count)
        matcher = PatternMatcher()
        matcher.compile_patterns(config)
        
        matching_times = {}
        
        for lookup_count in lookup_counts:
            print(f"  Testing {lookup_count} lookups...")
            
            # Generate test items to lookup
            test_functions = [f"test_function_{i}" for i in range(lookup_count)]
            test_imports = [f"module_{i}.submodule" for i in range(lookup_count)]
            test_classes = [f"TestClass_{i}" for i in range(lookup_count)]
            
            times = []
            
            # Run multiple iterations
            for iteration in range(3):
                start_time = time.time()
                
                # Test function lookups
                for func in test_functions:
                    matcher.should_ignore_function(func)
                
                # Test import lookups
                for imp in test_imports:
                    matcher.should_ignore_import(imp)
                
                # Test class lookups
                for cls in test_classes:
                    matcher.should_ignore_class(cls)
                
                total_time = time.time() - start_time
                times.append(total_time)
                
                lookups_per_second = (lookup_count * 3) / total_time
                print(f"    Iteration {iteration + 1}: {total_time:.4f}s ({lookups_per_second:.0f} lookups/sec)")
            
            matching_times[lookup_count] = {
                'mean_time': statistics.mean(times),
                'mean_lookups_per_second': (lookup_count * 3) / statistics.mean(times),
                'times': times
            }
        
        self.results['pattern_matching'] = matching_times
        return matching_times
    
    def benchmark_caching_effectiveness(self, pattern_count: int, cache_test_size: int) -> Dict[str, float]:
        """Benchmark the effectiveness of pattern matching caching."""
        print(f"\n💾 Benchmarking Caching Effectiveness")
        
        config = self._generate_large_config(pattern_count)
        matcher = PatternMatcher()
        matcher.compile_patterns(config)
        
        # Test items for caching
        test_items = [
            ('function', f'test_func_{i}') for i in range(cache_test_size // 3)
        ] + [
            ('import', f'module_{i}.test') for i in range(cache_test_size // 3)
        ] + [
            ('class', f'TestClass_{i}') for i in range(cache_test_size // 3)
        ]
        
        # First pass (cold cache)
        print("  Running cold cache test...")
        start_time = time.time()
        for item_type, item_name in test_items:
            if item_type == 'function':
                matcher.should_ignore_function(item_name)
            elif item_type == 'import':
                matcher.should_ignore_import(item_name)
            elif item_type == 'class':
                matcher.should_ignore_class(item_name)
        cold_time = time.time() - start_time
        
        # Second pass (warm cache)
        print("  Running warm cache test...")
        start_time = time.time()
        for item_type, item_name in test_items:
            if item_type == 'function':
                matcher.should_ignore_function(item_name)
            elif item_type == 'import':
                matcher.should_ignore_import(item_name)
            elif item_type == 'class':
                matcher.should_ignore_class(item_name)
        warm_time = time.time() - start_time
        
        # Calculate speedup
        speedup = cold_time / warm_time if warm_time > 0 else float('inf')
        cache_hit_rate = len(matcher.pattern_cache) / len(test_items)
        
        print(f"    Cold cache: {cold_time:.4f}s")
        print(f"    Warm cache: {warm_time:.4f}s")
        print(f"    Speedup: {speedup:.2f}x")
        print(f"    Cache entries: {len(matcher.pattern_cache)}")
        print(f"    Cache hit rate: {cache_hit_rate:.2%}")
        
        caching_results = {
            'cold_time': cold_time,
            'warm_time': warm_time,
            'speedup': speedup,
            'cache_entries': len(matcher.pattern_cache),
            'cache_hit_rate': cache_hit_rate
        }
        
        self.results['caching'] = caching_results
        return caching_results
    
    def benchmark_file_validation(self, file_sizes: List[int]) -> Dict[int, Dict]:
        """Benchmark file validation performance with different file sizes."""
        print(f"\n📄 Benchmarking File Validation Performance")
        
        validator = CodeValidator()
        validation_times = {}
        
        for size in file_sizes:
            print(f"  Testing {size}-line file...")
            
            # Generate test file
            test_code = self._generate_test_python_file(size)
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                f.write(test_code)
                temp_path = Path(f.name)
            
            try:
                times = []
                
                # Run multiple iterations
                for iteration in range(3):
                    start_time = time.time()
                    result = validator.validate_file(temp_path)
                    validation_time = time.time() - start_time
                    times.append(validation_time)
                    
                    lines_per_second = size / validation_time
                    print(f"    Iteration {iteration + 1}: {validation_time:.4f}s ({lines_per_second:.0f} lines/sec)")
                
                validation_times[size] = {
                    'mean_time': statistics.mean(times),
                    'mean_lines_per_second': size / statistics.mean(times),
                    'total_issues': result.get('total_issues', 0),
                    'times': times
                }
            
            finally:
                temp_path.unlink()
        
        self.results['file_validation'] = validation_times
        return validation_times
    
    def benchmark_memory_usage(self, pattern_count: int) -> Dict[str, float]:
        """Benchmark memory usage of the validation system."""
        print(f"\n🧠 Benchmarking Memory Usage")
        
        process = psutil.Process()
        
        # Baseline memory
        baseline_memory = process.memory_info().rss / 1024 / 1024  # MB
        print(f"  Baseline memory: {baseline_memory:.2f} MB")
        
        # Create large configuration
        config = self._generate_large_config(pattern_count)
        config_memory = process.memory_info().rss / 1024 / 1024  # MB
        print(f"  After config creation: {config_memory:.2f} MB")
        
        # Compile patterns
        matcher = PatternMatcher()
        matcher.compile_patterns(config)
        compiled_memory = process.memory_info().rss / 1024 / 1024  # MB
        print(f"  After pattern compilation: {compiled_memory:.2f} MB")
        
        # Fill cache with lookups
        for i in range(1000):
            matcher.should_ignore_function(f"test_func_{i}")
            matcher.should_ignore_import(f"module_{i}")
            matcher.should_ignore_class(f"Class_{i}")
        
        cached_memory = process.memory_info().rss / 1024 / 1024  # MB
        print(f"  After cache population: {cached_memory:.2f} MB")
        
        memory_results = {
            'baseline_mb': baseline_memory,
            'config_mb': config_memory,
            'compiled_mb': compiled_memory,
            'cached_mb': cached_memory,
            'config_overhead_mb': config_memory - baseline_memory,
            'compilation_overhead_mb': compiled_memory - config_memory,
            'cache_overhead_mb': cached_memory - compiled_memory,
            'total_overhead_mb': cached_memory - baseline_memory
        }
        
        self.results['memory_usage'] = memory_results
        return memory_results
    
    def benchmark_real_world_scenario(self) -> Dict[str, float]:
        """Benchmark a realistic real-world usage scenario."""
        print(f"\n🌍 Benchmarking Real-World Scenario")
        
        # Create realistic directory structure
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Create realistic file structure
            self._create_realistic_project(temp_path)
            
            # Benchmark directory validation
            tools = FileToolsMCP()
            
            start_time = time.time()
            result = tools.validate_directory_tree(str(temp_path), recursive=True)
            total_time = time.time() - start_time
            
            files_validated = result.get('files_validated', 0)
            files_ignored = result.get('files_ignored', 0)
            total_issues = result.get('total_issues', 0)
            
            print(f"  Validation completed in {total_time:.4f}s")
            print(f"  Files validated: {files_validated}")
            print(f"  Files ignored: {files_ignored}")
            print(f"  Total issues found: {total_issues}")
            print(f"  Files per second: {(files_validated + files_ignored) / total_time:.1f}")
            
            real_world_results = {
                'total_time': total_time,
                'files_validated': files_validated,
                'files_ignored': files_ignored,
                'total_issues': total_issues,
                'files_per_second': (files_validated + files_ignored) / total_time
            }
            
            self.results['real_world'] = real_world_results
            return real_world_results
    
    def _generate_large_config(self, pattern_count: int) -> ValidationConfig:
        """Generate a validation config with many patterns for testing."""
        functions = [f"@app.{self._random_string(5)}" for _ in range(pattern_count)]
        functions.extend([f"test_{self._random_string(8)}" for _ in range(pattern_count)])
        
        imports = [f"{self._random_string(6)}.{self._random_string(6)}.*" for _ in range(pattern_count)]
        imports.extend([f"framework_{i}.*" for i in range(pattern_count)])
        
        classes = [f"{self._random_string(8).title()}Model" for _ in range(pattern_count)]
        classes.extend([f"Base{self._random_string(6).title()}" for _ in range(pattern_count)])
        
        attributes = [f"obj.{self._random_string(6)}" for _ in range(pattern_count)]
        attributes.extend([f"*.{self._random_string(5)}" for _ in range(pattern_count)])
        
        file_patterns = [f"test_{self._random_string(6)}.py" for _ in range(pattern_count)]
        file_patterns.extend([f"*{self._random_string(4)}*.py" for _ in range(pattern_count)])
        
        return ValidationConfig(
            functions=functions,
            imports=imports,
            classes=classes,
            attributes=attributes,
            file_patterns=file_patterns
        )
    
    def _random_string(self, length: int) -> str:
        """Generate a random string for testing."""
        return ''.join(random.choices(string.ascii_lowercase, k=length))
    
    def _generate_test_python_file(self, line_count: int) -> str:
        """Generate a Python file with specified number of lines."""
        lines = [
            "# Test Python file for validation benchmarking",
            "import os",
            "import sys", 
            "from fastapi import FastAPI",
            "from pydantic import BaseModel",
            "",
            "app = FastAPI()",
            "",
            "class TestModel(BaseModel):",
            "    name: str",
            "    value: int",
            "",
            "@app.get('/')",
            "def root():",
            "    return {'message': 'Hello World'}",
            ""
        ]
        
        # Add more functions to reach target line count
        func_template = """def test_function_{i}():
    \"\"\"Test function {i}.\"\"\"
    value = {i} * 2
    return value + 1
"""
        
        current_lines = len(lines)
        func_num = 0
        
        while current_lines < line_count:
            func_code = func_template.format(i=func_num)
            func_lines = func_code.split('\n')
            lines.extend(func_lines)
            current_lines += len(func_lines)
            func_num += 1
        
        return '\n'.join(lines[:line_count])
    
    def _create_realistic_project(self, base_path: Path) -> None:
        """Create a realistic project structure for testing."""
        
        # Create directories
        (base_path / "src").mkdir()
        (base_path / "tests").mkdir()
        (base_path / "config").mkdir()
        (base_path / "migrations").mkdir()
        
        # Main application files
        (base_path / "src" / "main.py").write_text('''
from fastapi import FastAPI
from .models import User
from .routes import users

app = FastAPI()
app.include_router(users.router)
''')
        
        (base_path / "src" / "models.py").write_text('''
from sqlalchemy import Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    name = Column(String(50))
    email = Column(String(100))
''')
        
        # Test files
        (base_path / "tests" / "test_main.py").write_text('''
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
''')
        
        (base_path / "tests" / "conftest.py").write_text('''
import pytest

@pytest.fixture
def test_client():
    from src.main import app
    from fastapi.testclient import TestClient
    return TestClient(app)
''')
        
        # Configuration file
        (base_path / "config" / "settings.py").write_text('''
from pydantic import BaseSettings

class Settings(BaseSettings):
    database_url: str = "sqlite:///./test.db"
    secret_key: str = "dev-secret"
''')
        
        # Migration file
        (base_path / "migrations" / "001_initial.py").write_text('''
"""Initial migration"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table('users',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(50)),
        sa.Column('email', sa.String(100))
    )
''')
        
        # Some potentially suspicious files
        (base_path / "src" / "admin.py").write_text('''
import os

def cleanup_logs(days=7):
    """Clean up old log files."""
    os.system(f"find /var/log -name '*.log' -mtime +{days} -delete")
    
def backup_database():
    """Backup database."""
    os.system("pg_dump mydb > backup.sql")
''')
    
    def print_summary(self) -> None:
        """Print a summary of all benchmark results."""
        print("\n" + "=" * 80)
        print("📊 PERFORMANCE BENCHMARK SUMMARY")
        print("=" * 80)
        
        if 'pattern_compilation' in self.results:
            print("\n🔧 Pattern Compilation Performance:")
            for count, stats in self.results['pattern_compilation'].items():
                print(f"  {count:4d} patterns: {stats['mean']:.4f}s ± {stats['stdev']:.4f}s")
        
        if 'pattern_matching' in self.results:
            print("\n🎯 Pattern Matching Performance:")
            for count, stats in self.results['pattern_matching'].items():
                print(f"  {count:5d} lookups: {stats['mean_lookups_per_second']:.0f} lookups/sec")
        
        if 'caching' in self.results:
            caching = self.results['caching']
            print(f"\n💾 Caching Effectiveness:")
            print(f"  Speedup: {caching['speedup']:.2f}x")
            print(f"  Cache hit rate: {caching['cache_hit_rate']:.1%}")
        
        if 'file_validation' in self.results:
            print(f"\n📄 File Validation Performance:")
            for size, stats in self.results['file_validation'].items():
                print(f"  {size:4d} lines: {stats['mean_lines_per_second']:.0f} lines/sec")
        
        if 'memory_usage' in self.results:
            memory = self.results['memory_usage']
            print(f"\n🧠 Memory Usage:")
            print(f"  Total overhead: {memory['total_overhead_mb']:.2f} MB")
            print(f"  Cache overhead: {memory['cache_overhead_mb']:.2f} MB")
        
        if 'real_world' in self.results:
            real_world = self.results['real_world']
            print(f"\n🌍 Real-World Scenario:")
            print(f"  Files per second: {real_world['files_per_second']:.1f}")
            print(f"  Total issues: {real_world['total_issues']}")


def run_comprehensive_benchmark():
    """Run the complete performance benchmark suite."""
    print("🚀 Starting Comprehensive Validation System Performance Benchmark")
    print("This may take several minutes to complete...")
    
    benchmark = PerformanceBenchmark()
    
    # Pattern compilation benchmark
    benchmark.benchmark_pattern_compilation([10, 50, 100, 200, 500])
    
    # Pattern matching benchmark  
    benchmark.benchmark_pattern_matching(100, [100, 500, 1000, 5000])
    
    # Caching effectiveness
    benchmark.benchmark_caching_effectiveness(100, 1000)
    
    # File validation performance
    benchmark.benchmark_file_validation([100, 500, 1000, 2000])
    
    # Memory usage
    benchmark.benchmark_memory_usage(200)
    
    # Real-world scenario
    benchmark.benchmark_real_world_scenario()
    
    # Print summary
    benchmark.print_summary()
    
    return benchmark.results


if __name__ == "__main__":
    results = run_comprehensive_benchmark()
    
    # Save results to file
    import json
    with open("validation_benchmark_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\n💾 Detailed results saved to: validation_benchmark_results.json")