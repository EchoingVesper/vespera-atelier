# Testing Error Handling

This document outlines the testing procedures for verifying that the error handling mechanisms have been implemented correctly and are working as expected.

## Manual Testing

### Test 1: Basic Error Recovery

1. **Setup**:
   - Open the Vespera Scriptorium plugin in development mode
   - Enable debug logging in the developer console
   - Prepare a test document with multiple chunks

2. **Action**:
   - Process the document and manually interrupt the processing (e.g., by closing the modal)
   - Reopen the processing modal and select the same document
   - Check if recovery is offered and works correctly

3. **Expected Result**:
   - Recovery option should be presented
   - Processing should resume from where it was interrupted
   - The final document should be complete and correct

### Test 2: Memory Error Handling

1. **Setup**:
   - Set memory thresholds artificially low (e.g., warning at 128MB, critical at 256MB)
   - Prepare a large document that will exceed the memory threshold

2. **Action**:
   - Process the document
   - Monitor memory usage and error handling

3. **Expected Result**:
   - Memory warning should be displayed when approaching the threshold
   - When the critical threshold is reached, the plugin should switch to adaptive processing
   - Processing should continue with larger chunk sizes or reduced batch sizes
   - A partial result should be saved if complete processing is not possible

### Test 3: LLM Connection Errors

1. **Setup**:
   - Disable the LLM server or configure the plugin with an incorrect endpoint
   - Prepare a document for processing

2. **Action**:
   - Process the document
   - Monitor the error handling and user notifications

3. **Expected Result**:
   - Clear error message about connection issues should be displayed
   - The plugin should retry the connection with backoff
   - User should receive actionable suggestions on how to fix the problem

### Test 4: Graceful Degradation

1. **Setup**:
   - Prepare a very large document that would normally cause memory issues
   - Enable the memory-adaptive processing option

2. **Action**:
   - Process the document
   - Monitor the adaptation and degradation mechanisms

3. **Expected Result**:
   - The plugin should adapt to memory constraints by:
     - Increasing chunk size to reduce the number of chunks
     - Reducing the batch size for parallel processing
     - Processing a subset of the document if necessary
   - The user should be informed about the adaptation
   - A partial result should be provided

## Integration Testing

### Test 1: Error Notification System

1. **Setup**:
   - Implement a test function that triggers different types of errors
   - Ensure the notification service is properly initialized

2. **Action**:
   - Trigger various error types (connection, memory, processing)
   - Check notification appearance and content

3. **Expected Result**:
   - Each error type should have a distinct notification style
   - Notifications should provide clear, actionable information
   - Persistent notifications should include options to dismiss or view details
   - Error details should be available when needed

### Test 2: Document State Management

1. **Setup**:
   - Create multiple document states in different stages (in_progress, partial, completed)
   - Save these states to the output directory

2. **Action**:
   - Load and verify each state
   - Attempt recovery from each state
   - Test state updates and saving

3. **Expected Result**:
   - States should be loaded correctly
   - Recovery should work appropriately for each state
   - State updates should be saved correctly
   - Invalid states should be handled gracefully

### Test 3: End-to-End Recovery

1. **Setup**:
   - Process a document and interrupt at different stages:
     - During chunk processing
     - During document assembly
     - After processing but before saving
   - Record the state at each interruption

2. **Action**:
   - Attempt recovery from each interruption point
   - Complete the processing
   - Verify the final result

3. **Expected Result**:
   - Recovery should be possible from all interruption points
   - The final document should be complete and correct
   - Processing metrics should be accurate

## Unit Testing

If the project has a test suite, add the following tests:

### Unit Tests for Error Handling

