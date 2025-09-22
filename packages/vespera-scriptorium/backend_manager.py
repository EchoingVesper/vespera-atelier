"""
Backend process manager for the Bindery Rust server.

This module handles the automatic lifecycle management of the Bindery backend:
- Building the Rust binary if needed
- Starting the backend process
- Health checking and waiting for readiness
- Graceful shutdown on exit
"""

import asyncio
import subprocess
import sys
import os
import time
import signal
from pathlib import Path
from typing import Optional
import httpx
import structlog

logger = structlog.get_logger()


class BinderyBackendManager:
    """Manages the lifecycle of the Bindery Rust backend server."""

    def __init__(
        self,
        bindery_path: Optional[str] = None,
        port: int = 3000,
        build_timeout: int = 120,
        startup_timeout: int = 30,
        health_check_interval: float = 0.5,
    ):
        """
        Initialize the backend manager.

        Args:
            bindery_path: Path to the Bindery project directory
            port: Port for the backend server
            build_timeout: Timeout for building the Rust binary (seconds)
            startup_timeout: Timeout for backend startup (seconds)
            health_check_interval: Interval between health checks (seconds)
        """
        # Determine the Bindery project path
        if bindery_path:
            self.bindery_path = Path(bindery_path)
        else:
            # Default path relative to this script
            script_dir = Path(__file__).parent
            self.bindery_path = (
                script_dir.parent / "vespera-utilities" / "vespera-bindery"
            )

        self.port = port
        self.build_timeout = build_timeout
        self.startup_timeout = startup_timeout
        self.health_check_interval = health_check_interval

        self.process: Optional[subprocess.Popen] = None
        self.binary_path = self.bindery_path / "target" / "debug" / "bindery-server"

        # Health check URL
        self.health_url = f"http://localhost:{self.port}/health"

    def build_backend(self) -> bool:
        """
        Build the Bindery backend if the binary doesn't exist.

        Returns:
            True if build successful or binary already exists, False otherwise
        """
        if self.binary_path.exists():
            logger.info("Bindery binary already exists", path=str(self.binary_path))
            return True

        logger.info("Building Bindery backend", path=str(self.bindery_path))

        try:
            # Run cargo build in the Bindery directory
            result = subprocess.run(
                ["cargo", "build", "--bin", "bindery-server"],
                cwd=self.bindery_path,
                capture_output=True,
                text=True,
                timeout=self.build_timeout
            )

            if result.returncode == 0:
                logger.info("Bindery backend built successfully")
                return True
            else:
                logger.error(
                    "Failed to build Bindery backend",
                    stderr=result.stderr,
                    returncode=result.returncode
                )
                return False

        except subprocess.TimeoutExpired:
            logger.error(
                "Build timeout exceeded",
                timeout=self.build_timeout
            )
            return False
        except Exception as e:
            logger.error("Build failed with exception", error=str(e))
            return False

    def start_backend(self) -> bool:
        """
        Start the Bindery backend process.

        Returns:
            True if process started successfully, False otherwise
        """
        if self.process and self.process.poll() is None:
            logger.warning("Backend process already running")
            return True

        if not self.binary_path.exists():
            logger.error("Bindery binary not found", path=str(self.binary_path))
            return False

        logger.info(
            "Starting Bindery backend",
            binary=str(self.binary_path),
            port=self.port
        )

        try:
            # Set environment variables for the backend
            env = os.environ.copy()
            env["BINDERY_PORT"] = str(self.port)
            env["RUST_LOG"] = "info"

            # Start the backend process
            self.process = subprocess.Popen(
                [str(self.binary_path)],
                cwd=self.bindery_path,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            # Give it a moment to start
            time.sleep(0.5)

            # Check if process is still running
            if self.process.poll() is not None:
                # Process terminated immediately
                stdout, stderr = self.process.communicate(timeout=1)
                logger.error(
                    "Backend process terminated immediately",
                    stdout=stdout,
                    stderr=stderr,
                    returncode=self.process.returncode
                )
                return False

            logger.info("Backend process started", pid=self.process.pid)
            return True

        except Exception as e:
            logger.error("Failed to start backend", error=str(e))
            return False

    def wait_for_health(self) -> bool:
        """
        Wait for the backend to become healthy.

        Returns:
            True if backend becomes healthy within timeout, False otherwise
        """
        logger.info(
            "Waiting for backend to become healthy",
            url=self.health_url,
            timeout=self.startup_timeout
        )

        start_time = time.time()
        last_error = None

        while time.time() - start_time < self.startup_timeout:
            try:
                # Check if process is still running
                if self.process and self.process.poll() is not None:
                    stdout, stderr = self.process.communicate(timeout=1)
                    logger.error(
                        "Backend process terminated",
                        stdout=stdout,
                        stderr=stderr
                    )
                    return False

                # Try health check
                with httpx.Client(timeout=2.0) as client:
                    response = client.get(self.health_url)
                    if response.status_code == 200:
                        logger.info("Backend is healthy", response=response.json())
                        return True
                    else:
                        last_error = f"Health check returned {response.status_code}"

            except httpx.ConnectError:
                last_error = "Connection refused"
            except Exception as e:
                last_error = str(e)

            time.sleep(self.health_check_interval)

        logger.error(
            "Backend health check timeout",
            timeout=self.startup_timeout,
            last_error=last_error
        )
        return False

    def stop_backend(self, timeout: int = 5) -> None:
        """
        Stop the backend process gracefully.

        Args:
            timeout: Timeout for graceful shutdown (seconds)
        """
        if not self.process:
            logger.info("No backend process to stop")
            return

        if self.process.poll() is not None:
            logger.info(
                "Backend process already terminated",
                returncode=self.process.returncode
            )
            return

        logger.info("Stopping backend process", pid=self.process.pid)

        try:
            # Send SIGTERM for graceful shutdown
            self.process.terminate()

            # Wait for process to terminate
            try:
                self.process.wait(timeout=timeout)
                logger.info("Backend stopped gracefully")
            except subprocess.TimeoutExpired:
                # Force kill if graceful shutdown times out
                logger.warning("Graceful shutdown timeout, forcing kill")
                self.process.kill()
                self.process.wait(timeout=2)
                logger.info("Backend force killed")

        except Exception as e:
            logger.error("Error stopping backend", error=str(e))
        finally:
            self.process = None

    async def start_and_wait(self) -> bool:
        """
        Build (if needed), start the backend, and wait for it to become healthy.

        Returns:
            True if backend is running and healthy, False otherwise
        """
        # Build if needed
        if not self.binary_path.exists():
            if not self.build_backend():
                return False

        # Start the backend
        if not self.start_backend():
            return False

        # Wait for health
        if not self.wait_for_health():
            self.stop_backend()
            return False

        return True

    def __enter__(self):
        """Context manager entry - start the backend."""
        if not asyncio.run(self.start_and_wait()):
            raise RuntimeError("Failed to start Bindery backend")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - stop the backend."""
        self.stop_backend()

    async def __aenter__(self):
        """Async context manager entry - start the backend."""
        if not await self.start_and_wait():
            raise RuntimeError("Failed to start Bindery backend")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - stop the backend."""
        self.stop_backend()


# Singleton instance for the backend manager
_backend_manager: Optional[BinderyBackendManager] = None


def get_backend_manager() -> BinderyBackendManager:
    """Get or create the singleton backend manager instance."""
    global _backend_manager
    if _backend_manager is None:
        _backend_manager = BinderyBackendManager()
    return _backend_manager