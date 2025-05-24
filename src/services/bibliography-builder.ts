import { App, Notice, TFile, Vault, normalizePath } from 'obsidian';
import { BibliographyPluginSettings } from '../types';
import Cite from 'citation-js';
import '@citation-js/plugin-bibtex';
import { AttachmentManagerService } from './attachment-manager-service';

/**
 * Service for building bibliography files from literature notes
 */
export class BibliographyBuilder {
    private app: App;
    private settings: BibliographyPluginSettings;
    private attachmentManager: AttachmentManagerService;

    constructor(app: App, settings: BibliographyPluginSettings) {
        this.app = app;
        this.settings = settings;
        this.attachmentManager = new AttachmentManagerService(app, settings);
    }

    /**
     * Build bibliography files containing all literature notes in the vault
     */
    async buildBibliography(): Promise<void> {
        const literatureNotes = await this.findLiteratureNotes();
        
        if (literatureNotes.length === 0) {
            new Notice('No literature notes found in the vault.');
            return;
        }
        
        // Build two outputs:
        // 1. A citekey list (simple list of citation keys)
        // 2. A bibliography JSON (full data for all literature notes)
        
        try {
            await this.createCitekeyList(literatureNotes);
            await this.createBibliographyJson(literatureNotes);
            new Notice(`Bibliography files created/updated with ${literatureNotes.length} entries.`);
        } catch (error) {
             // Errors are logged within the creation functions
             // Notice is shown within the creation functions
        }
    }
    
    /**
     * Find all literature notes in the vault
     */
    private async findLiteratureNotes(): Promise<{file: TFile, frontmatter: any}[]> {
        const literatureNotes: {file: TFile, frontmatter: any}[] = [];
        
        // Get all markdown files
        const markdownFiles = this.app.vault.getMarkdownFiles();
        
        for (const file of markdownFiles) {
            try {
                // Check metadata cache first for efficiency
                const cache = this.app.metadataCache.getFileCache(file);
                const frontmatter = cache?.frontmatter;

                if (!frontmatter) {
                    continue;
                }
                
                // Check if it has the configured literature note tag
                const tags = frontmatter.tags;
                if (!tags || !Array.isArray(tags) || !tags.includes(this.settings.literatureNoteTag)) {
                    continue;
                }

                // Check if it has an ID (citekey)
                if (!frontmatter.id) {
                    // Skip entries without an ID
                    continue;
                }
                
                // Add to the list
                literatureNotes.push({
                    file,
                    frontmatter
                });
            } catch (error) {
                console.error(`Error processing file ${file.path}:`, error);
            }
        }
        
        return literatureNotes;
    }
    
    /**
     * Create or update a list of citation keys
     */
    private async createCitekeyList(literatureNotes: {file: TFile, frontmatter: any}[]): Promise<void> {
        // Extract citation keys (the ID field from each note)
        const citationKeys = literatureNotes
            .map(note => note.frontmatter.id)
            .sort(); // ID is already validated in findLiteratureNotes
        
        // Create a plaintext file with just the keys
        const rawKeys = citationKeys.join('\n');
        
        // Create a formatted markdown file with @ prefixes
        const formattedKeys = citationKeys.map(key => `@${key}`).join('\n');
        
        // Determine file paths using normalizePath
        const biblibPath = normalizePath(this.settings.attachmentFolderPath);
        // Simple text file, maybe add .txt for clarity?
        const rawFilePath = normalizePath(`${biblibPath}/citekeylist.txt`); 
        const formattedFilePath = normalizePath(this.settings.citekeyListPath); 
        
        // Ensure biblib directory exists
        try {
            const biblibFolder = this.app.vault.getAbstractFileByPath(biblibPath);
            if (!biblibFolder) {
                await this.app.vault.createFolder(biblibPath);
            }
        } catch (error) {
            console.error(`Error ensuring biblib directory exists (${biblibPath}):`, error);
            // Don't necessarily stop if folder creation fails, process might still work if path is root
        }
        
        // Write the files using modify/create
        try {
            const existingRawFile = this.app.vault.getAbstractFileByPath(rawFilePath);
            if (existingRawFile instanceof TFile) {
                await this.app.vault.modify(existingRawFile, rawKeys);
            } else {
                 // If it exists but is not a TFile (e.g., folder), trash it first
                 if (existingRawFile) await this.attachmentManager.trashFile(existingRawFile.path);
                await this.app.vault.create(rawFilePath, rawKeys);
            }
            
            const existingFormattedFile = this.app.vault.getAbstractFileByPath(formattedFilePath);
            if (existingFormattedFile instanceof TFile) {
                await this.app.vault.modify(existingFormattedFile, formattedKeys);
            } else {
                 if (existingFormattedFile) await this.attachmentManager.trashFile(existingFormattedFile.path);
                await this.app.vault.create(formattedFilePath, formattedKeys);
            }

        } catch (error) {
            console.error(`Error writing citekey list files (${rawFilePath}, ${formattedFilePath}):`, error);
            new Notice('Error creating citekey list files. Check console.');
            throw error; // Re-throw to indicate overall build failure
        }
    }
    
