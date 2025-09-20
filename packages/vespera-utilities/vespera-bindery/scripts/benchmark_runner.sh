#!/bin/bash

# Vespera Bindery Benchmark Runner
# Provides convenient commands for running benchmarks locally and in CI

set -euo pipefail

# Configuration
PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BENCHMARK_FEATURES="benchmarks,embeddings-all,task-management,role-management"
CRITERION_OUTPUT_DIR="${PACKAGE_DIR}/target/criterion"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help text
show_help() {
    cat << EOF
Vespera Bindery Benchmark Runner

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    all                     Run all benchmark suites
    quick                   Run quick benchmarks (for development)
    crdt                    Run CRDT operations benchmarks
    database                Run database operations benchmarks
    rag                     Run RAG operations benchmarks
    task                    Run task management benchmarks
    e2e                     Run end-to-end workflow benchmarks
    compare                 Compare with baseline
    baseline                Save current results as baseline
    clean                   Clean benchmark artifacts
    setup                   Setup benchmark environment
    help                    Show this help message

Options:
    --measurement-time N    Set measurement time in seconds (default: 30)
    --sample-size N         Set sample size (default: 100)
    --output-format FORMAT  Set output format (json, html, default)
    --save-baseline NAME    Save results as baseline with given name
    --baseline NAME         Compare against baseline with given name
    --verbose               Enable verbose output
    --features FEATURES     Override feature flags

Examples:
    $0 quick                          # Quick benchmarks for development
    $0 all --output-format html       # Full benchmarks with HTML report
    $0 crdt --save-baseline main      # Run CRDT benchmarks and save as 'main' baseline
    $0 compare --baseline main        # Compare current performance with 'main' baseline
    $0 database --measurement-time 60 # Run database benchmarks for 60 seconds

Environment Variables:
    RUST_LOG                Set log level (debug, info, warn, error)
    BENCHMARK_THREADS       Number of benchmark threads
    BENCHMARK_MEMORY_LIMIT  Memory limit for benchmarks
EOF
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Rust toolchain
    if ! command -v cargo &> /dev/null; then
        log_error "Cargo not found. Please install Rust toolchain."
        exit 1
    fi

    # Check for nightly Rust (required for benchmarks)
    if ! rustup toolchain list | grep -q nightly; then
        log_warning "Nightly Rust not found. Installing..."
        rustup install nightly
    fi

    # Check system dependencies
    if ! command -v sqlite3 &> /dev/null; then
        log_warning "SQLite not found. Some benchmarks may fail."
    fi

    log_success "Prerequisites check completed"
}

# Setup benchmark environment
setup_environment() {
    log_info "Setting up benchmark environment..."

    cd "$PACKAGE_DIR"

    # Install nightly toolchain
    rustup install nightly

    # Install criterion binary for advanced features
    if ! command -v cargo-criterion &> /dev/null; then
        log_info "Installing cargo-criterion..."
        cargo install cargo-criterion
    fi

    # Create benchmark output directories
    mkdir -p target/criterion
    mkdir -p benchmark_results

    # Verify benchmark compilation
    log_info "Verifying benchmark compilation..."
    cargo check --features "$BENCHMARK_FEATURES"

    log_success "Benchmark environment setup completed"
}

# Parse command line arguments
parse_args() {
    COMMAND=""
    MEASUREMENT_TIME="30"
    SAMPLE_SIZE="100"
    OUTPUT_FORMAT="default"
    SAVE_BASELINE=""
    BASELINE=""
    VERBOSE=false
    FEATURES="$BENCHMARK_FEATURES"

    while [[ $# -gt 0 ]]; do
        case $1 in
            all|quick|crdt|database|rag|task|e2e|compare|baseline|clean|setup|help)
                COMMAND="$1"
                shift
                ;;
            --measurement-time)
                MEASUREMENT_TIME="$2"
                shift 2
                ;;
            --sample-size)
                SAMPLE_SIZE="$2"
                shift 2
                ;;
            --output-format)
                OUTPUT_FORMAT="$2"
                shift 2
                ;;
            --save-baseline)
                SAVE_BASELINE="$2"
                shift 2
                ;;
            --baseline)
                BASELINE="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --features)
                FEATURES="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    if [[ -z "$COMMAND" ]]; then
        log_error "No command specified"
        show_help
        exit 1
    fi
}

# Build criterion arguments
build_criterion_args() {
    local args=""

    if [[ "$MEASUREMENT_TIME" != "30" ]]; then
        args="$args --measurement-time $MEASUREMENT_TIME"
    fi

    if [[ "$SAMPLE_SIZE" != "100" ]]; then
        args="$args --sample-size $SAMPLE_SIZE"
    fi

    if [[ "$OUTPUT_FORMAT" != "default" ]]; then
        args="$args --output-format $OUTPUT_FORMAT"
    fi

    if [[ -n "$SAVE_BASELINE" ]]; then
        args="$args --save-baseline $SAVE_BASELINE"
    fi

    if [[ -n "$BASELINE" ]]; then
        args="$args --baseline $BASELINE"
    fi

    echo "$args"
}

# Run specific benchmark suite
run_benchmark() {
    local bench_name="$1"
    local description="$2"

    log_info "Running $description..."

    cd "$PACKAGE_DIR"

    local criterion_args
    criterion_args=$(build_criterion_args)

    local cmd="cargo bench --features \"$FEATURES\" --bench $bench_name"
    if [[ -n "$criterion_args" ]]; then
        cmd="$cmd -- $criterion_args"
    fi

    if [[ "$VERBOSE" == true ]]; then
        log_info "Executing: $cmd"
    fi

    if eval "$cmd"; then
        log_success "$description completed"
    else
        log_error "$description failed"
        return 1
    fi
}

