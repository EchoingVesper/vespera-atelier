// src/workflow-orchestrator/WorkflowDefinitionLoader.ts
import { load as loadYaml } from 'js-yaml';
import { z } from 'zod';
import {
  WorkflowDefinition,
  WorkflowStage,
  // StageErrorHandling, // Defined locally by Zod schema
  // StageInputs,        // Defined locally by Zod schema
  // StageParams,        // Defined locally by Zod schema
  // StageOutputs,       // Defined locally by Zod schema
} from './types';

// Custom Error Classes
export class WorkflowDefinitionParseError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'WorkflowDefinitionParseError';
  }
}

export class UnsupportedFileFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFileFormatError';
  }
}

export class WorkflowDefinitionValidationError extends Error {
  constructor(message: string, public validationErrors?: z.ZodIssue[]) {
    super(message);
    this.name = 'WorkflowDefinitionValidationError';
  }
}

// Zod Schemas for Validation
const StageInputsSchema = z.record(z.any()).optional();
const StageParamsSchema = z.record(z.any()).optional();
const StageOutputsSchema = z.record(z.string()).optional(); // Values are JSONPath strings

const StageErrorHandlingSchema = z.object({
  retries: z.number().int().min(0).optional(),
  retryDelayMs: z.number().int().min(0).optional(),
  onFailure: z.enum(['stop', 'continue', 'jumpToStage']).optional(),
  jumpToStageId: z.string().optional(),
}).refine(data => {
  if (data.onFailure === 'jumpToStage') {
    return typeof data.jumpToStageId === 'string' && data.jumpToStageId.trim() !== '';
  }
  return true;
}, {
  message: "jumpToStageId is required when onFailure is 'jumpToStage'",
  path: ['jumpToStageId'],
});

const WorkflowStageSchema: z.ZodType<WorkflowStage> = z.object({
  id: z.string().min(1),
  name: z.string(), // name is required in WorkflowStage type
  type: z.string().min(1), // Renamed from nodeType
  description: z.string().optional(),
  config: StageParamsSchema, // Renamed from params, StageParamsSchema is z.record(z.any()).optional()
  inputs: z.record(z.string()).optional(), // Aligned with types.ts WorkflowStage
  outputs: z.record(z.string()).optional(), // Aligned with types.ts WorkflowStage
  nextStages: z.union([
    z.array(z.string()),
    z.array(z.object({ condition: z.string(), stageId: z.string() }))
  ]).optional(),
  onError: StageErrorHandlingSchema.optional(),
  condition: z.string().optional(),
  isParallel: z.boolean().optional(),
});

const WorkflowDefinitionSchema: z.ZodType<WorkflowDefinition> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string(), // Made non-optional to match WorkflowDefinition type
  startStageId: z.string().min(1),
  initialContext: z.record(z.any()).optional(),
  stages: z.record(WorkflowStageSchema),
});


export interface IWorkflowDefinitionLoader {
  loadDefinition(filePath: string, fileContent: string): Promise<WorkflowDefinition>;
  getDefinition(id: string): WorkflowDefinition | undefined;
  getAllDefinitions(): WorkflowDefinition[];
  // Optional: A way to register an already parsed/validated definition object directly
  registerDefinitionObject(definition: WorkflowDefinition): void;
}

// Ensure DEMO_WORKFLOW_V1 explicitly matches the WorkflowDefinition type
const DEMO_WORKFLOW_V1: WorkflowDefinition = {
  id: 'demo-workflow-v1',
  name: 'Demonstration Workflow',
  version: '1.0.0', // Ensure version is present
  description: 'A simple workflow to demonstrate the structure.',
  startStageId: 'stage-1-read-file',
  initialContext: { // This is optional in the type, but we define it for the demo
    inputPath: '/input/data.txt',
    outputPath: '/output/results.md',
  },
  stages: {
    'stage-1-read-file': {
      id: 'stage-1-read-file',
      name: 'Read Input File',
      type: 'ReadFileNode',
      description: 'Reads the initial input file.',
      config: {}, // Add empty config if not used, as it's optional in type but good practice for schema
      inputs: {
        filePath: '{{initialContext.inputPath}}',
      },
      outputs: {
        fileContent: 'stages.stage-1-read-file.output.content',
      },
      nextStages: ['stage-2-process-content'],
    },
    'stage-2-process-content': {
      id: 'stage-2-process-content',
      name: 'Process Content',
      type: 'SimpleTaskNode',
      description: 'Processes the content (e.g., summarize).',
      config: {
        taskType: 'summarize',
      },
      inputs: {
        textContent: '{{stages.stage-1-read-file.output.content}}',
      },
      outputs: {
        summary: 'stages.stage-2-process-content.output.summary',
      },
      nextStages: ['stage-3-write-output'],
    },
    'stage-3-write-output': {
      id: 'stage-3-write-output',
      name: 'Write Output File',
      type: 'WriteFileNode',
      description: 'Writes the summary to an output file.',
      config: {}, // Add empty config
      inputs: {
        filePath: '{{initialContext.outputPath}}',
        content: '{{stages.stage-2-process-content.output.summary}}',
      },
      // No nextStages implies end of workflow for this path
    },
  },
};


