/**
 * Template Schemas
 *
 * Zod schemas for validating component templates.
 * Based on design patterns from vespera-bindery template system.
 */

import { z } from 'zod';
import { FillSchema, StrokeSchema, PenpotObjectTypeSchema } from './penpot.js';

/**
 * Template categories
 */
export const TemplateCategorySchema = z.enum([
  'dialog',
  'form',
  'button',
  'card',
  'error-pane',
  'menu',
  'list',
  'input',
  'container',
  'custom'
]);

export type TemplateCategory = z.infer<typeof TemplateCategorySchema>;

/**
 * Template layer (recursive shape definition)
 */
export type TemplateLayer = z.infer<typeof TemplateLayerSchema>;
export const TemplateLayerSchema: z.ZodType<{
  type: z.infer<typeof PenpotObjectTypeSchema>;
  name: string;
  properties: Record<string, unknown>;
  children?: TemplateLayer[];
}> = z.object({
  type: PenpotObjectTypeSchema,
  name: z.string(),
  properties: z.record(z.unknown()),
  children: z.lazy(() => z.array(TemplateLayerSchema)).optional()
});

/**
 * Style definition for templates
 */
export const StyleDefinitionSchema = z.object({
  fills: z.array(FillSchema).optional(),
  strokes: z.array(StrokeSchema).optional(),
  opacity: z.number().min(0).max(1).optional(),
  borderRadius: z.number().nonnegative().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional()
});

export type StyleDefinition = z.infer<typeof StyleDefinitionSchema>;

/**
 * Component template configuration
 */
export const ComponentTemplateConfigSchema = z.record(z.unknown());

export type ComponentTemplateConfig = z.infer<typeof ComponentTemplateConfigSchema>;

/**
 * Complete component template schema
 */
export const ComponentTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: TemplateCategorySchema,
  config: ComponentTemplateConfigSchema,
  layers: z.array(TemplateLayerSchema),
  styles: StyleDefinitionSchema.optional(),
  thumbnail: z.string().optional(), // Base64 or URL
  tags: z.array(z.string()).optional(),
  version: z.string().optional()
});

export type ComponentTemplate = z.infer<typeof ComponentTemplateSchema>;

/**
 * Template library (collection of templates)
 */
export const TemplateLibrarySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  templates: z.array(ComponentTemplateSchema)
});

export type TemplateLibrary = z.infer<typeof TemplateLibrarySchema>;

/**
 * Error dialog configuration
 */
export const ErrorDialogConfigSchema = z.object({
  title: z.string(),
  message: z.string(),
  severity: z.enum(['error', 'warning', 'info', 'success']),
  dismissible: z.boolean().default(true),
  buttons: z.array(z.string()).optional(),
  icon: z.boolean().default(true)
});

export type ErrorDialogConfig = z.infer<typeof ErrorDialogConfigSchema>;

/**
 * Button configuration
 */
export const ButtonConfigSchema = z.object({
  label: z.string(),
  variant: z.enum(['primary', 'secondary', 'danger', 'ghost', 'link']).default('primary'),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
  disabled: z.boolean().default(false),
  icon: z.string().optional()
});

export type ButtonConfig = z.infer<typeof ButtonConfigSchema>;

/**
 * Form input configuration
 */
export const FormInputConfigSchema = z.object({
  label: z.string(),
  placeholder: z.string().optional(),
  type: z.enum(['text', 'email', 'password', 'number', 'tel', 'url']).default('text'),
  required: z.boolean().default(false),
  disabled: z.boolean().default(false),
  helperText: z.string().optional(),
  errorText: z.string().optional()
});

export type FormInputConfig = z.infer<typeof FormInputConfigSchema>;

/**
 * Card configuration
 */
export const CardConfigSchema = z.object({
  title: z.string().optional(),
  hasHeader: z.boolean().default(true),
  hasFooter: z.boolean().default(false),
  hasShadow: z.boolean().default(true),
  hasBorder: z.boolean().default(true),
  width: z.number().positive().optional(),
  height: z.number().positive().optional()
});

export type CardConfig = z.infer<typeof CardConfigSchema>;