    /**
     * Create or update a bibliography JSON file with all literature note data
     */
    private async createBibliographyJson(literatureNotes: {file: TFile, frontmatter: any}[]): Promise<void> {
        // Prepare the data for each literature note
        const bibliographyData = literatureNotes.map(note => {
            // Extract the relevant data from frontmatter
            // We only need fields relevant for bibliography generation, not all metadata
            const { 
                position, // Remove Obsidian-specific metadata
                tags, // Keep tags? Maybe configurable?
                 ...cslData // Keep the rest which should be mostly CSL compatible
            } = note.frontmatter;
            
            // Add file path for reference
            return { 
                ...cslData, 
                obsidianPath: note.file.path 
            };
        });
        
        // Convert to JSON string
        const bibliographyJson = JSON.stringify(bibliographyData, null, 2);
        
        // Determine the output file path
        const outputFilePath = normalizePath(this.settings.bibliographyJsonPath);
        
        // Write the file using modify/create
        try {
             const existingFile = this.app.vault.getAbstractFileByPath(outputFilePath);
            if (existingFile instanceof TFile) {
                await this.app.vault.modify(existingFile, bibliographyJson);
            } else {
                if (existingFile) await this.attachmentManager.trashFile(existingFile.path);
                await this.app.vault.create(outputFilePath, bibliographyJson);
            }
        } catch (error) {
            console.error(`Error writing bibliography JSON file (${outputFilePath}):`, error);
            new Notice('Error creating bibliography JSON file. Check console.');
            throw error; // Re-throw to indicate overall build failure
        }
    }

    /**
     * Export all literature notes into a single BibTeX file
     */
    async exportBibTeX(): Promise<void> {
        const literatureNotes = await this.findLiteratureNotes();
        if (literatureNotes.length === 0) {
            new Notice('No literature notes found to export BibTeX.');
            return;
        }
        try {
            // Process the frontmatter data to handle empty date arrays
            const dataArray = literatureNotes.map(note => {
                const processedData = { ...note.frontmatter };
                
                // Fix for empty date-parts arrays in date fields
                const dateFields = ['issued', 'accessed', 'container', 'event-date', 'original-date', 'submitted'];
                for (const field of dateFields) {
                    if (processedData[field] && 
                        typeof processedData[field] === 'object' && 
                        processedData[field]['date-parts'] && 
                        Array.isArray(processedData[field]['date-parts'])) {
                        
                        // Check if date-parts contains empty arrays or has no valid date information
                        const dateParts = processedData[field]['date-parts'];
                        
                        // More robust checking for valid date-parts structure
                        let isValid = false;
                        if (dateParts.length > 0) {
                            for (const part of dateParts) {
                                // Check if this part is an array and has valid date components
                                if (Array.isArray(part) && part.length > 0) {
                                    // Check if at least one component is a valid number
                                    const hasValidComponent = part.some((component: any) => 
                                        component !== null && 
                                        component !== undefined && 
                                        !isNaN(Number(component))
                                    );
                                    if (hasValidComponent) {
                                        isValid = true;
                                        break;
                                    }
                                }
                            }
                        }

                        if (!isValid) {
                            // Remove this date field entirely to avoid the error
                            delete processedData[field];
                        }
                    }
                }
                
                return processedData;
            });
            
            const bib = new Cite(dataArray).get({ style: 'bibtex', type: 'string' });
            // Use the configured BibTeX file path directly
            let bibtexPath = this.settings.bibtexFilePath;
            bibtexPath = normalizePath(bibtexPath);
            const existing = this.app.vault.getAbstractFileByPath(bibtexPath);
            if (existing instanceof TFile) {
                await this.app.vault.modify(existing, bib);
            } else {
                if (existing) await this.attachmentManager.trashFile(existing.path);
                await this.app.vault.create(bibtexPath, bib);
            }
            new Notice(`BibTeX file exported to ${bibtexPath}`);
        } catch (error) {
            console.error('Error exporting BibTeX file:', error);
            new Notice('Error exporting BibTeX file. See console for details.');
        }
    }
}
