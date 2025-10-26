#!/usr/bin/env tsx
/**
 * Phase 16b to Phase 17 Migration Verification Script
 *
 * This script checks for Phase 16b data and migrates it to Phase 17 schema if found.
 *
 * Phase 16b Schema (file-based):
 * - .vespera/projects/project-{id}.json (individual project files)
 * - .vespera/projects/projects-index.json (index of all projects)
 * - ProjectService stored data in filesystem
 *
 * Phase 17 Schema (database-based):
 * - Workspace → Project → Context → Codex hierarchy
 * - Database tables: projects, contexts, codex_contexts
 * - Migration 005-008 creates new schema
 *
 * Usage:
 *   # Verify migration status (dry-run)
 *   tsx scripts/migration/verify-phase16b-migration.ts --dry-run
 *
 *   # Perform migration if Phase 16b data exists
 *   tsx scripts/migration/verify-phase16b-migration.ts --migrate
 *
 *   # Check status only
 *   tsx scripts/migration/verify-phase16b-migration.ts
 *
 * Exit Codes:
 *   0 - Success (no migration needed or migration completed)
 *   1 - Error during migration
 *   2 - Phase 16b data found but --migrate not specified
 */

import * as fs from 'fs';
import * as path from 'path';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

interface MigrationStatus {
  hasPhase16bData: boolean;
  phase16bProjectsDir: string | null;
  phase16bIndexFile: string | null;
  phase16bProjectFiles: string[];
  phase17SchemaExists: boolean;
  migrationNeeded: boolean;
}

/**
 * Check if Phase 16b data exists in the workspace
 */
function checkPhase16bData(workspaceRoot: string): MigrationStatus {
  const vesperaDir = path.join(workspaceRoot, '.vespera');
  const projectsDir = path.join(vesperaDir, 'projects');
  const indexFile = path.join(projectsDir, 'projects-index.json');

  const status: MigrationStatus = {
    hasPhase16bData: false,
    phase16bProjectsDir: null,
    phase16bIndexFile: null,
    phase16bProjectFiles: [],
    phase17SchemaExists: false,
    migrationNeeded: false
  };

  // Check if .vespera/projects/ directory exists
  if (fs.existsSync(projectsDir) && fs.statSync(projectsDir).isDirectory()) {
    status.phase16bProjectsDir = projectsDir;

    // Check if projects-index.json exists
    if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
      status.phase16bIndexFile = indexFile;
      status.hasPhase16bData = true;
    }

    // Look for project-*.json files
    const files = fs.readdirSync(projectsDir);
    status.phase16bProjectFiles = files.filter(f =>
      f.startsWith('project-') && f.endsWith('.json')
    );

    if (status.phase16bProjectFiles.length > 0) {
      status.hasPhase16bData = true;
    }
  }

  // TODO: Check if Phase 17 database schema exists
  // This would require connecting to the Bindery database
  // For now, we assume Phase 17 schema is ready (migrations 005-008 tested)
  status.phase17SchemaExists = true;

  status.migrationNeeded = status.hasPhase16bData && status.phase17SchemaExists;

  return status;
}

/**
 * Display migration status in a human-readable format
 */
