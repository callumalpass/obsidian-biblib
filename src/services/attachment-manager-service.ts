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
      
      // 2. Zotero structure match - look for files in standard Zotero export structure
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
        for (const file of allFiles) {
          // First check: Path must contain the ID in proper folder structure
          const containsID = file.path.includes(`/files/${id}/`) || 
                           file.path.includes(`/attachments/${id}/`);
          
          if (containsID) {
            // Check if the filename is in our potential filenames list
            const foundMatchingName = potentialFilenames.some(name => {
              const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
              const nameWithoutExt = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;
              
              // Only return true for exact matches or if the filename begins with the potential name
              return fileNameWithoutExt.toLowerCase() === nameWithoutExt.toLowerCase() ||
                    fileNameWithoutExt.toLowerCase().startsWith(nameWithoutExt.toLowerCase());
            });
            
            if (foundMatchingName) {
              return file.path;
            }
          }
        }
      }
      
      // 3. Zotero folder structure search - with more strict matching
      const zoteroFolderMatches = allFiles.filter(file => {
        // Only consider files in standard Zotero export folders and common attachment types
        if (!file.path.includes('/files/') || 
            !(file.name.endsWith('.pdf') || file.name.endsWith('.epub'))) {
          return false;
        }
        
        // Only match if a potential filename exactly matches the file name
        return potentialFilenames.some(name => {
          // Get just the base filename without extension for exact comparison
          const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
          const nameWithoutExt = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;
          
          // Only return true for exact matches (case insensitive)
          return fileNameWithoutExt.toLowerCase() === nameWithoutExt.toLowerCase();
        });
      });
      
      if (zoteroFolderMatches.length > 0) {
        // console.log(`Found Zotero folder structure match: ${zoteroFolderMatches[0].path}`);
        return zoteroFolderMatches[0].path;
      }
      
      // Fuzzy matching removed as it can incorrectly match PDFs
      // We now rely solely on exact filename matches and Zotero structure matches
      // which are more reliable for properly identifying the correct attachments
      
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
      
      // Find all files in the target folder with the same extension
      const filesInFolder = this.app.vault.getFiles().filter(file => 
          file.parent && file.parent.path === targetFolderPath &&
          file.extension === fileExtension && 
          file.basename.startsWith(sanitizedId)
      );
      
      let attachmentFilename = '';
      
      if (filesInFolder.length > 0) {
        // If there are already files with this citekey and extension, add a number
        // Check if the base file without number exists
        const baseFileExists = filesInFolder.some(file => file.basename === sanitizedId);
        
        // Find the highest existing number
        const numberPattern = new RegExp(`${sanitizedId}_(\\d+)$`);
        let highestNumber = 0;
        
        filesInFolder.forEach(file => {
          const match = file.basename.match(numberPattern);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num > highestNumber) {
              highestNumber = num;
            }
          }
        });
        
        // If base file exists without a number and no numbered files exist yet, start with _1
        if (baseFileExists && highestNumber === 0) {
          attachmentFilename = `${sanitizedId}_1.${fileExtension}`;
        } else {
          // Otherwise use the next number in sequence
          attachmentFilename = `${sanitizedId}_${highestNumber + 1}.${fileExtension}`;
        }
      } else {
        // No existing files with this name, use the basic format
        attachmentFilename = `${sanitizedId}.${fileExtension}`;
      }
      
      const attachmentPath = normalizePath(`${targetFolderPath}/${attachmentFilename}`);
      
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
      
      // Sanitize citekey for use in filename
      const sanitizedId = citekey.replace(/[^a-zA-Z0-9_\-]+/g, '_');
      
      // Find all files in the target folder with the same extension
      const filesInFolder = this.app.vault.getFiles().filter(file => 
          file.parent && file.parent.path === targetFolderPath &&
          file.extension === fileExt && 
          file.basename.startsWith(sanitizedId)
      );
      
      let newFilename = '';
      
      if (filesInFolder.length > 0) {
        // If there are already files with this citekey and extension, add a number
        // Check if the base file without number exists
        const baseFileExists = filesInFolder.some(file => file.basename === sanitizedId);
        
        // Find the highest existing number
        const numberPattern = new RegExp(`${sanitizedId}_(\\d+)$`);
        let highestNumber = 0;
        
        filesInFolder.forEach(file => {
          const match = file.basename.match(numberPattern);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num > highestNumber) {
              highestNumber = num;
            }
          }
        });
        
        // If base file exists without a number and no numbered files exist yet, start with _1
        if (baseFileExists && highestNumber === 0) {
          newFilename = `${sanitizedId}_1.${fileExt}`;
        } else {
          // Otherwise use the next number in sequence
          newFilename = `${sanitizedId}_${highestNumber + 1}.${fileExt}`;
        }
      } else {
        // No existing files with this name, use the basic format
        newFilename = `${sanitizedId}.${fileExt}`;
      }
      
      const targetPath = normalizePath(`${targetFolderPath}/${newFilename}`);
      
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
