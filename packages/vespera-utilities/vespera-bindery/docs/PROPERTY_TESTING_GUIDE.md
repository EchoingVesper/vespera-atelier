# Property-Based Testing Guide for CRDT Operations

This document outlines the comprehensive property-based testing strategy implemented for the Vespera Bindery CRDT system using the `proptest` library.

## Overview

Property-based testing generates random test inputs and verifies that certain properties (invariants) hold for all inputs. This approach is particularly valuable for testing CRDT implementations where correctness depends on mathematical properties that must hold regardless of operation ordering, user behavior, or network conditions.

## Core CRDT Properties Tested

### 1. Commutativity
**Property**: The order of applying operations should not affect the final state.

**Test Implementation**: `test_operation_commutativity`
- Generates random sequences of CRDT operations
- Applies operations in original order to one CRDT
- Applies same operations in reverse order to another CRDT
- Verifies both CRDTs converge to identical states

```rust
proptest! {
    #[test]
    fn test_operation_commutativity(
        operations in prop::collection::vec(arb_crdt_operation(codex_id), 1..=10)
    ) {
        // Apply operations forward and backward, verify convergence
    }
}
```

### 2. Associativity of Merges
**Property**: `(A ∪ B) ∪ C = A ∪ (B ∪ C)` - merge operations are associative.

**Test Implementation**: `test_merge_associativity`
- Creates three independent CRDTs with different operations
- Tests both `(A ∪ B) ∪ C` and `A ∪ (B ∪ C)` merge orders
- Verifies final states are equivalent

### 3. Operation Idempotency
**Property**: Applying the same operation multiple times has no additional effect beyond the first application.

**Test Implementation**: `test_operation_idempotency`
- Applies operations once to one CRDT
- Applies same operations twice to another CRDT
- Verifies both CRDTs have identical final states

### 4. Convergence Property
**Property**: All replicas eventually converge to the same state after receiving all operations.

**Test Implementation**: `test_convergence_property`
- Creates multiple CRDTs representing different users
- Each user performs independent operations
- Simulates complete synchronization
- Verifies all CRDTs converge to identical states

### 5. Vector Clock Monotonicity
**Property**: Vector clocks must monotonically increase for each user.

**Test Implementation**: `test_vector_clock_monotonicity`
- Applies sequence of operations from same user
- Verifies clock value increases with each operation
- Ensures no clock values decrease

### 6. Operation Ordering Preservation
**Property**: Operations from the same user maintain causal ordering.

**Test Implementation**: `test_operation_ordering_preservation`
- Creates sequence of operations from single user
- Verifies operations appear in operation log in correct order
- Allows for interleaving with other users' operations

### 7. Conflict Resolution Consistency
**Property**: Conflict resolution (LWW semantics) is deterministic and consistent.

**Test Implementation**: `test_lww_map_conflict_resolution`
- Creates conflicting updates to same keys
- Applies operations in different orders
- Verifies both maps converge to same resolution

### 8. OR-Set Add/Remove Semantics
**Property**: OR-Set maintains correct add-biased semantics.

**Test Implementation**: `test_or_set_semantics`
- Adds elements to multiple sets
- Removes some elements
- Verifies sets maintain consistent state

### 9. Merge Idempotency
**Property**: Merging the same CRDT multiple times has no effect after the first merge.

**Test Implementation**: `test_merge_idempotency`
- Merges source CRDT into target once
- Merges same source CRDT again
- Verifies target remains unchanged after second merge

## Fuzz Testing for Edge Cases

### Random Operations Fuzz Test
**Purpose**: Verify system robustness under completely random input.

**Implementation**: `fuzz_random_operations`
- Generates completely random operation sequences
- Applies to CRDT without any constraints
- Verifies no panics or invalid states occur

### Extreme Values Fuzz Test
**Purpose**: Test handling of boundary conditions and extreme inputs.

**Implementation**: `fuzz_extreme_values`
- Tests very large strings (100,000 characters)
- Tests empty strings and null values
- Tests Unicode and special characters
- Verifies system handles all cases gracefully

### Memory Management Fuzz Test
**Purpose**: Verify memory management under stress conditions.

**Implementation**: `fuzz_memory_management`
- Applies thousands of operations
- Verifies operation log remains bounded
- Tests garbage collection effectiveness
- Ensures memory usage stays reasonable

## Performance Property Tests

### Operation Performance Bounds
**Property**: Operation application time should be bounded and predictable.

**Test Implementation**: `test_operation_performance_bounds`
- Measures time to apply operation sequences
- Verifies completion within reasonable time limits
- Detects performance regressions

### Merge Performance Bounds
**Property**: Merge operations should complete efficiently.

**Test Implementation**: `test_merge_performance_bounds`
- Measures merge time for various CRDT sizes
- Verifies merge performance scales appropriately
- Ensures no exponential blowup in merge time

## Invariant Tests

### State Consistency Invariant
**Property**: CRDT state remains consistent after any operation sequence.

