/**
 * Utility for generating Pandoc-compatible citation keys.
 *
 * Generates unique citation keys (citekeys) from CSL-JSON metadata using
 * configurable templates. Citekeys follow Pandoc's rules:
 * - Must start with a letter, digit, or underscore
 * - Can contain alphanumerics and internal punctuation (:.#$%&-+?<>~/)
 * - No trailing punctuation
 *
 * **Generation Priority:**
 * 1. Zotero key (if `useZoteroKeys` is enabled and key exists)
 * 2. Custom template (using TemplateEngine)
 * 3. Fallback format (author-year)
 *
 * **Template Syntax:**
 * Templates can use two formats:
 * - Modern: `{{author|lowercase}}{{year}}` (Handlebars-style)
 * - Legacy: `[auth:lower][year]` (converted to modern format)
 *
 * **Common Variables:**
 * - `{{author}}` - First author's family name
 * - `{{year}}` - Publication year
 * - `{{title}}` or `{{shorttitle}}` - Title or first significant words
 * - `{{rand|N}}` - Random N-character string (for uniqueness)
 *
 * @example
 * ```typescript
 * // Using template
 * const citekey = CitekeyGenerator.generate(
 *   { author: [{family: 'Smith'}], issued: {'date-parts': [[2023]]} },
 *   { citekeyTemplate: '{{author|lowercase}}{{year}}', minCitekeyLength: 6 }
 * );
 * // => "smith2023"
 *
 * // Using Zotero key
 * const zoteroKey = CitekeyGenerator.generate(
 *   { id: 'ABCD1234', author: [{family: 'Jones'}] },
 *   { useZoteroKeys: true }
 * );
 * // => "ABCD1234"
 *
 * // Fallback format
 * const fallback = CitekeyGenerator.generate(
 *   { author: [{family: 'Brown'}], issued: {'date-parts': [[2024]]} },
 *   {} // No template
 * );
 * // => "brown2024"
 * ```
 */
import { CitekeyOptions } from '../types/settings';
import { TemplateEngine } from './template-engine';

/**
 * Static utility class for generating citation keys.
 *
 * All methods are static as the generator is stateless. Each generation call
 * is independent and based solely on the provided citation data and options.
 */
