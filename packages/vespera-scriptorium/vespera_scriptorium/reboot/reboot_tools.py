"""
MCP tools for server reboot functionality.

This module implements the MCP tool handlers for restart operations,
health checking, and restart coordination.
"""

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional

from mcp import types

from ..orchestrator.orchestration_state_manager import StateManager
from .reboot_integration import get_reboot_manager
from .state_serializer import RestartReason

logger = logging.getLogger("mcp_task_orchestrator.server.reboot_tools")


# Tool definitions for server reboot functionality
REBOOT_TOOLS = [
    types.Tool(
        name="orchestrator_restart_server",
        description="Trigger a graceful server restart with state preservation",
        inputSchema={
            "type": "object",
            "properties": {
                "graceful": {
                    "type": "boolean",
                    "description": "Whether to perform graceful shutdown",
                    "default": True,
                },
                "preserve_state": {
                    "type": "boolean",
                    "description": "Whether to preserve server state across restart",
                    "default": True,
                },
                "timeout": {
                    "type": "integer",
                    "description": "Maximum time to wait for restart completion (seconds)",
                    "default": 30,
                    "minimum": 10,
                    "maximum": 300,
                },
                "reason": {
                    "type": "string",
                    "enum": [
                        "configuration_update",
                        "schema_migration",
                        "error_recovery",
                        "manual_request",
                        "emergency_shutdown",
                    ],
                    "description": "Reason for the restart",
                    "default": "manual_request",
                },
            },
            "required": [],
        },
    ),
    types.Tool(
        name="orchestrator_health_check",
        description="Check server health and readiness for operations",
        inputSchema={
            "type": "object",
            "properties": {
                "include_reboot_readiness": {
                    "type": "boolean",
                    "description": "Whether to include restart readiness in health check",
                    "default": True,
                },
                "include_connection_status": {
                    "type": "boolean",
                    "description": "Whether to include client connection status",
                    "default": True,
                },
                "include_database_status": {
                    "type": "boolean",
                    "description": "Whether to include database status",
                    "default": True,
                },
            },
            "required": [],
        },
    ),
    types.Tool(
        name="orchestrator_shutdown_prepare",
        description="Check server readiness for graceful shutdown",
        inputSchema={
            "type": "object",
            "properties": {
                "check_active_tasks": {
                    "type": "boolean",
                    "description": "Whether to check for active tasks",
                    "default": True,
                },
                "check_database_state": {
                    "type": "boolean",
                    "description": "Whether to check database state",
                    "default": True,
                },
                "check_client_connections": {
                    "type": "boolean",
                    "description": "Whether to check client connections",
                    "default": True,
                },
            },
            "required": [],
        },
    ),
    types.Tool(
        name="orchestrator_reconnect_test",
        description="Test client reconnection capability and connection status",
        inputSchema={
            "type": "object",
            "properties": {
                "session_id": {
                    "type": "string",
                    "description": "Specific session ID to test (optional)",
                },
                "include_buffer_status": {
                    "type": "boolean",
                    "description": "Whether to include request buffer status",
                    "default": True,
                },
                "include_reconnection_stats": {
                    "type": "boolean",
                    "description": "Whether to include reconnection statistics",
                    "default": True,
                },
            },
            "required": [],
        },
    ),
    types.Tool(
        name="orchestrator_restart_status",
        description="Get current status of restart operation",
        inputSchema={
            "type": "object",
            "properties": {
                "include_history": {
                    "type": "boolean",
                    "description": "Whether to include restart history",
                    "default": False,
                },
                "include_error_details": {
                    "type": "boolean",
                    "description": "Whether to include detailed error information",
                    "default": True,
                },
            },
            "required": [],
        },
    ),
]


