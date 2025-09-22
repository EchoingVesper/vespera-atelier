"""
V2 Template Engine

Integrates Copier for template rendering with V2 task tree generation.
Supports both local templates and remote Git repositories.
"""

import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
import yaml
import logging

from copier import run_copy
from jinja2 import Environment, FileSystemLoader

from .models import (
    TemplateConfig, TemplateInstantiationResult, TemplateValidationResult,
    TemplateCategory, TaskTemplate, RoleTemplate
)
from .generator import TaskTreeGenerator
from .validator import TemplateValidator
from .mcp_integration import template_mcp_client

logger = logging.getLogger(__name__)


class V2TemplateEngine:
    """
    Main template engine that orchestrates template rendering and task creation.
    
    Workflow:
    1. Use Copier to render template with user variables
    2. Parse V2-specific configuration (tasks.yaml, roles.yaml)
    3. Generate hierarchical task tree via MCP tools
    4. Apply role assignments and dependencies
    """
    
    def __init__(self):
        self.jinja_env = Environment()
        self.task_generator = TaskTreeGenerator(mcp_client=template_mcp_client)
        self.validator = TemplateValidator()
        
    def create_from_template(
        self,
        template_source: Union[str, Path],
        destination: Optional[Path] = None,
        variables: Optional[Dict[str, Any]] = None,
        project_id: Optional[str] = None,
        dry_run: bool = False
    ) -> TemplateInstantiationResult:
        """
        Create V2 task tree from template.
        
        Args:
            template_source: Local path or Git URL to template
            destination: Where to render template (defaults to temp dir)
            variables: Template variables for substitution
            project_id: Project ID for task creation
            dry_run: If True, validate without creating tasks
            
        Returns:
            TemplateInstantiationResult with task IDs and status
        """
        variables = variables or {}
        
        try:
            # Step 1: Render template using Copier
            rendered_path = self._render_template(template_source, destination, variables)
            
            # Step 2: Parse V2 configuration
            template_config = self._parse_v2_config(rendered_path)
            
            # Step 3: Validate template
            validation_result = self.validator.validate_template(template_config)
            if not validation_result.valid:
                return TemplateInstantiationResult(
                    success=False,
                    errors=validation_result.errors
                )
            
            # Step 4: Generate task tree (unless dry run)
            if dry_run:
                return TemplateInstantiationResult(
                    success=True,
                    warnings=["Dry run - no tasks created"]
                )
                
            result = self.task_generator.create_hierarchical_tasks(
                template_config, 
                variables,
                project_id
            )
            
            # Cleanup temp directory if we created one
            if destination is None and rendered_path.exists():
                shutil.rmtree(rendered_path)
                
            return result
            
        except Exception as e:
            logger.error(f"Template instantiation failed: {e}")
            return TemplateInstantiationResult(
                success=False,
                errors=[f"Template instantiation failed: {str(e)}"]
            )
    
    def _render_template(
        self,
        template_source: Union[str, Path], 
        destination: Optional[Path],
        variables: Dict[str, Any]
    ) -> Path:
        """Render template using Copier"""
        
        # Use temp directory if no destination specified
        if destination is None:
            destination = Path(tempfile.mkdtemp(prefix="vespera_template_"))
        
        # Convert source to string for Copier
        source_str = str(template_source)
        dest_str = str(destination)
        
        logger.info(f"Rendering template from {source_str} to {dest_str}")
        
        # Run Copier with our variables
        run_copy(
            src_path=source_str,
            dst_path=dest_str,
            data=variables,
            unsafe=False,  # Security: don't allow unsafe operations
            vcs_ref=None,  # Use default branch
            pretend=False,  # Actually create files
            defaults=True,  # Use template defaults for missing variables
            user_defaults=variables  # Override defaults with provided variables
        )
        
        return destination
    
    def _parse_v2_config(self, rendered_path: Path) -> TemplateConfig:
        """Parse V2-specific configuration from rendered template"""
        
        # Look for V2 configuration files
        v2_config_path = rendered_path / "vespera.yaml"
        if not v2_config_path.exists():
            # Fallback to legacy name
            v2_config_path = rendered_path / "v2_template.yaml"
            
        if not v2_config_path.exists():
            raise FileNotFoundError(
                f"No V2 template configuration found in {rendered_path}. "
                f"Expected 'vespera.yaml' or 'v2_template.yaml'"
            )
        
        with open(v2_config_path, 'r') as f:
            config_data = yaml.safe_load(f)
        
        # Parse configuration into TemplateConfig object
        return self._parse_config_dict(config_data)
    
    def _parse_config_dict(self, config_data: Dict[str, Any]) -> TemplateConfig:
        """Convert YAML config to TemplateConfig object"""
        
        # Parse root task
        root_task_data = config_data.get("root_task", {})
        root_task = TaskTemplate(**root_task_data)
        
        # Parse task hierarchy
        task_hierarchy = []
        for task_data in config_data.get("task_hierarchy", []):
            task_hierarchy.append(TaskTemplate(**task_data))
        
        # Parse custom roles
        custom_roles = []
        for role_data in config_data.get("custom_roles", []):
            custom_roles.append(RoleTemplate(**role_data))
        
        # Create TemplateConfig
        template_config = TemplateConfig(
            name=config_data.get("name", "Unnamed Template"),
            description=config_data.get("description", ""),
            category=TemplateCategory(config_data.get("category", "custom")),
            version=config_data.get("version", "1.0.0"),
            root_task=root_task,
            task_hierarchy=task_hierarchy,
            dependencies=config_data.get("dependencies", {}),
            role_assignments=config_data.get("role_assignments", {}),
            custom_roles=custom_roles,
            template_variables=config_data.get("template_variables", []),
            copier_config=config_data.get("copier_config", {})
        )
        
        return template_config
    
    def list_available_templates(self, template_dir: Path) -> List[Dict[str, Any]]:
        """List available templates in a directory"""
        templates = []
        
        if not template_dir.exists():
            return templates
            
        for template_path in template_dir.iterdir():
            if template_path.is_dir():
                # Check for copier.yml or vespera.yaml
                copier_config = template_path / "copier.yml"
                vespera_config = template_path / "vespera.yaml"
                
                if copier_config.exists() or vespera_config.exists():
                    try:
                        # Try to parse template metadata
                        if vespera_config.exists():
                            with open(vespera_config, 'r') as f:
                                config = yaml.safe_load(f)
                                templates.append({
                                    "name": config.get("name", template_path.name),
                                    "description": config.get("description", ""),
                                    "category": config.get("category", "custom"),
                                    "version": config.get("version", "1.0.0"),
                                    "path": str(template_path)
                                })
                        else:
                            # Basic info from directory name
                            templates.append({
                                "name": template_path.name,
                                "description": "Copier template (no V2 config)",
                                "category": "custom",
                                "version": "unknown",
                                "path": str(template_path)
                            })
                    except Exception as e:
                        logger.warning(f"Failed to parse template {template_path}: {e}")
                        
        return templates
    
    def validate_template_source(self, template_source: Union[str, Path]) -> TemplateValidationResult:
        """Validate a template without instantiating it"""
        try:
            # Try to render with minimal variables
            temp_dir = Path(tempfile.mkdtemp(prefix="vespera_validation_"))
            
            # Use empty variables for validation
            self._render_template(template_source, temp_dir, {})
            
            # Parse and validate configuration
            template_config = self._parse_v2_config(temp_dir)
            result = self.validator.validate_template(template_config)
            
            # Cleanup
            shutil.rmtree(temp_dir)
            
            return result
            
        except Exception as e:
            return TemplateValidationResult(
                valid=False,
                errors=[f"Template validation failed: {str(e)}"]
            )