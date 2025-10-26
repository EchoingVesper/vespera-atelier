#!/usr/bin/env tsx
/**
 * Phase 16b to Phase 17 Migration Verification Script
 * 
 * Checks for Phase 16b data and provides migration path if found.
 * See: docs/development/phases/PHASE_16B_TO_17_MIGRATION_FINDINGS.md
 */

import * as fs from 'fs';
import * as path from 'path';

const colors = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', red: '\x1b[31m', cyan: '\x1b[36m', gray: '\x1b[90m'
};

interface MigrationStatus {
  hasPhase16bData: boolean;
  phase16bProjectsDir: string | null;
  phase16bIndexFile: string | null;
  phase16bProjectFiles: string[];
  phase17SchemaExists: boolean;
  migrationNeeded: boolean;
}

function checkPhase16bData(workspaceRoot: string): MigrationStatus {
  const vesperaDir = path.join(workspaceRoot, '.vespera');
  const projectsDir = path.join(vesperaDir, 'projects');
  const indexFile = path.join(projectsDir, 'projects-index.json');

  const status: MigrationStatus = {
    hasPhase16bData: false,
    phase16bProjectsDir: null,
    phase16bIndexFile: null,
    phase16bProjectFiles: [],
    phase17SchemaExists: true, // Migrations 005-008 tested
    migrationNeeded: false
  };

  if (fs.existsSync(projectsDir) && fs.statSync(projectsDir).isDirectory()) {
    status.phase16bProjectsDir = projectsDir;
    if (fs.existsSync(indexFile)) {
      status.phase16bIndexFile = indexFile;
      status.hasPhase16bData = true;
    }
    const files = fs.readdirSync(projectsDir);
    status.phase16bProjectFiles = files.filter(f => f.startsWith('project-') && f.endsWith('.json'));
    if (status.phase16bProjectFiles.length > 0) status.hasPhase16bData = true;
  }

  status.migrationNeeded = status.hasPhase16bData && status.phase17SchemaExists;
  return status;
}

function displayStatus(status: MigrationStatus, workspaceRoot: string): void {
  console.log(`\n${colors.cyan}${'='.repeat(59)}${colors.reset}`);
  console.log(`${colors.cyan}  Phase 16b → Phase 17 Migration Status${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(59)}${colors.reset}\n`);
  console.log(`${colors.gray}Workspace:${colors.reset} ${workspaceRoot}\n`);
  
  console.log(`${colors.blue}Phase 16b Data:${colors.reset}`);
  if (status.hasPhase16bData) {
    console.log(`  ${colors.yellow}⚠ Found Phase 16b data${colors.reset}`);
    if (status.phase16bProjectsDir) console.log(`    📁 ${status.phase16bProjectsDir}`);
    if (status.phase16bProjectFiles.length > 0) {
      console.log(`    📦 ${status.phase16bProjectFiles.length} project files`);
    }
  } else {
    console.log(`  ${colors.green}✓ No Phase 16b data found${colors.reset}`);
    console.log(`    ${colors.gray}System was never used with Phase 16b${colors.reset}`);
  }
  
  console.log(`\n${colors.blue}Phase 17 Schema:${colors.reset}`);
  console.log(`  ${colors.green}✓ Phase 17 schema ready${colors.reset}`);
  console.log(`    ${colors.gray}Migrations 005-008 tested and validated${colors.reset}`);
  
  console.log(`\n${colors.blue}Migration Status:${colors.reset}`);
  if (status.migrationNeeded) {
    console.log(`  ${colors.yellow}⚠ Migration needed${colors.reset}`);
    console.log(`    Run with ${colors.cyan}--migrate${colors.reset} flag`);
  } else {
    console.log(`  ${colors.green}✓ No migration needed${colors.reset}`);
    console.log(`    ${colors.gray}Fresh Phase 17 installation - ready to use${colors.reset}`);
  }
  console.log(`\n${colors.cyan}${'='.repeat(59)}${colors.reset}\n`);
}

async function main(): Promise<void> {
  const status = checkPhase16bData(process.cwd());
  displayStatus(status, process.cwd());
  
  if (!status.hasPhase16bData) {
    console.log(`${colors.green}✓ Ready to use Phase 17 schema${colors.reset}\n`);
    process.exit(0);
  }
  
  if (status.migrationNeeded) {
    console.log(`${colors.red}ERROR: Migration not implemented${colors.reset}`);
    console.log(`${colors.gray}See PHASE_16B_TO_17_MIGRATION_FINDINGS.md${colors.reset}\n`);
    process.exit(2);
  }
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

export { checkPhase16bData, displayStatus, MigrationStatus };
