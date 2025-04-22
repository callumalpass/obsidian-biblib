/**
 * Utility for generating citation keys
 */
export class CitekeyGenerator {
    /**
     * Generate a citekey from citation data
     * @param citationData The citation data
     * @param options Optional configuration for citekey generation
     * @returns A generated citekey
     */
    static generate(citationData: any, options?: CitekeyOptions): string {
        try {
            // Use default options if not provided
            const config = {
                ...CitekeyGenerator.defaultOptions,
                ...options
            };
            
            // If Zotero key exists and we're using Zotero keys, return it
            if (config.useZoteroKeys && citationData.key) {
                return citationData.key;
            }
            
            let citekey = '';
            let authorPart = this.extractAuthorPart(citationData, config);
            let yearPart = this.extractYearPart(citationData);
            
            // Format according to config options
            if (config.authorAbbreviationStyle === 'full' && authorPart) {
                // No change needed for full style
            } else if (config.authorAbbreviationStyle === 'firstThree' && authorPart && authorPart.length > 3) {
                authorPart = authorPart.substring(0, 3);
            } else if (config.authorAbbreviationStyle === 'firstFour' && authorPart && authorPart.length > 4) {
                authorPart = authorPart.substring(0, 4);
            }
            
            // Handle multiple authors
            if (config.includeMultipleAuthors && citationData.author && Array.isArray(citationData.author) && citationData.author.length > 1) {
                // Determine max authors to include
                const maxAuthors = Math.min(config.maxAuthors, citationData.author.length);
                
                // If we have exactly 2 authors, use 'and' separator
                if (citationData.author.length === 2 && config.useTwoAuthorStyle === 'and') {
                    const secondAuthor = this.extractLastNameFromAuthor(citationData.author[1]);
                    if (secondAuthor) {
                        if (config.authorAbbreviationStyle === 'firstThree' && secondAuthor.length > 3) {
                            authorPart += 'And' + secondAuthor.substring(0, 3);
                        } else if (config.authorAbbreviationStyle === 'firstFour' && secondAuthor.length > 4) {
                            authorPart += 'And' + secondAuthor.substring(0, 4);
                        } else {
                            authorPart += 'And' + secondAuthor;
                        }
                    }
                } 
                // Otherwise if including multiple authors beyond the first
                else if (maxAuthors > 1) {
                    // For all additional authors up to maxAuthors
                    for (let i = 1; i < maxAuthors; i++) {
                        const nextAuthor = this.extractLastNameFromAuthor(citationData.author[i]);
                        if (nextAuthor) {
                            // Add author initial
                            authorPart += nextAuthor[0];
                        }
                    }
                    
                    // If there are more authors than maxAuthors, add a plus sign
                    if (citationData.author.length > maxAuthors && config.useEtAl) {
                        authorPart += 'EtAl';
                    }
                }
            }
            
            // Combine author and year parts according to format
            const delimiter = config.authorYearDelimiter;
            citekey = authorPart + delimiter + yearPart;
            
            // Add unique suffix if the citekey is too short
            if (citekey.length < config.minCitekeyLength) {
                const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                citekey += config.shortCitekeyDelimiter + randomSuffix;
            }
            
            return citekey;
        } catch (error) {
            console.error('Error generating citekey:', error);
            return 'citation' + new Date().getFullYear();
        }
    }
    
    /**
     * Extract the author part for a citekey
     */
    private static extractAuthorPart(citationData: any, config: CitekeyOptions): string {
        // Handle different author formats
        if (citationData.author) {
            if (Array.isArray(citationData.author) && citationData.author.length > 0) {
                return this.extractLastNameFromAuthor(citationData.author[0]) || '';
            }
        } else if (citationData.creators && Array.isArray(citationData.creators) && citationData.creators.length > 0) {
            // Handle Zotero creators format
            const firstCreator = citationData.creators[0];
            if (firstCreator.lastName || firstCreator.family) {
                return (firstCreator.lastName || firstCreator.family).toLowerCase().replace(/\s+/g, '');
            } else if (firstCreator.name) {
                return firstCreator.name.split(' ')[0].toLowerCase().replace(/[^\w]/g, '');
            }
        }
        
        // If no author found, use title
        if (citationData.title) {
            // Use the first word of the title if no author
            const titleWords = citationData.title.split(/\s+/);
            // Skip articles and common short words
            const skipWords = ['a', 'an', 'the', 'and', 'or', 'but', 'on', 'in', 'at', 'to', 'for', 'with'];
            let wordIndex = 0;
            while (wordIndex < titleWords.length && skipWords.includes(titleWords[wordIndex].toLowerCase())) {
                wordIndex++;
            }
            if (wordIndex < titleWords.length) {
                return titleWords[wordIndex].toLowerCase().replace(/[^\w]/g, '');
            } else {
                return titleWords[0].toLowerCase().replace(/[^\w]/g, '');
            }
        }
        
        // If still no author part, use fallback
        return 'citation';
    }
    
