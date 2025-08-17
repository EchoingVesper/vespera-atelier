import { Plugin } from 'obsidian';
import { ComponentTester } from './component-test';

/**
 * Plugin that runs component tests
 */
export class TestRunnerPlugin extends Plugin {
  async onload() {
    console.log('Loading component test runner plugin');
    
    // Add a ribbon icon to run tests
    this.addRibbonIcon('bug', 'Run Component Tests', async () => {
      await this.runTests();
    });
    
    // Add a command to run tests
    this.addCommand({
      id: 'run-component-tests',
      name: 'Run Component Tests',
      callback: async () => {
        await this.runTests();
      }
    });
  }
  
  /**
   * Run all component tests
   */
  async runTests() {
    console.log('Running component tests...');
    
    // Create a tester instance
    const tester = new ComponentTester(this.app);
    
    try {
      // Run all tests
      const results = await tester.runAllTests();
      
      // Display results
      this.displayResults(results);
    } catch (error) {
      console.error('Error running tests:', error);
    } finally {
      // Clean up
      tester.cleanup();
    }
  }
  
  /**
   * Display test results
   */
  private displayResults(results: string[]) {
    // Create a modal to display results
    const { Modal } = require('obsidian');
    const modal = new Modal(this.app);
    
    modal.titleEl.setText('Component Test Results');
    
    // Add results to modal
    const content = modal.contentEl;
    
    // Add summary
    const summary = content.createEl('div', { cls: 'test-summary' });
    summary.createEl('h3', { text: `${results.length} Test Results` });
    
    // Add results list
    const list = content.createEl('ul', { cls: 'test-results-list' });
    
    results.forEach(result => {
      const item = list.createEl('li');
      
      // Style based on result type
      if (result.includes('❌')) {
        item.addClass('test-failure');
      } else if (result.includes('Testing')) {
        item.addClass('test-header');
      } else {
        item.addClass('test-info');
      }
      
      item.setText(result);
    });
    
    // Add some styling
    content.createEl('style', {
      text: `
        .test-summary {
          margin-bottom: 20px;
          padding: 10px;
          background-color: var(--background-secondary);
          border-radius: 5px;
        }
        .test-results-list {
          max-height: 400px;
          overflow-y: auto;
          padding-left: 20px;
        }
        .test-header {
          font-weight: bold;
          margin-top: 10px;
        }
        .test-failure {
          color: var(--text-error);
        }
        .test-info {
          color: var(--text-normal);
        }
      `
    });
    
    // Open the modal
    modal.open();
  }
  
  onunload() {
    console.log('Unloading component test runner plugin');
  }
}