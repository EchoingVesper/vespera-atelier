/**
 * Project Creation Wizard Command
 * Phase 16b Stage 2 - Multi-step QuickPick for creating projects
 *
 * Provides a guided wizard experience for creating new projects:
 * 1. Select project type
 * 2. Enter project name
 * 3. Enter project description (optional)
 * 4. Confirm and create
 *
 * Uses VS Code native QuickPick interface for consistency with platform UX.
 */

import * as vscode from 'vscode';
import { ProjectService } from '../../services/ProjectService';
import { DEFAULT_PROJECT_TYPES, ProjectTypeDefinition, CreateProjectInput } from '../../types/project';

/**
 * QuickPickItem for project types with metadata
 */
interface ProjectTypeQuickPickItem extends vscode.QuickPickItem {
  projectType: ProjectTypeDefinition;
}

/**
 * Result of the wizard flow
 */
interface WizardResult {
  success: boolean;
  projectId?: string;
  error?: string;
}

/**
 * Create Project Wizard - main entry point
 *
 * Guides user through project creation with multi-step QuickPick interface.
 * Returns the created project ID on success, or undefined if cancelled.
 *
 * @param projectService - ProjectService instance for creating projects
 * @returns Promise<string | undefined> - Created project ID or undefined if cancelled
 */
