//! Template system implementation

use std::path::Path;
use std::collections::HashMap;
use crate::{BinderyResult, BinderyError, types::Template, TemplateId};

/// Template registry for managing loaded templates
#[derive(Debug)]
pub struct TemplateRegistry {
    templates: HashMap<TemplateId, Template>,
    loader: TemplateLoader,
}

impl TemplateRegistry {
    /// Create a new template registry
    pub fn new() -> Self {
        Self {
            templates: HashMap::new(),
            loader: TemplateLoader::new(),
        }
    }

    /// Get a template by ID, loading if necessary
    pub fn get_template(&mut self, template_id: &TemplateId) -> BinderyResult<&Template> {
        if !self.templates.contains_key(template_id) {
            let template = self.loader.load_template(template_id)?;
            self.templates.insert(template_id.clone(), template);
        }

        // This should never fail since we just inserted the template if it wasn't there
        self.templates.get(template_id)
            .ok_or_else(|| BinderyError::InternalError(
                format!("Template {} disappeared after loading", template_id)
            ))
    }

    /// Register a template directly
    pub fn register_template(&mut self, template: Template) {
        self.templates.insert(template.id.clone(), template);
    }

    /// Get the template loader for configuration
    pub fn loader_mut(&mut self) -> &mut TemplateLoader {
        &mut self.loader
    }

    /// Get a template by ID (read-only, without loading)
    pub fn get(&self, template_id: &TemplateId) -> Option<&Template> {
        self.templates.get(template_id)
    }
}

impl Default for TemplateRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Template loader for loading templates from various sources
#[derive(Debug)]
pub struct TemplateLoader {
    search_paths: Vec<std::path::PathBuf>,
}

impl TemplateLoader {
    /// Create a new template loader
    pub fn new() -> Self {
        Self {
            search_paths: Vec::new(),
        }
    }

    /// Add a search path for templates
    pub fn add_search_path<P: AsRef<Path>>(&mut self, path: P) {
        self.search_paths.push(path.as_ref().to_path_buf());
    }

