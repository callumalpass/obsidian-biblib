import { App, Notice } from 'obsidian';
import * as jsyaml from 'js-yaml';
import { BibliographyPluginSettings } from '../types';
import { Citation, Contributor, AdditionalField } from '../types/citation';

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
        attachment: File | null
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
                        Number(citation.year), 
                        citation.month ? Number(citation.month) : '', 
                        citation.day ? Number(citation.day) : ''
                    ].filter((v) => v !== '')],
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
                tags: ['literature_note'],
            };
            
            // Add configurable non-CSL fields based on settings
            if (this.settings.includeYear) {
                frontmatter.year = Number(citation.year);
            }
            
            if (this.settings.includeDateCreated) {
                frontmatter.dateCreated = new Date().toISOString();
            }

            // Add contributors to frontmatter
            contributors.forEach(contributor => {
                if (contributor.given || contributor.family) {
                    if (!frontmatter[contributor.role]) {
                        frontmatter[contributor.role] = [];
                    }
                    frontmatter[contributor.role].push({
                        family: contributor.family,
                        ...(contributor.given && { given: contributor.given }),
                    });
                    console.log(`Contributor added: ${contributor.role}, ${contributor.given} ${contributor.family}`);
                }
            });

            // Add authorLink to frontmatter if enabled in settings
            if (this.settings.includeAuthorLink) {
                const authorLinks: string[] = contributors
                    .filter(contributor => contributor.role === 'author' && contributor.family)
                    .map(contributor => {
                        const fullName = `${contributor.given ? `${contributor.given} ` : ''}${contributor.family}`;
                        return `[[Author/${fullName}|${fullName}]]`;
                    });

                if (authorLinks.length > 0) {
                    frontmatter.authorLink = authorLinks;
                    console.log('Author links added');
                }
            }

            // Add additional fields to frontmatter
            additionalFields.forEach((field) => {
                if (field.name && field.value !== '') {
                    // Assign based on type
                    if (field.type === 'date') {
                        // For date type fields, ensure they have the proper CSL date-parts structure
                        if (typeof field.value === 'object' && field.value['date-parts']) {
                            // It's already in CSL format
                            frontmatter[field.name] = field.value;
                        } else if (typeof field.value === 'string') {
                            // Parse date string (YYYY-MM-DD)
                            const dateParts = field.value.split('-').map(Number).filter(part => !isNaN(part));
                            frontmatter[field.name] = { 'date-parts': [dateParts] };
                        }
                    } else if (field.type === 'number') {
                        // Ensure numbers are stored as numbers, not strings
                        const numValue = parseFloat(field.value);
                        frontmatter[field.name] = isNaN(numValue) ? field.value : numValue;
                    } else {
                        // For standard fields, use the value as is
                        frontmatter[field.name] = field.value;
                    }
                    console.log(`Additional field added: ${field.name}, ${typeof frontmatter[field.name] === 'object' ? JSON.stringify(frontmatter[field.name]) : frontmatter[field.name]}`);
                }
            });

            // Handle attachment if provided
            let attachmentPath = '';
            if (attachment) {
                attachmentPath = await this.saveAttachment(citation.id, attachment);
                // Add attachment link to frontmatter if enabled in settings
                if (attachmentPath && this.settings.includeAttachment) {
                    frontmatter.attachment = [`[[${attachmentPath}|${citation.id}]]`];
                }
            }

            const yaml = jsyaml.dump(frontmatter);
            let content = `---\n${yaml}---\n\n`;
            
            // Render header template with variable replacement
            const headerContent = this.renderTemplate(
                this.settings.headerTemplate,
                {
                    title: citation.title,
                    citekey: citation.id,
                    year: citation.year?.toString() || '',
                    authors: this.formatAuthorsForTemplate(contributors),
                    pdflink: attachmentPath ? `[[${attachmentPath}|${citation.id}]]` : ''
                }
            );
            
            content += `${headerContent}\n\n`;

            // Save the note
            const notePath = this.getLiteratureNotePath(citation.id);
            await this.app.vault.create(notePath, content);
            new Notice(`Literature note "${citation.title}" created.`);
            console.log(`Literature note created: ${notePath}`);
            
            return;
        } catch (error) {
            console.error('Error creating literature note:', error);
            new Notice('Error creating literature note.');
            throw error;
        }
    }

    /**
     * Save an attachment file (PDF or EPUB)
     */
    private async saveAttachment(id: string, attachment: File): Promise<string> {
        try {
            const biblibPath = this.settings.attachmentFolderPath;
            if (!this.app.vault.getAbstractFileByPath(biblibPath)) {
                await this.app.vault.createFolder(biblibPath);
                console.log(`Folder created: ${biblibPath}`);
            }

            const fileExtension = attachment.name.split('.').pop();
            let attachmentPath = '';

            if (this.settings.createAttachmentSubfolder) {
                // Create subfolder if enabled
                const attachmentFolderPath = `${biblibPath}/${id}`;
                if (!this.app.vault.getAbstractFileByPath(attachmentFolderPath)) {
                    await this.app.vault.createFolder(attachmentFolderPath);
                    console.log(`Folder created: ${attachmentFolderPath}`);
                }
                attachmentPath = `${attachmentFolderPath}/${id}.${fileExtension}`;
            } else {
                // Store directly in attachment folder
                attachmentPath = `${biblibPath}/${id}.${fileExtension}`;
            }

            const arrayBuffer = await attachment.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            await this.app.vault.createBinary(attachmentPath, data);
            console.log(`Attachment saved: ${attachmentPath}`);
            
            return attachmentPath;
        } catch (error) {
            console.error('Error saving attachment:', error);
            new Notice('Error saving attachment.');
            return '';
        }
    }

    /**
     * Get the full path for a literature note
     */
    private getLiteratureNotePath(id: string): string {
        // Use settings for note filename and path
        const prefix = this.settings.usePrefix ? this.settings.notePrefix : '';
        const fileName = `${prefix}${id}.md`;
        return `${this.settings.literatureNotePath}${fileName}`.replace(/\/+/g, '/');
    }
    
    /**
     * Render a template string with variable replacements
     * Supports basic Mustache-like syntax: {{variable}} and {{^variable}}fallback{{/variable}}
     */
    private renderTemplate(template: string, variables: { [key: string]: string }): string {
        // Process conditional blocks first {{^variable}}content{{/variable}}
        // These show content only if the variable is empty/undefined
        let result = template.replace(/\{\{\^([^}]+)\}\}(.*?)\{\{\/\1\}\}/gs, (match, key, content) => {
            const value = variables[key];
            return value ? '' : content;
        });
        
        // Then do basic variable replacement {{variable}}
        result = result.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            if (key.startsWith('^')) {
                return ''; // Skip this, it's part of a conditional that was already processed
            }
            return variables[key] || '';
        });
        
        return result;
    }
    
    /**
     * Format contributors list for template usage
     */
    private formatAuthorsForTemplate(contributors: Contributor[]): string {
        const authors = contributors.filter(c => c.role === 'author');
        
        if (authors.length === 0) {
            return '';
        }
        
        if (authors.length === 1) {
            return this.formatContributorName(authors[0]);
        }
        
        if (authors.length === 2) {
            return `${this.formatContributorName(authors[0])} and ${this.formatContributorName(authors[1])}`;
        }
        
        return `${this.formatContributorName(authors[0])} et al.`;
    }
    
    /**
     * Format a single contributor's name
     */
    private formatContributorName(contributor: Contributor): string {
        if (contributor.family) {
            if (contributor.given) {
                // Use first initial + family name
                return `${contributor.given.charAt(0)}. ${contributor.family}`;
            }
            return contributor.family;
        }
        return '';
    }
}