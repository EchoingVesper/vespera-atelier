/**
 * Vite plugin to inline all imports into plugin.js for Penpot's SES sandbox
 *
 * Penpot's SES (Secure ECMAScript) environment doesn't support ES module imports,
 * so we need to inline everything into a single file with no import statements.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Plugin } from 'vite';

export function inlinePluginImports(): Plugin {
  return {
    name: 'inline-plugin-imports',
    enforce: 'post',

    closeBundle() {
      const distDir = join(process.cwd(), 'dist');
      const pluginPath = join(distDir, 'plugin.js');

      if (!existsSync(pluginPath)) {
        console.warn('[inline-plugin-imports] plugin.js not found, skipping');
        return;
      }

      const plugin = readFileSync(pluginPath, 'utf8');

      // Check if there are any imports
      const importMatch = plugin.match(/^import\s*{[^}]+}\s*from\s*"([^"]+)";/);
      if (!importMatch) {
        console.log('[inline-plugin-imports] No imports found, nothing to inline');
        return;
      }

      const [importStatement, importPath] = importMatch;
      const fullImportPath = join(distDir, importPath);

      if (!existsSync(fullImportPath)) {
        console.error(`[inline-plugin-imports] Import file not found: ${fullImportPath}`);
        return;
      }

      // Read the imported module
      const importedModule = readFileSync(fullImportPath, 'utf8');

      // Extract exported names from the import statement
      // Example: import{i as x}from"..." -> alias 'x' refers to export 'i'
      const importNames = importStatement.match(/import\s*{([^}]+)}/)?.[1];
      if (!importNames) {
        console.error('[inline-plugin-imports] Could not parse import names');
        return;
      }

      // Parse: "i as x" -> exportName: 'i', alias: 'x'
      const aliasMatch = importNames.match(/(\w+)\s+as\s+(\w+)/);
      if (!aliasMatch) {
        console.error('[inline-plugin-imports] Could not parse alias');
        return;
      }

      const [, exportName, alias] = aliasMatch;

      // Remove the export statement from the imported module
      const importedCode = importedModule.replace(/export\s*{\s*[^}]+};?/, '');

      // Remove the import from plugin.js and replace alias with actual name
      let fixedPlugin = plugin
        .replace(importStatement, '')
        .replace(new RegExp(`\\b${alias}\\b`, 'g'), exportName);

      // Prepend the imported code
      fixedPlugin = importedCode + fixedPlugin;

      // Write back the fixed plugin
      writeFileSync(pluginPath, fixedPlugin);
      console.log('[inline-plugin-imports] ✓ Inlined imports into plugin.js');
    },
  };
}
