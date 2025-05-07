import { App, Notice, TFile, TAbstractFile, normalizePath } from 'obsidian';
import { BibliographyPluginSettings } from '../types';
import { Citation, Contributor, AdditionalField, AttachmentData, AttachmentType } from '../types/citation';
import { ReferenceParserService, ParsedReference } from './reference-parser-service';
import { NoteContentBuilderService } from './note-content-builder-service';
import { AttachmentManagerService } from './attachment-manager-service';
import { CitekeyGenerator } from '../utils/citekey-generator';

/**
 * Input for creating a single literature note
 */
export interface CreateNoteInput {
  citation: Citation;
  contributors: Contributor[];
  additionalFields: AdditionalField[];
  attachmentData: AttachmentData[] | null;
  relatedNotePaths?: string[]; // Paths to related notes
}

/**
 * Result of a note creation operation
 */
export interface CreateNoteResult {
  success: boolean; 
  path?: string; 
  error?: Error;
}

/**
 * Settings for bulk import operations
 */
export interface BulkImportSettings {
  attachmentHandling: 'none' | 'import';
  annoteToBody: boolean;
  citekeyPreference: 'imported' | 'generate';
  conflictResolution: 'skip' | 'overwrite';
}

/**
 * Results of a bulk import operation
 */
export interface BulkImportResult {
  created: number;
  skipped: number;
  errors: { message: string, entryTitle?: string }[];
  attachmentsImported: number;
}

/**
 * Service for creating literature notes from citation data
 */
export class NoteCreationService {
  private app: App;
  private settings: BibliographyPluginSettings;
  private referenceParser: ReferenceParserService;
  private noteContentBuilder: NoteContentBuilderService;
  private attachmentManager: AttachmentManagerService;
  
  constructor(
    app: App,
    settings: BibliographyPluginSettings,
    referenceParser: ReferenceParserService,
    noteContentBuilder: NoteContentBuilderService,
    attachmentManager: AttachmentManagerService
  ) {
    this.app = app;
    this.settings = settings;
    this.referenceParser = referenceParser;
    this.noteContentBuilder = noteContentBuilder;
    this.attachmentManager = attachmentManager;
  }
  
