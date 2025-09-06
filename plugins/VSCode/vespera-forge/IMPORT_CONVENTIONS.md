# Import Conventions - Vespera Forge VSCode Plugin

**Established**: 2025-09-06  
**Context**: TypeScript TS2304 error resolution  
**Status**: Active conventions for import management  

## Import Patterns Established

### 1. Barrel Export Pattern
**Usage**: Consolidate module exports in `index.ts` files
**Example**: `src/utils/cleanup/index.ts`

```typescript
// Import from individual modules
import {
  BatchProcessingOptions,
  BatchProcessingResult,
  batchProcessingEngine
} from './BatchProcessingEngine';

// Re-export for consumers
export {
  BatchProcessingOptions,
  BatchProcessingResult,
  batchProcessingEngine
};
```

### 2. Import Grouping and Ordering
**Standard Order**:
1. Node.js built-ins
2. Third-party packages (vscode, uuid, etc.)
3. Local relative imports (`./ModuleName`)
4. Path-aliased imports (`@/path/module`) - used sparingly

**Within Groups**:
- Alphabetical by module name
- Interfaces/types first, then classes, then instances
- Separate groups with blank lines and descriptive comments

### 3. Relative Import Syntax
**Pattern**: `from './ModuleName'`
**Rationale**: Consistent with existing project patterns

```typescript
// ✅ Correct
import { ProcessingPhase, RiskLevel } from './UnusedVariableClassifier';

// ❌ Avoid
import { ProcessingPhase } from '../UnusedVariableClassifier';
import { RiskLevel } from '@/utils/cleanup/UnusedVariableClassifier';
```

### 4. Variable Declaration Conventions
**Pattern**: Declare variables at appropriate scope before first use

```typescript
// ✅ Test files
let operationSucceeded = false;  // At test function beginning

// ✅ Function scope  
let vscodeDelivered = false;     // Near function start
```

## Project-Specific Patterns

### Cleanup System Architecture
- **Index file**: `src/utils/cleanup/index.ts` serves as main barrel export
- **Module organization**: Each utility has its own file with focused exports
- **Import strategy**: Import from individual modules, re-export through index

### TypeScript Configuration Alignment
- **Module system**: CommonJS compatible
- **Resolution**: Node.js style (`"moduleResolution": "Node"`)
- **Base URL**: `"baseUrl": "./src"` for path resolution
- **Case sensitivity**: Enforced (`"forceConsistentCasingInFileNames": true`)

## Maintenance Guidelines

### Adding New Modules
1. Create focused module file with clear exports
2. Add imports to relevant `index.ts` barrel export
3. Follow alphabetical ordering within import groups
4. Add descriptive comments for new import sections
5. Validate with `npx tsc --noEmit`

### Import Validation Checklist
- [ ] Import names match exact exports from source modules
- [ ] No typos in import paths or member names
- [ ] Consistent formatting with existing imports
- [ ] Proper grouping and alphabetical ordering
- [ ] No circular dependencies created

### Error Prevention
- **Incremental validation**: Test compilation after each import addition
- **Name verification**: Check exports against source files
- **Path validation**: Confirm all paths exist and are accessible
- **Pattern consistency**: Match existing project conventions

## Common Pitfalls to Avoid

### ❌ Anti-Patterns
```typescript
// Don't create unnecessary barrel exports
export * from './ModuleA';
export * from './ModuleB';  // If not consolidating related functionality

// Don't mix import styles inconsistently
import { TypeA } from './ModuleA';
import TypeB from './ModuleB';    // Inconsistent with named imports

// Don't ignore existing patterns
import './styles.css';            // If project doesn't use CSS imports
```

### ✅ Best Practices  
```typescript
// Use consistent named imports
import { TypeA, TypeB, TypeC } from './ModuleA';

// Follow established barrel export patterns
import { CleanupUtility } from '@/utils/cleanup';  // Uses existing index

// Group related imports logically
// External dependencies
import * as vscode from 'vscode';
import { UUID } from 'uuid';

// Internal modules  
import { BatchProcessor } from './BatchProcessor';
import { TaskManager } from './TaskManager';
```

## Resolution Success Metrics

### TS2304 Import Resolution Achievement
- **Total TS2304 errors resolved**: 79 → 0 (100%)
- **Primary fix**: Added missing imports to `src/utils/cleanup/index.ts`
- **Secondary fixes**: Variable declarations in 3 files
- **Impact**: Reduced total TypeScript errors by 18.3%

### Files Modified Successfully
1. `/src/utils/cleanup/index.ts` - Added batch processing imports
2. `/src/test/credential-migration-security.test.ts` - Added variable declaration
3. `/src/test/webview-security.test.ts` - Removed duplicate declaration
4. `/src/notifications/SecureNotificationManager.ts` - Added variable declaration

## Future Maintenance Considerations

### When Adding New Modules
**Before creating new functionality**:
1. Check if existing barrel exports already provide needed functionality
2. Follow established naming conventions for new modules
3. Consider impact on existing import patterns

**Module creation checklist**:
- [ ] Module exports follow existing patterns (named exports preferred)
- [ ] Update relevant `index.ts` barrel export with new imports
- [ ] Maintain alphabetical ordering within import groups  
- [ ] Add appropriate TypeScript types for all exports
- [ ] Test compilation after each addition: `npx tsc --noEmit`

### Preventing Future TS2304 Errors
**Early detection strategies**:
- Set up IDE to show TypeScript errors inline (Error Lens extension)
- Run `npx tsc --noEmit` regularly during development
- Use TypeScript strict mode to catch import issues early

**Common scenarios that cause TS2304**:
1. **New module creation** - Remember to add to barrel export
2. **File refactoring** - Update import paths when moving files
3. **Dependency changes** - Check import statements when updating packages
4. **Path configuration changes** - Validate import paths after tsconfig changes

### Barrel Export Maintenance
**Monthly review checklist**:
- [ ] Remove exports for deleted modules
- [ ] Ensure alphabetical ordering is maintained
- [ ] Verify all re-exported items are actually used
- [ ] Check for potential circular dependencies

**Warning signs**:
- Import statements becoming very long (consider sub-grouping)
- Frequent TS2304 errors after new additions (check barrel exports)
- Performance issues (too many re-exports can impact tree-shaking)

### TypeScript Configuration Alignment
**When updating tsconfig.json**:
- Validate that all existing imports still resolve correctly
- Check `baseUrl` and `paths` configuration compatibility
- Test module resolution with `npx tsc --traceResolution` if issues arise
- Ensure `moduleResolution` setting matches import patterns

**Configuration changes that affect imports**:
- `baseUrl` changes require import path validation
- `paths` mapping changes need comprehensive testing
- `moduleResolution` changes can break existing patterns
- `esModuleInterop` affects default import behavior

---

**Import Resolution Success**: This document captures the patterns established during the successful resolution of all 79 TS2304 errors on 2025-09-06. 

**Next Steps**: Apply these conventions when addressing remaining TypeScript error categories (TS6133, TS18048, etc.)