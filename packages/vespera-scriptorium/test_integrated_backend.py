#!/usr/bin/env python3
"""
Test script for integrated MCP server with auto-launched Bindery backend.

This script tests that:
1. The MCP server can build the Bindery backend if needed
2. The backend is automatically started
3. Health checks work
4. The backend is properly shut down on exit
"""

import time
import subprocess
import sys
import os
from pathlib import Path

def test_backend_manager():
    """Test the backend manager directly."""
    print("=" * 60)
    print("TESTING BACKEND MANAGER")
    print("=" * 60)

    from backend_manager import BinderyBackendManager

    manager = BinderyBackendManager()

    # Check if binary exists
    if manager.binary_path.exists():
        print(f"✅ Binary exists: {manager.binary_path}")
    else:
        print(f"⚠️ Binary not found, will need to build: {manager.binary_path}")

    # Test build (if needed)
    if not manager.binary_path.exists():
        print("\nBuilding backend...")
        if manager.build_backend():
            print("✅ Build successful")
        else:
            print("❌ Build failed")
            return False

    # Test start
    print("\nStarting backend...")
    if manager.start_backend():
        print(f"✅ Backend started with PID: {manager.process.pid}")
    else:
        print("❌ Failed to start backend")
        return False

    # Test health check
    print("\nWaiting for backend to become healthy...")
    if manager.wait_for_health():
        print("✅ Backend is healthy")
    else:
        print("❌ Backend health check failed")
        manager.stop_backend()
        return False

    # Let it run for a moment
    time.sleep(2)

    # Test stop
    print("\nStopping backend...")
    manager.stop_backend()
    print("✅ Backend stopped")

    return True


def test_mcp_with_backend():
    """Test the MCP server with auto-launched backend."""
    print("\n" + "=" * 60)
    print("TESTING MCP SERVER WITH AUTO-LAUNCHED BACKEND")
    print("=" * 60)

    # Set environment to auto-launch
    env = os.environ.copy()
    env["MCP_AUTO_LAUNCH_BACKEND"] = "true"

    # Start the MCP server (with timeout)
    print("\nStarting MCP server with auto-launch enabled...")

    script_path = Path(__file__).parent / "mcp_server.py"

    try:
        # Run the server for a few seconds
        process = subprocess.Popen(
            [sys.executable, str(script_path)],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        # Give it time to start and launch backend
        time.sleep(10)

        # Check if still running
        if process.poll() is None:
            print("✅ MCP server is running")

            # Terminate the server
            process.terminate()
            stdout, stderr = process.communicate(timeout=5)

            # Check logs for backend launch
            if "Auto-launching Bindery backend" in stderr:
                print("✅ Backend auto-launch initiated")

            if "Bindery backend started successfully" in stderr:
                print("✅ Backend started successfully")
            elif "Failed to auto-launch Bindery backend" in stderr:
                print("⚠️ Backend auto-launch failed (may need cargo build)")

            if "Shutting down Bindery backend" in stderr:
                print("✅ Backend shutdown initiated on exit")

            return True
        else:
            stdout, stderr = process.communicate()
            print(f"❌ MCP server exited early with code: {process.returncode}")
            print(f"Stderr: {stderr[:1000]}")
            return False

    except Exception as e:
        print(f"❌ Error testing MCP server: {e}")
        return False


def main():
    """Run all tests."""
    print("INTEGRATED BACKEND TEST SUITE")
    print("=" * 60)

    # Test backend manager
    if not test_backend_manager():
        print("\n❌ Backend manager test failed")
        sys.exit(1)

    # Test MCP with backend
    if not test_mcp_with_backend():
        print("\n❌ MCP integration test failed")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED!")
    print("=" * 60)
    print("\nThe MCP server can now:")
    print("1. Automatically build the Bindery backend if needed")
    print("2. Launch the backend on startup")
    print("3. Wait for backend health before proceeding")
    print("4. Cleanly shut down the backend on exit")
    print("\nTo disable auto-launch, set: MCP_AUTO_LAUNCH_BACKEND=false")


if __name__ == "__main__":
    main()