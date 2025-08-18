import { App } from 'obsidian';

/**
 * Manages CSS styles for the plugin
 */
export class StyleManager {
  private app: App;
  private styleElementId: string;
  private cssPath: string;

  /**
   * Create a new StyleManager
   * @param app Obsidian app instance
   * @param pluginManifestDir Plugin manifest directory
   * @param styleElementId ID to use for the style element
   * @param cssPath Path to the CSS file relative to the plugin directory
   */
  constructor(
    app: App, 
    pluginManifestDir: string,
    styleElementId: string = 'vespera-robust-processing-styles',
    cssPath: string = '/src/ui/robust-processing.css'
  ) {
    this.app = app;
    this.styleElementId = styleElementId;
    this.cssPath = pluginManifestDir + cssPath;
  }

  /**
   * Load CSS styles for the plugin
   */
  async loadStyles(): Promise<void> {
    try {
      // Create a style element
      const styleEl = document.createElement('style');
      styleEl.id = this.styleElementId;
      
      try {
        // Load the CSS file using the proper Obsidian API
        const css = await this.app.vault.adapter.read(this.cssPath);
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
        console.log(`Successfully loaded styles from ${this.cssPath}`);
      } catch (error) {
        console.error('Error loading CSS:', error);
        // Fallback: Try loading using the resource path method
        const resourcePath = this.app.vault.adapter.getResourcePath(this.cssPath);
        
        const response = await fetch(resourcePath);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const css = await response.text();
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
        console.log(`Successfully loaded styles from ${this.cssPath} (fallback method)`);
      }
    } catch (error) {
      console.error('Error in loadStyles:', error);
      throw error;
    }
  }

  /**
   * Remove CSS styles
   */
  removeStyles(): void {
    const styleEl = document.getElementById(this.styleElementId);
    if (styleEl) {
      styleEl.remove();
      console.log(`Removed styles with ID ${this.styleElementId}`);
    }
  }

  /**
   * Add a custom CSS class to an element
   * @param element Element to add the class to
   * @param className CSS class name to add
   */
  addClassToElement(element: HTMLElement, className: string): void {
    element.classList.add(className);
  }

  /**
   * Remove a custom CSS class from an element
   * @param element Element to remove the class from
   * @param className CSS class name to remove
   */
  removeClassFromElement(element: HTMLElement, className: string): void {
    element.classList.remove(className);
  }

  /**
   * Apply custom inline styles to an element
   * @param element Element to style
   * @param styles Object containing style properties and values
   */
  applyStyles(element: HTMLElement, styles: Record<string, string>): void {
    Object.entries(styles).forEach(([property, value]) => {
      element.style[property as any] = value;
    });
  }
}