# Run all benchmarks
run_all_benchmarks() {
    log_info "Running all benchmark suites..."

    cd "$PACKAGE_DIR"

    local criterion_args
    criterion_args=$(build_criterion_args)

    local cmd="cargo bench --features \"$FEATURES\""
    if [[ -n "$criterion_args" ]]; then
        cmd="$cmd -- $criterion_args"
    fi

    if [[ "$VERBOSE" == true ]]; then
        log_info "Executing: $cmd"
    fi

    if eval "$cmd"; then
        log_success "All benchmarks completed"
        show_results_summary
    else
        log_error "Benchmarks failed"
        return 1
    fi
}

# Run quick benchmarks for development
run_quick_benchmarks() {
    log_info "Running quick benchmarks for development..."

    # Override settings for quick execution
    MEASUREMENT_TIME="5"
    SAMPLE_SIZE="20"

    # Run subset of benchmarks
    run_benchmark "crdt_operations" "Quick CRDT benchmarks"
    run_benchmark "database_operations" "Quick database benchmarks"

    log_success "Quick benchmarks completed"
}

# Compare with baseline
compare_with_baseline() {
    if [[ -z "$BASELINE" ]]; then
        log_error "Baseline name required for comparison. Use --baseline NAME"
        exit 1
    fi

    log_info "Comparing current performance with baseline: $BASELINE"

    cd "$PACKAGE_DIR"

    # Check if baseline exists
    if [[ ! -d "$CRITERION_OUTPUT_DIR" ]] || [[ ! -d "$CRITERION_OUTPUT_DIR/base" ]]; then
        log_error "No baseline found. Run benchmarks with --save-baseline first."
        exit 1
    fi

    run_all_benchmarks
    log_success "Comparison completed. Check criterion output for details."
}

# Save baseline
save_baseline() {
    if [[ -z "$SAVE_BASELINE" ]]; then
        log_error "Baseline name required. Use --save-baseline NAME"
        exit 1
    fi

    log_info "Saving benchmark results as baseline: $SAVE_BASELINE"
    run_all_benchmarks
    log_success "Baseline saved: $SAVE_BASELINE"
}

# Clean benchmark artifacts
clean_artifacts() {
    log_info "Cleaning benchmark artifacts..."

    cd "$PACKAGE_DIR"

    rm -rf target/criterion
    rm -rf benchmark_results
    rm -f *.json

    log_success "Benchmark artifacts cleaned"
}

# Show results summary
show_results_summary() {
    log_info "Benchmark Results Summary"

    cd "$PACKAGE_DIR"

    if [[ -d "$CRITERION_OUTPUT_DIR" ]]; then
        echo "Detailed results available in: $CRITERION_OUTPUT_DIR"

        # Count benchmark results
        local result_count
        result_count=$(find "$CRITERION_OUTPUT_DIR" -name "*.json" | wc -l)
        echo "Total benchmark measurements: $result_count"

        # Show HTML report location if available
        if [[ -f "$CRITERION_OUTPUT_DIR/report/index.html" ]]; then
            echo "HTML report: $CRITERION_OUTPUT_DIR/report/index.html"
        fi
    fi

    # Show any JSON output files
    local json_files
    json_files=$(find . -maxdepth 1 -name "*benchmark*.json" -type f)
    if [[ -n "$json_files" ]]; then
        echo "JSON output files:"
        echo "$json_files"
    fi
}

# Performance analysis
analyze_performance() {
    log_info "Analyzing performance results..."

    cd "$PACKAGE_DIR"

    # Simple performance analysis using Python if available
    if command -v python3 &> /dev/null; then
        python3 << 'EOF'
import json
import glob
import os

json_files = glob.glob("*benchmark*.json")
if not json_files:
    print("No JSON benchmark results found")
    exit()

print("Performance Analysis:")
print("=" * 50)

for json_file in json_files:
    try:
        with open(json_file, 'r') as f:
            results = json.load(f)

        print(f"\nFile: {json_file}")
        print("-" * 30)

        for result in results:
            name = result.get('id', 'Unknown')
            if 'mean' in result and 'estimate' in result['mean']:
                duration_ns = result['mean']['estimate']
                duration_ms = duration_ns / 1_000_000

                status = "✅ Good"
                if duration_ms > 50:
                    status = "⚠️  Slow"
                if duration_ms > 200:
                    status = "❌ Very Slow"

                print(f"  {name:<40} {duration_ms:>8.2f}ms  {status}")

    except Exception as e:
        print(f"Error analyzing {json_file}: {e}")
EOF
    else
        log_warning "Python3 not available for performance analysis"
    fi
}

# Main execution
main() {
    parse_args "$@"

    case "$COMMAND" in
        help)
            show_help
            ;;
        setup)
            setup_environment
            ;;
        quick)
            check_prerequisites
            run_quick_benchmarks
            ;;
        all)
            check_prerequisites
            run_all_benchmarks
            analyze_performance
            ;;
        crdt)
            check_prerequisites
            run_benchmark "crdt_operations" "CRDT operations benchmarks"
            ;;
        database)
            check_prerequisites
            run_benchmark "database_operations" "Database operations benchmarks"
            ;;
        rag)
            check_prerequisites
            run_benchmark "rag_operations" "RAG operations benchmarks"
            ;;
        task)
            check_prerequisites
            run_benchmark "task_management" "Task management benchmarks"
            ;;
        e2e)
            check_prerequisites
            run_benchmark "end_to_end" "End-to-end workflow benchmarks"
            ;;
        compare)
            check_prerequisites
            compare_with_baseline
            ;;
        baseline)
            check_prerequisites
            save_baseline
            ;;
        clean)
            clean_artifacts
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"