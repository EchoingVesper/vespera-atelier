/// Template system for Vespera Bindery
/// 
/// This module provides template management for Codex types,
/// supporting dynamic field definitions and validation.

use crate::errors::{BinderyError, BinderyResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use chrono::{DateTime, Utc};

/// Template identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TemplateId(String);

impl TemplateId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
}

impl fmt::Display for TemplateId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<String> for TemplateId {
    fn from(s: String) -> Self {
        TemplateId(s)
    }
}

impl From<&str> for TemplateId {
    fn from(s: &str) -> Self {
        TemplateId(s.to_string())
    }
}

/// Template value types that can be stored in Codex fields
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TemplateValue {
    Text(String),
    Number(f64),
    Boolean(bool),
    DateTime(DateTime<Utc>),
    Array(Vec<TemplateValue>),
    Object(serde_json::Value),
    Enum(String),
    Reference(String), // Reference to another Codex
    Null,
}

impl TemplateValue {
    /// Create a TemplateValue from a JSON value
    pub fn from_json(value: serde_json::Value) -> BinderyResult<Self> {
        match value {
            serde_json::Value::Null => Ok(TemplateValue::Null),
            serde_json::Value::Bool(b) => Ok(TemplateValue::Boolean(b)),
            serde_json::Value::Number(n) => {
                if let Some(f) = n.as_f64() {
                    Ok(TemplateValue::Number(f))
                } else {
                    Ok(TemplateValue::Number(n.as_i64().unwrap_or(0) as f64))
                }
            },
            serde_json::Value::String(s) => {
                // Try to parse as datetime first
                if let Ok(dt) = s.parse::<DateTime<Utc>>() {
                    Ok(TemplateValue::DateTime(dt))
                } else {
                    Ok(TemplateValue::Text(s))
                }
            },
            serde_json::Value::Array(arr) => {
                let values: Result<Vec<_>, _> = arr.into_iter()
                    .map(TemplateValue::from_json)
                    .collect();
                Ok(TemplateValue::Array(values?))
            },
            serde_json::Value::Object(_) => Ok(TemplateValue::Object(value)),
        }
    }

    /// Convert TemplateValue to JSON
    pub fn to_json(&self) -> serde_json::Value {
        match self {
            TemplateValue::Text(s) => serde_json::Value::String(s.clone()),
            TemplateValue::Number(n) => serde_json::Number::from_f64(*n)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null),
            TemplateValue::Boolean(b) => serde_json::Value::Bool(*b),
            TemplateValue::DateTime(dt) => serde_json::Value::String(dt.to_rfc3339()),
            TemplateValue::Array(arr) => serde_json::Value::Array(
                arr.iter().map(|v| v.to_json()).collect()
            ),
            TemplateValue::Object(obj) => obj.clone(),
            TemplateValue::Enum(e) => serde_json::Value::String(e.clone()),
            TemplateValue::Reference(r) => serde_json::Value::String(r.clone()),
            TemplateValue::Null => serde_json::Value::Null,
        }
    }
}

/// Template field definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldDefinition {
    pub field_type: FieldType,
    pub required: bool,
    pub default_value: Option<TemplateValue>,
    pub validation: Option<FieldValidation>,
    pub crdt_layer: CrdtLayer,
    pub ui_config: Option<UiConfig>,
}

/// Field types supported by templates
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FieldType {
    Text,
    LongText,
    RichText,
    Number,
    Boolean,
    DateTime,
    Array,
    Object,
    Enum(Vec<String>),
    Reference,
}

/// CRDT layer assignment for fields
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CrdtLayer {
    Text,      // Y-CRDT for collaborative text editing
    Metadata,  // Last-Writer-Wins for simple fields
    Reference, // Observed-Remove Set for collections
    Hierarchy, // Tree CRDT for parent-child relationships
}

/// Validation rules for fields
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldValidation {
    pub min_length: Option<usize>,
    pub max_length: Option<usize>,
    pub pattern: Option<String>, // Regex pattern
    pub min_value: Option<f64>,
    pub max_value: Option<f64>,
    pub allowed_values: Option<Vec<String>>,
}

