//! Instrumentation utilities for different system components
//!
//! Provides specialized instrumentation functions for database operations,
//! CRDT operations, RAG system, and other core components.

use tracing::{Instrument, Span};
use std::future::Future;
use crate::errors::BinderyError;

/// Database operation instrumentation
pub struct DatabaseInstrumentation;

impl DatabaseInstrumentation {
    /// Instrument a database query operation
    pub async fn instrument_query<F, T>(
        operation: &str,
        query: &str,
        future: F,
    ) -> Result<T, BinderyError>
    where
        F: Future<Output = Result<T, BinderyError>>,
    {
        let span = tracing::info_span!(
            "database_query",
            operation = operation,
            component = "database",
            query = %query
        );

        let _timer = crate::observability::PerformanceTimer::new(operation, "database");

        let result = future.instrument(span).await;

        match &result {
            Ok(_) => {
                tracing::debug!(
                    operation = operation,
                    query = %query,
                    "Database query completed successfully"
                );
            }
            Err(err) => {
                tracing::error!(
                    operation = operation,
                    query = %query,
                    error = %err,
                    "Database query failed"
                );
            }
        }

        result
    }

    /// Instrument a database transaction
    pub async fn instrument_transaction<F, T>(
        operation: &str,
        future: F,
    ) -> Result<T, BinderyError>
    where
        F: Future<Output = Result<T, BinderyError>>,
    {
        let span = tracing::info_span!(
            "database_transaction",
            operation = operation,
            component = "database"
        );

        let _timer = crate::observability::PerformanceTimer::new(operation, "database_transaction");

        tracing::debug!(
            operation = operation,
            "Starting database transaction"
        );

        let result = future.instrument(span).await;

        match &result {
            Ok(_) => {
                tracing::info!(
                    operation = operation,
                    "Database transaction committed successfully"
                );
            }
            Err(err) => {
                tracing::error!(
                    operation = operation,
                    error = %err,
                    "Database transaction failed"
                );
            }
        }

        result
    }

    /// Instrument database migration operations
    pub async fn instrument_migration<F, T>(
        migration_name: &str,
        version: i64,
        future: F,
    ) -> Result<T, BinderyError>
    where
        F: Future<Output = Result<T, BinderyError>>,
    {
        let span = tracing::info_span!(
            "database_migration",
            migration_name = migration_name,
            version = version,
            component = "database"
        );

        tracing::info!(
            migration_name = migration_name,
            version = version,
            "Starting database migration"
        );

        let result = future.instrument(span).await;

        match &result {
            Ok(_) => {
                tracing::info!(
                    migration_name = migration_name,
                    version = version,
                    "Database migration completed successfully"
                );
            }
            Err(err) => {
                tracing::error!(
                    migration_name = migration_name,
                    version = version,
                    error = %err,
                    "Database migration failed"
                );
            }
        }

        result
    }
}

/// CRDT operation instrumentation
pub struct CrdtInstrumentation;

impl CrdtInstrumentation {
    /// Instrument CRDT text operations
    pub async fn instrument_text_operation<F, T>(
        operation: &str,
        codex_id: &uuid::Uuid,
        operation_count: Option<usize>,
        future: F,
    ) -> Result<T, BinderyError>
    where
        F: Future<Output = Result<T, BinderyError>>,
    {
        let span = tracing::info_span!(
            "crdt_text_operation",
            operation = operation,
            codex_id = %codex_id,
            operation_count = operation_count,
            component = "crdt_text"
        );

        let _timer = crate::observability::PerformanceTimer::new(operation, "crdt_text");

        let result = future.instrument(span).await;

        match &result {
            Ok(_) => {
                tracing::debug!(
                    operation = operation,
                    codex_id = %codex_id,
                    "CRDT text operation completed successfully"
                );
            }
            Err(err) => {
                tracing::error!(
                    operation = operation,
                    codex_id = %codex_id,
                    error = %err,
                    "CRDT text operation failed"
                );
            }
        }

        result
    }

