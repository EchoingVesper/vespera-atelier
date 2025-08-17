#!/usr/bin/env python3
"""
Python Auto-Formatter Hook for Claude Code

Automatically runs black and isort on Python files after Edit, MultiEdit, or Write operations.
This prevents linting violations from being introduced and maintains consistent code style.
"""

import os
import sys
import subprocess
import tempfile
from pathlib import Path

def find_venv_python():
    """Find the Python executable in the virtual environment"""
    # Check if we're in vespera-scriptorium directory or can find it
    current_dir = Path.cwd()
    
    # Look for venv in current directory or parent directories
    search_paths = [current_dir, current_dir.parent, current_dir.parent.parent]
    
    for search_path in search_paths:
        venv_python = search_path / "packages" / "vespera-scriptorium" / "venv" / "bin" / "python"
        if venv_python.exists():
            return str(venv_python)
        
        venv_python = search_path / "venv" / "bin" / "python"  
        if venv_python.exists():
            return str(venv_python)
    
    # Fallback to system python3
    return "python3"

def find_project_root():
    """Find the project root directory containing vespera-scriptorium"""
    current_dir = Path.cwd()
    
    # Look for packages/vespera-scriptorium
    search_paths = [current_dir, current_dir.parent, current_dir.parent.parent]
    
    for search_path in search_paths:
        scriptorium_path = search_path / "packages" / "vespera-scriptorium"
        if scriptorium_path.exists():
            return str(scriptorium_path)
    
    return str(current_dir)

def run_black(file_path, python_exec):
    """Run black formatter on the file"""
    try:
        # First check if black is available
        result = subprocess.run(
            [python_exec, "-c", "import black"],
            capture_output=True,
            timeout=5
        )
        
        if result.returncode != 0:
            return False, "black not available"
        
        # Run black formatter
        result = subprocess.run(
            [python_exec, "-m", "black", str(file_path)],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            return True, "formatted with black"
        else:
            return False, f"black error: {result.stderr.strip()}"
            
    except subprocess.TimeoutExpired:
        return False, "black timeout"
    except Exception as e:
        return False, f"black exception: {str(e)}"

def run_isort(file_path, python_exec):
    """Run isort on the file"""
    try:
        # First check if isort is available
        result = subprocess.run(
            [python_exec, "-c", "import isort"],
            capture_output=True,
            timeout=5
        )
        
        if result.returncode != 0:
            return False, "isort not available"
        
        # Run isort
        result = subprocess.run(
            [python_exec, "-m", "isort", str(file_path)],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            return True, "imports sorted"
        else:
            return False, f"isort error: {result.stderr.strip()}"
            
    except subprocess.TimeoutExpired:
        return False, "isort timeout"
    except Exception as e:
        return False, f"isort exception: {str(e)}"

def main():
    """Main hook execution"""
    try:
        # Get file path from environment or command line
        file_path = os.environ.get('CLAUDE_FILE_PATH') or (sys.argv[1] if len(sys.argv) > 1 else '')
        
        if not file_path or not os.path.exists(file_path):
            sys.exit(0)
        
        # Only process Python files
        if not file_path.endswith('.py'):
            sys.exit(0)
        
        # Skip files that aren't in vespera_scriptorium package
        file_obj = Path(file_path)
        if 'vespera_scriptorium' not in str(file_obj):
            sys.exit(0)
        
        # Find Python executable
        python_exec = find_venv_python()
        
        # Change to project root for proper tool execution
        project_root = find_project_root()
        original_cwd = os.getcwd()
        
        try:
            os.chdir(project_root)
            
            # Run formatters
            black_success, black_msg = run_black(file_path, python_exec)
            isort_success, isort_msg = run_isort(file_path, python_exec)
            
            # Report results
            if black_success or isort_success:
                actions = []
                if black_success:
                    actions.append("black")
                if isort_success:
                    actions.append("isort")
                
                print(f"🎨 Auto-formatted {file_obj.name} with {', '.join(actions)}", file=sys.stderr)
            
            # Report any errors (but don't fail the hook)
            if not black_success and "not available" not in black_msg:
                print(f"⚠️ Black formatting issue: {black_msg}", file=sys.stderr)
            
            if not isort_success and "not available" not in isort_msg:
                print(f"⚠️ Import sorting issue: {isort_msg}", file=sys.stderr)
        
        finally:
            os.chdir(original_cwd)
    
    except Exception as e:
        print(f"Python formatter hook error: {e}", file=sys.stderr)
    
    # Always succeed - don't block Claude operations
    sys.exit(0)

if __name__ == "__main__":
    main()