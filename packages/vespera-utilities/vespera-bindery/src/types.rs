//! Core types and data structures for Vespera Bindery

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::TemplateId;

/// Unique identifier for a Codex
pub type CodexId = Uuid;


/// Unique identifier for a project
pub type ProjectId = String;

/// Unique identifier for a user
pub type UserId = String;

/// Unique identifier for a CRDT operation
pub type OperationId = Uuid;

/// Content hash for integrity verification
pub type ContentHash = String;

/// Vector clock for distributed operations
pub type VectorClock = HashMap<UserId, u64>;

/// Metadata associated with a Codex
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CodexMetadata {
    /// Unique identifier for this Codex
    pub id: CodexId,
    
    /// Human-readable title
    pub title: String,
    
    /// Template this Codex is based on
    pub template_id: TemplateId,
    
    /// Project this Codex belongs to
    pub project_id: Option<ProjectId>,
    
    /// Tags for categorization
    pub tags: Vec<String>,
    
    /// Custom labels with values
    pub labels: HashMap<String, String>,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Last modification timestamp
    pub updated_at: DateTime<Utc>,
    
    /// User who created this Codex
    pub created_by: UserId,
    
    /// User who last modified this Codex
    pub updated_by: UserId,
    
    /// Current CRDT version
    pub crdt_version: u64,
    
    /// Vector clock for distributed operations
    pub vector_clock: VectorClock,
    
    /// Hash of current content for integrity
    pub content_hash: ContentHash,
    
    /// Relationships with other Codices
    pub relationships: CodexRelationships,
    
    /// Access control information
    pub access_control: AccessControl,
    
    /// Custom metadata fields
    pub custom: HashMap<String, serde_json::Value>,
}

/// Relationships between Codices
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct CodexRelationships {
    /// Parent Codex (hierarchical relationship)
    pub parent: Option<CodexId>,
    
    /// Child Codices (hierarchical relationship)
    pub children: Vec<CodexId>,
    
    /// Codices this one references
    pub references: Vec<CodexId>,
    
    /// Codices that reference this one (computed)
    pub referenced_by: Vec<CodexId>,
    
    /// Codices this one depends on
    pub depends_on: Vec<CodexId>,
    
    /// Codices that depend on this one (computed)
    pub depended_on_by: Vec<CodexId>,
    
    /// Related Codices (loose association)
    pub related: Vec<CodexId>,
}

/// Access control information for a Codex
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AccessControl {
    /// Owner of the Codex (full permissions)
    pub owner: UserId,
    
    /// Users with read permission
    pub readers: Vec<UserId>,
    
    /// Users with write permission
    pub writers: Vec<UserId>,
    
    /// Users with admin permission (can change permissions)
    pub admins: Vec<UserId>,
    
    /// Public read access
    pub public_read: bool,
    
    /// Public write access (rarely used)
    pub public_write: bool,
}

impl Default for AccessControl {
    fn default() -> Self {
        Self {
            owner: "system".to_string(),
            readers: Vec::new(),
            writers: Vec::new(),
            admins: Vec::new(),
            public_read: false,
            public_write: false,
        }
    }
}

/// Content of a Codex (template-driven structure)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CodexContent {
    /// Template fields with their values
    pub template_fields: HashMap<String, TemplateFieldValue>,
    
    /// Free-form content sections
    pub content_sections: HashMap<String, ContentSection>,
    
    /// Attachments and binary data
    pub attachments: Vec<Attachment>,
}

/// Value for a template field
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum TemplateFieldValue {
    /// Plain text value
    Text { value: String },
    
    /// Rich text with CRDT operations
    RichText { value: String, operations: Vec<TextOperation> },
    
    /// Structured data (JSON-like)
    Structured { value: serde_json::Value },
    
    /// Reference to another Codex
    Reference { codex_id: CodexId },
    
    /// List of references
    References { codex_ids: Vec<CodexId> },
    
    /// File attachment reference
    File { attachment_id: String },
    
    /// List of values
    List { items: Vec<TemplateFieldValue> },
    
    /// Key-value mapping
    Map { entries: HashMap<String, TemplateFieldValue> },
}

impl TemplateFieldValue {
    /// Extract a string value from the field, if possible
    pub fn as_str(&self) -> Option<&str> {
        match self {
            TemplateFieldValue::Text { value } => Some(value),
            TemplateFieldValue::RichText { value, .. } => Some(value),
            _ => None,
        }
    }
    
    /// Extract an array from the field, if it's a List of structured values
    pub fn as_array(&self) -> Option<Vec<&serde_json::Value>> {
        match self {
            TemplateFieldValue::Structured { value } => value.as_array().map(|arr| arr.iter().collect()),
            TemplateFieldValue::List { items } => {
                let values: Vec<&serde_json::Value> = items.iter()
                    .filter_map(|item| match item {
                        TemplateFieldValue::Structured { value } => Some(value),
                        _ => None,
                    })
                    .collect();
                if values.is_empty() { None } else { Some(values) }
            }
            _ => None,
        }
    }
    
