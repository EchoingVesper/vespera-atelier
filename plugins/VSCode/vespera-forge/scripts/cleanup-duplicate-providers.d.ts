/**
 * Cleanup script to remove duplicate provider codices
 *
 * This script will:
 * 1. List all provider codices (claude-code-cli and ollama templates)
 * 2. Keep only the first instance of each type
 * 3. Delete all duplicates
 *
 * Run from VS Code extension context or via command palette
 */
export declare function cleanupDuplicateProviders(): Promise<void>;
//# sourceMappingURL=cleanup-duplicate-providers.d.ts.map