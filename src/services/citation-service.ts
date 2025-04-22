import Cite from 'citation-js';
import '@citation-js/plugin-bibtex';
// Note: The @citation-js/plugin-zotero module might not be available
// We're handling Zotero data with our custom mapping as a fallback
import { CitoidService } from './api/citoid';
import { Notice } from 'obsidian';
import { CitekeyGenerator } from '../utils/citekey-generator';

/**
 * Service to fetch and normalize citation data via Citation.js
 * Tries JSON via Citoid, parses; falls back to BibTeX via Citoid if needed.
 */
export class CitationService {
    private citoid: CitoidService;
    private citekeyOptions: any;

    constructor(citekeyOptions?: any) {
        // Use default CitoidService (fixed BibTeX endpoint)
        this.citoid = new CitoidService();
        // Use provided citekey options or default
        this.citekeyOptions = citekeyOptions || CitekeyGenerator.defaultOptions;
    }

    /**
     * Fetch normalized CSL-JSON for an identifier
     * @param id DOI, URL, or ISBN
     */
    async fetchNormalized(id: string): Promise<any> {
        // Fetch BibTeX from Citoid, parse via Citation.js, and output true CSL-JSON (hyphen-case keys)
        try {
            const bibtex = await this.citoid.fetchBibTeX(id);
            const cite = new Cite(bibtex);
            // Get hyphen-case CSL-JSON as a string (style "csl" yields CSL-JSON data)
            const jsonString = cite.get({
                style: 'csl',
                type: 'string',
            });
            const data = JSON.parse(jsonString);
            // Citoid returns a single entry
            const entry = Array.isArray(data) ? data[0] : data;
            
            // If the entry has no ID or we don't want to use external IDs, generate a citekey
            if (!entry.id || !this.citekeyOptions.useZoteroKeys) {
                entry.id = CitekeyGenerator.generate(entry, this.citekeyOptions);
            }
            
            return entry;
        } catch (e) {
            console.error('Error fetching/parsing BibTeX from Citoid:', e);
            new Notice('Error fetching citation data. Please check the identifier and try again.');
            throw e;
        }
    }
    
    /**
     * Parse BibTeX string directly using Citation.js
     * @param bibtex Raw BibTeX string
     */
    parseBibTeX(bibtex: string): any {
        try {
            const cite = new Cite(bibtex);
            // Get hyphen-case CSL-JSON as a string
            const jsonString = cite.get({
                style: 'csl',
                type: 'string',
            });
            const data = JSON.parse(jsonString);
            // Get the first entry if it's an array
            const entry = Array.isArray(data) ? data[0] : data;
            
            // If the entry has no ID or we don't want to use Zotero keys, generate a citekey
            if (!entry.id || !this.citekeyOptions.useZoteroKeys) {
                entry.id = CitekeyGenerator.generate(entry, this.citekeyOptions);
            }
            
            return entry;
        } catch (e) {
            console.error('Error parsing BibTeX:', e);
            new Notice('Error parsing BibTeX. Please check the format and try again.');
            throw e;
        }
    }
    
    /**
     * Parse Zotero JSON data using Citation.js
     * @param zoteroData Zotero JSON data
     */
    parseZoteroItem(zoteroData: any): any {
        // Use direct mapping approach first - most reliable for Zotero data
        try {
            // Map the data directly to CSL format using our custom mapper
            const mappedData = this.mapZoteroToCsl(zoteroData);
            return mappedData;
        } catch (directMapError) {
            console.error('Error in direct mapping of Zotero data:', directMapError);
            
            // Fallback options if direct mapping fails
            try {
                // Try to parse the data with Citation.js
                const cite = new Cite([zoteroData]);
                const jsonString = cite.get({
                    style: 'csl',
                    type: 'string',
                });
                
                const data = JSON.parse(jsonString);
                const result = Array.isArray(data) ? data[0] : data;
                
                // Even if Citation.js parses it, we need to ensure critical fields are present
                // Let's augment the result with any missing fields from our custom mapper
                try {
                    const mappedBackup = this.mapZoteroToCsl(zoteroData);
                    // Merge the fields, prioritizing Citation.js output but filling gaps
                    const augmentedResult = {
                        ...mappedBackup,  // Base layer with all our mapped fields
                        ...result,        // Overlay with Citation.js fields
                        // Make sure critical fields exist
                        author: result.author || mappedBackup.author,
                        type: result.type || mappedBackup.type,
                        issued: result.issued || mappedBackup.issued,
                        abstract: result.abstract || mappedBackup.abstract
                    };
                    
                    return augmentedResult;
                } catch (augmentError) {
                    return result; // Return the Citation.js result anyway
                }
            } catch (citeError) {
                console.error('All parsing methods failed:', citeError);
                new Notice('Error processing citation data from Zotero. Falling back to manual entry.');
                throw citeError;
            }
        }
    }
    
