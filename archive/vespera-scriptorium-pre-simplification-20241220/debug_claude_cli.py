#!/usr/bin/env python3
"""
Debug script to isolate Claude CLI execution issues.
"""

import asyncio
import subprocess
import logging
import json
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

async def test_claude_cli_basic():
    """Test basic Claude CLI functionality."""
    logger.info("=== Testing Claude CLI Basic Functionality ===")
    
    # Test 1: Simple version check (synchronous)
    logger.info("Test 1: Synchronous version check...")
    try:
        result = subprocess.run(
            ["claude", "--version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        logger.info(f"Version check - Return code: {result.returncode}")
        logger.info(f"Version check - Stdout: {result.stdout}")
        logger.info(f"Version check - Stderr: {result.stderr}")
    except Exception as e:
        logger.error(f"Synchronous version check failed: {e}")
        
    # Test 2: Async subprocess creation
    logger.info("Test 2: Async subprocess creation...")
    try:
        process = await asyncio.create_subprocess_exec(
            "claude", "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        logger.info(f"Async version check - Return code: {process.returncode}")
        logger.info(f"Async version check - Stdout: {stdout.decode()}")
        logger.info(f"Async version check - Stderr: {stderr.decode()}")
    except Exception as e:
        logger.error(f"Async subprocess creation failed: {e}")

    # Test 3: Claude help command
    logger.info("Test 3: Claude help command...")
    try:
        process = await asyncio.create_subprocess_exec(
            "claude", "--help",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        logger.info(f"Help command - Return code: {process.returncode}")
        logger.info(f"Help command - Stdout length: {len(stdout.decode())} chars")
        logger.info(f"Help command - Stderr: {stderr.decode()}")
    except Exception as e:
        logger.error(f"Claude help command failed: {e}")

async def test_claude_cli_simple_prompt():
    """Test Claude CLI with a simple prompt via stdin."""
    logger.info("=== Testing Claude CLI with Simple Prompt ===")
    
    simple_prompt = "Hello, please respond with 'CLI Test Successful'"
    
    try:
        # Test with --print flag
        logger.info("Test 4: Simple prompt with --print flag...")
        process = await asyncio.create_subprocess_exec(
            "claude", "--print",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await asyncio.wait_for(
            process.communicate(input=simple_prompt.encode('utf-8')),
            timeout=30
        )
        
        logger.info(f"Simple prompt - Return code: {process.returncode}")
        logger.info(f"Simple prompt - Stdout: {stdout.decode()[:500]}...")
        logger.info(f"Simple prompt - Stderr: {stderr.decode()}")
        
    except asyncio.TimeoutError:
        logger.error("Simple prompt test timed out")
    except Exception as e:
        logger.error(f"Simple prompt test failed: {e}")

async def test_claude_cli_stream_json():
    """Test Claude CLI with stream-json output format."""
    logger.info("=== Testing Claude CLI with Stream JSON ===")
    
    simple_prompt = "Respond with: CLI Stream JSON Test Successful"
    
    try:
        # Test with stream-json output format
        logger.info("Test 5: Stream JSON output format...")
        process = await asyncio.create_subprocess_exec(
            "claude", "--print", "--output-format", "stream-json",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await asyncio.wait_for(
            process.communicate(input=simple_prompt.encode('utf-8')),
            timeout=30
        )
        
        logger.info(f"Stream JSON - Return code: {process.returncode}")
        logger.info(f"Stream JSON - Stdout: {stdout.decode()[:500]}...")
        logger.info(f"Stream JSON - Stderr: {stderr.decode()}")
        
        # Try to parse JSON output
        if stdout:
            try:
                output_str = stdout.decode('utf-8')
                logger.info("Attempting to parse JSON lines...")
                for line_num, line in enumerate(output_str.strip().split('\n'), 1):
                    if line.strip():
                        try:
                            json_obj = json.loads(line.strip())
                            logger.info(f"Line {line_num} JSON type: {json_obj.get('type', 'unknown')}")
                        except json.JSONDecodeError as e:
                            logger.warning(f"Line {line_num} not valid JSON: {e}")
            except Exception as parse_error:
                logger.error(f"JSON parsing failed: {parse_error}")
        
    except asyncio.TimeoutError:
        logger.error("Stream JSON test timed out")
    except Exception as e:
        logger.error(f"Stream JSON test failed: {e}")

async def test_claude_executor_simulation():
    """Test the exact pattern used by ClaudeExecutor."""
    logger.info("=== Testing ClaudeExecutor Pattern ===")
    
    # Simulate the exact command pattern from ClaudeExecutor
    command = ["claude", "--print", "--output-format", "stream-json", "--verbose"]
    user_prompt = "Complete this simple task: respond with 'ClaudeExecutor Pattern Test Successful'"
    
    try:
        logger.info(f"Test 6: ClaudeExecutor pattern with command: {' '.join(command)}")
        
        process = await asyncio.create_subprocess_exec(
            *command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=Path.cwd()
        )
        
        logger.info(f"Process created with PID: {process.pid}")
        
        stdout, stderr = await asyncio.wait_for(
            process.communicate(input=user_prompt.encode('utf-8')),
            timeout=60
        )
        
        logger.info(f"ClaudeExecutor pattern - Return code: {process.returncode}")
        logger.info(f"ClaudeExecutor pattern - Stdout length: {len(stdout.decode())} chars")
        logger.info(f"ClaudeExecutor pattern - Stderr: {stderr.decode()}")
        
        if process.returncode != 0:
            logger.error(f"Command failed with exit code {process.returncode}")
            logger.error(f"Error output: {stderr.decode()}")
        else:
            logger.info("ClaudeExecutor pattern test SUCCEEDED!")
        
    except asyncio.TimeoutError:
        logger.error("ClaudeExecutor pattern test timed out")
    except Exception as e:
        logger.error(f"ClaudeExecutor pattern test failed: {e}")
        import traceback
        logger.error(traceback.format_exc())

async def main():
    """Run all Claude CLI tests."""
    logger.info("Starting Claude CLI debug tests...")
    
    await test_claude_cli_basic()
    await test_claude_cli_simple_prompt()
    await test_claude_cli_stream_json()
    await test_claude_executor_simulation()
    
    logger.info("Claude CLI debug tests completed!")

if __name__ == "__main__":
    asyncio.run(main())