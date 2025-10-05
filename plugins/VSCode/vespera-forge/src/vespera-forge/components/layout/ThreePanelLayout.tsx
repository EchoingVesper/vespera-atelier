/**
 * Three Panel Layout Component
 * Core layout component for Vespera Forge UI
 * Compatible with both VS Code and Obsidian environments
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PlatformAdapter, UIState } from '../../core/types';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

interface ThreePanelLayoutProps {
  platformAdapter: PlatformAdapter;
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  initialState?: Partial<UIState>;
  onStateChange?: (state: UIState) => void;
  className?: string;
}

export const ThreePanelLayout: React.FC<ThreePanelLayoutProps> = ({
  platformAdapter,
  leftPanel,
  centerPanel,
  rightPanel,
  initialState,
  onStateChange,
  className
}) => {
  const [state, setState] = useState<UIState>({
    currentViewMode: 'default',
    leftPanelWidth: 300,
    rightPanelWidth: 350,
    showLeftPanel: true,
    showRightPanel: true,
    context: platformAdapter.getCurrentContext(),
    filters: [],
    ...initialState
  });

  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Responsive behavior
  useEffect(() => {
    const checkDeviceType = () => {
      const width = containerRef.current?.clientWidth || window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };

    checkDeviceType();
    window.addEventListener('resize', checkDeviceType);
    return () => window.removeEventListener('resize', checkDeviceType);
  }, []);

  // Apply platform-specific styling
  useEffect(() => {
    if (platformAdapter.type === 'vscode') {
      (platformAdapter as any).applyVSCodeStyling?.();
    } else if (platformAdapter.type === 'obsidian') {
      (platformAdapter as any).applyObsidianStyling?.();
    }
  }, [platformAdapter]);

  // Handle state changes
  const updateState = useCallback((updates: Partial<UIState>) => {
    const newState = { ...state, ...updates };
    setState(newState);
    onStateChange?.(newState);
  }, [state, onStateChange]);

  // Handle panel resize
  const handlePanelResize = useCallback((panel: 'left' | 'right', size: number) => {
    if (panel === 'left') {
      updateState({ leftPanelWidth: size });
    } else {
      updateState({ rightPanelWidth: size });
    }
  }, [updateState]);

  // Toggle panel visibility
  const togglePanel = useCallback((panel: 'left' | 'right') => {
    if (panel === 'left') {
      updateState({ showLeftPanel: !state.showLeftPanel });
    } else {
      updateState({ showRightPanel: !state.showRightPanel });
    }
  }, [state, updateState]);

  // Responsive layout configuration
  const getLayoutConfig = useCallback(() => {
    // In VS Code, always show desktop layout with all three panels
    // The platformAdapter type check ensures we're not hiding panels in VS Code context
    if (platformAdapter.type === 'vscode') {
      return {
        direction: 'horizontal' as const,
        showLeft: state.showLeftPanel,
        showRight: state.showRightPanel,
        leftSize: state.showLeftPanel ? 25 : 0,
        centerSize: 50,
        rightSize: state.showRightPanel ? 25 : 0
      };
    }

    // For other platforms (like Obsidian), use responsive behavior
    if (isMobile) {
      return {
        direction: 'vertical' as const,
        showLeft: false,
        showRight: false,
        leftSize: 0,
        centerSize: 100,
        rightSize: 0
      };
    }

    if (isTablet) {
      return {
        direction: 'horizontal' as const,
        showLeft: state.showLeftPanel,
        showRight: false,
        leftSize: state.showLeftPanel ? 30 : 0,
        centerSize: state.showLeftPanel ? 70 : 100,
        rightSize: 0
      };
    }

    return {
      direction: 'horizontal' as const,
      showLeft: state.showLeftPanel,
      showRight: state.showRightPanel,
      leftSize: state.showLeftPanel ? 25 : 0,
      centerSize: 50,
      rightSize: state.showRightPanel ? 25 : 0
    };
  }, [isMobile, isTablet, state, platformAdapter]);

  const layoutConfig = getLayoutConfig();

  // Platform-specific theme classes
  const themeClasses = cn(
    'vespera-forge-layout',
    `platform-${platformAdapter.type}`,
    `theme-${platformAdapter.getTheme()}`,
    {
      'mobile-layout': isMobile,
      'tablet-layout': isTablet,
      'desktop-layout': !isMobile && !isTablet
    }
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'h-full w-full overflow-hidden',
        themeClasses,
        className
      )}
      data-device-type={isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'}
      data-platform={platformAdapter.type}
    >
      <PanelGroup
        direction={layoutConfig.direction}
        className="h-full"
      >
        {/* Left Panel */}
        {layoutConfig.showLeft && (
          <>
            <Panel
              defaultSize={layoutConfig.leftSize}
              minSize={15}
              maxSize={40}
              className="min-w-0"
            >
              <div className="h-full overflow-auto border-r border-border bg-background">
                {leftPanel}
              </div>
            </Panel>
            <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />
          </>
        )}

        {/* Center Panel */}
        <Panel
          defaultSize={layoutConfig.centerSize}
          minSize={30}
          className="min-w-0"
        >
          <div className="h-full overflow-auto bg-background">
            {centerPanel}
          </div>
        </Panel>

        {/* Right Panel */}
        {layoutConfig.showRight && (
          <>
            <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />
            <Panel
              defaultSize={layoutConfig.rightSize}
              minSize={20}
              maxSize={50}
              className="min-w-0"
            >
              <div className="h-full overflow-auto border-l border-border bg-background">
                {rightPanel}
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>

      {/* Mobile Navigation */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background">
          <div className="flex justify-around p-2">
            <button
              onClick={() => togglePanel('left')}
              className={cn(
                'flex flex-col items-center p-2 rounded-md transition-colors',
                state.showLeftPanel ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="text-xs mt-1">Nav</span>
            </button>

            <button
              className="flex flex-col items-center p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs mt-1">Content</span>
            </button>

            <button
              onClick={() => togglePanel('right')}
              className={cn(
                'flex flex-col items-center p-2 rounded-md transition-colors',
                state.showRightPanel ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-xs mt-1">AI</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreePanelLayout;
