//! Codex serialization formats and I/O operations

use serde::{Deserialize, Serialize};
use crate::{BinderyResult, crdt::VesperaCRDT};

/// Codex serialization format options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CodexFormat {
    /// JSON5 format (human-readable with comments)
    Json5,

    /// Compact JSON format
    Json,

    /// YAML format
    Yaml,

    /// Binary format (MessagePack)
    Binary,

    /// Compressed binary format
    CompressedBinary,
}

/// Codex serializer/deserializer
#[derive(Debug)]
pub struct CodexSerializer {
    format: CodexFormat,
    compress: bool,
}

impl CodexSerializer {
    /// Create a new serializer with the specified format
    pub fn new(format: CodexFormat) -> Self {
        Self {
            format,
            compress: false,
        }
    }

    /// Enable/disable compression
    pub fn with_compression(mut self, compress: bool) -> Self {
        self.compress = compress;
        self
    }

    /// Serialize a CRDT to bytes
    pub fn serialize(&self, crdt: &VesperaCRDT) -> BinderyResult<Vec<u8>> {
        let bytes = match self.format {
            CodexFormat::Json5 => {
                let json = json5::to_string(crdt)?;
                json.into_bytes()
            }
            CodexFormat::Json => {
                serde_json::to_vec(crdt)?
            }
            CodexFormat::Yaml => {
                let yaml = serde_yaml::to_string(crdt)?;
                yaml.into_bytes()
            }
            CodexFormat::Binary | CodexFormat::CompressedBinary => {
                // MessagePack serialization for high performance and compact storage
                let msgpack_bytes = rmp_serde::to_vec(crdt)
                    .map_err(|e| crate::BinderyError::SerializationError(
                        format!("Failed to serialize to MessagePack: {}", e)
                    ))?;

                tracing::debug!(
                    "Serialized CRDT to MessagePack format: {} bytes",
                    msgpack_bytes.len()
                );
                msgpack_bytes
            }
        };

        if self.compress {
            // Implement compression using LZ4 (fast) or Zstd (better compression)
            // Using LZ4 for speed, but Zstd could be used for better compression ratios

            let compressed = lz4_flex::compress_prepend_size(&bytes);
            tracing::debug!(
                "Compressed {} bytes to {} bytes ({:.1}% reduction)",
                bytes.len(),
                compressed.len(),
                (1.0 - compressed.len() as f64 / bytes.len() as f64) * 100.0
            );
            Ok(compressed)
        } else {
            Ok(bytes)
        }
    }

    /// Deserialize bytes to a CRDT
    pub fn deserialize(&self, bytes: &[u8]) -> BinderyResult<VesperaCRDT> {
        let decompressed_bytes;
        let bytes = if self.compress {
            // Implement decompression using LZ4
            decompressed_bytes = lz4_flex::decompress_size_prepended(bytes)
                .map_err(|e| crate::BinderyError::DeserializationError(
                    format!("Failed to decompress data: {}", e)
                ))?;
            tracing::debug!(
                "Decompressed {} bytes to {} bytes",
                bytes.len(),
                decompressed_bytes.len()
            );
            &decompressed_bytes
        } else {
            bytes
        };

        match self.format {
            CodexFormat::Json5 => {
                let json = String::from_utf8(bytes.to_vec())
                    .map_err(|e| crate::BinderyError::DeserializationError(
                        format!("Failed to convert JSON5 bytes to UTF-8: {}", e)
                    ))?;
                let crdt = json5::from_str(&json)
                    .map_err(|e| crate::BinderyError::DeserializationError(
                        format!("Failed to parse JSON5 format: {}", e)
                    ))?;
                Ok(crdt)
            }
            CodexFormat::Json => {
                let crdt = serde_json::from_slice(bytes)
                    .map_err(|e| crate::BinderyError::DeserializationError(
                        format!("Failed to parse JSON format: {}", e)
                    ))?;
                Ok(crdt)
            }
            CodexFormat::Yaml => {
                let yaml = String::from_utf8(bytes.to_vec())
                    .map_err(|e| crate::BinderyError::DeserializationError(
                        format!("Failed to convert YAML bytes to UTF-8: {}", e)
                    ))?;
                let crdt = serde_yaml::from_str(&yaml)
                    .map_err(|e| crate::BinderyError::DeserializationError(
                        format!("Failed to parse YAML format: {}", e)
                    ))?;
                Ok(crdt)
            }
            CodexFormat::Binary | CodexFormat::CompressedBinary => {
                // Deserialize MessagePack format
                let crdt = rmp_serde::from_slice(bytes)
                    .map_err(|e| crate::BinderyError::DeserializationError(
                        format!("Failed to parse MessagePack format: {}", e)
                    ))?;

                tracing::debug!(
                    "Deserialized CRDT from MessagePack format: {} bytes",
                    bytes.len()
                );
                Ok(crdt)
            }
        }
    }

    /// Get the format used by this serializer
    pub fn format(&self) -> &CodexFormat {
        &self.format
    }

    /// Check if compression is enabled
    pub fn is_compressed(&self) -> bool {
        self.compress
    }

    /// Get the estimated size reduction from using this format
    pub fn estimated_size_factor(&self) -> f64 {
        match self.format {
            CodexFormat::Json5 => 1.0, // Baseline (human-readable)
            CodexFormat::Json => 0.8,  // More compact than JSON5
            CodexFormat::Yaml => 0.9,  // Similar to JSON5
            CodexFormat::Binary => 0.4, // MessagePack is much more compact
            CodexFormat::CompressedBinary => 0.2, // MessagePack + compression
        }
    }

    /// Check if this format is suitable for large codices
    pub fn is_suitable_for_large_codices(&self) -> bool {
        matches!(self.format, CodexFormat::Binary | CodexFormat::CompressedBinary)
    }

    /// Get the recommended format for a given data size
    pub fn recommend_format_for_size(size_bytes: usize) -> CodexFormat {
        if size_bytes > 1024 * 1024 { // > 1MB
            CodexFormat::CompressedBinary
        } else if size_bytes > 100 * 1024 { // > 100KB
            CodexFormat::Binary
        } else {
            CodexFormat::Json // Human readable for smaller files
        }
    }

    /// Create a serializer optimized for the given data size
    pub fn optimized_for_size(size_bytes: usize) -> Self {
        let format = Self::recommend_format_for_size(size_bytes);
        let compress = matches!(format, CodexFormat::CompressedBinary);
        Self { format, compress }
    }
}