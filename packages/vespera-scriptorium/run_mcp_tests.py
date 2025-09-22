#!/usr/bin/env python3
"""
Test runner for Vespera Scriptorium MCP server testing

This script provides a comprehensive test runner with various options
for running the MCP server test suite with different configurations.
"""

import sys
import os
import subprocess
import argparse
from pathlib import Path
from typing import List, Optional


def run_command(cmd: List[str], capture_output: bool = False) -> subprocess.CompletedProcess:
    """Run a command with optional output capture"""
    print(f"Running: {' '.join(cmd)}")

    if capture_output:
        return subprocess.run(cmd, capture_output=True, text=True)
    else:
        return subprocess.run(cmd)


def install_dependencies() -> bool:
    """Install test dependencies if needed"""
    print("Installing test dependencies...")

    result = run_command([
        sys.executable, "-m", "pip", "install", "-r", "requirements.txt"
    ])

    return result.returncode == 0


def run_tests(
    test_path: Optional[str] = None,
    markers: Optional[str] = None,
    coverage: bool = True,
    verbose: bool = True,
    parallel: bool = False,
    html_report: bool = True,
    fail_fast: bool = False,
    capture_output: bool = True
) -> int:
    """Run pytest with specified options"""

    cmd = [sys.executable, "-m", "pytest"]

    if test_path:
        cmd.append(test_path)

    if markers:
        cmd.extend(["-m", markers])

    if verbose:
        cmd.append("-v")

    if fail_fast:
        cmd.append("-x")

    if not capture_output:
        cmd.append("-s")

    if coverage:
        cmd.extend([
            "--cov=mcp_server",
            "--cov=bindery_client",
            "--cov=models",
            "--cov-branch",
            "--cov-report=term-missing"
        ])

        if html_report:
            cmd.extend(["--cov-report=html:coverage_html"])

        cmd.extend([
            "--cov-report=xml:coverage.xml",
            "--cov-fail-under=80"
        ])

    if parallel:
        try:
            import pytest_xdist
            cmd.extend(["-n", "auto"])
        except ImportError:
            print("Warning: pytest-xdist not installed, running tests sequentially")

    result = run_command(cmd)
    return result.returncode


def run_linting() -> int:
    """Run code linting with black and isort"""
    print("Running code formatting checks...")

    # Check with black
    black_result = run_command([
        sys.executable, "-m", "black", "--check", "--diff", "."
    ])

    # Check with isort
    isort_result = run_command([
        sys.executable, "-m", "isort", "--check-only", "--diff", "."
    ])

    return max(black_result.returncode, isort_result.returncode)


def format_code() -> int:
    """Format code with black and isort"""
    print("Formatting code...")

    # Format with black
    black_result = run_command([
        sys.executable, "-m", "black", "."
    ])

    # Format with isort
    isort_result = run_command([
        sys.executable, "-m", "isort", "."
    ])

    return max(black_result.returncode, isort_result.returncode)


def check_coverage_report():
    """Check and display coverage report location"""
    coverage_html = Path("coverage_html")
    coverage_xml = Path("coverage.xml")

    if coverage_html.exists():
        print(f"\nHTML Coverage report available at: {coverage_html.absolute()}/index.html")

    if coverage_xml.exists():
        print(f"XML Coverage report available at: {coverage_xml.absolute()}")


def main():
    """Main test runner entry point"""
    parser = argparse.ArgumentParser(
        description="Test runner for Vespera Scriptorium MCP server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_mcp_tests.py                          # Run all tests with coverage
  python run_mcp_tests.py --unit                  # Run only unit tests
  python run_mcp_tests.py --integration           # Run only integration tests
  python run_mcp_tests.py --mcp                   # Run only MCP protocol tests
  python run_mcp_tests.py --interruption          # Run only interruption tests
  python run_mcp_tests.py --fast                  # Run tests without coverage
  python run_mcp_tests.py --lint                  # Run linting only
  python run_mcp_tests.py --format                # Format code
  python run_mcp_tests.py --install-deps          # Install dependencies only
        """
    )

    # Test selection options
    parser.add_argument(
        "--unit", action="store_true",
        help="Run only unit tests"
    )
    parser.add_argument(
        "--integration", action="store_true",
        help="Run only integration tests"
    )
    parser.add_argument(
        "--mcp", action="store_true",
        help="Run only MCP protocol compliance tests"
    )
    parser.add_argument(
        "--interruption", action="store_true",
        help="Run only interruption handling tests"
    )
    parser.add_argument(
        "--error-handling", action="store_true",
        help="Run only error handling tests"
    )
    parser.add_argument(
        "--slow", action="store_true",
        help="Include slow tests (normally excluded)"
    )
    parser.add_argument(
        "--path", type=str,
        help="Run tests from specific path"
    )

    # Test execution options
    parser.add_argument(
        "--fast", action="store_true",
        help="Run tests without coverage (faster)"
    )
    parser.add_argument(
        "--no-html", action="store_true",
        help="Skip HTML coverage report generation"
    )
    parser.add_argument(
        "--parallel", action="store_true",
        help="Run tests in parallel (requires pytest-xdist)"
    )
    parser.add_argument(
        "--fail-fast", action="store_true",
        help="Stop on first failure"
    )
    parser.add_argument(
        "--no-capture", action="store_true",
        help="Don't capture stdout/stderr (for debugging)"
    )
    parser.add_argument(
        "--quiet", action="store_true",
        help="Run with minimal output"
    )

    # Utility options
    parser.add_argument(
        "--lint", action="store_true",
        help="Run linting checks only"
    )
    parser.add_argument(
        "--format", action="store_true",
        help="Format code with black and isort"
    )
    parser.add_argument(
        "--install-deps", action="store_true",
        help="Install test dependencies"
    )

    args = parser.parse_args()

    # Change to the script directory
    os.chdir(Path(__file__).parent)

    # Handle utility commands
    if args.install_deps:
        success = install_dependencies()
        return 0 if success else 1

    if args.format:
        return format_code()

    if args.lint:
        return run_linting()

    # Install dependencies if needed
    if not install_dependencies():
        print("Failed to install dependencies")
        return 1

    # Build test markers based on arguments
    markers = []
    if args.unit:
        markers.append("unit")
    if args.integration:
        markers.append("integration")
    if args.mcp:
        markers.append("mcp")
    if args.interruption:
        markers.append("interruption")
    if args.error_handling:
        markers.append("error_handling")

    # Handle slow tests
    if not args.slow:
        markers.append("not slow")

    marker_expression = " and ".join(markers) if markers else None

    # Run tests
    exit_code = run_tests(
        test_path=args.path,
        markers=marker_expression,
        coverage=not args.fast,
        verbose=not args.quiet,
        parallel=args.parallel,
        html_report=not args.no_html,
        fail_fast=args.fail_fast,
        capture_output=not args.no_capture
    )

    # Show coverage report location if tests ran successfully
    if exit_code == 0 and not args.fast:
        check_coverage_report()

    return exit_code


if __name__ == "__main__":
    sys.exit(main())