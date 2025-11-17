# ADR-024: Formula and Computed Fields

**Status**: Accepted
**Date**: 2025-01-17
**Deciders**: User (Aya), Claude Code AI Assistant
**Technical Story**: Phase 19 Planning - Dynamic Field Values

---

## Context and Problem Statement

In the Vespera Forge Codex system, some field values should be computed from other data rather than manually entered. Examples include:

**Use Cases**:
1. **Image dimensions**: ImageCodex should automatically compute width/height from file
2. **Character age**: Character's age should be computed from birthdate field
3. **File size**: FileCodex should show file size in human-readable format
4. **Word count**: MarkdownCodex should show word count of content
5. **Relationship count**: Show number of related Codices
6. **Formula fields**: User-defined calculations (e.g., `age * 365` = days_old)

Currently, all fields require manual entry. This creates maintenance burden (must update age manually every year) and misses opportunities for automation.

**Question**: Should we support computed/formula fields, and if so, how should they be implemented?

## Decision Drivers

* **Automation**: Reduce manual maintenance of derived values
* **Accuracy**: Computed values can't be accidentally wrong
* **Flexibility**: Support both template-defined computations and user formulas
* **Security**: Prevent arbitrary code execution vulnerabilities
* **Performance**: Caching to avoid recomputing on every access
* **User experience**: Formulas should be editable like Excel/Notion
* **Developer experience**: Easy to add new computed fields in templates

## Considered Options

**Option 1**: **Custom Parser** (Roll our own)
- Write custom formula parser and evaluator
- Full control over syntax and features
- High implementation effort

**Option 2**: **Integrate Existing Library** (Chosen)
- Use battle-tested formula/expression library
- Options: mathjs, expr-eval, formulajs
- Lower risk, faster implementation

**Option 3**: **AI/LLM-Based Computation**
- Use LLM to interpret and compute formulas
- Natural language formulas ("age in years")
- Too slow and expensive for real-time

## Decision Outcome

Chosen option: **"Option 2: Integrate Existing Library"**, specifically **mathjs** for its comprehensive feature set, safety, and active maintenance. We'll implement two field types:

1. **FORMULA**: User-editable expressions (Excel-like)
2. **COMPUTED**: Template-defined logic (developer-defined)

### Positive Consequences

* **Reduced maintenance**: Age computed from birthdate automatically
* **Accuracy**: No manual entry errors
* **Flexibility**: Users can create custom formulas
* **Safety**: Sandboxed evaluation prevents code injection
* **Performance**: Computed values cached and invalidated on dependency changes
* **Developer friendly**: Easy to add computed fields to templates
* **Excel-like UX**: Familiar formula syntax for users

### Negative Consequences

* **Dependency overhead**: Adding mathjs library to bundle
* **Complexity**: Formula parsing and dependency tracking
* **Cache invalidation**: Must track which fields affect computations
* **Error handling**: Invalid formulas need clear error messages
* **Learning curve**: Users must learn formula syntax

## Pros and Cons of the Options

### Option 1: Custom Parser

**Example**:
```typescript
// Custom formula parser
function evaluateFormula(formula: string, context: Record<string, any>): any {
  const tokens = tokenize(formula);
  const ast = parse(tokens);
  return evaluate(ast, context);
}

// Usage
const age = evaluateFormula('(today() - birthdate) / 365', {
  today: () => new Date(),
  birthdate: new Date('1990-01-01')
});
```

