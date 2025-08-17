/**
 * LLM Call Node
 * A specialized processing node for interacting with Large Language Models (LLMs).
 * @module LLMCallNode
 */

import { DocumentChunk } from './AdaptiveChunker';
import { ChunkResult } from './ProcessingOrchestrator'; // Re-using ChunkResult for consistency
import { LLMClient, CompletionOptions, LLMError, ProviderConfig } from '../LLMClient'; // Assuming LLMClient is in parent dir
import { ProcessingNode, ProcessingFunction } from './ProcessingNode';
import { v4 as uuidv4 } from 'uuid';

export interface LLMCallNodeOptions extends CompletionOptions {
  nodeId?: string; // Added to allow passing nodeId via options
  // CompletionOptions already includes 'model', 'prompt', 'temperature', etc.
  // Add any LLMCallNode-specific options if needed in the future
  // For example, specific parsing strategies for the LLM response, though
  // for now, we assume the LLM returns a string that becomes ChunkResult.content.
}

/**
 * The LLMCallNode class is a specialized ProcessingNode that handles interactions with an LLM.
 * It uses an LLMClient to send requests and receive responses.
 */
export class LLMCallNode extends ProcessingNode<DocumentChunk, string, LLMCallNodeOptions> { // Reverted T_ProcOptions to non-Partial
  private llmClient: LLMClient;

  /**
   * Creates an instance of LLMCallNode.
   * @param llmClientInstance An instance of LLMClient configured for the desired provider.
   * @param nodeOptions Options for the LLMCallNode, including LLM completion options.
   */
  constructor(
    llmClientInstance: LLMClient,
    nodeOptions: Partial<LLMCallNodeOptions> // Note: 'prompt' within options is crucial here
  ) {
    // Define the core processing function for this LLMCallNode
    const completeOptions: LLMCallNodeOptions = {
      model: nodeOptions.model || 'default-model', // Ensure 'model' is always a string
      prompt: nodeOptions.prompt || '',           // Ensure 'prompt' is always a string (or use chunk.content logic here if preferred)
      ...nodeOptions, // Spread the rest of nodeOptions, potentially overwriting defaults if specified
      nodeId: nodeOptions.nodeId, // Carry over nodeId if it's part of LLMCallNodeOptions
    };

    const llmProcessingFunction: ProcessingFunction<DocumentChunk, string, LLMCallNodeOptions> = 
      async (chunk, options) => {
        if (!options?.prompt) {
          // The 'prompt' in CompletionOptions can be a template that needs filling
          // For now, we assume a fully-formed prompt is provided or the chunk.content is the prompt.
          // A more sophisticated version would use a prompt template and chunk data.
          console.warn(`[${this.nodeId}] No explicit prompt provided in options. Using chunk content as prompt.`);
        }

        // The prompt for the LLM. If options.prompt is a template, it should be resolved before this point.
        // For simplicity, if options.prompt is not set, we use chunk.content.
        // A more robust implementation would involve a dedicated prompt builder/manager.
        const actualPrompt = options?.prompt || chunk.content;

        const completionOpts: CompletionOptions = {
          model: options?.model || 'default-model', // Ensure a model is specified
          prompt: actualPrompt,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          topP: options?.topP,
          frequencyPenalty: options?.frequencyPenalty,
          presencePenalty: options?.presencePenalty,
          stop: options?.stop,
          stream: options?.stream || false, // Default to non-streaming for simple ProcessingNode output
          timeout: options?.timeout,
        };

        try {
          // TODO: If streaming is true, this won't work directly as generateCompletion expects non-streaming.
          // For a ProcessingNode that returns a single ChunkResult, streaming needs careful handling
          // (e.g., accumulate stream into one string, or change ChunkResult structure).
          // For now, assuming non-streaming or that LLMClient handles stream accumulation if stream=true but called via generateCompletion.
          if (completionOpts.stream) {
            console.warn(`[${this.nodeId}] Streaming requested, but LLMCallNode currently returns a single aggregated response. True streaming to consumer not yet implemented in this node.`);
            // Potentially, one could implement accumulation here if LLMClient.generateCompletion doesn't do it.
          }
          return await this.llmClient.generateCompletion(actualPrompt, completionOpts);
        } catch (error) {
          const llmError = error as LLMError;
          console.error(`[${this.nodeId}] LLMClient error during generateCompletion for chunk ${chunk.id}:`, llmError.message);
          // Re-throw to be caught by the base ProcessingNode's error handling
          throw llmError; 
        }
    };

    super(llmProcessingFunction, {
      nodeId: nodeOptions.nodeId || `llm-call-node-${uuidv4()}`,
      processingFunctionOptions: completeOptions, // Pass fully formed options
    });

    this.llmClient = llmClientInstance;
  }