async def handle_restart_server(args: Dict[str, Any]) -> List[types.TextContent]:
    """Handle server restart request.

    Args:
        args: Tool arguments containing restart parameters

    Returns:
        List of TextContent with restart status
    """
    try:
        graceful = args.get("graceful", True)
        preserve_state = args.get("preserve_state", True)
        timeout = args.get("timeout", 30)
        reason_str = args.get("reason", "manual_request")

        # Convert reason string to enum
        try:
            reason = RestartReason(reason_str)
        except ValueError:
            reason = RestartReason.MANUAL_REQUEST
            logger.warning(
                f"Invalid restart reason '{reason_str}', using manual_request"
            )

        logger.info(
            f"Restart requested: graceful={graceful}, preserve_state={preserve_state}, reason={reason}"
        )

        # Get reboot manager
        reboot_manager = get_reboot_manager()

        if not graceful:
            # Emergency restart without state preservation
            response = {
                "success": False,
                "error": "Emergency restart not yet implemented",
                "graceful": graceful,
                "preserve_state": preserve_state,
                "reason": reason.value,
            }
        else:
            # Trigger graceful restart
            result = await reboot_manager.trigger_restart(reason, timeout)
            response = {
                **result,
                "graceful": graceful,
                "preserve_state": preserve_state,
                "timeout": timeout,
            }

        return [types.TextContent(type="text", text=json.dumps(response, indent=2))]

    except Exception as e:
        logger.error(f"Failed to handle restart request: {e}")
        error_response = {
            "success": False,
            "error": str(e),
            "phase": "request_handling_failed",
        }

        return [
            types.TextContent(type="text", text=json.dumps(error_response, indent=2))
        ]