**Test Implementation**: `test_state_consistency_invariant`
- Verifies vector clocks never decrease
- Ensures operation log stays bounded
- Checks metadata and reference layer consistency
- Validates timestamp ordering

### Concurrent Modification Safety
**Property**: Concurrent modifications preserve correctness.

**Test Implementation**: `test_concurrent_modification_safety`
- Simulates multiple users making concurrent operations
- Applies full synchronization
- Verifies final state consistency across all replicas

## Test Data Generation Strategies

### Arbitrary Value Generation
The property tests use sophisticated generators for creating realistic test data:

#### Operation Type Generation
```rust
fn arb_operation_type() -> impl Strategy<Value = OperationType> {
    prop_oneof![
        // Text operations with bounded positions
        (any::<String>(), any::<usize>(), any::<String>())
            .prop_map(|(field_id, position, content)| OperationType::TextInsert {
                field_id,
                position: position % 1000, // Bound to reasonable range
                content,
            }),
        // Metadata operations with complex values
        (any::<String>(), arb_template_value())
            .prop_map(|(key, value)| OperationType::MetadataSet { key, value }),
        // Reference operations with valid references
        arb_codex_reference().prop_map(|reference| OperationType::ReferenceAdd { reference }),
    ]
}
```

#### Template Value Generation
- Generates realistic `TemplateValue` variants
- Includes text, structured JSON, and reference types
- Uses appropriate timestamps and user IDs

#### Codex Reference Generation
- Creates valid cross-codex references
- Tests all reference types (Child, DependsOn, References, Related, Custom)
- Includes optional context strings

## Running Property Tests

### Local Development
```bash
# Run all property tests
cargo test property_tests

# Run with more test cases (slower but more thorough)
PROPTEST_CASES=10000 cargo test property_tests

# Run specific property test
cargo test test_operation_commutativity

# Run fuzz tests
cargo test fuzz_tests
```

### Continuous Integration
Property tests are included in the CI pipeline with:
- Standard test case count (1000 cases per test)
- Timeout limits to prevent hanging
- Failure reporting with minimal test case reproduction

### Performance Testing
```bash
# Run performance property tests
cargo test performance_property_tests

# Generate detailed performance reports
cargo bench --bench crdt_operations
```

## Test Case Minimization

When a property test fails, `proptest` automatically attempts to find the minimal failing case. This helps in:

1. **Debugging**: Smaller test cases are easier to understand
2. **Root Cause Analysis**: Minimal cases reveal the core issue
3. **Regression Prevention**: Minimal cases become targeted unit tests

## Coverage and Metrics

### Code Coverage
Property tests achieve high coverage of:
- All CRDT operation types
- Error handling paths
- Edge cases and boundary conditions
- Memory management code paths

### Test Metrics
- **Operation Sequences**: Tests up to 50 operations per sequence
- **User Counts**: Tests 1-10 concurrent users
- **Data Sizes**: Tests from small (10 items) to large (10,000 items)
- **Time Ranges**: Tests operations across different time periods

## Best Practices for Adding New Property Tests

### 1. Identify the Property
Before writing a test, clearly identify the mathematical or logical property that should hold.

### 2. Create Appropriate Generators
Write generators that create realistic and diverse test data relevant to the property.

### 3. Keep Tests Fast
Property tests run many iterations. Keep individual test cases fast to enable thorough testing.

### 4. Use Meaningful Assertions
Provide clear assertion messages that help diagnose failures.

### 5. Test Both Positive and Negative Cases
Verify the property holds AND that violations are properly detected.

## Integration with Development Workflow

### Pre-commit Hooks
Property tests can be run as part of pre-commit hooks to catch issues early.

### Code Review Process
New features should include relevant property tests to verify correctness.

### Release Testing
Before releases, run property tests with increased iteration counts for thorough validation.

## Troubleshooting Common Issues

### Test Timeout
If property tests timeout:
- Reduce the complexity of generated data
- Use `prop_assume!` to filter out invalid inputs
- Consider splitting complex tests into smaller ones

### Memory Issues
For memory-intensive tests:
- Use `BatchSize::SmallInput` in criterion benchmarks
- Implement proper cleanup in test teardown
- Monitor memory usage during test runs

### Flaky Tests
If tests occasionally fail:
- Check for race conditions in concurrent code
- Verify timestamp ordering assumptions
- Consider using fixed seeds for reproducibility during debugging

## Future Enhancements

### 1. Model-Based Testing
Implement a reference model of CRDT behavior and compare against actual implementation.

### 2. Network Simulation
Add property tests that simulate network partitions, message reordering, and failures.

### 3. Cross-Implementation Testing
Test compatibility with other CRDT implementations by exchanging operation logs.

### 4. Performance Properties
Add more sophisticated performance property tests with complexity analysis.

This comprehensive property-based testing strategy ensures the CRDT implementation maintains correctness under all conditions while providing excellent test coverage and confidence in the system's behavior.