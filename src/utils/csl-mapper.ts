/**
 * Utilities for mapping and normalizing citation data to CSL format
 */
export class CslMapper {
    /**
     * Normalize citation data from various sources (Citoid, Zotero) to CSL format
     * @param citationData Raw citation data from API
     * @returns Normalized citation data in CSL format
     */
    static normalizeToCslFormat(citationData: any): any {
        // Create a deep copy to avoid modifying the original data
        const normalized = JSON.parse(JSON.stringify(citationData));
        
        // Map of non-CSL fields to their CSL equivalents
        const fieldMappings: {[key: string]: string} = {
            'itemType': 'type',
            'journalAbbreviation': 'container-title-short',
            'shortTitle': 'title-short',
            'publicationTitle': 'container-title',
            'bookTitle': 'container-title',
            'conferenceName': 'event',
            'proceedingsTitle': 'container-title',
            'encyclopediaTitle': 'container-title',
            'dictionaryTitle': 'container-title',
            'websiteTitle': 'container-title',
            'reportNumber': 'number',
            'billNumber': 'number',
            'seriesNumber': 'number',
            'patentNumber': 'number',
            'numPages': 'number-of-pages',
            'numberOfVolumes': 'number-of-volumes',
            'isbn': 'ISBN',
            'issn': 'ISSN',
            'date': 'issued',
            'accessDate': 'accessed',
            'dateDecided': 'issued',
            'dateEnacted': 'issued',
            'pages': 'page',
            'firstPage': 'page-first',
            'place': 'publisher-place',
            'archive_location': 'archive-location',
            'event_place': 'event-place',
            'publisher_place': 'publisher-place',
            'abstractNote': 'abstract'
        };
        
        // Map non-CSL fields to their CSL equivalents
        Object.keys(fieldMappings).forEach(key => {
            if (normalized[key] !== undefined) {
                const cslKey = fieldMappings[key];
                // Only set if the target field doesn't already exist
                if (normalized[cslKey] === undefined) {
                    normalized[cslKey] = normalized[key];
                }
            }
        });
        
        // Handle Zotero itemType -> CSL type mapping
        if (normalized.itemType && !normalized.type) {
            normalized.type = this.mapZoteroType(normalized.itemType);
        }
        
        // Handle author field in MediaWiki format (array of [firstName, lastName] arrays)
        if (normalized.author && Array.isArray(normalized.author)) {
            // Check if the first element is an array (MediaWiki format)
            if (normalized.author.length > 0 && Array.isArray(normalized.author[0])) {
                console.log('Converting MediaWiki author format to CSL format');
                
                // Convert MediaWiki format to CSL format
        normalized.author = normalized.author.map((nameArray: any[]) => {
                    if (nameArray.length >= 2) {
                        return {
                            given: nameArray[0], // First element is the given name
                            family: nameArray[1]  // Second element is the family name
                        };
                    } else if (nameArray.length === 1) {
                        // If only one name component, treat as family name
                        return {
                            family: nameArray[0]
                        };
                    }
          return null; // Explicitly return null for invalid cases
                }).filter((name: any): name is { family: string; given?: string } => name !== null);
                
                console.log('Converted authors:', normalized.author);
            }
        }
        
        // Handle creators/contributors fields and convert to CSL format
        if (normalized.creators && Array.isArray(normalized.creators)) {
            // Process creators by type
            const creatorsByType = this.processCreators(normalized.creators);
            
            // Add to normalized data
            Object.keys(creatorsByType).forEach(role => {
                normalized[role] = creatorsByType[role];
            });
            
            // Remove the original creators array
            delete normalized.creators;
        }
        
        // Handle dates in Zotero format (YYYY-MM-DD) and convert to CSL format
        ['date', 'accessDate', 'dateDecided', 'dateEnacted'].forEach(dateField => {
            if (normalized[dateField] && typeof normalized[dateField] === 'string') {
                const dateParts = normalized[dateField].split('-').map(Number);
                const cslField = fieldMappings[dateField] || dateField;
                
                // Convert to CSL date format
                normalized[cslField] = {
          'date-parts': [dateParts.filter((part: number): part is number => !isNaN(part))]
                };
                
                // Remove the original date field
                if (dateField !== cslField) {
                    delete normalized[dateField];
                }
            }
        });
        
        // Handle tags and add as keywords
        if (normalized.tags && Array.isArray(normalized.tags) && normalized.tags.length > 0) {
            // Extract tag values
            const tags = normalized.tags
        .filter((tag: any): tag is {tag: string} | string => tag && (typeof tag === 'object' ? 'tag' in tag : typeof tag === 'string'))
        .map((tag: {tag: string} | string): string => typeof tag === 'string' ? tag : tag.tag);
            
            if (tags.length > 0) {
                // Join tags into a keyword string (CSL uses a single 'keyword' field)
                if (!normalized.keyword) {
                    normalized.keyword = tags.join(', ');
                }
                
                // Also add as separate 'tags' field for non-CSL usage
                normalized.tags = tags;
            }
        }
        
        // Handle ISBN, convert to string if it's an array
        if (normalized.ISBN && Array.isArray(normalized.ISBN) && normalized.ISBN.length > 0) {
            normalized.ISBN = normalized.ISBN[0];
        }
        
        // Handle ISSN, convert to string if it's an array
        if (normalized.ISSN && Array.isArray(normalized.ISSN) && normalized.ISSN.length > 0) {
            normalized.ISSN = normalized.ISSN[0];
        }
        
        // Convert numPages to number-of-pages if not already set
        if (normalized.numPages && !normalized['number-of-pages']) {
            normalized['number-of-pages'] = parseInt(normalized.numPages, 10) || normalized.numPages;
            delete normalized.numPages;
        }
        
        return normalized;
    }
    
