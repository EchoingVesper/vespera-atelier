# Standardized Git Workflow Protocol

## 1. Context and Objective
This protocol establishes mandatory steps for Git commit and push operations. The primary objectives are to:
    a. Ensure all relevant file changes are consistently included in commits.
    b. Maintain a complete and transparent history of changes pushed to the remote repository.
    c. Facilitate accurate tracking and measurement of development progress.

## 2. Protocol Definition

### 2.1. Pre-Commit Staging - `git add .` Mandate
*   **Trigger:** Always, immediately before executing `git commit`.
*   **Action:** Navigate to the root directory of the Git repository and execute the command:
    ```bash
    git add .
    ```
*   **Purpose:** This command stages all new files, modified files, and deleted files within the entire working directory (respecting `.gitignore` configurations).
*   **Rationale:** To guarantee that each commit is comprehensive and captures the complete set of changes intended for that logical unit of work. This prevents accidental omission of files and ensures that the commit accurately reflects the state of the project for the changes being recorded.

### 2.2. Comprehensive Push - Full Branch State Mandate
*   **Trigger:** Always, when performing a `git push` operation to synchronize local commits with the remote repository.
*   **Action:** Ensure that all local commits on the current branch that are not yet present on the remote tracking branch are pushed. The standard commands for this are `git push` or `git push origin <current_branch_name>`.
*   **Prohibitions:**
    *   **No Partial Pushes:** Do not push only a subset of new local commits from the current branch (e.g., by attempting to push specific commit SHAs while leaving other preceding or subsequent local commits on the same branch unpushed).
    *   **No Direct File Pushes:** Do not attempt to push individual files directly to the remote repository outside the standard commit-then-push workflow. All changes must be part of a commit.
*   **Rationale:** To ensure the remote repository consistently reflects the full, sequential progress made on the local branch. This practice is critical for keeping project history known, progress measurable, and collaboration effective, as all team members will have access to a complete and coherent view of the branch's development.

## 3. Overall Desired Outcome
Adherence to this protocol will result in more robust, reliable, and transparent version control practices. Commits will be complete, and pushes will accurately represent the entirety of work ready to be shared, thereby improving code integration, review processes, and overall project visibility.