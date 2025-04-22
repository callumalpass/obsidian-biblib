import { App, Notice, TFile, normalizePath } from 'obsidian';
import * as jsyaml from 'js-yaml';
import { BibliographyPluginSettings } from '../types';
import { Citation, Contributor, AdditionalField, AttachmentData, AttachmentType } from '../types/citation';
import { TemplateEngine } from '../utils/template-engine';

export class FileManager {
    private app: App;
    private settings: BibliographyPluginSettings;

    constructor(app: App, settings: BibliographyPluginSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * Create a literature note with the provided citation data
     */
    async createLiteratureNote(
        citation: Citation,
        contributors: Contributor[],
        additionalFields: AdditionalField[],
        attachmentData: AttachmentData | null
    ): Promise<void> {
        try {
            // Create frontmatter in CSL-compatible format
            const frontmatter: any = {
                id: citation.id,
                type: citation.type,
                title: citation.title,
                // Use CSL date format for issued date
                issued: {
                    'date-parts': [[
                        citation.year ? Number(citation.year) : undefined,
                        citation.month ? Number(citation.month) : undefined, 
                        citation.day ? Number(citation.day) : undefined
                    ].filter(v => v !== undefined)], // Filter out undefined parts
                },
                // Add standard CSL fields (only if they have values)
                ...(citation['title-short'] && { 'title-short': citation['title-short'] }),
                ...(citation.page && { page: citation.page }),
                ...(citation.URL && { URL: citation.URL }),
                ...(citation['container-title'] && { 'container-title': citation['container-title'] }),
                ...(citation.publisher && { publisher: citation.publisher }),
                ...(citation['publisher-place'] && { 'publisher-place': citation['publisher-place'] }),
                ...(citation.edition && { edition: isNaN(Number(citation.edition)) ? citation.edition : Number(citation.edition) }),
                ...(citation.volume && { volume: isNaN(Number(citation.volume)) ? citation.volume : Number(citation.volume) }),
                ...(citation.number && { number: isNaN(Number(citation.number)) ? citation.number : Number(citation.number) }),
                ...(citation.language && { language: citation.language }),
                ...(citation.DOI && { DOI: citation.DOI }),
                ...(citation.abstract && { abstract: citation.abstract }),
                // Add metadata fields (non-CSL)
                // Ensure literature note tag is always present, while preserving any existing tags
                tags: citation.tags && Array.isArray(citation.tags)
                    ? [...new Set([...citation.tags, this.settings.literatureNoteTag])]
                    : [this.settings.literatureNoteTag],
            };
            
            // No hardcoded frontmatter fields - everything through custom frontmatter templates

            // Add contributors to frontmatter, preserving all CSL contributor properties
            contributors.forEach(contributor => {
                // Only include entries with at least one name or other identifier
                if (contributor.family || contributor.given || contributor.literal) {
                    if (!frontmatter[contributor.role]) {
                        frontmatter[contributor.role] = [];
                    }
                    // Copy all contributor properties except the role
                    const { role, ...personData } = contributor;
                    frontmatter[contributor.role].push(personData);
                }
            });

            // Add additional fields to frontmatter
            additionalFields.forEach((field) => {
                if (field.name && field.value != null && field.value !== '') { // Check for null/undefined too
                    let valueToAdd = field.value; // Keep track of the potentially modified value
                    // Assign based on type
                    if (field.type === 'date') {
                        // For date type fields, ensure they have the proper CSL date-parts structure
                        if (typeof field.value === 'object' && field.value['date-parts']) {
                            // It's already in CSL format
                            valueToAdd = field.value;
                        } else if (typeof field.value === 'string') {
                            // Try parsing date string (YYYY-MM-DD or YYYY)
                            const dateParts = field.value.split('-').map(Number).filter(part => !isNaN(part));
                            if (dateParts.length > 0) {
                                valueToAdd = { 'date-parts': [dateParts] };
                            } else {
                                // If parsing fails, store as string
                                valueToAdd = field.value;
                            }
                        }
                    } else if (field.type === 'number') {
                        // Ensure numbers are stored as numbers, not strings
                        const numValue = parseFloat(field.value);
                        valueToAdd = isNaN(numValue) ? field.value : numValue;
                    }
                    // Add the potentially modified value to frontmatter
                    frontmatter[field.name] = valueToAdd;
                }
            });

            // Handle attachment if provided
            let attachmentPath = '';
            if (attachmentData && attachmentData.type !== AttachmentType.NONE) {
                attachmentPath = await this.handleAttachment(citation.id, attachmentData);
                // Attachment links now handled through custom frontmatter field templates
            }

            // Create template variables for both header and custom frontmatter fields
            const templateVariables = this.buildTemplateVariables(citation, contributors, attachmentPath);
            
            // Process custom frontmatter fields if any are enabled - BEFORE generating YAML
            if (this.settings.customFrontmatterFields && this.settings.customFrontmatterFields.length > 0) {
                const enabledFields = this.settings.customFrontmatterFields.filter(field => field.enabled);
                
                enabledFields.forEach(field => {
                    // Determine if this looks like an array/object template
                    const isArrayTemplate = field.template.trim().startsWith('[') && field.template.trim().endsWith(']');
                    const isObjectTemplate = field.template.trim().startsWith('{') && field.template.trim().endsWith('}');
                    
                    // Render the template with appropriate options
                    const fieldValue = this.renderTemplate(
                        field.template, 
                        templateVariables, 
                        { yamlArray: isArrayTemplate }
                    );
                    
                    // Add to frontmatter if field name not already used and value isn't empty
                    if (fieldValue && !frontmatter.hasOwnProperty(field.name)) {
                        // Try to parse as JSON if it looks like an array or object
                        if ((fieldValue.startsWith('[') && fieldValue.endsWith(']')) || 
                            (fieldValue.startsWith('{') && fieldValue.endsWith('}'))) {
                            try {
                                frontmatter[field.name] = JSON.parse(fieldValue);
                            } catch (e) {
                                console.error(`Failed to parse field "${field.name}" as JSON:`, e);
                                // If parsing fails, use as string
                                frontmatter[field.name] = fieldValue;
                            }
                        } else {
                            // Use as string
                            frontmatter[field.name] = fieldValue;
                        }
                    }
                });
            }
            
            // Generate YAML AFTER processing custom fields
            const yaml = jsyaml.dump(frontmatter, { noRefs: true, sortKeys: true }); // Use js-yaml options for cleaner output
            let content = `---
${yaml}---

`;
            
            // Render header template with variable replacement
            const headerContent = this.renderTemplate(
                this.settings.headerTemplate,
                templateVariables,
                {} // No special YAML array options for header
            );
            
            content += `${headerContent}\n\n`; // Add newline after header

            // Save the note
            const notePath = this.getLiteratureNotePath(citation.id);
            const existingFile = this.app.vault.getAbstractFileByPath(notePath);
            if (existingFile instanceof TFile) {
                // Notify the user and prevent note creation if it already exists
                new Notice(`Literature note already exists at ${notePath}.`);
                throw new Error(`Literature note already exists at ${notePath}`);
            }
            // Create new literature note
            await this.app.vault.create(notePath, content);
            new Notice(`Literature note "${citation.title}" created at ${notePath}.`);
            // Optionally open the newly created note
            if (this.settings.openNoteOnCreate) {
                const newFile = this.app.vault.getAbstractFileByPath(notePath);
                if (newFile instanceof TFile) {
                    const leaf = this.app.workspace.getLeaf(false);
                    await leaf.openFile(newFile);
                }
            }
            
            return;
        } catch (error) {
            console.error('Error creating literature note:', error);
            new Notice('Error creating literature note. Check console.');
            throw error;
        }
    }

    /**
     * Handle attachment file (PDF or EPUB) either by importing or linking
     */
    private async handleAttachment(id: string, attachmentData: AttachmentData): Promise<string> {
        try {
            // If it's a link to an existing file, normalize the path
            if (attachmentData.type === AttachmentType.LINK && attachmentData.path) {
                return normalizePath(attachmentData.path);
            }
            
            // Otherwise, it's an import
            if (attachmentData.type === AttachmentType.IMPORT && attachmentData.file) {
                const biblibPath = normalizePath(this.settings.attachmentFolderPath); 
                // Ensure the base attachment directory exists
                try {
                    const biblibFolder = this.app.vault.getAbstractFileByPath(biblibPath);
                    if (!biblibFolder) {
                         await this.app.vault.createFolder(biblibPath);
                    }
                } catch (folderError) {
                     console.error(`Error creating attachment folder ${biblibPath}:`, folderError);
                     new Notice(`Error creating attachment folder: ${biblibPath}`);
                     return ''; // Cannot proceed without folder
                }

                const fileExtension = attachmentData.file.name.split('.').pop() || 'file'; // Fallback extension
                let targetFolderPath = biblibPath;

                if (this.settings.createAttachmentSubfolder) {
                    // Create subfolder if enabled
                    targetFolderPath = normalizePath(`${biblibPath}/${id}`);
                    try {
                        const subFolder = this.app.vault.getAbstractFileByPath(targetFolderPath);
                         if (!subFolder) {
                              await this.app.vault.createFolder(targetFolderPath);
                         }
                    } catch (subFolderError) {
                         console.error(`Error creating attachment subfolder ${targetFolderPath}:`, subFolderError);
                         new Notice(`Error creating attachment subfolder: ${targetFolderPath}`);
                         return ''; // Cannot proceed without subfolder
                    }
                }
                
                // Sanitize citekey for use in filename
                const sanitizedId = id.replace(/[^a-zA-Z0-9_\-]+/g, '_');
                const attachmentFilename = `${sanitizedId}.${fileExtension}`;
                const attachmentPath = normalizePath(`${targetFolderPath}/${attachmentFilename}`);

                // Check if file already exists
                const existingAttachment = this.app.vault.getAbstractFileByPath(attachmentPath);
                if (existingAttachment instanceof TFile) {
                    // Skip import if attachment already exists
                    new Notice(`Attachment already exists: ${attachmentPath}`);
                    return attachmentPath;
                }

                const arrayBuffer = await attachmentData.file.arrayBuffer();
                // Use createBinary with ArrayBuffer directly
                await this.app.vault.createBinary(attachmentPath, arrayBuffer);
                new Notice(`Attachment imported to ${attachmentPath}`);
                return attachmentPath;
            }
            
            return ''; // No attachment handled
        } catch (error) {
            console.error('Error handling attachment:', error);
            new Notice('Error handling attachment. Check console.');
            return ''; // Return empty path on error
        }
    }

    /**
     * Get the full, normalized path for a literature note
     */
    private getLiteratureNotePath(id: string): string {
        // Use settings for note filename and path
        const prefix = this.settings.usePrefix ? this.settings.notePrefix : '';
        // Sanitize citekey for use in filename
        const sanitizedId = id.replace(/[^a-zA-Z0-9_\-]+/g, '_');
        const fileName = `${prefix}${sanitizedId}.md`;
        // Ensure base path ends with slash if it's not root
        let basePath = normalizePath(this.settings.literatureNotePath);
        if (basePath !== '/' && !basePath.endsWith('/')) {
             basePath += '/';
        }
        // Handle root path case
        if (basePath === '/') basePath = ''; 
        
        return normalizePath(`${basePath}${fileName}`);
    }
    
    /**
     * Template renderer using the unified TemplateEngine
     * Supports:
     * - Basic variable replacement: {{variable}}
     * - Negative conditionals: {{^variable}}content{{/variable}} (renders if variable empty/falsy)
     * - Positive conditionals: {{#variable}}content{{/variable}} (renders if variable exists/truthy)
     * - Iterators: {{#array}}{{.}}{{/array}} where {{.}} represents the current item
     * - Nested variables: {{variable.subfield}}
     * - Formatting helpers: {{variable|format}}
     * 
     * @param template The template string to render
     * @param variables Object containing values for template variables
     * @param options Additional template rendering options
     * @returns The rendered template string
     */
    private renderTemplate(
        template: string, 
        variables: { [key: string]: any },
        options: { yamlArray?: boolean } = {}
    ): string {
        return TemplateEngine.render(template, variables, options);
    }
    
    /**
     * Format contributors list for template usage (e.g., "A. Smith", "A. Smith and B. Jones", "A. Smith et al.")
     */
    private formatAuthorsForTemplate(contributors: Contributor[]): string {
        const authors = contributors.filter(c => c.role === 'author');
        
        if (authors.length === 0) {
            return '';
        }
        
        const formattedNames = authors.map(this.formatContributorName).filter(name => !!name); // Format and remove empty names

        if (formattedNames.length === 0) return '';
        if (formattedNames.length === 1) return formattedNames[0];
        if (formattedNames.length === 2) return `${formattedNames[0]} and ${formattedNames[1]}`;
        return `${formattedNames[0]} et al.`;
    }
    
    /**
     * Format a single contributor's name (e.g., "J. Doe" or "Institution Name")
     */
    private formatContributorName(contributor: Contributor): string {
        // Trim inputs
        const family = contributor.family?.trim();
        const given = contributor.given?.trim();

        if (family) {
            if (given) {
                // Use first initial + family name
                const initial = given.charAt(0).toUpperCase();
                return `${initial}. ${family}`;
            } else {
                // Only family name (might be institution)
                return family; 
            }
        } else if (given) {
             // Only given name? Unlikely but handle.
             return given;
        }
        return ''; // No name parts found
    }
    
    /**
     * Build a comprehensive set of template variables for use in templates
     */
    private buildTemplateVariables(citation: Citation, contributors: Contributor[], attachmentPath?: string): { [key: string]: any } {
        // Start with the basic variable set
        const variables: { [key: string]: any } = {
            // Current date (useful for templates)
            currentDate: new Date().toISOString().split('T')[0],
            
            // Formatted author list for display
            authors: this.formatAuthorsForTemplate(contributors),
            
            // Raw path for attachment
            pdflink: attachmentPath || '',
            
            // Add all citation fields directly (for access to any field)
            ...citation,
            
            // Add contributor lists by role
            ...this.buildContributorLists(contributors),
            
            // Override with explicit versions of common fields for clarity
            // These ensure consistent access even if the citation object structure changes
            citekey: citation.id || '',
        };
        
        return variables;
    }
    
    /**
     * Build contributor lists by role for use in templates
     */
    private buildContributorLists(contributors: Contributor[]): { [key: string]: any } {
        const result: { [key: string]: any } = {};
        
        // Group contributors by role
        const byRole = contributors.reduce((groups, contributor) => {
            const role = contributor.role || 'author';
            if (!groups[role]) {
                groups[role] = [];
            }
            groups[role].push(contributor);
            return groups;
        }, {} as { [key: string]: Contributor[] });
        
        // Create raw arrays by role
        Object.entries(byRole).forEach(([role, roleContributors]) => {
            // Add raw contributor objects
            result[`${role}s_raw`] = roleContributors;
            
            // Add array of formatted names
            result[`${role}s`] = roleContributors.map(c => {
                const family = c.family || '';
                const given = c.given || '';
                
                // Return full name if both parts exist
                if (family && given) {
                    return `${given} ${family}`;
                }
                // Return whichever part exists
                return family || given || c.literal || '';
            });
            
            // Add array of family names only
            result[`${role}s_family`] = roleContributors
                .map(c => c.family || c.literal || '')
                .filter(name => name !== '');
                
            // Add array of given names only
            result[`${role}s_given`] = roleContributors
                .map(c => c.given || '')
                .filter(name => name !== '');
        });
        
        return result;
    }
    
    /**
     * Get all book entries (notes tagged with the configured literatureNoteTag and type book/collection/document)
     */
    async getBookEntries(): Promise<{id: string, title: string, path: string, frontmatter: any}[]> {
        const bookEntries: {id: string, title: string, path: string, frontmatter: any}[] = [];
        
        const markdownFiles = this.app.vault.getMarkdownFiles();
        
        for (const file of markdownFiles) {
            try {
                const cache = this.app.metadataCache.getFileCache(file);
                const frontmatter = cache?.frontmatter;
                
                if (!frontmatter) continue;
                
                const tags = frontmatter.tags;
                if (!tags || !Array.isArray(tags) || !tags.includes(this.settings.literatureNoteTag)) continue;
                
                const type = frontmatter.type;
                if (!type || !['book', 'collection', 'document'].includes(type)) continue;

                // Ensure required fields exist for a book entry
                if (!frontmatter.id || !frontmatter.title) {
                    // Skip invalid book entries without required fields
                    continue;
                }
                
                bookEntries.push({
                    id: frontmatter.id,
                    title: frontmatter.title,
                    path: file.path, // Include the path here
                    frontmatter // Include full frontmatter for potential use
                });
            } catch (error) {
                console.error(`Error processing potential book entry ${file.path}:`, error);
            }
        }
        
        // Sort books by title
        bookEntries.sort((a, b) => a.title.localeCompare(b.title));
        return bookEntries;
    }
    
    /**
     * Get a single book entry by path, validating its structure
     */
    async getBookEntryByPath(path: string): Promise<{id: string, title: string, path: string, frontmatter: any} | null> {
        try {
            const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
            if (!(file instanceof TFile)) {
                // Invalid path: not a file
                return null;
            }
            
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter;
            
            // Validate essential fields for a book entry
            if (!frontmatter || !frontmatter.id || !frontmatter.title || !frontmatter.type || !['book', 'collection', 'document'].includes(frontmatter.type)) {
                // Not a valid book entry
                return null;
            }
            
            // Return object now includes path
            return {
                id: frontmatter.id,
                title: frontmatter.title,
                path: file.path, // Include the path
                frontmatter
            };
        } catch (error) {
            console.error(`Error getting book entry by path ${path}:`, error);
            return null;
        }
    }
}
