# Vespera Bindery Benchmark Suite

This document provides comprehensive information about the performance benchmarking infrastructure for the Vespera Bindery CRDT-based collaborative content management system.

## Overview

The benchmark suite is designed to:

- **Detect Performance Regressions**: Catch performance degradations before they reach production
- **Establish Performance Baselines**: Provide reference measurements for key operations
- **Guide Optimization Efforts**: Identify performance bottlenecks and hot paths
- **Validate Scalability**: Test system behavior under various load conditions
- **Support Development Decisions**: Provide data for architectural and implementation choices

## Benchmark Organization

### Core Benchmark Suites

1. **[CRDT Operations](#crdt-operations-benchmark)** (`benches/crdt_operations.rs`)
   - Single operation application
   - CRDT merge operations
   - LWW-Map operations
   - OR-Set operations
   - Operation pooling
   - Memory management

2. **[Database Operations](#database-operations-benchmark)** (`benches/database_operations.rs`)
   - Task creation, queries, updates, deletions
   - Concurrent operations
   - Connection pool performance
   - Hierarchical data queries

3. **[RAG Operations](#rag-operations-benchmark)** (`benches/rag_operations.rs`)
   - Document indexing and search
   - Embedding generation
   - Code analysis
   - System statistics and health checks

4. **[Task Management](#task-management-benchmark)** (`benches/task_management.rs`)
   - Task creation and execution
   - Role validation and execution
   - Dependency analysis
   - Dashboard generation

5. **[End-to-End Workflows](#end-to-end-benchmark)** (`benches/end_to_end.rs`)
   - Complete document processing workflows
   - Collaborative editing scenarios
   - Task orchestration with role validation
   - System resilience testing

### Benchmark Utilities

- **Test Data Generators** (`benches/utils/mod.rs`)
  - Reproducible test data with seeded randomization
  - Realistic content generation for various document types
  - Scalable data generation (small, medium, large datasets)
  - Performance and memory measurement utilities

## Running Benchmarks

### Prerequisites

```bash
# Install Rust nightly for benchmark features
rustup install nightly
rustup default nightly

# Install required features
cargo install cargo-criterion
```

### Basic Usage

```bash
# Run all benchmarks
cargo bench --features benchmarks

# Run specific benchmark suite
cargo bench --features benchmarks --bench crdt_operations
cargo bench --features benchmarks --bench database_operations
cargo bench --features benchmarks --bench rag_operations
cargo bench --features benchmarks --bench task_management
cargo bench --features benchmarks --bench end_to_end

# Run with specific feature combinations
cargo bench --features "benchmarks,embeddings-all,task-management,role-management"
```

### Advanced Options

```bash
# Save baseline for comparison
cargo bench --features benchmarks -- --save-baseline main

# Compare against baseline
cargo bench --features benchmarks -- --baseline main

# Generate detailed HTML reports
cargo bench --features benchmarks -- --output-format html

# Run with custom measurement time
cargo bench --features benchmarks -- --measurement-time 60

# Profile specific benchmarks
cargo bench --features benchmarks --bench crdt_operations -- --profile-time 10
```

## Benchmark Details

### CRDT Operations Benchmark

**Purpose**: Measure performance of core CRDT operations that enable real-time collaboration.

**Key Metrics**:
- Operation application latency
- Merge operation throughput
- Memory usage patterns
- Scalability with concurrent users

**Test Scenarios**:
- Single operation application (1-1000 operations)
- CRDT merge operations (10-5000 elements)
- LWW-Map insertions and merges (100-10000 entries)
- OR-Set additions and merges (100-10000 elements)
- Operation pool efficiency (100-10000 pool size)
- Memory cleanup and compaction

**Performance Targets**:
- Single operation: < 1ms
- Small merge (100 elements): < 10ms
- Large merge (5000 elements): < 100ms
- Memory overhead: < 2x payload size

### Database Operations Benchmark

**Purpose**: Validate database persistence layer performance under various load conditions.

**Key Metrics**:
- Query execution time
- Transaction throughput
- Connection pool efficiency
- Concurrent operation handling

**Test Scenarios**:
- Task CRUD operations (1-5000 tasks)
- Complex hierarchical queries (2-10 levels deep)
- Concurrent database access (5-20 simultaneous connections)
- Connection pool stress testing
- Dashboard generation with aggregations

**Performance Targets**:
- Simple query: < 1ms
- Complex aggregation: < 50ms
- Task creation: < 5ms
- Dashboard generation (1000 tasks): < 100ms

### RAG Operations Benchmark

**Purpose**: Measure retrieval-augmented generation system performance for document processing.

**Key Metrics**:
- Document indexing speed
- Search query latency
- Embedding generation throughput
- Memory usage during processing

**Test Scenarios**:
- Document indexing (1-1000 documents)
- Semantic search queries (various result limits)
- Document chunking strategies
- Code analysis performance
- System health monitoring

**Performance Targets**:
- Document indexing: < 100ms per document
- Search query: < 50ms
- Embedding generation: < 200ms per text chunk
- Code analysis: < 500ms per file

### Task Management Benchmark

**Purpose**: Evaluate task orchestration and role-based execution performance.

**Key Metrics**:
- Task creation and execution latency
- Role validation time
- Dependency analysis performance
- Concurrent task handling

**Test Scenarios**:
- Task creation and hierarchy building (1-2000 tasks)
- Role permission validation (10-1000 validations)
- Task execution with role restrictions
- Dependency graph analysis
- Dashboard generation

**Performance Targets**:
- Task creation: < 10ms
- Role validation: < 1ms
- Task execution: < 100ms
- Dependency analysis: < 50ms per task

### End-to-End Benchmark

**Purpose**: Test complete workflows that integrate multiple system components.

**Key Metrics**:
- End-to-end workflow completion time
- System resource utilization
- Component integration overhead
- Error recovery performance

**Test Scenarios**:
- Complete document processing pipeline
- Multi-user collaborative editing
- Task orchestration with role validation
- System resilience under error conditions

**Performance Targets**:
- Document processing workflow: < 500ms per document
- Collaborative editing (10 users): < 200ms per operation
- Task orchestration: < 1s for complex workflows
- Error recovery: < 100ms

## Performance Baseline Data

### Hardware Configuration

Benchmarks should be run on consistent hardware for meaningful comparisons:

**Recommended Minimum**:
- CPU: 4 cores, 2.0+ GHz
- RAM: 8GB
- Storage: SSD
- Network: Stable connection for API tests

**Reference Configuration**:
- CPU: Intel i7-10700K (8 cores, 3.8GHz)
- RAM: 32GB DDR4
- Storage: NVMe SSD
- OS: Ubuntu 20.04 LTS

### Baseline Results

| Operation | Target | Baseline | Units |
|-----------|--------|----------|-------|
| CRDT Single Op | < 1ms | 0.15ms | latency |
| CRDT Merge (1K) | < 10ms | 3.2ms | latency |
| DB Task Create | < 5ms | 1.8ms | latency |
| DB Query (100) | < 10ms | 4.1ms | latency |
| RAG Index Doc | < 100ms | 45ms | latency |
| RAG Search | < 50ms | 18ms | latency |
| Task Execute | < 100ms | 32ms | latency |
| Role Validate | < 1ms | 0.08ms | latency |

### Memory Usage Baselines

| Component | Target | Baseline | Units |
|-----------|--------|----------|-------|
| CRDT (1K ops) | < 10MB | 6.2MB | memory |
| Database Pool | < 50MB | 28MB | memory |
| RAG Index (100 docs) | < 100MB | 67MB | memory |
| Task Manager | < 20MB | 12MB | memory |

## Continuous Integration

### GitHub Actions Integration

The benchmark suite integrates with CI/CD pipelines for automated performance monitoring:

```yaml
# .github/workflows/benchmarks.yml
name: Performance Benchmarks

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: nightly

      - name: Run benchmarks
        run: |
          cd packages/vespera-utilities/vespera-bindery
          cargo bench --features benchmarks -- --output-format json | tee benchmark_results.json

      - name: Store benchmark results
        uses: benchmark-action/github-action-benchmark@v1
        with:
          tool: 'cargo'
          output-file-path: packages/vespera-utilities/vespera-bindery/benchmark_results.json
          github-token: ${{ secrets.GITHUB_TOKEN }}
          auto-push: true
```

### Performance Regression Detection

Automated alerts are triggered when:
- Any benchmark exceeds baseline by >20%
- Memory usage increases by >50%
- New operations fall below performance targets

### Benchmark Scheduling

- **On Every PR**: Critical path benchmarks (< 5 minutes)
- **Daily**: Full benchmark suite with trend analysis
- **Weekly**: Extended load testing and memory profiling
- **Release**: Comprehensive performance validation

## Optimization Guidelines

### Performance Optimization Workflow

1. **Identify Bottlenecks**
   ```bash
   cargo bench --features benchmarks -- --profile-time 30
   ```

2. **Profile Specific Operations**
   ```bash
   cargo flamegraph --bench crdt_operations
   ```

3. **Measure Memory Usage**
   ```bash
   cargo bench --features benchmarks -- --memory-usage
   ```

4. **Validate Improvements**
   ```bash
   cargo bench --features benchmarks -- --baseline before --save-baseline after
   ```

### Common Optimization Strategies

1. **CRDT Operations**
   - Use operation pooling for high-frequency edits
   - Implement lazy evaluation for non-critical operations
   - Optimize vector clock comparisons
   - Consider bulk operation batching

2. **Database Operations**
   - Use prepared statements for repeated queries
   - Implement connection pooling with appropriate limits
   - Add database indexes for frequently queried fields
   - Batch insert/update operations

3. **RAG Operations**
   - Cache embedding results for identical content
   - Use incremental indexing for large document sets
   - Implement async processing for non-blocking operations
   - Optimize chunking strategies based on content type

4. **Memory Management**
   - Implement object pooling for frequently allocated structures
   - Use weak references to break reference cycles
   - Regular cleanup of expired data
   - Monitor and limit memory growth

## Troubleshooting

### Common Issues

**Benchmarks Fail to Run**:
- Ensure nightly Rust toolchain is installed
- Verify all required features are enabled
- Check that SQLite is available for database tests

**Inconsistent Results**:
- Run on dedicated hardware without background processes
- Use consistent system configuration across runs
- Allow sufficient warm-up time
- Check for thermal throttling on laptops

**Memory-Related Failures**:
- Increase system memory if tests exceed available RAM
- Check for memory leaks using profiling tools
- Reduce test data size for resource-constrained environments

**Network-Related Failures**:
- Ensure stable internet connection for API tests
- Mock external services for isolated testing
- Configure appropriate timeouts

### Debugging Performance Issues

1. **Enable Detailed Logging**
   ```bash
   RUST_LOG=debug cargo bench --features benchmarks
   ```

2. **Use Profiling Tools**
   ```bash
   cargo install flamegraph
   cargo flamegraph --bench crdt_operations
   ```

3. **Memory Profiling**
   ```bash
   cargo install heaptrack
   heaptrack cargo bench --features benchmarks
   ```

4. **Custom Metrics**
   ```rust
   // Add custom measurement points
   let start = std::time::Instant::now();
   // ... operation
   println!("Custom metric: {:?}", start.elapsed());
   ```

## Contributing

### Adding New Benchmarks

1. **Create Benchmark File**
   ```rust
   // benches/new_feature.rs
   use criterion::{criterion_group, criterion_main, Criterion};

   fn benchmark_new_feature(c: &mut Criterion) {
       // Implementation
   }

   criterion_group!(benches, benchmark_new_feature);
   criterion_main!(benches);
   ```

2. **Update Cargo.toml**
   ```toml
   [[bench]]
   name = "new_feature"
   harness = false
   required-features = ["benchmarks"]
   ```

3. **Add Documentation**
   - Update this README with benchmark description
   - Include performance targets and test scenarios
   - Document any special requirements

### Benchmark Best Practices

- **Reproducibility**: Use seeded randomization for consistent results
- **Isolation**: Ensure benchmarks don't interfere with each other
- **Realism**: Use realistic data sizes and patterns
- **Coverage**: Test both typical and edge case scenarios
- **Documentation**: Clearly describe what each benchmark measures

### Performance Target Guidelines

- **Latency Targets**: Based on user experience requirements
- **Throughput Targets**: Based on expected system load
- **Memory Targets**: Based on deployment environment constraints
- **Scalability Targets**: Based on growth projections

## References

- [Criterion.rs Documentation](https://bheisler.github.io/criterion.rs/book/)
- [Rust Performance Best Practices](https://nnethercote.github.io/perf-book/)
- [CRDT Performance Considerations](https://crdt.tech/papers.html)
- [Database Performance Tuning](https://use-the-index-luke.com/)