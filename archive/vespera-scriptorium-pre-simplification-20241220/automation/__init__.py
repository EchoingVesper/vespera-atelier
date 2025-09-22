"""Automation package for template-driven hook agents and timed agents.

This package provides the complete template-driven automation system including:
- Hook agents for pre/post task execution
- Timed agents for scheduled execution
- Template-aware context inheritance
- Integration with the background task execution manager
"""

from .hook_agents import (
    HookTriggerType,
    AgentSpawnMode,
    TemplateContext,
    HookAgentDefinition,
    TimedAgentDefinition,
    TemplateHookAgentManager,
    ClaudeCodeHookExecutor
)

__all__ = [
    'HookTriggerType',
    'AgentSpawnMode', 
    'TemplateContext',
    'HookAgentDefinition',
    'TimedAgentDefinition',
    'TemplateHookAgentManager',
    'ClaudeCodeHookExecutor'
]