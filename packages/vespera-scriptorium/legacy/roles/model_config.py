"""
Template-driven model configuration management for role-based LLM integration.

Provides automatic model validation, mapping, and update capabilities.
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class ModelProvider(Enum):
    """Supported LLM providers."""
    ANTHROPIC = "anthropic"
    OPENAI = "openai" 
    LOCAL = "local"


@dataclass
class ModelInfo:
    """Information about a specific model."""
    id: str
    display_name: str
    provider: ModelProvider
    cli_name: str
    aliases: List[str]
    capabilities: List[str]
    context_window: int
    supports_streaming: bool = True
    deprecated: bool = False
    auto_discovered: bool = False


class ModelValidator:
    """Validates and maps model names for Claude CLI integration."""
    
    def __init__(self, model_registry: Dict[str, ModelInfo]):
        self.registry = model_registry
        self.alias_map = self._build_alias_map()
    
    def _build_alias_map(self) -> Dict[str, str]:
        """Build reverse mapping from aliases to model IDs."""
        alias_map = {}
        for model_id, info in self.registry.items():
            for alias in info.aliases:
                alias_map[alias] = model_id
        return alias_map
    
    def resolve_model(self, model_name: str) -> Optional[ModelInfo]:
        """Resolve abstract model name to actual model info."""
        # Direct match
        if model_name in self.registry:
            return self.registry[model_name]
        
        # Alias match
        if model_name in self.alias_map:
            model_id = self.alias_map[model_name]
            return self.registry[model_id]
        
        return None
    
    def get_claude_cli_name(self, model_name: str) -> Optional[str]:
        """Get Claude CLI compatible model name."""
        model_info = self.resolve_model(model_name)
        if not model_info:
            return None
            
        return model_info.cli_name
    
    def validate_model_name(self, model_name: str) -> bool:
        """Check if model name is valid."""
        return self.resolve_model(model_name) is not None
    
    def get_fallback_chain(self, preferred_model: str, fallbacks: List[str]) -> List[str]:
        """Get validated fallback chain with CLI-compatible names."""
        chain = []
        
        # Add preferred model
        cli_name = self.get_claude_cli_name(preferred_model)
        if cli_name:
            chain.append(cli_name)
        
        # Add fallbacks
        for fallback in fallbacks:
            cli_name = self.get_claude_cli_name(fallback)
            if cli_name and cli_name not in chain:
                chain.append(cli_name)
        
        return chain


class ModelConfigManager:
    """Manages template-driven model configuration."""
    
    def __init__(self, config_path: Optional[Path] = None):
        if config_path is None:
            config_path = Path(__file__).parent.parent / "models" / "claude_models.json5"
        
        self.config_path = config_path
        self.config = self._load_config()
        self.validator = ModelValidator(self._build_model_registry())
    
    def _load_config(self) -> Dict[str, Any]:
        """Load JSON5 configuration file."""
        try:
            with open(self.config_path, 'r') as f:
                # For now, use JSON (JSON5 requires additional dependency)
                # TODO: Add json5 dependency for full JSON5 support
                content = f.read()
                
                # Remove JSON5 comments for basic JSON compatibility
                lines = []
                for line in content.split('\n'):
                    # Remove single-line comments
                    if '//' in line:
                        line = line[:line.index('//')]
                    lines.append(line)
                
                cleaned_content = '\n'.join(lines)
                return json.loads(cleaned_content)
                
        except FileNotFoundError:
            logger.error(f"Model configuration file not found: {self.config_path}")
            return self._get_default_config()
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in model configuration: {e}")
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration when file loading fails."""
        return {
            "version": "1.0.0-fallback",
            "model_mappings": {
                "sonnet": {
                    "id": "claude-sonnet-4-20250514",
                    "display_name": "Claude Sonnet 4",
                    "provider": "anthropic",
                    "cli_name": "sonnet",
                    "aliases": ["sonnet"],
                    "capabilities": ["text", "code"],
                    "context_window": 200000,
                    "supports_streaming": True,
                    "deprecated": False
                }
            },
            "role_presets": {}
        }
    
    def _build_model_registry(self) -> Dict[str, ModelInfo]:
        """Build model registry from configuration."""
        registry = {}
        
        for name, config in self.config.get("model_mappings", {}).items():
            try:
                registry[name] = ModelInfo(
                    id=config["id"],
                    display_name=config["display_name"],
                    provider=ModelProvider(config["provider"]),
                    cli_name=config["cli_name"],
                    aliases=config["aliases"],
                    capabilities=config["capabilities"],
                    context_window=config["context_window"],
                    supports_streaming=config.get("supports_streaming", True),
                    deprecated=config.get("deprecated", False),
                    auto_discovered=config.get("auto_discovered", False)
                )
            except (KeyError, ValueError) as e:
                logger.warning(f"Invalid model configuration for '{name}': {e}")
                continue
        
        return registry
    
    def get_role_model_config(self, role_name: str) -> Dict[str, Any]:
        """Get model configuration for a specific role."""
        role_presets = self.config.get("role_presets", {})
        role_config = role_presets.get(role_name, {})
        
        # Default fallback
        default_config = {
            "preferred": "sonnet",
            "fallbacks": ["gpt-4", "llama3"]
        }
        
        preferred = role_config.get("preferred", default_config["preferred"])
        fallbacks = role_config.get("fallbacks", default_config["fallbacks"])
        
        # Validate and convert to CLI names
        preferred_cli = self.validator.get_claude_cli_name(preferred)
        fallback_cli_chain = self.validator.get_fallback_chain(preferred, fallbacks)
        
        return {
            "preferred_llm": preferred_cli or "sonnet",
            "fallback_llms": fallback_cli_chain[1:] if len(fallback_cli_chain) > 1 else []
        }
    
    def validate_role_models(self, role_name: str) -> List[str]:
        """Validate model configuration for a role and return any issues."""
        issues = []
        role_config = self.get_role_model_config(role_name)
        
        if not role_config["preferred_llm"]:
            issues.append(f"No valid preferred model for role '{role_name}'")
        
        if not role_config["fallback_llms"]:
            issues.append(f"No valid fallback models for role '{role_name}'")
        
        return issues
    
    def get_all_cli_models(self) -> List[str]:
        """Get list of all CLI-compatible model names."""
        return [info.cli_name for info in self.validator.registry.values()]
    
    def get_models_by_capability(self, capability: str) -> List[str]:
        """Get models that support a specific capability."""
        models = []
        for model_info in self.validator.registry.values():
            if capability in model_info.capabilities:
                models.append(model_info.cli_name)
        return models