"""
Unit tests for the 3 new high-value MCP tools in Vespera V2.

Tests the following MCP tools:
1. semantic_task_clustering - Clustering algorithms, theme extraction  
2. get_task_impact_analysis - Impact calculations, cascade effects
3. project_health_analysis - Health metrics, risk assessment

Integration with triple-database system and error handling.
"""

import pytest
import asyncio
import tempfile
import json
from pathlib import Path
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, Any, List, Optional

# Import MCP tool types and functions
from mcp_server_triple_db import (
    ClusteringInput, ImpactAnalysisInput, ProjectHealthInput,
    semantic_task_clustering, get_task_impact_analysis, project_health_analysis
)

# Import database services for mocking
from databases.triple_db_service import TripleDBService
from databases.chroma_service import ChromaService
from databases.kuzu_service import KuzuService
from tasks.models import Task, TaskStatus, TaskPriority


class TestSemanticTaskClustering:
    """Test cases for semantic_task_clustering MCP tool."""
    
    @pytest.fixture
    def sample_tasks(self):
        """Create sample tasks for clustering tests."""
        return [
            Task(
                id="task_001",
                title="Implement user authentication",
                description="Add JWT-based authentication system with login/logout functionality",
                status=TaskStatus.PENDING,
                priority=TaskPriority.HIGH,
                project_id="web_app"
            ),
            Task(
                id="task_002", 
                title="Design user interface",
                description="Create responsive UI components for authentication screens",
                status=TaskStatus.PENDING,
                priority=TaskPriority.NORMAL,
                project_id="web_app"
            ),
            Task(
                id="task_003",
                title="Setup database schema",
                description="Design and implement user tables with proper indexing",
                status=TaskStatus.COMPLETED,
                priority=TaskPriority.HIGH,
                project_id="web_app"
            ),
            Task(
                id="task_004",
                title="Write API documentation",
                description="Document all authentication endpoints with examples",
                status=TaskStatus.PENDING,
                priority=TaskPriority.LOW,
                project_id="web_app"
            ),
            Task(
                id="task_005",
                title="Implement password reset",
                description="Add secure password reset functionality via email",
                status=TaskStatus.PENDING,
                priority=TaskPriority.NORMAL,
                project_id="web_app"
            )
        ]
    
    @pytest.fixture
    def mock_embeddings(self):
        """Mock embeddings for semantic similarity testing."""
        return {
            "task_001": [0.1, 0.8, 0.3, 0.9, 0.2],  # Auth-related
            "task_002": [0.2, 0.7, 0.8, 0.1, 0.9],  # UI-related  
            "task_003": [0.9, 0.2, 0.1, 0.8, 0.3],  # Database-related
            "task_004": [0.3, 0.1, 0.9, 0.2, 0.7],  # Documentation-related
            "task_005": [0.1, 0.9, 0.2, 0.8, 0.1],  # Auth-related (similar to task_001)
        }
    
    @pytest.mark.asyncio
    async def test_clustering_with_valid_input(self, sample_tasks, mock_embeddings):
        """Test clustering with valid input parameters."""
        with patch('mcp_server_triple_db.get_services') as mock_get_services:
            # Mock the triple database service
            mock_triple_db = AsyncMock()
            mock_triple_db.task_service.list_tasks.return_value = sample_tasks
            
            # Mock the chroma service for embeddings
            mock_chroma = AsyncMock()
            mock_chroma.get_task_embeddings.return_value = mock_embeddings
            
            mock_get_services.return_value = (mock_triple_db, mock_chroma, None, None)
            
            # Mock clustering algorithm
            with patch('mcp_server_triple_db._perform_clustering') as mock_cluster:
                mock_cluster.return_value = {
                    "clusters": [
                        {
                            "cluster_id": "auth_cluster",
                            "theme": "Authentication & Security",
                            "tasks": ["task_001", "task_005"],
                            "similarity_score": 0.85
                        },
                        {
                            "cluster_id": "ui_cluster", 
                            "theme": "User Interface Design",
                            "tasks": ["task_002"],
                            "similarity_score": 0.75
                        }
                    ],
                    "outliers": ["task_003", "task_004"]
                }
                
                clustering_input = ClusteringInput(
                    project_id="web_app",
                    num_clusters=3,
                    similarity_threshold=0.7,
                    include_completed=True,
                    min_cluster_size=1
                )
                
                result = await semantic_task_clustering(clustering_input)
                
                assert result["success"] == True
                assert "clusters" in result
                assert "clustering_summary" in result
                assert result["clustering_summary"]["clusters_found"] == 2
                assert result["clustering_summary"]["total_tasks_analyzed"] == 5
                assert len(result["clusters"]) == 2
                
                # Verify cluster structure
                auth_cluster = next(c for c in result["clusters"] if c["cluster_id"] == "auth_cluster")
                assert auth_cluster["theme"] == "Authentication & Security"
                assert len(auth_cluster["tasks"]) == 2
    
    @pytest.mark.asyncio
    async def test_clustering_no_tasks_available(self):
        """Test clustering when no tasks are available."""
        with patch('mcp_server_triple_db.get_services') as mock_get_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.task_service.list_tasks.return_value = []
            
            mock_get_services.return_value = (mock_triple_db, None, None, None)
            
            clustering_input = ClusteringInput(
                project_id="empty_project",
                num_clusters=3
            )
            
            result = await semantic_task_clustering(clustering_input)
            
            assert result["success"] == False
            assert "error" in result
            assert "no tasks found" in result["error"].lower()
    
    @pytest.mark.asyncio
    async def test_clustering_insufficient_embeddings(self, sample_tasks):
        """Test clustering when embeddings are not available."""
        with patch('mcp_server_triple_db.get_services') as mock_get_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.task_service.list_tasks.return_value = sample_tasks
            
            mock_chroma = AsyncMock()
            mock_chroma.get_task_embeddings.return_value = {}  # No embeddings
            
            mock_get_services.return_value = (mock_triple_db, mock_chroma, None, None)
            
            clustering_input = ClusteringInput(
                project_id="web_app",
                num_clusters=3
            )
            
            result = await semantic_task_clustering(clustering_input)
            
            assert result["success"] == False
            assert "embedding" in result["error"].lower()
    
    @pytest.mark.asyncio
    async def test_clustering_parameter_validation(self):
        """Test parameter validation for clustering input."""
        # Test invalid num_clusters
        with pytest.raises(ValueError):
            ClusteringInput(num_clusters=0)
        
        with pytest.raises(ValueError):
            ClusteringInput(num_clusters=-1)
        
        # Test invalid similarity_threshold
        with pytest.raises(ValueError):
            ClusteringInput(similarity_threshold=1.5)
        
        with pytest.raises(ValueError):
            ClusteringInput(similarity_threshold=-0.1)
        
        # Test invalid min_cluster_size
        with pytest.raises(ValueError):
            ClusteringInput(min_cluster_size=0)


