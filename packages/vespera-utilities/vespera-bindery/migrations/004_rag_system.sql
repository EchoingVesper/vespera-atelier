-- RAG (Retrieval-Augmented Generation) system tables
-- Creates tables for vector embeddings and semantic search capabilities
-- Version: 4
-- Created: 2024-09-20 12:00:00 UTC

-- +migrate up
-- Document embeddings table for RAG system
CREATE TABLE IF NOT EXISTS document_embeddings (
    id TEXT PRIMARY KEY,
    codex_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    content_text TEXT NOT NULL,
    embedding_vector TEXT NOT NULL, -- JSON array of floats representing the embedding
    embedding_model TEXT NOT NULL, -- Model used to generate embeddings
    chunk_index INTEGER NOT NULL DEFAULT 0, -- For documents split into chunks
    chunk_size INTEGER NOT NULL,
    metadata TEXT, -- JSON metadata about the embedding
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(codex_id) REFERENCES codices(id) ON DELETE CASCADE,
    UNIQUE(codex_id, content_hash, chunk_index)
);

-- Embedding search cache table for performance
CREATE TABLE IF NOT EXISTS embedding_searches (
    id TEXT PRIMARY KEY,
    query_text TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    query_embedding TEXT NOT NULL, -- JSON array of floats
    search_results TEXT NOT NULL, -- JSON array of search results with scores
    embedding_model TEXT NOT NULL,
    search_parameters TEXT, -- JSON search parameters (top_k, threshold, etc.)
    created_at TEXT NOT NULL,
    expires_at TEXT, -- TTL for cache entries
    hit_count INTEGER NOT NULL DEFAULT 1, -- How many times this search was used
    last_accessed_at TEXT NOT NULL
);

-- Collection metadata for embedding models
CREATE TABLE IF NOT EXISTS embedding_collections (
    id TEXT PRIMARY KEY,
    collection_name TEXT NOT NULL UNIQUE,
    model_name TEXT NOT NULL,
    model_config TEXT, -- JSON configuration for the embedding model
    dimension INTEGER NOT NULL, -- Embedding vector dimension
    distance_metric TEXT NOT NULL DEFAULT 'cosine', -- 'cosine', 'euclidean', 'dot_product'
    document_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1
);

-- Model performance metrics
CREATE TABLE IF NOT EXISTS embedding_metrics (
    id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL,
    operation_type TEXT NOT NULL, -- 'embedding', 'search', 'similarity'
    execution_time_ms INTEGER NOT NULL,
    token_count INTEGER,
    success BOOLEAN NOT NULL DEFAULT 1,
    error_message TEXT,
    created_at TEXT NOT NULL,
    metadata TEXT -- JSON metadata about the operation
);

-- Semantic similarity cache for related content discovery
CREATE TABLE IF NOT EXISTS semantic_similarities (
    id TEXT PRIMARY KEY,
    source_codex_id TEXT NOT NULL,
    target_codex_id TEXT NOT NULL,
    similarity_score REAL NOT NULL,
    similarity_type TEXT NOT NULL, -- 'content', 'title', 'tags', 'combined'
    model_name TEXT NOT NULL,
    calculated_at TEXT NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT 1, -- Invalidated when content changes
    FOREIGN KEY(source_codex_id) REFERENCES codices(id) ON DELETE CASCADE,
    FOREIGN KEY(target_codex_id) REFERENCES codices(id) ON DELETE CASCADE,
    UNIQUE(source_codex_id, target_codex_id, similarity_type, model_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_embeddings_codex_id ON document_embeddings(codex_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_content_hash ON document_embeddings(content_hash);
CREATE INDEX IF NOT EXISTS idx_embeddings_model ON document_embeddings(embedding_model);
CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON document_embeddings(created_at);

CREATE INDEX IF NOT EXISTS idx_search_cache_query_hash ON embedding_searches(query_hash);
CREATE INDEX IF NOT EXISTS idx_search_cache_model ON embedding_searches(embedding_model);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires_at ON embedding_searches(expires_at);
CREATE INDEX IF NOT EXISTS idx_search_cache_hit_count ON embedding_searches(hit_count);

CREATE INDEX IF NOT EXISTS idx_collections_name ON embedding_collections(collection_name);
CREATE INDEX IF NOT EXISTS idx_collections_model ON embedding_collections(model_name);
CREATE INDEX IF NOT EXISTS idx_collections_is_active ON embedding_collections(is_active);

CREATE INDEX IF NOT EXISTS idx_metrics_model ON embedding_metrics(model_name);
CREATE INDEX IF NOT EXISTS idx_metrics_operation ON embedding_metrics(operation_type);
CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON embedding_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_metrics_success ON embedding_metrics(success);

CREATE INDEX IF NOT EXISTS idx_similarities_source ON semantic_similarities(source_codex_id);
CREATE INDEX IF NOT EXISTS idx_similarities_target ON semantic_similarities(target_codex_id);
CREATE INDEX IF NOT EXISTS idx_similarities_score ON semantic_similarities(similarity_score);
CREATE INDEX IF NOT EXISTS idx_similarities_type ON semantic_similarities(similarity_type);
CREATE INDEX IF NOT EXISTS idx_similarities_valid ON semantic_similarities(is_valid);

-- +migrate down
-- Drop indexes first
DROP INDEX IF EXISTS idx_similarities_valid;
DROP INDEX IF EXISTS idx_similarities_type;
DROP INDEX IF EXISTS idx_similarities_score;
DROP INDEX IF EXISTS idx_similarities_target;
DROP INDEX IF EXISTS idx_similarities_source;

DROP INDEX IF EXISTS idx_metrics_success;
DROP INDEX IF EXISTS idx_metrics_created_at;
DROP INDEX IF EXISTS idx_metrics_operation;
DROP INDEX IF EXISTS idx_metrics_model;

DROP INDEX IF EXISTS idx_collections_is_active;
DROP INDEX IF EXISTS idx_collections_model;
DROP INDEX IF EXISTS idx_collections_name;

DROP INDEX IF EXISTS idx_search_cache_hit_count;
DROP INDEX IF EXISTS idx_search_cache_expires_at;
DROP INDEX IF EXISTS idx_search_cache_model;
DROP INDEX IF EXISTS idx_search_cache_query_hash;

DROP INDEX IF EXISTS idx_embeddings_created_at;
DROP INDEX IF EXISTS idx_embeddings_model;
DROP INDEX IF EXISTS idx_embeddings_content_hash;
DROP INDEX IF EXISTS idx_embeddings_codex_id;

-- Drop tables in reverse order
DROP TABLE IF EXISTS semantic_similarities;
DROP TABLE IF EXISTS embedding_metrics;
DROP TABLE IF EXISTS embedding_collections;
DROP TABLE IF EXISTS embedding_searches;
DROP TABLE IF EXISTS document_embeddings;