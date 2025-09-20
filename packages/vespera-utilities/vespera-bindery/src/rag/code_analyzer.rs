//! # Code Analyzer
//!
//! Analyzes source code for structure, dependencies, and potential issues.
//! Supports multiple programming languages with language-specific analysis.

use std::path::Path;
use std::fs;
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use regex::Regex;
use std::collections::HashMap;

/// Analysis result for a code file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeAnalysis {
    pub file_path: String,
    pub language: ProgrammingLanguage,
    pub imports: Vec<ImportInfo>,
    pub functions: Vec<FunctionInfo>,
    pub classes: Vec<ClassInfo>,
    pub structs: Vec<StructInfo>,
    pub dependencies: Dependencies,
    pub metrics: CodeMetrics,
    pub issues: Vec<CodeIssue>,
}

/// Programming languages supported by the analyzer
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ProgrammingLanguage {
    Rust,
    Python,
    JavaScript,
    TypeScript,
    Java,
    Go,
    CSharp,
    Unknown,
}

impl ProgrammingLanguage {
    /// Detect language from file extension
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "rs" => ProgrammingLanguage::Rust,
            "py" => ProgrammingLanguage::Python,
            "js" | "jsx" => ProgrammingLanguage::JavaScript,
            "ts" | "tsx" => ProgrammingLanguage::TypeScript,
            "java" => ProgrammingLanguage::Java,
            "go" => ProgrammingLanguage::Go,
            "cs" => ProgrammingLanguage::CSharp,
            _ => ProgrammingLanguage::Unknown,
        }
    }
}

/// Information about an import/use statement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportInfo {
    pub module: String,
    pub items: Vec<String>,
    pub is_wildcard: bool,
    pub line_number: usize,
}

/// Information about a function
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionInfo {
    pub name: String,
    pub parameters: Vec<String>,
    pub return_type: Option<String>,
    pub is_async: bool,
    pub is_public: bool,
    pub line_number: usize,
    pub line_count: usize,
    pub complexity: usize,
}

/// Information about a class
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassInfo {
    pub name: String,
    pub base_classes: Vec<String>,
    pub methods: Vec<FunctionInfo>,
    pub properties: Vec<String>,
    pub is_public: bool,
    pub line_number: usize,
}

/// Information about a struct (for languages like Rust, Go)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructInfo {
    pub name: String,
    pub fields: Vec<FieldInfo>,
    pub is_public: bool,
    pub line_number: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldInfo {
    pub name: String,
    pub type_name: Option<String>,
    pub is_public: bool,
}

/// Dependencies found in the code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dependencies {
    pub internal: Vec<String>,
    pub external: Vec<String>,
    pub standard: Vec<String>,
}

/// Code metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeMetrics {
    pub total_lines: usize,
    pub code_lines: usize,
    pub comment_lines: usize,
    pub blank_lines: usize,
    pub cyclomatic_complexity: usize,
    pub function_count: usize,
    pub class_count: usize,
}

/// Potential issues found in code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeIssue {
    pub severity: IssueSeverity,
    pub issue_type: IssueType,
    pub message: String,
    pub line_number: Option<usize>,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum IssueSeverity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum IssueType {
    UnusedImport,
    UnusedVariable,
    LongFunction,
    HighComplexity,
    MissingDocumentation,
    PotentialBug,
    StyleViolation,
}

/// Main code analyzer
pub struct CodeAnalyzer {
    analyzers: HashMap<ProgrammingLanguage, Box<dyn LanguageAnalyzer>>,
}

impl CodeAnalyzer {
    /// Create a new code analyzer
    pub fn new() -> Self {
        let mut analyzers: HashMap<ProgrammingLanguage, Box<dyn LanguageAnalyzer>> = HashMap::new();

        analyzers.insert(ProgrammingLanguage::Rust, Box::new(RustAnalyzer));
        analyzers.insert(ProgrammingLanguage::Python, Box::new(PythonAnalyzer));
        analyzers.insert(ProgrammingLanguage::JavaScript, Box::new(JavaScriptAnalyzer));
        analyzers.insert(ProgrammingLanguage::TypeScript, Box::new(TypeScriptAnalyzer));

        Self { analyzers }
    }

