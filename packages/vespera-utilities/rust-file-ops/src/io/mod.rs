//! High-performance file I/O operations
//! 
//! Provides optimized file reading, writing, and monitoring capabilities
//! with automatic strategy selection based on file size and use case.

pub mod reader;
pub mod writer;
pub mod watcher;
pub mod strategy;

pub use reader::FileReader;
pub use writer::FileWriter;
pub use watcher::FileWatcher;
pub use strategy::FileStrategy;