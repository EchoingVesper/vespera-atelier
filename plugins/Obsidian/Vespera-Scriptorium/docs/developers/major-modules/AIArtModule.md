# AI Art Module - Architecture Plan

## Overview

The AI Art Module for Vespera Scriptorium provides integrated AI image generation capabilities, focusing on character creation, character sheet generation, and LoRA dataset preparation. It uses local Stable Diffusion models with advanced prompt construction and directional tag management.

## Core Features

- **Character Generation**: Create character images with smart tag management and angle-based visibility rules
- **Character Sheet Creation**: Generate complete character sheets with front/side/back views and facial expression matrices
- **LoRA Dataset Generation**: Prepare training datasets for character LoRA creation with appropriate metadata
- **Smart Prompt Building**: Advanced system for conditional tag inclusion/exclusion based on composition rules
- **Integration with Notes**: Extract character details from notes and attach generated images with metadata
- **Local Model Support**: Use existing model installations with folder structure compatibility

## Architecture

### Module Structure

```
/src
  /ai-art
    index.ts                      # Main export file
    AIArtManager.ts               # Central manager for the module
    /backend
      AIBackendManager.ts         # Manages different backends
      PythonBackend.ts            # Python subprocess implementation
      ComfyAPIBackend.ts          # ComfyUI API integration (future)
      WebUIBackend.ts             # A1111/SD.Next integration (future)
    /core
      ModelManager.ts             # Model discovery and management
      PromptBuilder.ts            # Smart prompt construction
      ImageProcessor.ts           # Image manipulation and post-processing
      WorkflowManager.ts          # Workflow definition and execution
    /generators
      CharacterGenerator.ts       # Character image generation
      CharacterSheetGenerator.ts  # Full character sheet generation
      LoRADatasetGenerator.ts     # Dataset creation for LoRA training
    /ui
      AIArtPanel.ts               # Main panel UI
      OptionsSidebar.ts           # Options UI components
      PresetManager.ts            # UI for managing saved presets
      CommandRegistry.ts          # Command palette integration
    /utils
      DirectionalTagging.ts       # Angle-based tag management
      PromptRandomization.ts      # Tag randomization utilities
      ImageUtils.ts               # Image manipulation helpers
    /types
      index.ts                    # Type definitions
    /settings
      AIArtSettings.ts            # Settings management
```

### Component Descriptions

#### Backend System

The backend system handles the actual image generation process through different implementation methods:

1. **PythonBackend**: Primary implementation using Python subprocess for direct control
   - Communicates with a Python script that uses diffusers, transformers, and controlnet_aux
   - Handles model loading, unloading, and pipeline configuration
   - Manages generation parameters and returns processed images

2. **Future Backend Options**:
   - ComfyAPIBackend: For integration with running ComfyUI instances
   - WebUIBackend: For integration with A1111/SD.Next installations

#### Core Components

1. **ModelManager**:
   - Discovers models in configured directories (checkpoint models, LoRAs, embeddings, VAEs)
   - Handles model metadata caching and organization
   - Provides configuration for model loading priorities and combinations

2. **PromptBuilder**:
   - Implements an advanced system for prompt construction with conditional logic
   - Handles tag categorization (body parts, clothing, accessories, scenery, etc.)
   - Applies directional visibility rules based on camera angle
   - Manages tag weighting and formatting
   - Supports randomization for training set variation

3. **ImageProcessor**:
   - Handles image transformations (resize, crop, composite)
   - Implements upscaling and face improvement workflows
   - Prepares control images for ControlNet
   - Creates image grids and character sheets

4. **WorkflowManager**:
   - Defines standard workflows (txt2img, img2img, controlnet)
   - Handles multi-step generation processes
   - Manages error handling and retries

#### Generators

1. **CharacterGenerator**:
   - Creates individual character images based on descriptions
   - Implements toggle options for NSFW content
   - Handles character + scene compositions
   - Supports detailed customization options