    /**
     * Map Zotero item types to CSL types
     */
    static mapZoteroType(zoteroType: string): string {
        const typeMap: {[key: string]: string} = {
            'journalArticle': 'article-journal',
            'magazineArticle': 'article-magazine',
            'newspaperArticle': 'article-newspaper',
            'book': 'book',
            'bookSection': 'chapter',
            'thesis': 'thesis',
            'manuscript': 'manuscript',
            'letter': 'personal_communication',
            'interview': 'interview',
            'film': 'motion_picture',
            'artwork': 'graphic',
            'webpage': 'webpage',
            'report': 'report',
            'bill': 'bill',
            'case': 'legal_case',
            'hearing': 'hearing',
            'patent': 'patent',
            'statute': 'legislation',
            'email': 'personal_communication',
            'map': 'map',
            'blogPost': 'post-weblog',
            'instantMessage': 'personal_communication',
            'forumPost': 'post',
            'audioRecording': 'song',
            'presentation': 'speech',
            'videoRecording': 'motion_picture',
            'tvBroadcast': 'broadcast',
            'radioBroadcast': 'broadcast',
            'podcast': 'song',
            'computerProgram': 'software',
            'conferencePaper': 'paper-conference',
            'document': 'article',
            'encyclopediaArticle': 'entry-encyclopedia',
            'dictionaryEntry': 'entry-dictionary'
        };
        
        return typeMap[zoteroType] || 'article';
    }
    
    /**
     * Process creator array into CSL-compatible format
     * @param creators Array of creators from Zotero
     * @returns Object with creators organized by role
     */
    static processCreators(creators: any[]): any {
        const result: {[key: string]: any[]} = {};
        
        creators.forEach(creator => {
            // Map Zotero creator types to CSL roles
            const roleMap: {[key: string]: string} = {
                'author': 'author',
                'editor': 'editor',
                'bookAuthor': 'container-author',
                'composer': 'composer',
                'director': 'director',
                'interviewer': 'interviewer',
                'recipient': 'recipient',
                'reviewedAuthor': 'reviewed-author',
                'seriesEditor': 'collection-editor',
                'translator': 'translator'
            };
            
            let role = creator.creatorType || 'author';
            role = roleMap[role] || role;
            
            if (!result[role]) {
                result[role] = [];
            }
            
            // Handle different name formats
            let person = {};
            if (creator.firstName && creator.lastName) {
                person = {
                    given: creator.firstName,
                    family: creator.lastName
                };
            } else if (creator.given && creator.family) {
                person = {
                    given: creator.given,
                    family: creator.family
                };
            } else if (creator.name) {
                // For corporation/institutional authors
                person = { literal: creator.name };
            }
            
            result[role].push(person);
        });
        
        return result;
    }
    
    /**
     * Map Citoid type to CSL type
     */
    static mapCitoidType(citoidType: string): string {
        // Convert to lowercase for consistency
        const type = citoidType.toLowerCase();
        
        // Direct mappings for common types
        const typeMap: {[key: string]: string} = {
            'article-journal': 'article-journal',
            'article-magazine': 'article-magazine',
            'article-newspaper': 'article-newspaper',
            'book': 'book',
            'chapter': 'chapter',
            'webpage': 'webpage',
            'paper-conference': 'paper-conference',
            'thesis': 'thesis',
            'report': 'report'
        };
        
        // Return mapped type or fallback to original
        return typeMap[type] || type;
    }
}