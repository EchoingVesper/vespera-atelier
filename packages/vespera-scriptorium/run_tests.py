#!/usr/bin/env python3
"""
Enhanced Vespera V2 Test Runner

Runs comprehensive tests for the Vespera Scriptorium V2 system with:
- Performance benchmarking
- Coverage reporting  
- Parallel test execution
- Detailed reporting and metrics
"""

import sys
import subprocess
import time
import json
import statistics
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import argparse
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Try to import coverage and pytest for enhanced features
try:
    import coverage
    COVERAGE_AVAILABLE = True
except ImportError:
    COVERAGE_AVAILABLE = False

try:
    import pytest
    PYTEST_AVAILABLE = True
except ImportError:
    PYTEST_AVAILABLE = False


class TestResult:
    """Container for test execution results."""
    
    def __init__(self, test_file: Path):
        self.test_file = test_file
        self.success = False
        self.execution_time = 0.0
        self.output = ""
        self.error_output = ""
        self.exit_code = 0
        self.memory_usage = 0.0
        
    def to_dict(self):
        """Convert to dictionary for reporting."""
        return {
            "test_file": str(self.test_file),
            "success": self.success,
            "execution_time": self.execution_time,
            "exit_code": self.exit_code,
            "memory_usage": self.memory_usage
        }


class PerformanceTracker:
    """Track performance metrics during test execution."""
    
    def __init__(self):
        self.start_time = None
        self.end_time = None
        self.test_results = []
        self.system_metrics = {}
        
    def start(self):
        """Start performance tracking."""
        self.start_time = time.time()
        
    def stop(self):
        """Stop performance tracking."""
        self.end_time = time.time()
        
    def add_result(self, result: TestResult):
        """Add test result for tracking."""
        self.test_results.append(result)
        
    def get_summary(self):
        """Get performance summary."""
        if not self.test_results:
            return {}
        
        execution_times = [r.execution_time for r in self.test_results]
        
        return {
            "total_execution_time": self.end_time - self.start_time if self.start_time and self.end_time else 0,
            "test_count": len(self.test_results),
            "passed_count": sum(1 for r in self.test_results if r.success),
            "failed_count": sum(1 for r in self.test_results if not r.success),
            "average_test_time": statistics.mean(execution_times),
            "fastest_test": min(execution_times),
            "slowest_test": max(execution_times),
            "total_test_time": sum(execution_times)
        }


def run_test_file(test_file: Path, use_mcp_venv: bool = True, capture_output: bool = True) -> TestResult:
    """Run a single test file and return detailed results."""
    
    result = TestResult(test_file)
    python_cmd = "./mcp_venv/bin/python" if use_mcp_venv else "python3"
    
    try:
        if not capture_output:
            print(f"\n🧪 Running {test_file.name}")
            print("=" * 50)
        
        start_time = time.time()
        
        process_result = subprocess.run(
            [python_cmd, str(test_file)],
            cwd=Path(__file__).parent,
            capture_output=capture_output,
            text=True
        )
        
        result.execution_time = time.time() - start_time
        result.exit_code = process_result.returncode
        result.success = process_result.returncode == 0
        
        if capture_output:
            result.output = process_result.stdout
            result.error_output = process_result.stderr
        
        if not capture_output:
            if result.success:
                print(f"✅ {test_file.name} PASSED ({result.execution_time:.2f}s)")
            else:
                print(f"❌ {test_file.name} FAILED (exit code: {result.exit_code}, {result.execution_time:.2f}s)")
        
        return result
            
    except Exception as e:
        result.error_output = str(e)
        if not capture_output:
            print(f"💥 {test_file.name} ERROR: {e}")
        return result


