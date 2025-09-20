//! Test modules for Vespera Bindery
//!
//! This module contains comprehensive tests for all functionality in the CRDT system,
//! including memory management, CRDT operations, sync protocols, and integration tests.

pub mod memory_leak_tests;
pub mod crdt_tests;
pub mod property_tests;
pub mod codex_tests;
pub mod task_management_tests;
pub mod role_management_tests;
pub mod executor_tests;
pub mod sync_tests;
pub mod hook_system_tests;
pub mod rag_tests;
pub mod integration_tests;
pub mod utils;

// Re-export test functions for easier access
pub use memory_leak_tests::*;
pub use utils::*;