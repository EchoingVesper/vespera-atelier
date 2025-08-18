"""
LLM-based Hook Actions

Spawns LLM agents to investigate problems or handle complex operations.
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from enum import Enum

from .base import HookAction
from ..core.models import HookActionConfig, HookContext

logger = logging.getLogger(__name__)


class LLMAgentType(Enum):
    """Types of LLM agents that can be spawned"""
    INVESTIGATOR = "investigator"  # Investigate problems/errors
    CODE_REVIEWER = "code_reviewer"  # Review code changes
    DOCUMENTATION = "documentation"  # Generate/update docs
    TEST_GENERATOR = "test_generator"  # Generate tests
    REFACTORING = "refactoring"  # Code refactoring suggestions
    SECURITY_AUDIT = "security_audit"  # Security analysis
    PERFORMANCE = "performance"  # Performance analysis


class LLMAction(HookAction):
    """
    Spawns LLM agents to handle complex operations that require reasoning.
    
    Used when programmatic actions aren't sufficient and human-like
    analysis/problem-solving is needed.
    """
    
    def __init__(self):
        # Registry of available LLM agent types and their capabilities
        self.agent_capabilities = {
            LLMAgentType.INVESTIGATOR: {
                "description": "Investigates errors, failures, and anomalies",
                "context_requirements": ["error_logs", "system_state"],
                "output_format": "analysis_report"
            },
            LLMAgentType.CODE_REVIEWER: {
                "description": "Reviews code changes for quality and issues",
                "context_requirements": ["code_diff", "file_context"],
                "output_format": "review_comments"
            },
            LLMAgentType.DOCUMENTATION: {
                "description": "Generates and updates documentation",
                "context_requirements": ["code_structure", "api_changes"],
                "output_format": "documentation_updates"
            },
            LLMAgentType.TEST_GENERATOR: {
                "description": "Generates comprehensive test suites",
                "context_requirements": ["code_structure", "function_signatures"],
                "output_format": "test_files"
            },
            LLMAgentType.REFACTORING: {
                "description": "Suggests code improvements and refactoring",
                "context_requirements": ["code_analysis", "performance_metrics"],
                "output_format": "refactoring_plan"
            },
            LLMAgentType.SECURITY_AUDIT: {
                "description": "Performs security analysis and vulnerability assessment",
                "context_requirements": ["code_structure", "dependency_info"],
                "output_format": "security_report"
            },
            LLMAgentType.PERFORMANCE: {
                "description": "Analyzes performance and suggests optimizations",
                "context_requirements": ["profiling_data", "code_structure"],
                "output_format": "performance_report"
            }
        }
    
    async def execute(self, config: HookActionConfig, context: HookContext) -> Dict[str, Any]:
        """Execute an LLM-based action"""
        if not await self.pre_execute(config, context):
            return {"success": False, "error": "Pre-execution failed"}
        
        try:
            parameters = self._extract_parameters(config)
            agent_type_str = config.implementation
            
            # Parse agent type
            try:
                agent_type = LLMAgentType(agent_type_str)
            except ValueError:
                return {"success": False, "error": f"Unknown LLM agent type: {agent_type_str}"}
            
            # Validate agent capabilities
            if not self._validate_agent_requirements(agent_type, parameters, context):
                return {"success": False, "error": f"Missing required context for {agent_type_str} agent"}
            
            # Spawn LLM agent
            result = await self._spawn_llm_agent(agent_type, parameters, context)
            
            await self.post_execute(config, context, result)
            return result
            
        except Exception as e:
            error_result = {"success": False, "error": str(e)}
            await self.post_execute(config, context, error_result)
            return error_result
    
    def validate_config(self, config: HookActionConfig) -> tuple[bool, list[str]]:
        """Validate LLM action configuration"""
        errors = []
        
        if not config.implementation:
            errors.append("Agent type is required for LLM actions")
            return False, errors
        
        # Validate agent type
        try:
            agent_type = LLMAgentType(config.implementation)
        except ValueError:
            valid_types = [t.value for t in LLMAgentType]
            errors.append(f"Invalid agent type '{config.implementation}'. Valid types: {valid_types}")
            return False, errors
        
        # Validate parameters based on agent type
        parameters = config.parameters or {}
        capabilities = self.agent_capabilities[agent_type]
        
        # Check for required parameters (implementation-specific validation)
        if agent_type == LLMAgentType.INVESTIGATOR:
            if not parameters.get("investigation_scope"):
                errors.append("INVESTIGATOR agent requires 'investigation_scope' parameter")
        
        elif agent_type == LLMAgentType.CODE_REVIEWER:
            review_level = parameters.get("review_level", "standard")
            if review_level not in ["basic", "standard", "thorough", "security-focused"]:
                errors.append(f"Invalid review_level: {review_level}")
        
        elif agent_type == LLMAgentType.SECURITY_AUDIT:
            audit_scope = parameters.get("audit_scope", "code")
            if audit_scope not in ["code", "dependencies", "configuration", "full"]:
                errors.append(f"Invalid audit_scope: {audit_scope}")
        
        return len(errors) == 0, errors
    
    def _validate_agent_requirements(self, agent_type: LLMAgentType, 
                                   parameters: Dict[str, Any], 
                                   context: HookContext) -> bool:
        """Validate that required context is available for the agent"""
        capabilities = self.agent_capabilities[agent_type]
        requirements = capabilities["context_requirements"]
        
        # Check context availability (simplified - would integrate with actual context system)
        available_context = []
        
        if context.file_path:
            available_context.extend(["file_context", "code_structure"])
        
        if context.trigger_data.get("error_info"):
            available_context.extend(["error_logs", "system_state"])
        
        if context.trigger_data.get("code_changes"):
            available_context.append("code_diff")
        
        # Check if minimum requirements are met
        required_met = any(req in available_context for req in requirements)
        
        if not required_met:
            logger.warning(f"Agent {agent_type.value} requirements not met. "
                         f"Required: {requirements}, Available: {available_context}")
        
        return required_met
    
    async def _spawn_llm_agent(self, agent_type: LLMAgentType, 
                             parameters: Dict[str, Any], 
                             context: HookContext) -> Dict[str, Any]:
        """Spawn an LLM agent to handle the task"""
        try:
            # This would integrate with the actual LLM agent spawning system
            # For now, simulate the process
            
            agent_prompt = self._build_agent_prompt(agent_type, parameters, context)
            execution_context = self._prepare_execution_context(agent_type, parameters, context)
            
            logger.info(f"Spawning {agent_type.value} agent")
            logger.info(f"Agent prompt: {agent_prompt[:200]}...")
            
            # Simulate agent execution (would be replaced with actual LLM integration)
            await asyncio.sleep(0.1)  # Simulate processing time
            
            # Return structured result based on agent type
            result = await self._generate_agent_result(agent_type, parameters, context)
            
            return {
                "success": True,
                "agent_type": agent_type.value,
                "result": result,
                "prompt": agent_prompt,
                "execution_context": execution_context,
                "message": f"Successfully executed {agent_type.value} agent"
            }
            
        except Exception as e:
            return {"success": False, "error": f"LLM agent execution failed: {e}"}
    
    def _build_agent_prompt(self, agent_type: LLMAgentType, 
                           parameters: Dict[str, Any], 
                           context: HookContext) -> str:
        """Build the prompt for the LLM agent"""
        base_context = f"""