  // Override or add methods specific to LLMCallNode if necessary
  // For example, to update LLMClient instance or specific LLM parameters dynamically.

  public getLLMClient(): LLMClient {
    return this.llmClient;
  }
}

// Example Usage (for testing purposes):
async function testLLMCallNode() {
  // This test requires a running LLM provider (e.g., Ollama with a model like 'phi3')
  // and LLMClient.ts to be correctly set up.
  const providerConfig: ProviderConfig = {
    type: 'ollama' as any, // Assuming ProviderType.OLLAMA enum value
    endpoint: 'http://localhost:11434', // Default Ollama endpoint
    timeout: 60000,
  };

  let llmClient: LLMClient;
  try {
    llmClient = new LLMClient(providerConfig);
    await llmClient.listModels(); // Test connection and list models
    console.log('LLMClient initialized and connected.');
  } catch (e) {
    console.error('Failed to initialize LLMClient. Ensure an LLM provider (e.g., Ollama) is running and configured.', e);
    return;
  }

  const llmNode = new LLMCallNode(llmClient, {
    model: 'phi3', // Specify a model available in your Ollama instance
    temperature: 0.7,
    // The prompt will be taken from the chunk content by default if not specified here
  });

  const sampleChunkForLLM: DocumentChunk = {
    id: uuidv4(),
    content: 'Explain the concept of a Large Language Model in one sentence.',
    metadata: { id: uuidv4(), index: 0, estimatedTokens: 15, timestamp: Date.now(), sourceDocument: 'test-llm.txt', startPosition: 0, endPosition: 60, chunkNumber: 1, totalChunks: 1, custom: {} },
  };

  console.log(`[TestLLMCallNode] Sending chunk to LLMCallNode: ${sampleChunkForLLM.content}`);
  const result = await llmNode.process(sampleChunkForLLM);
  console.log('[TestLLMCallNode] LLMCallNode Result:', JSON.stringify(result, null, 2));

  // Example with a prompt in options
  const llmNodeWithPrompt = new LLMCallNode(llmClient, {
    model: 'phi3',
    prompt: 'What is the capital of France? Respond with only the city name.',
    temperature: 0.1,
  });
  const dummyChunk: DocumentChunk = { // Content of this chunk will be ignored due to prompt in options
    id: uuidv4(),
    content: 'This content is ignored.',
    metadata: { id: uuidv4(), index: 0, estimatedTokens: 5, timestamp: Date.now(), sourceDocument: 'dummy.txt', startPosition: 0, endPosition: 10, chunkNumber: 1, totalChunks: 1, custom: {} },
  };
  console.log(`[TestLLMCallNode] Sending dummy chunk to LLMCallNode with explicit prompt.`);
  const resultWithPrompt = await llmNodeWithPrompt.process(dummyChunk);
  console.log('[TestLLMCallNode] LLMCallNode Result (with prompt):', JSON.stringify(resultWithPrompt, null, 2));

}

// To run the test (ensure LLMClient.ts and its dependencies are correctly pathed and an LLM server is running):
// if (require.main === module) {
//   testLLMCallNode().catch(console.error);
// }