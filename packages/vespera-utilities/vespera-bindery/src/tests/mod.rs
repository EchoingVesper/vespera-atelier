//! Test modules for Vespera Bindery
//!
//! This module contains comprehensive tests for memory leak prevention and 
//! resource management in the CRDT system.

pub mod memory_leak_tests;

// Re-export test functions for easier access
pub use memory_leak_tests::*;