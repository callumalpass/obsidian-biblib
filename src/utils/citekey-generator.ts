/**
 * Utility for generating citation keys
 */
import { CitekeyOptions } from '../types/settings';
import { TemplateEngine } from './template-engine';

export class CitekeyGenerator {
       /**
        * Generates a citekey based on available data and configuration.
        * Priority: Zotero Key > Template > Fallback
        * @param citationData The citation data (e.g., CSL-JSON object)
        * @param options Citekey generation options from settings
        * @returns A generated citekey string
        */
       static generate(citationData: any, options?: CitekeyOptions): string {
               // Ensure we have valid options, merging defaults
               const config = {
                       ...CitekeyGenerator.defaultOptions,
                       ...options
               };

               // Sanitize citationData if it's null or undefined
               if (!citationData) {
                       console.error('Cannot generate citekey: citationData is null or undefined.');
                       return 'error_no_data';
               }

               try {
                       // Priority 1: Use Zotero key if requested and available
                       const zoteroKey = citationData.key || citationData.id;
                       if (config.useZoteroKeys && zoteroKey) {
                               if (typeof zoteroKey === 'string' && zoteroKey.trim().length > 0) {
                                       return zoteroKey.trim();
                               }
                       }

                       // Priority 2: Use template if provided
                       if (config.citekeyTemplate && config.citekeyTemplate.trim()) {
                               // Convert square bracket template to mustache template
                               const mustacheTemplate = this.convertToMustacheTemplate(config.citekeyTemplate);
                               
                               // Prepare variables for rendering
                               const variables = this.prepareCitekeyVariables(citationData, config);
                               
                               // Render template and sanitize for citekey usage
                               let citekey = TemplateEngine.render(mustacheTemplate, variables, { sanitizeForCitekey: true });
                               
                               // Handle minimum length with random suffix if needed
                               if (citekey.length < config.minCitekeyLength) {
                                       const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                                       citekey += randomSuffix;
                               }
                               
                               return citekey || 'error_generating_citekey';
                       }

                       // Fallback with a simple author-year format
                       console.warn("No template provided for citekey generation, using fallback format");
                       const authorFallback = this.extractAuthorPart(citationData, config) || 'unknown';
                       const yearFallback = this.extractYearPart(citationData) || new Date().getFullYear().toString();
                       let fallbackCitekey = authorFallback + yearFallback;
                       
                       // Apply Pandoc's citekey rules
                       // 1. Must start with a letter, digit, or underscore
                       if (!/^[a-zA-Z0-9_]/.test(fallbackCitekey)) {
                               fallbackCitekey = '_' + fallbackCitekey;
                       }
                       
                       // 2. Allow alphanumerics and Pandoc's permitted punctuation
                       fallbackCitekey = fallbackCitekey.replace(/[^a-zA-Z0-9_:.#$%&\-+?<>~/]/g, '');
                       
                       // 3. Remove trailing punctuation (only internal punctuation is allowed)
                       return fallbackCitekey.replace(/[:.#$%&\-+?<>~/]+$/g, '');

               } catch (error) {
                       console.error('Error generating citekey:', error);
                       return 'error_' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
               }
       }
       
       /**
        * Convert a square bracket template to a mustache template
        * [auth:lower] -> {{auth|lowercase}}
        */
       private static convertToMustacheTemplate(template: string): string {
           // Replace [field:mod1:mod2] with {{field|mod1|mod2}}
           return template.replace(/\[([a-zA-Z0-9_]+)((?::[a-zA-Z0-9(),]+)*)\]/g, 
               (match, field, modifiers) => {
                   // Handle common citekey field names
                   let mustacheVar = field.toLowerCase();
                   
                   // Map common abbreviations
                   if (mustacheVar === 'auth') mustacheVar = 'author';
                   
                   // Process modifiers if any (remove leading colon)
                   let mustacheMods = '';
                   if (modifiers) {
                       // Split modifiers, remove empty ones, convert to pipe syntax
                       mustacheMods = modifiers.slice(1) // Remove leading colon
                           .split(':')
                           .filter((m: string) => m)
                           .map((mod: string) => {
                               // Convert modifier syntax
                               const abbrMatch = mod.match(/^abbr\((\d+)\)$/);
                               if (abbrMatch) {
                                   return `abbr${abbrMatch[1]}`; // abbr(3) -> abbr3
                               }
                               
                               const wordsMatch = mod.match(/^words\((\d+)\)$/);
                               if (wordsMatch && field.toLowerCase() === 'title') {
                                   return 'titleword'; // words(1) on title -> titleword
                               }
                               if (wordsMatch && field.toLowerCase() === 'shorttitle') {
                                   return 'shorttitle'; // words(N) on shorttitle -> shorttitle
                               }
                               
                               // Keep other modifiers as is
                               return mod;
                           })
                           .join('|');
                       
                       if (mustacheMods) {
                           mustacheMods = `|${mustacheMods}`;
                       }
                   }
                   
                   return `{{${mustacheVar}${mustacheMods}}}`;
               }
           );
       }
       
       /**
        * Prepare variables for template rendering
        */
       private static prepareCitekeyVariables(citationData: any, config: CitekeyOptions): { [key: string]: any } {
           const variables: { [key: string]: any } = {
               // Include the full citation data
               ...citationData,
               
               // Add convenience fields for templates
               author: this.extractAuthorPart(citationData, config),
               year: this.extractYearPart(citationData),
               title: citationData.title || '',
               
               // Add processed fields commonly used in citekeys
               shorttitle: this.extractTitlePart(citationData, 3),
               
               // Include authors array for iteration, etc.
               authors: citationData.author || 
                       (citationData.creators?.filter((c: any) => c.creatorType === 'author')) || 
                       [],
           };
           
           return variables;
       }

       /**
        * Extracts the first N significant words from the title.
        * Cleans and lowercases the result.
        */
       private static extractTitlePart(citationData: any, wordCount: number = 1): string {
               const title = citationData.title || citationData.Title; // Check common variations
               if (title && typeof title === 'string') {
                       // Remove common CSL/HTML tags before splitting
                       const cleanTitle = title.replace(/<[^>]+>/g, '');
                       const titleWords = cleanTitle.split(/\s+/);
                       // More comprehensive list of skip words
                       const skipWords = new Set([
                               'a', 'an', 'the', 'and', 'or', 'but', 'on', 'in', 'at', 'to', 'for', 'with', 'of', 'from', 'by',
                               'as', 'into', 'like', 'near', 'over', 'past', 'since', 'upon', 'about', 'above', 'across', 'after',
                               'against', 'along', 'among', 'around', 'before', 'behind', 'below', 'beneath', 'beside', 'between',
                               'beyond', 'concerning', 'considering', 'despite', 'down', 'during', 'except', 'following',
                               'inside', 'minus', 'onto', 'opposite', 'out', 'outside', 'per', 'plus', 'regarding', 'round',
                               'save', 'through', 'toward', 'towards', 'under', 'underneath', 'unlike', 'until', 'up', 'versus',
                               'via', 'within', 'without'
                       ]);

                       const significantWords = titleWords
                               .map(word => word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')) // Remove leading/trailing punctuation
                               .filter(word => word && !skipWords.has(word.toLowerCase()));

                       let resultWords: string[];
                       if (significantWords.length > 0) {
                               resultWords = significantWords.slice(0, wordCount);
                       } else if (titleWords.length > 0) {
                               // Fallback: use first N words if all were skip words or punctuation
                               resultWords = titleWords.slice(0, wordCount)
                                   .map(word => word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''))
                                   .filter(word => word);
                       } else {
                               return ''; // No title words found
                       }

                       // Combine words, lowercase, and basic sanitize (allow only alphanumeric)
                       return resultWords.join('').toLowerCase().replace(/[^a-z0-9]/gi, '');
               }
               return ''; // Return empty if no title
       }




       /**
        * Extract the primary author part for a citekey (First author's last name).
        * Returns cleaned, lowercase string or a fallback of 'unknown' when no author is found.
        * Note: No longer falls back to title data to avoid template variable confusion.
        */
       private static extractAuthorPart(citationData: any, config: CitekeyOptions): string {
               let authorName = '';
               const authors = citationData.author || citationData.creators?.filter((c: any) => c.creatorType === 'author');

               if (Array.isArray(authors) && authors.length > 0) {
                       // Prioritize the first author object/string in the array
                       authorName = this.extractLastNameFromAuthor(authors[0]);
               } else if (citationData.creators && Array.isArray(citationData.creators) && citationData.creators.length > 0) {
                       // Fallback specifically for Zotero 'creators' if 'author' isn't present
                       const firstCreator = citationData.creators[0];
                       authorName = this.extractLastNameFromAuthor(firstCreator);
               }

               if (authorName) {
                       // Cleaned and lowercased by extractLastNameFromAuthor
                       return authorName;
               }

               // Use a clear fallback value instead of silent title substitution
               // This prevents template confusion where {{author}} shows title content
               return 'unknown';
       }

       /**
        * Extract a standardized last name from an author object or string.
        * Handles CSL JSON { family, given }, { literal }, Zotero { lastName, firstName }, and plain strings.
        * Returns cleaned, lowercase string, or empty string if unable to extract.
        */
       private static extractLastNameFromAuthor(author: any): string {
               if (!author) return '';

               let lastName = '';
               if (typeof author === 'object') {
                       // CSL JSON format { family, given } or { literal } or Zotero { lastName, firstName }
                       lastName = author.family || author.lastName || '';
                       if (!lastName && author.literal) {
                               // For institutional authors (literal), take the first significant part.
                               // Split by common separators, take first non-empty part.
                               const parts = author.literal.split(/[\s,-.:;()&/]+/).filter(Boolean);
                               lastName = parts[0] || '';
                       }
               } else if (typeof author === 'string') {
                       // Simple split for "LastName, FirstName" or "FirstName LastName" etc.
                       // Prioritize part before comma if exists, otherwise first word.
                       const commaIndex = author.indexOf(',');
                       if (commaIndex !== -1) {
                               lastName = author.substring(0, commaIndex).trim();
                       } else {
                               lastName = author.split(' ')[0].trim();
                       }
               }

               // Basic cleanup: lowercase, allow Pandoc-compatible characters
               // Note: We still need to be more restrictive here than in the final citekey
               // to avoid issues with author name extraction
               return lastName ? lastName.toLowerCase().replace(/[^a-z0-9_-]/gi, '') : '';
       }

       /**
        * Extract the 4-digit year part for a citekey.
        * Handles CSL `issued.date-parts`, direct `year`, `issued.literal`, and general `date` fields.
        * Returns year string or empty string if not found.
        */
       private static extractYearPart(citationData: any): string {
               try {
                       // 1. CSL date-parts (most reliable)
                       const dateParts = citationData.issued?.['date-parts']?.[0];
                       if (Array.isArray(dateParts) && dateParts[0]) {
                               const yearNum = parseInt(dateParts[0].toString(), 10);
                               if (!isNaN(yearNum) && yearNum > 1000 && yearNum < 3000) { // Basic sanity check
                                       return yearNum.toString();
                               }
                       }

                       // 2. Direct 'year' field (common in simpler formats or Zotero exports)
                       if (citationData.year) {
                               const yearStr = citationData.year.toString();
                               const yearMatch = yearStr.match(/\b(\d{4})\b/);
                               if (yearMatch) return yearMatch[1];
                       }

                       // 3. CSL literal date
                       if (citationData.issued?.literal && typeof citationData.issued.literal === 'string') {
                               const yearMatch = citationData.issued.literal.match(/\b(\d{4})\b/);
                               if (yearMatch) return yearMatch[1];
                       }

                       // 4. General 'date' field
                       if (citationData.date && typeof citationData.date === 'string') {
                               const yearMatch = citationData.date.match(/\b(\d{4})\b/);
                               if (yearMatch) return yearMatch[1];
                       }

                       // 5. Try 'issued' field directly if it's a string
                       if (citationData.issued && typeof citationData.issued === 'string') {
                               const yearMatch = citationData.issued.match(/\b(\d{4})\b/);
                               if (yearMatch) return yearMatch[1];
                       }

               } catch (e) {
                       console.warn("Error parsing year from citation data:", e);
               }

               // Fallback: return empty string if no year found
               return '';
               // Alternatively, could return current year: return new Date().getFullYear().toString();
       }

       // Default citekey generation options
       static readonly defaultOptions: CitekeyOptions = {
               citekeyTemplate: '{{author|lowercase}}{{year}}',
               useZoteroKeys: true,
               minCitekeyLength: 6
       };
}