export async function createProjectWizard(
  projectService: ProjectService
): Promise<string | undefined> {
  try {
    // Step 1: Select project type
    const projectType = await selectProjectType();
    if (!projectType) {
      return undefined; // User cancelled
    }

    // Step 2: Enter project name
    const projectName = await enterProjectName(projectService);
    if (!projectName) {
      return undefined; // User cancelled
    }

    // Step 3: Enter project description (optional)
    const projectDescription = await enterProjectDescription();
    // Description can be empty (user skipped)

    // Step 4: Confirm and create
    const confirmed = await confirmProjectCreation(projectName, projectType, projectDescription);
    if (!confirmed) {
      return undefined; // User cancelled
    }

    // Create the project
    const result = await createProject(
      projectService,
      projectName,
      projectType,
      projectDescription
    );

    if (result.success && result.projectId) {
      // Show success notification
      vscode.window.showInformationMessage(
        `Project "${projectName}" created successfully!`
      );

      // Set as active project
      await projectService.setActiveProject(result.projectId);

      return result.projectId;
    } else {
      // Show error notification
      vscode.window.showErrorMessage(
        `Failed to create project: ${result.error || 'Unknown error'}`
      );
      return undefined;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Project creation failed: ${message}`);
    return undefined;
  }
}

/**
 * Step 1: Select project type
 *
 * Shows QuickPick with all available project types.
 * Each item displays icon, name, and description.
 *
 * @returns Promise<ProjectTypeDefinition | undefined> - Selected type or undefined if cancelled
 */
async function selectProjectType(): Promise<ProjectTypeDefinition | undefined> {
  // Build QuickPick items from DEFAULT_PROJECT_TYPES
  const items: ProjectTypeQuickPickItem[] = DEFAULT_PROJECT_TYPES.map(typeDef => ({
    label: `${typeDef.icon || '📁'} ${typeDef.name}`,
    description: typeDef.category,
    detail: typeDef.description,
    projectType: typeDef
  }));

  // Show QuickPick
  const selected = await vscode.window.showQuickPick(items, {
    title: 'Create Project - Select Type',
    placeHolder: 'Choose a project type...',
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true
  });

  return selected?.projectType;
}

/**
 * Step 2: Enter project name
 *
 * Shows InputBox with validation:
 * - Non-empty
 * - 1-100 characters
 * - Valid characters (alphanumeric, spaces, hyphens, underscores, punctuation)
 * - Unique (not already used)
 *
 * @param projectService - ProjectService for checking name uniqueness
 * @returns Promise<string | undefined> - Project name or undefined if cancelled
 */
async function enterProjectName(
  projectService: ProjectService
): Promise<string | undefined> {
  const name = await vscode.window.showInputBox({
    title: 'Create Project - Enter Name',
    prompt: 'Enter a name for your project',
    placeHolder: 'My Project',
    ignoreFocusOut: true,
    validateInput: async (value: string) => {
      // Empty check
      if (!value || value.trim().length === 0) {
        return 'Project name cannot be empty';
      }

      // Length check
      if (value.length > 100) {
        return 'Project name cannot exceed 100 characters';
      }

      // Character validation (from PROJECT_CONSTANTS.NAME.PATTERN)
      const validPattern = /^[a-zA-Z0-9\s\-_.,!?'"()]+$/;
      if (!validPattern.test(value)) {
        return 'Project name contains invalid characters';
      }

      // Whitespace check
      if (value !== value.trim()) {
        return 'Project name cannot have leading or trailing whitespace';
      }

      // Uniqueness check
      try {
        const existingProjects = await projectService.listProjects();
        const nameExists = existingProjects.some(
          p => p.name.toLowerCase() === value.toLowerCase()
        );
        if (nameExists) {
          return `A project named "${value}" already exists`;
        }
      } catch (error) {
        // If we can't check uniqueness, allow it (will fail at creation)
        console.error('Failed to check project name uniqueness:', error);
      }

      return undefined; // Valid
    }
  });

  return name?.trim();
}

/**
 * Step 3: Enter project description (optional)
 *
 * Shows InputBox for optional description.
 * User can skip by leaving blank or pressing Escape.
 *
 * @returns Promise<string | undefined> - Description or undefined if skipped
 */
async function enterProjectDescription(): Promise<string | undefined> {
  const description = await vscode.window.showInputBox({
    title: 'Create Project - Enter Description (Optional)',
    prompt: 'Enter a description for your project (optional)',
    placeHolder: 'A brief description of what this project is about...',
    ignoreFocusOut: true,
    validateInput: (value: string) => {
      // Max length check (from PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH)
      if (value.length > 1000) {
        return 'Description cannot exceed 1000 characters';
      }
      return undefined; // Valid
    }
  });

  // Return undefined if empty (user skipped)
  return description && description.trim().length > 0
    ? description.trim()
    : undefined;
}

/**
 * Step 4: Confirm project creation
 *
 * Shows QuickPick with project details for final confirmation.
 *
 * @param name - Project name
 * @param type - Project type definition
 * @param description - Optional project description
 * @returns Promise<boolean> - True if confirmed, false if cancelled
 */
async function confirmProjectCreation(
  name: string,
  type: ProjectTypeDefinition,
  description?: string
): Promise<boolean> {
  const items: vscode.QuickPickItem[] = [
    {
      label: '✓ Create Project',
      description: 'Confirm and create the project',
      detail: `Create "${name}" as a ${type.name} project`
    },
    {
      label: '✗ Cancel',
      description: 'Cancel project creation',
      detail: 'Discard and return to navigator'
    }
  ];

  // Build summary details
  const details: string[] = [
    `Name: ${name}`,
    `Type: ${type.icon || '📁'} ${type.name}`,
    `Category: ${type.category || 'General'}`
  ];

  if (description) {
    details.push(`Description: ${description}`);
  }

  const selected = await vscode.window.showQuickPick(items, {
    title: 'Create Project - Confirm',
    placeHolder: details.join(' | '),
    ignoreFocusOut: true
  });

  return selected?.label === '✓ Create Project';
}

/**
 * Create the project via ProjectService
 *
 * Constructs CreateProjectInput and calls ProjectService.createProject().
 *
 * @param projectService - ProjectService instance
 * @param name - Project name
 * @param type - Project type definition
 * @param description - Optional description
 * @returns Promise<WizardResult> - Result with success status and project ID or error
 */
async function createProject(
  projectService: ProjectService,
  name: string,
  type: ProjectTypeDefinition,
  description?: string
): Promise<WizardResult> {
  try {
    // Build input
    const input: CreateProjectInput = {
      name,
      type: type.id,
      description,
      settings: {
        ...type.defaultSettings,
        icon: type.icon,
        enabledAutomation: type.defaultSettings?.enabledAutomation ?? false
      }
    };

    // Create project
    const project = await projectService.createProject(input);

    return {
      success: true,
      projectId: project.id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Register the command with VS Code
 *
 * Call this from extension.ts to register the command.
 *
 * @param context - Extension context
 * @param projectService - ProjectService instance
 */
export function registerCreateProjectWizardCommand(
  context: vscode.ExtensionContext,
  projectService: ProjectService
): void {
  const command = vscode.commands.registerCommand(
    'vespera-forge.createProjectWizard',
    async () => {
      await createProjectWizard(projectService);
    }
  );

  context.subscriptions.push(command);
}