    /// Load a template by ID
    pub fn load_template(&self, template_id: &TemplateId) -> BinderyResult<Template> {
        use crate::types::{TemplateField, TemplateSectionDefinition, TemplateValidation, TemplateUiConfig, TemplateFieldType, FieldValidation, FieldUiConfig, ContentType, SectionUiConfig, UiLayout, FieldGroup};
        use chrono::Utc;

        // Try to load from filesystem first
        for search_path in &self.search_paths {
            let template_file = search_path.join(format!("{}.json", template_id));
            if template_file.exists() {
                let content = std::fs::read_to_string(&template_file)
                    .map_err(|e| BinderyError::IoError(format!("Failed to read template file {:?}: {}", template_file, e)))?;
                let template: Template = serde_json::from_str(&content)
                    .map_err(|e| BinderyError::SerializationError(format!("Failed to parse template JSON for {}: {}", template_id, e)))?;
                return Ok(template);
            }
        }

        // If not found in filesystem, create a basic default template
        let template_id_str = template_id.to_string();
        match template_id_str.as_str() {
            "vespera.templates.hierarchical_task" => Ok(Template {
                id: template_id.clone(),
                name: "Hierarchical Task".to_string(),
                description: "A task with hierarchical structure and dependency management".to_string(),
                version: "1.0.0".to_string(),
                category: "task_management".to_string(),
                fields: vec![
                    TemplateField {
                        id: "title".to_string(),
                        label: "Task Title".to_string(),
                        description: Some("The title of the task".to_string()),
                        field_type: TemplateFieldType::Text { max_length: Some(200) },
                        required: true,
                        default_value: None,
                        validation: FieldValidation::default(),
                        ui_config: FieldUiConfig::default(),
                    },
                    TemplateField {
                        id: "description".to_string(),
                        label: "Description".to_string(),
                        description: Some("Detailed description of the task".to_string()),
                        field_type: TemplateFieldType::Textarea { max_length: Some(2000) },
                        required: false,
                        default_value: None,
                        validation: FieldValidation::default(),
                        ui_config: FieldUiConfig::default(),
                    },
                    TemplateField {
                        id: "status".to_string(),
                        label: "Status".to_string(),
                        description: Some("Current status of the task".to_string()),
                        field_type: TemplateFieldType::Select {
                            options: vec![
                                crate::types::SelectOption {
                                    value: "pending".to_string(),
                                    label: "Pending".to_string(),
                                    description: None,
                                    disabled: false,
                                },
                                crate::types::SelectOption {
                                    value: "in_progress".to_string(),
                                    label: "In Progress".to_string(),
                                    description: None,
                                    disabled: false,
                                },
                                crate::types::SelectOption {
                                    value: "completed".to_string(),
                                    label: "Completed".to_string(),
                                    description: None,
                                    disabled: false,
                                },
                            ]
                        },
                        required: true,
                        default_value: Some(serde_json::Value::String("pending".to_string())),
                        validation: FieldValidation::default(),
                        ui_config: FieldUiConfig::default(),
                    },
                    TemplateField {
                        id: "priority".to_string(),
                        label: "Priority".to_string(),
                        description: Some("Task priority level".to_string()),
                        field_type: TemplateFieldType::Select {
                            options: vec![
                                crate::types::SelectOption {
                                    value: "low".to_string(),
                                    label: "Low".to_string(),
                                    description: None,
                                    disabled: false,
                                },
                                crate::types::SelectOption {
                                    value: "medium".to_string(),
                                    label: "Medium".to_string(),
                                    description: None,
                                    disabled: false,
                                },
                                crate::types::SelectOption {
                                    value: "high".to_string(),
                                    label: "High".to_string(),
                                    description: None,
                                    disabled: false,
                                },
                            ]
                        },
                        required: false,
                        default_value: Some(serde_json::Value::String("medium".to_string())),
                        validation: FieldValidation::default(),
                        ui_config: FieldUiConfig::default(),
                    },
                ],
                sections: vec![
                    TemplateSectionDefinition {
                        id: "main".to_string(),
                        title: "Task Details".to_string(),
                        description: Some("Main task information".to_string()),
                        content_type: ContentType::PlainText,
                        required: true,
                        default_content: None,
                        ui_config: SectionUiConfig::default(),
                    }
                ],
                validation: TemplateValidation {
                    required_fields: vec!["title".to_string()],
                    field_dependencies: HashMap::new(),
                    custom_rules: vec![],
                },
                ui_config: TemplateUiConfig {
                    icon: None,
                    color: None,
                    layout: UiLayout::SingleColumn,
                    field_groups: vec![],
                    custom_css: None,
                },
                created_at: Utc::now(),
                updated_at: Utc::now(),
                author: "system".to_string(),
            }),
            _ => {
                // Create a generic template for unknown types
                Ok(Template {
                    id: template_id.clone(),
                    name: format!("Generic Template ({})", template_id),
                    description: "A generic template with basic fields".to_string(),
                    version: "1.0.0".to_string(),
                    category: "generic".to_string(),
                    fields: vec![
                        TemplateField {
                            id: "title".to_string(),
                            label: "Title".to_string(),
                            description: Some("The title of the content".to_string()),
                            field_type: TemplateFieldType::Text { max_length: Some(200) },
                            required: true,
                            default_value: None,
                            validation: FieldValidation::default(),
                            ui_config: FieldUiConfig::default(),
                        },
                        TemplateField {
                            id: "content".to_string(),
                            label: "Content".to_string(),
                            description: Some("The main content".to_string()),
                            field_type: TemplateFieldType::Textarea { max_length: Some(5000) },
                            required: false,
                            default_value: None,
                            validation: FieldValidation::default(),
                            ui_config: FieldUiConfig::default(),
                        },
                    ],
                    sections: vec![
                        TemplateSectionDefinition {
                            id: "main".to_string(),
                            title: "Main Content".to_string(),
                            description: Some("Primary content section".to_string()),
                            content_type: ContentType::PlainText,
                            required: true,
                            default_content: None,
                            ui_config: SectionUiConfig::default(),
                        }
                    ],
                    validation: TemplateValidation {
                        required_fields: vec!["title".to_string()],
                        field_dependencies: HashMap::new(),
                        custom_rules: vec![],
                    },
                    ui_config: TemplateUiConfig {
                        icon: None,
                        color: None,
                        layout: UiLayout::SingleColumn,
                        field_groups: vec![],
                        custom_css: None,
                    },
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                    author: "system".to_string(),
                })
            }
        }
    }

    /// Load all templates from search paths
    pub fn load_all_templates(&self) -> BinderyResult<Vec<Template>> {
        let mut templates = Vec::new();

        for search_path in &self.search_paths {
            if !search_path.exists() {
                continue;
            }

            // Read all .json files in the search path
            let entries = std::fs::read_dir(search_path)
                .map_err(|e| BinderyError::IoError(e.to_string()))?;

            for entry in entries {
                let entry = entry.map_err(|e| BinderyError::IoError(e.to_string()))?;
                let path = entry.path();

                if path.extension().and_then(|s| s.to_str()) == Some("json") {
                    let content = std::fs::read_to_string(&path)
                        .map_err(|e| BinderyError::IoError(e.to_string()))?;

                    match serde_json::from_str::<Template>(&content) {
                        Ok(template) => templates.push(template),
                        Err(e) => {
                            tracing::warn!("Failed to parse template file {:?}: {}", path, e);
                            // Continue loading other templates instead of failing completely
                        }
                    }
                }
            }
        }

        // If no templates were loaded from filesystem, provide some default templates
        if templates.is_empty() {
            tracing::info!("No templates found in search paths, providing default templates");

            // Load common default templates
            let default_template_ids = vec![
                TemplateId::new("vespera.templates.hierarchical_task"),
                TemplateId::new("vespera.templates.generic"),
            ];

            for template_id in default_template_ids {
                if let Ok(template) = self.load_template(&template_id) {
                    templates.push(template);
                }
            }
        }

        Ok(templates)
    }
}

impl Default for TemplateLoader {
    fn default() -> Self {
        Self::new()
    }
}