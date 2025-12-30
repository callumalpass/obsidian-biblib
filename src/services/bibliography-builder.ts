import { App, Notice, TFile, Vault, normalizePath } from 'obsidian';
import { BibliographyPluginSettings, parseLiteratureNoteTags } from '../types';
import Cite from 'citation-js';
import '@citation-js/plugin-bibtex';
import { AttachmentManagerService } from './attachment-manager-service';

/**
 * Interface representing a literature note with its file and parsed frontmatter.
 */
interface LiteratureNote {
    /** The file containing the literature note */
    file: TFile;
    /** Parsed frontmatter data (CSL-JSON format) */
    frontmatter: any;
}

/**
 * Service responsible for building bibliography files from literature notes stored in the vault.
 *
 * This service scans the vault for notes tagged as literature notes (via the configured tag),
 * extracts their CSL-JSON metadata, and generates various bibliography outputs:
 * - Citekey lists (plain text and markdown format)
 * - CSL-JSON bibliography file
 * - BibTeX export
 *
 * The service uses Obsidian's MetadataCache for efficient scanning, avoiding the need
 * to read and parse every file in the vault.
 *
 * @example
 * ```typescript
 * const builder = new BibliographyBuilder(app, settings);
 * await builder.buildBibliography(); // Creates all bibliography files
 * await builder.exportBibTeX(); // Exports to BibTeX format
 * ```
 */
export class BibliographyBuilder {
    private app: App;
    private settings: BibliographyPluginSettings;
    private attachmentManager: AttachmentManagerService;

    /**
     * Creates a new BibliographyBuilder instance.
     *
     * @param app - The Obsidian App instance
     * @param settings - Plugin settings containing bibliography paths and configuration
     */
    constructor(app: App, settings: BibliographyPluginSettings) {
        this.app = app;
        this.settings = settings;
        this.attachmentManager = new AttachmentManagerService(app, settings);
    }

    /**
     * Build all bibliography files containing literature notes from the vault.
     *
     * This method performs the following operations:
     * 1. Scans the vault for literature notes using MetadataCache
     * 2. Creates a citekey list (both plain text and markdown formats)
     * 3. Creates a CSL-JSON bibliography file with full metadata
     *
     * The generated files are saved to paths configured in plugin settings:
     * - `citekeyListPath` - Markdown file with @-prefixed citekeys
     * - `attachmentFolderPath/citekeylist.txt` - Plain text citekeys
     * - `bibliographyJsonPath` - Full CSL-JSON bibliography
     *
     * @returns Promise that resolves when all bibliography files are created
     * @throws Error if file writing fails (errors are caught and shown to user)
     *
     * @example
     * ```typescript
     * await builder.buildBibliography();
     * // Creates: bibliography.json, citekeylist.md, citekeylist.txt
     * ```
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
     * Find all literature notes in the vault using MetadataCache for efficient scanning.
     *
     * This method scans the vault for notes that meet the following criteria:
     * 1. Have frontmatter with the configured literature note tag
     * 2. Have a valid `id` field (citekey) in the frontmatter
     *
     * Uses Obsidian's MetadataCache to avoid reading file contents, making this
     * operation very fast even with thousands of notes in the vault.
     *
     * @returns Promise resolving to array of literature notes with their files and frontmatter
     * @private
     *
     * @example
     * ```typescript
     * const notes = await this.findLiteratureNotes();
     * // notes = [{file: TFile, frontmatter: {...}}, ...]
     * ```
     */
    private async findLiteratureNotes(): Promise<LiteratureNote[]> {
        const literatureNotes: LiteratureNote[] = [];

        // Get all markdown files in the vault
        const markdownFiles = this.app.vault.getMarkdownFiles();

        // Use MetadataCache to efficiently filter files without reading them
        for (const file of markdownFiles) {
            try {
                // Retrieve cached metadata - this is very fast as it's already parsed
                const cache = this.app.metadataCache.getFileCache(file);
                const frontmatter = cache?.frontmatter;

                // Skip files without frontmatter
                if (!frontmatter) {
                    continue;
                }

                // Check if the note has any of the configured literature note tags
                // Parse the literatureNoteTag setting which may contain multiple comma/space-separated tags
                const tags = frontmatter.tags;
                const configuredTags = parseLiteratureNoteTags(this.settings.literatureNoteTag);
                const hasLiteratureTag =
                    tags &&
                    Array.isArray(tags) &&
                    configuredTags.some(configuredTag => tags.includes(configuredTag));

                if (!hasLiteratureTag) {
                    continue;
                }

                // Ensure the note has a valid citekey (id field)
                if (!frontmatter.id) {
                    console.warn(`Literature note ${file.path} is missing 'id' field, skipping`);
                    continue;
                }

                // Add to the list of valid literature notes
                literatureNotes.push({
                    file,
                    frontmatter
                });
            } catch (error) {
                console.error(`Error processing file ${file.path}:`, error);
                // Continue processing other files even if one fails
            }
        }

        return literatureNotes;
    }
    