    /// Extract a serde_json::Value from the field
    pub fn as_json_value(&self) -> serde_json::Value {
        match self {
            TemplateFieldValue::Text { value } => serde_json::Value::String(value.clone()),
            TemplateFieldValue::RichText { value, .. } => serde_json::Value::String(value.clone()),
            TemplateFieldValue::Structured { value } => value.clone(),
            TemplateFieldValue::Reference { codex_id } => serde_json::Value::String(codex_id.to_string()),
            TemplateFieldValue::References { codex_ids } => {
                serde_json::Value::Array(codex_ids.iter().map(|id| serde_json::Value::String(id.to_string())).collect())
            }
            TemplateFieldValue::File { attachment_id } => serde_json::Value::String(attachment_id.clone()),
            TemplateFieldValue::List { items } => {
                serde_json::Value::Array(items.iter().map(|item| item.as_json_value()).collect())
            }
            TemplateFieldValue::Map { entries } => {
                let map: serde_json::Map<String, serde_json::Value> = entries
                    .iter()
                    .map(|(k, v)| (k.clone(), v.as_json_value()))
                    .collect();
                serde_json::Value::Object(map)
            }
        }
    }
}

/// A content section within a Codex
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentSection {
    /// Section identifier
    pub id: String,
    
    /// Section title
    pub title: String,
    
    /// Content type
    pub content_type: ContentType,
    
    /// Section content
    pub content: String,
    
    /// CRDT operations for this section
    pub operations: Vec<TextOperation>,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Last modification timestamp
    pub updated_at: DateTime<Utc>,
}

/// Type of content in a section
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ContentType {
    /// Plain text
    PlainText,
    
    /// Markdown content
    Markdown,
    
    /// HTML content
    Html,
    
    /// Code with syntax highlighting
    Code { language: String },
    
    /// Structured data (JSON/YAML)
    Structured { format: String },
    
    /// Custom content type
    Custom { type_name: String },
}

/// File attachment
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Attachment {
    /// Unique identifier
    pub id: String,
    
    /// Original filename
    pub filename: String,
    
    /// MIME type
    pub mime_type: String,
    
    /// File size in bytes
    pub size: u64,
    
    /// Content hash for integrity
    pub content_hash: ContentHash,
    
    /// Storage location (path, URL, etc.)
    pub storage_location: String,
    
    /// Upload timestamp
    pub uploaded_at: DateTime<Utc>,
    
    /// User who uploaded the file
    pub uploaded_by: UserId,
}

/// Text editing operation for CRDT
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TextOperation {
    /// Unique operation ID
    pub id: OperationId,
    
    /// Operation type
    pub operation: TextOperationType,
    
    /// Position in the text
    pub position: usize,
    
    /// Length of affected text
    pub length: Option<usize>,
    
    /// New content (for insert/replace operations)
    pub content: Option<String>,
    
    /// User who performed the operation
    pub user_id: UserId,
    
    /// Timestamp of the operation
    pub timestamp: DateTime<Utc>,
    
    /// Parent operation(s) this depends on
    pub parents: Vec<OperationId>,
}

/// Type of text operation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TextOperationType {
    /// Insert text at position
    Insert,
    
    /// Delete text at position
    Delete,
    
    /// Replace text at position
    Replace,
    
    /// Format text (bold, italic, etc.)
    Format { format_type: String },
    
    /// Remove formatting
    Unformat { format_type: String },
}

/// Template definition
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Template {
    /// Template identifier
    pub id: TemplateId,
    
    /// Human-readable name
    pub name: String,
    
    /// Description of the template
    pub description: String,
    
    /// Version of the template
    pub version: String,
    
    /// Template category
    pub category: String,
    
    /// Template fields definition
    pub fields: Vec<TemplateField>,
    
    /// Content sections definition
    pub sections: Vec<TemplateSectionDefinition>,
    
    /// Validation rules
    pub validation: TemplateValidation,
    
    /// UI configuration
    pub ui_config: TemplateUiConfig,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
    
    /// Template author
    pub author: UserId,
}

/// Field definition in a template
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TemplateField {
    /// Field identifier
    pub id: String,
    
    /// Human-readable label
    pub label: String,
    
    /// Field description
    pub description: Option<String>,
    
    /// Field type
    pub field_type: TemplateFieldType,
    
    /// Whether the field is required
    pub required: bool,
    
    /// Default value
    pub default_value: Option<serde_json::Value>,
    
    /// Validation rules
    pub validation: FieldValidation,
    
    /// UI configuration
    pub ui_config: FieldUiConfig,
}

