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
                // TODO: Implement MessagePack serialization
                return Err(crate::BinderyError::NotImplemented(
                    "Binary formats not yet implemented".to_string()
                ));
            }
        };

        if self.compress {
            // TODO: Implement compression
            Ok(bytes)
        } else {
            Ok(bytes)
        }
    }

    /// Deserialize bytes to a CRDT
    pub fn deserialize(&self, bytes: &[u8]) -> BinderyResult<VesperaCRDT> {
        let bytes = if self.compress {
            // TODO: Implement decompression
            bytes
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
                Err(crate::BinderyError::NotImplemented(
                    "Binary formats not yet implemented".to_string()
                ))
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
}