/// UI configuration for fields
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiConfig {
    pub label: Option<String>,
    pub placeholder: Option<String>,
    pub help_text: Option<String>,
    pub widget_type: Option<String>, // "text", "textarea", "select", etc.
    pub hidden: bool,
    pub readonly: bool,
    pub group: Option<String>,
    pub order: Option<i32>,
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            label: None,
            placeholder: None,
            help_text: None,
            widget_type: None,
            hidden: false,
            readonly: false,
            group: None,
            order: None,
        }
    }
}

/// Template definition for a Codex type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    pub id: TemplateId,
    pub name: String,
    pub description: String,
    pub version: String,
    pub content_type: String,
    pub fields: HashMap<String, FieldDefinition>,
    pub automation_rules: Vec<AutomationRule>,
    pub ui_layout: Option<UiLayout>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Automation rule for templates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationRule {
    pub name: String,
    pub trigger: String, // Field change, status change, etc.
    pub condition: Option<serde_json::Value>,
    pub actions: Vec<serde_json::Value>,
    pub enabled: bool,
}

/// UI layout configuration for templates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiLayout {
    pub primary_fields: Vec<String>,
    pub secondary_fields: Vec<String>,
    pub field_groups: HashMap<String, Vec<String>>,
    pub layout_type: String, // "standard", "compact", "detailed"
}

impl Template {
    /// Create a new template
    pub fn new(
        id: TemplateId,
        name: String,
        description: String,
        content_type: String,
    ) -> Self {
        Self {
            id,
            name,
            description,
            version: "1.0.0".to_string(),
            content_type,
            fields: HashMap::new(),
            automation_rules: Vec::new(),
            ui_layout: None,
            metadata: HashMap::new(),
        }
    }

    /// Add a field to the template
    pub fn add_field(&mut self, name: String, field_def: FieldDefinition) {
        self.fields.insert(name, field_def);
    }

    /// Validate a field value against the template
    pub fn validate_field(&self, field_name: &str, value: &TemplateValue) -> BinderyResult<()> {
        if let Some(field_def) = self.fields.get(field_name) {
            self.validate_field_value(field_def, value)
        } else {
            Err(BinderyError::TemplateValidationError(
                format!("Field '{}' not defined in template", field_name)
            ))
        }
    }

    /// Get default values for all fields
    pub fn get_default_values(&self) -> HashMap<String, TemplateValue> {
        let mut defaults = HashMap::new();
        
        for (field_name, field_def) in &self.fields {
            if let Some(default_value) = &field_def.default_value {
                defaults.insert(field_name.clone(), default_value.clone());
            } else if field_def.required {
                // Generate appropriate default for required fields
                let default_value = match field_def.field_type {
                    FieldType::Text => TemplateValue::Text(String::new()),
                    FieldType::LongText => TemplateValue::Text(String::new()),
                    FieldType::RichText => TemplateValue::Text(String::new()),
                    FieldType::Number => TemplateValue::Number(0.0),
                    FieldType::Boolean => TemplateValue::Boolean(false),
                    FieldType::DateTime => TemplateValue::DateTime(Utc::now()),
                    FieldType::Array => TemplateValue::Array(Vec::new()),
                    FieldType::Object => TemplateValue::Object(serde_json::Value::Object(serde_json::Map::new())),
                    FieldType::Enum(ref values) => {
                        if !values.is_empty() {
                            TemplateValue::Enum(values[0].clone())
                        } else {
                            TemplateValue::Null
                        }
                    },
                    FieldType::Reference => TemplateValue::Null,
                };
                defaults.insert(field_name.clone(), default_value);
            }
        }
        
        defaults
    }

