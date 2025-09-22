"""
Template Manager - Test Adapter

Provides a simplified interface for template management that's compatible with the test suite.
This wraps the full V2TemplateEngine for basic operations.
"""

from pathlib import Path
from typing import Dict, List, Any, Optional, Union

from ..engine import V2TemplateEngine


class TemplateManager:
    """
    Simplified template manager interface for testing and basic operations.
    
    This is a wrapper around V2TemplateEngine that provides a simpler interface
    compatible with the test suite expectations.
    """
    
    def __init__(self):
        self.engine = V2TemplateEngine()
        self.template_base_dir = Path(__file__).parent.parent / "v2-task-trees"
    
    def list_templates(self, template_dir: Optional[Path] = None) -> List[Dict[str, Any]]:
        """
        List available templates.
        
        Args:
            template_dir: Directory to search for templates (defaults to v2-task-trees)
            
        Returns:
            List of template metadata dictionaries
        """
        if template_dir is None:
            template_dir = self.template_base_dir
            
        return self.engine.list_available_templates(template_dir)
    
    def create_from_template(
        self,
        template_name: str,
        output_path: Path,
        variables: Dict[str, Any],
        project_id: Optional[str] = None
    ) -> bool:
        """
        Create a project from template.
        
        Args:
            template_name: Name of the template (e.g., "meta-development-project")
            output_path: Where to create the project
            variables: Template variables for substitution
            project_id: Optional project ID for task creation
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Find template path
            template_path = self.template_base_dir / template_name
            
            if not template_path.exists():
                raise FileNotFoundError(f"Template not found: {template_name}")
            
            # Create directory if it doesn't exist
            output_path.mkdir(parents=True, exist_ok=True)
            
            # For testing, we just use Copier directly to generate the files
            # and validate that the expected files were created
            from copier import run_copy
            
            run_copy(
                src_path=str(template_path),
                dst_path=str(output_path),
                data=variables,
                unsafe=False,
                defaults=True,
                overwrite=True,
                quiet=True
            )
            
            # Validate that expected files were created
            expected_extensions = ['.yml', '.yaml', '.md']
            created_files = []
            
            for file_path in output_path.rglob("*"):
                if file_path.is_file() and file_path.suffix in expected_extensions:
                    created_files.append(file_path)
            
            # Successful if at least some expected files were created
            return len(created_files) > 0
            
        except Exception as e:
            print(f"Template creation failed: {e}")
            return False
    
    def validate_template(self, template_name: str) -> bool:
        """
        Validate a template without creating anything.
        
        Args:
            template_name: Name of the template to validate
            
        Returns:
            True if template is valid, False otherwise
        """
        try:
            template_path = self.template_base_dir / template_name
            
            if not template_path.exists():
                return False
            
            result = self.engine.validate_template_source(template_path)
            return result.valid
            
        except Exception:
            return False
    
    def get_template_path(self, template_name: str) -> Optional[Path]:
        """
        Get the full path to a template.
        
        Args:
            template_name: Name of the template
            
        Returns:
            Path to template directory, or None if not found
        """
        template_path = self.template_base_dir / template_name
        
        if template_path.exists() and template_path.is_dir():
            return template_path
        
        return None