/// Type of template field
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum TemplateFieldType {
    /// Single-line text
    Text { max_length: Option<usize> },
    
    /// Multi-line text
    Textarea { max_length: Option<usize> },
    
    /// Rich text editor
    RichText { max_length: Option<usize> },
    
    /// Numeric value
    Number { min: Option<f64>, max: Option<f64> },
    
    /// Boolean value
    Boolean,
    
    /// Date value
    Date,
    
    /// DateTime value
    DateTime,
    
    /// Selection from predefined options
    Select { options: Vec<SelectOption> },
    
    /// Multiple selections
    MultiSelect { options: Vec<SelectOption> },
    
    /// Reference to another Codex
    CodexReference { template_filter: Option<TemplateId> },
    
    /// Multiple Codex references
    CodexReferences { template_filter: Option<TemplateId> },
    
    /// File upload
    File { accepted_types: Vec<String> },
    
    /// Multiple file uploads
    Files { accepted_types: Vec<String> },
    
    /// Structured data (JSON)
    Json { schema: Option<serde_json::Value> },
    
    /// Custom field type
    Custom { type_name: String, config: serde_json::Value },
}

/// Option for select fields
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SelectOption {
    /// Option value
    pub value: String,
    
    /// Display label
    pub label: String,
    
    /// Optional description
    pub description: Option<String>,
    
    /// Whether this option is disabled
    pub disabled: bool,
}

/// Section definition in a template
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TemplateSectionDefinition {
    /// Section identifier
    pub id: String,
    
    /// Section title
    pub title: String,
    
    /// Section description
    pub description: Option<String>,
    
    /// Content type for this section
    pub content_type: ContentType,
    
    /// Whether the section is required
    pub required: bool,
    
    /// Default content
    pub default_content: Option<String>,
    
    /// UI configuration
    pub ui_config: SectionUiConfig,
}

/// Template validation rules
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct TemplateValidation {
    /// Required fields
    pub required_fields: Vec<String>,
    
    /// Field dependencies (field -> required_fields)
    pub field_dependencies: HashMap<String, Vec<String>>,
    
    /// Custom validation rules (JavaScript expressions)
    pub custom_rules: Vec<ValidationRule>,
}

/// Individual validation rule
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ValidationRule {
    /// Rule identifier
    pub id: String,
    
    /// Rule description
    pub description: String,
    
    /// JavaScript expression for validation
    pub expression: String,
    
    /// Error message if validation fails
    pub error_message: String,
}

/// Field validation rules
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct FieldValidation {
    /// Minimum length for text fields
    pub min_length: Option<usize>,
    
    /// Maximum length for text fields
    pub max_length: Option<usize>,
    
    /// Regex pattern for text validation
    pub pattern: Option<String>,
    
    /// Minimum value for numeric fields
    pub min_value: Option<f64>,
    
    /// Maximum value for numeric fields
    pub max_value: Option<f64>,
    
    /// Custom validation rules
    pub custom_rules: Vec<String>,
}

/// UI configuration for templates
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct TemplateUiConfig {
    /// Icon for the template
    pub icon: Option<String>,
    
    /// Color scheme
    pub color: Option<String>,
    
    /// Layout configuration
    pub layout: UiLayout,
    
    /// Field groupings
    pub field_groups: Vec<FieldGroup>,
    
    /// Custom CSS
    pub custom_css: Option<String>,
}

/// UI configuration for fields
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct FieldUiConfig {
    /// Field width (1-12, bootstrap-style)
    pub width: Option<u8>,
    
    /// Placeholder text
    pub placeholder: Option<String>,
    
    /// Help text
    pub help_text: Option<String>,
    
    /// Field icon
    pub icon: Option<String>,
    
    /// Whether to show this field in compact view
    pub show_in_compact: bool,
    
    /// Display order
    pub order: Option<u16>,
    
    /// Custom CSS classes
    pub css_classes: Vec<String>,
}

/// UI configuration for sections
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct SectionUiConfig {
    /// Whether section is collapsible
    pub collapsible: bool,
    
    /// Whether section starts collapsed
    pub collapsed: bool,
    
    /// Section icon
    pub icon: Option<String>,
    
    /// Display order
    pub order: Option<u16>,
}

/// UI layout type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum UiLayout {
    /// Single column layout
    SingleColumn,
    
    /// Two column layout
    TwoColumn,
    
    /// Three column layout
    ThreeColumn,
    
    /// Tabbed layout
    Tabs,
    
    /// Accordion layout
    Accordion,
    
    /// Custom layout
    Custom { config: serde_json::Value },
}

impl Default for UiLayout {
    fn default() -> Self {
        Self::SingleColumn
    }
}

/// Field grouping for UI organization
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FieldGroup {
    /// Group identifier
    pub id: String,
    
    /// Group title
    pub title: String,
    
    /// Group description
    pub description: Option<String>,
    
    /// Fields in this group
    pub fields: Vec<String>,
    
    /// Whether group is collapsible
    pub collapsible: bool,
    
    /// Whether group starts collapsed
    pub collapsed: bool,
    
    /// Display order
    pub order: Option<u16>,
}