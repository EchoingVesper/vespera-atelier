# Testing Memory Limits

This document outlines the testing procedures for verifying that the memory limit checks have been implemented correctly and are working as expected.

## Manual Testing

### Test 1: Basic Memory Monitoring

1. **Setup**:
   - Open the Vespera Scriptorium plugin in development mode
   - Enable debug logging in the developer console
   - Open the browser's task manager to monitor memory usage (Chrome: More tools > Task manager)

2. **Action**:
   - Process a small document (1-2 pages)
   - Monitor the debug console for memory checkpoints

3. **Expected Result**:
   - Memory checkpoints should be logged in the console
   - Memory usage should be reasonable for the document size
   - Processing should complete successfully

### Test 2: Large Document Processing

1. **Setup**:
   - Prepare a large document (10+ pages) with complex formatting
   - Set memory thresholds artificially low for testing (e.g., warning at 256MB, critical at 512MB)
   - Enable debug logging in the developer console

2. **Action**:
   - Process the large document
   - Monitor the debug console for memory warnings and errors

3. **Expected Result**:
   - Memory warnings should appear when the warning threshold is reached
   - Processing should stop or adjust when the critical threshold is reached
   - The user should receive appropriate notifications

### Test 3: Memory Limit Enforcement

1. **Setup**:
   - Create a document with many repeated sections to force high memory usage
   - Set memory thresholds very low (e.g., warning at 128MB, critical at 256MB)

2. **Action**:
   - Process the document
   - Monitor the debug console and UI for memory limit messages

3. **Expected Result**:
   - Processing should be prevented or aborted when memory limits are reached
   - The user should receive a clear error message
   - Partial results should be saved if applicable

## Integration Testing

### Test 1: Memory Monitor Integration

1. **Setup**:
   - Ensure the MemoryMonitor class is properly integrated into the main plugin
   - Prepare documents of various sizes

2. **Action**:
   - Process documents of increasing size
   - Check memory usage logs after each processing

3. **Expected Result**:
   - Memory monitor should be initialized with the plugin
   - Memory usage should be logged for each processing
   - Memory usage should generally correlate with document size

### Test 2: Settings Integration

1. **Setup**:
   - Open the plugin settings
   - Adjust memory thresholds to different values

2. **Action**:
   - Process a document after each settings change
   - Monitor memory usage and limit enforcement

3. **Expected Result**:
   - Changes to memory thresholds should be saved correctly
   - New thresholds should be respected during processing
   - Memory monitor should use the updated settings

### Test 3: UI Feedback

1. **Setup**:
   - Process a document large enough to trigger memory warnings
   - Ensure the processing modal is visible

2. **Action**:
   - Monitor the UI for memory usage indicators
   - Check for color changes and progress bars

3. **Expected Result**:
   - Memory usage should be displayed in the UI
   - Warning and critical states should be visually indicated
   - Memory usage bar should update in real-time

## Automated Testing

If the project has a test suite, add the following tests:

### Unit Tests for MemoryMonitor

```typescript
describe('MemoryMonitor', () => {
  let memoryMonitor: MemoryMonitor;
  
  beforeEach(() => {
    // Mock settings
    const settings = {
      enableMemoryMonitoring: true,
      memoryWarningThreshold: 1536,
      memoryCriticalThreshold: 2048,
      memoryPerChunkLimit: 10
    };
    
    memoryMonitor = new MemoryMonitor(settings);
    
    // Mock the getCurrentMemoryUsage method
    memoryMonitor.getCurrentMemoryUsage = jest.fn().mockReturnValue(1024);
  });
  
  it('should add checkpoints correctly', () => {
    memoryMonitor.addCheckpoint('test-checkpoint');
    
    // Check that the checkpoint was added
    expect(memoryMonitor.getMemoryCheckpoints().has('test-checkpoint')).toBe(true);
    expect(memoryMonitor.getMemoryCheckpoints().get('test-checkpoint')).toBe(1024);
  });
  
  it('should calculate memory differences correctly', () => {
    // Mock memory values
    jest.spyOn(memoryMonitor, 'getCurrentMemoryUsage')
      .mockReturnValueOnce(1000) // For first checkpoint
      .mockReturnValueOnce(1500); // For second checkpoint
    
    // Add checkpoints
    memoryMonitor.addCheckpoint('start');
    memoryMonitor.addCheckpoint('end');
    
    // Check difference
    expect(memoryMonitor.getDifference('start', 'end')).toBe(500);
  });
  
  it('should detect when approaching memory limit', () => {
    // Set current memory to just below the warning threshold
    jest.spyOn(memoryMonitor, 'getCurrentMemoryUsage').mockReturnValue(1500);
    expect(memoryMonitor.isApproachingLimit()).toBe(false);
    
    // Set current memory to the warning threshold
    jest.spyOn(memoryMonitor, 'getCurrentMemoryUsage').mockReturnValue(1536);
    expect(memoryMonitor.isApproachingLimit()).toBe(true);
    
    // Set current memory above the warning threshold
    jest.spyOn(memoryMonitor, 'getCurrentMemoryUsage').mockReturnValue(1600);
    expect(memoryMonitor.isApproachingLimit()).toBe(true);
  });
  
  it('should detect when over memory limit', () => {
    // Set current memory to just below the critical threshold
    jest.spyOn(memoryMonitor, 'getCurrentMemoryUsage').mockReturnValue(2000);
    expect(memoryMonitor.isOverLimit()).toBe(false);
    
    // Set current memory to the critical threshold
    jest.spyOn(memoryMonitor, 'getCurrentMemoryUsage').mockReturnValue(2048);
    expect(memoryMonitor.isOverLimit()).toBe(true);
    
    // Set current memory above the critical threshold
    jest.spyOn(memoryMonitor, 'getCurrentMemoryUsage').mockReturnValue(2100);
    expect(memoryMonitor.isOverLimit()).toBe(true);
  });
  
  it('should determine if chunk processing can proceed', () => {
    // Mock current memory and chunk count
    jest.spyOn(memoryMonitor, 'getCurrentMemoryUsage').mockReturnValue(1000);
    
    // Small number of chunks should be allowed
    expect(memoryMonitor.canProcessChunks(10)).toBe(true);
    
    // Large number of chunks should be prevented
    expect(memoryMonitor.canProcessChunks(200)).toBe(false);
  });
  
  it('should clear checkpoints correctly', () => {
    // Add multiple checkpoints
    memoryMonitor.addCheckpoint('test1');
    memoryMonitor.addCheckpoint('test2');
    memoryMonitor.addCheckpoint('test3');
    
    // Clear specific checkpoints
    memoryMonitor.clearCheckpoints(['test1', 'initial']);
    
    // Check that the specified checkpoints still exist
    expect(memoryMonitor.getMemoryCheckpoints().has('test1')).toBe(true);
    expect(memoryMonitor.getMemoryCheckpoints().has('initial')).toBe(true);
    
    // Check that other checkpoints were cleared
    expect(memoryMonitor.getMemoryCheckpoints().has('test2')).toBe(false);
    expect(memoryMonitor.getMemoryCheckpoints().has('test3')).toBe(false);
  });
});
```

