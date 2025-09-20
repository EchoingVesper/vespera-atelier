# Vespera Bindery RAG System

## Overview

The RAG (Retrieval-Augmented Generation) system in Vespera Bindery provides powerful document indexing and semantic search capabilities with support for multiple embedding providers.

## Features

- **Multiple Embedding Providers**:
  - Mock embeddings (for testing)
  - OpenAI API (text-embedding-3-small, text-embedding-3-large)
  - Cohere API (embed-english-v3.0, embed-multilingual-v3.0)
  - Local models via Candle (sentence-transformers models)
  - ONNX Runtime for optimized inference

- **Intelligent Document Processing**:
  - Automatic chunking with multiple strategies
  - Code analysis with language detection
  - Markdown structure preservation
  - Configurable chunk sizes and overlap

- **Project Management**:
  - Automatic `.vespera` folder creation
  - Hierarchical project support
  - Per-project configuration

## Quick Start

### 1. Enable Features

Add to your `Cargo.toml`:

```toml
[dependencies]
vespera-bindery = {
    version = "0.1.0",
    features = ["embeddings-api"] # or "embeddings-local", "embeddings-onnx"
}
```

### 2. Set Up API Keys

Create a `.env` file (see `.env.example`):

```bash
OPENAI_API_KEY=sk-...
# or
COHERE_API_KEY=...
```

### 3. Use in Your Code

```rust
use vespera_bindery::rag::{RAGService, RAGConfig, EmbeddingModel};

#[tokio::main]
async fn main() -> Result<()> {
    // Configure embeddings
    let config = RAGConfig {
        embedding_model: EmbeddingModel::OpenAI("text-embedding-3-small".to_string()),
        ..Default::default()
    };

    // Initialize RAG service
    let rag = RAGService::new("./my-project", config).await?;

    // Index documents
    rag.index_file(&Path::new("src/lib.rs")).await?;

    // Search
    let results = rag.search("async function", 10, None).await?;

    Ok(())
}
```

## Embedding Options

### API-Based Embeddings

```rust
// OpenAI
EmbeddingModel::OpenAI("text-embedding-3-small".to_string())

// Cohere
EmbeddingModel::Cohere("embed-english-v3.0".to_string())
```

### Local Embeddings

```rust
// Using Candle (requires feature: embeddings-local)
EmbeddingModel::LocalModel("sentence-transformers/all-MiniLM-L6-v2".to_string())

// Using ONNX Runtime (requires feature: embeddings-onnx)
// Same model names, but uses ONNX for inference
```

## Examples

Run the examples:

```bash
# Basic demo with mock embeddings
cargo run --example rag_demo

# Demo with real embeddings (requires API key)
OPENAI_API_KEY=sk-... cargo run --features embeddings-api --example rag_real_embeddings
```

## Project Structure

When initialized, creates a `.vespera` folder:

```
.vespera/
├── project.json          # Project configuration
├── rag/
│   ├── documents/        # Indexed document storage
│   ├── embeddings/       # Vector embeddings
│   └── indices/          # Search indices
├── codices/              # Codex storage
├── templates/            # Project templates
└── hooks/                # Automation hooks
```

## Performance Considerations

- **Batching**: Embeddings are processed in batches (default: 32)
- **Caching**: Embeddings are cached to avoid re-computation
- **Incremental Updates**: Only modified documents are re-indexed

## TODO Items Found (71 total)

Key areas needing attention:

1. **RAG/Embeddings**:
   - ✅ Local model integration (Candle/ONNX) - COMPLETED
   - ✅ OpenAI API integration - COMPLETED
   - ✅ Cohere API integration - COMPLETED
   - Calculate actual chunk positions for precise references
   - Implement search result highlighting

2. **Code Analyzer**:
   - Parse function parameters and return types
   - Calculate complexity metrics
   - Parse class methods and properties
   - Support more languages (Go, Java, C#)

3. **Core Architecture**:
   - Initialize task_manager after architecture refactor
   - Implement interior mutability for CRDT GC
   - Get user context instead of hardcoded "system"

4. **Hook System**:
   - Implement remaining operators
   - Parse conditions/actions from rules
   - Implement cron scheduling

## Contributing

When working on the RAG system:

1. Check existing TODOs with: `grep -r "TODO" src/rag`
2. Add tests for new embedding providers
3. Update documentation for new features
4. Consider performance impact of changes

## License

Part of the Vespera Atelier project under AGPL-3.0 license.