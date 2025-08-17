# PromptTemplateManager Module

**Role in Processing Pipeline:** Provides a centralized service for managing and applying prompt templates used by various processing nodes, particularly the LLMClient node.

## Overview

Within the n8n-inspired processing pipeline architecture, the PromptTemplateManager module functions as a shared utility responsible for the creation, storage, retrieval, and application of prompt templates. It is not a processing node itself, but rather a crucial dependency for nodes that interact with Large Language Models (LLMs) and require structured prompts. It ensures consistency and reusability of prompts across different pipeline stages and workflows.

## Pipeline Integration

The PromptTemplateManager is integrated into the pipeline architecture as a service accessible by processing nodes that need to generate prompts for LLMs. The primary consumer is the LLMClient node. When an LLMClient node is processing a piece of data (like a chunk) and needs to make an LLM call, it interacts with the PromptTemplateManager to retrieve a specific template based on the pipeline's configuration for that node and task. The manager then applies the input data to the template, generating the final prompt string that the LLMClient node sends to the LLM backend.

This centralized approach to template management allows the pipeline orchestrator or configuration to easily define and modify the prompts used at different stages without requiring changes within the processing nodes themselves.

## Template Management and Application

The module provides the necessary functionality for managing prompt templates within the pipeline context:

- **Registration**: Allows for the registration of new custom templates alongside the default ones.
- **Retrieval**: Enables processing nodes to retrieve registered templates by their ID.
- **Application**: Provides methods to apply input data (variables) to a retrieved template, generating the final prompt string.

## Template Syntax

The templates managed by this module utilize a flexible syntax for dynamic content generation:

### Variable Substitution

Variables within templates are denoted by double curly braces (`{{variable}}`). The PromptTemplateManager replaces these placeholders with actual data provided by the processing node.

```
Hello, {{name}}!
```

### Conditional Sections

Conditional sections allow parts of the template to be included or excluded based on the truthiness of provided variables, using `{{#if variable}}...{{else}}...{{/if}}` syntax. This enables dynamic adjustment of the prompt based on the input data or pipeline context.

```
{{#if variable}}Content if variable is truthy{{else}}Content if variable is falsy{{/if}}
```

Conditional sections can be nested to create more complex prompt logic.

## Default Templates

The PromptTemplateManager comes with several default templates:

### General Summary

**ID:** `general_summary`

A general-purpose summary template for most content.

**Variables:**
- `content`: The text to summarize
- `context` (optional): Additional context for the summarization
- `max_length` (optional): Maximum length of the summary
- `focus_points` (optional): Specific aspects to focus on

### Detailed Summary

**ID:** `detailed_summary`

A detailed summary template that preserves more information from the original content.

**Variables:**
- `content`: The text to summarize
- `context` (optional): Additional context for the summarization
- `max_length` (optional): Maximum length of the summary
- `structure` (optional): How to structure the summary
- `focus_points` (optional): Specific aspects to focus on

### Key Points Extraction

**ID:** `key_points`

Extracts key points from content in a bullet-point format.

**Variables:**
- `content`: The text to analyze
- `context` (optional): Additional context for the analysis
- `max_points` (optional): Maximum number of points to extract
- `focus_areas` (optional): Specific areas to focus on

### Question Answering

**ID:** `question_answering`

Answers specific questions based on the provided content.

**Variables:**
- `content`: The text to analyze
- `question`: The question to answer
- `context` (optional): Additional context for answering
- `answer_style` (optional): Style of the answer (brief, detailed, etc.)
- `max_length` (optional): Maximum length of the answer

### Academic Summary

**ID:** `academic_summary`

Summarizes academic content with focus on methodology and findings.

**Variables:**
- `content`: The text to summarize
- `context` (optional): Additional context for the summarization
- `max_length` (optional): Maximum length of the summary
- `citation_style` (optional): Citation style to use

## Usage by Pipeline Nodes

Processing nodes, particularly the LLMClient node, interact with the PromptTemplateManager programmatically to obtain and apply templates. The pipeline configuration dictates which template ID a specific node should use for its task. The node then retrieves the template from the manager and provides the necessary data variables (e.g., the text chunk, context, desired output format) to generate the final prompt.

## Usage

### Basic Usage

```typescript
import { createPromptTemplateManager } from '../src/templates';
import { PromptTemplate } from '../src/LLMClient';

// Create a template manager
const templateManager = createPromptTemplateManager();

// Apply a default template
const variables = {
  content: 'Text to summarize',
  max_length: '100',
  focus_points: 'key concepts'
};

const prompt = templateManager.applyTemplate('general_summary', variables);
```

### Creating Custom Templates

```typescript
import { createPromptTemplateManager } from '../src/templates';
import { PromptTemplate } from '../src/LLMClient';

// Create a template manager
const templateManager = createPromptTemplateManager();

// Define a custom template
const customTemplate: PromptTemplate = {
  id: 'custom_summary',
  name: 'Custom Summary Template',
  template: `Please summarize the following content in {{style}} style:

Content:
{{content}}

{{#if max_length}}Please keep it under {{max_length}} words.{{/if}}

Summary:`,
  variables: ['content', 'style', 'max_length'],
  description: 'A custom summary template with style options',
  tags: ['summary', 'custom']
};

// Register the template
templateManager.registerTemplate(customTemplate);

// Apply the template
const variables = {
  content: 'Text to summarize',
  style: 'concise',
  max_length: '50'
};

const prompt = templateManager.applyTemplate('custom_summary', variables);
```

## Integration with LLMClient

The PromptTemplateManager is integrated with the LLMClient, which provides methods to:

- Apply templates: `client.applyTemplate(templateId, variables)`
- Register templates: `client.registerTemplate(template)`
- Get templates: `client.getTemplate(id)` and `client.getAllTemplates()`

You can also access the template manager directly from an LLMClient instance:

```typescript
import { getTemplateManager } from '../src/LLMClient';

const templateManager = getTemplateManager(llmClient);
```

---