### Integration Tests for Processing with Memory Checks

```typescript
describe('Document Processing with Memory Monitoring', () => {
  let plugin: VesperaScriptoriumPlugin;
  let memoryMonitor: MemoryMonitor;
  
  beforeEach(() => {
    // Initialize plugin and memory monitor
    plugin = new VesperaScriptoriumPlugin();
    memoryMonitor = new MemoryMonitor(plugin.settings);
    plugin.memoryMonitor = memoryMonitor;
    
    // Mock memory monitor methods
    jest.spyOn(memoryMonitor, 'isOverLimit').mockReturnValue(false);
    jest.spyOn(memoryMonitor, 'canProcessChunks').mockReturnValue(true);
    jest.spyOn(memoryMonitor, 'canAssembleDocument').mockReturnValue(true);
    jest.spyOn(memoryMonitor, 'addCheckpoint').mockImplementation(() => 1024);
  });
  
  it('should process chunks with memory monitoring', async () => {
    // Create sample chunks
    const chunks = [
      { id: 'chunk-1', content: 'Test content 1', position: 0 },
      { id: 'chunk-2', content: 'Test content 2', position: 1 }
    ];
    
    // Process chunks
    const result = await plugin.processChunksWithLLM(chunks, {});
    
    // Check that memory monitoring methods were called
    expect(memoryMonitor.canProcessChunks).toHaveBeenCalledWith(2);
    expect(memoryMonitor.addCheckpoint).toHaveBeenCalledWith('process-start');
    expect(memoryMonitor.addCheckpoint).toHaveBeenCalledWith('process-end');
  });
  
  it('should abort processing when memory limit is reached', async () => {
    // Create sample chunks
    const chunks = [
      { id: 'chunk-1', content: 'Test content 1', position: 0 },
      { id: 'chunk-2', content: 'Test content 2', position: 1 }
    ];
    
    // Mock memory limit exceeded
    jest.spyOn(memoryMonitor, 'canProcessChunks').mockReturnValue(false);
    
    // Process chunks should throw an error
    await expect(plugin.processChunksWithLLM(chunks, {})).rejects.toThrow('Memory limit exceeded');
  });
  
  it('should abort assembly when memory limit is reached', async () => {
    // Create sample processed chunks
    const processedChunks = [
      { id: 'chunk-1', content: 'Processed content 1', position: 0 },
      { id: 'chunk-2', content: 'Processed content 2', position: 1 }
    ];
    
    // Mock memory limit exceeded during assembly
    jest.spyOn(memoryMonitor, 'canAssembleDocument').mockReturnValue(false);
    
    // Assembly should throw an error
    expect(() => plugin.assembleDocument(processedChunks, {})).toThrow('Memory limit exceeded');
  });
});
```

## Performance Testing

For a complete evaluation, perform these performance tests:

1. **Memory Leak Test**:
   - Process the same document repeatedly (10+ times)
   - Monitor memory usage after each processing
   - Verify that memory usage doesn't increase significantly over time

2. **Resource Usage Benchmarks**:
   - Process documents of various sizes (1KB, 10KB, 100KB, 1MB, 10MB)
   - Measure processing time and peak memory usage for each
   - Create a benchmark report for future reference

3. **Recovery Test**:
   - Force a memory limit error during processing
   - Verify that the plugin recovers gracefully
   - Check that partial results are saved correctly

## Documentation Updates

After testing, update the following documentation:

1. **User Guide**: Add information about memory monitoring and what to do if memory limits are reached
2. **Development Guide**: Document memory management patterns for future development
3. **Troubleshooting Guide**: Add memory-related issues and solutions

## Return to [Memory Limits](./README.md)
