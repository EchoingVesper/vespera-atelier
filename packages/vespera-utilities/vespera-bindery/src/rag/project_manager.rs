//! # Project Manager
//!
//! Manages .vespera folders in project directories with support for
//! hierarchical project structures and automatic discovery.

use std::path::{Path, PathBuf};
use std::collections::{HashMap, HashSet};
use std::fs;
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use tokio::sync::RwLock;
use std::sync::Arc;

/// Configuration for a project managed by Vespera
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub id: Uuid,
    pub name: String,
    pub root_path: PathBuf,
    pub vespera_path: PathBuf,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub parent_project: Option<Uuid>,
    pub child_projects: Vec<Uuid>,
    pub settings: ProjectSettings,
}

/// Project-specific settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSettings {
    pub auto_index: bool,
    pub index_patterns: Vec<String>,
    pub ignore_patterns: Vec<String>,
    pub embedding_model: Option<String>,
    pub chunk_strategy: Option<String>,
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            auto_index: true,
            index_patterns: vec![
                "**/*.py".into(),
                "**/*.rs".into(),
                "**/*.js".into(),
                "**/*.ts".into(),
                "**/*.md".into(),
                "**/*.txt".into(),
            ],
            ignore_patterns: vec![
                "**/node_modules/**".into(),
                "**/.git/**".into(),
                "**/target/**".into(),
                "**/__pycache__/**".into(),
                "**/.venv/**".into(),
                "**/dist/**".into(),
                "**/build/**".into(),
            ],
            embedding_model: None,
            chunk_strategy: None,
        }
    }
}

/// Manages multiple projects and their .vespera folders
pub struct ProjectManager {
    projects: Arc<RwLock<HashMap<Uuid, ProjectConfig>>>,
    path_index: Arc<RwLock<HashMap<PathBuf, Uuid>>>,
    hierarchy: Arc<RwLock<ProjectHierarchy>>,
}

/// Represents the hierarchical structure of projects
#[derive(Debug, Default)]
struct ProjectHierarchy {
    roots: HashSet<Uuid>,
    parent_map: HashMap<Uuid, Uuid>,
    children_map: HashMap<Uuid, Vec<Uuid>>,
}

impl ProjectManager {
    /// Create a new project manager
    pub fn new() -> Self {
        Self {
            projects: Arc::new(RwLock::new(HashMap::new())),
            path_index: Arc::new(RwLock::new(HashMap::new())),
            hierarchy: Arc::new(RwLock::new(ProjectHierarchy::default())),
        }
    }