export class CitekeyGenerator {
       /**
        * Generate a citation key from citation data.
        *
        * This is the main entry point for citekey generation. It follows a
        * priority order and includes fallback mechanisms:
        *
        * 1. **Zotero Key** (if enabled): Uses existing `key` or `id` field
        * 2. **Template**: Renders custom template with citation variables
        * 3. **Fallback**: Simple "author-year" format
        *
        * The generated citekey is sanitized to comply with Pandoc's rules and
        * optionally enforces a minimum length by adding a random suffix.
        *
        * @param citationData - CSL-JSON citation object or Zotero item
        * @param options - Citekey generation options (template, min length, etc.)
        * @returns Pandoc-compatible citation key
        *
        * @throws Never throws - returns error citekey on failure (e.g., "error_123")
        *
        * @example
        * ```typescript
        * const data = {
        *   author: [{ family: 'Smith', given: 'John' }],
        *   issued: { 'date-parts': [[2023]] },
        *   title: 'A Study on Machine Learning'
        * };
        *
        * // With template
        * generate(data, {
        *   citekeyTemplate: '{{author|lowercase}}{{year}}',
        *   minCitekeyLength: 8
        * });
        * // => "smith2023"
        *
        * // With titleword formatter
        * generate(data, {
        *   citekeyTemplate: '{{author|lowercase}}{{title|titleword}}{{year}}'
        * });
        * // => "smithstudy2023"
        *
        * // Minimum length enforcement
        * generate({ author: [{ family: 'Li' }], issued: { 'date-parts': [[2023]] } }, {
        *   citekeyTemplate: '{{author|lowercase}}{{year}}',
        *   minCitekeyLength: 10
        * });
        * // => "li2023456" (random suffix added to meet minimum)
        * ```
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
        * Convert legacy square bracket template syntax to modern Handlebars format.
        *
        * Provides backward compatibility with older citekey templates that use
        * square bracket syntax. Converts field names and modifiers to the modern
        * pipe-separated format.
        *
        * **Conversions:**
        * - Field names: `[auth]` → `{{author}}`
        * - Modifiers: `[auth:lower]` → `{{author|lowercase}}`
        * - Chained: `[title:lower:truncate]` → `{{title|lower|truncate}}`
        * - Functions: `[auth:abbr(3)]` → `{{author|abbr3}}`
        * - Title words: `[title:words(1)]` → `{{title|titleword}}`
        *
        * **Field Mappings:**
        * - `auth` → `author`
        * - Other fields preserved as-is
        *
        * @param template - Legacy template with square brackets
        * @returns Modern Handlebars template with double braces
        * @private
        *
        * @example
        * ```typescript
        * convertToMustacheTemplate('[auth:lower][year]');
        * // => "{{author|lowercase}}{{year}}"
        *
        * convertToMustacheTemplate('[auth:abbr(3)][title:words(1)][year]');
        * // => "{{author|abbr3}}{{title|titleword}}{{year}}"
        * ```
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
        * Prepare template variables for citekey generation.
        *
        * Creates a variable object that combines:
        * 1. All fields from the original citation data (spread)
        * 2. Convenience fields extracted for common use cases
        *
        * **Convenience Fields:**
        * - `author` - First author's family name (extracted)
        * - `year` - Publication year (extracted)
        * - `title` - Full title
        * - `shorttitle` - First 3 significant words
        * - `authors` - Array of author objects for iteration
        *
        * These variables can be used in templates with formatters:
        * `{{author|lowercase}}{{year}}` or `{{shorttitle|upper}}`
        *
        * @param citationData - Citation object (CSL-JSON or Zotero)
        * @param config - Citekey generation options
        * @returns Variables object for template rendering
        * @private
        *
        * @example
        * ```typescript
        * const vars = prepareCitekeyVariables({
        *   author: [{ family: 'Smith' }],
        *   issued: { 'date-parts': [[2023]] },
        *   title: 'The Art of Computer Programming'
        * }, {});
        *
        * // vars = {
        * //   author: 'smith',
        * //   year: '2023',
        * //   title: 'The Art of Computer Programming',
        * //   shorttitle: 'artcomputerprogramming',
        * //   authors: [{family: 'Smith'}],
        * //   ...
        * // }
        * ```
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
        * Extract the first author's family name for use in citekeys.
        *
        * Searches for author information in multiple fields to handle different
        * data formats (CSL-JSON, Zotero, etc.):
        * 1. `author` array (CSL-JSON)
        * 2. `creators` array filtered by `creatorType: 'author'` (Zotero)
        *
        * Returns a cleaned, lowercase family name suitable for citekeys. If no
        * author is found, returns "unknown" instead of falling back to title
        * (to avoid template variable confusion).
        *
        * @param citationData - Citation object to extract author from
        * @param config - Citekey generation options (currently unused)
        * @returns Lowercase family name or "unknown"
        * @private
        *
        * @example
        * ```typescript
        * // CSL-JSON format
        * extractAuthorPart({ author: [{ family: 'Smith', given: 'John' }] }, {});
        * // => "smith"
        *
        * // Zotero format
        * extractAuthorPart({
        *   creators: [{ creatorType: 'author', lastName: 'Jones', firstName: 'Mary' }]
        * }, {});
        * // => "jones"
        *
        * // Institutional author
        * extractAuthorPart({ author: [{ literal: 'MIT Press' }] }, {});
        * // => "mit"
        *
        * // No author
        * extractAuthorPart({ title: 'Some Title' }, {});
        * // => "unknown"
        * ```
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
        * Extract a 4-digit publication year from citation data.
        *
        * Attempts to find the year in multiple fields, in order of reliability:
        * 1. `issued['date-parts'][0][0]` - CSL-JSON date format (most reliable)
        * 2. `year` - Direct year field
        * 3. `issued.literal` - Text date in `issued` field
        * 4. `date` - General date field
        * 5. `issued` - If it's a string
        *
        * Returns a 4-digit year string matching regex `\\d{4}`, or empty string
        * if no valid year is found. Performs basic sanity checking (1000-3000 range).
        *
        * @param citationData - Citation object to extract year from
        * @returns 4-digit year string or empty string
        * @private
        *
        * @example
        * ```typescript
        * // CSL-JSON date-parts
        * extractYearPart({ issued: { 'date-parts': [[2023, 1, 15]] } });
        * // => "2023"
        *
        * // Direct year field
        * extractYearPart({ year: 2024 });
        * // => "2024"
        *
        * // Literal date string
        * extractYearPart({ issued: { literal: 'January 2023' } });
        * // => "2023"
        *
        * // No year found
        * extractYearPart({ title: 'Some Title' });
        * // => ""
        * ```
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