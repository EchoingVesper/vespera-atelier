#!/usr/bin/env node

/**
 * Build Verification Script
 * 
 * Verifies the production build meets quality and functionality requirements.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, '..');

console.log('🔍 Verifying production build...');

const checks = {
    bundleExists: false,
    manifestValid: false,
    bundleSize: 0,
    hasSourceMap: false,
    codeQuality: {
        minified: false,
        noConsoleLog: true,
        noDebugCode: true,
        hasProperExports: false
    }
};

// Check if main.js exists
const bundlePath = path.join(pluginRoot, 'main.js');
if (fs.existsSync(bundlePath)) {
    checks.bundleExists = true;
    console.log('✅ Bundle file exists');
    
    // Check bundle size
    const stats = fs.statSync(bundlePath);
    checks.bundleSize = Math.round(stats.size / 1024); // KB
    console.log(`📦 Bundle size: ${checks.bundleSize}KB`);
    
    if (checks.bundleSize > 500) {
        console.log('⚠️  Warning: Bundle size is large (>500KB)');
    } else {
        console.log('✅ Bundle size is reasonable');
    }
    
    // Analyze bundle content
    const bundleContent = fs.readFileSync(bundlePath, 'utf8');
    
    // Check if minified (no unnecessary whitespace)
    const lines = bundleContent.split('\n');
    const avgLineLength = bundleContent.length / lines.length;
    checks.codeQuality.minified = avgLineLength > 100; // Minified code has longer lines
    
    if (checks.codeQuality.minified) {
        console.log('✅ Code appears minified');
    } else {
        console.log('⚠️  Code may not be properly minified');
    }
    
    // Check for console.log statements (should be minimal in production)
    const consoleLogCount = (bundleContent.match(/console\.log/g) || []).length;
    checks.codeQuality.noConsoleLog = consoleLogCount <= 2; // Allow a couple for essential logging
    
    if (checks.codeQuality.noConsoleLog) {
        console.log('✅ Minimal console.log usage');
    } else {
        console.log(`⚠️  Found ${consoleLogCount} console.log statements`);
    }
    
    // Check for debug code
    const debugPatterns = [
        /debugger;/g,
        /console\.debug/g,
        /console\.warn/g,
        /TODO:/g,
        /FIXME:/g
    ];
    
    let debugIssues = 0;
    debugPatterns.forEach(pattern => {
        const matches = bundleContent.match(pattern);
        if (matches) {
            debugIssues += matches.length;
        }
    });
    
    checks.codeQuality.noDebugCode = debugIssues === 0;
    
    if (checks.codeQuality.noDebugCode) {
        console.log('✅ No debug code found');
    } else {
        console.log(`⚠️  Found ${debugIssues} debug statements`);
    }
    
    // Check for proper exports
    checks.codeQuality.hasProperExports = bundleContent.includes('module.exports') || 
                                           bundleContent.includes('exports.default');
    
    if (checks.codeQuality.hasProperExports) {
        console.log('✅ Proper module exports found');
    } else {
        console.log('❌ No proper module exports found');
    }
} else {
    console.log('❌ Bundle file missing');
}

// Check manifest.json
const manifestPath = path.join(pluginRoot, 'manifest.json');
if (fs.existsSync(manifestPath)) {
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        
        const requiredFields = ['id', 'name', 'version', 'minAppVersion', 'description', 'author'];
        const hasAllFields = requiredFields.every(field => manifest[field]);
        
        if (hasAllFields) {
            checks.manifestValid = true;
            console.log('✅ Manifest is valid');
            console.log(`   Plugin: ${manifest.name} v${manifest.version}`);
            console.log(`   Author: ${manifest.author}`);
            console.log(`   Min Obsidian: ${manifest.minAppVersion}`);
        } else {
            console.log('❌ Manifest missing required fields');
            console.log('   Required:', requiredFields.join(', '));
        }
    } catch (error) {
        console.log('❌ Manifest JSON is invalid:', error.message);
    }
} else {
    console.log('❌ Manifest file missing');
}

// Check for source maps (should not exist in production)
const sourceMapPath = path.join(pluginRoot, 'main.js.map');
if (fs.existsSync(sourceMapPath)) {
    checks.hasSourceMap = true;
    console.log('⚠️  Source map found (consider removing for production)');
} else {
    console.log('✅ No source map (good for production)');
}

// Summary
console.log('\n📊 Build Verification Summary:');
console.log('================================');

const score = [
    checks.bundleExists,
    checks.manifestValid,
    checks.bundleSize < 500,
    !checks.hasSourceMap,
    checks.codeQuality.minified,
    checks.codeQuality.noConsoleLog,
    checks.codeQuality.noDebugCode,
    checks.codeQuality.hasProperExports
].filter(Boolean).length;

const totalChecks = 8;
const percentage = Math.round((score / totalChecks) * 100);

console.log(`Build Quality Score: ${score}/${totalChecks} (${percentage}%)`);

if (percentage >= 90) {
    console.log('🎉 Excellent build quality!');
    process.exit(0);
} else if (percentage >= 75) {
    console.log('✅ Good build quality');
    process.exit(0);
} else if (percentage >= 50) {
    console.log('⚠️  Build quality needs improvement');
    process.exit(1);
} else {
    console.log('❌ Poor build quality - fix issues before release');
    process.exit(1);
}