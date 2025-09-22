#!/usr/bin/env python3
"""
Vespera V2 REST API Server Startup Script

Starts the FastAPI server with proper configuration for plugin integration.
"""

import sys
import logging
import asyncio
from pathlib import Path

# Add the package to path
sys.path.insert(0, str(Path(__file__).parent))

import uvicorn
from api.server import app
from api.websocket import connection_health_monitor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def startup_tasks():
    """Run startup tasks in the background."""
    # Start WebSocket connection health monitor
    asyncio.create_task(connection_health_monitor())
    logger.info("Started WebSocket connection health monitor")


if __name__ == "__main__":
    logger.info("🚀 Starting Vespera V2 REST API Server")
    
    # Configuration
    config = {
        "app": "run_api_server:app",
        "host": "0.0.0.0",
        "port": 8000,
        "reload": True,  # Enable for development
        "log_level": "info",
        "access_log": True,
        "workers": 1,  # Use 1 worker for development
    }
    
    # Start background tasks
    asyncio.run(startup_tasks())
    
    # Start the server
    logger.info(f"Starting server on http://{config['host']}:{config['port']}")
    logger.info(f"API Documentation: http://{config['host']}:{config['port']}/docs")
    logger.info(f"WebSocket endpoint: ws://{config['host']}:{config['port']}/ws/plugins")
    
    uvicorn.run(**config)