```typescript
describe('Error Handling', () => {
  let plugin: VesperaScriptoriumPlugin;
  
  beforeEach(() => {
    // Initialize plugin
    plugin = new VesperaScriptoriumPlugin();
    // Mock necessary methods
  });
  
  it('should catch and handle LLM errors', async () => {
    // Mock LLM client to throw an error
    jest.spyOn(plugin.llmClient, 'complete').mockRejectedValue(new Error('Connection refused'));
    
    // Mock notification service
    const mockShowError = jest.fn();
    plugin.notificationService.showError = mockShowError;
    
    // Process a chunk
    const chunk = { id: 'test-1', content: 'Test content', position: 0 };
    
    try {
      await plugin.processChunk(chunk, {});
      fail('Should have thrown an error');
    } catch (error) {
      // Verify error was caught and handled
      expect(error.message).toContain('Connection refused');
      expect(mockShowError).toHaveBeenCalled();
    }
  });
  
  it('should save partial results on error', async () => {
    // Mock some methods to simulate partial processing
    const mockSavePartialResults = jest.fn();
    plugin.savePartialResults = mockSavePartialResults;
    
    // Mock assembleDocument to throw an error
    jest.spyOn(plugin, 'assembleDocument').mockImplementation(() => {
      throw new Error('Assembly error');
    });
    
    // Process chunks
    const chunks = [
      { id: 'chunk-1', content: 'Content 1', position: 0 },
      { id: 'chunk-2', content: 'Content 2', position: 1 }
    ];
    
    // Mock processChunk to return successfully
    jest.spyOn(plugin, 'processChunk').mockResolvedValue({
      id: 'processed-1',
      content: 'Processed content',
      position: 0
    });
    
    // Process document should not throw but return null
    const result = await plugin.processChunksWithLLM(chunks, {});
    
    // Verify partial results were saved
    expect(result).toBeNull();
    expect(mockSavePartialResults).toHaveBeenCalled();
  });
  
  it('should adapt processing based on memory constraints', async () => {
    // Mock memory monitor
    plugin.memoryMonitor.isOverLimit = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    plugin.memoryMonitor.canProcessChunks = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    
    // Mock chunk document method to return different chunk counts
    const mockChunkDocument = jest.fn()
      .mockReturnValueOnce([{ id: 'chunk-1' }, { id: 'chunk-2' }, { id: 'chunk-3' }])
      .mockReturnValueOnce([{ id: 'chunk-1-large' }, { id: 'chunk-2-large' }]);
    
    plugin.chunkDocument = mockChunkDocument;
    
    // Process document adaptively
    await plugin.processDocumentAdaptively('Test document', { initialChunkSize: 1000 });
    
    // Verify adaptations occurred
    expect(mockChunkDocument).toHaveBeenCalledTimes(2);
    expect(mockChunkDocument.mock.calls[1][1]).toBeGreaterThan(1000); // Should increase chunk size
  });
  
  it('should recover from interrupted processing', async () => {
    // Mock loading a document state
    const mockState: ProcessedDocument = {
      id: 'test-doc',
      documentId: 'test.md',
      documentName: 'test.md',
      timestamp: new Date().toISOString(),
      completedChunks: ['chunk-1'],
      pendingChunks: ['chunk-2', 'chunk-3'],
      failedChunks: {},
      partialResults: { 'chunk-1': 'Processed chunk 1' },
      status: 'in_progress'
    };
    
    jest.spyOn(plugin, 'loadDocumentState').mockResolvedValue(mockState);
    
    // Mock getting original document
    jest.spyOn(plugin, 'getOriginalDocument').mockResolvedValue('Test document content');
    
    // Mock chunking the document
    jest.spyOn(plugin, 'chunkDocument').mockReturnValue([
      { id: 'chunk-1', content: 'Chunk 1', position: 0 },
      { id: 'chunk-2', content: 'Chunk 2', position: 1 },
      { id: 'chunk-3', content: 'Chunk 3', position: 2 }
    ]);
    
    // Mock processing the remaining chunks
    jest.spyOn(plugin, 'processDocumentProgressively').mockResolvedValue({
      ...mockState,
      completedChunks: ['chunk-1', 'chunk-2', 'chunk-3'],
      pendingChunks: [],
      partialResults: {
        'chunk-1': 'Processed chunk 1',
        'chunk-2': 'Processed chunk 2',
        'chunk-3': 'Processed chunk 3'
      },
      status: 'completed'
    });
    
    // Mock saving document state
    const mockSaveDocumentState = jest.fn();
    plugin.saveDocumentState = mockSaveDocumentState;
    
    // Recover the document
    const result = await plugin.recoverProcessing('test-doc', {});
    
    // Verify recovery worked
    expect(result.status).toBe('completed');
    expect(result.completedChunks).toContain('chunk-2');
    expect(result.completedChunks).toContain('chunk-3');
    expect(mockSaveDocumentState).toHaveBeenCalled();
  });
});
```

### Unit Tests for Notification Service