2. **CharacterSheetGenerator**:
   - Implements comprehensive character sheet generation
   - Creates standardized views (front, side, back, face grid, characterization pose)
   - Handles consistent character representation across poses
   - Supports different outfit variants

3. **LoRADatasetGenerator**:
   - Creates varied training images from seed images
   - Generates appropriate training metadata for LoRA creation
   - Implements dataset organization for training
   - Produces dataset summaries and recommendations

#### UI Components

1. **AIArtPanel**:
   - Main panel interface with tabs for different generation modes
   - Image preview area with zoom and pan controls
   - Progress indicators for generation tasks
   - Result gallery with metadata viewing

2. **OptionsSidebar**:
   - Configurable options panel with different sections
   - Collapsible groups for organization
   - Preset management interface
   - Quick-access toggles for common settings

3. **PresetManager**:
   - Save/load generation presets
   - Import/export preset configurations
   - Character preset storage
   - Default settings management

#### Utilities

1. **DirectionalTagging**:
   - Rules engine for tag visibility based on camera angles
   - Management of asymmetrical character features
   - Implementation of composition guidelines
   - Framing and perspective adjustments

2. **PromptRandomization**:
   - Controlled randomization for training set variation
   - Weighted random selection from tag categories
   - Scenario and setting randomization
   - Pose variation management

3. **ImageUtils**:
   - Common image manipulation utilities
   - Format conversion and optimization
   - Metadata embedding and extraction
   - File naming and organization

## Technical Implementation

### Backend Implementation (Python Subprocess)

The primary backend will use a Python subprocess approach:

```typescript
// PythonBackend.ts structure

import { ChildProcess, spawn } from 'child_process';
import { AIBackendInterface } from '../types';

export class PythonBackend implements AIBackendInterface {
  private process: ChildProcess | null = null;
  private pythonPath: string;
  private scriptPath: string;
  
  constructor(pythonPath: string, scriptPath: string) {
    this.pythonPath = pythonPath;
    this.scriptPath = scriptPath;
  }
  
  async initialize(): Promise<boolean> {
    // Start Python process with environment setup
    this.process = spawn(this.pythonPath, [this.scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Setup IPC communication with Python process
    // Return success/failure
    return true;
  }
  
  async generateImage(params: GenerationParams): Promise<ImageResult> {
    // Send generation parameters to Python
    // Wait for and process results
    // Return image data or path
  }
  
  // Other methods for model loading, etc.
}
```

The corresponding Python script would implement:

```python
# sd_backend.py conceptual structure

import sys
import json
import torch
from diffusers import StableDiffusionPipeline, ControlNetModel, DPMSolverMultistepScheduler
from PIL import Image
import base64
from io import BytesIO

# Global state
loaded_models = {}
current_pipeline = None

def load_checkpoint(model_path, vae_path=None):
    # Load model with specified options
    # Configure pipeline
    # Return success/error message
    
def generate_image(prompt, negative_prompt, steps, cfg, width, height, seed, etc):
    # Run generation pipeline with parameters
    # Return base64 encoded image data

def run_upscale(image_data, upscaler, scale_factor):
    # Upscale the provided image
    # Return upscaled image

def main():
    # Setup communication channel (stdio)
    while True:
        # Read command from stdin
        command = json.loads(sys.stdin.readline())
        
        # Process command
        if command["type"] == "load_model":
            result = load_checkpoint(command["model_path"], command.get("vae_path"))
        elif command["type"] == "generate":
            result = generate_image(**command["params"])
        elif command["type"] == "upscale":
            result = run_upscale(**command["params"])
        
        # Send result back
        sys.stdout.write(json.dumps(result) + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    main()
```

### Prompt Builder System

The PromptBuilder is a critical component for character generation:

```typescript
// PromptBuilder.ts conceptual structure

export class PromptBuilder {
  private tags: Map<string, Tag[]> = new Map();
  private conditionalRules: ConditionalRule[] = [];
  private directionalRules: DirectionalRule[] = [];
  
  // Add tags to specific categories
  addTags(category: string, tags: Tag[]): void {
    const existing = this.tags.get(category) || [];
    this.tags.set(category, [...existing, ...tags]);
  }
  
  // Add conditional rules (e.g., "if X tag is present, remove Y tags")
  addConditionalRule(rule: ConditionalRule): void {
    this.conditionalRules.push(rule);
  }
  
  // Add directional rules (e.g., "if angle=back, remove face features")
  addDirectionalRule(rule: DirectionalRule): void {
    this.directionalRules.push(rule);
  }
  
  // Build the final prompt with all rules applied
  buildPrompt(options: PromptOptions): GenerationPrompt {
    let allTags: Tag[] = [];
    
    // Collect all applicable tags
    for (const [category, tags] of this.tags.entries()) {
      if (shouldIncludeCategory(category, options)) {
        allTags = [...allTags, ...tags];
      }
    }
    
    // Apply conditional rules
    allTags = this.applyConditionalRules(allTags, options);
    
    // Apply directional rules based on camera angle
    if (options.angle) {
      allTags = this.applyDirectionalRules(allTags, options.angle);
    }
    
    // Apply weighting and formatting
    const formattedTags = allTags.map(tag => formatTag(tag));
    
    return {
      positive: formattedTags.join(", "),
      negative: this.buildNegativePrompt(options)
    };
  }
  
  // Helper methods...
}
```

### Character Sheet Generator Implementation

```typescript
// CharacterSheetGenerator.ts concept

export class CharacterSheetGenerator {
  private promptBuilder: PromptBuilder;
  private backend: AIBackendInterface;
  private controlNetManager: ControlNetManager;
  
  constructor(backend: AIBackendInterface) {
    this.backend = backend;
    this.promptBuilder = new PromptBuilder();
    this.controlNetManager = new ControlNetManager();
  }
  
  async generateCharacterSheet(character: Character, options: SheetOptions): Promise<CharacterSheetResult> {
    // Phase 1: Generate basic model sheet
    const bodyViews = await this.generateBodyViews(character);
    const faceViews = await this.generateFaceViews(character);
    const characterizationPose = await this.generateCharacterizationPose(character);
    
    // Phase 2: Generate variant images for LoRA training
    const trainingImages = await this.generateTrainingVariants(
      [...bodyViews, ...faceViews, characterizationPose],
      character,
      options.trainingVariantCount
    );
    
    // Generate training metadata
    const trainingMetadata = this.generateTrainingMetadata(character, trainingImages);
    
    return {
      modelSheet: {
        bodyViews,
        faceViews,
        characterizationPose
      },
      trainingData: {
        images: trainingImages,
        metadata: trainingMetadata
      }
    };
  }
  
  // Helper methods for specific generations...
}
```

### Obsidian Integration

```typescript
// AIArtPanel.ts structure for Obsidian integration

export class AIArtPanel extends ItemView {
  private currentMode: PanelMode = PanelMode.SimpleGeneration;
  private generationOptions: HTMLElement;
  private previewContainer: HTMLElement;
  private statusBar: HTMLElement;
  
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }
  
  getViewType(): string {
    return "vespera-ai-art-panel";
  }
  
  getDisplayText(): string {
    return "AI Art Studio";
  }
  
  async onOpen(): Promise<void> {
    this.constructUI();
    this.registerEventListeners();
  }
  
  private constructUI(): void {
    // Main container
    const container = this.containerEl.createDiv("vespera-ai-art-container");
    
    // Mode selector tabs
    const tabs = container.createDiv("vespera-ai-art-tabs");
    this.createTabs(tabs);
    
    // Options panel
    this.generationOptions = container.createDiv("vespera-generation-options");
    this.constructOptionsUI();
    
    // Preview area
    this.previewContainer = container.createDiv("vespera-preview-container");
    
    // Status bar
    this.statusBar = container.createDiv("vespera-status-bar");
  }
  
  // Other UI methods...
}
```

