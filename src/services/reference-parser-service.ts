import { CitationService } from './citation-service';

/**
 * Interface for a parsed reference representing a standardized entry from various source formats
 */
export interface ParsedReference {
  cslData: Record<string, any>; // CSL-like object
  _sourceFields?: { // Raw fields captured before full CSL conversion
    file?: string | string[];
    annote?: string | string[];
    // Potentially other source-specific fields
  };
  sourceFormat: 'bibtex' | 'csl-json';
  originalId?: string; // ID from the source file
  parsingErrors?: string[]; // Errors encountered for this specific entry
}

/**
 * Responsible for parsing raw input (BibTeX, CSL-JSON strings) into standardized CSL-like JavaScript objects
 */
export class ReferenceParserService {
  private citationService: CitationService;

  constructor(citationService: CitationService) {
    this.citationService = citationService;
  }

  /**
   * Parse BibTeX content into standardized reference objects
   * @param bibtexContent Raw BibTeX content string
   * @returns Array of parsed references
   */
  async parseBibTeX(bibtexContent: string): Promise<ParsedReference[]> {
    try {
      // Extract individual BibTeX entries
      const entries = this.extractBibTeXEntries(bibtexContent);
      
      // Parse each entry
      return entries.map(entry => {
        try {
          // Parse the BibTeX entry using CitationService
          const cslData = this.citationService.parseBibTeX(entry);
          
          // Capture source-specific fields
          const _sourceFields: ParsedReference['_sourceFields'] = {};
          
          // Extract file fields (might be multiple)
          const fileField = this.extractBibTeXField(entry, 'file');
          if (fileField) {
            // Parse Zotero file field format: description:path:mime-type
            try {
              // Handle Zotero's specialized file field format
              // In Zotero, the file field format is: description:path:mime-type
              // Multiple files are separated by semicolons
              
              // First, split by semicolons to handle multiple files
              const fileEntries = fileField.split(';').map(entry => entry.trim()).filter(Boolean);
              const processedPaths = [];
              
              for (const entry of fileEntries) {
                // For each entry, try to find the path component
                const colonCount = (entry.match(/:/g) || []).length;
                
                if (colonCount >= 2) {
                  // This is likely a Zotero format entry with 3 parts
                  const parts = entry.split(':');
                  
                  // The path is the middle part (index 1)
                  // For safety, join any remaining parts in case there are colons in the path
                  if (parts.length >= 3) {
                    // If we have at least 3 parts, take everything in the middle
                    const path = parts.slice(1, -1).join(':');
                    processedPaths.push(path);
                  } else {
                    // Fallback if the splitting didn't work as expected
                    processedPaths.push(entry);
                  }
                } else {
                  // Not in the Zotero format, just use as is
                  processedPaths.push(entry);
                }
              }
              
              // Use the processed paths if any were found
              if (processedPaths.length > 0) {
                _sourceFields.file = processedPaths.length === 1 ? processedPaths[0] : processedPaths;
              } else {
                // Fallback to the original field if parsing failed
                _sourceFields.file = fileField;
              }
            } catch (parseError) {
              // If anything goes wrong, fall back to the original field
              console.error(`Error parsing file field: ${parseError}`);
              _sourceFields.file = fileField;
            }
          }
          
          // Extract annote fields (might be multiple)
          const annoteFields = this.extractAllBibTeXFields(entry, 'annote');
          if (annoteFields && annoteFields.length > 0) {
            _sourceFields.annote = annoteFields;
          }
          
          // Get original ID for reference
          const originalId = cslData.id || this.extractBibTeXCitekey(entry);
          
          return {
            cslData,
            _sourceFields,
            sourceFormat: 'bibtex' as const,
            originalId,
            parsingErrors: []
          } as ParsedReference;
        } catch (error) {
          // Log the error but return a partial result to avoid failing the entire batch
          console.error('Error parsing BibTeX entry:', error, entry);
          return {
            cslData: { 
              type: 'document', 
              title: 'Error parsing entry', 
              id: this.extractBibTeXCitekey(entry) || 'error'
            },
            sourceFormat: 'bibtex' as const,
            parsingErrors: [`Failed to parse entry: ${error instanceof Error ? error.message : String(error)}`]
          } as ParsedReference;
        }
      }).filter(entry => entry !== null);
    } catch (error) {
      console.error('Error parsing BibTeX file:', error);
      throw new Error(`Failed to parse BibTeX file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse CSL-JSON content into standardized reference objects
   * @param jsonContent Raw CSL-JSON content string
   * @returns Array of parsed references
   */
  async parseCslJson(jsonContent: string): Promise<ParsedReference[]> {
    try {
      // Parse the JSON string
      const data = JSON.parse(jsonContent);
      
      // Handle both array and single object formats
      const entries = Array.isArray(data) ? data : [data];
      
      // Validate and convert each entry
      return entries.map(entry => {
        try {
          // Basic structure validation
          if (!entry || typeof entry !== 'object') {
            throw new Error('Invalid CSL-JSON entry format');
          }
          
          // Ensure minimal required fields
          const cslData = {
            ...entry,
            type: entry.type || 'document',
            title: entry.title || 'Untitled Entry',
            id: entry.id || 'unknown'
          };
          
          // Extract file field(s) if present
          const _sourceFields: ParsedReference['_sourceFields'] = {};
          
          if (entry.file) {
            if (Array.isArray(entry.file)) {
              _sourceFields.file = entry.file.filter((f: any) => typeof f === 'string');
            } else if (typeof entry.file === 'string') {
              _sourceFields.file = entry.file;
            }
          }
          
          // Extract annotations if present
          if (entry.annote || entry.note) {
            const annote = entry.annote || entry.note;
            if (Array.isArray(annote)) {
              _sourceFields.annote = annote.filter((a: any) => typeof a === 'string');
            } else if (typeof annote === 'string') {
              _sourceFields.annote = annote;
            }
          }
          
          return {
            cslData,
            _sourceFields: Object.keys(_sourceFields).length > 0 ? _sourceFields : undefined,
            sourceFormat: 'csl-json' as const,
            originalId: entry.id,
            parsingErrors: []
          } as ParsedReference;
        } catch (error) {
          console.error('Error processing CSL-JSON entry:', error, entry);
          return {
            cslData: { 
              type: 'document', 
              title: 'Error parsing entry', 
              id: entry.id || 'error'
            },
            sourceFormat: 'csl-json' as const,
            parsingErrors: [`Failed to parse entry: ${error instanceof Error ? error.message : String(error)}`]
          } as ParsedReference;
        }
      }).filter(entry => entry !== null);
    } catch (error) {
      console.error('Error parsing CSL-JSON file:', error);
      throw new Error(`Failed to parse CSL-JSON file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract individual BibTeX entries from a file content string
   * @param bibtexContent Full BibTeX file content
   * @returns Array of individual entry strings
   */
  private extractBibTeXEntries(bibtexContent: string): string[] {
    // Match each @TYPE{...} entry in the BibTeX file
    const entryRegex = /@[A-Za-z]+\s*{[^@]*}/gs;
    const entries = bibtexContent.match(entryRegex) || [];
    return entries;
  }

  /**
   * Extract a specific field from a BibTeX entry
   * @param entry BibTeX entry string
   * @param fieldName Field name to extract
   * @returns Extracted field value or empty string
   */
  private extractBibTeXField(entry: string, fieldName: string): string {
    // Match the field pattern like 'fieldName = {...}' or 'fieldName = "..."'
    const regex = new RegExp(`${fieldName}\\s*=\\s*(?:{((?:[^{}]|{[^{}]*})*)}|"([^"]*)")`, 'i');
    const match = entry.match(regex);
    if (match) {
      // Return the content inside the braces or quotes
      return match[1] || match[2] || '';
    }
    return '';
  }

  /**
   * Extract all occurrences of a specific field from a BibTeX entry
   * @param entry BibTeX entry string
   * @param fieldName Field name to extract
   * @returns Array of extracted field values
   */
  private extractAllBibTeXFields(entry: string, fieldName: string): string[] {
    // Match the field pattern like 'fieldName = {...}' or 'fieldName = "..."' globally
    const regex = new RegExp(`${fieldName}\\s*=\\s*(?:{((?:[^{}]|{[^{}]*})*)}|"([^"]*)")`, 'gi');
    const matches = [...entry.matchAll(regex)];
    
    // Extract all values
    return matches.map(match => match[1] || match[2] || '').filter(Boolean);
  }

  /**
   * Extract the citekey from a BibTeX entry
   * @param entry BibTeX entry string
   * @returns Extracted citekey or undefined
   */
  private extractBibTeXCitekey(entry: string): string | undefined {
    const match = entry.match(/@[A-Za-z]+\s*{([^,}]+)/);
    return match?.[1]?.trim();
  }
}