    /// Instrument CRDT metadata operations
    pub async fn instrument_metadata_operation<F, T>(
        operation: &str,
        codex_id: &uuid::Uuid,
        metadata_keys: Option<&[String]>,
        future: F,
    ) -> Result<T, BinderyError>
    where
        F: Future<Output = Result<T, BinderyError>>,
    {
        let span = tracing::info_span!(
            "crdt_metadata_operation",
            operation = operation,
            codex_id = %codex_id,
            metadata_key_count = metadata_keys.map(|keys| keys.len()),
            component = "crdt_metadata"
        );

        let _timer = crate::observability::PerformanceTimer::new(operation, "crdt_metadata");

        if let Some(keys) = metadata_keys {
            tracing::debug!(
                operation = operation,
                codex_id = %codex_id,
                metadata_keys = ?keys,
                "Processing metadata operation"
            );
        }

        let result = future.instrument(span).await;

        match &result {
            Ok(_) => {
                tracing::debug!(
                    operation = operation,
                    codex_id = %codex_id,
                    "CRDT metadata operation completed successfully"
                );
            }
            Err(err) => {
                tracing::error!(
                    operation = operation,
                    codex_id = %codex_id,
                    error = %err,
                    "CRDT metadata operation failed"
                );
            }
        }

        result
    }

    /// Instrument CRDT synchronization operations
    pub async fn instrument_sync_operation<F, T>(
        operation: &str,
        peer_count: Option<usize>,
        data_size: Option<usize>,
        future: F,
    ) -> Result<T, BinderyError>
    where
        F: Future<Output = Result<T, BinderyError>>,
    {
        let span = tracing::info_span!(
            "crdt_sync_operation",
            operation = operation,
            peer_count = peer_count,
            data_size_bytes = data_size,
            component = "crdt_sync"
        );

        let _timer = crate::observability::PerformanceTimer::new(operation, "crdt_sync");

        tracing::info!(
            operation = operation,
            peer_count = peer_count,
            data_size_bytes = data_size,
            "Starting CRDT synchronization"
        );

        let result = future.instrument(span).await;

        match &result {
            Ok(_) => {
                tracing::info!(
                    operation = operation,
                    peer_count = peer_count,
                    "CRDT synchronization completed successfully"
                );
            }
            Err(err) => {
                tracing::error!(
                    operation = operation,
                    peer_count = peer_count,
                    error = %err,
                    "CRDT synchronization failed"
                );
            }
        }

        result
    }
}

/// RAG system instrumentation
pub struct RagInstrumentation;

impl RagInstrumentation {
    /// Instrument embedding generation operations
    pub async fn instrument_embedding_generation<F, T>(
        provider: &str,
        text_count: usize,
        total_chars: Option<usize>,
        future: F,
    ) -> Result<T, BinderyError>
    where
        F: Future<Output = Result<T, BinderyError>>,
    {
        let span = tracing::info_span!(
            "rag_embedding_generation",
            provider = provider,
            text_count = text_count,
            total_chars = total_chars,
            component = "rag_embeddings"
        );

        let _timer = crate::observability::PerformanceTimer::new("embedding_generation", "rag");

        tracing::info!(
            provider = provider,
            text_count = text_count,
            total_chars = total_chars,
            "Starting embedding generation"
        );

        let result = future.instrument(span).await;

        match &result {
            Ok(_) => {
                tracing::info!(
                    provider = provider,
                    text_count = text_count,
                    "Embedding generation completed successfully"
                );
            }
            Err(err) => {
                tracing::error!(
                    provider = provider,
                    text_count = text_count,
                    error = %err,
                    "Embedding generation failed"
                );
            }
        }

        result
    }