    /// Analyze a code file
    pub fn analyze_file(&self, file_path: &Path) -> Result<Option<CodeAnalysis>> {
        if !file_path.exists() || !file_path.is_file() {
            return Ok(None);
        }

        // Detect language
        let language = file_path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(ProgrammingLanguage::from_extension)
            .unwrap_or(ProgrammingLanguage::Unknown);

        if language == ProgrammingLanguage::Unknown {
            return Ok(None);
        }

        // Read file content
        let content = fs::read_to_string(file_path)
            .with_context(|| format!("Failed to read file: {:?}", file_path))?;

        self.analyze_code(&content, language, file_path.to_string_lossy().to_string())
    }

    /// Analyze code content
    pub fn analyze_code(
        &self,
        content: &str,
        language: ProgrammingLanguage,
        file_path: String,
    ) -> Result<Option<CodeAnalysis>> {
        if let Some(analyzer) = self.analyzers.get(&language) {
            analyzer.analyze(content, file_path)
        } else {
            // Fallback to generic analysis
            GenericAnalyzer.analyze(content, file_path)
        }
    }

    /// Find potential hallucinations in AI-generated code
    pub fn find_hallucinations(&self, analysis: &CodeAnalysis) -> Vec<CodeIssue> {
        let mut issues = Vec::new();

        // Check for suspicious patterns
        for import in &analysis.imports {
            if self.is_suspicious_import(&import.module) {
                issues.push(CodeIssue {
                    severity: IssueSeverity::Warning,
                    issue_type: IssueType::PotentialBug,
                    message: format!("Suspicious import: {} - verify this module exists", import.module),
                    line_number: Some(import.line_number),
                    suggestion: Some("Check if this is a real module or a hallucination".to_string()),
                });
            }
        }

        // Check for unusually complex functions
        for function in &analysis.functions {
            if function.complexity > 20 {
                issues.push(CodeIssue {
                    severity: IssueSeverity::Warning,
                    issue_type: IssueType::HighComplexity,
                    message: format!("Function '{}' has high complexity: {}", function.name, function.complexity),
                    line_number: Some(function.line_number),
                    suggestion: Some("Consider breaking this into smaller functions".to_string()),
                });
            }
        }

        issues
    }

    fn is_suspicious_import(&self, module: &str) -> bool {
        // Common AI hallucination patterns
        let suspicious_patterns = [
            "openai.completion",
            "anthropic.claude",
            "model.predict",
            "ai.generate",
        ];

        suspicious_patterns.iter().any(|pattern| module.contains(pattern))
    }
}

/// Trait for language-specific analyzers
trait LanguageAnalyzer: Send + Sync {
    fn analyze(&self, content: &str, file_path: String) -> Result<Option<CodeAnalysis>>;
}

/// Rust language analyzer
struct RustAnalyzer;

impl LanguageAnalyzer for RustAnalyzer {
    fn analyze(&self, content: &str, file_path: String) -> Result<Option<CodeAnalysis>> {
        let mut imports = Vec::new();
        let mut functions = Vec::new();
        let mut structs = Vec::new();
        let mut metrics = CodeMetrics {
            total_lines: 0,
            code_lines: 0,
            comment_lines: 0,
            blank_lines: 0,
            cyclomatic_complexity: 0,
            function_count: 0,
            class_count: 0,
        };

        // Regex patterns for Rust
        let use_regex = Regex::new(r"^\s*use\s+([^;]+)")?;
        let fn_regex = Regex::new(r"^\s*(pub\s+)?(async\s+)?fn\s+(\w+)")?;
        let struct_regex = Regex::new(r"^\s*(pub\s+)?struct\s+(\w+)")?;

        for (line_num, line) in content.lines().enumerate() {
            metrics.total_lines += 1;

            let trimmed = line.trim();
            if trimmed.is_empty() {
                metrics.blank_lines += 1;
            } else if trimmed.starts_with("//") {
                metrics.comment_lines += 1;
            } else {
                metrics.code_lines += 1;

                // Check for use statements
                if let Some(captures) = use_regex.captures(line) {
                    imports.push(ImportInfo {
                        module: captures[1].to_string(),
                        items: Vec::new(),
                        is_wildcard: captures[1].contains('*'),
                        line_number: line_num + 1,
                    });
                }

                // Check for functions
                if let Some(captures) = fn_regex.captures(line) {
                    let is_public = captures.get(1).is_some();
                    let is_async = captures.get(2).is_some();
                    let name = captures[3].to_string();

                    functions.push(FunctionInfo {
                        name,
                        parameters: Vec::new(), // TODO: Parse function parameters from signature
                        return_type: None, // TODO: Parse return type from function signature
                        is_async,
                        is_public,
                        line_number: line_num + 1,
                        line_count: 0, // TODO: Calculate function body line count
                        complexity: 1, // TODO: Calculate cyclomatic complexity
                    });

                    metrics.function_count += 1;
                }

                // Check for structs
                if let Some(captures) = struct_regex.captures(line) {
                    let is_public = captures.get(1).is_some();
                    let name = captures[2].to_string();

                    structs.push(StructInfo {
                        name,
                        fields: Vec::new(), // TODO: Parse struct fields from definition
                        is_public,
                        line_number: line_num + 1,
                    });
                }
            }
        }

        Ok(Some(CodeAnalysis {
            file_path,
            language: ProgrammingLanguage::Rust,
            imports,
            functions,
            classes: Vec::new(), // Rust doesn't have classes
            structs,
            dependencies: Dependencies {
                internal: Vec::new(),
                external: Vec::new(),
                standard: Vec::new(),
            },
            metrics,
            issues: Vec::new(),
        }))
    }
}

