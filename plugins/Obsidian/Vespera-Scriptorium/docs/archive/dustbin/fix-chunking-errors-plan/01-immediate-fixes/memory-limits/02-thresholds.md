# Setting Memory Thresholds

## Determining Appropriate Thresholds

To prevent memory issues during document processing, we need to establish appropriate memory thresholds. These thresholds should be:

1. High enough to allow normal processing to complete
2. Low enough to catch potential memory issues before they cause crashes
3. Configurable for different environments and document sizes

## Default Thresholds

Based on typical browser memory limits and Obsidian's resource usage, we recommend the following default thresholds:

```typescript
const DEFAULT_MEMORY_THRESHOLDS = {
  WARNING_THRESHOLD: 1536,  // 1.5 GB - Show warnings
  CRITICAL_THRESHOLD: 2048, // 2 GB - Prevent operations
  PER_CHUNK_LIMIT: 10,      // 10 MB - Maximum memory increase per chunk
};
```

## Making Thresholds Configurable

Add these thresholds to the plugin's settings to make them configurable:

```typescript
// In src/settings.ts or similar
interface VesperaScriptoriumSettings {
  // Existing settings...
  
  // Memory management settings
  memoryWarningThreshold: number;
  memoryCriticalThreshold: number;
  memoryPerChunkLimit: number;
  enableMemoryMonitoring: boolean;
}

const DEFAULT_SETTINGS: VesperaScriptoriumSettings = {
  // Existing default settings...
  
  // Default memory management settings
  memoryWarningThreshold: 1536,
  memoryCriticalThreshold: 2048,
  memoryPerChunkLimit: 10,
  enableMemoryMonitoring: true,
};
```

## Settings UI

Add UI elements to the plugin's settings tab to allow users to configure these thresholds:

```typescript
// In src/settings.ts or similar
class VesperaScriptoriumSettingTab extends PluginSettingTab {
  // ...existing code...
  
  display(): void {
    // ...existing settings...
    
    // Add memory management section
    containerEl.createEl('h3', { text: 'Memory Management' });
    
    new Setting(containerEl)
      .setName('Enable Memory Monitoring')
      .setDesc('Monitor memory usage and apply limits to prevent crashes')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableMemoryMonitoring)
        .onChange(async (value) => {
          this.plugin.settings.enableMemoryMonitoring = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Warning Threshold (MB)')
      .setDesc('Show warnings when memory usage exceeds this amount')
      .addSlider(slider => slider
        .setLimits(512, 4096, 128)
        .setValue(this.plugin.settings.memoryWarningThreshold)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.memoryWarningThreshold = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Critical Threshold (MB)')
      .setDesc('Prevent operations when memory usage exceeds this amount')
      .addSlider(slider => slider
        .setLimits(1024, 8192, 128)
        .setValue(this.plugin.settings.memoryCriticalThreshold)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.memoryCriticalThreshold = value;
          await this.plugin.settings.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Per-Chunk Memory Limit (MB)')
      .setDesc('Maximum memory increase per chunk during processing')
      .addSlider(slider => slider
        .setLimits(1, 50, 1)
        .setValue(this.plugin.settings.memoryPerChunkLimit)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.memoryPerChunkLimit = value;
          await this.plugin.settings.saveSettings();
        }));
  }
}
```

## Using Settings with Memory Monitor

Update the MemoryMonitor class to use these settings:

```typescript
/**
 * Creates a new MemoryMonitor instance with settings
 * @param settings - Plugin settings containing memory thresholds
 */
constructor(settings: VesperaScriptoriumSettings) {
  this.initialMemory = this.getCurrentMemoryUsage();
  this.memoryCheckpoints = new Map<string, number>();
  
  // Use settings for thresholds
  this.enabled = settings.enableMemoryMonitoring;
  this.warningThreshold = settings.memoryWarningThreshold;
  this.criticalThreshold = settings.memoryCriticalThreshold;
  this.perChunkLimit = settings.memoryPerChunkLimit;
  
  // Store initial memory usage
  this.addCheckpoint('initial');
}
```

## Dynamic Threshold Adjustment

For advanced implementations, consider adding dynamic threshold adjustment based on document size:

```typescript
/**
 * Adjusts thresholds based on document size
 * @param documentSize - Size of document in KB
 */
adjustThresholds(documentSize: number): void {
  if (!this.enabled) return;
  
  // Base thresholds from settings
  const baseWarning = this.settings.memoryWarningThreshold;
  const baseCritical = this.settings.memoryCriticalThreshold;
  
  // For very large documents, increase thresholds slightly
  if (documentSize > 1024 * 10) { // 10MB
    this.warningThreshold = Math.min(baseWarning * 1.25, 4096); // Max 4GB
    this.criticalThreshold = Math.min(baseCritical * 1.25, 6144); // Max 6GB
  } else {
    // For normal documents, use base thresholds
    this.warningThreshold = baseWarning;
    this.criticalThreshold = baseCritical;
  }
  
  console.debug(`Adjusted memory thresholds for document size ${documentSize}KB: Warning=${this.warningThreshold}MB, Critical=${this.criticalThreshold}MB`);
}
```

## Per-Operation Limits

For more granular control, implement per-operation memory limits:

```typescript
/**
 * Checks if a specific operation can proceed based on its expected memory usage
 * @param operationName - Name of the operation
 * @param expectedMemoryIncrease - Expected memory increase in MB
 * @returns True if the operation can proceed
 */
canPerformOperation(operationName: string, expectedMemoryIncrease: number): boolean {
  if (!this.enabled) return true;
  
  const currentMemory = this.getCurrentMemoryUsage();
  const projectedMemory = currentMemory + expectedMemoryIncrease;
  
  // If projected memory exceeds critical threshold, prevent operation
  if (projectedMemory >= this.criticalThreshold) {
    console.warn(`Operation "${operationName}" would exceed memory limit (${projectedMemory}MB > ${this.criticalThreshold}MB)`);
    return false;
  }
  
  // If projected memory exceeds warning threshold, log a warning but allow operation
  if (projectedMemory >= this.warningThreshold) {
    console.warn(`Operation "${operationName}" approaching memory limit (${projectedMemory}MB > ${this.warningThreshold}MB)`);
  }
  
  return true;
}
```

## Implementation Priorities

1. **First:** Implement basic fixed thresholds without UI
2. **Second:** Add the settings UI for configuring thresholds
3. **Third:** Add dynamic threshold adjustment if needed
4. **Fourth:** Implement per-operation limits for advanced control

## Return to [Memory Limits](./README.md)