export class WorkflowDefinitionLoader implements IWorkflowDefinitionLoader {
  private definitions: Map<string, WorkflowDefinition> = new Map();

  constructor() {
    // Initialize with a default demo workflow
    try {
      this.registerDefinitionObject(DEMO_WORKFLOW_V1, 'constructor-default');
    } catch (error) {
      console.warn("Failed to load default demo workflow during constructor:", error);
    }
  }

  public async loadDefinition(filePath: string, fileContent: string): Promise<WorkflowDefinition> {
    console.log(`WorkflowDefinitionLoader: Loading definition from ${filePath}`);
    let parsedData: unknown;

    try {
      if (typeof filePath !== 'string') {
        throw new TypeError('filePath must be a string.');
      }
      if (filePath.endsWith('.json')) {
        parsedData = JSON.parse(fileContent);
      } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        parsedData = loadYaml(fileContent);
      } else {
        throw new UnsupportedFileFormatError(`Unsupported file format for workflow definition: ${filePath}. Supported formats are .json, .yaml, .yml.`);
      }
    } catch (error: any) {
      throw new WorkflowDefinitionParseError(`Failed to parse workflow definition from ${filePath}: ${error.message}`, error);
    }

    if (parsedData === null || typeof parsedData !== 'object') {
        throw new WorkflowDefinitionParseError(`Parsed definition is not a valid object for ${filePath}.`);
    }
    
    const definition = this.validateAndTypeWorkflowDefinition(parsedData, filePath);
    this.registerDefinitionObject(definition, filePath); // Store it
    return definition;
  }

  /**
   * Registers a pre-validated WorkflowDefinition object.
   * Useful for internal definitions or testing.
   * @param definition The WorkflowDefinition object.
   * @param source A string indicating the source of this definition (e.g., file path, 'default', 'test').
   */
  public registerDefinitionObject(definition: WorkflowDefinition, source: string = 'object'): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Workflow definition with ID '${definition.id}' already exists (loaded from ${source}). Cannot overwrite.`);
    }
    // Ensure the object itself is valid before storing, even if pre-validated elsewhere.
    // This is a light re-validation or trust if it comes from a validated source.
    const validationResult = WorkflowDefinitionSchema.safeParse(definition);
    if (!validationResult.success) {
        throw new WorkflowDefinitionValidationError(
        `Provided workflow definition object (ID: ${definition.id}, source: ${source}) failed validation.`,
        validationResult.error.issues
      );
    }
    this.definitions.set(validationResult.data.id, validationResult.data);
    console.log(`WorkflowDefinitionLoader: Registered definition ID '${validationResult.data.id}' from ${source}`);
  }


  private validateAndTypeWorkflowDefinition(definition: unknown, filePathOrSource: string): WorkflowDefinition {
    const validationResult = WorkflowDefinitionSchema.safeParse(definition);

    if (!validationResult.success) {
      console.error(`WorkflowDefinitionLoader: Validation failed for ${filePathOrSource}`, validationResult.error.issues);
      throw new WorkflowDefinitionValidationError(
        `Workflow definition from ${filePathOrSource} failed validation.`,
        validationResult.error.issues
      );
    }
    
    console.log(`WorkflowDefinitionLoader: Successfully validated definition from ${filePathOrSource}`);
    return validationResult.data;
  }

  public getDefinition(id: string): WorkflowDefinition | undefined {
    return this.definitions.get(id);
  }

  public getAllDefinitions(): WorkflowDefinition[] {
    return Array.from(this.definitions.values());
  }
}