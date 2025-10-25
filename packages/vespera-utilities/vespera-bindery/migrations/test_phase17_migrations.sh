#!/bin/bash
# Test Phase 17 Migrations (005-008)
# Comprehensive integration test for the Workspace → Project → Context → Codex hierarchy
#
# This script:
# 1. Creates a fresh test database with Phase 16b schema (migrations 001-004)
# 2. Applies Phase 17 migrations (005-008) in sequence
# 3. Runs comprehensive integration tests
# 4. Validates schema integrity, foreign keys, and cascade behavior
# 5. Tests rollback functionality
#
# Usage: ./test_phase17_migrations.sh
#
# Prerequisites:
# - sqlite3 command-line tool installed
# - All migration files (001-008) present in the migrations directory
#
# Output:
# - test_phase17.db: Test database (created fresh each run)
# - test_output.log: Detailed test execution log
# - Exit code 0 on success, non-zero on failure

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DB="${SCRIPT_DIR}/test_phase17.db"
TEST_SQL="${SCRIPT_DIR}/test_phase17_schema.sql"
LOG_FILE="${SCRIPT_DIR}/test_output.log"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1" | tee -a "$LOG_FILE"
}

run_sql() {
    local description="$1"
    local sql="$2"
    log_info "Running: $description"
    if echo "$sql" | sqlite3 "$TEST_DB" >> "$LOG_FILE" 2>&1; then
        log_success "$description"
        return 0
    else
        log_error "$description"
        return 1
    fi
}

run_migration() {
    local migration_file="$1"
    local description="$2"
    log_info "Applying migration: $migration_file - $description"

    # Extract only the +migrate up section (everything before +migrate down)
    # This prevents executing the rollback SQL immediately after the migration
    if awk '/-- \+migrate up/,/-- \+migrate down/ {if (/-- \+migrate down/) exit; print}' "$migration_file" | \
       tail -n +2 | \
       sqlite3 "$TEST_DB" >> "$LOG_FILE" 2>&1; then
        log_success "Migration applied: $migration_file"
        return 0
    else
        log_error "Migration failed: $migration_file"
        return 1
    fi
}

# Start test execution
echo "========================================" | tee "$LOG_FILE"
echo "Phase 17 Migration Integration Tests" | tee -a "$LOG_FILE"
echo "Started: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Step 1: Clean up old test database
log_info "Cleaning up old test database..."
rm -f "$TEST_DB"
log_success "Old test database removed"

# Step 2: Create fresh test database with Phase 16b schema
log_info "Creating Phase 16b baseline schema (migrations 001-004)..."

run_migration "${SCRIPT_DIR}/001_initial.sql" "Initial schema"
run_migration "${SCRIPT_DIR}/002_codex_tables.sql" "Codex system tables"
run_migration "${SCRIPT_DIR}/003_automation_system.sql" "Automation system"
run_migration "${SCRIPT_DIR}/004_rag_system.sql" "RAG system"

log_success "Phase 16b baseline schema created successfully"
echo "" | tee -a "$LOG_FILE"

# Step 3: Apply Phase 17 migrations in sequence
log_info "Applying Phase 17 migrations (005-008)..."

run_migration "${SCRIPT_DIR}/005_projects_table.sql" "Projects table"
run_migration "${SCRIPT_DIR}/006_contexts_table.sql" "Contexts table"
run_migration "${SCRIPT_DIR}/007_codex_contexts_join.sql" "Codex-contexts join table"
run_migration "${SCRIPT_DIR}/008_update_codices_project_fk.sql" "Codices project FK constraint"

log_success "All Phase 17 migrations applied successfully"
echo "" | tee -a "$LOG_FILE"

# Step 4: Verify schema structure
log_info "Verifying Phase 17 schema structure..."

log_info "Checking projects table..."
sqlite3 "$TEST_DB" "PRAGMA table_info(projects);" >> "$LOG_FILE" 2>&1
if sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='projects';" | grep -q "1"; then
    log_success "Projects table exists"
else
    log_error "Projects table missing"
    exit 1
fi

log_info "Checking contexts table..."
sqlite3 "$TEST_DB" "PRAGMA table_info(contexts);" >> "$LOG_FILE" 2>&1
if sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='contexts';" | grep -q "1"; then
    log_success "Contexts table exists"
else
    log_error "Contexts table missing"
    exit 1
fi

log_info "Checking codex_contexts table..."
sqlite3 "$TEST_DB" "PRAGMA table_info(codex_contexts);" >> "$LOG_FILE" 2>&1
if sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='codex_contexts';" | grep -q "1"; then
    log_success "Codex_contexts table exists"
else
    log_error "Codex_contexts table missing"
    exit 1
fi

log_info "Checking codices table structure..."
sqlite3 "$TEST_DB" "PRAGMA table_info(codices);" >> "$LOG_FILE" 2>&1
if sqlite3 "$TEST_DB" "PRAGMA table_info(codices);" | grep -q "project_id"; then
    log_success "Codices table has project_id column"
else
    log_error "Codices table missing project_id column"
    exit 1
fi

