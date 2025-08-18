#!/usr/bin/env python3
"""
Vespera V2 Test Runner

Runs all system and integration tests for the Vespera Scriptorium V2 system.
"""

import sys
import subprocess
from pathlib import Path
import argparse
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def run_test_file(test_file: Path, use_mcp_venv: bool = True) -> bool:
    """Run a single test file and return success status"""
    
    python_cmd = "./mcp_venv/bin/python" if use_mcp_venv else "python3"
    
    try:
        print(f"\n🧪 Running {test_file.name}")
        print("=" * 50)
        
        result = subprocess.run(
            [python_cmd, str(test_file)],
            cwd=Path(__file__).parent,
            capture_output=False,
            text=True
        )
        
        if result.returncode == 0:
            print(f"✅ {test_file.name} PASSED")
            return True
        else:
            print(f"❌ {test_file.name} FAILED (exit code: {result.returncode})")
            return False
            
    except Exception as e:
        print(f"💥 {test_file.name} ERROR: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Run Vespera V2 tests")
    parser.add_argument(
        "--suite",
        choices=["all", "unit", "integration", "system"],
        default="all",
        help="Test suite to run"
    )
    parser.add_argument(
        "--no-mcp-venv",
        action="store_true",
        help="Don't use MCP virtual environment"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Verbose output"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Find test files
    test_root = Path(__file__).parent / "tests"
    
    test_files = []
    
    if args.suite in ["all", "unit"]:
        unit_tests = list((test_root / "unit").glob("test*.py"))
        test_files.extend(unit_tests)
        
    if args.suite in ["all", "integration"]:
        integration_tests = list((test_root / "integration").glob("test*.py"))
        test_files.extend(integration_tests)
        
    if args.suite in ["all", "system"]:
        system_tests = list((test_root / "system").glob("test*.py"))
        test_files.extend(system_tests)
    
    if not test_files:
        print(f"⚠️  No test files found for suite: {args.suite}")
        return 1
    
    print(f"🚀 Running Vespera V2 Test Suite: {args.suite}")
    print(f"📁 Found {len(test_files)} test files")
    print(f"🐍 Using Python: {'mcp_venv' if not args.no_mcp_venv else 'system'}")
    
    # Run tests
    passed = 0
    failed = 0
    
    for test_file in test_files:
        success = run_test_file(test_file, use_mcp_venv=not args.no_mcp_venv)
        if success:
            passed += 1
        else:
            failed += 1
    
    # Summary
    total = passed + failed
    print(f"\n📊 Test Results Summary")
    print(f"=" * 50)
    print(f"Total Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Success Rate: {(passed/total*100):.1f}%" if total > 0 else "N/A")
    
    if failed == 0:
        print(f"\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n💥 {failed} tests failed!")
        return 1


if __name__ == "__main__":
    sys.exit(main())