/// Python language analyzer
struct PythonAnalyzer;

impl LanguageAnalyzer for PythonAnalyzer {
    fn analyze(&self, content: &str, file_path: String) -> Result<Option<CodeAnalysis>> {
        let mut imports = Vec::new();
        let mut functions = Vec::new();
        let mut classes = Vec::new();
        let mut metrics = CodeMetrics {
            total_lines: 0,
            code_lines: 0,
            comment_lines: 0,
            blank_lines: 0,
            cyclomatic_complexity: 0,
            function_count: 0,
            class_count: 0,
        };

        // Regex patterns for Python
        let import_regex = Regex::new(r"^\s*(from\s+(\S+)\s+)?import\s+(.+)")?;
        let def_regex = Regex::new(r"^(\s*)(async\s+)?def\s+(\w+)")?;
        let class_regex = Regex::new(r"^(\s*)class\s+(\w+)")?;

        for (line_num, line) in content.lines().enumerate() {
            metrics.total_lines += 1;

            let trimmed = line.trim();
            if trimmed.is_empty() {
                metrics.blank_lines += 1;
            } else if trimmed.starts_with('#') {
                metrics.comment_lines += 1;
            } else {
                metrics.code_lines += 1;

                // Check for imports
                if let Some(captures) = import_regex.captures(line) {
                    let module = if let Some(from_module) = captures.get(2) {
                        from_module.as_str().to_string()
                    } else {
                        captures[3].to_string()
                    };

                    imports.push(ImportInfo {
                        module,
                        items: Vec::new(), // TODO: Parse specific imported items from import statement
                        is_wildcard: captures[3].contains('*'),
                        line_number: line_num + 1,
                    });
                }

                // Check for function definitions
                if let Some(captures) = def_regex.captures(line) {
                    let _indent = captures[1].len();
                    let is_async = captures.get(2).is_some();
                    let name = captures[3].to_string();

                    functions.push(FunctionInfo {
                        name: name.clone(),
                        parameters: Vec::new(), // TODO: Parse function parameters from signature
                        return_type: None, // TODO: Parse Python type hints from function signature
                        is_async,
                        is_public: !name.starts_with('_'),
                        line_number: line_num + 1,
                        line_count: 0, // TODO: Calculate function body line count
                        complexity: 1, // TODO: Calculate cyclomatic complexity
                    });

                    metrics.function_count += 1;
                }

                // Check for class definitions
                if let Some(captures) = class_regex.captures(line) {
                    let name = captures[2].to_string();

                    classes.push(ClassInfo {
                        name: name.clone(),
                        base_classes: Vec::new(), // TODO: Parse base classes from class inheritance
                        methods: Vec::new(), // TODO: Parse class methods and their signatures
                        properties: Vec::new(), // TODO: Parse class properties and attributes
                        is_public: !name.starts_with('_'),
                        line_number: line_num + 1,
                    });

                    metrics.class_count += 1;
                }
            }
        }

        Ok(Some(CodeAnalysis {
            file_path,
            language: ProgrammingLanguage::Python,
            imports,
            functions,
            classes,
            structs: Vec::new(), // Python doesn't have structs
            dependencies: Dependencies {
                internal: Vec::new(),
                external: Vec::new(),
                standard: Vec::new(),
            },
            metrics,
            issues: Vec::new(),
        }))
    }
}