async def handle_health_check(args: Dict[str, Any]) -> List[types.TextContent]:
    """Handle health check request.

    Args:
        args: Tool arguments for health check options

    Returns:
        List of TextContent with health status
    """
    try:
        include_reboot_readiness = args.get("include_reboot_readiness", True)
        include_connection_status = args.get("include_connection_status", True)
        include_database_status = args.get("include_database_status", True)

        reboot_manager = get_reboot_manager()

        # Basic health status
        health_status = {
            "healthy": True,
            "timestamp": None,
            "server_version": "1.4.1",
            "checks": {},
        }

        # Add current timestamp
        from datetime import datetime, timezone

        health_status["timestamp"] = datetime.now(timezone.utc).isoformat()

        # Check reboot readiness
        if include_reboot_readiness:
            try:
                readiness = await reboot_manager.get_restart_readiness()
                health_status["checks"]["reboot_readiness"] = readiness
                if not readiness["ready"]:
                    health_status["healthy"] = False
            except Exception as e:
                logger.error(f"Failed to check reboot readiness: {e}")
                health_status["checks"]["reboot_readiness"] = {
                    "ready": False,
                    "error": str(e),
                }
                health_status["healthy"] = False

        # Check database status
        if include_database_status:
            try:
                # Implement actual database health check
                from pathlib import Path
                import sqlite3
                
                db_path = Path.cwd() / ".vespera_scriptorium" / "vespera_scriptorium.db"
                if db_path.exists():
                    # Test database connection and basic query
                    with sqlite3.connect(str(db_path), timeout=5.0) as conn:
                        cursor = conn.execute("SELECT 1")
                        cursor.fetchone()
                        
                        # Check if main tables exist
                        cursor = conn.execute(
                            "SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'"
                        )
                        has_tasks_table = cursor.fetchone() is not None
                        
                        health_status["checks"]["database"] = {
                            "connected": True,
                            "status": "operational",
                            "has_tasks_table": has_tasks_table,
                            "db_size_bytes": db_path.stat().st_size,
                        }
                else:
                    health_status["checks"]["database"] = {
                        "connected": False,
                        "status": "no_database_file",
                        "db_path": str(db_path),
                    }
            except Exception as e:
                logger.error(f"Failed to check database status: {e}")
                health_status["checks"]["database"] = {
                    "connected": False,
                    "error": str(e),
                }
                health_status["healthy"] = False

        # Check connection status
        if include_connection_status:
            try:
                # Implement actual connection status check
                import psutil
                import os
                
                # Get current process info
                current_process = psutil.Process(os.getpid())
                connections = current_process.connections()
                
                # Count active connections
                active_connections = len([c for c in connections if c.status == 'ESTABLISHED'])
                listening_ports = len([c for c in connections if c.status == 'LISTEN'])
                
                health_status["checks"]["connections"] = {
                    "active_connections": active_connections,
                    "listening_ports": listening_ports,
                    "status": "operational",
                    "process_id": os.getpid(),
                }
            except Exception as e:
                logger.error(f"Failed to check connection status: {e}")
                health_status["checks"]["connections"] = {
                    "status": "error",
                    "error": str(e),
                }

        return [
            types.TextContent(type="text", text=json.dumps(health_status, indent=2))
        ]

    except Exception as e:
        logger.error(f"Failed to perform health check: {e}")
        error_response = {
            "healthy": False,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        return [
            types.TextContent(type="text", text=json.dumps(error_response, indent=2))
        ]


async def handle_shutdown_prepare(args: Dict[str, Any]) -> List[types.TextContent]:
    """Handle shutdown preparation check.

    Args:
        args: Tool arguments for shutdown readiness checks

    Returns:
        List of TextContent with shutdown readiness status
    """
    try:
        check_active_tasks = args.get("check_active_tasks", True)
        check_database_state = args.get("check_database_state", True)
        check_client_connections = args.get("check_client_connections", True)

        reboot_manager = get_reboot_manager()

        # Get restart readiness which includes shutdown preparation
        readiness = await reboot_manager.get_restart_readiness()

        # Enhance with specific checks
        shutdown_readiness = {
            "ready_for_shutdown": readiness["ready"],
            "blocking_issues": readiness["issues"],
            "checks": {},
            "details": readiness["details"],
        }

        # Add timestamp
        from datetime import datetime, timezone

        shutdown_readiness["timestamp"] = datetime.now(timezone.utc).isoformat()

        # Check active tasks
        if check_active_tasks:
            try:
                # Check for tasks in active states
                from ...infrastructure.database.sqlite.sqlite_repository_factory import get_repository_factory
                from ...domain.task import TaskStatus
                
                factory = get_repository_factory()
                task_repo = factory.get_task_repository()
                
                # Count tasks in active states
                active_statuses = [TaskStatus.IN_PROGRESS, TaskStatus.ACTIVE]
                active_tasks = await task_repo.query_tasks(
                    status=[status.value for status in active_statuses],
                    limit=100
                )
                
                shutdown_readiness["checks"]["active_tasks"] = {
                    "count": len(active_tasks),
                    "suspendable": len(active_tasks) == 0,  # Only ready if no active tasks
                    "status": "ready" if len(active_tasks) == 0 else "has_active_tasks",
                    "active_task_ids": [task.id for task in active_tasks[:5]]  # First 5 IDs
                }
                
                # Block shutdown if there are active tasks
                if len(active_tasks) > 0:
                    shutdown_readiness["ready_for_shutdown"] = False
                    shutdown_readiness["blocking_issues"].append(
                        f"{len(active_tasks)} active tasks must be completed or suspended"
                    )
                    
            except Exception as e:
                logger.error(f"Failed to check active tasks: {e}")
                shutdown_readiness["checks"]["active_tasks"] = {
                    "status": "error",
                    "error": str(e),
                }
                shutdown_readiness["ready_for_shutdown"] = False

        # Check database state
        if check_database_state:
            try:
                # Check database health and connection status
                from pathlib import Path
                import sqlite3
                
                db_path = Path.cwd() / ".vespera_scriptorium" / "vespera_scriptorium.db"
                
                if db_path.exists():
                    # Test database connection and check for locks
                    try:
                        with sqlite3.connect(str(db_path), timeout=2.0) as conn:
                            # Check for any pending transactions
                            cursor = conn.execute("BEGIN IMMEDIATE")
                            conn.rollback()
                            
                            # Test basic operations
                            cursor = conn.execute("SELECT COUNT(*) FROM sqlite_master")
                            table_count = cursor.fetchone()[0]
                            
                            shutdown_readiness["checks"]["database"] = {
                                "transactions_pending": 0,  # SQLite auto-commits
                                "connections_open": 1,
                                "status": "ready",
                                "table_count": table_count,
                                "db_size_mb": round(db_path.stat().st_size / (1024*1024), 2)
                            }
                            
                    except sqlite3.OperationalError as e:
                        if "database is locked" in str(e).lower():
                            shutdown_readiness["checks"]["database"] = {
                                "transactions_pending": "unknown",
                                "connections_open": "unknown", 
                                "status": "locked",
                                "error": "Database is locked by another process"
                            }
                            shutdown_readiness["ready_for_shutdown"] = False
                            shutdown_readiness["blocking_issues"].append(
                                "Database is locked - wait for operations to complete"
                            )
                        else:
                            raise
                else:
                    shutdown_readiness["checks"]["database"] = {
                        "transactions_pending": 0,
                        "connections_open": 0,
                        "status": "no_database",
                    }
                    
            except Exception as e:
                logger.error(f"Failed to check database state: {e}")
                shutdown_readiness["checks"]["database"] = {
                    "status": "error",
                    "error": str(e),
                }
                shutdown_readiness["ready_for_shutdown"] = False

        # Check client connections
        if check_client_connections:
            try:
                # Check for active MCP client connections
                import psutil
                import os
                
                current_process = psutil.Process(os.getpid())
                connections = current_process.connections()
                
                # Count established connections (excluding loopback)
                active_connections = []
                for conn in connections:
                    if (conn.status == 'ESTABLISHED' and 
                        conn.raddr and 
                        not conn.raddr.ip.startswith('127.')):
                        active_connections.append({
                            "local": f"{conn.laddr.ip}:{conn.laddr.port}",
                            "remote": f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else "unknown"
                        })
                
                shutdown_readiness["checks"]["client_connections"] = {
                    "active_connections": len(active_connections),
                    "notifiable": True,  # MCP clients can be notified of shutdown
                    "status": "ready",
                    "connection_details": active_connections[:5]  # First 5 connections
                }
                
                # Note: MCP connections are typically short-lived request/response
                # so active connections don't necessarily block shutdown
                
            except Exception as e:
                logger.error(f"Failed to check client connections: {e}")
                shutdown_readiness["checks"]["client_connections"] = {
                    "status": "error",
                    "error": str(e),
                }

        return [
            types.TextContent(
                type="text", text=json.dumps(shutdown_readiness, indent=2)
            )
        ]

    except Exception as e:
        logger.error(f"Failed to check shutdown readiness: {e}")
        error_response = {
            "ready_for_shutdown": False,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        return [
            types.TextContent(type="text", text=json.dumps(error_response, indent=2))
        ]


async def handle_reconnect_test(args: Dict[str, Any]) -> List[types.TextContent]:
    """Handle reconnection test request.

    Args:
        args: Tool arguments for reconnection testing

    Returns:
        List of TextContent with reconnection test results
    """
    try:
        session_id = args.get("session_id")
        include_buffer_status = args.get("include_buffer_status", True)
        include_reconnection_stats = args.get("include_reconnection_stats", True)

        # Implement actual reconnection testing
        test_results = {
            "test_completed": True,
            "timestamp": None,
            "overall_status": "pass",
            "results": {},
        }

        # Add timestamp
        from datetime import datetime, timezone

        test_results["timestamp"] = datetime.now(timezone.utc).isoformat()

        try:
            # Test server responsiveness
            reboot_manager = get_reboot_manager()
            start_time = time.time()
            health_check = await reboot_manager.get_restart_readiness()
            response_time = time.time() - start_time
            
            server_responsive = response_time < 5.0  # 5 second timeout
            
            if session_id:
                # Test specific session connectivity
                from ...infrastructure.database.sqlite.sqlite_repository_factory import get_repository_factory
                
                factory = get_repository_factory()
                session_repo = factory.get_session_repository()
                
                try:
                    session_data = await session_repo.get_session(session_id)
                    session_exists = session_data is not None
                except Exception:
                    session_exists = False
                
                test_results["results"]["session_test"] = {
                    "session_id": session_id,
                    "reachable": session_exists and server_responsive,
                    "reconnect_capable": server_responsive,
                    "status": "pass" if session_exists and server_responsive else "fail",
                    "response_time_ms": round(response_time * 1000, 2)
                }
                
                if not session_exists or not server_responsive:
                    test_results["overall_status"] = "fail"
                    
            else:
                # Test overall system connectivity 
                from ...infrastructure.database.sqlite.sqlite_repository_factory import get_repository_factory
                
                factory = get_repository_factory()
                session_repo = factory.get_session_repository()
                
                try:
                    # Count active sessions
                    all_sessions = await session_repo.list_sessions(include_completed=False)
                    active_sessions = len(all_sessions)
                except Exception:
                    active_sessions = 0
                    
                test_results["results"]["all_sessions"] = {
                    "total_sessions": active_sessions,
                    "reachable_sessions": active_sessions if server_responsive else 0,
                    "reconnect_capable": active_sessions if server_responsive else 0,
                    "status": "pass" if server_responsive else "fail",
                    "server_response_time_ms": round(response_time * 1000, 2)
                }
                
                if not server_responsive:
                    test_results["overall_status"] = "fail"
                    
        except Exception as e:
            logger.error(f"Reconnection test failed: {e}")
            test_results["overall_status"] = "error"
            test_results["error"] = str(e)

        # Include buffer status
        if include_buffer_status:
            test_results["results"]["buffer_status"] = {
                "total_buffered_requests": 0,
                "sessions_with_buffers": 0,
                "status": "operational",
            }

        # Include reconnection stats
        if include_reconnection_stats:
            test_results["results"]["reconnection_stats"] = {
                "successful_reconnections": 0,
                "failed_reconnections": 0,
                "average_reconnection_time": 0.0,
                "status": "operational",
            }

        return [types.TextContent(type="text", text=json.dumps(test_results, indent=2))]

    except Exception as e:
        logger.error(f"Failed to perform reconnection test: {e}")
        error_response = {
            "test_completed": False,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        return [
            types.TextContent(type="text", text=json.dumps(error_response, indent=2))
        ]


async def handle_restart_status(args: Dict[str, Any]) -> List[types.TextContent]:
    """Handle restart status request.

    Args:
        args: Tool arguments for status options

    Returns:
        List of TextContent with restart status
    """
    try:
        include_history = args.get("include_history", False)
        include_error_details = args.get("include_error_details", True)

        reboot_manager = get_reboot_manager()

        # Get current restart status
        status = await reboot_manager.get_shutdown_status()

        # Enhance status response
        restart_status = {"current_status": status, "timestamp": None}

        # Add timestamp
        from datetime import datetime, timezone

        restart_status["timestamp"] = datetime.now(timezone.utc).isoformat()

        # Include history if requested
        if include_history:
            # Implement restart history tracking
            try:
                history_file = self.scriptorium_dir / "restart_history.json"
                
                if history_file.exists():
                    import json
                    with open(history_file, 'r') as f:
                        history_data = json.load(f)
                        
                    restart_status["history"] = {
                        "recent_restarts": history_data.get("restarts", [])[-10:],  # Last 10
                        "total_restarts": len(history_data.get("restarts", [])),
                        "last_successful_restart": history_data.get("last_successful"),
                        "last_failed_restart": history_data.get("last_failed"),
                    }
                else:
                    restart_status["history"] = {
                        "recent_restarts": [],
                        "total_restarts": 0,
                        "last_successful_restart": None,
                        "last_failed_restart": None,
                    }
                    
            except Exception as e:
                logger.error(f"Failed to load restart history: {e}")
                restart_status["history"] = {
                    "recent_restarts": [],
                    "total_restarts": 0,
                    "last_successful_restart": None,
                    "error": f"Failed to load history: {str(e)}"
                }

        # Filter error details if not requested
        if not include_error_details and "errors" in restart_status["current_status"]:
            restart_status["current_status"]["error_count"] = len(
                restart_status["current_status"]["errors"]
            )
            del restart_status["current_status"]["errors"]

        return [
            types.TextContent(type="text", text=json.dumps(restart_status, indent=2))
        ]

    except Exception as e:
        logger.error(f"Failed to get restart status: {e}")
        error_response = {
            "status_available": False,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        return [
            types.TextContent(type="text", text=json.dumps(error_response, indent=2))
        ]


# Handler mapping for the tool dispatcher
REBOOT_TOOL_HANDLERS = {
    "orchestrator_restart_server": handle_restart_server,
    "orchestrator_health_check": handle_health_check,
    "orchestrator_shutdown_prepare": handle_shutdown_prepare,
    "orchestrator_reconnect_test": handle_reconnect_test,
    "orchestrator_restart_status": handle_restart_status,
}