    /**
     * Create or update citekey list files from literature notes.
     *
     * Generates two files containing citation keys extracted from literature notes:
     * 1. Plain text file (`citekeylist.txt`) - One citekey per line
     * 2. Markdown file (`citekeyListPath`) - One citekey per line with @ prefix
     *
     * The citekeys are sorted alphabetically for consistency. These files are useful
     * for Pandoc integration and external reference management tools.
     *
     * @param literatureNotes - Array of literature notes to extract citekeys from
     * @returns Promise that resolves when both citekey files are created/updated
     * @throws Error if file writing fails
     * @private
     *
     * @example
     * ```typescript
     * await this.createCitekeyList(notes);
     * // Creates:
     * // - biblib/citekeylist.txt: "author2023\nauthor2024\n..."
     * // - citekeylist.md: "@author2023\n@author2024\n..."
     * ```
     */
    private async createCitekeyList(literatureNotes: LiteratureNote[]): Promise<void> {
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
     * Create or update a CSL-JSON bibliography file with full literature note metadata.
     *
     * This method extracts CSL-JSON metadata from all literature notes and compiles
     * them into a single JSON file. The resulting file can be used with:
     * - Pandoc for citation processing
     * - Other CSL-compatible tools and reference managers
     * - External bibliography processors
     *
     * The method performs the following transformations:
     * 1. Removes Obsidian-specific metadata (position, tags)
     * 2. Adds an `obsidianPath` field for cross-referencing
     * 3. Formats output as indented JSON for readability
     *
     * @param literatureNotes - Array of literature notes to include in bibliography
     * @returns Promise that resolves when the bibliography JSON file is created/updated
     * @throws Error if file writing fails
     * @private
     *
     * @example
     * ```typescript
     * await this.createBibliographyJson(notes);
     * // Creates: bibliography.json with CSL-JSON array
     * // [{"id": "author2023", "type": "article-journal", ...}, ...]
     * ```
     */
    private async createBibliographyJson(literatureNotes: LiteratureNote[]): Promise<void> {
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
     * Export all literature notes into a single BibTeX (.bib) file.
     *
     * This method converts CSL-JSON metadata from literature notes into BibTeX format
     * using citation-js. The resulting file can be imported into reference managers
     * like Zotero, Mendeley, or used directly with LaTeX/BibTeX.
     *
     * The method performs the following:
     * 1. Finds all literature notes in the vault
     * 2. Cleans invalid date fields (empty date-parts arrays)
     * 3. Converts CSL-JSON to BibTeX using citation-js
     * 4. Writes to the configured BibTeX file path
     *
     * **Note:** Date fields with invalid or empty data are removed to prevent
     * conversion errors. This ensures maximum compatibility with BibTeX parsers.
     *
     * @returns Promise that resolves when the BibTeX file is created/updated
     * @throws Error if conversion or file writing fails (errors are shown to user)
     *
     * @example
     * ```typescript
     * await builder.exportBibTeX();
     * // Creates: biblib/bibliography.bib
     * ```
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
