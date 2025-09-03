/**
 * Validation utilities for chat system
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationError {
  field: string;
  message: string;
}

export class Validator {
  /**
   * Validate a single field value against rules
   */
  static validateField(
    fieldName: string,
    value: any,
    rules: ValidationRule
  ): ValidationError | null {
    // Required validation
    if (rules.required && (value === undefined || value === null || value === '')) {
      return {
        field: fieldName,
        message: `${fieldName} is required`
      };
    }
    
    // Skip further validation if value is empty and not required
    if (!rules.required && (value === undefined || value === null || value === '')) {
      return null;
    }
    
    const stringValue = String(value);
    
    // Min length validation
    if (rules.minLength !== undefined && stringValue.length < rules.minLength) {
      return {
        field: fieldName,
        message: `${fieldName} must be at least ${rules.minLength} characters long`
      };
    }
    
    // Max length validation
    if (rules.maxLength !== undefined && stringValue.length > rules.maxLength) {
      return {
        field: fieldName,
        message: `${fieldName} must be at most ${rules.maxLength} characters long`
      };
    }
    
    // Pattern validation
    if (rules.pattern && !rules.pattern.test(stringValue)) {
      return {
        field: fieldName,
        message: `${fieldName} format is invalid`
      };
    }
    
    // Custom validation
    if (rules.custom) {
      const customError = rules.custom(value);
      if (customError) {
        return {
          field: fieldName,
          message: customError
        };
      }
    }
    
    return null;
  }
  
  /**
   * Validate an object against a schema of rules
   */
  static validateObject(
    obj: Record<string, any>,
    schema: Record<string, ValidationRule>
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const [fieldName, rules] of Object.entries(schema)) {
      const value = obj[fieldName];
      const error = this.validateField(fieldName, value, rules);
      if (error) {
        errors.push(error);
      }
    }
    
    return errors;
  }
  
  /**
   * Common validation patterns
   */
  static patterns = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    url: /^https?:\/\/.+/,
    apiKey: /^[a-zA-Z0-9_-]+$/,
    modelName: /^[a-zA-Z0-9_.-]+$/
  };
  
  /**
   * Common validation rules
   */
  static rules = {
    required: (message?: string): ValidationRule => ({
      required: true,
      custom: message ? () => message : undefined
    }),
    
    minLength: (min: number): ValidationRule => ({
      minLength: min
    }),
    
    maxLength: (max: number): ValidationRule => ({
      maxLength: max
    }),
    
    pattern: (pattern: RegExp, message?: string): ValidationRule => ({
      pattern,
      custom: message ? (value) => pattern.test(String(value)) ? null : message : undefined
    }),
    
    email: (): ValidationRule => ({
      pattern: this.patterns.email,
      custom: (value) => this.patterns.email.test(String(value)) ? null : 'Invalid email format'
    }),
    
    url: (): ValidationRule => ({
      pattern: this.patterns.url,
      custom: (value) => this.patterns.url.test(String(value)) ? null : 'Invalid URL format'
    }),
    
    range: (min: number, max: number): ValidationRule => ({
      custom: (value) => {
        const num = Number(value);
        if (isNaN(num)) return 'Must be a valid number';
        if (num < min) return `Must be at least ${min}`;
        if (num > max) return `Must be at most ${max}`;
        return null;
      }
    })
  };
}