Context:
- Trigger Type: {context.trigger_type.value if context.trigger_type else 'unknown'}
- File Path: {context.file_path or 'N/A'}
- Task ID: {context.task_id or 'N/A'}
- Timestamp: {context.timestamp.isoformat() if context.timestamp else 'N/A'}

Trigger Data: {context.trigger_data}
"""
        
        if agent_type == LLMAgentType.INVESTIGATOR:
            scope = parameters.get("investigation_scope", "general")
            return f"""
You are an expert system investigator. Analyze the following situation and provide insights.

Investigation Scope: {scope}

{base_context}

Please provide:
1. Problem analysis
2. Potential causes
3. Recommended actions
4. Risk assessment
"""
        
        elif agent_type == LLMAgentType.CODE_REVIEWER:
            review_level = parameters.get("review_level", "standard")
            return f"""
You are an expert code reviewer. Review the following code changes.

Review Level: {review_level}

{base_context}

Please provide:
1. Code quality assessment
2. Potential issues or bugs
3. Security considerations
4. Performance implications
5. Improvement suggestions
"""
        
        elif agent_type == LLMAgentType.DOCUMENTATION:
            doc_type = parameters.get("documentation_type", "api")
            return f"""
You are a technical documentation specialist. Generate/update documentation.

Documentation Type: {doc_type}