```typescript
describe('NotificationService', () => {
  let notificationService: NotificationService;
  
  beforeEach(() => {
    // Initialize notification service
    notificationService = NotificationService.getInstance();
    notificationService.initialize({ showDetailedErrors: true });
    
    // Mock Notice class
    global.Notice = jest.fn().mockImplementation(() => ({
      noticeEl: {
        addClass: jest.fn(),
        createDiv: jest.fn().mockReturnValue({
          innerHTML: '',
          createEl: jest.fn().mockReturnValue({
            addEventListener: jest.fn()
          })
        }),
        createEl: jest.fn().mockReturnValue({
          addEventListener: jest.fn()
        })
      },
      hide: jest.fn()
    }));
  });
  
  it('should show info notifications', () => {
    const id = notificationService.showInfo('Test info message');
    
    // Verify Notice was called
    expect(global.Notice).toHaveBeenCalled();
    
    // Verify notice was added to active notices
    expect(notificationService.getActiveNotices().has(id)).toBe(true);
  });
  
  it('should show error notifications', () => {
    const error = new Error('Test error');
    const id = notificationService.showError('Test error message', error);
    
    // Verify Notice was called
    expect(global.Notice).toHaveBeenCalled();
    
    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith('Test error message', error);
    
    // Verify notice was added to active notices
    expect(notificationService.getActiveNotices().has(id)).toBe(true);
  });
  
  it('should update existing notifications', () => {
    // Create a notification
    const id = notificationService.showInfo('Initial message');
    
    // Update it
    const updated = notificationService.updateNotice(id, 'Updated message');
    
    // Verify update was successful
    expect(updated).toBe(true);
    
    // Verify content was updated
    const notice = notificationService.getActiveNotices().get(id);
    expect(notice.noticeEl.querySelector('.notice-message').innerHTML).toBe('Updated message');
  });
  
  it('should close notifications', () => {
    // Create a notification
    const id = notificationService.showInfo('Test message');
    
    // Close it
    const closed = notificationService.closeNotice(id);
    
    // Verify close was successful
    expect(closed).toBe(true);
    
    // Verify notice was removed from active notices
    expect(notificationService.getActiveNotices().has(id)).toBe(false);
    
    // Verify hide was called
    const notice = notificationService.getActiveNotices().get(id);
    expect(notice.hide).toHaveBeenCalled();
  });
  
  it('should show progress notifications', () => {
    // Create a progress notification
    const id = notificationService.showProgress(null, 'Processing...', 50);
    
    // Verify Notice was called
    expect(global.Notice).toHaveBeenCalled();
    
    // Verify notice has progress bar
    const notice = notificationService.getActiveNotices().get(id);
    expect(notice.noticeEl.querySelector('.notice-message').innerHTML).toContain('vs-progress-bar');
    expect(notice.noticeEl.querySelector('.notice-message').innerHTML).toContain('50%');
    
    // Update progress
    notificationService.showProgress(id, 'Almost done...', 75);
    
    // Verify progress was updated
    expect(notice.noticeEl.querySelector('.notice-message').innerHTML).toContain('75%');
    expect(notice.noticeEl.querySelector('.notice-message').innerHTML).toContain('Almost done...');
  });
});
```

## Performance Testing

For a complete evaluation, perform these performance tests:

1. **Error Recovery Overhead**:
   - Measure the overhead of saving document state
   - Compare processing time with and without recovery enabled
   - Verify that the overhead is acceptable (< 5% of total processing time)

2. **Memory Adaptation Effectiveness**:
   - Process documents of increasing size
   - Measure how well the adaptive processing manages memory usage
   - Create a chart showing document size vs. peak memory usage

3. **Notification Performance**:
   - Test the performance impact of showing many notifications
   - Measure UI responsiveness during notification display
   - Verify that notifications don't cause memory leaks

## Documentation Updates

After testing, update the following documentation:

1. **User Guide**: 
   - Add information about error recovery features
   - Explain memory adaptation and what users should expect
   - Provide troubleshooting steps for common errors

2. **Developer Guide**: 
   - Document error handling patterns
   - Explain the notification service API
   - Provide guidance on adding new error types

3. **Error Codes Reference**:
   - Create a reference guide for all error codes
   - Include likely causes and solutions for each error

## Return to [Error Handling](./README.md)