    fn validate_field_value(&self, field_def: &FieldDefinition, value: &TemplateValue) -> BinderyResult<()> {
        // Type validation
        let type_matches = match (&field_def.field_type, value) {
            (FieldType::Text, TemplateValue::Text(_)) => true,
            (FieldType::LongText, TemplateValue::Text(_)) => true,
            (FieldType::RichText, TemplateValue::Text(_)) => true,
            (FieldType::Number, TemplateValue::Number(_)) => true,
            (FieldType::Boolean, TemplateValue::Boolean(_)) => true,
            (FieldType::DateTime, TemplateValue::DateTime(_)) => true,
            (FieldType::Array, TemplateValue::Array(_)) => true,
            (FieldType::Object, TemplateValue::Object(_)) => true,
            (FieldType::Enum(allowed), TemplateValue::Enum(val)) => allowed.contains(val),
            (FieldType::Reference, TemplateValue::Reference(_)) => true,
            (_, TemplateValue::Null) => !field_def.required,
            _ => false,
        };

        if !type_matches {
            return Err(BinderyError::TemplateValidationError(
                format!("Type mismatch for field value: expected {:?}, got {:?}", field_def.field_type, value)
            ));
        }

        // Additional validation rules
        if let Some(validation) = &field_def.validation {
            match value {
                TemplateValue::Text(s) => {
                    if let Some(min_len) = validation.min_length {
                        if s.len() < min_len {
                            return Err(BinderyError::TemplateValidationError(
                                format!("Text too short: minimum {} characters", min_len)
                            ));
                        }
                    }
                    if let Some(max_len) = validation.max_length {
                        if s.len() > max_len {
                            return Err(BinderyError::TemplateValidationError(
                                format!("Text too long: maximum {} characters", max_len)
                            ));
                        }
                    }
                    if let Some(pattern) = &validation.pattern {
                        #[cfg(feature = "regex")]
                        {
                            let regex = regex::Regex::new(pattern)?;
                            if !regex.is_match(s) {
                                return Err(BinderyError::TemplateValidationError(
                                    format!("Text does not match pattern: {}", pattern)
                                ));
                            }
                        }
                        #[cfg(not(feature = "regex"))]
                        {
                            // TODO: Add regex feature to enable pattern validation
                            tracing::warn!("Pattern validation requires 'regex' feature: {}", pattern);
                        }
                    }
                },
                TemplateValue::Number(n) => {
                    if let Some(min_val) = validation.min_value {
                        if *n < min_val {
                            return Err(BinderyError::TemplateValidationError(
                                format!("Number too small: minimum {}", min_val)
                            ));
                        }
                    }
                    if let Some(max_val) = validation.max_value {
                        if *n > max_val {
                            return Err(BinderyError::TemplateValidationError(
                                format!("Number too large: maximum {}", max_val)
                            ));
                        }
                    }
                },
                TemplateValue::Enum(e) => {
                    if let Some(allowed_values) = &validation.allowed_values {
                        if !allowed_values.contains(e) {
                            return Err(BinderyError::TemplateValidationError(
                                format!("Invalid enum value: {} not in {:?}", e, allowed_values)
                            ));
                        }
                    }
                },
                _ => {} // No additional validation for other types
            }
        }

        Ok(())
    }
}

/// Template registry for managing templates
#[derive(Debug)]
pub struct TemplateRegistry {
    templates: HashMap<TemplateId, Template>,
}

impl TemplateRegistry {
    /// Create a new template registry
    pub fn new() -> Self {
        Self {
            templates: HashMap::new(),
        }
    }

    /// Register a template
    pub fn register(&mut self, template: Template) -> BinderyResult<()> {
        self.templates.insert(template.id.clone(), template);
        Ok(())
    }

    /// Get a template by ID
    pub fn get(&self, id: &TemplateId) -> Option<&Template> {
        self.templates.get(id)
    }

    /// List all template IDs
    pub fn list_ids(&self) -> Vec<&TemplateId> {
        self.templates.keys().collect()
    }

    /// Remove a template
    pub fn remove(&mut self, id: &TemplateId) -> Option<Template> {
        self.templates.remove(id)
    }

    /// Load templates from a directory
    pub async fn load_from_directory(&mut self, path: &std::path::Path) -> BinderyResult<usize> {
        let mut loaded = 0;
        
        if !path.exists() || !path.is_dir() {
            return Err(BinderyError::IoError(
                format!("Template directory does not exist: {:?}", path)
            ));
        }

        let mut dir = tokio::fs::read_dir(path).await?;
        
        while let Some(entry) = dir.next_entry().await? {
            let path = entry.path();
            
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json5") {
                match self.load_template_from_file(&path).await {
                    Ok(template) => {
                        self.register(template)?;
                        loaded += 1;
                    },
                    Err(e) => {
                        tracing::warn!("Failed to load template from {:?}: {}", path, e);
                    }
                }
            }
        }

        Ok(loaded)
    }

    async fn load_template_from_file(&self, path: &std::path::Path) -> BinderyResult<Template> {
        let content = tokio::fs::read_to_string(path).await?;
        
        // Parse JSON5 content (simplified - would need proper JSON5 parser)
        let template: Template = serde_json::from_str(&content)
            .map_err(|e| BinderyError::TemplateParseError(format!("Failed to parse template: {}", e)))?;
            
        Ok(template)
    }
}