### Note Integration

For integrating with existing notes:

```typescript
// NoteIntegration.ts concept

export class NoteIntegration {
  private app: App;
  private promptBuilder: PromptBuilder;
  
  constructor(app: App, promptBuilder: PromptBuilder) {
    this.app = app;
    this.promptBuilder = promptBuilder;
  }
  
  async extractCharacterFromNote(notePath: string): Promise<Character | null> {
    // Get the note content
    const file = this.app.vault.getAbstractFileByPath(notePath);
    if (!(file instanceof TFile)) return null;
    
    const content = await this.app.vault.cachedRead(file);
    
    // Parse character information from frontmatter and/or content
    const character = this.parseCharacterInfo(content);
    
    return character;
  }
  
  async attachImageToNote(notePath: string, imagePath: string, metadata: ImageMetadata): Promise<void> {
    // Get the note
    const file = this.app.vault.getAbstractFileByPath(notePath);
    if (!(file instanceof TFile)) return;
    
    // Read current content
    const content = await this.app.vault.cachedRead(file);
    
    // Create link with metadata (as comments or frontmatter)
    const imageLink = this.createImageLink(imagePath, metadata);
    
    // Determine where to insert the image
    const newContent = this.insertImageLink(content, imageLink);
    
    // Save the modified note
    await this.app.vault.modify(file, newContent);
  }
  
  // Helper methods...
}
```

## Recommended Libraries

### JavaScript/TypeScript Libraries:
- **sharp**: Fast image processing (resize, format conversion)
- **jimp**: Image manipulation and compositing
- **@tensorflow/tfjs-node**: (Optional) For running some simple models in Node
- **child_process**: Built into Node.js for Python subprocess management

### Python Libraries (for backend):
- **diffusers**: HuggingFace's library for Stable Diffusion pipelines
- **torch**: PyTorch for neural network operations
- **transformers**: For text encoders
- **controlnet_aux**: For pose detection and ControlNet support
- **pillow**: For image manipulation
- **numpy**: For numerical operations
- **safetensors**: For loading model weights

## Development Roadmap

### Phase 1: Basic Infrastructure
1. Python subprocess backend setup
2. Basic model loading and discovery
3. Simple image generation UI
4. Settings for model paths

### Phase 2: Prompt Engineering
1. Implement PromptBuilder with conditionals
2. Directional tag rules
3. Randomization features
4. Prompt preset management

### Phase 3: Character Generation
1. Basic character generation with options
2. Image-to-image workflow
3. ControlNet integration
4. High-quality upscaling

### Phase 4: Character Sheet Generator
1. Multi-view generation
2. Face grid generation
3. Pose-controlled generation
4. Sheet layout and export

### Phase 5: LoRA Dataset Creation
1. Training variant generation
2. Metadata file creation
3. Dataset organization
4. Training command preparation

### Phase 6: Integration & Polish
1. Note extraction integration
2. Image attachment to notes
3. UI polish and keyboard shortcuts
4. Performance optimizations

## Implementation Notes

- **Memory Management**: Careful memory management is critical for 8GB VRAM systems.
- **Efficiency**: Use efficient upscaling methods similar to ComfyUI's Efficiency Nodes.
- **Error Handling**: Implement robust error handling for long-running processes.
- **Progress Visualization**: Provide clear progress indicators for multi-step generation.
- **Preset System**: Implement a flexible preset system for quick switching between configurations.
- **Keyboard Navigation**: Prioritize keyboard shortcuts for power users.
- **Extensibility**: Design the architecture to allow future extensions for API-based services.

## Integration with Existing Vespera Architecture

The AI Art Module follows the existing Vespera Scriptorium architecture patterns:
- Leverages the FileManager for asset storage and organization
- Uses the SettingsManager for configuration
- Integrates with the UI module's design patterns
- Provides command registrations for the command palette
- Uses similar error handling and logging strategies

The module will be registered in the main plugin with appropriate initialization and cleanup methods.
