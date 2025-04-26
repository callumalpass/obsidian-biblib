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

    async importReferencesFromContent(
        fileContent: string,
        fileExt: string,
        fileName: string,
        importSettings: {
            attachmentHandling: 'none' | 'import';
            annoteToBody: boolean;
            citekeyPreference: 'imported' | 'generate';
            conflictResolution: 'skip' | 'overwrite';
        }
    ): Promise<{created: number, skipped: number, attachmentsImported: number}> {
        let created = 0;
        let skipped = 0;
        let attachmentsImported = 0;

        try {
            if (fileExt !== 'bib' && fileExt !== 'json') {
                throw new Error('Only .bib (BibTeX) and .json (CSL-JSON) files are supported');
            }
            if (!fileContent.trim()) {
                throw new Error('File content is empty');
            }

            let references: any[] = [];
            if (fileExt === 'bib') {
                references = this.parseBibTeXFile(fileContent);
            } else {
                references = this.parseCslJsonFile(fileContent);
            }

            const totalReferences = references.length;
            if (totalReferences === 0) {
                throw new Error('No valid references found in the file');
            }

            new Notice(`Found ${totalReferences} references in ${fileName}`);

            const useVaultAttachmentLookup = true;

            for (let i = 0; i < references.length; i++) {
                const cslObject = references[i];
                new Notice(`Importing reference ${i + 1} of ${totalReferences}...`, 2000);

                try {
                    let citekey: string;
                    if (importSettings.citekeyPreference === 'imported' && cslObject.id) {
                        citekey = cslObject.id;
                    } else {
                        citekey = this.generateCitekey(cslObject);
                    }
                    citekey = citekey.replace(/[^a-zA-Z0-9_\-]+/g, '_');

                    const notePath = this.getLiteratureNotePath(citekey);
                    const existingFile = this.app.vault.getAbstractFileByPath(notePath);
                    if (existingFile instanceof TFile) {
                        if (importSettings.conflictResolution === 'skip') {
                            new Notice(`Skipping existing note: ${citekey}`, 2000);
                            skipped++;
                            continue;
                        }
                    }

                    let attachmentPath = '';
                    if (importSettings.attachmentHandling === 'import') {
                        const filePaths = this.extractAttachmentPaths(cslObject, fileExt);
                        if (filePaths.length > 0) {
                            try {
                                if (useVaultAttachmentLookup) {
                                    const foundAttachmentPath = await this.findZoteroAttachmentInVault(filePaths, citekey);
                                    if (foundAttachmentPath) {
                                        attachmentPath = await this.moveAttachmentToProperLocation(foundAttachmentPath, citekey);
                                        if (attachmentPath) attachmentsImported++;
                                    }
                                }
                                if (!attachmentPath) {
                                    // console.log(`Unable to import attachments for ${citekey}. File paths: ${JSON.stringify(filePaths)}`);
                                }
                            } catch {}
                        }
                    }

                    let annotationContent = '';
                    if (importSettings.annoteToBody) {
                        annotationContent = this.extractAllAnnoteContent(cslObject, fileExt);
                    }

                    const { citation, contributors, additionalFields } = this.convertCslToFormData(cslObject, citekey);

                    // Pass attachment path to createFrontmatter
                    const frontmatter = this.createFrontmatter(citation, contributors, additionalFields, attachmentPath);

                    const templateVars = this.buildTemplateVariables(citation, contributors, attachmentPath);
                    if (annotationContent) templateVars.annote_content = annotationContent;

                    const headerContent = this.renderTemplate(this.settings.headerTemplate, templateVars);

                    let content = `---\n${frontmatter}---\n\n${headerContent}\n\n`;

                    if (annotationContent && !this.settings.headerTemplate.includes('{{annote_content}}')) {
                        const addToBody = !annotationContent.split('\n\n---\n\n').some(chunk => chunk.length > 20 && headerContent.includes(chunk.substring(0, 20)));
                        if (addToBody) content += `## Notes\n\n${annotationContent}\n\n`;
                    }

                    if (existingFile instanceof TFile && importSettings.conflictResolution === 'overwrite') {
                        await this.app.vault.modify(existingFile, content);
                        new Notice(`Overwritten existing note: ${citekey}`, 2000);
                    } else {
                        await this.app.vault.create(notePath, content);
                    }
                    created++;

                } catch (referenceError) {
                    console.error(`Error processing reference ${i + 1}:`, referenceError);
                }
            }

            new Notice(`Bulk import finished. ${created} notes created, ${skipped} skipped, ${attachmentsImported} attachments imported.`);
            return { created, skipped, attachmentsImported };

        } catch (error) {
            console.error('Error during bulk import:', error);
            throw error;
        }
    }

    async importReferences(
        filePath: string,
        importSettings: {
            attachmentHandling: 'none' | 'import';
            annoteToBody: boolean;
            citekeyPreference: 'imported' | 'generate';
            conflictResolution: 'skip' | 'overwrite';
        }
    ): Promise<{created: number, skipped: number, attachmentsImported: number}> {
        try {
            const fileExt = filePath.split('.').pop()?.toLowerCase();
            if (fileExt !== 'bib' && fileExt !== 'json') {
                throw new Error('Only .bib (BibTeX) and .json (CSL-JSON) files are supported');
            }
            let fileContent;
            try {
                fileContent = await this.app.vault.adapter.read(filePath);
                if (!fileContent) throw new Error('File is empty');
            } catch (readError) {
                throw new Error(`Failed to read file: ${readError.message}`);
            }
            const fileName = filePath.split('/').pop() || filePath;
            let references: any[] = [];
            if (fileExt === 'bib') references = this.parseBibTeXFile(fileContent);
            else references = this.parseCslJsonFile(fileContent);
            const totalReferences = references.length;
            if (totalReferences === 0) throw new Error('No valid references found in the file');
            new Notice(`Found ${totalReferences} references in ${fileName}`);
            const baseDir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
            const useVaultAttachmentLookup = true;
            let created = 0, skipped = 0, attachmentsImported = 0;
            for (let i = 0; i < references.length; i++) {
                const cslObject = references[i];
                new Notice(`Importing reference ${i + 1} of ${totalReferences}...`, 2000);
                try {
                    let citekey: string;
                    if (importSettings.citekeyPreference === 'imported' && cslObject.id) citekey = cslObject.id;
                    else citekey = this.generateCitekey(cslObject);
                    citekey = citekey.replace(/[^a-zA-Z0-9_\-]+/g, '_');
                    const notePath = this.getLiteratureNotePath(citekey);
                    const existingFile = this.app.vault.getAbstractFileByPath(notePath);
                    if (existingFile instanceof TFile && importSettings.conflictResolution === 'skip') {
                        new Notice(`Skipping existing note: ${citekey}`, 2000);
                        skipped++;
                        continue;
                    }
                    let attachmentPath = '';
                    if (importSettings.attachmentHandling === 'import') {
                        const filePaths = this.extractAttachmentPaths(cslObject, fileExt);
                        if (filePaths.length > 0) {
                            try {
                                if (useVaultAttachmentLookup) {
                                    const foundAttachmentPath = await this.findZoteroAttachmentInVault(filePaths, citekey);
                                    if (foundAttachmentPath) {
                                        attachmentPath = await this.moveAttachmentToProperLocation(foundAttachmentPath, citekey);
                                        if (attachmentPath) attachmentsImported++;
                                    }
                                }
                                if (!attachmentPath) {
                                    attachmentPath = await this.importAttachmentsFromReferences(filePaths, citekey, baseDir);
                                    if (attachmentPath) attachmentsImported++;
                                }
                            } catch {}
                        }
                    }
                    let annotationContent = '';
                    if (importSettings.annoteToBody) annotationContent = this.extractAllAnnoteContent(cslObject, fileExt);
                    const { citation, contributors, additionalFields } = this.convertCslToFormData(cslObject, citekey);
                    // Pass attachment path to createFrontmatter
                    const frontmatter = this.createFrontmatter(citation, contributors, additionalFields, attachmentPath);
                    const templateVars = this.buildTemplateVariables(citation, contributors, attachmentPath);
                    if (annotationContent) templateVars.annote_content = annotationContent;
                    const headerContent = this.renderTemplate(this.settings.headerTemplate, templateVars);
                    let content = `---\n${frontmatter}---\n\n${headerContent}\n\n`;
                    if (annotationContent && !this.settings.headerTemplate.includes('{{annote_content}}')) {
                        const addToBody = !annotationContent.split('\n\n---\n\n').some(chunk => chunk.length > 20 && headerContent.includes(chunk.substring(0, 20)));
                        if (addToBody) content += `## Notes\n\n${annotationContent}\n\n`;
                    }
                    if (existingFile instanceof TFile && importSettings.conflictResolution === 'overwrite') {
                        await this.app.vault.modify(existingFile, content);
                        new Notice(`Overwritten existing note: ${citekey}`, 2000);
                    } else {
                        await this.app.vault.create(notePath, content);
                    }
                    created++;
                } catch (referenceError) {
                    console.error(`Error processing reference ${i + 1}:`, referenceError);
                }
            }
            new Notice(`Bulk import finished. ${created} notes created, ${skipped} skipped, ${attachmentsImported} attachments imported.`);
            return { created, skipped, attachmentsImported };
        } catch (error) {
            console.error('Error during bulk import:', error);
            throw error;
        }
    }

    private createFrontmatter(
        citation: any,
        contributors: any[],
        additionalFields: any[],
        attachmentPath: string = ''
    ): string {
        try {
            const frontmatter: any = {
                id: citation.id,
                type: citation.type,
                title: citation.title,
                issued: {
                    'date-parts': [[
                        citation.year ? Number(citation.year) : undefined,
                        citation.month ? Number(citation.month) : undefined,
                        citation.day ? Number(citation.day) : undefined
                    ].filter(v => v !== undefined)],
                },
                ...(citation['title-short'] && { 'title-short': citation['title-short'] }),
                ...(citation.page && { page: citation.page }),
                ...(citation.URL && { URL: citation.URL }),
                ...(citation.DOI && { DOI: citation.DOI }),
                ...(citation['container-title'] && { 'container-title': citation['container-title'] }),
                ...(citation.publisher && { publisher: citation.publisher }),
                ...(citation['publisher-place'] && { 'publisher-place': citation['publisher-place'] }),
                ...(citation.edition && { edition: isNaN(Number(citation.edition)) ? citation.edition : Number(citation.edition) }),
                ...(citation.volume && { volume: isNaN(Number(citation.volume)) ? citation.volume : Number(citation.volume) }),
                ...(citation.number && { number: isNaN(Number(citation.number)) ? citation.number : Number(citation.number) }),
                ...(citation.language && { language: citation.language }),
                ...(citation.abstract && { abstract: citation.abstract }),
                tags: citation.tags && Array.isArray(citation.tags)
                    ? [...new Set([...citation.tags, this.settings.literatureNoteTag])]
                    : [this.settings.literatureNoteTag]
            };

            contributors.forEach(contributor => {
                if (contributor.family || contributor.given || contributor.literal) {
                    if (!frontmatter[contributor.role]) frontmatter[contributor.role] = [];
                    const { role, ...personData } = contributor;
                    frontmatter[contributor.role].push(personData);
                }
            });

            additionalFields.forEach(field => {
                if (field.name && field.value != null && field.value !== '') {
                    let valueToAdd = field.value;
                    if (field.type === 'date') {
                        if (typeof field.value === 'object' && 'date-parts' in field.value) valueToAdd = field.value;
                        else if (typeof field.value === 'string') {
                            const parts = field.value.split('-').map(Number).filter((n: number) => !isNaN(n));
                            valueToAdd = parts.length ? { 'date-parts': [parts] } : field.value;
                        }
                    } else if (field.type === 'number') {
                        const num = parseFloat(field.value as any);
                        valueToAdd = isNaN(num) ? field.value : num;
                    }
                    frontmatter[field.name] = valueToAdd;
                }
            });

            const templateVariables = this.buildTemplateVariables(citation, contributors, attachmentPath);

            if (this.settings.customFrontmatterFields) {
                const enabled = this.settings.customFrontmatterFields.filter(f => f.enabled);
                enabled.forEach(field => {
                    if (field.name === 'pdflink' && field.template === '{{pdflink}}') {
                        if (templateVariables.pdflink?.trim()) frontmatter[field.name] = templateVariables.pdflink;
                        return;
                    }
                    if (field.name === 'attachment' && field.template === '{{attachment}}') {
                        if (templateVariables.attachment?.trim()) frontmatter[field.name] = templateVariables.attachment;
                        return;
                    }
                    const isArray = field.template.trim().startsWith('[') && field.template.trim().endsWith(']');
                    const val = this.renderTemplate(field.template, templateVariables, { yamlArray: isArray });
                    if (!frontmatter.hasOwnProperty(field.name)) {
                        if ((val.startsWith('[') && val.endsWith(']')) || (val.startsWith('{') && val.endsWith('}'))) {
                            try { frontmatter[field.name] = JSON.parse(val); }
                            catch { if (isArray) frontmatter[field.name] = []; else frontmatter[field.name] = val; }
                        } else if (val.trim() === '' && isArray) {
                            frontmatter[field.name] = [];
                        } else if (!val.includes('{{pdflink}}') && !val.includes('{{attachment}}')) {
                            frontmatter[field.name] = val;
                        }
                    }
                });
            }

            return jsyaml.dump(frontmatter, { noRefs: true, sortKeys: true });
        } catch (error) {
            console.error('Error creating frontmatter:', error);
            throw error;
        }
    }    

    /**
     * Parse a BibTeX file and extract CSL-JSON objects
     */
    private parseBibTeXFile(bibtexContent: string): any[] {
        try {
            // Use the CitationService to parse BibTeX
            const CitationService = require('./citation-service').CitationService;
            const citationService = new CitationService(this.settings.citekeyOptions);
            
            // Extract individual BibTeX entries
            const entries = this.extractBibTeXEntries(bibtexContent);
            
            // Parse each entry
            return entries.map(entry => {
                try {
                    // Parse the BibTeX entry
                    const cslData = citationService.parseBibTeX(entry);
                    
                    // Manually capture the 'file' and 'annote' fields as they might not
                    // be correctly parsed by the Citation.js parser
                    const fileField = this.extractBibTeXField(entry, 'file');
                    const annoteField = this.extractBibTeXField(entry, 'annote');
                    
                    // Extract all annote fields (there might be multiple)
                    const annoteFields = this.extractAllBibTeXFields(entry, 'annote');
                    
                    // Augment the CSL data with these fields
                    if (fileField) {
                        cslData._fileField = fileField;
                    }
                    if (annoteField) {
                        cslData._annoteField = annoteField;
                    }
                    if (annoteFields && annoteFields.length > 0) {
                        cslData._annoteFields = annoteFields;
                    }
                    
                    return cslData;
                } catch (error) {
                    console.error('Error parsing BibTeX entry:', error, entry);
                    return null;
                }
            }).filter(entry => entry !== null);
        } catch (error) {
            console.error('Error parsing BibTeX file:', error);
            throw new Error(`Failed to parse BibTeX file: ${error.message}`);
        }
    }
    
    /**
     * Parse a CSL-JSON file
     */
    private parseCslJsonFile(jsonContent: string): any[] {
        try {
            const data = JSON.parse(jsonContent);
            
            // Handle both array and single object formats
            if (Array.isArray(data)) {
                return data;
            } else if (typeof data === 'object' && data !== null) {
                return [data];
            } else {
                throw new Error('Invalid CSL-JSON format');
            }
        } catch (error) {
            console.error('Error parsing CSL-JSON file:', error);
            throw new Error(`Failed to parse CSL-JSON file: ${error.message}`);
        }
    }
    
    /**
     * Extract individual BibTeX entries from a file
     */
    private extractBibTeXEntries(bibtexContent: string): string[] {
        // Match each @TYPE{...} entry in the BibTeX file
        const entryRegex = /@[A-Za-z]+\s*{[^@]*}/gs;
        const entries = bibtexContent.match(entryRegex) || [];
        return entries;
    }
    
    /**
     * Extract a specific field from a BibTeX entry
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
     */
    private extractAllBibTeXFields(entry: string, fieldName: string): string[] {
        // Match the field pattern like 'fieldName = {...}' or 'fieldName = "..."' globally
        const regex = new RegExp(`${fieldName}\\s*=\\s*(?:{((?:[^{}]|{[^{}]*})*)}|"([^"]*)")`, 'gi');
        const matches = [...entry.matchAll(regex)];
        
        // Extract all values
        return matches.map(match => match[1] || match[2] || '').filter(Boolean);
    }
    
    /**
     * Extract attachment paths from CSL data
     */
    private extractAttachmentPaths(cslObject: any, fileType: string): string[] {
        const paths: string[] = [];
        
        if (fileType === 'bib') {
            // For BibTeX, check the custom _fileField we stored
            if (cslObject._fileField) {
                // Zotero BibTeX exports use a specific format for file paths
                // Format: description:path:type; may include multiple entries separated by semicolons
                
                // First split by semicolons to handle multiple files
                const fileEntries = cslObject._fileField.split(';').map((entry: string) => entry.trim()).filter(Boolean);
                
                for (const entry of fileEntries) {
                    // Then split by colons to extract the path component
                    const parts = entry.split(':').filter(Boolean);
                    
                    // Take the middle part if we have multiple parts (should be the path)
                    if (parts.length >= 2) {
                        paths.push(parts[1]);
                    } else if (parts.length === 1) {
                        // If only one part, assume it's the path directly
                        paths.push(parts[0]);
                    }
                }
            }
            
            // Also check for any other file fields that might be present
            // Some exporters use different field names
            const alternateFileFields = ['file', 'pdf', 'attachment'];
            for (const field of alternateFileFields) {
                if (cslObject[field] && typeof cslObject[field] === 'string') {
                    paths.push(cslObject[field]);
                }
            }
        } else if (fileType === 'json') {
            // For CSL-JSON, look for attachment info in standard places
            if (cslObject.link && Array.isArray(cslObject.link)) {
                // CSL-JSON might have a link array
                for (const link of cslObject.link) {
                    if (link.url && typeof link.url === 'string') {
                        // Filter to local file paths (not URLs)
                        if (!link.url.startsWith('http')) {
                            paths.push(link.url);
                        }
                    }
                }
            }
            
            // Some CSL-JSON exporters might include a 'file' or 'attachment' field
            if (cslObject.file) {
                if (Array.isArray(cslObject.file)) {
                    paths.push(...cslObject.file.filter((f: any) => typeof f === 'string'));
                } else if (typeof cslObject.file === 'string') {
                    paths.push(cslObject.file);
                }
            }
        }
        
        // Normalize and clean up paths
        return paths
            .map(p => p.replace(/^["']|["']$/g, '')) // Remove quotes
            .map(p => p.replace(/\\:/g, ':'))        // Handle escaped colons
            .filter(Boolean);                        // Remove empty paths
    }
    
    /**
     * Extract annote content from CSL data
     */
    private extractAnnoteContent(cslObject: any, fileType: string): string {
        if (fileType === 'bib' && cslObject._annoteField) {
            return cslObject._annoteField.trim();
        }
        
        // CSL-JSON might store notes in different places
        if (cslObject.note) {
            return cslObject.note.trim();
        }
        
        // Check the 'annote' field directly (non-standard but sometimes used)
        if (cslObject.annote) {
            return cslObject.annote.trim();
        }
        
        return '';
    }
    
    /**
     * Extract all annote content from CSL data, combining multiple annotations if present
     */
    private extractAllAnnoteContent(cslObject: any, fileType: string): string {
        // Use a Map to normalize and deduplicate annotations - key is normalized content, value is original content
        const uniqueAnnotations = new Map<string, string>();
        
        // Function to normalize annotation text for comparison (lowercase, remove extra whitespace)
        const normalizeForComparison = (text: string): string => {
            return text.toLowerCase().replace(/\s+/g, ' ').trim();
        };
        
        // Function to add annotation to the set if it's not a duplicate
        const addAnnotation = (text: string) => {
            if (!text || text.trim() === '') return;
            
            const originalText = text.trim();
            const normalizedText = normalizeForComparison(originalText);
            
            // Only add if we don't already have a version of this annotation
            if (!uniqueAnnotations.has(normalizedText)) {
                uniqueAnnotations.set(normalizedText, originalText);
            }
        };
        
        // Extract from _annoteField (could be an array in some BibTeX exporters)
        if (fileType === 'bib' && cslObject._annoteField) {
            if (Array.isArray(cslObject._annoteField)) {
                cslObject._annoteField.forEach(addAnnotation);
            } else {
                addAnnotation(cslObject._annoteField);
            }
        }
        
        // Extract from _annoteFields array if it exists (multiple annotations)
        if (fileType === 'bib' && cslObject._annoteFields && Array.isArray(cslObject._annoteFields)) {
            cslObject._annoteFields.forEach(addAnnotation);
        }
        
        // CSL-JSON might store notes in different places
        if (cslObject.note) {
            if (Array.isArray(cslObject.note)) {
                cslObject.note.forEach(addAnnotation);
            } else {
                addAnnotation(cslObject.note);
            }
        }
        
        // Check the 'annote' field directly (non-standard but sometimes used)
        if (cslObject.annote) {
            if (Array.isArray(cslObject.annote)) {
                cslObject.annote.forEach(addAnnotation);
            } else {
                addAnnotation(cslObject.annote);
            }
        }
        
        // Convert the Map values (original content) back to an array and join with separator
        const annotations = Array.from(uniqueAnnotations.values());
        return annotations.join('\n\n---\n\n');
    }
    
    /**
     * Generate a citekey based on citation data and plugin settings
     */
    private generateCitekey(cslObject: any): string {
        const CitekeyGenerator = require('../utils/citekey-generator').CitekeyGenerator;
        return CitekeyGenerator.generate(cslObject, this.settings.citekeyOptions);
    }
    
    /**
     * Convert CSL object to the format expected by createLiteratureNote
     */
    private convertCslToFormData(cslObject: any, citekey: string): { 
        citation: any; 
        contributors: any[]; 
        additionalFields: any[];
    } {
        // Basic citation fields
        const citation = {
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
        const contributors = this.extractContributors(cslObject);
        
        // Extract additional fields (anything not already in citation)
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
        
        const additionalFields = Object.entries(cslObject)
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
        
        return { citation, contributors, additionalFields };
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
    private extractContributors(cslObject: any): any[] {
        const contributors: any[] = [];
        
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
    
    // Note: The createFrontmatter implementation is defined elsewhere in this file
    // and includes attachmentPath as a parameter

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
                            const dateParts = field.value.split('-').map(Number).filter((part: number) => !isNaN(part));
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
                    // Special case handling for certain field names
                    if (field.name === 'pdflink' && field.template === '{{pdflink}}') {
                        // Direct passthrough of raw pdflink from variables
                        if (templateVariables.pdflink && templateVariables.pdflink.trim()) {
                            frontmatter[field.name] = templateVariables.pdflink;
                        }
                        return;
                    }

                    if (field.name === 'attachment' && field.template === '{{attachment}}') {
                        // Direct passthrough of attachment from variables
                        if (templateVariables.attachment && templateVariables.attachment.trim()) {
                            frontmatter[field.name] = templateVariables.attachment;
                        }
                        return;
                    }
                    
                    // Determine if this looks like an array/object template
                    const isArrayTemplate = field.template.trim().startsWith('[') && field.template.trim().endsWith(']');
                    const isObjectTemplate = field.template.trim().startsWith('{') && field.template.trim().endsWith('}');
                    
                    // Render the template with appropriate options
                    const fieldValue = this.renderTemplate(
                        field.template, 
                        templateVariables, 
                        { yamlArray: isArrayTemplate }
                    );
                    
                    // Add to frontmatter if the field name is not already used
                    if (!frontmatter.hasOwnProperty(field.name)) {
                        // Handle different types of values
                        if ((fieldValue.startsWith('[') && fieldValue.endsWith(']')) || 
                            (fieldValue.startsWith('{') && fieldValue.endsWith('}'))) {
                            try {
                                // Parse as JSON for arrays and objects
                                const parsedValue = JSON.parse(fieldValue);
                                frontmatter[field.name] = parsedValue;
                            } catch (e) {
                                // Special handling for array templates that should be empty arrays
                                if (isArrayTemplate && (fieldValue.trim() === '[]' || fieldValue.trim() === '[ ]')) {
                                    frontmatter[field.name] = [];
                                } else {
                                    // Handle array template containing a link to pdflink
                                    if (isArrayTemplate && 
                                        (fieldValue.includes('{{pdflink}}') || fieldValue.includes('{{attachment}}')) && 
                                        templateVariables.pdflink) {
                                        
                                        // Create array with attachment link manually
                                        frontmatter[field.name] = templateVariables.pdflink ? 
                                            [templateVariables.attachment] : [];
                                    } else {
                                        // Use as string if JSON parsing fails and no special case
                                        frontmatter[field.name] = fieldValue;
                                    }
                                }
                            }
                        } else if (fieldValue.trim() === '') {
                            // For truly empty values, don't add the field at all
                            // But, ensure we add empty arrays for array templates
                            if (isArrayTemplate) {
                                frontmatter[field.name] = [];
                            }
                        } else {
                            // If the field value contains pdflink/attachment variable references that didn't render
                            if (fieldValue.includes('{{pdflink}}') || fieldValue.includes('{{attachment}}')) {
                                // Don't add the field if the template wasn't properly rendered
                                // This indicates the attachment variable wasn't available
                            } else {
                                // Use as string for non-array/object values
                                frontmatter[field.name] = fieldValue;
                            }
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
            
            // Add all citation fields directly (for access to any field)
            ...citation,
            
            // Add contributor lists by role
            ...this.buildContributorLists(contributors),
            
            // Override with explicit versions of common fields for clarity
            // These ensure consistent access even if the citation object structure changes
            citekey: citation.id || '',
        };
        
        // Handle attachment paths without conditionals
        // IMPORTANT: We always set these, even if empty, to ensure templates work
        if (attachmentPath && attachmentPath.trim()) {
            variables.pdflink = attachmentPath;
            
            // Create attachment link format based on file type
            if (attachmentPath.endsWith('.pdf')) {
                variables.attachment = `[[${attachmentPath}|PDF]]`;
            } else if (attachmentPath.endsWith('.epub')) {
                variables.attachment = `[[${attachmentPath}|EPUB]]`;
            } else {
                variables.attachment = `[[${attachmentPath}|attachment]]`;
            }
            
            // Also provide just the raw path without Obsidian link formatting
            variables.raw_pdflink = attachmentPath;
            
            // For use in frontmatter arrays, prepare a properly quoted version 
            variables.quoted_attachment = `"${variables.attachment}"`;
        } else {
            // Set empty values to ensure templates can reference these keys
            variables.pdflink = '';
            variables.attachment = '';
            variables.raw_pdflink = '';
            variables.quoted_attachment = '';
        }
        
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

    /**
     * Find Zotero attachments in the vault based on typical export structures
     * @param filePaths Array of file paths from BibTeX entry
     * @param citekey The citekey for the reference
     * @returns Path to the found attachment in the vault or empty string if not found
     */
    private async findZoteroAttachmentInVault(filePaths: string[], citekey: string): Promise<string> {
        if (!filePaths.length) return '';
        
        // Get all files in the vault
        const files = this.app.vault.getFiles();
        // console.log(`Total files in vault: ${files.length}`);
        
        // First, extract all potential filenames from the paths
        const potentialFilenames = filePaths.map(path => {
            const parts = path.split('/');
            return parts[parts.length - 1]; // Get the last part (the filename)
        }).filter(Boolean);
        
        // console.log(`Potential attachment filenames: ${JSON.stringify(potentialFilenames)}`);
        
        // Look for exact filename matches in the vault
        for (const filename of potentialFilenames) {
            const matches = files.filter(file => file.name === filename);
            if (matches.length > 0) {
                // Found an exact match
                // console.log(`Found exact filename match for ${filename}: ${matches[0].path}`);
                return matches[0].path;
            }
        }
        
        // No exact matches found - look for characteristic Zotero export structure
        // Typical structure: files/ID/filename.pdf
        
        // Extract potential IDs from the file paths
        const potentialIDs = new Set<string>();
        for (const path of filePaths) {
            // Extract ID from patterns like "files/12345/filename.pdf" or "attachments/12345/filename.pdf"
            const match = path.match(/(?:files|attachments)\/([^\/]+)\//);
            if (match && match[1]) {
                potentialIDs.add(match[1]);
            }
        }
        
        // console.log(`Potential Zotero IDs: ${JSON.stringify([...potentialIDs])}`);
        
        // Look for files in standard Zotero export structure: files/ID/filename.ext
        for (const id of potentialIDs) {
            // Common folder names for Zotero exports
            const folderPatterns = ['files', 'attachments', 'storage', id];
            
            for (const file of files) {
                // Check if the file's path contains both an ID folder and one of the common parent folders
                const containsID = file.path.includes(`/${id}/`);
                const containsFolder = folderPatterns.some(pattern => file.path.toLowerCase().includes(`/${pattern.toLowerCase()}/`));
                
                if (containsID || (containsFolder && potentialFilenames.some(name => file.name.includes(name)))) {
                    // console.log(`Found potential Zotero attachment match: ${file.path}`);
                    return file.path;
                }
            }
        }
        
        // Look for files in standard Zotero folder structure
        const zoteroFolderMatches = files.filter(file => {
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
        
        // Final fallback: look for PDFs with similar filenames anywhere in the vault
        // This is more aggressive matching but may help in cases where files were manually imported
        const fuzzyMatches = files.filter(file => {
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
        return '';
    }
    
    /**
     * Move an attachment file to the user-specified attachment location and rename it with the citekey
     * @param sourcePath The current path of the attachment file in the vault
     * @param citekey The citekey to use for the new filename
     * @returns The new path of the attachment after moving, or empty string if move failed
     */
    private async moveAttachmentToProperLocation(sourcePath: string, citekey: string): Promise<string> {
        try {
            // Get the source file
            const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
            if (!(sourceFile instanceof TFile)) {
                console.error(`Source file not found or not a file: ${sourcePath}`);
                return '';
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
                return ''; // Cannot proceed without folder
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
                    return ''; // Cannot proceed without subfolder
                }
            }
            
            // Use citekey as the new filename
            const newFilename = `${citekey}.${fileExt}`;
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
            
            // Optionally delete the source file (commented out for safety - only uncomment if this is desired behavior)
            // await this.app.vault.delete(sourceFile);
            
            new Notice(`Moved attachment to ${targetPath}`);
            return targetPath;
            
        } catch (error) {
            console.error(`Error moving attachment to proper location: ${error}`);
            new Notice(`Error organizing attachment: ${error.message}`);
            return '';
        }
    }

    /**
     * Import attachments referenced in the BibTeX entry
     * @param filePaths Array of file paths from BibTeX entry
     * @param citekey The citekey for the reference
     * @param baseDir The base directory where the BibTeX file is located
     * @returns Path to the imported attachment or empty string if import failed
     */
    private async importAttachmentsFromReferences(filePaths: string[], citekey: string, baseDir: string): Promise<string> {
        if (!filePaths.length || !baseDir) {
            return '';
        }
        
        // Sort attachments by preference (PDFs first, then other formats)
        const sortedPaths = [...filePaths].sort((a, b) => {
            const aExt = a.split('.').pop()?.toLowerCase() || '';
            const bExt = b.split('.').pop()?.toLowerCase() || '';
            
            // Prefer PDFs
            if (aExt === 'pdf' && bExt !== 'pdf') return -1;
            if (bExt === 'pdf' && aExt !== 'pdf') return 1;
            return 0;
        });
        
        // Try each file path
        for (const filePath of sortedPaths) {
            try {
                const fileName = filePath.split('/').pop();
                if (!fileName) continue;
                
                // Build the full path relative to the BibTeX file
                const fullPath = normalizePath(`${baseDir}${filePath}`);
                
                // Check if file exists
                try {
                    // Read the file as binary data using the adapter API
                    const fileData = await this.app.vault.adapter.readBinary(fullPath);
                    
                    // Create a File object for import
                    const file = new File([fileData], fileName);
                    
                    // Create an attachment data object
                    const attachmentData = {
                        type: AttachmentType.IMPORT,
                        file,
                        filename: fileName
                    };
                    
                    // Handle the attachment (this will import it to the vault)
                    const initialPath = await this.handleAttachment(citekey, attachmentData);
                    if (initialPath) {
                        // Then move it to the proper location and rename with citekey
                        const finalPath = await this.moveAttachmentToProperLocation(initialPath, citekey);
                        if (finalPath) {
                            new Notice(`Imported and organized attachment: ${citekey}.${fileName.split('.').pop()}`, 2000);
                            return finalPath;
                        }
                        return initialPath; // Return initial path if move failed
                    }
                } catch (readError) {
                    // console.log(`Referenced attachment not found or could not be read at: ${fullPath}`, readError);
                }
            } catch (error) {
                console.error(`Error importing attachment: ${filePath}`, error);
            }
        }
        
        // If we get here, no attachments were successfully imported
        if (filePaths.length > 0) {
            new Notice(`Could not import referenced attachments. Check paths in BibTeX file and verify files exist.`, 3000);
        }
        
        return '';
    }
}