class TestTaskImpactAnalysis:
    """Test cases for get_task_impact_analysis MCP tool."""
    
    @pytest.fixture
    def sample_task_with_dependencies(self):
        """Create sample task with dependencies for impact analysis."""
        main_task = Task(
            id="main_task",
            title="Deploy application",
            description="Deploy the web application to production",
            status=TaskStatus.PENDING,
            priority=TaskPriority.HIGH,
            project_id="deployment"
        )
        
        dependent_tasks = [
            Task(
                id="test_task",
                title="Run integration tests", 
                description="Execute full test suite",
                status=TaskStatus.PENDING,
                priority=TaskPriority.HIGH,
                project_id="deployment"
            ),
            Task(
                id="security_task",
                title="Security audit",
                description="Perform security vulnerability scan",
                status=TaskStatus.PENDING, 
                priority=TaskPriority.NORMAL,
                project_id="deployment"
            )
        ]
        
        return main_task, dependent_tasks
    
    @pytest.mark.asyncio
    async def test_impact_analysis_valid_task(self, sample_task_with_dependencies):
        """Test impact analysis with valid task."""
        main_task, dependent_tasks = sample_task_with_dependencies
        
        with patch('mcp_server_triple_db.get_services') as mock_get_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.get_task.return_value = main_task
            mock_triple_db.task_service.get_dependent_tasks.return_value = dependent_tasks
            mock_triple_db.task_service.get_task_dependencies.return_value = []
            
            mock_get_services.return_value = (mock_triple_db, None, None, None)
            
            # Mock impact calculation
            with patch('mcp_server_triple_db._calculate_task_impact') as mock_impact:
                mock_impact.return_value = {
                    "direct_impact": 2,
                    "cascade_impact": 5,
                    "resource_impact": "high",
                    "timeline_impact": 3,
                    "affected_tasks": ["test_task", "security_task"]
                }
                
                impact_input = ImpactAnalysisInput(
                    task_id="main_task",
                    change_type="complete",
                    include_dependencies=True,
                    include_resource_impact=True
                )
                
                result = await get_task_impact_analysis(impact_input)
                
                assert result["success"] == True
                assert "task" in result
                assert "summary" in result
                assert "impact_analysis" in result
                
                assert result["task"]["id"] == "main_task"
                assert result["summary"]["total_affected_tasks"] == 2
                assert result["summary"]["impact_severity"] in ["low", "medium", "high", "critical"]
                assert result["impact_analysis"]["direct_impact"] == 2
    
    @pytest.mark.asyncio
    async def test_impact_analysis_nonexistent_task(self):
        """Test impact analysis with nonexistent task."""
        with patch('mcp_server_triple_db.get_services') as mock_get_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.get_task.return_value = None
            
            mock_get_services.return_value = (mock_triple_db, None, None, None)
            
            impact_input = ImpactAnalysisInput(
                task_id="nonexistent_task",
                change_type="delete"
            )
            
            result = await get_task_impact_analysis(impact_input)
            
            assert result["success"] == False
            assert "not found" in result["error"].lower()
    
    @pytest.mark.asyncio
    async def test_impact_analysis_change_types(self, sample_task_with_dependencies):
        """Test different change types for impact analysis."""
        main_task, dependent_tasks = sample_task_with_dependencies
        
        change_types = ["complete", "delete", "update", "delay"]
        
        for change_type in change_types:
            with patch('mcp_server_triple_db.get_services') as mock_get_services:
                mock_triple_db = AsyncMock()
                mock_triple_db.get_task.return_value = main_task
                mock_triple_db.task_service.get_dependent_tasks.return_value = dependent_tasks
                
                mock_get_services.return_value = (mock_triple_db, None, None, None)
                
                with patch('mcp_server_triple_db._calculate_task_impact') as mock_impact:
                    mock_impact.return_value = {
                        "direct_impact": 1,
                        "cascade_impact": 2,
                        "change_type": change_type
                    }
                    
                    impact_input = ImpactAnalysisInput(
                        task_id="main_task",
                        change_type=change_type
                    )
                    
                    result = await get_task_impact_analysis(impact_input)
                    
                    assert result["success"] == True
                    assert result["impact_analysis"]["change_type"] == change_type
    
    @pytest.mark.asyncio 
    async def test_impact_analysis_with_graph_data(self, sample_task_with_dependencies):
        """Test impact analysis using knowledge graph data."""
        main_task, dependent_tasks = sample_task_with_dependencies
        
        with patch('mcp_server_triple_db.get_services') as mock_get_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.get_task.return_value = main_task
            
            # Mock KuzuDB for relationship analysis
            mock_kuzu = AsyncMock()
            mock_kuzu.query_task_relationships.return_value = [
                {"relationship": "depends_on", "task_id": "test_task", "weight": 0.8},
                {"relationship": "blocks", "task_id": "security_task", "weight": 0.6}
            ]
            
            mock_get_services.return_value = (mock_triple_db, None, mock_kuzu, None)
            
            with patch('mcp_server_triple_db._calculate_graph_impact') as mock_graph_impact:
                mock_graph_impact.return_value = {
                    "graph_relationships": 2,
                    "impact_radius": 3,
                    "criticality_score": 0.75
                }
                
                impact_input = ImpactAnalysisInput(
                    task_id="main_task",
                    change_type="complete",
                    include_dependencies=True
                )
                
                result = await get_task_impact_analysis(impact_input)
                
                assert result["success"] == True
                assert "graph_analysis" in result
                assert result["graph_analysis"]["impact_radius"] == 3


