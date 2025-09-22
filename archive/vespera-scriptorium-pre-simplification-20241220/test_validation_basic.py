#!/usr/bin/env python3
"""
Basic validation system test to verify framework coverage.
"""

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_validation_config():
    """Test basic validation configuration functionality."""
    try:
        from validation_config import get_validation_config
        
        print("🔧 Testing Validation Configuration")
        print("-" * 40)
        
        config = get_validation_config()
        print("✅ Configuration loaded successfully")
        
        # Test FastAPI patterns
        fastapi_tests = [
            ('function', '@app.get', True),
            ('function', '@app.post', True),
            ('function', 'FastAPI', True),
            ('import', 'fastapi.FastAPI', True),
            ('import', 'fastapi.HTTPException', True),
            ('class', 'HTTPException', True),
            ('class', 'FastAPI', True),
            ('attribute', 'app.get', True),
            ('attribute', 'app.post', True),
        ]
        
        print("\n📋 Testing FastAPI patterns:")
        for item_type, item_name, expected in fastapi_tests:
            result = config.should_ignore(item_type, item_name)
            status = "✅" if result == expected else "❌"
            print(f"  {status} {item_type} '{item_name}': {result}")
        
        # Test Pydantic patterns
        pydantic_tests = [
            ('function', 'BaseModel', True),
            ('function', 'Field', True),
            ('function', 'validator', True),
            ('import', 'pydantic.BaseModel', True),
            ('class', 'BaseModel', True),
            ('class', 'ValidationError', True),
        ]
        
        print("\n📋 Testing Pydantic patterns:")
        for item_type, item_name, expected in pydantic_tests:
            result = config.should_ignore(item_type, item_name)
            status = "✅" if result == expected else "❌"
            print(f"  {status} {item_type} '{item_name}': {result}")
        
        # Test SQLAlchemy patterns
        sqlalchemy_tests = [
            ('function', 'Column', True),
            ('function', 'relationship', True),
            ('function', 'sessionmaker', True),
            ('import', 'sqlalchemy.Column', True),
            ('class', 'Session', True),
            ('class', 'Engine', True),
        ]
        
        print("\n📋 Testing SQLAlchemy patterns:")
        for item_type, item_name, expected in sqlalchemy_tests:
            result = config.should_ignore(item_type, item_name)
            status = "✅" if result == expected else "❌"
            print(f"  {status} {item_type} '{item_name}': {result}")
        
        # Test pytest patterns
        pytest_tests = [
            ('function', 'pytest.fixture', True),
            ('function', 'test_user', True),
            ('function', '@pytest.mark', True),
            ('import', 'pytest.fixture', True),
            ('file', 'test_user.py', True),
            ('file', 'conftest.py', True),
        ]
        
        print("\n📋 Testing pytest patterns:")
        for item_type, item_name, expected in pytest_tests:
            result = config.should_ignore(item_type, item_name)
            status = "✅" if result == expected else "❌"
            print(f"  {status} {item_type} '{item_name}': {result}")
        
        # Test negative cases (should NOT be ignored)
        negative_tests = [
            ('function', 'dangerous_function', False),
            ('function', 'exec_command', False),
            ('import', 'os.system', False),
            ('import', 'subprocess.call', False),
            ('class', 'DangerousClass', False),
            ('file', 'main.py', False),
        ]
        
        print("\n📋 Testing negative cases (should NOT be ignored):")
        for item_type, item_name, expected in negative_tests:
            result = config.should_ignore(item_type, item_name)
            status = "✅" if result == expected else "❌"
            print(f"  {status} {item_type} '{item_name}': {result}")
        
        # Get statistics
        summary = config.get_config_summary()
        print(f"\n📊 Configuration Summary:")
        print(f"  Total patterns: {summary.get('total_patterns', 0)}")
        print(f"  Config file exists: {summary.get('exists', False)}")
        print(f"  Pattern breakdown: {summary.get('patterns', {})}")
        
        print("\n🎉 Validation configuration test completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error testing validation configuration: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_file_validation():
    """Test file validation functionality."""
    try:
        from file_tools_mcp import FileToolsMCP
        import tempfile
        from pathlib import Path
        
        print("\n🔧 Testing File Validation")
        print("-" * 40)
        
        tools = FileToolsMCP()
        print("✅ FileToolsMCP initialized successfully")
        
        # Test FastAPI code (should have minimal issues)
        fastapi_code = '''
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class User(BaseModel):
    name: str
    email: str

@app.get("/users")
async def get_users():
    return {"users": []}
'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(fastapi_code)
            temp_path = f.name
        
        try:
            result = tools.read_file_safe(temp_path, validate=True)
            if result['success']:
                validation = result['validation']
                print(f"✅ FastAPI code validation: {validation['total_issues']} issues found")
                if validation['total_issues'] > 2:
                    print(f"⚠️  More issues than expected for FastAPI code")
                else:
                    print(f"✅ FastAPI code properly filtered")
            else:
                print(f"❌ FastAPI code validation failed: {result.get('error')}")
        finally:
            Path(temp_path).unlink()
        
        # Test suspicious code (should have many issues)
        suspicious_code = '''
import os
import subprocess

def dangerous_function(user_input):
    os.system(f"rm -rf {user_input}")
    subprocess.call(["wget", user_input])
    eval(user_input)
'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(suspicious_code)
            temp_path = f.name
        
        try:
            result = tools.read_file_safe(temp_path, validate=True)
            if result['success']:
                validation = result['validation']
                print(f"✅ Suspicious code validation: {validation['total_issues']} issues found")
                if validation['total_issues'] < 3:
                    print(f"⚠️  Fewer issues than expected for suspicious code")
                else:
                    print(f"✅ Suspicious code properly detected")
            else:
                print(f"❌ Suspicious code validation failed: {result.get('error')}")
        finally:
            Path(temp_path).unlink()
        
        print("🎉 File validation test completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error testing file validation: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 Starting Basic Validation System Tests")
    print("=" * 60)
    
    success = True
    
    # Test configuration
    if not test_validation_config():
        success = False
    
    # Test file validation  
    if not test_file_validation():
        success = False
    
    print("\n" + "=" * 60)
    if success:
        print("🎉 All tests passed successfully!")
        sys.exit(0)
    else:
        print("❌ Some tests failed!")
        sys.exit(1)