/// JavaScript language analyzer
struct JavaScriptAnalyzer;

impl LanguageAnalyzer for JavaScriptAnalyzer {
    fn analyze(&self, content: &str, file_path: String) -> Result<Option<CodeAnalysis>> {
        // Similar implementation for JavaScript
        GenericAnalyzer.analyze(content, file_path)
    }
}

/// TypeScript language analyzer
struct TypeScriptAnalyzer;

impl LanguageAnalyzer for TypeScriptAnalyzer {
    fn analyze(&self, content: &str, file_path: String) -> Result<Option<CodeAnalysis>> {
        // Similar implementation for TypeScript
        GenericAnalyzer.analyze(content, file_path)
    }
}

/// Generic analyzer for unknown languages
struct GenericAnalyzer;

impl LanguageAnalyzer for GenericAnalyzer {
    fn analyze(&self, content: &str, file_path: String) -> Result<Option<CodeAnalysis>> {
        let mut metrics = CodeMetrics {
            total_lines: 0,
            code_lines: 0,
            comment_lines: 0,
            blank_lines: 0,
            cyclomatic_complexity: 0,
            function_count: 0,
            class_count: 0,
        };

        for line in content.lines() {
            metrics.total_lines += 1;

            let trimmed = line.trim();
            if trimmed.is_empty() {
                metrics.blank_lines += 1;
            } else if trimmed.starts_with("//") || trimmed.starts_with('#') || trimmed.starts_with("/*") {
                metrics.comment_lines += 1;
            } else {
                metrics.code_lines += 1;
            }
        }

        Ok(Some(CodeAnalysis {
            file_path,
            language: ProgrammingLanguage::Unknown,
            imports: Vec::new(),
            functions: Vec::new(),
            classes: Vec::new(),
            structs: Vec::new(),
            dependencies: Dependencies {
                internal: Vec::new(),
                external: Vec::new(),
                standard: Vec::new(),
            },
            metrics,
            issues: Vec::new(),
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_language_detection() {
        assert_eq!(ProgrammingLanguage::from_extension("rs"), ProgrammingLanguage::Rust);
        assert_eq!(ProgrammingLanguage::from_extension("py"), ProgrammingLanguage::Python);
        assert_eq!(ProgrammingLanguage::from_extension("js"), ProgrammingLanguage::JavaScript);
        assert_eq!(ProgrammingLanguage::from_extension("unknown"), ProgrammingLanguage::Unknown);
    }

    #[test]
    fn test_rust_analysis() {
        let analyzer = CodeAnalyzer::new();
        let code = r#"
use std::collections::HashMap;

pub fn calculate_sum(a: i32, b: i32) -> i32 {
    a + b
}

struct Point {
    x: f64,
    y: f64,
}
"#;

        let analysis = analyzer
            .analyze_code(code, ProgrammingLanguage::Rust, "test.rs".to_string())
            .unwrap()
            .unwrap();

        assert_eq!(analysis.language, ProgrammingLanguage::Rust);
        assert_eq!(analysis.imports.len(), 1);
        assert_eq!(analysis.functions.len(), 1);
        assert_eq!(analysis.structs.len(), 1);
    }

    #[test]
    fn test_python_analysis() {
        let analyzer = CodeAnalyzer::new();
        let code = r#"
import os
from typing import List

def calculate_sum(a: int, b: int) -> int:
    return a + b

class Point:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y
"#;

        let analysis = analyzer
            .analyze_code(code, ProgrammingLanguage::Python, "test.py".to_string())
            .unwrap()
            .unwrap();

        assert_eq!(analysis.language, ProgrammingLanguage::Python);
        assert_eq!(analysis.imports.len(), 2);
        assert_eq!(analysis.functions.len(), 2); // calculate_sum and __init__
        assert_eq!(analysis.classes.len(), 1);
    }

    #[test]
    fn test_hallucination_detection() {
        let analyzer = CodeAnalyzer::new();
        let code = r#"
import openai.completion

def generate_text():
    model.predict("Hello")
"#;

        let analysis = analyzer
            .analyze_code(code, ProgrammingLanguage::Python, "test.py".to_string())
            .unwrap()
            .unwrap();

        let issues = analyzer.find_hallucinations(&analysis);
        assert!(!issues.is_empty());
        assert!(issues[0].message.contains("Suspicious import"));
    }
}