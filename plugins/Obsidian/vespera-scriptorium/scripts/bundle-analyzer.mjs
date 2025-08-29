#!/usr/bin/env node

/**
 * Bundle Analyzer Script
 * 
 * Analyzes the production bundle for size, dependencies, and optimization opportunities.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, '..');

console.log('📊 Analyzing bundle...');

const bundlePath = path.join(pluginRoot, 'main.js');

if (!fs.existsSync(bundlePath)) {
    console.log('❌ Bundle not found. Run `npm run build` first.');
    process.exit(1);
}

const bundleContent = fs.readFileSync(bundlePath, 'utf8');
const bundleSize = fs.statSync(bundlePath).size;

console.log('\n🔍 Bundle Analysis:');
console.log('==================');

// Size analysis
console.log(`📦 Total Size: ${Math.round(bundleSize / 1024)}KB (${bundleSize} bytes)`);

// Estimate gzipped size (rough approximation)
const estimatedGzipSize = Math.round(bundleSize * 0.3); // Typical gzip ratio
console.log(`🗜️  Estimated Gzipped: ~${Math.round(estimatedGzipSize / 1024)}KB`);

// Line and character analysis
const lines = bundleContent.split('\n').length;
const characters = bundleContent.length;
console.log(`📝 Lines: ${lines.toLocaleString()}`);
console.log(`🔤 Characters: ${characters.toLocaleString()}`);

// Function and class analysis
const functionMatches = bundleContent.match(/function\s+\w+/g) || [];
const arrowFunctionMatches = bundleContent.match(/\w+\s*=>\s*/g) || [];
const classMatches = bundleContent.match(/class\s+\w+/g) || [];

console.log(`\n🏗️  Code Structure:`);
console.log(`   Functions: ${functionMatches.length + arrowFunctionMatches.length}`);
console.log(`   Classes: ${classMatches.length}`);

// Import/require analysis
const importMatches = bundleContent.match(/require\(["'][^"']+["']\)/g) || [];
const externalDeps = new Set();

importMatches.forEach(match => {
    const dep = match.match(/require\(["']([^"']+)["']\)/)?.[1];
    if (dep && !dep.startsWith('.')) {
        externalDeps.add(dep);
    }
});

console.log(`\n📚 External Dependencies:`);
if (externalDeps.size > 0) {
    externalDeps.forEach(dep => console.log(`   - ${dep}`));
} else {
    console.log('   No external dependencies detected');
}

// Large string/object detection
const largeStringMatches = bundleContent.match(/"[^"]{100,}"/g) || [];
const largeObjectMatches = bundleContent.match(/\{[^}]{200,}\}/g) || [];

if (largeStringMatches.length > 0) {
    console.log(`\n🔍 Large Strings Found: ${largeStringMatches.length}`);
    largeStringMatches.slice(0, 3).forEach((str, i) => {
        console.log(`   ${i + 1}. ${str.substring(0, 80)}...`);
    });
}

// Code patterns analysis
const patterns = {
    'async/await': (bundleContent.match(/async\s+function|await\s+/g) || []).length,
    'Promise': (bundleContent.match(/Promise\.|new Promise/g) || []).length,
    'addEventListener': (bundleContent.match(/addEventListener/g) || []).length,
    'setTimeout/Interval': (bundleContent.match(/setTimeout|setInterval/g) || []).length,
    'console.*': (bundleContent.match(/console\.\w+/g) || []).length,
    'try/catch': (bundleContent.match(/try\s*\{|catch\s*\(/g) || []).length
};

console.log(`\n🎯 Code Patterns:`);
Object.entries(patterns).forEach(([pattern, count]) => {
    if (count > 0) {
        console.log(`   ${pattern}: ${count}`);
    }
});

// Optimization suggestions
console.log(`\n💡 Optimization Suggestions:`);

if (bundleSize > 500 * 1024) {
    console.log('   📦 Bundle is large (>500KB) - consider code splitting');
}

if (patterns['console.*'] > 5) {
    console.log(`   🐛 Many console statements (${patterns['console.*']}) - consider removing for production`);
}

if (largeStringMatches.length > 0) {
    console.log(`   📄 Found ${largeStringMatches.length} large strings - consider external files`);
}

if (patterns['setTimeout/Interval'] > 10) {
    console.log(`   ⏰ Many timers (${patterns['setTimeout/Interval']}) - verify cleanup`);
}

// Minification quality
const avgLineLength = characters / lines;
if (avgLineLength < 80) {
    console.log('   🗜️  Code may not be fully minified');
} else {
    console.log('   ✅ Code appears well minified');
}

// Summary score
let score = 100;
if (bundleSize > 500 * 1024) score -= 20;
if (patterns['console.*'] > 5) score -= 10;
if (largeStringMatches.length > 5) score -= 10;
if (avgLineLength < 80) score -= 15;

console.log(`\n🏆 Bundle Quality Score: ${score}/100`);

if (score >= 90) {
    console.log('🎉 Excellent bundle optimization!');
} else if (score >= 75) {
    console.log('✅ Good bundle quality');
} else {
    console.log('⚠️  Bundle could be optimized further');
}