  /**
   * Create a single literature note from citation data
   * @param inputData The note creation input data
   * @returns Result indicating success or failure
   */
  async createLiteratureNote(inputData: CreateNoteInput): Promise<CreateNoteResult> {
    try {
      const { citation, contributors, additionalFields, attachmentData, relatedNotePaths } = inputData;
      
      // Handle attachments if provided
      const attachmentPaths: string[] = [];
      if (attachmentData && attachmentData.length > 0) {
        for (const attachment of attachmentData) {
          if (attachment.type !== AttachmentType.NONE) {
            let path = '';
            if (attachment.type === AttachmentType.IMPORT && attachment.file) {
              path = await this.attachmentManager.importAttachment(attachment, citation.id) || '';
            } else if (attachment.type === AttachmentType.LINK && attachment.path) {
              path = this.attachmentManager.resolveLinkedAttachmentPath(attachment) || '';
            }
            
            if (path) {
              attachmentPaths.push(path);
            }
          }
        }
      }
      
      // Build note content
      const content = await this.noteContentBuilder.buildNoteContent({
        citation,
        contributors,
        additionalFields,
        attachmentPaths,
        relatedNotePaths,
        pluginSettings: this.settings
      });
      
      // Determine the note path, passing citation data
      const notePath = this.getLiteratureNotePath(citation.id, citation);
      
      // Check if file already exists
      const existingFile = this.app.vault.getAbstractFileByPath(notePath);
      if (existingFile instanceof TFile) {
        // Throw error if file exists
        new Notice(`Literature note already exists at ${notePath}.`);
        return {
          success: false,
          error: new Error(`Literature note already exists at ${notePath}`)
        };
      }
      
      // Create any necessary folders first
      if (notePath.includes('/')) {
        const folderPath = notePath.substring(0, notePath.lastIndexOf('/'));
        if (folderPath) {
          try {
            await this.app.vault.createFolder(folderPath);
          } catch (error) {
            // If the folder already exists, that's fine
            // No action needed, as createFolder throws when the folder exists
          }
        }
      }
      
      // Create the note
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
      
      return {
        success: true,
        path: notePath
      };
    } catch (error) {
      console.error('Error creating literature note:', error);
      new Notice('Error creating literature note. Check console.');
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error creating note')
      };
    }
  }
  
  /**
   * Import references from a file
   * @param filePath Path to the file containing references
   * @param importSettings Settings for the import process
   * @returns Result of the bulk import operation
   */
  async bulkImportFromFile(
    filePath: string, 
    importSettings: BulkImportSettings
  ): Promise<BulkImportResult> {
    try {
      const fileExt = filePath.split('.').pop()?.toLowerCase();
      if (fileExt !== 'bib' && fileExt !== 'json') {
        throw new Error('Only .bib (BibTeX) and .json (CSL-JSON) files are supported');
      }
      
      // Read file content
      const fileContent = await this.app.vault.adapter.read(filePath);
      if (!fileContent) throw new Error('File is empty');
      
      const fileName = filePath.split('/').pop() || filePath;
      // Ensure the baseDir ends with a trailing slash
      let baseDir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
      if (!baseDir.endsWith('/')) {
        baseDir += '/';
      }
      
      // Import using content
      return this.bulkImportFromString(fileContent, fileExt, fileName, importSettings, baseDir);
    } catch (error) {
      console.error('Error during bulk import:', error);
      return {
        created: 0,
        skipped: 0,
        errors: [{ 
          message: `Failed to import file: ${error instanceof Error ? error.message : String(error)}` 
        }],
        attachmentsImported: 0
      };
    }
  }
  
  /**
   * Import references from a string content
   * @param content The string content containing references
   * @param fileExt File extension indicating format type ('bib' or 'json')
   * @param sourceName Name of the source for display purposes
   * @param importSettings Settings for the import process
   * @param baseDir Optional base directory for file resolution
   * @returns Result of the bulk import operation
   */
  async bulkImportFromString(
    content: string, 
    fileExt: string, 
    sourceName: string,
    importSettings: BulkImportSettings,
    baseDir?: string
  ): Promise<BulkImportResult> {
    let created = 0;
    let skipped = 0;
    let attachmentsImported = 0;
    const errors: { message: string, entryTitle?: string }[] = [];
    
    try {
      if (fileExt !== 'bib' && fileExt !== 'json') {
        throw new Error('Only .bib (BibTeX) and .json (CSL-JSON) files are supported');
      }
      
      if (!content.trim()) {
        throw new Error('Content is empty');
      }
      
      // Parse references based on format
      let parsedReferences: ParsedReference[];
      if (fileExt === 'bib') {
        parsedReferences = await this.referenceParser.parseBibTeX(content);
      } else {
        parsedReferences = await this.referenceParser.parseCslJson(content);
      }
      
      const totalReferences = parsedReferences.length;
      if (totalReferences === 0) {
        throw new Error('No valid references found in the content');
      }
      
      new Notice(`Found ${totalReferences} references in ${sourceName}`);
      
      // Process each reference
      for (let i = 0; i < parsedReferences.length; i++) {
        // Reset variables for this iteration to prevent carrying over state from previous iterations
        let attachmentPath = '';
        
        const parsedRef = parsedReferences[i];
        const refTitle = parsedRef.cslData.title || 'Untitled';
        new Notice(`Importing reference ${i + 1} of ${totalReferences}: ${refTitle}`, 2000);
        
        try {
          // Determine citekey
          let citekey: string;
          if (importSettings.citekeyPreference === 'imported' && 
              (parsedRef.originalId || parsedRef.cslData.id)) {
            citekey = parsedRef.originalId || parsedRef.cslData.id;
          } else {
            citekey = CitekeyGenerator.generate(parsedRef.cslData, this.settings.citekeyOptions);
          }
          
          // Sanitize citekey
          citekey = citekey.replace(/[^a-zA-Z0-9_\-]+/g, '_');
          
          // Check for existing note
          const notePath = this.getLiteratureNotePath(citekey, parsedRef.cslData);
          const existingFile = this.app.vault.getAbstractFileByPath(notePath);
          
          if (existingFile instanceof TFile && importSettings.conflictResolution === 'skip') {
            new Notice(`Skipping existing note: ${citekey}`, 2000);
            skipped++;
            continue;
          }
          
          // Handle attachments if enabled
          // No need to re-declare attachmentPath since we're already setting it to an empty string at the start of the loop
          if (importSettings.attachmentHandling === 'import') {
            // First check if attachment already exists in vault
            attachmentPath = await this.attachmentManager.findAttachmentInVault(parsedRef) || '';
            
            if (attachmentPath) {
              // If found in vault, move to proper location
              attachmentPath = await this.attachmentManager.organizeImportedAttachment(
                attachmentPath, citekey
              ) || '';
              
              if (attachmentPath) attachmentsImported++;
            } else if (baseDir && parsedRef._sourceFields?.file) {
              // Try to import from reference path relative to base directory
              const filePaths = Array.isArray(parsedRef._sourceFields.file) ? 
                parsedRef._sourceFields.file : [parsedRef._sourceFields.file];
              
              // Try each path
              for (const filePath of filePaths) {
                try {
                  let sourceTFile: TFile | null = null; // Variable to hold the TFile if found

                  // --- Strategy 1: Try path relative to baseDir ---
                  if (!sourceTFile && baseDir) {
                    const cleanFilePath = filePath.replace(/^\/+/, ''); // Remove leading slashes for clean join
                    const potentialPath = normalizePath(`${baseDir}${cleanFilePath}`);
                    const abstractFile = this.app.vault.getAbstractFileByPath(potentialPath);
                    if (abstractFile instanceof TFile) {
                      sourceTFile = abstractFile;
                    }
                  }

                  // --- Strategy 2: Try path relative to vault root (if not found yet) ---
                  if (!sourceTFile) {
                    const cleanFilePath = filePath.replace(/^\/+/, ''); // Remove leading slashes
                    const potentialPath = normalizePath(`/${cleanFilePath}`); // Ensure leading slash for root path
                    const abstractFile = this.app.vault.getAbstractFileByPath(potentialPath);
                    if (abstractFile instanceof TFile) {
                      sourceTFile = abstractFile;
                    }
                  }

                  // --- Strategy 3: Try common Zotero "files/ID/filename" structure (if not found yet) ---
                  if (!sourceTFile) {
                    const filesMatch = filePath.match(/files\/([^\/]+)\/([^\/]+)$/);
                    if (filesMatch) {
                      const id = filesMatch[1];
                      const filename = filesMatch[2];
                      const searchPattern = `/files/${id}/${filename}`; // Pattern to look for in paths

                      // Try relative to baseDir first (most likely for Zotero exports)
                      if (baseDir) {
                        const potentialPath = normalizePath(`${baseDir}files/${id}/${filename}`);
                        const abstractFile = this.app.vault.getAbstractFileByPath(potentialPath);
                        if (abstractFile instanceof TFile) {
                          sourceTFile = abstractFile;
                        }
                      }

                      // Fallback: Search anywhere in the vault (less efficient)
                      if (!sourceTFile) {
                        const allFiles = this.app.vault.getFiles(); // Get all files in the vault
                        for (const file of allFiles) {
                          if (file.path.includes(searchPattern)) {
                            sourceTFile = file;
                            break; // Found one
                          }
                        }
                      }
                    }
                  }

                  // --- If a TFile was found by any strategy, try to read and import ---
                  if (sourceTFile) {
                    try {
                      // Read the file using VAULT API (requires TFile)
                      const fileData = await this.app.vault.readBinary(sourceTFile);

                      // Create File object and attachment data
                      // Use the actual filename from the found TFile
                      const fileName = sourceTFile.name;
                      const file = new File([fileData], fileName);
                      const attachmentData = {
                        type: AttachmentType.IMPORT,
                        file: file,
                        filename: fileName
                      };

                      // Import the attachment
                      attachmentPath = await this.attachmentManager.importAttachment(attachmentData, citekey) || '';
                      if (attachmentPath) {
                        attachmentsImported++;
                        break; // Stop after first successful import for this reference
                      }
                    } catch (readError) {
                      console.error(`Error reading file ${sourceTFile.path}:`, readError);
                      // Continue loop to try next filePath for this reference (if any)
                    }
                  }
                  // If sourceTFile is still null after all strategies, it wasn't found in the vault.
                  // The loop will continue to the next filePath (if any) for the current reference.

                } catch (attachErr) {
                  console.error(`Error processing attachment path "${filePath}":`, attachErr);
                  // Continue loop to try next filePath for this reference (if any)
                }
              }
            }
          }
          
          // Extract annotation content if enabled
          let annotationContent = '';
          if (importSettings.annoteToBody && parsedRef._sourceFields?.annote) {
            if (Array.isArray(parsedRef._sourceFields.annote)) {
              // Deduplicate annotations
              const uniqueAnnotations = new Map<string, string>();
              
              // Normalize for comparison
              const normalizeForComparison = (text: string): string => {
                return text.toLowerCase().replace(/\s+/g, ' ').trim();
              };
              
              // Add each annotation if it's not a duplicate
              parsedRef._sourceFields.annote.forEach(text => {
                if (!text || text.trim() === '') return;
                
                const originalText = text.trim();
                const normalizedText = normalizeForComparison(originalText);
                
                if (!uniqueAnnotations.has(normalizedText)) {
                  uniqueAnnotations.set(normalizedText, originalText);
                }
              });
              
              // Join unique annotations
              annotationContent = Array.from(uniqueAnnotations.values()).join('\n\n---\n\n');
            } else {
              annotationContent = parsedRef._sourceFields.annote.trim();
            }
          }
          
          // Convert parsed reference to input format
          const { citation, contributors, additionalFields } = 
            this.convertParsedReferenceToInput(parsedRef, citekey);
          
          // Build note content
          const content = await this.noteContentBuilder.buildNoteContent({
            citation,
            contributors,
            additionalFields,
            annotationContent,
            attachmentPaths: attachmentPath ? [attachmentPath] : [],
            pluginSettings: this.settings
          });
          
          // Create or update note
          if (existingFile instanceof TFile && importSettings.conflictResolution === 'overwrite') {
            await this.app.vault.modify(existingFile, content);
            new Notice(`Overwritten existing note: ${citekey}`, 2000);
          } else {
            // Create any necessary folders first
            if (notePath.includes('/')) {
              const folderPath = notePath.substring(0, notePath.lastIndexOf('/'));
              if (folderPath) {
                try {
                  await this.app.vault.createFolder(folderPath);
                } catch (error) {
                  // If the folder already exists, that's fine
                  // No action needed, as createFolder throws when the folder exists
                }
              }
            }
            
            await this.app.vault.create(notePath, content);
          }
          created++;
          
        } catch (referenceError) {
          console.error(`Error processing reference ${i + 1}:`, referenceError);
          errors.push({
            message: `Error processing reference: ${
              referenceError instanceof Error ? referenceError.message : String(referenceError)
            }`,
            entryTitle: refTitle
          });
        }
      }
      
      new Notice(
        `Bulk import finished. ${created} notes created, ${skipped} skipped, ` +
        `${attachmentsImported} attachments imported.`
      );
      
      return { created, skipped, errors, attachmentsImported };
    } catch (error) {
      console.error('Error during bulk import:', error);
      errors.push({ 
        message: `Bulk import failed: ${error instanceof Error ? error.message : String(error)}` 
      });
      return { created, skipped, errors, attachmentsImported };
    }
  }
  
  /**
   * Convert parsed reference to input format for note creation
   * @param parsedRef Parsed reference data
   * @param citekey Citekey to use for the note
   * @returns Object with citation, contributors, and additionalFields
   */
  private convertParsedReferenceToInput(
    parsedRef: ParsedReference, 
    citekey: string
  ): { 
    citation: Citation; 
    contributors: Contributor[]; 
    additionalFields: AdditionalField[];
    annotationContent?: string
  } {
    const cslObject = parsedRef.cslData;
    
    // Build citation object
    const citation: Citation = {
      id: citekey,
      type: cslObject.type || 'document',
      title: cslObject.title || 'Untitled',
      year: this.extractYear(cslObject),
      month: this.extractMonth(cslObject),
      day: this.extractDay(cslObject),
      'title-short': cslObject['title-short'] || '',
      URL: cslObject.URL || '',
      DOI: cslObject.DOI || '',
      'container-title': cslObject['container-title'] || '',
      publisher: cslObject.publisher || '',
      'publisher-place': cslObject['publisher-place'] || '',
      edition: cslObject.edition || '',
      volume: cslObject.volume || '',
      number: cslObject.number || cslObject.issue || '',
      page: cslObject.page || '',
      language: cslObject.language || '',
      abstract: cslObject.abstract || '',
      tags: [this.settings.literatureNoteTag],
    };
    
    // Extract contributors
    const contributors: Contributor[] = this.extractContributors(cslObject);
    
    // Extract additional fields
    const commonFields = new Set([
      'id', 'type', 'title', 'year', 'month', 'day', 'title-short',
      'URL', 'DOI', 'container-title', 'publisher', 'publisher-place',
      'edition', 'volume', 'number', 'issue', 'page', 'language', 'abstract',
      'issued', 'author', 'editor', 'translator', 'tags', 
      // Skip internal fields
      '_fileField', '_annoteField', '_annoteFields', 
      // Skip citation.js internal fields
      '_graph', '_item', '_attachment',
      // Skip non-CSL fields that should not be in frontmatter
      'annote', 'file', 'attachment', 'note'
    ]);
    
    const additionalFields: AdditionalField[] = Object.entries(cslObject)
      .filter(([key]) => !commonFields.has(key))
      .map(([key, value]) => {
        let fieldType = 'standard';
        // Determine field type based on value
        if (typeof value === 'number') {
          fieldType = 'number';
        } else if (typeof value === 'object' && value !== null && 'date-parts' in value) {
          fieldType = 'date';
        }
        
        return {
          name: key,
          value: value,
          type: fieldType
        };
      });
    
    // Extract annotation content if available
    let annotationContent: string | undefined;
    if (parsedRef._sourceFields?.annote) {
      if (Array.isArray(parsedRef._sourceFields.annote)) {
        annotationContent = parsedRef._sourceFields.annote.join('\n\n---\n\n');
      } else {
        annotationContent = parsedRef._sourceFields.annote;
      }
    }
    
    return { citation, contributors, additionalFields, annotationContent };
  }
  
  /**
   * Extract year from CSL object
   */
  private extractYear(cslObject: any): string {
    // Try to get year from issued date
    if (cslObject.issued && cslObject.issued['date-parts'] && 
        cslObject.issued['date-parts'][0] && cslObject.issued['date-parts'][0][0]) {
      return cslObject.issued['date-parts'][0][0].toString();
    }
    
    // Fall back to 'year' field if present
    if (cslObject.year) {
      return cslObject.year.toString();
    }
    
    return '';
  }
  
  /**
   * Extract month from CSL object
   */
  private extractMonth(cslObject: any): string {
    // Try to get month from issued date
    if (cslObject.issued && cslObject.issued['date-parts'] && 
        cslObject.issued['date-parts'][0] && cslObject.issued['date-parts'][0][1]) {
      return cslObject.issued['date-parts'][0][1].toString();
    }
    
    // Fall back to 'month' field if present
    if (cslObject.month) {
      return cslObject.month.toString();
    }
    
    return '';
  }
  
  /**
   * Extract day from CSL object
   */
  private extractDay(cslObject: any): string {
    // Try to get day from issued date
    if (cslObject.issued && cslObject.issued['date-parts'] && 
        cslObject.issued['date-parts'][0] && cslObject.issued['date-parts'][0][2]) {
      return cslObject.issued['date-parts'][0][2].toString();
    }
    
    // Fall back to 'day' field if present
    if (cslObject.day) {
      return cslObject.day.toString();
    }
    
    return '';
  }
  
  /**
   * Extract contributors from CSL object
   */
  private extractContributors(cslObject: any): Contributor[] {
    const contributors: Contributor[] = [];
    
    // Process common contributor types
    const contributorTypes = ['author', 'editor', 'translator', 'contributor', 'director'];
    
    for (const type of contributorTypes) {
      if (cslObject[type] && Array.isArray(cslObject[type])) {
        for (const person of cslObject[type]) {
          if (typeof person === 'object' && person !== null) {
            contributors.push({
              role: type,
              family: person.family || '',
              given: person.given || '',
              literal: person.literal || ''
            });
          }
        }
      }
    }
    
    return contributors;
  }
  
  /**
   * Get the full, normalized path for a literature note
   */
  private getLiteratureNotePath(id: string, citation?: any): string {
    let fileName = '';
    
    // If using the new filename template, use it to generate the filename
    if (this.settings.filenameTemplate) {
      // First get the filename template
      const filenameTemplate = this.settings.filenameTemplate;
      
      // Set up the variables to use in the template
      const variables: any = {
        citekey: id,
        // Add date-related variables
        currentDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      };
      
      // If citation data is available, add those variables too
      if (citation) {
        Object.assign(variables, {
          title: citation.title || '',
          year: citation.year || '',
          type: citation.type || '',
          'container-title': citation['container-title'] || '',
          // More variables could be added here as needed
        });
      }
      
      // Use template engine to render the filename
      // Import the TemplateEngine class if not already imported
      const { TemplateEngine } = require('../utils/template-engine');
      fileName = TemplateEngine.render(filenameTemplate, variables);
      
      // Fallback if template renders to empty string
      if (!fileName || fileName.trim() === '') {
        // Use default format: citekey with @ prefix
        const sanitizedId = id.replace(/[^a-zA-Z0-9_\-]+/g, '_');
        fileName = `@${sanitizedId}`;
      }
      
      // Sanitize the filename for filesystem compatibility, but preserve forward slashes for subfolder creation
      fileName = fileName.replace(/[\\:"*?<>|]+/g, '_');
    } else {
      // This case should rarely happen as filenameTemplate should always have a default value
      // But just in case, use the same default format as the fallback
      const sanitizedId = id.replace(/[^a-zA-Z0-9_\-]+/g, '_');
      fileName = `@${sanitizedId}`;
    }
    
    // Process the filename and handle missing variables in paths
    let finalPath = '';
    
    // Check if the filename has path components
    if (fileName.includes('/')) {
      // Split the path into components
      const pathParts = fileName.split('/');
      
      // Filter out empty path segments (caused by missing variables that resolved to empty strings)
      const filteredParts = pathParts.filter(part => part.trim() !== '');
      
      // If all path segments were empty, use just the citekey as filename
      if (filteredParts.length === 0) {
        fileName = `${id}.md`; // Fallback to just the citekey
      } else {
        // Make sure the last component has the .md extension
        filteredParts[filteredParts.length - 1] = filteredParts[filteredParts.length - 1] + '.md';
        fileName = filteredParts.join('/');
      }
    } else {
      // Simple filename with no path components
      // Add .md extension
      fileName = `${fileName}.md`;
    }
    
    // We need the path to be absolute, so prepend the base path
    let basePath = normalizePath(this.settings.literatureNotePath);
    if (basePath !== '/' && !basePath.endsWith('/')) {
      basePath += '/';
    }
    // Handle root path case
    if (basePath === '/') basePath = '';
    
    finalPath = normalizePath(`${basePath}${fileName}`);
    
    return finalPath;
  }
  
  /**
   * Get all literature notes, typically books, from the vault
   * @returns Array of book entries with metadata
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
   * Get a single book entry by path
   * @param path Path to the note to get
   * @returns Book entry data or null if not found
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
      if (!frontmatter || !frontmatter.id || !frontmatter.title || !frontmatter.type || 
          !['book', 'collection', 'document'].includes(frontmatter.type)) {
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