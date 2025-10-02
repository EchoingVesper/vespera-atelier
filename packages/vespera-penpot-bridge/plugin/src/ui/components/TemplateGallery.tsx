/**
 * Template Gallery component - Esc menu system for template selection
 */

import { useState, useEffect, useRef } from 'react';
import { TEMPLATE_REGISTRY } from '../../shared/templates';
import type { ComponentTemplate } from '../../shared/templates';

interface TemplateGalleryProps {
  onClose: () => void;
  onSelectTemplate: (templateId: string) => void;
  theme: 'light' | 'dark';
}

/**
 * Template gallery with keyboard navigation
 *
 * Keyboard shortcuts:
 * - Esc: Close gallery
 * - Arrow keys: Navigate templates
 * - Enter/Space: Select template
 * - Numpad 1-6: Quick select (first 6 templates)
 * - Numpad 0: Close
 */
export function TemplateGallery({ onClose, onSelectTemplate, theme }: TemplateGalleryProps) {
  const templates = Object.values(TEMPLATE_REGISTRY);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLDivElement>(null);

  // Auto-scroll selected card into view
  useEffect(() => {
    selectedCardRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation(); // Stop Penpot from receiving this
          onClose();
          break;

        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % templates.length);
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + templates.length) % templates.length);
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelectTemplate(templates[selectedIndex].id);
          onClose();
          break;

        // Numpad quick selection (1-6 for templates, 0 to close)
        case '0':
          if (e.location === KeyboardEvent.DOM_KEY_LOCATION_NUMPAD) {
            e.preventDefault();
            onClose();
          }
          break;

        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
          if (e.location === KeyboardEvent.DOM_KEY_LOCATION_NUMPAD) {
            e.preventDefault();
            const index = parseInt(e.key) - 1;
            if (index < templates.length) {
              onSelectTemplate(templates[index].id);
              onClose();
            }
          }
          break;
      }
    };

    // Focus gallery on mount
    galleryRef.current?.focus();

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, templates, onClose, onSelectTemplate]);

  // Group templates by category
  const templatesByCategory = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, ComponentTemplate[]>);

  return (
    <div
      ref={galleryRef}
      tabIndex={0}
      className={`template-gallery ${theme}`}
      role="dialog"
      aria-label="Template Gallery"
    >
      <div className="gallery-overlay" onClick={onClose} />
      <div className="gallery-content">
        <div className="gallery-header">
          <h2>Template Gallery</h2>
          <p className="gallery-subtitle">Press Esc to close • Arrow keys to navigate • Enter to select</p>
        </div>

        <div className="gallery-body">
          {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
            <div key={category} className="template-category">
              <h3 className="category-title">{category.charAt(0).toUpperCase() + category.slice(1)}s</h3>
              <div className="template-list">
                {categoryTemplates.map((template, idx) => {
                  const globalIndex = templates.findIndex((t) => t.id === template.id);
                  const isSelected = globalIndex === selectedIndex;
                  const numpadShortcut = globalIndex < 6 ? globalIndex + 1 : null;

                  return (
                    <div
                      key={template.id}
                      ref={isSelected ? selectedCardRef : null}
                      className={`template-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        onSelectTemplate(template.id);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <div className="template-card-header">
                        <h4>{template.name}</h4>
                        {numpadShortcut && (
                          <span className="keyboard-shortcut" title="Numpad shortcut">
                            {numpadShortcut}
                          </span>
                        )}
                      </div>
                      <p className="template-description">{template.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="gallery-footer">
          <div className="footer-shortcuts">
            <span><kbd>Numpad 1-{Math.min(templates.length, 6)}</kbd> Quick select</span>
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>Enter</kbd> Select</span>
            <span><kbd>Esc</kbd> or <kbd>Numpad 0</kbd> Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