    /// Initialize a new project in the given directory
    pub async fn initialize_project(&self, path: &Path, name: Option<String>) -> Result<ProjectConfig> {
        let canonical_path = path.canonicalize()
            .with_context(|| format!("Failed to canonicalize path: {:?}", path))?;

        // Check if project already exists
        if let Some(existing) = self.get_project_by_path(&canonical_path).await? {
            return Ok(existing);
        }

        // Create .vespera folder
        let vespera_path = canonical_path.join(".vespera");
        fs::create_dir_all(&vespera_path)
            .with_context(|| format!("Failed to create .vespera folder at {:?}", vespera_path))?;

        // Check for parent projects
        let parent_project = self.find_parent_project(&canonical_path).await?;
        let parent_project_id = parent_project.as_ref().map(|p| p.id);

        // Create project configuration
        let project = ProjectConfig {
            id: Uuid::new_v4(),
            name: name.unwrap_or_else(|| {
                canonical_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unnamed")
                    .to_string()
            }),
            root_path: canonical_path.clone(),
            vespera_path: vespera_path.clone(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            parent_project: parent_project_id,
            child_projects: Vec::new(),
            settings: ProjectSettings::default(),
        };

        // Save configuration
        let config_path = vespera_path.join("project.json");
        let config_json = serde_json::to_string_pretty(&project)?;
        fs::write(&config_path, config_json)
            .with_context(|| format!("Failed to write project config to {:?}", config_path))?;

        // Create subdirectories
        fs::create_dir_all(vespera_path.join("rag"))?;
        fs::create_dir_all(vespera_path.join("rag/embeddings"))?;
        fs::create_dir_all(vespera_path.join("rag/indices"))?;
        fs::create_dir_all(vespera_path.join("codices"))?;
        fs::create_dir_all(vespera_path.join("templates"))?;
        fs::create_dir_all(vespera_path.join("hooks"))?;

        // Register project
        self.register_project(project.clone()).await?;

        // Update parent if exists
        if let Some(parent) = parent_project {
            self.add_child_project(parent.id, project.id).await?;
        }

        Ok(project)
    }

    /// Register an existing project
    async fn register_project(&self, project: ProjectConfig) -> Result<()> {
        let mut projects = self.projects.write().await;
        let mut path_index = self.path_index.write().await;
        let mut hierarchy = self.hierarchy.write().await;

        projects.insert(project.id, project.clone());
        path_index.insert(project.root_path.clone(), project.id);

        // Update hierarchy
        if let Some(parent_id) = project.parent_project {
            hierarchy.parent_map.insert(project.id, parent_id);
            hierarchy.children_map
                .entry(parent_id)
                .or_insert_with(Vec::new)
                .push(project.id);
        } else {
            hierarchy.roots.insert(project.id);
        }

        Ok(())
    }

    /// Find a parent project for the given path
    async fn find_parent_project(&self, path: &Path) -> Result<Option<ProjectConfig>> {
        let _projects = self.projects.read().await; // TODO: Use projects to optimize search

        // Walk up the directory tree looking for parent projects
        let mut current = path.parent();
        while let Some(dir) = current {
            // Check if this directory has a .vespera folder
            let vespera_path = dir.join(".vespera");
            if vespera_path.exists() && vespera_path.is_dir() {
                // Try to load the project config
                let config_path = vespera_path.join("project.json");
                if config_path.exists() {
                    let config_str = fs::read_to_string(&config_path)?;
                    let config: ProjectConfig = serde_json::from_str(&config_str)?;
                    return Ok(Some(config));
                }
            }
            current = dir.parent();
        }

        Ok(None)
    }

    /// Get a project by its path
    pub async fn get_project_by_path(&self, path: &Path) -> Result<Option<ProjectConfig>> {
        let canonical_path = path.canonicalize()?;

        // Check exact match first
        let path_index = self.path_index.read().await;
        if let Some(id) = path_index.get(&canonical_path) {
            let projects = self.projects.read().await;
            return Ok(projects.get(id).cloned());
        }

        // Check if path contains a .vespera folder
        let vespera_path = canonical_path.join(".vespera/project.json");
        if vespera_path.exists() {
            let config_str = fs::read_to_string(&vespera_path)?;
            let config: ProjectConfig = serde_json::from_str(&config_str)?;

            // Register it for future use
            self.register_project(config.clone()).await?;
            return Ok(Some(config));
        }

        Ok(None)
    }

    /// Get a project by its ID
    pub async fn get_project(&self, id: Uuid) -> Option<ProjectConfig> {
        let projects = self.projects.read().await;
        projects.get(&id).cloned()
    }

    /// Add a child project to a parent
    async fn add_child_project(&self, parent_id: Uuid, child_id: Uuid) -> Result<()> {
        let mut projects = self.projects.write().await;

        if let Some(parent) = projects.get_mut(&parent_id) {
            if !parent.child_projects.contains(&child_id) {
                parent.child_projects.push(child_id);
                parent.updated_at = Utc::now();

                // Save updated config
                let config_path = parent.vespera_path.join("project.json");
                let config_json = serde_json::to_string_pretty(&parent)?;
                fs::write(&config_path, config_json)?;
            }
        }

        Ok(())
    }

    /// Discover all projects under a directory
    pub async fn discover_projects(&self, root_path: &Path) -> Result<Vec<ProjectConfig>> {
        let mut discovered = Vec::new();
        self.discover_projects_recursive(root_path, &mut discovered).await?;
        Ok(discovered)
    }

    async fn discover_projects_recursive(
        &self,
        path: &Path,
        discovered: &mut Vec<ProjectConfig>,
    ) -> Result<()> {
        // Check if this directory has a .vespera folder
        let vespera_path = path.join(".vespera/project.json");
        if vespera_path.exists() {
            let config_str = fs::read_to_string(&vespera_path)?;
            let config: ProjectConfig = serde_json::from_str(&config_str)?;

            // Register the project
            self.register_project(config.clone()).await?;
            discovered.push(config);
        }

        // Recursively check subdirectories
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_dir() {
                        let dir_name = entry.file_name();
                        let dir_name_str = dir_name.to_string_lossy();

                        // Skip common non-project directories
                        if !dir_name_str.starts_with('.')
                            && dir_name_str != "node_modules"
                            && dir_name_str != "target"
                            && dir_name_str != "__pycache__"
                            && dir_name_str != "dist"
                            && dir_name_str != "build"
                        {
                            Box::pin(self.discover_projects_recursive(&entry.path(), discovered)).await?;
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Get all root projects (projects without parents)
    pub async fn get_root_projects(&self) -> Vec<ProjectConfig> {
        let projects = self.projects.read().await;
        let hierarchy = self.hierarchy.read().await;

        hierarchy
            .roots
            .iter()
            .filter_map(|id| projects.get(id).cloned())
            .collect()
    }

    /// Get all child projects of a parent
    pub async fn get_child_projects(&self, parent_id: Uuid) -> Vec<ProjectConfig> {
        let projects = self.projects.read().await;
        let hierarchy = self.hierarchy.read().await;

        hierarchy
            .children_map
            .get(&parent_id)
            .map(|children| {
                children
                    .iter()
                    .filter_map(|id| projects.get(id).cloned())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Get all projects including hierarchical relationships
    pub async fn get_all_projects(&self) -> Vec<ProjectConfig> {
        let projects = self.projects.read().await;
        projects.values().cloned().collect()
    }

    /// Update project settings
    pub async fn update_project_settings(
        &self,
        project_id: Uuid,
        settings: ProjectSettings,
    ) -> Result<()> {
        let mut projects = self.projects.write().await;

        if let Some(project) = projects.get_mut(&project_id) {
            project.settings = settings;
            project.updated_at = Utc::now();

            // Save updated config
            let config_path = project.vespera_path.join("project.json");
            let config_json = serde_json::to_string_pretty(&project)?;
            fs::write(&config_path, config_json)?;

            Ok(())
        } else {
            anyhow::bail!("Project not found: {}", project_id)
        }
    }

    /// Get the .vespera folder path for a project
    pub async fn get_vespera_path(&self, project_id: Uuid) -> Option<PathBuf> {
        let projects = self.projects.read().await;
        projects.get(&project_id).map(|p| p.vespera_path.clone())
    }

    /// Clean up orphaned .vespera folders (where project.json is missing or invalid)
    pub async fn cleanup_orphaned_folders(&self, root_path: &Path) -> Result<Vec<PathBuf>> {
        let mut orphaned = Vec::new();
        self.find_orphaned_folders_recursive(root_path, &mut orphaned)?;

        // TODO: Optionally remove orphaned folders after user confirmation

        Ok(orphaned)
    }

    fn find_orphaned_folders_recursive(
        &self,
        path: &Path,
        orphaned: &mut Vec<PathBuf>,
    ) -> Result<()> {
        // Check if this directory has a .vespera folder
        let vespera_path = path.join(".vespera");
        if vespera_path.exists() && vespera_path.is_dir() {
            let config_path = vespera_path.join("project.json");
            if !config_path.exists() {
                orphaned.push(vespera_path);
            } else {
                // Try to parse the config
                if let Ok(config_str) = fs::read_to_string(&config_path) {
                    if serde_json::from_str::<ProjectConfig>(&config_str).is_err() {
                        orphaned.push(vespera_path);
                    }
                }
            }
        }

        // Recursively check subdirectories
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_dir() {
                        let dir_name = entry.file_name();
                        let dir_name_str = dir_name.to_string_lossy();

                        // Skip .vespera folders themselves and common non-project directories
                        if dir_name_str != ".vespera"
                            && !dir_name_str.starts_with('.')
                            && dir_name_str != "node_modules"
                            && dir_name_str != "target"
                        {
                            self.find_orphaned_folders_recursive(&entry.path(), orphaned)?;
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_initialize_project() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ProjectManager::new();

        let project = manager
            .initialize_project(temp_dir.path(), Some("test_project".into()))
            .await
            .unwrap();

        assert_eq!(project.name, "test_project");
        assert!(project.vespera_path.exists());
        assert!(project.vespera_path.join("rag").exists());
        assert!(project.vespera_path.join("codices").exists());
    }

    #[tokio::test]
    async fn test_hierarchical_projects() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ProjectManager::new();

        // Create parent project
        let parent = manager
            .initialize_project(temp_dir.path(), Some("parent".into()))
            .await
            .unwrap();

        // Create child project
        let child_dir = temp_dir.path().join("subproject");
        fs::create_dir(&child_dir).unwrap();

        let child = manager
            .initialize_project(&child_dir, Some("child".into()))
            .await
            .unwrap();

        assert_eq!(child.parent_project, Some(parent.id));

        // Check that parent knows about child
        let updated_parent = manager.get_project(parent.id).await.unwrap();
        assert!(updated_parent.child_projects.contains(&child.id));
    }

    #[tokio::test]
    async fn test_discover_projects() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ProjectManager::new();

        // Create multiple projects
        let proj1_dir = temp_dir.path().join("project1");
        fs::create_dir(&proj1_dir).unwrap();
        manager.initialize_project(&proj1_dir, Some("project1".into())).await.unwrap();

        let proj2_dir = temp_dir.path().join("project2");
        fs::create_dir(&proj2_dir).unwrap();
        manager.initialize_project(&proj2_dir, Some("project2".into())).await.unwrap();

        // Discover all projects
        let discovered = manager.discover_projects(temp_dir.path()).await.unwrap();
        assert_eq!(discovered.len(), 2);
    }
}