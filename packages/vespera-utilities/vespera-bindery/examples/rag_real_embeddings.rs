//! # RAG Demo with Real Embeddings
//!
//! Demonstrates the RAG system with actual embedding models

use vespera_bindery::rag::{RAGService, RAGConfig, DocumentType, EmbeddingModel};
use std::env;
use tempfile::TempDir;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("Vespera Bindery RAG Demo with Real Embeddings\n");

    // Check for API keys in environment
    let has_openai_key = env::var("OPENAI_API_KEY").is_ok();
    let has_cohere_key = env::var("COHERE_API_KEY").is_ok();

    // Choose embedding model based on available resources
    let embedding_model = if has_openai_key {
        println!("✅ Found OpenAI API key, using OpenAI embeddings");
        EmbeddingModel::OpenAI("text-embedding-3-small".to_string())
    } else if has_cohere_key {
        println!("✅ Found Cohere API key, using Cohere embeddings");
        EmbeddingModel::Cohere("embed-english-v3.0".to_string())
    } else {
        println!("ℹ️  No API keys found, using mock embeddings");
        println!("   Set OPENAI_API_KEY or COHERE_API_KEY for real embeddings");
        EmbeddingModel::Mock
    };

    // Create a temporary directory for testing
    let temp_dir = TempDir::new()?;
    println!("📁 Created temporary directory: {:?}\n", temp_dir.path());

    // Initialize RAG service with chosen embedding model
    let config = RAGConfig {
        embedding_model: embedding_model.clone(),
        max_chunk_size: 512,
        chunk_overlap: 50,
        enable_code_analysis: true,
        auto_detect_projects: true,
        vespera_folder_override: None,
    };

    let rag_service = RAGService::new(temp_dir.path(), config).await?;
    println!("✅ RAG service initialized with {:?}\n", embedding_model);

    // Index various types of documents
    println!("📝 Indexing sample documents...\n");

    // Technical documentation
    let doc1_id = rag_service.index_document(
        "Rust Memory Management".to_string(),
        r#"
        Rust's ownership system ensures memory safety without needing a garbage collector.

        The three rules of ownership are:
        1. Each value in Rust has a variable called its owner
        2. There can only be one owner at a time
        3. When the owner goes out of scope, the value is dropped

        Borrowing allows multiple references to data:
        - Immutable borrows (&T) allow read-only access
        - Mutable borrows (&mut T) allow modification
        - You can have either one mutable borrow or many immutable borrows

        This system prevents data races at compile time and ensures thread safety.
        "#.to_string(),
        DocumentType::Documentation,
        None,
        vec!["rust".to_string(), "memory".to_string(), "ownership".to_string()],
    ).await?;
    println!("  ✓ Indexed: Rust Memory Management");

    // Python code example
    let doc2_id = rag_service.index_document(
        "python_ml_example.py".to_string(),
        r#"
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

class MLPipeline:
    """Machine learning pipeline for classification tasks."""

    def __init__(self, n_estimators=100):
        self.model = RandomForestClassifier(n_estimators=n_estimators)
        self.is_trained = False

    def preprocess_data(self, X, y):
        """Preprocess the input data."""
        # Remove missing values
        mask = ~np.isnan(X).any(axis=1)
        X_clean = X[mask]
        y_clean = y[mask]

        # Normalize features
        mean = np.mean(X_clean, axis=0)
        std = np.std(X_clean, axis=0)
        X_normalized = (X_clean - mean) / (std + 1e-8)

        return X_normalized, y_clean

    def train(self, X_train, y_train):
        """Train the random forest model."""
        self.model.fit(X_train, y_train)
        self.is_trained = True

    def predict(self, X_test):
        """Make predictions on test data."""
        if not self.is_trained:
            raise ValueError("Model must be trained before prediction")
        return self.model.predict(X_test)

    def evaluate(self, X_test, y_test):
        """Evaluate model performance."""
        predictions = self.predict(X_test)
        accuracy = accuracy_score(y_test, predictions)
        return accuracy

# Example usage
if __name__ == "__main__":
    # Generate synthetic data
    np.random.seed(42)
    X = np.random.randn(1000, 10)
    y = (X[:, 0] + X[:, 1] > 0).astype(int)

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Create and train pipeline
    pipeline = MLPipeline(n_estimators=50)
    X_train_processed, y_train_processed = pipeline.preprocess_data(X_train, y_train)
    pipeline.train(X_train_processed, y_train_processed)

    # Evaluate
    X_test_processed, y_test_processed = pipeline.preprocess_data(X_test, y_test)
    accuracy = pipeline.evaluate(X_test_processed, y_test_processed)
    print(f"Model accuracy: {accuracy:.2%}")
        "#.to_string(),
        DocumentType::Code,
        None,
        vec!["python".to_string(), "machine-learning".to_string(), "sklearn".to_string()],
    ).await?;
    println!("  ✓ Indexed: Python ML Example");

    // JavaScript/React component
    let doc3_id = rag_service.index_document(
        "TodoList.tsx".to_string(),
        r#"
import React, { useState, useCallback, useMemo } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

interface TodoListProps {
  initialTodos?: Todo[];
  onSave?: (todos: Todo[]) => void;
}

export const TodoList: React.FC<TodoListProps> = ({
  initialTodos = [],
  onSave
}) => {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [newTodoText, setNewTodoText] = useState('');

  const addTodo = useCallback(() => {
    if (newTodoText.trim()) {
      const newTodo: Todo = {
        id: Date.now(),
        text: newTodoText,
        completed: false,
        priority: 'medium'
      };
      const updatedTodos = [...todos, newTodo];
      setTodos(updatedTodos);
      setNewTodoText('');
      onSave?.(updatedTodos);
    }
  }, [newTodoText, todos, onSave]);

  const toggleTodo = useCallback((id: number) => {
    const updatedTodos = todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    setTodos(updatedTodos);
    onSave?.(updatedTodos);
  }, [todos, onSave]);

  const filteredTodos = useMemo(() => {
    switch (filter) {
      case 'active':
        return todos.filter(todo => !todo.completed);
      case 'completed':
        return todos.filter(todo => todo.completed);
      default:
        return todos;
    }
  }, [todos, filter]);

  const stats = useMemo(() => ({
    total: todos.length,
    completed: todos.filter(t => t.completed).length,
    active: todos.filter(t => !t.completed).length
  }), [todos]);

  return (
    <div className="todo-list">
      <h2>Todo List ({stats.active} active, {stats.completed} completed)</h2>

      <div className="todo-input">
        <input
          type="text"
          value={newTodoText}
          onChange={(e) => setNewTodoText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a new todo..."
        />
        <button onClick={addTodo}>Add</button>
      </div>

      <div className="filters">
        <button onClick={() => setFilter('all')}>All</button>
        <button onClick={() => setFilter('active')}>Active</button>
        <button onClick={() => setFilter('completed')}>Completed</button>
      </div>

      <ul className="todo-items">
        {filteredTodos.map(todo => (
          <li key={todo.id} className={todo.completed ? 'completed' : ''}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span>{todo.text}</span>
            <span className={`priority-${todo.priority}`}>
              {todo.priority}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
        "#.to_string(),
        DocumentType::Code,
        None,
        vec!["react".to_string(), "typescript".to_string(), "component".to_string()],
    ).await?;
    println!("  ✓ Indexed: React TodoList Component");

    // Markdown documentation
    let doc4_id = rag_service.index_document(
        "API_GUIDE.md".to_string(),
        r#"
# REST API Design Guidelines

## Overview

This guide outlines best practices for designing RESTful APIs that are intuitive,
consistent, and maintainable.

## Core Principles

### 1. Use Nouns for Resources

URLs should represent resources (nouns), not actions (verbs):
- ✅ Good: `/api/users/123`
- ❌ Bad: `/api/getUser/123`

### 2. HTTP Methods Define Actions

- **GET**: Retrieve resources (idempotent)
- **POST**: Create new resources
- **PUT**: Update entire resources (idempotent)
- **PATCH**: Partial updates (idempotent)
- **DELETE**: Remove resources (idempotent)

### 3. Status Codes

Use appropriate HTTP status codes:
- **200 OK**: Successful GET, PUT, PATCH
- **201 Created**: Successful POST
- **204 No Content**: Successful DELETE
- **400 Bad Request**: Client error
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Authorization failed
- **404 Not Found**: Resource doesn't exist
- **500 Internal Server Error**: Server error

### 4. Versioning

Version your API to maintain backward compatibility:
- URL versioning: `/api/v1/users`
- Header versioning: `API-Version: 1`

### 5. Pagination

For large datasets, implement pagination:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

### 6. Error Handling

Provide clear error messages:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

## Security Considerations

- Always use HTTPS
- Implement rate limiting
- Use OAuth 2.0 or JWT for authentication
- Validate all input data
- Implement CORS properly
        "#.to_string(),
        DocumentType::Markdown,
        None,
        vec!["api".to_string(), "rest".to_string(), "guidelines".to_string()],
    ).await?;
    println!("  ✓ Indexed: API Design Guidelines\n");

    // Perform various searches
    println!("🔎 Performing semantic searches...\n");

    // Search 1: Memory management concepts
    let results1 = rag_service.search("memory safety garbage collection", 5, None).await?;
    println!("Query: 'memory safety garbage collection'");
    for (i, result) in results1.iter().enumerate() {
        println!("  {}. {} (score: {:.3})",
            i + 1,
            result.metadata.title,
            result.score
        );
        println!("     Preview: {}...",
            result.content.chars().take(100).collect::<String>().replace('\n', " ")
        );
    }
    println!();

    // Search 2: Machine learning code
    let results2 = rag_service.search("train model predictions accuracy", 5, None).await?;
    println!("Query: 'train model predictions accuracy'");
    for (i, result) in results2.iter().enumerate() {
        println!("  {}. {} (score: {:.3})",
            i + 1,
            result.metadata.title,
            result.score
        );
    }
    println!();

    // Search 3: React component state management
    let results3 = rag_service.search("React hooks useState component", 5, None).await?;
    println!("Query: 'React hooks useState component'");
    for (i, result) in results3.iter().enumerate() {
        println!("  {}. {} (score: {:.3})",
            i + 1,
            result.metadata.title,
            result.score
        );
    }
    println!();

    // Search 4: API best practices
    let results4 = rag_service.search("HTTP status codes REST endpoints", 5, None).await?;
    println!("Query: 'HTTP status codes REST endpoints'");
    for (i, result) in results4.iter().enumerate() {
        println!("  {}. {} (score: {:.3})",
            i + 1,
            result.metadata.title,
            result.score
        );
    }
    println!();

    // Search with type filtering
    println!("🔍 Searching only code files...");
    let code_results = rag_service.search(
        "function class import",
        5,
        Some(vec![DocumentType::Code])
    ).await?;
    for (i, result) in code_results.iter().enumerate() {
        println!("  {}. {} (type: {:?}, score: {:.3})",
            i + 1,
            result.metadata.title,
            result.metadata.document_type,
            result.score
        );
    }
    println!();

    // Get statistics
    println!("📊 RAG Statistics:");
    let stats = rag_service.get_stats().await?;
    println!("  - Total documents: {}", stats.total_documents);
    println!("  - Total chunks: {}", stats.total_chunks);
    println!("  - Total embeddings: {}", stats.total_embeddings);
    println!("  - Index size: {} KB", stats.index_size_bytes / 1024);
    println!("  - Projects tracked: {}", stats.projects_tracked);
    println!();

    // Health check
    println!("🏥 System Health:");
    let health = rag_service.health_check().await?;
    println!("  - Overall status: {:?}", health.status);
    for (component, status) in health.components {
        println!("  - {}: {:?}", component, status.status);
        if let Some(msg) = status.message {
            println!("      {}", msg);
        }
    }

    println!("\n✅ RAG demo with real embeddings completed successfully!");
    println!("\n💡 Tips:");
    println!("  - Set OPENAI_API_KEY for OpenAI embeddings");
    println!("  - Set COHERE_API_KEY for Cohere embeddings");
    println!("  - Use --features embeddings-local for local models");
    println!("  - Use --features embeddings-onnx for ONNX Runtime");

    Ok(())
}