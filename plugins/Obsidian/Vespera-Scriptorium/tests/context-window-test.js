// Simple test script to verify context window handling
const fs = require('fs');
const path = require('path');

// Import the Chunker module
const { splitTextIntoChunks } = require('../src/Chunker');

async function testContextWindowHandling() {
  console.log('Testing context window handling...');
  
  // Read the problematic file
  const filePath = path.join(__dirname, '..', 'docs', 'developers', 'architecture', 'Module-Roadmap.md');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  console.log(`File size: ${fileContent.length} characters`);
  console.log(`Estimated tokens: ${Math.ceil(fileContent.length / 4)}`);
  
  // Test with different context window sizes
  const testCases = [
    { name: 'Default settings', options: {} },
    { name: 'Small context window', options: { modelContextWindow: 2048, promptOverhead: 500 } },
    { name: 'Medium context window', options: { modelContextWindow: 4096, promptOverhead: 500 } },
    { name: 'Large context window', options: { modelContextWindow: 8192, promptOverhead: 500 } }
  ];
  
  for (const testCase of testCases) {
    console.log(`\nTest case: ${testCase.name}`);
    console.log('Options:', testCase.options);
    
    try {
      const chunks = await splitTextIntoChunks(fileContent, testCase.options);
      console.log(`Number of chunks: ${chunks.length}`);
      
      // Check the size of each chunk
      chunks.forEach((chunk, index) => {
        const estimatedTokens = Math.ceil(chunk.length / 4);
        console.log(`Chunk ${index + 1}: ${chunk.length} chars, ~${estimatedTokens} tokens`);
        
        // Verify that the chunk is not too large
        const maxContextWindow = testCase.options.modelContextWindow || 4096;
        const promptOverhead = testCase.options.promptOverhead || 500;
        const maxSafeSize = maxContextWindow - promptOverhead;
        
        if (estimatedTokens > maxSafeSize) {
          console.error(`  WARNING: Chunk ${index + 1} exceeds safe size (${estimatedTokens} > ${maxSafeSize})`);
        } else {
          console.log(`  OK: Chunk size is within safe limits (${estimatedTokens} <= ${maxSafeSize})`);
        }
      });
    } catch (error) {
      console.error(`Error processing chunks: ${error.message}`);
    }
  }
}

// Run the test
testContextWindowHandling().catch(console.error);