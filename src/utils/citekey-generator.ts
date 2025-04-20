/**
 * Utility for generating citation keys
 */
export class CitekeyGenerator {
    /**
     * Generate a citekey from citation data
     * @param citationData The citation data
     * @returns A generated citekey
     */
    static generate(citationData: any): string {
        try {
            let citekey = '';
            let authorPart = '';
            let yearPart = '';
            
            // Extract author/creator information
            if (citationData.key) {
                // If Zotero key exists, use it
                return citationData.key;
            }
            
            // Handle different author formats
            if (citationData.author) {
                if (Array.isArray(citationData.author)) {
                    const firstAuthor = citationData.author[0];
                    if (firstAuthor) {
                        if (typeof firstAuthor === 'object') {
                            // Handle CSL format {family, given}
                            if (firstAuthor.family) {
                                authorPart = firstAuthor.family.toLowerCase().replace(/\s+/g, '');
                            } else if (firstAuthor.lastName) {
                                authorPart = firstAuthor.lastName.toLowerCase().replace(/\s+/g, '');
                            } else if (firstAuthor.literal) {
                                // For institutional authors
                                authorPart = firstAuthor.literal.split(' ')[0].toLowerCase().replace(/[^\w]/g, '');
                            }
                        } else if (Array.isArray(firstAuthor)) {
                            // Handle MediaWiki format [firstName, lastName]
                            if (firstAuthor.length > 1) {
                                authorPart = firstAuthor[1].toLowerCase().replace(/\s+/g, '');
                            } else if (firstAuthor.length === 1) {
                                authorPart = firstAuthor[0].toLowerCase().replace(/\s+/g, '');
                            }
                        } else if (typeof firstAuthor === 'string') {
                            // Handle string format
                            authorPart = firstAuthor.split(' ')[0].toLowerCase().replace(/[^\w]/g, '');
                        }
                    }
                }
            } else if (citationData.creators && Array.isArray(citationData.creators) && citationData.creators.length > 0) {
                // Handle Zotero creators format
                const firstCreator = citationData.creators[0];
                if (firstCreator.lastName || firstCreator.family) {
                    authorPart = (firstCreator.lastName || firstCreator.family).toLowerCase().replace(/\s+/g, '');
                } else if (firstCreator.name) {
                    authorPart = firstCreator.name.split(' ')[0].toLowerCase().replace(/[^\w]/g, '');
                }
            }
            
            // If no author found, use title
            if (!authorPart && citationData.title) {
                // Use the first word of the title if no author
                const titleWords = citationData.title.split(/\s+/);
                // Skip articles and common short words
                const skipWords = ['a', 'an', 'the', 'and', 'or', 'but', 'on', 'in', 'at', 'to', 'for', 'with'];
                let wordIndex = 0;
                while (wordIndex < titleWords.length && skipWords.includes(titleWords[wordIndex].toLowerCase())) {
                    wordIndex++;
                }
                if (wordIndex < titleWords.length) {
                    authorPart = titleWords[wordIndex].toLowerCase().replace(/[^\w]/g, '');
                } else {
                    authorPart = titleWords[0].toLowerCase().replace(/[^\w]/g, '');
                }
            }
            
            // If still no author part, use fallback
            if (!authorPart) {
                authorPart = 'citation';
            }
            
            // Add year if available
            if (citationData.issued && citationData.issued['date-parts'] && 
                citationData.issued['date-parts'][0] && citationData.issued['date-parts'][0][0]) {
                yearPart = citationData.issued['date-parts'][0][0].toString();
            } else if (citationData.year) {
                yearPart = citationData.year.toString();
            } else if (citationData.date) {
                // Try to extract year from date string
                const yearMatch = citationData.date.match(/\b(\d{4})\b/);
                if (yearMatch) {
                    yearPart = yearMatch[1];
                }
            } else {
                // Current year as fallback
                yearPart = new Date().getFullYear().toString();
            }
            
            // Combine parts to form citekey
            citekey = authorPart + yearPart;
            
            // If it's very short, append something to make it more unique
            if (citekey.length < 6) {
                const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                citekey += randomSuffix;
            }
            
            return citekey;
        } catch (error) {
            console.error('Error generating citekey:', error);
            return 'citation' + new Date().getFullYear();
        }
    }
}
