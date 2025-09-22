#!/usr/bin/env python3
"""
Quick performance test for validation system.
"""

import time
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_pattern_performance():
    """Test pattern compilation and matching performance."""
    try:
        from validation_config import ValidationConfig, PatternMatcher
        
        print("⚡ Testing Pattern Performance")
        print("-" * 40)
        
        # Create test configuration
        config = ValidationConfig(
            functions=['@app.*', 'test_*', 'BaseModel.*'] * 10,  # 30 patterns
            imports=['fastapi.*', 'pydantic.*'] * 10,  # 20 patterns
            classes=['HTTPException', 'BaseModel'] * 10,  # 20 patterns
            attributes=['app.get', '*.config'] * 10,  # 20 patterns
            file_patterns=['test_*.py', '*.yml'] * 10  # 20 patterns
        )
        
        # Test compilation performance
        matcher = PatternMatcher()
        start_time = time.time()
        matcher.compile_patterns(config)
        compile_time = time.time() - start_time
        
        print(f"✅ Compiled {sum(len(getattr(config, attr)) for attr in ['functions', 'imports', 'classes', 'attributes', 'file_patterns'])} patterns in {compile_time:.4f}s")
        
        # Test matching performance
        test_items = [
            ('function', '@app.get'),
            ('function', 'test_user'),
            ('function', 'dangerous_func'),
            ('import', 'fastapi.FastAPI'),
            ('import', 'os.system'),
            ('class', 'BaseModel'),
            ('class', 'DangerousClass'),
        ] * 100  # 700 total lookups
        
        start_time = time.time()
        for item_type, item_name in test_items:
            if item_type == 'function':
                matcher.should_ignore_function(item_name)
            elif item_type == 'import':
                matcher.should_ignore_import(item_name)
            elif item_type == 'class':
                matcher.should_ignore_class(item_name)
        
        match_time = time.time() - start_time
        lookups_per_second = len(test_items) / match_time
        
        print(f"✅ Performed {len(test_items)} lookups in {match_time:.4f}s ({lookups_per_second:.0f} lookups/sec)")
        
        # Test caching performance
        start_time = time.time()
        for item_type, item_name in test_items[:100]:  # Repeat same 100 items
            if item_type == 'function':
                matcher.should_ignore_function(item_name)
            elif item_type == 'import':
                matcher.should_ignore_import(item_name)
            elif item_type == 'class':
                matcher.should_ignore_class(item_name)
        
        cached_time = time.time() - start_time
        cached_lookups_per_second = 100 / cached_time
        speedup = (match_time / len(test_items) * 100) / cached_time
        
        print(f"✅ Cached lookups: {cached_lookups_per_second:.0f} lookups/sec (speedup: {speedup:.1f}x)")
        
        # Get statistics
        stats = matcher.get_statistics()
        print(f"📊 Pattern statistics: {stats}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error in performance test: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 Quick Performance Test")
    print("=" * 40)
    
    if test_pattern_performance():
        print("\n🎉 Performance test completed successfully!")
    else:
        print("\n❌ Performance test failed!")
        sys.exit(1)