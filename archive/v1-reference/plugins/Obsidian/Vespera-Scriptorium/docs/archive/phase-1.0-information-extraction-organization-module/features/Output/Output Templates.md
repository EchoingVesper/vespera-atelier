# Output Templates

**Architectural Role:** Output Templates define the structure and formatting of the final output document for different formats (e.g., Markdown, HTML). They specify how the processed content, metadata, and statistics are arranged and presented in the final output file(s).

**Codebase Comparison Findings:**

The `formatTemplates` property within the `OutputManager` class (`src/robust-processing/OutputManager.ts`) contains the definitions for output templates for different formats.

*   **Implementation:** The `formatTemplates` object holds functions that generate header, section start, section end, and footer content for Markdown, HTML, Text, and JSON formats. These templates are used by the output generation methods in `OutputManager`.
*   **Discrepancies/Required Updates:**
    *   The "Output Templates" are defined directly within the `OutputManager` class, rather than being managed by a dedicated component. Separating this would improve modularity and make it easier to add or modify templates.
    *   There is no mechanism for users to customize or define their own output templates.
    *   The current templates are hardcoded. A system for loading templates from external files or configuration would be beneficial.

**Checklist for Updates:**

*   [ ] Design and implement a dedicated module/class for the "Output Templates" component.
*   [ ] Define a structure for representing output templates, including support for different formats and sections.
*   [ ] Implement mechanisms for loading, managing, and accessing output templates.
*   [ ] Consider adding support for user-defined or customizable templates.
*   [ ] Ensure the Output Generator integrates with the Output Templates component to retrieve and apply templates.
*   [ ] Document the Output Templates component, the template structure, and how to use/customize templates.