    /**
     * Map Zotero item data to CSL-JSON format
     * This is a fallback if Citation.js can't directly parse Zotero format
     * @param item Zotero item data
     */
    private mapZoteroToCsl(item: any): any {
        // Basic CSL structure
        const csl: any = {
            // Use item.key (Zotero key) only if useZoteroKeys is true in settings
            id: (item.key && this.citekeyOptions.useZoteroKeys) ? item.key : this.generateCiteKey(item),
            type: this.mapItemType(item.itemType),
        };
        
        // Map title
        if (item.title) csl.title = item.title;
        
        // Map authors/creators
        if (item.creators && Array.isArray(item.creators)) {
            // Process each creator type separately
            // Zotero uses creatorType (author, editor, etc.) while CSL uses role (author, editor, etc.)
            
            // Create a map of all creator types to their CSL roles
            const creatorTypeMap: {[key: string]: string} = {
                'author': 'author',
                'editor': 'editor',
                'translator': 'translator',
                'contributor': 'contributor',
                'bookAuthor': 'container-author',
                'seriesEditor': 'collection-editor',
                'composer': 'composer',
                'director': 'director',
                'interviewer': 'interviewer',
                'illustrator': 'illustrator',
                'originalAuthor': 'original-author',
                'recipient': 'recipient',
                'reviewedAuthor': 'reviewed-author'
                // Add more mappings as needed
            };
            
            // Group creators by role
            const creatorsByRole: {[key: string]: any[]} = {};
            
            item.creators.forEach((creator: any) => {
                const role = creatorTypeMap[creator.creatorType] || creator.creatorType || 'author';
                
                if (!creatorsByRole[role]) {
                    creatorsByRole[role] = [];
                }
                
                // Map Zotero creator format to CSL format
                const cslCreator: any = {
                    given: creator.firstName,
                    family: creator.lastName
                };
                
                // Handle name field (some Zotero creators might use a single name field)
                if (creator.name && (!creator.firstName && !creator.lastName)) {
                    // Try to split the name if it contains a comma
                    if (creator.name.includes(',')) {
                        const [family, given] = creator.name.split(',').map((part: string) => part.trim());
                        cslCreator.family = family;
                        cslCreator.given = given;
                    } else {
                        cslCreator.literal = creator.name;
                    }
                }
                
                creatorsByRole[role].push(cslCreator);
            });
            
            // Add each role's creators to the CSL data
            Object.entries(creatorsByRole).forEach(([role, creators]) => {
                if (creators.length > 0) {
                    csl[role] = creators;
                }
            });
        }
        
        // Map date/year
        if (item.date) {
            try {
                // Handle different date formats
                let year: number | undefined;
                let month: number | undefined;
                let day: number | undefined;
                
                // Try to parse as ISO date first
                const date = new Date(item.date);
                if (!isNaN(date.getTime())) {
                    year = date.getFullYear();
                    month = date.getMonth() + 1; // JavaScript months are 0-indexed
                    day = date.getDate();
                } else {
                    // Try to parse as YYYY-MM-DD or YYYY/MM/DD
                    const dateMatch = item.date.match(/(\d{4})[\/\-]?(\d{1,2})?[\/\-]?(\d{1,2})?/);
                    if (dateMatch) {
                        year = parseInt(dateMatch[1]);
                        if (dateMatch[2]) month = parseInt(dateMatch[2]);
                        if (dateMatch[3]) day = parseInt(dateMatch[3]);
                    } else {
                        // Try to parse just a year
                        const yearMatch = item.date.match(/(\d{4})/);
                        if (yearMatch) {
                            year = parseInt(yearMatch[1]);
                        }
                    }
                }
                
                // Build date-parts array with available components
                if (year) {
                    const dateParts = [year];
                    if (month) dateParts.push(month);
                    if (day) dateParts.push(day);
                    
                    csl.issued = {
                        'date-parts': [dateParts]
                    };
                    csl.year = year.toString();
                }
            } catch (e) {
                console.error('Error parsing date:', e);
            }
        } else if (item.year) {
            // Use year field if available and no date field
            const year = parseInt(item.year);
            if (!isNaN(year)) {
                csl.issued = {
                    'date-parts': [[year]]
                };
                csl.year = year.toString();
            }
        }
        
        // Map other common fields - handle both camelCase and hyphen-case
        // DOI
        if (item.DOI) csl.DOI = item.DOI;
        else if (item.doi) csl.DOI = item.doi;
        
        // URL
        if (item.URL) csl.URL = item.URL;
        else if (item.url) csl.URL = item.url;
        
        // Publisher
        if (item.publisher) csl.publisher = item.publisher;
        
        // Publisher place
        if (item['publisher-place']) csl['publisher-place'] = item['publisher-place'];
        else if (item.publisherPlace) csl['publisher-place'] = item.publisherPlace;
        else if (item.place) csl['publisher-place'] = item.place;
        
        // Container title (journal, book title, etc.)
        if (item['container-title']) csl['container-title'] = item['container-title'];
        else if (item.containerTitle) csl['container-title'] = item.containerTitle;
        else if (item.publicationTitle) csl['container-title'] = item.publicationTitle;
        else if (item.journalTitle) csl['container-title'] = item.journalTitle;
        else if (item.bookTitle) csl['container-title'] = item.bookTitle;
        
        // Short title
        if (item['title-short']) csl['title-short'] = item['title-short'];
        else if (item.titleShort) csl['title-short'] = item.titleShort;
        else if (item.shortTitle) csl['title-short'] = item.shortTitle;
        
        // Volume
        if (item.volume) csl.volume = item.volume;
        
        // Issue/number
        if (item.number) csl.number = item.number;
        else if (item.issue) csl.number = item.issue;
        
        // Pages
        if (item.page) csl.page = item.page;
        else if (item.pages) csl.page = item.pages;
        
        // Language
        if (item.language) csl.language = item.language;
        
        // Abstract
        if (item.abstract) csl.abstract = item.abstract;
        else if (item.abstractNote) csl.abstract = item.abstractNote;
        
        // Edition
        if (item.edition) csl.edition = item.edition;
        
        // ISBN
        if (item.ISBN) csl.ISBN = item.ISBN;
        else if (item.isbn) csl.ISBN = item.isbn;
        
        // ISSN
        if (item.ISSN) csl.ISSN = item.ISSN;
        else if (item.issn) csl.ISSN = item.issn;
        
        return csl;
    }
    