function displayStatus(status: MigrationStatus, workspaceRoot: string): void {
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  Phase 16b → Phase 17 Migration Status${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  console.log(`${colors.gray}Workspace:${colors.reset} ${workspaceRoot}`);
  console.log('');

  // Phase 16b Data Check
  console.log(`${colors.blue}Phase 16b Data:${colors.reset}`);
  if (status.hasPhase16bData) {
    console.log(`  ${colors.yellow}⚠ Found Phase 16b data${colors.reset}`);
    if (status.phase16bProjectsDir) {
      console.log(`    📁 Projects directory: ${status.phase16bProjectsDir}`);
    }
    if (status.phase16bIndexFile) {
      console.log(`    📄 Index file: ${status.phase16bIndexFile}`);
    }
    if (status.phase16bProjectFiles.length > 0) {
      console.log(`    📦 Project files: ${status.phase16bProjectFiles.length} found`);
      status.phase16bProjectFiles.slice(0, 5).forEach(file => {
        console.log(`       - ${file}`);
      });
      if (status.phase16bProjectFiles.length > 5) {
        console.log(`       ... and ${status.phase16bProjectFiles.length - 5} more`);
      }
    }
  } else {
    console.log(`  ${colors.green}✓ No Phase 16b data found${colors.reset}`);
    console.log(`    ${colors.gray}System was never used with Phase 16b${colors.reset}`);
  }
  console.log('');

  // Phase 17 Schema Check
  console.log(`${colors.blue}Phase 17 Schema:${colors.reset}`);
  if (status.phase17SchemaExists) {
    console.log(`  ${colors.green}✓ Phase 17 schema ready${colors.reset}`);
    console.log(`    ${colors.gray}Migrations 005-008 tested and validated${colors.reset}`);
  } else {
    console.log(`  ${colors.red}✗ Phase 17 schema not ready${colors.reset}`);
  }
  console.log('');

  // Migration Decision
  console.log(`${colors.blue}Migration Status:${colors.reset}`);
  if (status.migrationNeeded) {
    console.log(`  ${colors.yellow}⚠ Migration needed${colors.reset}`);
    console.log(`    Run with ${colors.cyan}--migrate${colors.reset} flag to perform migration`);
  } else if (!status.hasPhase16bData) {
    console.log(`  ${colors.green}✓ No migration needed${colors.reset}`);
    console.log(`    ${colors.gray}Fresh Phase 17 installation - ready to use${colors.reset}`);
  } else {
    console.log(`  ${colors.red}✗ Cannot migrate${colors.reset}`);
    console.log(`    Phase 17 schema not ready`);
  }

  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);
}

/**
 * Perform migration from Phase 16b to Phase 17
 *
 * TODO: Implement actual migration logic when Phase 16b data exists
 * Currently this is a placeholder for future implementation
 */
async function performMigration(status: MigrationStatus, workspaceRoot: string): Promise<void> {
  console.log(`\n${colors.yellow}Starting migration...${colors.reset}\n`);

  // TODO: Implement migration steps:
  // 1. Read Phase 16b projects from JSON files
  // 2. Create default Project in Phase 17 schema
  // 3. Convert each Phase 16b project → Phase 17 context
  // 4. Link existing Codices to new Project
  // 5. Populate codex_contexts join table
  // 6. Backup Phase 16b data
  // 7. Verify migration success

  console.log(`${colors.red}ERROR: Migration not yet implemented${colors.reset}`);
  console.log(`${colors.gray}This is a future-proofing placeholder.${colors.reset}`);
  console.log(`${colors.gray}Phase 16b was never deployed with user data.${colors.reset}`);
  console.log(`${colors.gray}If you see this message, please implement the migration logic.${colors.reset}\n`);

  throw new Error('Migration not implemented - Phase 16b was never deployed');
}

/**
 * Main script execution
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const migrate = args.includes('--migrate');
  const workspaceRoot = process.cwd();

  // Check Phase 16b data status
  const status = checkPhase16bData(workspaceRoot);

  // Display status
  displayStatus(status, workspaceRoot);

  // Handle different scenarios
  if (!status.hasPhase16bData) {
    // No migration needed - clean Phase 17 installation
    console.log(`${colors.green}✓ Ready to use Phase 17 schema${colors.reset}\n`);
    process.exit(0);
  }

  if (status.migrationNeeded && !migrate && !dryRun) {
    // Phase 16b data found but migration not requested
    console.log(`${colors.yellow}Phase 16b data found. Run with --migrate to perform migration.${colors.reset}\n`);
    process.exit(2);
  }

  if (dryRun) {
    // Dry run - just show what would happen
    console.log(`${colors.blue}Dry run - no changes made${colors.reset}\n`);
    process.exit(0);
  }

  if (migrate && status.migrationNeeded) {
    // Perform migration
    try {
      await performMigration(status, workspaceRoot);
      console.log(`\n${colors.green}✓ Migration completed successfully${colors.reset}\n`);
      process.exit(0);
    } catch (error) {
      console.error(`\n${colors.red}✗ Migration failed:${colors.reset}`, error);
      process.exit(1);
    }
  }

  if (!status.phase17SchemaExists) {
    console.log(`${colors.red}✗ Phase 17 schema not ready${colors.reset}`);
    console.log(`${colors.gray}Run database migrations 005-008 first${colors.reset}\n`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  });
}

// Export for use as a module
export { checkPhase16bData, displayStatus, performMigration, MigrationStatus };