* Good, because **full control** (design syntax exactly as needed)
* Good, because **lightweight** (no external dependencies)
* Good, because **customizable** (add domain-specific functions easily)
* Bad, because **high effort** (weeks to implement and test)
* Bad, because **bug risk** (parsing is hard, edge cases abundant)
* Bad, because **maintenance burden** (must maintain parser long-term)
* Bad, because **no community** (users can't find formula examples online)

### Option 2: Integrate Existing Library (Chosen)

**Options Evaluated**:

**mathjs** (CHOSEN):
```typescript
import { create, all } from 'mathjs';

const math = create(all);

// Configure for safety
math.import({
  import: () => { throw new Error('Function import is disabled') },
  createUnit: () => { throw new Error('Unit creation is disabled') },
  evaluate: () => { throw new Error('Nested evaluate is disabled') }
}, { override: true });

// Usage
const age = math.evaluate('(today - birthdate) / 365', {
  today: Date.now(),
  birthdate: new Date('1990-01-01').getTime()
});
```

**expr-eval**:
```typescript
import { Parser } from 'expr-eval';

const parser = new Parser();
const age = parser.evaluate('(today - birthdate) / 365', {
  today: Date.now(),
  birthdate: new Date('1990-01-01').getTime()
});
```

**formulajs**:
```typescript
import * as formulajs from '@formulajs/formulajs';

// Excel-like formulas
const sum = formulajs.SUM([1, 2, 3]);  // 6
const average = formulajs.AVERAGE([10, 20, 30]);  // 20
```

**Decision: Use mathjs**

* Good, because **comprehensive** (math, logic, string functions)
* Good, because **safe** (sandboxed evaluation)
* Good, because **well-maintained** (active development)
* Good, because **flexible** (custom functions, unit conversions)
* Good, because **documented** (extensive docs and examples)
* Good, because **familiar syntax** (similar to Excel/calculator)
* Bad, because **bundle size** (~150KB minified, but tree-shakeable)
* Bad, because **learning curve** (users must learn syntax)
* Bad, because **external dependency** (supply chain risk, but acceptable)

### Option 3: AI/LLM-Based Computation

**Example**:
```typescript
// User enters natural language formula
const formula = "age in years, rounded down";

// LLM generates and executes formula
const prompt = `
Given:
- birthdate: 1990-01-01
- today: 2025-01-17

Compute: ${formula}

Return only the numeric result.
`;

const age = await llm.complete(prompt);  // "35"
```

* Good, because **natural language** (no formula syntax to learn)
* Good, because **flexible** (can express complex logic)
* Good, because **future-forward** (leverages AI capabilities)
* Bad, because **too slow** (seconds per formula, not real-time)
* Bad, because **expensive** (API costs for every computation)
* Bad, because **unreliable** (LLM might return wrong result)
* Bad, because **requires network** (doesn't work offline)
* Bad, because **not deterministic** (same input may yield different output)

## Implementation Details

### Field Type Definitions

**FORMULA Field**:
```typescript
interface FormulaFieldDefinition {
  id: string;                      // "days_alive"
  type: FieldType.FORMULA;         // FORMULA
  label: string;                   // "Days Alive"
  formula: string;                 // "age * 365"
  editable: boolean;               // Allow user to edit formula (default: true)
  dependencies: string[];          // ["age"] (auto-detected or explicit)
  format?: string;                 // Number format: "0,0.00"
}
```

**COMPUTED Field**:
```typescript
interface ComputedFieldDefinition {
  id: string;                      // "dimensions"
  type: FieldType.COMPUTED;        // COMPUTED
  label: string;                   // "Image Dimensions"
  computeFn: string;               // "getImageDimensions(file_path)"
  editable: boolean;               // false (computed fields not editable)
  dependencies: string[];          // ["file_path"]
  cacheTTL?: number;               // Cache duration in ms (default: 3600000 = 1 hour)
}
```

### mathjs Integration

**Safe Math Instance**:
```typescript
import { create, all } from 'mathjs';

// Create sandboxed math instance
function createSafeMath() {
  const math = create(all);

  // Disable dangerous functions
  const blocked = ['import', 'createUnit', 'evaluate', 'parse', 'compile'];
  const overrides = Object.fromEntries(
    blocked.map(name => [name, () => { throw new Error(`Function ${name} is disabled`) }])
  );
  math.import(overrides, { override: true });

  return math;
}

const safeMath = createSafeMath();
```

**Custom Functions**:
```typescript
// Add domain-specific functions
safeMath.import({
  // Date functions
  today: () => Date.now(),
  dateOf: (year: number, month: number, day: number) => new Date(year, month - 1, day).getTime(),
  yearsAgo: (years: number) => Date.now() - years * 365.25 * 24 * 60 * 60 * 1000,

  // String functions
  concat: (...args: string[]) => args.join(''),
  uppercase: (str: string) => str.toUpperCase(),
  lowercase: (str: string) => str.toLowerCase(),

  // Codex functions
  getFieldValue: async (codexId: string, fieldId: string) => {
    const codex = await loadCodex(codexId);
    return codex.fields[fieldId]?.value;
  },
  countRelationships: async (codexId: string, type: string) => {
    const relationships = await loadRelationships(codexId, type);
    return relationships.length;
  }
}, { override: false });
```

**Formula Evaluation**:
```typescript
async function evaluateFormula(
  formula: string,
  context: Record<string, any>
): Promise<any> {
  try {
    // Evaluate with context
    const result = safeMath.evaluate(formula, context);
    return result;
  } catch (error) {
    throw new FormulaError(`Invalid formula: ${error.message}`);
  }
}

// Usage
const scope = {
  age: 35,
  name: "Alice"
};

const daysAlive = await evaluateFormula('age * 365', scope);  // 12775
const greeting = await evaluateFormula('concat("Hello, ", name)', scope);  // "Hello, Alice"
```

### Dependency Tracking

**Auto-Detection**:
```typescript
function detectDependencies(formula: string): string[] {
  const ast = safeMath.parse(formula);
  const deps = new Set<string>();

  // Traverse AST to find variable names
  ast.traverse((node) => {
    if (node.type === 'SymbolNode' && !isMathFunction(node.name)) {
      deps.add(node.name);
    }
  });

  return Array.from(deps);
}

// Example
const deps = detectDependencies('age * 365 + bonus');  // ["age", "bonus"]
```

**Cache Invalidation**:
```typescript
class FormulaCache {
  private cache = new Map<string, { value: any; deps: string[] }>();

  async get(codexId: string, fieldId: string): Promise<any | null> {
    const key = `${codexId}:${fieldId}`;
    return this.cache.get(key)?.value || null;
  }

  set(codexId: string, fieldId: string, value: any, deps: string[]) {
    const key = `${codexId}:${fieldId}`;
    this.cache.set(key, { value, deps });
  }

  invalidate(codexId: string, changedFieldId: string) {
    // Invalidate all formulas that depend on changed field
    for (const [key, entry] of this.cache.entries()) {
      if (entry.deps.includes(changedFieldId)) {
        this.cache.delete(key);
      }
    }
  }
}

// Usage
const formulaCache = new FormulaCache();

// When field changes
async function updateField(codexId: string, fieldId: string, newValue: any) {
  await saveField(codexId, fieldId, newValue);
  formulaCache.invalidate(codexId, fieldId);  // Invalidate dependent formulas
}
```

### Computed Field Functions

**Built-in Compute Functions**:
```typescript
const computeFunctions = {
  // Image dimensions
  async getImageDimensions(filePath: string): Promise<{ width: number; height: number }> {
    const { width, height } = await getImageMetadata(filePath);
    return { width, height };
  },

  // File size
  async getFileSize(filePath: string): Promise<string> {
    const bytes = await getFileSizeBytes(filePath);
    return formatBytes(bytes);  // "1.5 MB"
  },

  // Word count
  wordCount(markdown: string): number {
    const text = stripMarkdown(markdown);
    return text.split(/\s+/).length;
  },

  // Relationship count
  async countRelatedCodexes(codexId: string, relationshipType: string): Promise<number> {
    const relationships = await loadRelationships(codexId, relationshipType);
    return relationships.length;
  },

  // Age from birthdate
  ageFromBirthdate(birthdate: Date): number {
    const now = new Date();
    const age = now.getFullYear() - birthdate.getFullYear();
    const monthDiff = now.getMonth() - birthdate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthdate.getDate())) {
      return age - 1;
    }
    return age;
  }
};
```

**Template Usage**:
```json5
{
  templateId: "image-codex",
  name: "Image",
  fields: [
    {
      id: "file_path",
      type: "FILE",
      label: "Image File"
    },
    {
      id: "dimensions",
      type: "COMPUTED",
      label: "Dimensions",
      computeFn: "getImageDimensions(file_path)",
      dependencies: ["file_path"],
      editable: false
    },
    {
      id: "file_size",
      type: "COMPUTED",
      label: "File Size",
      computeFn: "getFileSize(file_path)",
      dependencies: ["file_path"],
      editable: false
    }
  ]
}
```

### UI Components

**Formula Field Editor**:
```typescript
function FormulaFieldEditor({
  field,
  value,
  onChange,
  context
}: FieldEditorProps) {
  const [formula, setFormula] = useState(value || field.formula);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Evaluate formula when it changes
  useEffect(() => {
    evaluateFormula(formula, context)
      .then(res => {
        setResult(res);
        setError(null);
        onChange(res);
      })
      .catch(err => setError(err.message));
  }, [formula, context]);

  return (
    <div className="formula-field-editor">
      {field.editable ? (
        <input
          type="text"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          placeholder="Enter formula (e.g., age * 365)"
        />
      ) : (
        <div className="formula-readonly">{formula}</div>
      )}

      <div className="formula-result">
        {error ? (
          <span className="error">Error: {error}</span>
        ) : (
          <span className="result">= {formatValue(result)}</span>
        )}
      </div>
    </div>
  );
}
```

**Computed Field Display**:
```typescript
function ComputedFieldDisplay({ field, context }: FieldDisplayProps) {
  const [value, setValue] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check cache first
    const cached = formulaCache.get(context.codexId, field.id);
    if (cached !== null) {
      setValue(cached);
      setLoading(false);
      return;
    }

    // Compute value
    setLoading(true);
    computeFieldValue(field, context)
      .then(val => {
        setValue(val);
        formulaCache.set(context.codexId, field.id, val, field.dependencies);
      })
      .finally(() => setLoading(false));
  }, [field, context]);

  if (loading) {
    return <span className="computed-loading">Computing...</span>;
  }

  return (
    <div className="computed-field">
      <span className="label">{field.label}:</span>
      <span className="value">{formatValue(value)}</span>
      <button onClick={() => formulaCache.invalidate(context.codexId, field.id)}>
        🔄 Refresh
      </button>
    </div>
  );
}
```

### Error Handling

**Formula Errors**:
```typescript
class FormulaError extends Error {
  constructor(
    message: string,
    public formula: string,
    public position?: number
  ) {
    super(message);
    this.name = 'FormulaError';
  }
}

function validateFormula(formula: string): ValidationResult {
  try {
    // Parse to check syntax
    safeMath.parse(formula);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      position: error.char  // Position in formula string
    };
  }
}
```

**User-Friendly Error Messages**:
```typescript
function formatFormulaError(error: FormulaError): string {
  const messages: Record<string, string> = {
    'Undefined symbol': 'Unknown field or function',
    'Unexpected end of expression': 'Formula is incomplete',
    'Value expected': 'Missing value in formula',
    'Unexpected operator': 'Invalid operator usage'
  };

  for (const [pattern, message] of Object.entries(messages)) {
    if (error.message.includes(pattern)) {
      return message;
    }
  }

  return error.message;
}
```

## Example Use Cases

**Character Age**:
```json5
{
  templateId: "character",
  fields: [
    {
      id: "birthdate",
      type: "DATE",
      label: "Birthdate"
    },
    {
      id: "age",
      type: "FORMULA",
      label: "Age (years)",
      formula: "floor((today() - birthdate) / (365.25 * 24 * 60 * 60 * 1000))",
      dependencies: ["birthdate"],
      editable: false
    }
  ]
}
```

**Project Progress**:
```json5
{
  templateId: "project",
  fields: [
    {
      id: "total_tasks",
      type: "COMPUTED",
      computeFn: "countRelatedCodexes(id, 'HAS_TASK')",
      dependencies: []
    },
    {
      id: "completed_tasks",
      type: "COMPUTED",
      computeFn: "countRelatedCodexes(id, 'HAS_TASK', { status: 'completed' })",
      dependencies: []
    },
    {
      id: "progress_percent",
      type: "FORMULA",
      formula: "round((completed_tasks / total_tasks) * 100, 1)",
      dependencies: ["total_tasks", "completed_tasks"],
      format: "0.0%"
    }
  ]
}
```

## Migration Path

**Phase 19**: Integrate mathjs, implement FORMULA field type
**Phase 20**: Implement COMPUTED field type with built-in functions
**Phase 21**: Add dependency tracking and cache invalidation
**Phase 22**: Add formula validation and error messages in UI

## Links

* Refines [ADR-020: Extreme Atomic Codex Architecture](./ADR-020-extreme-atomic-architecture.md)
* Related to [ADR-023: Reference Field Implementation](./ADR-023-reference-field-implementation.md)
* Related to [ADR-025: File Integration Architecture](./ADR-025-file-integration-architecture.md)
