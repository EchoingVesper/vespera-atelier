"""
Comprehensive Integration Test Suite - Complete Workflows

End-to-end integration tests covering complete task orchestration workflows,
cross-layer integration, system behavior validation, and real-world scenarios.
Focuses on workflow testing, system integration, and business process validation.
"""

import asyncio
import pytest
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

# Test infrastructure
from ..infrastructure.base_test_classes import IntegrationTestFull
from ..infrastructure.integration_test_helpers import (
    IntegrationTestDataFactory,
    WorkflowTestHarness,
    SystemTestHelper,
    E2ETestScenarioBuilder,
)

# All layer components for integration testing
from vespera_scriptorium.domain.entities.task import (
    Task,
    TaskStatus,
    TaskType,
    LifecycleStage,
)
from vespera_scriptorium.domain.entities.specialist import Specialist, SpecialistContext
from vespera_scriptorium.domain.entities.orchestration import OrchestrationSession
from vespera_scriptorium.domain.value_objects.complexity_level import ComplexityLevel
from vespera_scriptorium.domain.value_objects.specialist_type import SpecialistType

from vespera_scriptorium.application.usecases.manage_tasks import TaskUseCase
from vespera_scriptorium.application.usecases.execute_task import ExecuteTaskUseCase
from vespera_scriptorium.application.usecases.complete_task import CompleteTaskUseCase
from vespera_scriptorium.application.usecases.orchestrate_task import OrchestrationUseCase
from vespera_scriptorium.application.usecases.track_progress import ProgressTrackingUseCase

from vespera_scriptorium.domain.repositories.task_repository import TaskRepository
from vespera_scriptorium.domain.repositories.specialist_repository import SpecialistRepository
from vespera_scriptorium.domain.repositories.state_repository import StateRepository

# Infrastructure implementations
from vespera_scriptorium.infrastructure.mcp_server import MCPServerIntegration
from vespera_scriptorium.infrastructure.external_services import ExternalServiceClient
from vespera_scriptorium.infrastructure.file_system import FileSystemManager

# Domain services
from vespera_scriptorium.domain.services.task_breakdown_service import TaskBreakdownService
from vespera_scriptorium.domain.services.specialist_assignment_service import SpecialistAssignmentService
from vespera_scriptorium.domain.services.progress_tracking_service import ProgressTrackingService
from vespera_scriptorium.domain.services.result_synthesis_service import ResultSynthesisService

# Exceptions
from vespera_scriptorium.domain.exceptions import (
    TaskNotFoundError,
    TaskStateError,
    SpecialistNotFoundError,
    OrchestrationError,
    WorkflowError,
)


class TestCompleteTaskWorkflow(IntegrationTestFull):
    """Test complete task lifecycle workflow from creation to completion."""
    
    async def setup_test_configuration(self):
        """Setup integration test environment."""
        await super().setup_test_configuration()
        self.data_factory = IntegrationTestDataFactory()
        self.workflow_harness = WorkflowTestHarness()
        self.system_helper = SystemTestHelper()
        self.scenario_builder = E2ETestScenarioBuilder()
    
    async def register_all_services(self, registrar):
        """Register all services for complete integration testing."""
        # Domain services
        registrar.register_transient(TaskBreakdownService)
        registrar.register_transient(SpecialistAssignmentService)
        registrar.register_transient(ProgressTrackingService)
        registrar.register_transient(ResultSynthesisService)
        
        # Application use cases
        registrar.register_transient(TaskUseCase)
        registrar.register_transient(ExecuteTaskUseCase)
        registrar.register_transient(CompleteTaskUseCase)
        registrar.register_transient(OrchestrationUseCase)
        registrar.register_transient(ProgressTrackingUseCase)
        
        # Infrastructure services (mocked for testing)
        registrar.register_instance(MCPServerIntegration, AsyncMock())
        registrar.register_instance(ExternalServiceClient, AsyncMock())
        registrar.register_instance(FileSystemManager, AsyncMock())
    
    async def register_mock_externals(self, registrar):
        """Register mocked external services."""
        # Mock external API calls
        mock_external_client = AsyncMock()
        mock_external_client.send_notification.return_value = {"status": "sent"}
        mock_external_client.validate_credentials.return_value = True
        registrar.register_instance(ExternalServiceClient, mock_external_client)
        
        # Mock file system operations
        mock_fs_manager = AsyncMock()
        mock_fs_manager.save_artifact.return_value = "/path/to/saved/artifact"
        mock_fs_manager.load_artifact.return_value = "artifact content"
        registrar.register_instance(FileSystemManager, mock_fs_manager)
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_single_task_complete_lifecycle(self):
        """Test complete lifecycle of a single task from creation to completion."""
        # Build test scenario
        scenario = self.scenario_builder.build_single_task_scenario(
            title="Complete Lifecycle Test Task",
            description="Integration test for complete task lifecycle",
            specialist_type="coder",
            complexity=ComplexityLevel.MODERATE
        )
        
        # Phase 1: Task Creation
        async with self.integration_workflow_context() as workflow:
            # Create task
            task_creation_result = await workflow.execute_step(
                "create_task",
                scenario.task_creation_data
            )
            
            created_task = task_creation_result["task"]
            self.assert_workflow_result(task_creation_result)
            
            assert created_task.task_id is not None
            assert created_task.status == TaskStatus.PENDING
            assert created_task.lifecycle_stage == LifecycleStage.CREATED


class TestSystemIntegrationScenarios(IntegrationTestFull):
    """Test various system integration scenarios and edge cases."""
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_system_resource_management(self):
        """Test system resource management under load."""
        async with self.integration_workflow_context() as workflow:
            # Create high-load scenario
            load_test_result = await workflow.execute_step(
                "execute_load_test",
                {
                    "concurrent_sessions": 10,
                    "tasks_per_session": 5,
                    "duration_minutes": 2,
                    "resource_monitoring": True
                }
            )
            
            self.assert_workflow_result(load_test_result)
            
            resource_metrics = load_test_result["resource_metrics"]
            assert resource_metrics["memory_usage_peak"] < 1000  # MB
            assert resource_metrics["cpu_usage_average"] < 80  # Percentage
            assert resource_metrics["database_connections"] < 50