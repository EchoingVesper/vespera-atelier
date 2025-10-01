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

    generateBundle(options, bundle) {
      // Find plugin.js in the bundle
      const pluginChunk = Object.values(bundle).find(
        (chunk) => chunk.type === 'chunk' && chunk.fileName === 'plugin.js'
      );

      if (!pluginChunk || pluginChunk.type !== 'chunk') {
        console.warn('[inline-plugin-imports] plugin.js chunk not found');
        return;
      }

      const plugin = pluginChunk.code;

      // Check if there are any imports
      const importMatch = plugin.match(/^import\s*{[^}]+}\s*from\s*"([^"]+)";/);
      if (!importMatch) {
        console.log('[inline-plugin-imports] No imports found, nothing to inline');
        return;
      }

      const [importStatement, importPath] = importMatch;

      // Find the imported chunk in the bundle
      const importedChunk = Object.values(bundle).find(
        (chunk) =>
          chunk.type === 'chunk' &&
          (chunk.fileName === importPath ||
            chunk.fileName === importPath.replace('./', ''))
      );

      if (!importedChunk || importedChunk.type !== 'chunk') {
        console.error(`[inline-plugin-imports] Import chunk not found: ${importPath}`);
        return;
      }

      const importedModule = importedChunk.code;

      // Extract exported names from the import statement
      const importNames = importStatement.match(/import\s*{([^}]+)}/)?.[1];
      if (!importNames) {
        console.error('[inline-plugin-imports] Could not parse import names');
        return;
      }

      // Parse: "i as x" -> exportAlias: 'i', localAlias: 'x'
      const aliasMatch = importNames.match(/(\w+)\s+as\s+(\w+)/);
      if (!aliasMatch) {
        console.error('[inline-plugin-imports] Could not parse alias');
        return;
      }

      const [, exportAlias, localAlias] = aliasMatch;

      // Parse the export statement to find actual function name
      const exportMatch = importedModule.match(
        new RegExp(`export\\s*{[^}]*\\b(\\w+)\\s+as\\s+${exportAlias}\\b`)
      );
      if (!exportMatch) {
        console.error(
          `[inline-plugin-imports] Could not find export for '${exportAlias}'`
        );
        return;
      }

      const actualFunctionName = exportMatch[1];

      // Remove the export statement from the imported module
      const importedCode = importedModule.replace(/export\s*{\s*[^}]+};?/, '');

      // Remove the import from plugin.js and replace local alias with actual function name
      let fixedPlugin = plugin
        .replace(importStatement, '')
        .replace(new RegExp(`\\b${localAlias}\\b`, 'g'), actualFunctionName);

      // Prepend the imported code
      fixedPlugin = importedCode + fixedPlugin;

      // Update the chunk code
      pluginChunk.code = fixedPlugin;

      // Delete the imported chunk from the bundle
      delete bundle[importedChunk.fileName];

      console.log('[inline-plugin-imports] ✓ Inlined imports into plugin.js');
    },

    // Fallback for file-system based inlining (for watch mode)
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
      // Example: import{i as x}from"..." -> 'x' is local alias, 'i' is export alias
      const importNames = importStatement.match(/import\s*{([^}]+)}/)?.[1];
      if (!importNames) {
        console.error('[inline-plugin-imports] Could not parse import names');
        return;
      }

      // Parse: "i as x" -> exportAlias: 'i', localAlias: 'x'
      const aliasMatch = importNames.match(/(\w+)\s+as\s+(\w+)/);
      if (!aliasMatch) {
        console.error('[inline-plugin-imports] Could not parse alias');
        return;
      }

      const [, exportAlias, localAlias] = aliasMatch;

      // Parse the export statement to find actual function name
      // Example: export{o as i} means 'o' is the real function, 'i' is the export alias
      const exportMatch = importedModule.match(
        new RegExp(`export\\s*{[^}]*\\b(\\w+)\\s+as\\s+${exportAlias}\\b`)
      );
      if (!exportMatch) {
        console.error(
          `[inline-plugin-imports] Could not find export for '${exportAlias}'`
        );
        return;
      }

      const actualFunctionName = exportMatch[1];

      // Remove the export statement from the imported module
      const importedCode = importedModule.replace(/export\s*{\s*[^}]+};?/, '');

      // Remove the import from plugin.js and replace local alias with actual function name
      let fixedPlugin = plugin
        .replace(importStatement, '')
        .replace(new RegExp(`\\b${localAlias}\\b`, 'g'), actualFunctionName);

      // Prepend the imported code
      fixedPlugin = importedCode + fixedPlugin;

      // Write back the fixed plugin
      writeFileSync(pluginPath, fixedPlugin);
      console.log('[inline-plugin-imports] ✓ Inlined imports into plugin.js');
    },
  };
}
