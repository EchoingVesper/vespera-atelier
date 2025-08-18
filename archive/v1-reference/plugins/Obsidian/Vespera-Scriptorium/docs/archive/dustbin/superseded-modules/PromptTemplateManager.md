# PromptTemplateManager Module

**Responsibility:** Manages prompt templates for different summarization tasks, providing a flexible system for template creation, retrieval, and application.

## Overview

The PromptTemplateManager module provides a robust system for managing prompt templates used by the LLMClient. It supports:

- Registration and retrieval of templates
- Variable substitution in templates
- Conditional sections based on variables
- Default templates for common summarization tasks

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

## Template Syntax

### Variable Substitution

Variables are defined using double curly braces:

```
Hello, {{name}}!
```

### Conditional Sections

Conditional sections allow parts of the template to be included or excluded based on variable values:

```
{{#if variable}}Content if variable is truthy{{else}}Content if variable is falsy{{/if}}
```

Conditional sections can be nested:

```
{{#if condition1}}
  Condition1 is true.
  {{#if condition2}}
    Both conditions are true.
  {{else}}
    Only condition1 is true.
  {{/if}}
{{else}}
  Condition1 is false.
{{/if}}
```

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

## Integration with LLMClient

The PromptTemplateManager is integrated with the LLMClient, which provides methods to:

- Apply templates: `client.applyTemplate(templateId, variables)`
- Register templates: `client.registerTemplate(template)`
- Get templates: `client.getTemplate(id)` and `client.getAllTemplates()`

You can also access the template manager directly from an LLMClient instance:

```typescript
import { getTemplateManager } from '../src/LLMClient';

const templateManager = getTemplateManager(llmClient);