class TestProjectHealthAnalysis:
    """Test cases for project_health_analysis MCP tool."""
    
    @pytest.fixture
    def sample_project_tasks(self):
        """Create sample project with various task states."""
        return [
            Task(id="t1", title="Task 1", status=TaskStatus.COMPLETED, priority=TaskPriority.HIGH, project_id="health_test"),
            Task(id="t2", title="Task 2", status=TaskStatus.COMPLETED, priority=TaskPriority.NORMAL, project_id="health_test"),
            Task(id="t3", title="Task 3", status=TaskStatus.IN_PROGRESS, priority=TaskPriority.HIGH, project_id="health_test"),
            Task(id="t4", title="Task 4", status=TaskStatus.PENDING, priority=TaskPriority.NORMAL, project_id="health_test"),
            Task(id="t5", title="Task 5", status=TaskStatus.PENDING, priority=TaskPriority.LOW, project_id="health_test"),
            Task(id="t6", title="Task 6", status=TaskStatus.BLOCKED, priority=TaskPriority.HIGH, project_id="health_test"),
        ]
    
    @pytest.mark.asyncio
    async def test_health_analysis_single_project(self, sample_project_tasks):
        """Test health analysis for a single project."""
        with patch('mcp_server_triple_db.get_services') as mock_get_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.task_service.list_tasks.return_value = sample_project_tasks
            
            mock_get_services.return_value = (mock_triple_db, None, None, None)
            
            # Mock health calculations
            with patch('mcp_server_triple_db._calculate_project_health') as mock_health:
                mock_health.return_value = {
                    "overall_score": 75,
                    "letter_grade": "B",
                    "completion_rate": 33.3,  # 2/6 completed
                    "blocked_tasks": 1,
                    "high_priority_pending": 1,
                    "task_distribution": {
                        "completed": 2,
                        "in_progress": 1,
                        "pending": 2,
                        "blocked": 1
                    }
                }
                
                health_input = ProjectHealthInput(
                    project_id="health_test",
                    analysis_depth="standard",
                    include_predictions=True
                )
                
                result = await project_health_analysis(health_input)
                
                assert result["success"] == True
                assert "overall_health" in result
                assert "detailed_analysis" in result
                
                assert result["overall_health"]["score"] == 75
                assert result["overall_health"]["letter_grade"] == "B"
                assert result["detailed_analysis"]["task_management"]["completion_rate"] == 33.3
                assert result["detailed_analysis"]["task_management"]["total_tasks"] == 6
    
    @pytest.mark.asyncio
    async def test_health_analysis_all_projects(self, sample_project_tasks):
        """Test health analysis across all projects."""
        # Add tasks from multiple projects
        multi_project_tasks = sample_project_tasks + [
            Task(id="p2_t1", title="Project 2 Task 1", status=TaskStatus.COMPLETED, project_id="project_2"),
            Task(id="p2_t2", title="Project 2 Task 2", status=TaskStatus.PENDING, project_id="project_2"),
        ]
        
        with patch('mcp_server_triple_db.get_services') as mock_get_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.task_service.list_tasks.return_value = multi_project_tasks
            
            mock_get_services.return_value = (mock_triple_db, None, None, None)
            
            with patch('mcp_server_triple_db._calculate_multi_project_health') as mock_health:
                mock_health.return_value = {
                    "overall_score": 70,
                    "letter_grade": "B-",
                    "projects_analyzed": 2,
                    "total_tasks": 8,
                    "average_completion_rate": 37.5,
                    "project_breakdown": {
                        "health_test": {"score": 75, "tasks": 6},
                        "project_2": {"score": 50, "tasks": 2}
                    }
                }
                
                health_input = ProjectHealthInput(
                    project_id=None,  # All projects
                    analysis_depth="comprehensive",
                    include_predictions=True
                )
                
                result = await project_health_analysis(health_input)
                
                assert result["success"] == True
                assert result["overall_health"]["score"] == 70
                assert result["detailed_analysis"]["projects_analyzed"] == 2
                assert "project_breakdown" in result["detailed_analysis"]
    
    @pytest.mark.asyncio
    async def test_health_analysis_with_predictions(self, sample_project_tasks):
        """Test health analysis with prediction capabilities."""
        with patch('mcp_server_triple_db.get_services') as mock_get_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.task_service.list_tasks.return_value = sample_project_tasks
            
            mock_get_services.return_value = (mock_triple_db, None, None, None)
            
            with patch('mcp_server_triple_db._generate_health_predictions') as mock_predictions:
                mock_predictions.return_value = {
                    "completion_forecast": {
                        "estimated_completion": "2024-03-15",
                        "confidence": 0.75,
                        "risk_factors": ["High priority blocked task", "Resource constraints"]
                    },
                    "health_trends": {
                        "direction": "improving",
                        "velocity": 0.2,
                        "sustainability": "moderate"
                    }
                }
                
                health_input = ProjectHealthInput(
                    project_id="health_test",
                    include_predictions=True
                )
                
                result = await project_health_analysis(health_input)
                
                assert result["success"] == True
                assert "predictions" in result
                assert "completion_forecast" in result["predictions"]
                assert "health_trends" in result["predictions"]
                assert result["predictions"]["completion_forecast"]["confidence"] == 0.75
    
    @pytest.mark.asyncio
    async def test_health_analysis_empty_project(self):
        """Test health analysis with empty project."""
        with patch('mcp_server_triple_db.get_services') as mock_get_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.task_service.list_tasks.return_value = []
            
            mock_get_services.return_value = (mock_triple_db, None, None, None)
            
            health_input = ProjectHealthInput(
                project_id="empty_project"
            )
            
            result = await project_health_analysis(health_input)
            
            assert result["success"] == False
            assert "no tasks found" in result["error"].lower()
    
    @pytest.mark.asyncio
    async def test_health_analysis_depth_levels(self, sample_project_tasks):
        """Test different analysis depth levels."""
        depth_levels = ["basic", "standard", "comprehensive"]
        
        for depth in depth_levels:
            with patch('mcp_server_triple_db.get_services') as mock_get_services:
                mock_triple_db = AsyncMock()
                mock_triple_db.task_service.list_tasks.return_value = sample_project_tasks
                
                mock_get_services.return_value = (mock_triple_db, None, None, None)
                
                with patch('mcp_server_triple_db._calculate_project_health') as mock_health:
                    mock_health.return_value = {
                        "analysis_depth": depth,
                        "overall_score": 70,
                        "letter_grade": "B-"
                    }
                    
                    health_input = ProjectHealthInput(
                        project_id="health_test",
                        analysis_depth=depth
                    )
                    
                    result = await project_health_analysis(health_input)
                    
                    assert result["success"] == True
                    assert result["detailed_analysis"]["analysis_depth"] == depth


