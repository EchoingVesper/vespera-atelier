#!/usr/bin/env python3
"""
Main entry point for Vespera Scriptorium V2

Provides multiple execution modes:
- MCP Server: For Claude Code integration
- CLI Consumer: Direct command-line usage  
- Migration Tool: V1 to V2 migration
"""

import sys
import asyncio
import argparse
from pathlib import Path

# Ensure package is in path
sys.path.insert(0, str(Path(__file__).parent))


async def run_mcp_server():
    """Run the MCP server for Claude Code integration."""
    from mcp_task_server import main
    await main()


async def run_migration():
    """Run the V1 to V2 migration tool."""
    from migrate_v1_to_v2 import main
    await main()


async def run_tests():
    """Run the comprehensive test suite."""
    print("Running Vespera V2 Test Suite")
    print("=" * 40)
    
    # Run task system tests
    print("\n🧪 Running Task System Tests...")
    from test_task_system import test_task_system, test_advanced_scenarios
    
    success = await test_task_system()
    if success:
        await test_advanced_scenarios()
    
    # Run MCP server tests
    print("\n🧪 Running MCP Server Tests...")
    from test_mcp_server import test_mcp_server, test_error_handling
    
    mcp_success = await test_mcp_server()
    if mcp_success:
        await test_error_handling()
    
    overall_success = success and mcp_success
    print(f"\n{'✅' if overall_success else '❌'} Test Suite {'Passed' if overall_success else 'Failed'}")
    
    return overall_success


def run_cli():
    """Run CLI mode (placeholder for future implementation)."""
    print("🚧 CLI Mode - Coming Soon!")
    print("For now, use the MCP server mode with Claude Code")
    print("Or run tests with --test")


def main():
    """Main entry point with argument parsing."""
    parser = argparse.ArgumentParser(
        description="Vespera Scriptorium V2 - Hierarchical Task Management System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m vespera-scriptorium --server     # Run MCP server
  python -m vespera-scriptorium --migrate    # Migrate from V1
  python -m vespera-scriptorium --test       # Run tests
  python -m vespera-scriptorium --cli        # CLI mode (future)
        """
    )
    
    parser.add_argument(
        "--server",
        action="store_true",
        help="Run MCP server for Claude Code integration"
    )
    
    parser.add_argument(
        "--migrate",
        action="store_true",
        help="Run V1 to V2 migration tool"
    )
    
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run comprehensive test suite"
    )
    
    parser.add_argument(
        "--cli",
        action="store_true",
        help="Run in CLI mode (future feature)"
    )
    
    parser.add_argument(
        "--version",
        action="version",
        version="Vespera Scriptorium V2.0.0"
    )
    
    args = parser.parse_args()
    
    # Default to server mode if no arguments
    if not any([args.server, args.migrate, args.test, args.cli]):
        print("Vespera Scriptorium V2 - Hierarchical Task Management System")
        print("=" * 60)
        print("No mode specified. Use --help for options.")
        print("Defaulting to MCP server mode...")
        args.server = True
    
    # Execute appropriate mode
    try:
        if args.server:
            print("🚀 Starting Vespera V2 MCP Server...")
            asyncio.run(run_mcp_server())
        
        elif args.migrate:
            print("🔄 Starting V1 to V2 Migration...")
            asyncio.run(run_migration())
        
        elif args.test:
            print("🧪 Starting Test Suite...")
            success = asyncio.run(run_tests())
            sys.exit(0 if success else 1)
        
        elif args.cli:
            run_cli()
        
    except KeyboardInterrupt:
        print("\n⏹️ Interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()