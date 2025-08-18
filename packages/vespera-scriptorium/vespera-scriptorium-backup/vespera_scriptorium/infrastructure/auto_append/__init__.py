"""
Auto-Append Task Engine Module

Event-driven task creation system with conditional logic,
security controls, and comprehensive monitoring.
"""

from .auto_append_engine import (
    AutoAppendEngine,
    AutoAppendRule,
    AutoAppendRuleStatus,
    TaskCreationMode,
    TaskDefinition,
    get_auto_append_engine,
)
from .condition_evaluator import (
    Condition,
    ConditionEvaluator,
    ConditionType,
    LogicalExpression,
    LogicalOperator,
    Operator,
)
from .event_system import (
    EventBus,
    EventListener,
    EventType,
    TaskEvent,
    TaskEventPublisher,
    get_event_bus,
    get_event_publisher,
)
from .mcp_tools import get_auto_append_tools
from .security_controls import (
    ResourceLimit,
    ResourceMonitor,
    ResourceType,
    SecurityLevel,
    SecurityManager,
    SecurityValidator,
    get_security_manager,
)

__all__ = [
    # Event System
    "EventType",
    "TaskEvent",
    "EventListener",
    "EventBus",
    "TaskEventPublisher",
    "get_event_bus",
    "get_event_publisher",
    # Condition Evaluator
    "ConditionType",
    "Operator",
    "LogicalOperator",
    "Condition",
    "LogicalExpression",
    "ConditionEvaluator",
    # Auto-Append Engine
    "AutoAppendRuleStatus",
    "TaskCreationMode",
    "TaskDefinition",
    "AutoAppendRule",
    "AutoAppendEngine",
    "get_auto_append_engine",
    # Security Controls
    "SecurityLevel",
    "ResourceType",
    "ResourceLimit",
    "SecurityValidator",
    "ResourceMonitor",
    "SecurityManager",
    "get_security_manager",
    # MCP Tools
    "get_auto_append_tools",
]
