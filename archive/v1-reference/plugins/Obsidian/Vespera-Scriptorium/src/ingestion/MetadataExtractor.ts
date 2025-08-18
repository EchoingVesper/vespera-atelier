/**
 * @file MetadataExtractor.ts
 * @description Extracts relevant metadata from ingested documents.
 */

import { TFile, Vault, parseYaml } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Interface for extracted metadata from files
 */
export interface ExtractedMetadata {
    title?: string;
    author?: string;
    creationDate?: Date;
    modificationDate?: Date;
    filePath: string;
    fileName: string;
    fileExtension?: string;
    size?: number; // in bytes
    frontmatter?: Record<string, any>; // For Markdown frontmatter
    tags?: string[]; // Tags extracted from frontmatter or content
    mimeType?: string; // MIME type of the file
    [key: string]: any; // For other custom metadata
}

export class MetadataExtractor {
    private vault: Vault | null;
    private isObsidianEnvironment: boolean;

    constructor(vault?: Vault) {
        this.vault = vault || null;
        this.isObsidianEnvironment = !!vault;
        console.log(`MetadataExtractor initialized in ${this.isObsidianEnvironment ? 'Obsidian' : 'standalone'} mode`);
    }

    /**
     * Extracts metadata from a given file.
     * This method coordinates the extraction of both file system and content-based metadata.
     * @param filePath The absolute path of the file.
     * @returns A promise that resolves to an object containing the extracted metadata.
     */
    /**
     * Extracts metadata from a given file.
     * This method coordinates the extraction of both file system and content-based metadata.
     * @param filePath The absolute path of the file.
     * @param fileContent Optional file content if already available.
     * @returns A promise that resolves to an object containing the extracted metadata.
     */
    public async extractMetadata(filePath: string, fileContent?: string): Promise<ExtractedMetadata> {
        console.log(`Extracting metadata for: ${filePath}`);
        
        try {
            // Get file system metadata
            const fsMetadata = await this.extractFileSystemMetadata(filePath);
            
            // If content wasn't provided, read it for content-based extraction
            if (!fileContent && fsMetadata.fileExtension) {
                // Only read content for text-based files
                const textExtensions = ['.md', '.txt', '.json', '.js', '.ts', '.html', '.css', '.xml', '.yaml', '.yml'];
                if (textExtensions.includes(`.${fsMetadata.fileExtension.toLowerCase()}`)) {
                    fileContent = await this.readFileContent(filePath);
                }
            }
            
            // Extract content-based metadata
            const contentMetadata = await this.extractContentMetadata(filePath, fileContent || '');
            
            // Combine metadata with file path info taking precedence
            const combinedMetadata: ExtractedMetadata = {
                ...contentMetadata,
                ...fsMetadata,
                filePath: filePath,
                fileName: fsMetadata.fileName || path.basename(filePath),
            };
            
            console.log(`Metadata extracted for ${filePath}:`, combinedMetadata);
            return combinedMetadata;
        } catch (error) {
            console.error(`Error extracting metadata for ${filePath}:`, error);
            // Return basic metadata even if extraction fails
            return {
                filePath: filePath,
                fileName: path.basename(filePath),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Extracts metadata derived from the file system properties.
     * @param filePath The absolute path of the file.
     * @returns A promise that resolves to an object containing file system metadata.
     */
    /**
     * Reads the content of a file.
     * Uses Obsidian API if available, otherwise falls back to Node.js fs.
     * @param filePath The path of the file to read.
     * @returns A promise that resolves to the file content as a string.
     */
    private async readFileContent(filePath: string): Promise<string> {
        try {
            if (this.isObsidianEnvironment && this.vault) {
                const file = this.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    return await this.vault.cachedRead(file);
                }
                throw new Error(`File not found in Obsidian vault: ${filePath}`);
            } else {
                // Use Node.js fs in non-Obsidian environment
                return fs.promises.readFile(filePath, 'utf8');
            }
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            throw new Error(`Failed to read file content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Extracts metadata derived from the file system properties.
     * @param filePath The absolute path of the file.
     * @returns A promise that resolves to an object containing file system metadata.
     */
    private async extractFileSystemMetadata(filePath: string): Promise<Partial<ExtractedMetadata>> {
        try {
            const fileName = path.basename(filePath);
            const fileExtension = path.extname(filePath).replace('.', '');
            
            let stats: fs.Stats | null = null;
            let size: number | undefined;
            let creationDate: Date | undefined;
            let modificationDate: Date | undefined;
            
            if (this.isObsidianEnvironment && this.vault) {
                const file = this.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    size = file.stat.size;
                    creationDate = new Date(file.stat.ctime);
                    modificationDate = new Date(file.stat.mtime);
                }
            } else {
                // Use Node.js fs in non-Obsidian environment
                try {
                    stats = await fs.promises.stat(filePath);
                    size = stats.size;
                    creationDate = stats.birthtime;
                    modificationDate = stats.mtime;
                } catch (err) {
                    console.warn(`Could not get file stats for ${filePath}:`, err);
                }
            }
            
            // Determine MIME type based on extension
            const mimeType = this.getMimeTypeFromExtension(fileExtension);
            
            const metadata: Partial<ExtractedMetadata> = {
                fileName,
                fileExtension,
                size,
                creationDate,
                modificationDate,
                mimeType
            };
            
            console.log(`File system metadata for ${filePath}:`, metadata);
            return metadata;
        } catch (error) {
            console.error(`Error extracting file system metadata for ${filePath}:`, error);
            return {
                fileName: path.basename(filePath),
                fileExtension: path.extname(filePath).replace('.', '')
            };
        }
    }

    /**
     * Extracts metadata derived from the content of the file.
     * This could include frontmatter from Markdown, EXIF data from images, etc.
     * @param filePath The absolute path of the file.
     * @param fileContent The string content of the file.
     * @returns A promise that resolves to an object containing content-based metadata.
     */
    /**
     * Determines the MIME type based on file extension.
     * @param extension The file extension without the dot.
     * @returns The MIME type string.
     */
    private getMimeTypeFromExtension(extension: string): string {
        const mimeTypes: Record<string, string> = {
            'md': 'text/markdown',
            'txt': 'text/plain',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript',
            'ts': 'application/typescript',
            'json': 'application/json',
            'xml': 'application/xml',
            'pdf': 'application/pdf',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        };
        
        return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
    }

    /**
     * Extracts metadata derived from the content of the file.
     * This could include frontmatter from Markdown, EXIF data from images, etc.
     * @param filePath The absolute path of the file.
     * @param fileContent The string content of the file.
     * @returns A promise that resolves to an object containing content-based metadata.
     */
    private async extractContentMetadata(filePath: string, fileContent: string): Promise<Partial<ExtractedMetadata>> {
        const metadata: Partial<ExtractedMetadata> = {};
        const fileExtension = path.extname(filePath).toLowerCase();
        
        try {
            if (fileExtension === '.md') {
                // Extract Markdown frontmatter
                if (this.isObsidianEnvironment && this.vault) {
                    // Use Obsidian API for frontmatter extraction
                    const file = this.vault.getAbstractFileByPath(filePath);
                    if (file instanceof TFile) {
                        // Use metadataCache if available (Obsidian API)
                        // Note: This is a simplified approach as the actual API might differ
                        try {
                            // @ts-ignore - Using any to bypass strict type checking
                            const app: any = (this.vault as any).app;
                            if (app && app.metadataCache) {
                                const cache = app.metadataCache.getFileCache(file);
                                if (cache?.frontmatter) {
                                    metadata.frontmatter = cache.frontmatter;
                                    metadata.title = cache.frontmatter.title || cache.frontmatter.alias;
                                    metadata.author = cache.frontmatter.author;
                                    metadata.tags = cache.frontmatter.tags || [];
                                }
                            }
                        } catch (e) {
                            console.warn(`Error accessing metadata cache for ${filePath}:`, e);
                        }
                    }
                } else if (fileContent) {
                    // Manual frontmatter extraction for non-Obsidian environment
                    const frontmatterMatch = fileContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
                    if (frontmatterMatch && frontmatterMatch[1]) {
                        try {
                            const frontmatter = parseYaml(frontmatterMatch[1]);
                            metadata.frontmatter = frontmatter;
                            metadata.title = frontmatter.title || frontmatter.alias;
                            metadata.author = frontmatter.author;
                            metadata.tags = frontmatter.tags || [];
                        } catch (e) {
                            console.warn(`Error parsing frontmatter for ${filePath}:`, e);
                        }
                    }
                    
                    // Extract tags from content (e.g., #tag format)
                    const contentTags = this.extractTagsFromContent(fileContent);
                    if (contentTags.length > 0) {
                        metadata.tags = [...(metadata.tags || []), ...contentTags];
                    }
                }
                
                // If no title was found in frontmatter, use the filename
                if (!metadata.title) {
                    metadata.title = path.basename(filePath, '.md');
                }
            } else if (['.json'].includes(fileExtension) && fileContent) {
                // Extract metadata from JSON files
                try {
                    const jsonContent = JSON.parse(fileContent);
                    // Look for common metadata fields in JSON
                    if (jsonContent.title) metadata.title = jsonContent.title;
                    if (jsonContent.author) metadata.author = jsonContent.author;
                    if (jsonContent.metadata) metadata.jsonMetadata = jsonContent.metadata;
                } catch (e) {
                    console.warn(`Error parsing JSON content for ${filePath}:`, e);
                }
            }
            // Add more content-based extractors for other file types as needed
            
            console.log(`Content metadata for ${filePath}:`, metadata);
            return metadata;
        } catch (error) {
            console.error(`Error extracting content metadata for ${filePath}:`, error);
            return {};
        }
    }
    
    /**
     * Extracts tags from content in the format #tag
     * @param content The file content to extract tags from
     * @returns Array of tags found in the content
     */
    private extractTagsFromContent(content: string): string[] {
        const tags = new Set<string>();
        
        // Match #tag format (not inside code blocks)
        const tagRegex = /#([a-zA-Z0-9_\-/]+)/g;
        let match;
        
        // Simple approach - extract all #tags
        while ((match = tagRegex.exec(content)) !== null) {
            if (match[1]) {
                tags.add(match[1]);
            }
        }
        
        return Array.from(tags);
    }
}