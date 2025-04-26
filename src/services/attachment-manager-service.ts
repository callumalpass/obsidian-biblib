import { App, Notice, TFile, normalizePath } from 'obsidian';
import { BibliographyPluginSettings } from '../types';
import { AttachmentType } from '../types/citation';
import { ParsedReference } from './reference-parser-service';

/**
 * Input data for attachment import operations
 */
export interface AttachmentData {
  type: AttachmentType;
  file?: File;          // For imported files
  path?: string;        // For linked files
  filename?: string;    // For displaying the filename
}

/**
 * Service responsible for handling all file attachment operations
 */
export class AttachmentManagerService {
  private app: App;
  private settings: BibliographyPluginSettings;
  
  constructor(app: App, settings: BibliographyPluginSettings) {
    this.app = app;
    this.settings = settings;
  }
  
  /**
   * Find a reference's attachment in the vault
   * @param refData Parsed reference data that may contain file paths
   * @returns Path to found attachment or null if not found
   */
  async findAttachmentInVault(refData: ParsedReference): Promise<string | null> {
    try {
      // Extract potential file paths from the reference data
      const filePaths: string[] = [];
      
      // Check _sourceFields for file paths
      if (refData._sourceFields?.file) {
        if (Array.isArray(refData._sourceFields.file)) {
          filePaths.push(...refData._sourceFields.file);
        } else {
          filePaths.push(refData._sourceFields.file);
        }
      }
      
      // If no file paths found in _sourceFields, check elsewhere in cslData
      if (filePaths.length === 0) {
        const cslObj = refData.cslData;
        
        // Check common file-related fields in CSL data
        if (cslObj.file) {
          if (Array.isArray(cslObj.file)) {
            filePaths.push(...cslObj.file.filter((f: any) => typeof f === 'string'));
          } else if (typeof cslObj.file === 'string') {
            filePaths.push(cslObj.file);
          }
        }
        
        // Check for link field which might contain file URLs
        if (cslObj.link && Array.isArray(cslObj.link)) {
          for (const link of cslObj.link) {
            if (link.url && typeof link.url === 'string' && !link.url.startsWith('http')) {
              filePaths.push(link.url);
            }
          }
        }
        
        // Other possible fields where files might be referenced
        for (const field of ['pdf', 'attachment']) {
          if (cslObj[field]) {
            if (Array.isArray(cslObj[field])) {
              filePaths.push(...cslObj[field].filter((f: any) => typeof f === 'string'));
            } else if (typeof cslObj[field] === 'string') {
              filePaths.push(cslObj[field]);
            }
          }
        }
      }
      
      // Clean up path strings and remove quotes, excess spaces
      const cleanedPaths = filePaths
        .map(p => p.replace(/^["']|["']$/g, '').trim())
        .map(p => p.replace(/\\:/g, ':'))
        .filter(Boolean);
      
      if (cleanedPaths.length === 0) {
        return null;
      }
      
      // Now try to find the attachment using different strategies
      
      // 1. Exact filename match - try to find files with the exact name
      const potentialFilenames = cleanedPaths.map(path => {
        const parts = path.split(/[/\\]/);
        return parts[parts.length - 1]; // Get the last part (the filename)
      }).filter(Boolean);
      
      // Get all files in vault
      const allFiles = this.app.vault.getFiles();
      
      // First attempt: Look for exact filename matches
      for (const filename of potentialFilenames) {
        const matches = allFiles.filter(file => file.name === filename);
        if (matches.length > 0) {
          // console.log(`Found exact filename match for ${filename}: ${matches[0].path}`);
          return matches[0].path;
        }
      }
      
      // 2. Zotero structure match - look for files in Zotero-like folder structure
      const potentialIDs = new Set<string>();
      for (const path of cleanedPaths) {
        // Extract ID from patterns like "files/12345/filename.pdf" or "attachments/12345/filename.pdf"
        const match = path.match(/(?:files|attachments)\/([^\/]+)\//);
        if (match && match[1]) {
          potentialIDs.add(match[1]);
        }
      }
      
      // Look for files in standard Zotero export structure: files/ID/filename.ext
      for (const id of potentialIDs) {
        // Common folder names for Zotero exports
        const folderPatterns = ['files', 'attachments', 'storage', id];
        
        for (const file of allFiles) {
          // Check if the file's path contains both an ID folder and one of the common parent folders
          const containsID = file.path.includes(`/${id}/`);
          const containsFolder = folderPatterns.some(pattern => 
            file.path.toLowerCase().includes(`/${pattern.toLowerCase()}/`));
          
          if (containsID || (containsFolder && 
              potentialFilenames.some(name => file.name.includes(name)))) {
            // console.log(`Found potential Zotero attachment match: ${file.path}`);
            return file.path;
          }
        }
      }
      
      // 3. Zotero folder structure search
      const zoteroFolderMatches = allFiles.filter(file => {
        return file.path.includes('/files/') && // Standard Zotero export folder
          (file.name.endsWith('.pdf') || file.name.endsWith('.epub')) && // Common attachment types
          potentialFilenames.some(name => 
            // Partial filename match (in case of truncation or modification)
            file.name.includes(name) || 
            // Try to match by removing spaces/special chars
            file.name.replace(/[^a-zA-Z0-9]/g, '').includes(name.replace(/[^a-zA-Z0-9]/g, ''))
          );
      });
      
      if (zoteroFolderMatches.length > 0) {
        // console.log(`Found Zotero folder structure match: ${zoteroFolderMatches[0].path}`);
        return zoteroFolderMatches[0].path;
      }
      
      // 4. Fuzzy matching - look for PDFs with similar filenames anywhere in the vault
      const fuzzyMatches = allFiles.filter(file => {
        // Only consider PDF/EPUB files
        if (!(file.name.endsWith('.pdf') || file.name.endsWith('.epub'))) return false;
        
        // Try different matching strategies
        return potentialFilenames.some(name => {
          // Try to normalize both filenames for comparison by removing special chars
          const normalizedFileName = file.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          const normalizedSearchName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          
          // Check if one contains a significant portion of the other
          return normalizedFileName.includes(normalizedSearchName) || 
            normalizedSearchName.includes(normalizedFileName);
        });
      });
      
      if (fuzzyMatches.length > 0) {
        // console.log(`Found fuzzy match: ${fuzzyMatches[0].path}`);
        return fuzzyMatches[0].path;
      }
      
      // No matches found
      return null;
    } catch (error) {
      console.error('Error finding attachment in vault:', error);
      return null;
    }
  }
  
  /**
   * Import a file attachment and place it in the proper location
   * @param attachmentData Data for the attachment to import
   * @param citekey Citekey to use for filename and folder
   * @returns Path to the imported file or null if import failed
   */
  async importAttachment(attachmentData: AttachmentData, citekey: string): Promise<string | null> {
    try {
      // Only handle IMPORT type
      if (attachmentData.type !== AttachmentType.IMPORT || !attachmentData.file) {
        return null;
      }
      
      // Ensure base attachment directory exists
      const biblibPath = normalizePath(this.settings.attachmentFolderPath);
      try {
        const biblibFolder = this.app.vault.getAbstractFileByPath(biblibPath);
        if (!biblibFolder) {
          await this.app.vault.createFolder(biblibPath);
        }
      } catch (folderError) {
        console.error(`Error creating attachment folder ${biblibPath}:`, folderError);
        new Notice(`Error creating attachment folder: ${biblibPath}`);
        return null;
      }
      
      // Determine target folder and filename
      const fileExtension = attachmentData.file.name.split('.').pop() || 'file';
      let targetFolderPath = biblibPath;
      
      // Create subfolder if enabled in settings
      if (this.settings.createAttachmentSubfolder) {
        targetFolderPath = normalizePath(`${biblibPath}/${citekey}`);
        try {
          const subFolder = this.app.vault.getAbstractFileByPath(targetFolderPath);
          if (!subFolder) {
            await this.app.vault.createFolder(targetFolderPath);
          }
        } catch (subFolderError) {
          console.error(`Error creating attachment subfolder ${targetFolderPath}:`, subFolderError);
          new Notice(`Error creating attachment subfolder: ${targetFolderPath}`);
          return null;
        }
      }
      
      // Sanitize citekey for use in filename
      const sanitizedId = citekey.replace(/[^a-zA-Z0-9_\-]+/g, '_');
      const attachmentFilename = `${sanitizedId}.${fileExtension}`;
      const attachmentPath = normalizePath(`${targetFolderPath}/${attachmentFilename}`);
      
      // Check if file already exists
      const existingAttachment = this.app.vault.getAbstractFileByPath(attachmentPath);
      if (existingAttachment instanceof TFile) {
        // Skip import if attachment already exists
        new Notice(`Attachment already exists: ${attachmentPath}`);
        return attachmentPath;
      }
      
      // Import the file
      const arrayBuffer = await attachmentData.file.arrayBuffer();
      await this.app.vault.createBinary(attachmentPath, arrayBuffer);
      new Notice(`Attachment imported to ${attachmentPath}`);
      return attachmentPath;
    } catch (error) {
      console.error('Error importing attachment:', error);
      new Notice('Error importing attachment. Check console.');
      return null;
    }
  }
  
  /**
   * Resolve a linked attachment path (validate it exists)
   * @param attachmentData Data for the linked attachment
   * @returns Normalized vault path or null if invalid
   */
  resolveLinkedAttachmentPath(attachmentData: AttachmentData): string | null {
    try {
      // Only handle LINK type
      if (attachmentData.type !== AttachmentType.LINK || !attachmentData.path) {
        return null;
      }
      
      // Normalize the path
      const normalizedPath = normalizePath(attachmentData.path);
      
      // Verify the file exists in the vault
      const existingFile = this.app.vault.getAbstractFileByPath(normalizedPath);
      if (!(existingFile instanceof TFile)) {
        console.warn(`Linked attachment not found in vault: ${normalizedPath}`);
        return null;
      }
      
      return normalizedPath;
    } catch (error) {
      console.error('Error resolving linked attachment path:', error);
      return null;
    }
  }
  
  /**
   * Move an existing attachment to the configured location and rename it
   * @param sourcePath Current path of the attachment in the vault
   * @param citekey Citekey to use for filename and folder
   * @returns New path after moving or null if failed
   */
  async organizeImportedAttachment(sourcePath: string, citekey: string): Promise<string | null> {
    try {
      // Get the source file
      const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
      if (!(sourceFile instanceof TFile)) {
        console.error(`Source file not found or not a file: ${sourcePath}`);
        return null;
      }
      
      // Determine the file extension
      const fileExt = sourceFile.extension;
      
      // Build the target path according to user settings
      const biblibPath = normalizePath(this.settings.attachmentFolderPath);
      
      // Ensure base attachment directory exists
      try {
        const biblibFolder = this.app.vault.getAbstractFileByPath(biblibPath);
        if (!biblibFolder) {
          await this.app.vault.createFolder(biblibPath);
        }
      } catch (folderError) {
        console.error(`Error creating attachment folder ${biblibPath}:`, folderError);
        new Notice(`Error creating attachment folder: ${biblibPath}`);
        return null;
      }
      
      // Determine if we need a subfolder
      let targetFolderPath = biblibPath;
      if (this.settings.createAttachmentSubfolder) {
        // Create subfolder if enabled
        targetFolderPath = normalizePath(`${biblibPath}/${citekey}`);
        try {
          const subFolder = this.app.vault.getAbstractFileByPath(targetFolderPath);
          if (!subFolder) {
            await this.app.vault.createFolder(targetFolderPath);
          }
        } catch (subFolderError) {
          console.error(`Error creating attachment subfolder ${targetFolderPath}:`, subFolderError);
          new Notice(`Error creating attachment subfolder: ${targetFolderPath}`);
          return null;
        }
      }
      
      // Use citekey as the new filename
      const sanitizedId = citekey.replace(/[^a-zA-Z0-9_\-]+/g, '_');
      const newFilename = `${sanitizedId}.${fileExt}`;
      const targetPath = normalizePath(`${targetFolderPath}/${newFilename}`);
      
      // Check if target file already exists
      const existingTarget = this.app.vault.getAbstractFileByPath(targetPath);
      if (existingTarget instanceof TFile) {
        // File already exists at the target location with the citekey name
        // console.log(`Attachment already exists at target location: ${targetPath}`);
        return targetPath;
      }
      
      // Read the source file content
      const sourceContent = await this.app.vault.readBinary(sourceFile);
      
      // Create the new file with the same content
      await this.app.vault.createBinary(targetPath, sourceContent);
      
      // Note: We don't delete the source file to avoid data loss
      // If deletion is desired, uncomment: await this.app.vault.delete(sourceFile);
      
      new Notice(`Moved attachment to ${targetPath}`);
      return targetPath;
    } catch (error) {
      console.error(`Error moving attachment to proper location: ${error}`);
      new Notice(`Error organizing attachment: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Move a file to the trash
   * @param filePath The path of the file to trash
   * @returns True if successful, false otherwise
   */
  async trashFile(filePath: string): Promise<boolean> {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        await this.app.vault.trash(file, false);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error trashing file ${filePath}:`, error);
      return false;
    }
  }
}