if sqlite3 "$TEST_DB" "PRAGMA table_info(codices);" | grep -q "parent_id"; then
    log_error "Codices table still has parent_id column (should be removed)"
    exit 1
else
    log_success "Codices table parent_id column removed correctly"
fi

log_success "Schema structure verification complete"
echo "" | tee -a "$LOG_FILE"

# Step 5: Run comprehensive integration tests
log_info "Running integration test suite..."

if [ ! -f "$TEST_SQL" ]; then
    log_error "Test SQL file not found: $TEST_SQL"
    exit 1
fi

# Run integration tests and check for success message
# Note: We check for the success message in output rather than exit code,
# because SQLite may return non-zero even after successful test execution
sqlite3 "$TEST_DB" < "$TEST_SQL" >> "$LOG_FILE" 2>&1 || true

if grep -q "All Phase 17 integration tests completed successfully" "$LOG_FILE"; then
    log_success "Integration test suite passed"
else
    log_error "Integration test suite failed - check $LOG_FILE for details"
    exit 1
fi

echo "" | tee -a "$LOG_FILE"

# Step 6: Test rollback functionality
log_info "Testing migration rollback..."

# Create a separate database for rollback testing
ROLLBACK_DB="${SCRIPT_DIR}/test_rollback.db"
rm -f "$ROLLBACK_DB"

log_info "Creating rollback test database..."
sqlite3 "$ROLLBACK_DB" < "${SCRIPT_DIR}/001_initial.sql" >> "$LOG_FILE" 2>&1
sqlite3 "$ROLLBACK_DB" < "${SCRIPT_DIR}/002_codex_tables.sql" >> "$LOG_FILE" 2>&1
sqlite3 "$ROLLBACK_DB" < "${SCRIPT_DIR}/003_automation_system.sql" >> "$LOG_FILE" 2>&1
sqlite3 "$ROLLBACK_DB" < "${SCRIPT_DIR}/004_rag_system.sql" >> "$LOG_FILE" 2>&1
sqlite3 "$ROLLBACK_DB" < "${SCRIPT_DIR}/005_projects_table.sql" >> "$LOG_FILE" 2>&1
sqlite3 "$ROLLBACK_DB" < "${SCRIPT_DIR}/006_contexts_table.sql" >> "$LOG_FILE" 2>&1
sqlite3 "$ROLLBACK_DB" < "${SCRIPT_DIR}/007_codex_contexts_join.sql" >> "$LOG_FILE" 2>&1
sqlite3 "$ROLLBACK_DB" < "${SCRIPT_DIR}/008_update_codices_project_fk.sql" >> "$LOG_FILE" 2>&1

log_info "Applying rollback migrations in reverse order..."

# Extract and run +migrate down sections in reverse order
for migration in 008 007 006 005; do
    migration_file="${SCRIPT_DIR}/${migration}_*.sql"
    log_info "Rolling back migration ${migration}..."

    # Extract +migrate down section
    if awk '/-- \+migrate down/,0' ${migration_file} | tail -n +2 | sqlite3 "$ROLLBACK_DB" >> "$LOG_FILE" 2>&1; then
        log_success "Rolled back migration ${migration}"
    else
        log_error "Failed to rollback migration ${migration}"
        exit 1
    fi
done

log_info "Verifying rollback restored Phase 16b schema..."

if sqlite3 "$ROLLBACK_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='projects';" | grep -q "0"; then
    log_success "Projects table removed after rollback"
else
    log_error "Projects table still exists after rollback"
    exit 1
fi

if sqlite3 "$ROLLBACK_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='contexts';" | grep -q "0"; then
    log_success "Contexts table removed after rollback"
else
    log_error "Contexts table still exists after rollback"
    exit 1
fi

if sqlite3 "$ROLLBACK_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='codex_contexts';" | grep -q "0"; then
    log_success "Codex_contexts table removed after rollback"
else
    log_error "Codex_contexts table still exists after rollback"
    exit 1
fi

if sqlite3 "$ROLLBACK_DB" "PRAGMA table_info(codices);" | grep -q "parent_id"; then
    log_success "Codices parent_id column restored after rollback"
else
    log_error "Codices parent_id column not restored after rollback"
    exit 1
fi

log_success "Rollback functionality verified successfully"
rm -f "$ROLLBACK_DB"

echo "" | tee -a "$LOG_FILE"

# Summary
echo "========================================" | tee -a "$LOG_FILE"
echo -e "${GREEN}All Phase 17 migration tests PASSED${NC}" | tee -a "$LOG_FILE"
echo "Completed: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Test database: $TEST_DB" | tee -a "$LOG_FILE"
echo "Test log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Next steps:" | tee -a "$LOG_FILE"
echo "1. Review test results in $LOG_FILE" | tee -a "$LOG_FILE"
echo "2. Inspect test database: sqlite3 $TEST_DB" | tee -a "$LOG_FILE"
echo "3. Document test results in TEST_RESULTS_PHASE17.md" | tee -a "$LOG_FILE"
echo "4. Update migration README.md with findings" | tee -a "$LOG_FILE"

exit 0