    /// Instrument vector search operations
    pub async fn instrument_vector_search<F, T>(
        query_type: &str,
        collection_size: Option<usize>,
        limit: usize,
        similarity_threshold: Option<f32>,
        future: F,
    ) -> Result<T, BinderyError>
    where
        F: Future<Output = Result<T, BinderyError>>,
    {
        let span = tracing::info_span!(
            "rag_vector_search",
            query_type = query_type,
            collection_size = collection_size,
            limit = limit,
            similarity_threshold = similarity_threshold,
            component = "rag_search"
        );

        let _timer = crate::observability::PerformanceTimer::new("vector_search", "rag");

        let result = future.instrument(span).await;

        match &result {
            Ok(_) => {
                tracing::debug!(
                    query_type = query_type,
                    limit = limit,
                    "Vector search completed successfully"
                );
            }
            Err(err) => {
                tracing::error!(
                    query_type = query_type,
                    limit = limit,
                    error = %err,
                    "Vector search failed"
                );
            }
        }

        result
    }

    /// Instrument document indexing operations
    pub async fn instrument_document_indexing<F, T>(
        document_count: usize,
        chunk_count: Option<usize>,
        future: F,
    ) -> Result<T, BinderyError>
    where
        F: Future<Output = Result<T, BinderyError>>,
    {
        let span = tracing::info_span!(
            "rag_document_indexing",
            document_count = document_count,
            chunk_count = chunk_count,
            component = "rag_indexing"
        );

        let _timer = crate::observability::PerformanceTimer::new("document_indexing", "rag");

        tracing::info!(
            document_count = document_count,
            chunk_count = chunk_count,
            "Starting document indexing"
        );

        let result = future.instrument(span).await;

        match &result {
            Ok(_) => {
                tracing::info!(
                    document_count = document_count,
                    chunk_count = chunk_count,
                    "Document indexing completed successfully"
                );
            }
            Err(err) => {
                tracing::error!(
                    document_count = document_count,
                    chunk_count = chunk_count,
                    error = %err,
                    "Document indexing failed"
                );
            }
        }

        result
    }
}

/// Task management instrumentation
pub struct TaskInstrumentation;

impl TaskInstrumentation {
    /// Instrument task execution
    pub async fn instrument_task_execution<F, T>(
        task_id: &uuid::Uuid,
        task_type: &str,
        role: Option<&str>,
        future: F,
    ) -> Result<T, BinderyError>
    where
        F: Future<Output = Result<T, BinderyError>>,
    {
        let span = tracing::info_span!(
            "task_execution",
            task_id = %task_id,
            task_type = task_type,
            role = role,
            component = "task_management"
        );

        let _timer = crate::observability::PerformanceTimer::new("task_execution", "task_management");

        tracing::info!(
            task_id = %task_id,
            task_type = task_type,
            role = role,
            "Starting task execution"
        );

        let result = future.instrument(span).await;

        match &result {
            Ok(_) => {
                tracing::info!(
                    task_id = %task_id,
                    task_type = task_type,
                    "Task execution completed successfully"
                );
            }
            Err(err) => {
                tracing::error!(
                    task_id = %task_id,
                    task_type = task_type,
                    error = %err,
                    "Task execution failed"
                );
            }
        }

        result
    }

    /// Instrument role assignment operations
    pub async fn instrument_role_assignment<F, T>(
        task_id: &uuid::Uuid,
        role_name: &str,
        capabilities: Option<&[String]>,
        future: F,
    ) -> Result<T, BinderyError>
    where
        F: Future<Output = Result<T, BinderyError>>,
    {
        let span = tracing::info_span!(
            "role_assignment",
            task_id = %task_id,
            role_name = role_name,
            capability_count = capabilities.map(|caps| caps.len()),
            component = "role_management"
        );

        let result = future.instrument(span).await;

        match &result {
            Ok(_) => {
                tracing::info!(
                    task_id = %task_id,
                    role_name = role_name,
                    "Role assignment completed successfully"
                );
            }
            Err(err) => {
                tracing::error!(
                    task_id = %task_id,
                    role_name = role_name,
                    error = %err,
                    "Role assignment failed"
                );
            }
        }

        result
    }
}

/// Convenience re-exports
pub use DatabaseInstrumentation as instrument_database;
pub use CrdtInstrumentation as instrument_crdt;
pub use RagInstrumentation as instrument_rag;
pub use TaskInstrumentation as instrument_task;