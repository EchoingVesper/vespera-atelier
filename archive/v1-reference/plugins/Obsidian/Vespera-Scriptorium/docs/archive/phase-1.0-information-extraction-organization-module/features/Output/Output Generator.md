# Output Generator

**Architectural Role:** The Output Generator is responsible for creating the final output content based on the processed results and configured output options and templates. It takes the assembled document or processed data and formats it according to the desired output format (e.g., Markdown, HTML, JSON), incorporating metadata, statistics, and other elements as specified.

**Codebase Comparison Findings:**

The `createConsolidatedOutput` and `createSegmentedOutput` methods within the `OutputManager` class (`src/robust-processing/OutputManager.ts`) implement the core functionality for generating output content.

*   **Implementation:** These methods take an `AssembledDocument` and `OutputOptions` and produce formatted strings or a map of strings based on the selected `OutputFormat` and templates. They handle the inclusion of headers, footers, tables of contents, and the main document content.
*   **Discrepancies/Required Updates:**
    *   The "Output Generator" is not a distinct component but rather methods within the `OutputManager`. Separating this logic into a dedicated component would improve modularity.
    *   The generation logic is tightly coupled with the available `FormatTemplates` within the `OutputManager`. A dedicated "Output Templates" component should manage these templates.
    *   The generator currently works with an `AssembledDocument`. It might need to be more flexible to handle different types of processed data depending on the workflow.

**Checklist for Updates:**

*   [x] Design and implement a dedicated module/class for the "Output Generator".
*   [x] Define how the Output Generator receives processed data and output options.
*   [ ] Implement logic for generating output content based on the specified format and templates.
*   [ ] Ensure the Output Generator integrates with a dedicated "Output Templates" component.
*   [ ] Document the Output Generator's role, configuration, and implementation details.