    /**
     * Map Zotero item type to CSL type
     */
    private mapItemType(itemType: string): string {
        const typeMap: {[key: string]: string} = {
            // Journal articles
            'journalArticle': 'article-journal',
            'article-journal': 'article-journal',
            
            // Magazine articles
            'magazineArticle': 'article-magazine',
            'article-magazine': 'article-magazine',
            
            // Newspaper articles
            'newspaperArticle': 'article-newspaper',
            'article-newspaper': 'article-newspaper',
            
            // Books
            'book': 'book',
            
            // Book sections
            'bookSection': 'chapter',
            'chapter': 'chapter',
            'entry': 'entry',
            'entry-dictionary': 'entry-dictionary',
            'entry-encyclopedia': 'entry-encyclopedia',
            'dictionaryEntry': 'entry-dictionary',
            'encyclopediaEntry': 'entry-encyclopedia',
            
            // Academic items
            'thesis': 'thesis',
            'dissertation': 'thesis',
            'conferencePaper': 'paper-conference',
            'paper-conference': 'paper-conference',
            'preprint': 'article',  // Map preprints to article type in CSL
            'manuscript': 'manuscript',
            
            // Web items
            'webpage': 'webpage',
            'blogPost': 'post-weblog',
            'post-weblog': 'post-weblog',
            'forumPost': 'post',
            'post': 'post',
            
            // Reports
            'report': 'report',
            'techreport': 'report',
            
            // Legal items
            'case': 'legal_case',
            'legal_case': 'legal_case',
            'legislation': 'legislation',
            'statute': 'legislation',
            'bill': 'bill',
            'hearing': 'hearing',
            'patent': 'patent',
            'treaty': 'treaty',
            
            // Media
            'film': 'motion_picture',
            'motion_picture': 'motion_picture',
            'videoRecording': 'motion_picture',
            'audio': 'song',
            'song': 'song',
            'podcast': 'song',
            'audioRecording': 'song',
            'tvBroadcast': 'broadcast',
            'radioBroadcast': 'broadcast',
            'broadcast': 'broadcast',
            
            // Other types
            'letter': 'personal_communication',
            'personal_communication': 'personal_communication',
            'interview': 'interview',
            'artwork': 'graphic',
            'graphic': 'graphic',
            'map': 'map',
            'document': 'document',
            'software': 'software',
            'standard': 'standard'
        };
        
        // Default to 'document' if the type is not recognized
        return typeMap[itemType] || 'document';
    }
    
    /**
     * Generate a basic cite key from Zotero data
     */
    private generateCiteKey(item: any): string {
        // Use the enhanced CitekeyGenerator class with our options
        return CitekeyGenerator.generate(item, this.citekeyOptions);
    }
}