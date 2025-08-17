import {
  PromptTemplate,
  ChatPromptTemplate,
  FewShotPromptTemplate,
  // Example selectors can be added if/when few-shot prompting is implemented
  // SemanticSimilarityExampleSelector,
} from "@langchain/core/prompts";
import {
  BaseMessagePromptTemplateLike,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { BaseOutputParser } from "@langchain/core/output_parsers";
import { DocumentChunk } from "./robust-processing/AdaptiveChunker"; // Assuming DocumentChunk is defined here

export interface PromptBuilderInput {
  documentChunk?: DocumentChunk;
  userInstructions?: string;
  metadata?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // For additional dynamic variables
}

export interface FormattedPrompt {
  prompt: string | BaseMessagePromptTemplateLike[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputVariables: Record<string, any>;
}

export interface PromptConfig {
  id: string;
  name: string;
  description: string;
  templateType: "string" | "chat";
  templateString?: string; // For simple string prompts
  messages?: { role: "system" | "user" | "ai"; content: string }[]; // For chat prompts
  inputVariables: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fewShotExamples?: Record<string, any>[]; // Optional for few-shot
  outputParser?: BaseOutputParser<any>; // Optional, to include format instructions
}

export class PromptBuilder {
  private promptConfigs: Map<string, PromptConfig> = new Map();

  constructor(initialConfigs?: PromptConfig[]) {
    if (initialConfigs) {
      initialConfigs.forEach(config => this.registerPromptConfig(config));
    }
  }

  public registerPromptConfig(config: PromptConfig): void {
    if (this.promptConfigs.has(config.id)) {
      console.warn(`Prompt config with ID '${config.id}' already exists. Overwriting.`);
    }
    this.promptConfigs.set(config.id, config);
  }

  public getPromptConfig(id: string): PromptConfig | undefined {
    return this.promptConfigs.get(id);
  }

  public async buildPrompt(
    configId: string,
    input: PromptBuilderInput
  ): Promise<FormattedPrompt> {
    const config = this.promptConfigs.get(configId);
    if (!config) {
      throw new Error(`Prompt config with ID '${configId}' not found.`);
    }

    const templateVariables: Record<string, any> = {};
    for (const key of config.inputVariables) {
      if (input[key] !== undefined) {
        templateVariables[key] = input[key];
      } else if (key === "document_chunk" && input.documentChunk) { // Legacy mapping
        templateVariables[key] = input.documentChunk.content;
        templateVariables["chunk_metadata"] = input.documentChunk.metadata;
      } else {
        // Optionally, throw an error or use a default value if a required variable is missing
        console.warn(`Input variable '${key}' not provided for prompt '${configId}'.`);
        // templateVariables[key] = ""; // Or some default
      }
    }
    
    // Add format instructions if an output parser is defined
    if (config.outputParser) {
      try {
        templateVariables["format_instructions"] = await config.outputParser.getFormatInstructions();
      } catch (e) {
        console.warn(`Could not get format instructions for parser in prompt '${configId}': ${(e as Error).message}`);
        templateVariables["format_instructions"] = ""; // Default if error
      }
    } else if (config.inputVariables.includes("format_instructions") && !templateVariables["format_instructions"]) {
        // If format_instructions is an expected variable but no parser is set, provide a default or warning
        console.warn(`Prompt '${configId}' expects 'format_instructions' but no outputParser is configured.`);
        templateVariables["format_instructions"] = "Please format your response clearly.";
    }


    if (config.templateType === "chat") {
      if (!config.messages) {
        throw new Error(`Chat prompt config '${configId}' is missing messages.`);
      }
      const chatMessages: BaseMessagePromptTemplateLike[] = config.messages.map(
        (msg) => {
          if (msg.role === "system") {
            return SystemMessagePromptTemplate.fromTemplate(msg.content);
          } else if (msg.role === "user") {
            return HumanMessagePromptTemplate.fromTemplate(msg.content);
          }
          // Add AI message support if needed
          throw new Error(`Unsupported message role: ${msg.role}`);
        }
      );
      const chatPrompt = ChatPromptTemplate.fromMessages(chatMessages);
      const formattedString = await chatPrompt.format(templateVariables);
      return { prompt: formattedString, inputVariables: templateVariables };

    } else { // "string"
      if (!config.templateString) {
        throw new Error(`String prompt config '${configId}' is missing templateString.`);
      }
      
      let promptTemplate: PromptTemplate | FewShotPromptTemplate;

      if (config.fewShotExamples && config.fewShotExamples.length > 0) {
        // Basic example prompt, assuming all examples share the same keys as the main template
        const exampleKeys = Object.keys(config.fewShotExamples[0]);
        const examplePrompt = new PromptTemplate({
          template: exampleKeys.map(key => `${key}: {${key}}`).join("\n") + "\n", // Simple format
          inputVariables: exampleKeys,
        });

        promptTemplate = new FewShotPromptTemplate({
          examples: config.fewShotExamples,
          examplePrompt: examplePrompt,
          prefix: config.templateString, // Main prompt template acts as prefix
          suffix: "", // Suffix can be added if needed
          inputVariables: config.inputVariables.filter(v => !exampleKeys.includes(v)), // Variables not in examples
          exampleSeparator: "\n\n",
        });
      } else {
        promptTemplate = new PromptTemplate({
          template: config.templateString,
          inputVariables: config.inputVariables,
        });
      }
      // Langchain's format or formatPromptValue handles the actual substitution.
      // For now, we return the template string and variables, LLMClient will format.
      // However, to provide a concrete string for non-Langchain direct use or logging:
      const formattedString = await promptTemplate.format(templateVariables);
      return { prompt: formattedString, inputVariables: templateVariables };
    }
  }

  // Example of a more complex build method incorporating few-shot, partials, etc.
  // This would require more sophisticated config and logic.
}

// Factory function
export function createPromptBuilder(initialConfigs?: PromptConfig[]): PromptBuilder {
  return new PromptBuilder(initialConfigs);
}