    /**
     * Extract a standardized last name from an author object in any format
     */
    private static extractLastNameFromAuthor(author: any): string {
        if (!author) return '';
        
        if (typeof author === 'object') {
            // Handle CSL format {family, given}
            if (author.family) {
                return author.family.toLowerCase().replace(/\s+/g, '');
            } else if (author.lastName) {
                return author.lastName.toLowerCase().replace(/\s+/g, '');
            } else if (author.literal) {
                // For institutional authors
                return author.literal.split(' ')[0].toLowerCase().replace(/[^\w]/g, '');
            }
        } else if (Array.isArray(author)) {
            // Handle MediaWiki format [firstName, lastName]
            if (author.length > 1) {
                return author[1].toLowerCase().replace(/\s+/g, '');
            } else if (author.length === 1) {
                return author[0].toLowerCase().replace(/\s+/g, '');
            }
        } else if (typeof author === 'string') {
            // Handle string format
            return author.split(' ')[0].toLowerCase().replace(/[^\w]/g, '');
        }
        
        return '';
    }
    
    /**
     * Extract the year part for a citekey
     */
    private static extractYearPart(citationData: any): string {
        if (citationData.issued && citationData.issued['date-parts'] && 
            citationData.issued['date-parts'][0] && citationData.issued['date-parts'][0][0]) {
            return citationData.issued['date-parts'][0][0].toString();
        } else if (citationData.year) {
            return citationData.year.toString();
        } else if (citationData.date) {
            // Try to extract year from date string
            const yearMatch = citationData.date.match(/\b(\d{4})\b/);
            if (yearMatch) {
                return yearMatch[1];
            }
        }
        
        // Current year as fallback
        return new Date().getFullYear().toString();
    }
    
    /**
     * Default citekey generation options
     */
    static readonly defaultOptions: CitekeyOptions = {
        useZoteroKeys: true,                  // Use Zotero keys when available
        authorAbbreviationStyle: 'full',      // Do not abbreviate author names by default
        includeMultipleAuthors: false,        // Only use first author by default
        maxAuthors: 3,                        // Max number of authors to include if multiple
        useTwoAuthorStyle: 'and',             // Use "AuthorAndAuthor" style for two authors
        useEtAl: true,                        // Add "EtAl" suffix when more authors than maxAuthors
        authorYearDelimiter: '',              // No delimiter between author and year by default
        shortCitekeyDelimiter: '',            // No delimiter before random suffix
        minCitekeyLength: 6                   // Minimum length before adding random suffix
    };
}

/**
 * Options for citekey generation
 */
export interface CitekeyOptions {
    /**
     * Whether to use Zotero keys when available
     * Default: true
     */
    useZoteroKeys: boolean;
    
    /**
     * Style for author name abbreviation
     * - 'full': Use full author last name (e.g., "smith")
     * - 'firstThree': Use first three letters (e.g., "smi")
     * - 'firstFour': Use first four letters (e.g., "smit")
     * Default: 'full'
     */
    authorAbbreviationStyle: 'full' | 'firstThree' | 'firstFour';
    
    /**
     * Whether to include multiple authors in the citekey
     * Default: false
     */
    includeMultipleAuthors: boolean;
    
    /**
     * Maximum number of authors to include if includeMultipleAuthors is true
     * Default: 3
     */
    maxAuthors: number;
    
    /**
     * Style to use when there are exactly two authors
     * - 'and': Include both authors with "And" (e.g., "smithAndJones")
     * - 'initial': Include just the initial of second author (e.g., "smithJ")
     * Default: 'and'
     */
    useTwoAuthorStyle: 'and' | 'initial';
    
    /**
     * Whether to add "EtAl" when there are more authors than maxAuthors
     * Default: true
     */
    useEtAl: boolean;
    
    /**
     * Delimiter to use between author and year parts
     * Example: '_' for "smith_2023"
     * Default: '' (no delimiter)
     */
    authorYearDelimiter: string;
    
    /**
     * Delimiter to use before random suffix for short citekeys
     * Example: '_' for "sm_123"
     * Default: '' (no delimiter)
     */
    shortCitekeyDelimiter: string;
    
    /**
     * Minimum length for a citekey before adding a random suffix
     * Default: 6
     */
    minCitekeyLength: number;
}
