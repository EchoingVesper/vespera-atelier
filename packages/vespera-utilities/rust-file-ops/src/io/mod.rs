//! High-performance file I/O operations
//! 
//! Provides optimized file reading, writing, and monitoring capabilities
//! with automatic strategy selection based on file size and use case.

pub mod reader;
pub mod writer;
pub mod strategy;
// pub mod watcher; // Disabled due to compatibility issues with EditError

pub use reader::FileReader;
pub use writer::FileWriter;
pub use strategy::FileStrategy;
// pub use watcher::FileWatcher; // Disabled