def run_pytest_with_coverage(test_paths: list, output_dir: Path, use_mcp_venv: bool = True) -> dict:
    """Run pytest with coverage reporting."""
    
    if not PYTEST_AVAILABLE:
        logger.warning("pytest not available, falling back to basic test runner")
        return None
        
    python_cmd = "./mcp_venv/bin/python" if use_mcp_venv else "python3"
    
    # Prepare pytest command
    pytest_args = [
        python_cmd, "-m", "pytest",
        "--tb=short",
        "--verbose",
        f"--junitxml={output_dir}/test_results.xml"
    ]
    
    # Add coverage if available
    if COVERAGE_AVAILABLE:
        pytest_args.extend([
            "--cov=.",
            "--cov-report=html:" + str(output_dir / "coverage_html"),
            "--cov-report=xml:" + str(output_dir / "coverage.xml"),
            "--cov-report=term-missing"
        ])
    
    # Add test paths
    pytest_args.extend([str(p) for p in test_paths])
    
    try:
        print("🔬 Running pytest with coverage...")
        start_time = time.time()
        
        result = subprocess.run(
            pytest_args,
            cwd=Path(__file__).parent,
            capture_output=True,
            text=True
        )
        
        execution_time = time.time() - start_time
        
        return {
            "success": result.returncode == 0,
            "execution_time": execution_time,
            "output": result.stdout,
            "error": result.stderr,
            "exit_code": result.returncode
        }
        
    except Exception as e:
        logger.error(f"Failed to run pytest: {e}")
        return None


def run_parallel_tests(test_files: list, max_workers: int = 4, use_mcp_venv: bool = True) -> list:
    """Run tests in parallel using ThreadPoolExecutor."""
    
    results = []
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all test files
        future_to_test = {
            executor.submit(run_test_file, test_file, use_mcp_venv, True): test_file
            for test_file in test_files
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_test):
            test_file = future_to_test[future]
            try:
                result = future.result()
                results.append(result)
                
                # Print progress
                status = "✅ PASSED" if result.success else "❌ FAILED"
                print(f"{status} {test_file.name} ({result.execution_time:.2f}s)")
                
            except Exception as e:
                logger.error(f"Test {test_file} generated an exception: {e}")
                # Create failed result
                failed_result = TestResult(test_file)
                failed_result.error_output = str(e)
                results.append(failed_result)
    
    return results


def generate_test_report(results: list, performance_tracker: PerformanceTracker, output_dir: Path):
    """Generate comprehensive test report."""
    
    output_dir.mkdir(exist_ok=True)
    
    # Performance summary
    perf_summary = performance_tracker.get_summary()
    
    # Test results summary
    passed = sum(1 for r in results if r.success)
    failed = len(results) - passed
    
    report = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total_tests": len(results),
            "passed": passed,
            "failed": failed,
            "success_rate": (passed / len(results) * 100) if results else 0
        },
        "performance": perf_summary,
        "test_results": [r.to_dict() for r in results],
        "failed_tests": [
            {
                "test_file": str(r.test_file),
                "exit_code": r.exit_code,
                "error_output": r.error_output
            }
            for r in results if not r.success
        ]
    }
    
    # Save JSON report
    report_file = output_dir / "test_report.json"
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    # Generate HTML report
    generate_html_report(report, output_dir / "test_report.html")
    
    return report


