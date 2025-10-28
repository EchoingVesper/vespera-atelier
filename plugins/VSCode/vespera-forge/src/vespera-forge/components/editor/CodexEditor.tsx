/**
 * Codex Editor Component
 * Context-adaptive template-driven content editor
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Codex, Template, TemplateField, FieldType, Context } from '../../core/types';
import { PlatformAdapter } from '../../core/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Save,
  Eye,
  Edit,
  Settings,
  GitBranch,
  Users,
  // Tag, // Unused - may be needed for tag management UI
  MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface CodexEditorProps {
  codex?: Codex;
  template?: Template;
  context: Context;
  onCodexUpdate: (codex: Codex) => Promise<void>;
  platformAdapter: PlatformAdapter;
  className?: string;
}

export const CodexEditor: React.FC<CodexEditorProps> = ({
  codex,
  template,
  context,
  onCodexUpdate,
  platformAdapter,
  className
}) => {
  const [activeViewMode, setActiveViewMode] = useState<string>('default');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Initialize form data when codex changes
  useEffect(() => {
    if (codex) {
      // Codex content is stored in content.fields, not directly in content
      const contentFields = codex.content?.fields || {};
      setFormData({ ...contentFields, ...codex.metadata });
    } else {
      setFormData({});
    }
  }, [codex]);

  // Set default view mode based on template and context
  useEffect(() => {
    if (template && template.viewModes.length > 0) {
      const contextViewMode = template.viewModes.find(vm => 
        vm.contexts.includes(context.workflowStage) || 
        vm.contexts.includes(context.role) ||
        vm.contexts.includes('all')
      );
      setActiveViewMode(contextViewMode?.id || template.viewModes[0].id);
    }
  }, [template, context]);

  const handleFieldChange = useCallback((fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!codex || !template) return;

    setIsSaving(true);
    try {
      // Build field values from formData
      const fieldValues = Object.fromEntries(
        template.fields.map(field => [field.id, formData[field.id] || ''])
      );

      const updatedCodex: Codex = {
        ...codex,
        content: {
          ...codex.content,
          fields: fieldValues
        },
        metadata: {
          ...codex.metadata,
          ...Object.fromEntries(
            template.fields
              .filter(field => ['status', 'priority', 'assignedTo'].includes(field.id))
              .map(field => [field.id, formData[field.id]])
          )
        },
        updatedAt: new Date()
      };

      await onCodexUpdate(updatedCodex);
      setLastSaved(new Date());
      setIsEditing(false);
      platformAdapter.showNotification('Codex saved successfully', 'info');
    } catch (error) {
      platformAdapter.showNotification('Failed to save codex', 'error');
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [codex, template, formData, onCodexUpdate, platformAdapter]);

  const renderField = useCallback((field: TemplateField) => {
    const value = formData[field.id] || field.defaultValue || '';
    const isVisible = !field.visibility || 
      field.visibility.contexts.includes('all') ||
      field.visibility.contexts.includes(context.workflowStage) ||
      field.visibility.contexts.includes(context.role);

    if (!isVisible) return null;

    switch (field.type) {
      case FieldType.TEXT:
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label || field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              disabled={!isEditing}
              placeholder={`Enter ${(field.label || field.name).toLowerCase()}`}
            />
          </div>
        );

      case FieldType.RICH_TEXT:
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label || field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.id}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              disabled={!isEditing}
              placeholder={`Enter ${(field.label || field.name).toLowerCase()}`}
              rows={6}
              className="min-h-[150px]"
            />
          </div>
        );

      case FieldType.NUMBER:
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label || field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.id, Number(e.target.value))}
              disabled={!isEditing}
              placeholder={`Enter ${(field.label || field.name).toLowerCase()}`}
            />
          </div>
        );

      case FieldType.SELECT:
        // Skip select fields without options to prevent crash
        if (!field.options || field.options.length === 0) {
          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>
                {field.label || field.name}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                id={field.id}
                value={value}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                disabled={!isEditing}
                placeholder={`Enter ${(field.label || field.name).toLowerCase()}`}
              />
              <p className="text-xs text-muted-foreground">
                Select field options not configured, using text input
              </p>
            </div>
          );
        }

        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label || field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select
              value={value || ''}
              onValueChange={(newValue) => handleFieldChange(field.id, newValue)}
              disabled={!isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${(field.label || field.name).toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options.map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case FieldType.BOOLEAN:
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={value}
              onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
              disabled={!isEditing}
            />
            <Label htmlFor={field.id} className="text-sm font-medium">
              {field.label || field.name}
            </Label>
          </div>
        );

      case FieldType.DATE:
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label || field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type="date"
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              disabled={!isEditing}
            />
          </div>
        );

      default:
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label || field.name}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              disabled={!isEditing}
              placeholder={`Enter ${(field.label || field.name).toLowerCase()}`}
            />
            <p className="text-xs text-muted-foreground">
              Field type '{field.type}' not fully implemented
            </p>
          </div>
        );
    }
  }, [formData, isEditing, context, handleFieldChange]);

  const renderDefaultView = () => {
    if (!template) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">No Codex Selected</h3>
            <p className="text-muted-foreground">Select a codex from the navigator to start editing</p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{codex?.name || 'Untitled Codex'}</h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{template.name}</Badge>
                {codex?.metadata.status && (
                  <Badge variant="secondary">{codex.metadata.status}</Badge>
                )}
                {codex?.metadata.tags?.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {lastSaved && (
                <span className="text-xs text-muted-foreground">
                  Last saved: {lastSaved.toLocaleTimeString()}
                </span>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? <Eye className="w-4 h-4 mr-1" /> : <Edit className="w-4 h-4 mr-1" />}
                {isEditing ? 'Preview' : 'Edit'}
              </Button>
              
              {isEditing && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4 mr-1" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Template Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <GitBranch className="w-4 h-4 mr-2" />
                    View Workflow
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Users className="w-4 h-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {template.fields.map(field => renderField(field))}
              
              {/* Relationships */}
              {codex && codex.metadata?.references && codex.metadata.references.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Relationships
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {codex.metadata.references.map(rel => (
                        <div key={rel.id} className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">{rel.type}</span>
                          <Badge variant="outline">{rel.targetId}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderViewMode = () => {
    if (!template) return renderDefaultView();

    const viewMode = template.viewModes.find(vm => vm.id === activeViewMode);
    if (!viewMode) return renderDefaultView();

    // Custom view mode rendering would go here
    // For now, we'll render the default view
    return renderDefaultView();
  };

  if (!codex) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-lg flex items-center justify-center">
            <Edit className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Codex Selected</h3>
          <p className="text-muted-foreground">Select a codex from the navigator to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* View Mode Tabs */}
      {template && template.viewModes.length > 1 && (
        <div className="p-4 border-b border-border">
          <Tabs value={activeViewMode} onValueChange={setActiveViewMode}>
            <TabsList className="grid w-full grid-cols-3">
              {template.viewModes.map(viewMode => (
                <TabsTrigger key={viewMode.id} value={viewMode.id}>
                  {viewMode.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {renderViewMode()}
      </div>
    </div>
  );
};

export default CodexEditor;