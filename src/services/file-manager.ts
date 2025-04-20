import { App, Notice, TFile, normalizePath } from 'obsidian';
import * as jsyaml from 'js-yaml';
import { BibliographyPluginSettings } from '../types';
import { Citation, Contributor, AdditionalField, AttachmentData, AttachmentType } from '../types/citation';

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
                // Ensure 'literature_note' tag is always present, while preserving any existing tags
                tags: citation.tags && Array.isArray(citation.tags) 
                    ? [...new Set([...citation.tags, 'literature_note'])] 
                    : ['literature_note'],
            };
            
            // Add configurable non-CSL fields based on settings
            if (this.settings.includeYear && citation.year) {
                frontmatter.year = Number(citation.year);
            }
            
            if (this.settings.includeDateCreated) {
                frontmatter.dateCreated = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            }

            // Add contributors to frontmatter
            contributors.forEach(contributor => {
                if (contributor.given || contributor.family) {
                    if (!frontmatter[contributor.role]) {
                        frontmatter[contributor.role] = [];
                    }
                    // Ensure structure is { family: string, given?: string }
                    const person = {
                        family: contributor.family || '', // Ensure family is string
                        ...(contributor.given && { given: contributor.given })
                    };
                    frontmatter[contributor.role].push(person);
                }
            });

            // Add authorLink to frontmatter if enabled in settings
            if (this.settings.includeAuthorLink) {
                const authorLinks: string[] = contributors
                    .filter(contributor => contributor.role === 'author' && contributor.family)
                    .map(contributor => {
                        const fullName = `${contributor.given ? `${contributor.given} ` : ''}${contributor.family}`;
                        // Simple link for now, assumes Author/ folder exists
                        return `[[Author/${fullName}]]`; 
                    });

                if (authorLinks.length > 0) {
                    frontmatter.authorLink = authorLinks;
                }
            }

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
                // Add attachment link to frontmatter if enabled in settings
                if (attachmentPath && this.settings.includeAttachment) {
                    // Use Obsidian link format, ensuring path is relative if possible
                    const file = this.app.vault.getAbstractFileByPath(attachmentPath);
                    if (file instanceof TFile) {
                        // Generate a relative path if possible, otherwise use the full path
                        const relativePath = this.app.metadataCache.fileToLinktext(file, '', true);
                         frontmatter.attachment = [`[[${relativePath}]]`];
                    } else {
                        // Fallback if file not found (e.g., external link? unlikely here)
                         frontmatter.attachment = [`[[${attachmentPath}]]`];
                    }
                }
            }

            const yaml = jsyaml.dump(frontmatter, { noRefs: true, sortKeys: true }); // Use js-yaml options for cleaner output
            let content = `---
${yaml}---

`;
            
            // Render header template with variable replacement
            const headerContent = this.renderTemplate(
                this.settings.headerTemplate,
                {
                    title: citation.title || '',
                    citekey: citation.id || '',
                    year: citation.year?.toString() || '',
                    authors: this.formatAuthorsForTemplate(contributors),
                    // Provide the raw path for pdflink template variable
                    pdflink: attachmentPath ? `[[${attachmentPath}]]` : '' 
                }
            );
            
            content += `${headerContent}\n\n`; // Add newline after header

            // Save the note
            const notePath = this.getLiteratureNotePath(citation.id);
            const existingFile = this.app.vault.getAbstractFileByPath(notePath);

            if (existingFile instanceof TFile) {
                // Handle existing file - potentially merge or overwrite based on settings (not implemented)
                // For now, log a warning and skip creation to avoid data loss.
                console.warn(`Literature note already exists at ${notePath}. Skipping creation.`);
                new Notice(`Note already exists: ${notePath}`);
                // Alternatively, overwrite:
                // await this.app.vault.modify(existingFile, content);
                // new Notice(`Literature note "${citation.title}" updated.`);
                return; 
            } else {
                await this.app.vault.create(notePath, content);
                new Notice(`Literature note "${citation.title}" created at ${notePath}.`);
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
                     console.warn(`Attachment file already exists at ${attachmentPath}. Skipping import.`);
                     new Notice(`Attachment already exists: ${attachmentPath}`);
                     return attachmentPath; // Return existing path
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
     * Render a template string with variable replacements
     * Supports basic Mustache-like syntax: {{variable}} and {{^variable}}fallback{{/variable}}
     */
    private renderTemplate(template: string, variables: { [key: string]: string | undefined }): string {
        // Process conditional blocks first {{^variable}}content{{/variable}}
        // These show content only if the variable is empty/undefined/falsy
        let result = template.replace(/\{\{\^([^}]+)\}\}(.*?)\{\{\/\1\}\}/gs, (match, key, content) => {
            const value = variables[key.trim()]; // Trim whitespace from key
            // Consider empty string as falsy for conditionals
            return !value ? content : ''; 
        });
        
        // Then do basic variable replacement {{variable}}
        result = result.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
             // Trim whitespace from key
            const trimmedKey = key.trim();
            if (trimmedKey.startsWith('^')) {
                return ''; // Skip this, it's part of a conditional that was already processed
            }
            // Return the variable value or an empty string if undefined/null
            return variables[trimmedKey] ?? ''; 
        });
        
        return result;
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
     * Get all book entries (notes tagged literature_note with type book/collection/document)
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
                if (!tags || !Array.isArray(tags) || !tags.includes('literature_note')) continue;
                
                const type = frontmatter.type;
                if (!type || !['book', 'collection', 'document'].includes(type)) continue;

                // Ensure required fields exist for a book entry
                if (!frontmatter.id || !frontmatter.title) {
                     console.warn(`Book-like entry ${file.path} missing ID or Title.`);
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
                console.warn(`Book entry path not found or not a file: ${path}`);
                return null;
            }
            
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter;
            
            // Validate essential fields for a book entry
            if (!frontmatter || !frontmatter.id || !frontmatter.title || !frontmatter.type || !['book', 'collection', 'document'].includes(frontmatter.type)) {
                 console.warn(`File at ${path} is not a valid book entry (missing id, title, or wrong type).`);
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
