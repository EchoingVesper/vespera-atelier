/**
 * @deprecated This module is deprecated and will be removed in a future version.
 * Please use the new PromptBuilder module (src/PromptBuilder.ts) instead.
 *
 * PromptTemplateManager module
 * Manages prompt templates for different summarization tasks
 * @module PromptTemplateManager
 */

import { PromptTemplate } from '../LLMClient';

export interface TemplateVariables {
  [key: string]: string;
}

export interface ConditionalSection {
  condition: string;
  trueContent: string;
  falseContent?: string;
}

export class PromptTemplateManager {
  private templates: Map<string, PromptTemplate> = new Map();
  
  constructor() {
    this.registerDefaultTemplates();
  }
  
  registerTemplate(template: PromptTemplate): void {
    if (this.templates.has(template.id)) {
      throw new Error(`Template with ID '${template.id}' already exists`);
    }
    this.templates.set(template.id, template);
  }
  
  updateTemplate(template: PromptTemplate): void {
    if (!this.templates.has(template.id)) {
      throw new Error(`Template with ID '${template.id}' not found`);
    }
    this.templates.set(template.id, template);
  }
  
  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }
  
  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }
  
  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }
  
  applyTemplate(templateId: string, variables: TemplateVariables): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    return this.processTemplate(template.template, variables);
  }
  
  processTemplate(templateString: string, variables: TemplateVariables): string {
    let result = this.processConditionalSections(templateString, variables);
    result = this.substituteVariables(result, variables);
    return result;
  }
  
  private processConditionalSections(templateString: string, variables: TemplateVariables): string {
    const conditionalRegex = /{{#if\s+([^}]+)}}((?:.|\n)*?)(?:{{else}}((?:.|\n)*?))?{{\/if}}/g;
    
    return templateString.replace(conditionalRegex, (match, condition, trueContent, falseContent = '') => {
      const conditionValue = variables[condition];
      const isTrue = !!conditionValue && conditionValue !== 'false' && conditionValue !== '0';
      return isTrue ? trueContent : falseContent;
    });
  }
  
  private substituteVariables(templateString: string, variables: TemplateVariables): string {
    return templateString.replace(/{{([^#\/][^}]*)}}/g, (match, variableName) => {
      const trimmedName = variableName.trim();
      return variables[trimmedName] !== undefined ? variables[trimmedName] : match;
    });
  }
  
  private registerDefaultTemplates(): void {
    this.registerTemplate({
      id: 'general_summary',
      name: 'General Summary',
      template: `Please provide a concise summary of the following content:

{{#if context}}Context: {{context}}{{/if}}

Content to summarize:
{{content}}

{{#if max_length}}Please keep the summary under {{max_length}} words.{{/if}}
{{#if focus_points}}Please focus on these aspects: {{focus_points}}{{/if}}

Summary:`,
      variables: ['content', 'context', 'max_length', 'focus_points'],
      description: 'A general-purpose summary template for most content',
      tags: ['summary', 'general']
    });
    
    this.registerTemplate({
      id: 'detailed_summary',
      name: 'Detailed Summary',
      template: `Please provide a detailed summary of the following content, preserving key information, arguments, and conclusions:

{{#if context}}Context: {{context}}{{/if}}

Content to summarize:
{{content}}

{{#if max_length}}Please keep the summary under {{max_length}} words.{{/if}}
{{#if structure}}Please structure the summary as follows: {{structure}}{{/if}}
{{#if focus_points}}Please focus on these aspects: {{focus_points}}{{/if}}

Detailed Summary:`,
      variables: ['content', 'context', 'max_length', 'structure', 'focus_points'],
      description: 'A detailed summary template that preserves more information from the original content',
      tags: ['summary', 'detailed']
    });
    
    this.registerTemplate({
      id: 'key_points',
      name: 'Key Points Extraction',
      template: `Please extract the key points from the following content:

{{#if context}}Context: {{context}}{{/if}}

Content to analyze:
{{content}}

{{#if max_points}}Please limit to the {{max_points}} most important points.{{/if}}
{{#if focus_areas}}Please focus on these areas: {{focus_areas}}{{/if}}

Key Points:`,
      variables: ['content', 'context', 'max_points', 'focus_areas'],
      description: 'Extracts key points from content in a bullet-point format',
      tags: ['summary', 'key points', 'bullets']
    });
    
    this.registerTemplate({
      id: 'question_answering',
      name: 'Question Answering',
      template: `Please answer the following question based on the provided content:

{{#if context}}Context: {{context}}{{/if}}

Content:
{{content}}

Question: {{question}}

{{#if answer_style}}Please provide a {{answer_style}} answer.{{/if}}
{{#if max_length}}Please keep the answer under {{max_length}} words.{{/if}}

Answer:`,
      variables: ['content', 'question', 'context', 'answer_style', 'max_length'],
      description: 'Answers specific questions based on the provided content',
      tags: ['question', 'answer', 'qa']
    });
    
    this.registerTemplate({
      id: 'academic_summary',
      name: 'Academic Summary',
      template: `Please provide an academic summary of the following content, focusing on methodology, findings, and implications:

{{#if context}}Context: {{context}}{{/if}}

Content to summarize:
{{content}}

{{#if max_length}}Please keep the summary under {{max_length}} words.{{/if}}
{{#if citation_style}}Please use {{citation_style}} citation style if referring to sources.{{/if}}

Academic Summary:`,
      variables: ['content', 'context', 'max_length', 'citation_style'],
      description: 'Summarizes academic content with focus on methodology and findings',
      tags: ['summary', 'academic', 'research']
    });
  }
}

export function createPromptTemplateManager(): PromptTemplateManager {
  // console.warn("PromptTemplateManager is deprecated. Use PromptBuilder instead.");
  // throw new Error("PromptTemplateManager is deprecated. Use PromptBuilder (src/PromptBuilder.ts) instead.");
  return new PromptTemplateManager(); // Or return null/throw error to enforce deprecation
}
