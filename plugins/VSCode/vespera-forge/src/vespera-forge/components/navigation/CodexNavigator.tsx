/**
 * Codex Navigator Component
 * Left panel navigation for browsing and organizing Codices
 */

import React, { useState, useMemo, useCallback } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  File, 
  Search, 
  Filter,
  Tag,
  Users,
  Settings,
  Plus,
  MoreHorizontal
} from 'lucide-react';
import { Codex, Template, RelationshipType, FilterConfig } from '../../core/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface CodexNavigatorProps {
  codices: Codex[];
  templates: Template[];
  selectedCodexId?: string;
  onCodexSelect: (codex: Codex) => void;
  onCodexCreate: (templateId: string) => void;
  onCodexDelete: (codexId: string) => void;
  onCodexUpdate: (codex: Codex) => void;
  className?: string;
}

type ViewMode = 'projects' | 'templates' | 'status' | 'tags' | 'relationships';

interface TreeNode {
  id: string;
  name: string;
  type: 'project' | 'template' | 'codex' | 'folder';
  children: TreeNode[];
  data?: any;
  expanded?: boolean;
  icon?: React.ReactNode;
  badge?: string | number;
}

export const CodexNavigator: React.FC<CodexNavigatorProps> = ({
  codices,
  templates,
  selectedCodexId,
  onCodexSelect,
  onCodexCreate,
  onCodexDelete,
  onCodexUpdate,
  className
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('projects');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterConfig[]>([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    codex: Codex | null;
  }>({ visible: false, x: 0, y: 0, codex: null });

  // Handle keyboard Delete key for selected codex
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      console.log('[Navigator] Key pressed:', event.key, 'selectedCodexId:', selectedCodexId);

      // Check if Delete key is pressed and a codex is selected
      if (event.key === 'Delete' && selectedCodexId) {
        // Prevent default behavior (if any)
        event.preventDefault();
        event.stopPropagation();

        console.log('[Navigator] Delete key detected for codex:', selectedCodexId);

        // Find the selected codex
        const selectedCodex = codices.find(c => c.id === selectedCodexId);
        if (selectedCodex) {
          console.log('[Navigator] Found codex to delete:', selectedCodex.name);
          // Confirm deletion
          if (confirm(`Are you sure you want to delete "${selectedCodex.name}"?`)) {
            onCodexDelete(selectedCodexId);
          }
        }
      }
    };

    // Attach to both document and window to ensure it captures events in VS Code webview
    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [selectedCodexId, codices, onCodexDelete]);

  // Close context menu on click outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0, codex: null });
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible]);

  const getTemplateIcon = (templateId: string): React.ReactNode => {
    // Return appropriate icon based on template type
    const iconMap: Record<string, React.ReactNode> = {
      'character': <Users className="w-4 h-4" />,
      'task': <Settings className="w-4 h-4" />,
      'scene': <File className="w-4 h-4" />,
      'music': <File className="w-4 h-4" />,
      'playlist': <File className="w-4 h-4" />
    };

    return iconMap[templateId] || <File className="w-4 h-4" />;
  };

  // Build tree structure based on view mode
  const treeData = useMemo(() => {
    const filteredCodices = codices.filter(codex => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return codex.name.toLowerCase().includes(query) ||
               codex.tags.some(tag => tag.toLowerCase().includes(query));
      }
      
      // Apply filters
      return filters.every(filter => {
        const value = codex.content[filter.field] || codex.metadata[filter.field as keyof typeof codex.metadata];
        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'contains':
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'startsWith':
            return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
          default:
            return true;
        }
      });
    });

    switch (viewMode) {
      case 'projects':
        return buildProjectTree(filteredCodices);
      case 'templates':
        return buildTemplateTree(filteredCodices, templates);
      case 'status':
        return buildStatusTree(filteredCodices);
      case 'tags':
        return buildTagTree(filteredCodices);
      case 'relationships':
        return buildRelationshipTree(filteredCodices);
      default:
        return buildProjectTree(filteredCodices);
    }
  }, [codices, templates, searchQuery, filters, viewMode]);

  function buildProjectTree(codices: Codex[]): TreeNode[] {
    const projects = new Map<string, TreeNode>();
    const root: TreeNode[] = [];

    // Group by project
    codices.forEach(codex => {
      const projectId = codex.metadata.projectId || 'uncategorized';
      
      if (!projects.has(projectId)) {
        const projectNode: TreeNode = {
          id: `project-${projectId}`,
          name: projectId === 'uncategorized' ? 'Uncategorized' : projectId,
          type: 'project',
          children: [],
          icon: <Folder className="w-4 h-4" />
        };
        projects.set(projectId, projectNode);
        root.push(projectNode);
      }

      const template = templates.find(t => t.id === codex.templateId);
      const projectNode = projects.get(projectId)!;
      
      projectNode.children.push({
        id: codex.id,
        name: codex.name,
        type: 'codex',
        children: [],
        data: codex,
        icon: template ? getTemplateIcon(template.id) : <File className="w-4 h-4" />,
        badge: codex.metadata.status
      });
    });

    return root;
  };

  function buildTemplateTree(codices: Codex[], templates: Template[]): TreeNode[] {
    const templateGroups = new Map<string, TreeNode>();
    const root: TreeNode[] = [];

    templates.forEach(template => {
      const templateNode: TreeNode = {
        id: `template-${template.id}`,
        name: template.name,
        type: 'template',
        children: [],
        icon: getTemplateIcon(template.id)
      };
      templateGroups.set(template.id, templateNode);
      root.push(templateNode);
    });

    codices.forEach(codex => {
      const templateNode = templateGroups.get(codex.templateId);
      if (templateNode) {
        templateNode.children.push({
          id: codex.id,
          name: codex.name,
          type: 'codex',
          children: [],
          data: codex,
          icon: <File className="w-4 h-4" />,
          badge: codex.metadata.status
        });
      }
    });

    return root;
  };

  function buildStatusTree(codices: Codex[]): TreeNode[] {
    const statusGroups = new Map<string, TreeNode>();
    const root: TreeNode[] = [];

    codices.forEach(codex => {
      const status = codex.metadata.status || 'no-status';
      
      if (!statusGroups.has(status)) {
        const statusNode: TreeNode = {
          id: `status-${status}`,
          name: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
          type: 'folder',
          children: [],
          icon: <Folder className="w-4 h-4" />
        };
        statusGroups.set(status, statusNode);
        root.push(statusNode);
      }

      const statusNode = statusGroups.get(status)!;
      const template = templates.find(t => t.id === codex.templateId);
      
      statusNode.children.push({
        id: codex.id,
        name: codex.name,
        type: 'codex',
        children: [],
        data: codex,
        icon: template ? getTemplateIcon(template.id) : <File className="w-4 h-4" />
      });
    });

    return root;
  };

  function buildTagTree(codices: Codex[]): TreeNode[] {
    const tagGroups = new Map<string, TreeNode>();
    const root: TreeNode[] = [];

    codices.forEach(codex => {
      // Safety check: ensure tags array exists
      if (!codex.tags || !Array.isArray(codex.tags) || codex.tags.length === 0) {
        // Add to "Untagged" group
        if (!tagGroups.has('untagged')) {
          const untaggedNode: TreeNode = {
            id: 'tag-untagged',
            name: 'Untagged',
            type: 'folder',
            children: [],
            icon: <Tag className="w-4 h-4 opacity-50" />
          };
          tagGroups.set('untagged', untaggedNode);
          root.push(untaggedNode);
        }

        const untaggedNode = tagGroups.get('untagged')!;
        const template = templates.find(t => t.id === codex.templateId);

        untaggedNode.children.push({
          id: codex.id,
          name: codex.name,
          type: 'codex',
          children: [],
          data: codex,
          icon: template ? getTemplateIcon(template.id) : <File className="w-4 h-4" />
        });
        return;
      }

      codex.tags.forEach(tag => {
        if (!tagGroups.has(tag)) {
          const tagNode: TreeNode = {
            id: `tag-${tag}`,
            name: tag,
            type: 'folder',
            children: [],
            icon: <Tag className="w-4 h-4" />
          };
          tagGroups.set(tag, tagNode);
          root.push(tagNode);
        }

        const tagNode = tagGroups.get(tag)!;
        const template = templates.find(t => t.id === codex.templateId);

        tagNode.children.push({
          id: codex.id,
          name: codex.name,
          type: 'codex',
          children: [],
          data: codex,
          icon: template ? getTemplateIcon(template.id) : <File className="w-4 h-4" />
        });
      });
    });

    return root;
  };

  function buildRelationshipTree(codices: Codex[]): TreeNode[] {
    const relationshipGroups = new Map<string, TreeNode>();
    const root: TreeNode[] = [];

    codices.forEach(codex => {
      // Safety check: ensure relationships array exists
      if (!codex.relationships || !Array.isArray(codex.relationships)) {
        return;
      }

      codex.relationships.forEach(relationship => {
        const relationshipType = relationship.type;

        if (!relationshipGroups.has(relationshipType)) {
          const relNode: TreeNode = {
            id: `rel-${relationshipType}`,
            name: relationshipType.replace('_', ' ').charAt(0).toUpperCase() +
                  relationshipType.replace('_', ' ').slice(1),
            type: 'folder',
            children: [],
            icon: <Users className="w-4 h-4" />
          };
          relationshipGroups.set(relationshipType, relNode);
          root.push(relNode);
        }

        const relNode = relationshipGroups.get(relationshipType)!;
        const template = templates.find(t => t.id === codex.templateId);

        relNode.children.push({
          id: codex.id,
          name: codex.name,
          type: 'codex',
          children: [],
          data: codex,
          icon: template ? getTemplateIcon(template.id) : <File className="w-4 h-4" />
        });
      });
    });

    // If no relationships found, show a message
    if (root.length === 0) {
      root.push({
        id: 'no-relationships',
        name: 'No relationships yet',
        type: 'folder',
        children: [],
        icon: <Users className="w-4 h-4 opacity-50" />
      });
    }

    return root;
  };

  const toggleNodeExpansion = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const renderTreeNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = node.type === 'codex' && node.data?.id === selectedCodexId;
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          className={cn(
            'group flex items-center gap-2 px-2 py-1 rounded-sm cursor-pointer transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            isSelected && 'bg-primary text-primary-foreground',
            depth > 0 && 'ml-4'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (node.type === 'codex' && node.data) {
              onCodexSelect(node.data);
            } else if (hasChildren) {
              toggleNodeExpansion(node.id);
            }
          }}
          onContextMenu={(e) => {
            // Show context menu for codex nodes
            if (node.type === 'codex' && node.data) {
              e.preventDefault();
              setContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                codex: node.data
              });
            }
          }}
        >
          {hasChildren && (
            <button
              className="p-0 hover:bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeExpansion(node.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}

          {node.icon}

          <span className="flex-1 text-sm truncate">{node.name}</span>

          {node.badge && (
            <Badge variant="secondary" className="text-xs">
              {node.badge}
            </Badge>
          )}

          {node.type === 'codex' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    if (node.data) onCodexSelect(node.data);
                  }}
                >
                  Open
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (node.data) onCodexDelete(node.data.id);
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-semibold">Codex Navigator</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {templates.map(template => (
                <DropdownMenuItem
                  key={template.id}
                  onClick={() => onCodexCreate(template.id)}
                >
                  {getTemplateIcon(template.id)}
                  <span className="ml-2">{template.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search codices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {/* View Mode Tabs */}
        <div className="flex gap-1 mt-3">
          {[
            { mode: 'projects' as ViewMode, label: 'Projects', icon: <Folder className="w-4 h-4" /> },
            { mode: 'templates' as ViewMode, label: 'Templates', icon: <Settings className="w-4 h-4" /> },
            { mode: 'status' as ViewMode, label: 'Status', icon: <Filter className="w-4 h-4" /> },
            { mode: 'tags' as ViewMode, label: 'Tags', icon: <Tag className="w-4 h-4" /> },
            { mode: 'relationships' as ViewMode, label: 'Relations', icon: <Users className="w-4 h-4" /> }
          ].map(({ mode, label, icon }) => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(mode)}
              className="flex items-center gap-1"
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </div>
      </div>
      
      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {treeData.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <File className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No codices found</p>
            </div>
          ) : (
            treeData.map(node => renderTreeNode(node))
          )}
        </div>
      </ScrollArea>

      {/* Custom Context Menu */}
      {contextMenu.visible && contextMenu.codex && (
        <div
          className="fixed bg-popover text-popover-foreground border border-border rounded-md shadow-md py-1 min-w-[160px] z-50"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              onCodexSelect(contextMenu.codex!);
              setContextMenu({ visible: false, x: 0, y: 0, codex: null });
            }}
          >
            Open
          </div>
          <div className="h-px bg-border my-1" />
          <div
            className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground text-destructive"
            onClick={() => {
              onCodexDelete(contextMenu.codex!.id);
              setContextMenu({ visible: false, x: 0, y: 0, codex: null });
            }}
          >
            Delete
          </div>
        </div>
      )}
    </div>
  );
};

export default CodexNavigator;