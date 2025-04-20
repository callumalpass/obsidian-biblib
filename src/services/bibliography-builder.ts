import { App, Notice, TFile, Vault } from 'obsidian';
import { BibliographyPluginSettings } from '../types';

/**
 * Service for building bibliography files from literature notes
 */
export class BibliographyBuilder {
    private app: App;
    private settings: BibliographyPluginSettings;

    constructor(app: App, settings: BibliographyPluginSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * Build a bibliography file containing all literature notes in the vault
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
        
        await this.createCitekeyList(literatureNotes);
        await this.createBibliographyJson(literatureNotes);
        
        new Notice(`Bibliography files created with ${literatureNotes.length} entries.`);
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
                // Read the file
                const content = await this.app.vault.read(file);
                
                // Check if it has frontmatter
                if (!content.startsWith('---')) {
                    continue;
                }
                
                // Find the end of frontmatter
                const endOfFrontmatter = content.indexOf('---', 3);
                if (endOfFrontmatter === -1) {
                    continue;
                }
                
                // Extract frontmatter content
                const frontmatterContent = content.substring(3, endOfFrontmatter).trim();
                
                // Parse frontmatter
                const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
                if (!frontmatter) {
                    continue;
                }
                
                // Check if it has literature_note tag
                const tags = frontmatter.tags;
                if (!tags || !Array.isArray(tags) || !tags.includes('literature_note')) {
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
     * Create a list of citation keys
     */
    private async createCitekeyList(literatureNotes: {file: TFile, frontmatter: any}[]): Promise<void> {
        // Extract citation keys (the ID field from each note)
        const citationKeys = literatureNotes
            .filter(note => note.frontmatter.id)
            .map(note => note.frontmatter.id)
            .sort();
        
        // Create a plaintext file with just the keys
        const rawKeys = citationKeys.join('\n');
        
        // Create a formatted markdown file with @ prefixes
        const formattedKeys = citationKeys.map(key => `@${key}`).join('\n');
        
        // Determine file paths
        const biblibPath = this.settings.attachmentFolderPath;
        const rawFilePath = `${biblibPath}/citekeylist`;
        const formattedFilePath = this.settings.citekeyListPath;
        
        // Ensure biblib directory exists
        try {
            const biblibFolder = this.app.vault.getAbstractFileByPath(biblibPath);
            if (!biblibFolder) {
                await this.app.vault.createFolder(biblibPath);
            }
        } catch (error) {
            console.error(`Error ensuring biblib directory exists:`, error);
        }
        
        // Write the files
        try {
            // Create or update the raw file
            const existingRawFile = this.app.vault.getAbstractFileByPath(rawFilePath);
            if (existingRawFile instanceof TFile) {
                await this.app.vault.modify(existingRawFile, rawKeys);
            } else {
                await this.app.vault.create(rawFilePath, rawKeys);
            }
            
            // Create or update the formatted file
            const existingFormattedFile = this.app.vault.getAbstractFileByPath(formattedFilePath);
            if (existingFormattedFile instanceof TFile) {
                await this.app.vault.modify(existingFormattedFile, formattedKeys);
            } else {
                await this.app.vault.create(formattedFilePath, formattedKeys);
            }
        } catch (error) {
            console.error(`Error writing citekey list files:`, error);
            new Notice('Error creating citekey list files.');
        }
    }
    
    /**
     * Create a bibliography JSON file with all literature note data
     */
    private async createBibliographyJson(literatureNotes: {file: TFile, frontmatter: any}[]): Promise<void> {
        // Prepare the data for each literature note
        const bibliographyData = literatureNotes.map(note => {
            // Extract the relevant data from frontmatter
            const {
                id,
                type,
                title,
                year,
                author,
                editor,
                issued,
                'container-title': containerTitle,
                publisher,
                'publisher-place': publisherPlace,
                URL,
                DOI,
                page,
                volume,
                number,
                issue,
                abstract,
                tags,
                ...rest
            } = note.frontmatter;
            
            // Create a structured entry
            return {
                id,
                filename: note.file.basename,
                path: note.file.path,
                type,
                title,
                year,
                author,
                editor,
                issued,
                'container-title': containerTitle,
                publisher,
                'publisher-place': publisherPlace,
                URL,
                DOI,
                page,
                volume,
                number,
                issue,
                abstract,
                tags,
                // Include any other fields that might be useful
                ...rest
            };
        });
        
        // Convert to JSON string
        const bibliographyJson = JSON.stringify(bibliographyData, null, 2);
        
        // Determine the output file path
        const outputFilePath = this.settings.bibliographyJsonPath;
        
        // Write the file
        try {
            // Create or update the bibliography file
            const existingFile = this.app.vault.getAbstractFileByPath(outputFilePath);
            if (existingFile instanceof TFile) {
                await this.app.vault.modify(existingFile, bibliographyJson);
            } else {
                await this.app.vault.create(outputFilePath, bibliographyJson);
            }
        } catch (error) {
            console.error(`Error writing bibliography JSON file:`, error);
            new Notice('Error creating bibliography JSON file.');
        }
    }
}