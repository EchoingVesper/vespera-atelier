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
    pub fn load_template(&self, _template_id: &TemplateId) -> BinderyResult<Template> {
        // TODO: Implement template loading from filesystem using _template_id to find template files
        Err(BinderyError::NotImplemented(
            "Template loading not yet implemented".to_string()
        ))
    }

    /// Load all templates from search paths
    pub fn load_all_templates(&self) -> BinderyResult<Vec<Template>> {
        // TODO: Implement bulk template loading
        Err(BinderyError::NotImplemented(
            "Bulk template loading not yet implemented".to_string()
        ))
    }
}

impl Default for TemplateLoader {
    fn default() -> Self {
        Self::new()
    }
}