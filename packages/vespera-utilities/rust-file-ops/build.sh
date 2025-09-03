#!/bin/bash
# Build script for vespera-file-ops Rust module with Python bindings

set -e

echo "Building Vespera File Operations (Rust + Python)"
echo "================================================"

# Check if Rust is installed
if ! command -v rustc &> /dev/null; then
    echo "Error: Rust is not installed. Install from https://rustup.rs/"
    exit 1
fi

# Check if maturin is installed
if ! command -v maturin &> /dev/null; then
    echo "Installing maturin..."
    pip install maturin
fi

# Ensure we're in the right directory
cd "$(dirname "$0")"
echo "Working directory: $(pwd)"

# Build mode (default to development)
BUILD_MODE=${1:-develop}

case $BUILD_MODE in
    "develop"|"dev"|"debug")
        echo "Building in development mode..."
        maturin develop
        ;;
    "release"|"prod"|"production")  
        echo "Building in release mode..."
        maturin build --release
        echo "Built wheels are available in target/wheels/"
        ;;
    "install")
        echo "Building and installing release version..."
        maturin develop --release
        ;;
    *)
        echo "Usage: $0 [develop|release|install]"
        echo "  develop  - Debug build for development (default)"
        echo "  release  - Optimized build for production"  
        echo "  install  - Build and install release version"
        exit 1
        ;;
esac

echo ""
echo "Testing installation..."
python3 -c "
try:
    import vespera_file_ops
    print('✅ vespera_file_ops module imported successfully!')
    
    # Test basic functionality
    import tempfile
    import os
    
    # Test file operations
    with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
        f.write('Hello, Rust!')
        temp_path = f.name
    
    content = vespera_file_ops.read_file_string(temp_path)
    print(f'✅ File read test: \"{content}\"')
    
    # Test search
    matches = vespera_file_ops.search_text('Rust', temp_path)
    print(f'✅ Search test: Found {len(matches)} matches')
    
    # Test file info
    info = vespera_file_ops.get_file_info(temp_path)
    print(f'✅ File info test: Size = {info[\"size\"]} bytes')
    
    # Cleanup
    os.unlink(temp_path)
    
    print('')
    print('🎉 All tests passed! The Rust file operations module is ready.')
    print('   Integration with MCP server can now proceed.')
    
except ImportError as e:
    print(f'❌ Failed to import vespera_file_ops: {e}')
    exit(1)
except Exception as e:
    print(f'❌ Test failed: {e}')
    exit(1)
"

echo ""
echo "Build completed successfully!"
echo "Next steps:"
echo "1. Integrate with MCP server (vespera_server.py)"
echo "2. Add MCP file operation tools"
echo "3. Test agent spawning with new tools"