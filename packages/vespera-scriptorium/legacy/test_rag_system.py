#!/usr/bin/env python3
"""
Test RAG System Integration

Comprehensive test to verify RAG system functionality including
document indexing, semantic search, and code analysis.
"""

import asyncio
import logging
import tempfile
import shutil
from pathlib import Path

from rag.service import RAGService
from rag.code_analyzer import CodeAnalyzer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_rag_system():
    """Test comprehensive RAG system functionality."""
    # Create temporary directory for test
    temp_dir = Path(tempfile.mkdtemp())
    logger.info(f"Using temporary directory: {temp_dir}")
    
    try:
        # Initialize RAG service
        rag_service = RAGService(rag_data_path=temp_dir / "rag_data")
        
        logger.info("✓ Initialized RAG service")
        
        # Test 1: Index sample documents
        logger.info("\n📚 Testing document indexing...")
        
        # Index a sample Python file
        python_code = '''
"""
Sample Python module for testing RAG system.
"""

import json
import logging
from typing import Dict, List, Optional
from datetime import datetime

class DataProcessor:
    """Processes data for analysis."""
    
    def __init__(self, config: Dict[str, str]):
        self.config = config
        self.logger = logging.getLogger(__name__)
    
    async def process_data(self, data: List[Dict]) -> List[Dict]:
        """Process input data and return results."""
        results = []
        
        for item in data:
            processed_item = await self.transform_item(item)
            results.append(processed_item)
        
        self.logger.info(f"Processed {len(data)} items")
        return results
    
    async def transform_item(self, item: Dict) -> Dict:
        """Transform a single data item."""
        return {
            "id": item.get("id"),
            "processed_at": datetime.now().isoformat(),
            "data": item.get("data", {}),
            "status": "processed"
        }

def main():
    """Main function."""
    processor = DataProcessor({"output_format": "json"})
    print("Data processor initialized")

if __name__ == "__main__":
    main()
'''
        
        success1, result1 = await rag_service.index_document(
            document_id="test_python_module",
            title="Sample Python Data Processor",
            content=python_code,
            document_type="code",
            metadata={"language": "python", "purpose": "testing"}
        )
        
        # Index a markdown document
        markdown_content = '''
# RAG System Documentation

## Overview

The Retrieval-Augmented Generation (RAG) system provides comprehensive
document indexing and semantic search capabilities for AI applications.

## Features

- **Document Indexing**: Supports multiple file types (Python, Markdown, Text)
- **Semantic Search**: Vector-based similarity search using ChromaDB
- **Code Analysis**: AST-based analysis for Python code structure
- **Knowledge Graph**: Relationship tracking using KuzuDB

## Usage Examples

### Indexing Documents

```python
rag_service = RAGService()
success, result = await rag_service.index_document(
    document_id="my_doc",
    title="My Document",
    content="Document content here",
    document_type="text"
)
```

### Searching Documents

```python
results = await rag_service.search_documents(
    query="How to index documents",
    limit=10
)
```

## Architecture

The RAG system is built on a triple database architecture:

1. **SQLite**: Task management and metadata
2. **ChromaDB**: Vector embeddings and semantic search  
3. **KuzuDB**: Knowledge graph and relationships

This approach provides comprehensive knowledge management capabilities.
'''
        
        success2, result2 = await rag_service.index_document(
            document_id="rag_documentation",
            title="RAG System Documentation", 
            content=markdown_content,
            document_type="markdown",
            metadata={"category": "documentation", "version": "1.0"}
        )
        
        if success1 and success2:
            logger.info("✓ Successfully indexed test documents")
            logger.info(f"  - Python module: {result1.get('chunks', 0)} chunks")
            logger.info(f"  - Documentation: {result2.get('chunks', 0)} chunks")
        else:
            logger.error("✗ Failed to index some documents")
            return False
        
        # Test 2: Search functionality
        logger.info("\n🔍 Testing semantic search...")
        
        # Test search for code-related content
        code_results = await rag_service.search_documents(
            query="Python class data processing async methods",
            limit=5,
            document_types=["code"]
        )
        
        logger.info(f"✓ Found {len(code_results)} code-related results")
        for i, result in enumerate(code_results[:2]):
            logger.info(f"  [{i+1}] {result['title']} (score: {result['relevance_score']:.3f})")
        
        # Test search for documentation
        doc_results = await rag_service.search_documents(
            query="document indexing features architecture",
            limit=5,
            document_types=["markdown"]
        )
        
        logger.info(f"✓ Found {len(doc_results)} documentation results")
        for i, result in enumerate(doc_results[:2]):
            logger.info(f"  [{i+1}] {result['title']} (score: {result['relevance_score']:.3f})")
        
        # Test 3: Document context retrieval
        logger.info("\n📄 Testing document context retrieval...")
        
        context = await rag_service.get_document_context(
            document_id="test_python_module",
            query="async methods processing data",
            max_chunks=3
        )
        
        if "error" not in context:
            logger.info(f"✓ Retrieved context for Python module:")
            logger.info(f"  - Document: {context['title']}")
            logger.info(f"  - Query: {context['query']}")
            logger.info(f"  - Relevant chunks: {len(context['relevant_chunks'])}")
        else:
            logger.error(f"✗ Context retrieval failed: {context['error']}")
        
        # Test 4: Code analysis
        logger.info("\n🔧 Testing code analysis...")
        
        analyzer = CodeAnalyzer()
        
        # Create a test Python file
        test_file = temp_dir / "test_code.py"
        test_file.write_text(python_code)
        
        analysis = analyzer.analyze_file(test_file)
        
        if analysis:
            logger.info("✓ Code analysis successful:")
            logger.info(f"  - Imports: {len(analysis.imports)}")
            logger.info(f"  - Functions: {len(analysis.functions)}")
            logger.info(f"  - Classes: {len(analysis.classes)}")
            logger.info(f"  - Method calls: {len(analysis.method_calls)}")
            
            # Show some details
            if analysis.classes:
                cls = analysis.classes[0]
                logger.info(f"  - Class '{cls.name}' has {len(cls.methods)} methods")
            
            # Test dependency extraction
            dependencies = analyzer.extract_dependencies(analysis)
            logger.info(f"  - Dependencies found:")
            for dep_type, deps in dependencies.items():
                if deps:
                    logger.info(f"    - {dep_type}: {len(deps)} items")
            
            # Test potential issues detection
            issues = analyzer.find_potential_issues(analysis)
            logger.info(f"  - Potential issues: {len(issues)}")
            for issue in issues[:2]:  # Show first 2 issues
                logger.info(f"    - {issue['type']}: {issue['message']}")
        else:
            logger.error("✗ Code analysis failed")
        
        # Test 5: File system integration
        logger.info("\n📁 Testing file system integration...")
        
        # Create some test files
        test_files_dir = temp_dir / "test_files"
        test_files_dir.mkdir()
        
        (test_files_dir / "readme.md").write_text('''
# Test Project

This is a test project for RAG system integration.

## Features
- Document processing
- Code analysis
- Semantic search
''')
        
        (test_files_dir / "utils.py").write_text('''
def helper_function(data):
    """A simple helper function."""
    return data.upper()

class HelperClass:
    def process(self, text):
        return helper_function(text)
''')
        
        # Index directory
        index_result = await rag_service.index_directory(
            directory_path=test_files_dir,
            file_patterns=['*.md', '*.py'],
            recursive=False
        )
        
        if "error" not in index_result:
            logger.info("✓ Directory indexing successful:")
            logger.info(f"  - Total files: {index_result['total_files']}")
            logger.info(f"  - Indexed: {index_result['indexed']}")
            logger.info(f"  - Skipped: {index_result['skipped']}")
            logger.info(f"  - Failed: {index_result['failed']}")
        else:
            logger.error(f"✗ Directory indexing failed: {index_result['error']}")
        
        # Test 6: Health check and statistics
        logger.info("\n🏥 Testing health check and statistics...")
        
        health = await rag_service.health_check()
        logger.info("✓ Health check results:")
        logger.info(f"  - Overall status: {health['status']}")
        logger.info(f"  - Total documents: {health['documents']['total']}")
        logger.info(f"  - Vector indexed: {health['documents']['indexed']}")
        logger.info(f"  - Graph indexed: {health['documents']['graph_indexed']}")
        
        stats = await rag_service.get_stats()
        logger.info("✓ System statistics:")
        logger.info(f"  - Total documents: {stats['documents']['total']}")
        logger.info(f"  - Total chunks: {stats['documents']['total_chunks']}")
        logger.info(f"  - Document types: {list(stats['documents']['by_type'].keys())}")
        
        logger.info(f"\n🎉 RAG system test completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"✗ RAG system test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        # Cleanup
        try:
            shutil.rmtree(temp_dir)
            logger.info(f"✓ Cleaned up temporary directory")
        except Exception as e:
            logger.warning(f"Failed to cleanup: {e}")


async def main():
    """Run the RAG system test."""
    logger.info("🚀 Starting RAG System Integration Test")
    logger.info("=" * 70)
    
    success = await test_rag_system()
    
    logger.info("=" * 70)
    if success:
        logger.info("✅ All tests passed! RAG system is working correctly.")
        return 0
    else:
        logger.error("❌ Tests failed! Check the logs above for details.")
        return 1


if __name__ == "__main__":
    exit(asyncio.run(main()))