class TestMCPToolsIntegration:
    """Integration tests for MCP tools working with triple database system."""
    
    @pytest.mark.asyncio
    async def test_tools_database_unavailable(self):
        """Test graceful degradation when databases are unavailable."""
        tools_to_test = [
            (semantic_task_clustering, ClusteringInput()),
            (get_task_impact_analysis, ImpactAnalysisInput(task_id="test")),
            (project_health_analysis, ProjectHealthInput())
        ]
        
        for tool_func, tool_input in tools_to_test:
            with patch('mcp_server_triple_db.get_services') as mock_get_services:
                # Simulate database unavailable
                mock_get_services.side_effect = Exception("Database connection failed")
                
                result = await tool_func(tool_input)
                
                assert result["success"] == False
                assert "error" in result
                assert "database" in result["error"].lower() or "connection" in result["error"].lower()
    
    @pytest.mark.asyncio
    async def test_tools_error_handling(self):
        """Test error handling in MCP tools."""
        with patch('mcp_server_triple_db.get_services') as mock_get_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.task_service.list_tasks.side_effect = Exception("Database query failed")
            
            mock_get_services.return_value = (mock_triple_db, None, None, None)
            
            clustering_input = ClusteringInput(num_clusters=3)
            result = await semantic_task_clustering(clustering_input)
            
            assert result["success"] == False
            assert "error" in result
    
    @pytest.mark.asyncio 
    async def test_tools_performance_large_dataset(self):
        """Test tool performance with large datasets."""
        # Create large dataset for performance testing
        large_task_set = [
            Task(
                id=f"perf_task_{i}",
                title=f"Performance Test Task {i}",
                description=f"Task {i} for performance testing",
                status=TaskStatus.PENDING,
                project_id="performance_test"
            )
            for i in range(1000)  # 1000 tasks
        ]
        
        with patch('mcp_server_triple_db.get_services') as mock_get_services:
            mock_triple_db = AsyncMock()
            mock_triple_db.task_service.list_tasks.return_value = large_task_set
            
            mock_chroma = AsyncMock()
            # Mock embeddings for all tasks
            mock_embeddings = {f"perf_task_{i}": [0.1] * 384 for i in range(1000)}
            mock_chroma.get_task_embeddings.return_value = mock_embeddings
            
            mock_get_services.return_value = (mock_triple_db, mock_chroma, None, None)
            
            # Mock clustering for performance test
            with patch('mcp_server_triple_db._perform_clustering') as mock_cluster:
                mock_cluster.return_value = {
                    "clusters": [{"cluster_id": "perf_cluster", "tasks": [f"perf_task_{i}" for i in range(100)]}],
                    "outliers": []
                }
                
                clustering_input = ClusteringInput(
                    project_id="performance_test",
                    num_clusters=10
                )
                
                import time
                start_time = time.time()
                result = await semantic_task_clustering(clustering_input)
                end_time = time.time()
                
                processing_time = end_time - start_time
                
                assert result["success"] == True
                assert processing_time < 10.0  # Should complete within 10 seconds
                assert result["clustering_summary"]["total_tasks_analyzed"] == 1000


if __name__ == "__main__":
    pytest.main([__file__])