{base_context}

Please provide:
1. Updated documentation
2. Documentation structure recommendations
3. Missing documentation identification
"""
        
        elif agent_type == LLMAgentType.SECURITY_AUDIT:
            audit_scope = parameters.get("audit_scope", "code")
            return f"""
You are a security auditor. Perform security analysis of the code/system.

Audit Scope: {audit_scope}

{base_context}

Please provide:
1. Security vulnerability assessment
2. Risk classification
3. Mitigation recommendations
4. Compliance considerations
"""
        
        else:
            return f"""
You are an expert {agent_type.value} agent. Analyze the following situation.

{base_context}

Please provide detailed analysis and recommendations based on your specialization.
"""
    
    def _prepare_execution_context(self, agent_type: LLMAgentType, 
                                 parameters: Dict[str, Any], 
                                 context: HookContext) -> Dict[str, Any]:
        """Prepare execution context for the agent"""
        return {
            "agent_type": agent_type.value,
            "parameters": parameters,
            "context_summary": {
                "trigger_type": context.trigger_type.value if context.trigger_type else None,
                "has_file_path": bool(context.file_path),
                "has_task_id": bool(context.task_id),
                "trigger_data_keys": list(context.trigger_data.keys()) if context.trigger_data else []
            },
            "capabilities": self.agent_capabilities[agent_type],
            "timestamp": context.timestamp.isoformat() if context.timestamp else None
        }
    
    async def _generate_agent_result(self, agent_type: LLMAgentType, 
                                   parameters: Dict[str, Any], 
                                   context: HookContext) -> Dict[str, Any]:
        """Generate structured result based on agent type (placeholder implementation)"""
        
        if agent_type == LLMAgentType.INVESTIGATOR:
            return {
                "analysis": "System analysis completed",
                "findings": ["Issue identified in file processing", "Memory usage within normal range"],
                "recommendations": ["Implement additional error handling", "Add logging for edge cases"],
                "risk_level": "medium",
                "next_steps": ["Review error handling patterns", "Update monitoring"]
            }
        
        elif agent_type == LLMAgentType.CODE_REVIEWER:
            return {
                "overall_quality": "good",
                "issues_found": ["Minor style inconsistency", "Missing error handling in edge case"],
                "security_concerns": [],
                "performance_notes": ["Algorithm efficiency could be improved"],
                "suggestions": ["Add type hints", "Implement comprehensive error handling"]
            }
        
        elif agent_type == LLMAgentType.SECURITY_AUDIT:
            return {
                "vulnerability_score": "low",
                "issues": [],
                "recommendations": ["Regular dependency updates", "Input validation review"],
                "compliance_status": "compliant",
                "audit_summary": "No critical security issues identified"
            }
        
        else:
            return {
                "agent_type": agent_type.value,
                "analysis_complete": True,
                "summary": f"Analysis completed by {agent_type.value} agent",
                "recommendations": ["Standard recommendations based on analysis"]
            }