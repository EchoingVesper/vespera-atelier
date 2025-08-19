#!/usr/bin/env python3
"""
Test script for the 3 new high-value MCP tools.

This script tests:
1. semantic_task_clustering
2. get_task_impact_analysis  
3. project_health_analysis
"""

import asyncio
import sys
import logging
from pathlib import Path

# Add the package to path
sys.path.insert(0, str(Path(__file__).parent))

from mcp_server_triple_db import (
    ClusteringInput, ImpactAnalysisInput, ProjectHealthInput,
    semantic_task_clustering, get_task_impact_analysis, project_health_analysis,
    get_services, _triple_db_service, _chroma_service, _kuzu_service, _sync_coordinator
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def initialize_test_environment():
    """Initialize the triple database system for testing."""
    try:
        # Import the lifespan manager
        from mcp_server_triple_db import lifespan, mcp
        
        # Use the lifespan context manager to initialize services
        async with lifespan(mcp):
            logger.info("Triple database system initialized for testing")
            return True
    except Exception as e:
        logger.error(f"Failed to initialize test environment: {e}")
        return False


async def test_semantic_task_clustering():
    """Test the semantic task clustering tool."""
    logger.info("Testing semantic_task_clustering...")
    
    try:
        # Test with default parameters
        clustering_input = ClusteringInput(
            project_id=None,  # Test with all projects
            num_clusters=3,
            similarity_threshold=0.5,
            include_completed=True,
            min_cluster_size=2
        )
        
        result = await semantic_task_clustering(clustering_input)
        
        if result.get("success"):
            logger.info(f"✅ Clustering successful: {result['clustering_summary']}")
            logger.info(f"   Found {result['clustering_summary']['clusters_found']} clusters")
            logger.info(f"   Analyzed {result['clustering_summary']['total_tasks_analyzed']} tasks")
        else:
            logger.warning(f"⚠️  Clustering failed (may be expected if no tasks): {result.get('error')}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error testing clustering: {e}")
        return {"success": False, "error": str(e)}


async def test_task_impact_analysis():
    """Test the task impact analysis tool."""
    logger.info("Testing get_task_impact_analysis...")
    
    try:
        # First, get a list of tasks to test with
        triple_db_service, _, _, _ = get_services()
        tasks = await triple_db_service.task_service.list_tasks(limit=5)
        
        if not tasks:
            logger.warning("⚠️  No tasks available for impact analysis testing")
            return {"success": False, "error": "No tasks available"}
        
        # Test with the first available task
        test_task = tasks[0]
        impact_input = ImpactAnalysisInput(
            task_id=test_task.id,
            change_type="complete",
            include_dependencies=True,
            include_resource_impact=True
        )
        
        result = await get_task_impact_analysis(impact_input)
        
        if result.get("success"):
            logger.info(f"✅ Impact analysis successful for task: {result['task']['title']}")
            logger.info(f"   Affected tasks: {result['summary']['total_affected_tasks']}")
            logger.info(f"   Impact severity: {result['summary']['impact_severity']}")
        else:
            logger.error(f"❌ Impact analysis failed: {result.get('error')}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error testing impact analysis: {e}")
        return {"success": False, "error": str(e)}


async def test_project_health_analysis():
    """Test the project health analysis tool."""
    logger.info("Testing project_health_analysis...")
    
    try:
        # Test with all projects
        health_input = ProjectHealthInput(
            project_id=None,
            analysis_depth="standard",
            include_predictions=True
        )
        
        result = await project_health_analysis(health_input)
        
        if result.get("success"):
            logger.info(f"✅ Health analysis successful")
            logger.info(f"   Overall grade: {result['overall_health']['letter_grade']}")
            logger.info(f"   Health score: {result['overall_health']['score']}%")
            logger.info(f"   Tasks analyzed: {result['detailed_analysis']['task_management']['total_tasks']}")
            logger.info(f"   Completion rate: {result['detailed_analysis']['task_management']['completion_rate']}%")
        else:
            logger.error(f"❌ Health analysis failed: {result.get('error')}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error testing health analysis: {e}")
        return {"success": False, "error": str(e)}


async def main():
    """Run all tests."""
    logger.info("🚀 Starting MCP tools testing...")
    
    # Initialize test environment
    success = await initialize_test_environment()
    if not success:
        logger.error("❌ Failed to initialize test environment")
        return 1
    
    # Run tests
    results = {}
    
    logger.info("\n" + "="*50)
    results["clustering"] = await test_semantic_task_clustering()
    
    logger.info("\n" + "="*50)
    results["impact_analysis"] = await test_task_impact_analysis()
    
    logger.info("\n" + "="*50)
    results["health_analysis"] = await test_project_health_analysis()
    
    # Summary
    logger.info("\n" + "="*50)
    logger.info("🎯 TEST SUMMARY:")
    success_count = sum(1 for result in results.values() if result.get("success"))
    total_count = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result.get("success") else "❌ FAIL"
        logger.info(f"   {test_name:20}: {status}")
    
    logger.info(f"\n📊 Overall: {success_count}/{total_count} tests passed")
    
    if success_count == total_count:
        logger.info("🎉 All MCP tools working correctly!")
        return 0
    else:
        logger.warning(f"⚠️  {total_count - success_count} tests failed or had issues")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)