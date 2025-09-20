//! # RAG Demo
//!
//! Demonstrates the basic functionality of the RAG system

use vespera_bindery::rag::{RAGService, RAGConfig, DocumentType};
use std::path::Path;
use tempfile::TempDir;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("Vespera Bindery RAG Demo\n");

    // Create a temporary directory for testing
    let temp_dir = TempDir::new()?;
    println!("Created temporary directory: {:?}", temp_dir.path());

    // Initialize RAG service with default config
    let config = RAGConfig::default();
    let rag_service = RAGService::new(temp_dir.path(), config).await?;
    println!("✅ RAG service initialized");

    // Index a sample document
    println!("\n📝 Indexing sample documents...");

    let doc1_id = rag_service.index_document(
        "Rust Programming Guide".to_string(),
        "Rust is a systems programming language focused on safety, speed, and concurrency. \
         It achieves memory safety without garbage collection through its ownership system.".to_string(),
        DocumentType::Text,
        None,
        vec!["rust".to_string(), "programming".to_string()],
    ).await?;
    println!("  - Indexed document 1: {}", doc1_id);

    let doc2_id = rag_service.index_document(
        "Python Quick Start".to_string(),
        "Python is a high-level, interpreted programming language known for its simplicity \
         and readability. It's widely used in data science, web development, and automation.".to_string(),
        DocumentType::Text,
        None,
        vec!["python".to_string(), "programming".to_string()],
    ).await?;
    println!("  - Indexed document 2: {}", doc2_id);

    // Test code analysis
    println!("\n🔍 Testing code analysis...");
    let code_sample = r#"
def calculate_sum(a: int, b: int) -> int:
    """Calculate the sum of two numbers."""
    return a + b

class Calculator:
    def __init__(self):
        self.result = 0

    def add(self, value: int):
        self.result += value
        return self.result
"#;

    let code_doc_id = rag_service.index_document(
        "calculator.py".to_string(),
        code_sample.to_string(),
        DocumentType::Code,
        None,
        vec!["python".to_string(), "calculator".to_string()],
    ).await?;
    println!("  - Indexed code document: {}", code_doc_id);

    // Perform searches
    println!("\n🔎 Performing searches...");

    let results1 = rag_service.search("programming language", 5, None).await?;
    println!("  Query: 'programming language'");
    for (i, result) in results1.iter().enumerate() {
        println!("    {}. {} (score: {:.3})",
            i + 1,
            result.metadata.title,
            result.score
        );
    }

    let results2 = rag_service.search("safety memory", 5, None).await?;
    println!("\n  Query: 'safety memory'");
    for (i, result) in results2.iter().enumerate() {
        println!("    {}. {} (score: {:.3})",
            i + 1,
            result.metadata.title,
            result.score
        );
    }

    // Get statistics
    println!("\n📊 RAG Statistics:");
    let stats = rag_service.get_stats().await?;
    println!("  - Total documents: {}", stats.total_documents);
    println!("  - Total chunks: {}", stats.total_chunks);
    println!("  - Total embeddings: {}", stats.total_embeddings);
    println!("  - Index size: {} bytes", stats.index_size_bytes);
    println!("  - Projects tracked: {}", stats.projects_tracked);

    // Health check
    println!("\n🏥 Health Check:");
    let health = rag_service.health_check().await?;
    println!("  - Overall status: {:?}", health.status);
    for (component, status) in health.components {
        println!("  - {}: {:?}", component, status.status);
    }

    // Test project management
    println!("\n📁 Project Management:");
    let project_manager = rag_service.project_manager.clone();
    let projects = project_manager.get_all_projects().await;
    println!("  - Total projects: {}", projects.len());
    for project in projects {
        println!("    • {} at {:?}", project.name, project.root_path);
    }

    println!("\n✅ RAG demo completed successfully!");

    Ok(())
}