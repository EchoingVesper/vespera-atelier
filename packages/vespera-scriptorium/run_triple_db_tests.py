#!/usr/bin/env python3
"""
Test runner for Triple Database Integration tests.
"""

import sys
import pytest
from pathlib import Path

# Add the current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

def run_triple_db_tests():
    """Run all triple database integration tests."""
    
    test_files = [
        "tests/unit/test_triple_db_service.py",
        "tests/unit/test_error_handling.py", 
        "tests/unit/test_sync_coordinator.py"
    ]
    
    # Run pytest with the specific test files
    args = [
        "-v",  # Verbose output
        "-s",  # Don't capture output
        "--tb=short",  # Short traceback format
        "--color=yes",  # Colored output
    ] + test_files
    
    print("Running Triple Database Integration Tests...")
    print("=" * 60)
    
    exit_code = pytest.main(args)
    
    print("\n" + "=" * 60)
    if exit_code == 0:
        print("All tests passed! ✅")
    else:
        print("Some tests failed! ❌")
    
    return exit_code


def run_specific_test(test_pattern: str):
    """Run tests matching a specific pattern."""
    args = [
        "-v",
        "-s", 
        "--tb=short",
        "--color=yes",
        "-k", test_pattern
    ]
    
    print(f"Running tests matching pattern: {test_pattern}")
    print("=" * 60)
    
    exit_code = pytest.main(args)
    return exit_code


def run_coverage_tests():
    """Run tests with coverage reporting."""
    try:
        import coverage
    except ImportError:
        print("Coverage package not installed. Install with: pip install coverage")
        return 1
    
    args = [
        "-v",
        "--cov=databases",  # Coverage for databases module
        "--cov=tasks",      # Coverage for tasks module
        "--cov-report=html",
        "--cov-report=term-missing",
        "tests/unit/"
    ]
    
    print("Running tests with coverage analysis...")
    print("=" * 60)
    
    exit_code = pytest.main(args)
    
    if exit_code == 0:
        print("\nCoverage report generated in htmlcov/")
    
    return exit_code


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Run Triple Database Integration tests")
    parser.add_argument("--pattern", "-k", help="Run tests matching pattern")
    parser.add_argument("--coverage", "-c", action="store_true", help="Run with coverage")
    
    args = parser.parse_args()
    
    if args.coverage:
        exit_code = run_coverage_tests()
    elif args.pattern:
        exit_code = run_specific_test(args.pattern)
    else:
        exit_code = run_triple_db_tests()
    
    sys.exit(exit_code)