def generate_html_report(report: dict, output_file: Path):
    """Generate HTML test report."""
    
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Vespera V2 Test Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background: #f0f0f0; padding: 20px; border-radius: 5px; }}
        .summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 20px 0; }}
        .metric {{ background: #e9f4ff; padding: 15px; border-radius: 5px; text-align: center; }}
        .passed {{ background: #d4edda; }}
        .failed {{ background: #f8d7da; }}
        .test-results {{ margin: 20px 0; }}
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
        .pass {{ color: green; }}
        .fail {{ color: red; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Vespera V2 Test Report</h1>
        <p>Generated: {report['timestamp']}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <p>{report['summary']['total_tests']}</p>
        </div>
        <div class="metric passed">
            <h3>Passed</h3>
            <p>{report['summary']['passed']}</p>
        </div>
        <div class="metric failed">
            <h3>Failed</h3>
            <p>{report['summary']['failed']}</p>
        </div>
        <div class="metric">
            <h3>Success Rate</h3>
            <p>{report['summary']['success_rate']:.1f}%</p>
        </div>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Time</h3>
            <p>{report['performance'].get('total_execution_time', 0):.2f}s</p>
        </div>
        <div class="metric">
            <h3>Average Test Time</h3>
            <p>{report['performance'].get('average_test_time', 0):.2f}s</p>
        </div>
        <div class="metric">
            <h3>Fastest Test</h3>
            <p>{report['performance'].get('fastest_test', 0):.2f}s</p>
        </div>
        <div class="metric">
            <h3>Slowest Test</h3>
            <p>{report['performance'].get('slowest_test', 0):.2f}s</p>
        </div>
    </div>
    
    <div class="test-results">
        <h2>Test Results</h2>
        <table>
            <tr>
                <th>Test File</th>
                <th>Status</th>
                <th>Execution Time</th>
                <th>Exit Code</th>
            </tr>
    """
    
    for test_result in report['test_results']:
        status_class = "pass" if test_result['success'] else "fail"
        status_text = "PASS" if test_result['success'] else "FAIL"
        
        html_content += f"""
            <tr>
                <td>{Path(test_result['test_file']).name}</td>
                <td class="{status_class}">{status_text}</td>
                <td>{test_result['execution_time']:.2f}s</td>
                <td>{test_result['exit_code']}</td>
            </tr>
        """
    
    html_content += """
        </table>
    </div>
</body>
</html>
    """
    
    with open(output_file, 'w') as f:
        f.write(html_content)


def benchmark_system_performance():
    """Benchmark basic system performance."""
    
    print("🔍 Running system performance benchmark...")
    
    # Test file I/O performance
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w+', delete=False) as f:
        test_data = "x" * 1024 * 1024  # 1MB
        
        start_time = time.time()
        f.write(test_data)
        f.flush()
        write_time = time.time() - start_time
        
        f.seek(0)
        start_time = time.time()
        read_data = f.read()
        read_time = time.time() - start_time
    
    # Test CPU performance (simple calculation)
    start_time = time.time()
    result = sum(i * i for i in range(100000))
    cpu_time = time.time() - start_time
    
    return {
        "file_write_time": write_time,
        "file_read_time": read_time,
        "cpu_calculation_time": cpu_time
    }


def main():
    parser = argparse.ArgumentParser(description="Enhanced Vespera V2 Test Runner")
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
    parser.add_argument(
        "--parallel",
        action="store_true",
        help="Run tests in parallel"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Number of parallel workers (default: 4)"
    )
    parser.add_argument(
        "--coverage",
        action="store_true",
        help="Generate coverage report (requires pytest and coverage)"
    )
    parser.add_argument(
        "--benchmark",
        action="store_true",
        help="Run system performance benchmark"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("test_results"),
        help="Output directory for reports (default: test_results)"
    )
    parser.add_argument(
        "--performance",
        action="store_true",
        help="Enable detailed performance tracking"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create output directory
    args.output_dir.mkdir(exist_ok=True)
    
    # Run system benchmark if requested
    if args.benchmark:
        system_perf = benchmark_system_performance()
        print(f"💻 System Performance Baseline:")
        print(f"   File I/O: {system_perf['file_write_time']:.3f}s write, {system_perf['file_read_time']:.3f}s read")
        print(f"   CPU: {system_perf['cpu_calculation_time']:.3f}s")
    
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
    
    print(f"\n🚀 Enhanced Vespera V2 Test Runner")
    print(f"=" * 60)
    print(f"📋 Test Suite: {args.suite}")
    print(f"📁 Test Files: {len(test_files)}")
    print(f"🐍 Python Environment: {'mcp_venv' if not args.no_mcp_venv else 'system'}")
    print(f"⚡ Parallel Execution: {'Yes' if args.parallel else 'No'}")
    if args.parallel:
        print(f"👥 Workers: {args.workers}")
    print(f"📊 Coverage Report: {'Yes' if args.coverage else 'No'}")
    print(f"📈 Performance Tracking: {'Yes' if args.performance else 'No'}")
    print(f"📂 Output Directory: {args.output_dir}")
    
    # Initialize performance tracking
    performance_tracker = PerformanceTracker()
    performance_tracker.start()
    
    # Run tests with pytest + coverage if requested
    if args.coverage and PYTEST_AVAILABLE:
        print(f"\n🔬 Running with pytest + coverage...")
        
        test_paths = [test_root / "unit", test_root / "integration", test_root / "system"]
        if args.suite != "all":
            test_paths = [test_root / args.suite]
        
        pytest_result = run_pytest_with_coverage(test_paths, args.output_dir, not args.no_mcp_venv)
        
        if pytest_result:
            print(f"✅ Pytest completed in {pytest_result['execution_time']:.2f}s")
            if pytest_result['success']:
                print(f"🎉 All tests passed!")
            else:
                print(f"❌ Some tests failed (exit code: {pytest_result['exit_code']})")
                print(f"📋 Error output saved to reports")
            
            # Save pytest output
            with open(args.output_dir / "pytest_output.txt", 'w') as f:
                f.write("STDOUT:\n")
                f.write(pytest_result['output'])
                f.write("\n\nSTDERR:\n")
                f.write(pytest_result['error'])
            
            return 0 if pytest_result['success'] else 1
    
    # Run tests with enhanced runner
    print(f"\n🧪 Running Tests...")
    print(f"=" * 60)
    
    if args.parallel:
        results = run_parallel_tests(test_files, args.workers, not args.no_mcp_venv)
    else:
        results = []
        for test_file in test_files:
            result = run_test_file(test_file, not args.no_mcp_venv, capture_output=False)
            results.append(result)
            
            if args.performance:
                performance_tracker.add_result(result)
    
    performance_tracker.stop()
    
    # Generate comprehensive report
    if args.performance or args.parallel:
        print(f"\n📊 Generating Test Report...")
        report = generate_test_report(results, performance_tracker, args.output_dir)
        
        print(f"💾 Reports saved to: {args.output_dir}")
        print(f"   📄 JSON Report: {args.output_dir}/test_report.json")
        print(f"   🌐 HTML Report: {args.output_dir}/test_report.html")
    
    # Calculate summary
    passed = sum(1 for r in results if r.success)
    failed = len(results) - passed
    total = len(results)
    
    print(f"\n📊 Test Results Summary")
    print(f"=" * 60)
    print(f"Total Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Success Rate: {(passed/total*100):.1f}%" if total > 0 else "N/A")
    
    if args.performance:
        perf_summary = performance_tracker.get_summary()
        print(f"\n📈 Performance Summary")
        print(f"=" * 60)
        print(f"Total Execution Time: {perf_summary.get('total_execution_time', 0):.2f}s")
        print(f"Average Test Time: {perf_summary.get('average_test_time', 0):.2f}s")
        print(f"Fastest Test: {perf_summary.get('fastest_test', 0):.2f}s")
        print(f"Slowest Test: {perf_summary.get('slowest_test', 0):.2f}s")
    
    # Show failed tests
    if failed > 0:
        print(f"\n💥 Failed Tests:")
        print(f"=" * 60)
        for result in results:
            if not result.success:
                print(f"❌ {result.test_file.name} (exit code: {result.exit_code})")
                if result.error_output and args.verbose:
                    print(f"   Error: {result.error_output[:200]}...")
    
    if failed == 0:
        print(f"\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n💥 {failed} tests failed!")
        return 1


if __name__ == "__main__":
    sys.exit(main())