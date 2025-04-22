/**
 * Utility for generating citation keys
 */
import { CitekeyOptions } from '../types/settings';
export class CitekeyGenerator {

       /**
        * Generates a citekey based on available data and configuration.
        * Priority: Zotero Key > Template > Legacy Options > Fallback
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
                       // Zotero keys often look like 'AuthorYearTitle', check common patterns or specific fields if known
                       const zoteroKey = citationData.key || citationData.id; // Adjust if Zotero key field name is different
                       if (config.useZoteroKeys && zoteroKey) {
                               // Basic validation/cleaning for Zotero key might be needed
                               // For now, return it as is if it looks reasonable (e.g., contains non-whitespace)
                               if (typeof zoteroKey === 'string' && zoteroKey.trim().length > 0) {
                                       return zoteroKey.trim();
                               }
                       }

                       // Priority 2: Use template if provided
                       if (config.citekeyTemplate && config.citekeyTemplate.trim()) {
                               return this.generateFromTemplate(citationData, config);
                       }

                       // Priority 3: Use legacy options
                       return this.generateWithLegacyOptions(citationData, config);

               } catch (error) {
                       console.error('Error generating citekey:', error);
                       // Fallback citekey in case of unexpected errors during generation
                       const authorFallback = this.extractAuthorPart(citationData, config) || 'unknown';
                       const yearFallback = this.extractYearPart(citationData) || new Date().getFullYear().toString();
                       return (authorFallback + yearFallback).replace(/[^a-zA-Z0-9]/g, ''); // Basic cleanup for fallback
               }
       }

       /**
        * Generates a citekey based on a user-defined template.
        */
       private static generateFromTemplate(citationData: any, config: CitekeyOptions): string {
               let processedTemplate = config.citekeyTemplate;
               // Regex to find placeholders like [field:mod1:mod2(arg)]
               const placeholderRegex = /\[([a-zA-Z0-9_]+)((?::[a-zA-Z0-9(),]+)*)\]/g;
               // Group 1: field (e.g., 'auth')
               // Group 2: modifiers (e.g., ':lower:abbr(3)') - includes leading colon

               let match;
               // Use a Set to avoid infinite loops with replace if a placeholder evaluates to itself
               const alreadyReplaced = new Set<string>();

               // Limit iterations to prevent potential infinite loops with complex replacements
               let iterations = 0;
               const maxIterations = 100; // Safety break

               // Create a temporary string to build replacements
               let resultString = processedTemplate;

               while ((match = placeholderRegex.exec(processedTemplate)) !== null && iterations < maxIterations) {
                       iterations++;
                       const fullPlaceholder = match[0]; // e.g., '[auth:lower]'

                       // Avoid reprocessing if the placeholder was already processed in this cycle
                       // or if its evaluation resulted in the placeholder itself
                       if (alreadyReplaced.has(fullPlaceholder)) {
                               continue;
                       }

                       const field = match[1];           // e.g., 'auth'
                       const modifierString = match[2] ? match[2].slice(1) : ''; // Remove leading colon, e.g., 'lower:abbr(3)'

                       let value = '';
                       switch (field.toLowerCase()) { // Use lowercase field for case-insensitivity
                               case 'auth':
                               case 'author':
                                       // Currently simple: first author's last name
                                       value = this.extractAuthorPart(citationData, config);
                                       break;
                               case 'year':
                                       value = this.extractYearPart(citationData);
                                       break;
                               case 'title':
                                       // Use first significant word by default
                                       value = this.extractTitlePart(citationData, 1);
                                       break;
                               case 'shorttitle': {
                                       // Default to 3 words for shorttitle if not specified by a 'words' modifier
                                       const wordsModifierMatch = modifierString.match(/words\((\d+)\)/);
                                       const wordCount = wordsModifierMatch ? parseInt(wordsModifierMatch[1], 10) : 3;
                                       value = this.extractTitlePart(citationData, wordCount);
                                       break;
                               }
                               // Add more cases for other fields: journal, editor, firstpage etc.
                               default:
                                       console.warn(`Unknown citekey placeholder field: ${field}`);
                                       value = ''; // Replace unknown fields with empty string or placeholder?
                       }

                       if (modifierString) {
                               // Pass citationData for context-aware modifiers (like etal)
                               value = this.applyModifiers(value, modifierString, citationData, config);
                       }

                       // Replace *first* occurrence of the placeholder in the current result string
                       // This helps avoid issues if a placeholder evaluates to something containing another placeholder
                       if (resultString.includes(fullPlaceholder)) {
                               resultString = resultString.replace(fullPlaceholder, value);
                               alreadyReplaced.add(fullPlaceholder); // Mark as processed for this outer loop pass
                               placeholderRegex.lastIndex = 0; // Reset regex index after replacement
                       } else {
                               // Placeholder might have been consumed by an earlier replacement, stop processing it
                               alreadyReplaced.add(fullPlaceholder);
                       }
               }

               if (iterations >= maxIterations) {
                       console.warn('Citekey generation reached max iterations, potential loop in template:', config.citekeyTemplate);
               }

               // Final cleanup: remove remaining brackets (if any invalid placeholders), ensure basic validity
               let citekey = resultString.replace(/\[.*?\]/g, ''); // Remove unparsed placeholders
               citekey = citekey.replace(/[^a-zA-Z0-9]/g, ''); // Basic sanitize: allow only alphanumeric

               // Handle minimum length (use delimiters from config)
               if (citekey.length < config.minCitekeyLength) {
                       const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                       citekey += config.shortCitekeyDelimiter + randomSuffix;
                       // Re-sanitize after adding delimiter and suffix
                       citekey = citekey.replace(/[^a-zA-Z0-9]/g, '');
               }

               return citekey || 'error_generating_citekey'; // Provide a fallback if all else fails
       }

       /**
        * Applies modifiers to a citekey part.
        */
       private static applyModifiers(value: string, modifierString: string, citationData: any, config: CitekeyOptions): string {
               const modifiers = modifierString.split(':'); // e.g., ['lower', 'abbr(3)']
               let modifiedValue = value;

               modifiers.forEach(mod => {
                       if (!mod) return; // Skip empty modifiers if splitting results in them (e.g., "::")

                       const abbrMatch = mod.match(/^abbr\((\d+)\)$/);
                       const wordsMatch = mod.match(/^words\((\d+)\)$/); // Used by shorttitle logic, ignored here
                       const etalMatch = mod.match(/^etal(?:\((\d+)\))?$/); // Optional author count for etal

                       if (mod === 'lower') {
                               modifiedValue = modifiedValue.toLowerCase();
                       } else if (mod === 'upper') {
                               modifiedValue = modifiedValue.toUpperCase();
                       } else if (mod === 'capitalize') {
                               // Capitalize first letter, leave rest as is (or lowercase rest?)
                               // Let's lowercase the rest for consistency.
                               modifiedValue = modifiedValue.charAt(0).toUpperCase() + modifiedValue.slice(1).toLowerCase();
                       } else if (abbrMatch) {
                               const len = parseInt(abbrMatch[1], 10);
                               if (!isNaN(len) && len > 0) {
                                       modifiedValue = modifiedValue.substring(0, len);
                               }
                       } else if (etalMatch) {
                               // This modifier only makes sense applied to the 'auth' field implicitly.
                               // It requires access to the full author list.
                               // We'll apply EtAl logic *if* this modifier is present *and* the original field was 'auth'.
                               // Note: This assumes 'modifiedValue' currently holds the *first* author part.
                               const maxAuthors = etalMatch[1] ? parseInt(etalMatch[1], 10) : (config.maxAuthors || 1); // Use config default if no number in etal()
                               const authors = citationData.author || citationData.creators?.filter((c: any) => c.creatorType === 'author');

                               if (Array.isArray(authors) && authors.length > maxAuthors) {
                                      // Check if we need to handle the two-author case specially based on maxAuthors
                                      if (maxAuthors === 2 && config.useTwoAuthorStyle === 'and' && authors.length === 2) {
                                           const secondAuthor = this.extractLastNameFromAuthor(authors[1]);
                                           if (secondAuthor) {
                                               let secondPart = this.applyModifiers(secondAuthor, modifierString.replace(/:etal(?:\(\d+\))?/,''), citationData, config); // Apply other mods to second author
                                               modifiedValue += 'And' + secondPart.charAt(0).toUpperCase() + secondPart.slice(1); // Ensure second part is capitalized
                                           }
                                      } else if (maxAuthors > 1 && authors.length > 1) {
                                           // Append initials or parts of subsequent authors up to maxAuthors
                                           for (let i = 1; i < maxAuthors; i++) {
                                               const nextAuthor = this.extractLastNameFromAuthor(authors[i]);
                                               if (nextAuthor) {
                                                   // Apply other modifiers (like abbr) to the initial/part? For now, just take the initial.
                                                   const initial = this.applyModifiers(nextAuthor, modifierString.replace(/:etal(?:\(\d+\))?/,''), citationData, config);
                                                   modifiedValue += initial.charAt(0).toUpperCase(); // Add capitalized initial
                                               }
                                           }
                                            // Add EtAl if needed (authors > maxAuthors)
                                           if (authors.length > maxAuthors) {
                                               modifiedValue += 'EtAl';
                                           }
                                      } else if (authors.length > 1) { // If maxAuthors is 1 but we have more authors
                                            modifiedValue += 'EtAl';
                                      }
                               } else if (Array.isArray(authors) && authors.length === 2 && maxAuthors >= 2) {
                                     // Handle exactly two authors when maxAuthors >= 2 and no etal needed
                                      if (config.useTwoAuthorStyle === 'and') {
                                         const secondAuthor = this.extractLastNameFromAuthor(authors[1]);
                                          if (secondAuthor) {
                                              let secondPart = this.applyModifiers(secondAuthor, modifierString.replace(/:etal(?:\(\d+\))?/,''), citationData, config); // Apply other mods to second author
                                              modifiedValue += 'And' + secondPart.charAt(0).toUpperCase() + secondPart.slice(1); // Ensure second part is capitalized
                                          }
                                      } else if (config.useTwoAuthorStyle === 'initial') {
                                           const secondAuthor = this.extractLastNameFromAuthor(authors[1]);
                                          if (secondAuthor) {
                                               const initial = this.applyModifiers(secondAuthor, modifierString.replace(/:etal(?:\(\d+\))?/,''), citationData, config);
                                                  modifiedValue += initial.charAt(0).toUpperCase(); // Add capitalized initial
                                          }
                                      }
                                }
                       } 
                       // Add more modifiers: replace(from,to), etc.
                       // Ignore 'words(N)' here as it's handled during field extraction
                       else if (!wordsMatch) {
                               console.warn(`Unknown citekey modifier: ${mod}`);
                       }
               });

               return modifiedValue;
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
        * Generates a citekey using the legacy options.
        * (Contains the original logic from the 'generate' method before template refactoring)
        */
       private static generateWithLegacyOptions(citationData: any, config: CitekeyOptions): string {
               let citekey = '';
               let authorPart = this.extractAuthorPart(citationData, config); // Already cleaned/lowercased
               let yearPart = this.extractYearPart(citationData);

               // Apply legacy abbreviation styles (note: authorPart is already lowercase)
               if (config.authorAbbreviationStyle === 'firstThree' && authorPart.length > 3) {
                       authorPart = authorPart.substring(0, 3);
               } else if (config.authorAbbreviationStyle === 'firstFour' && authorPart.length > 4) {
                       authorPart = authorPart.substring(0, 4);
               }
               // Capitalize the first letter of the author part for legacy formats
               authorPart = authorPart.charAt(0).toUpperCase() + authorPart.slice(1);

               // Handle multiple authors using legacy settings
               const authors = citationData.author || citationData.creators?.filter((c: any) => c.creatorType === 'author');
               if (config.includeMultipleAuthors && Array.isArray(authors) && authors.length > 1) {
                       const maxAut = Math.min(config.maxAuthors, authors.length); // Use shorter var name

                       if (authors.length === 2 && config.useTwoAuthorStyle === 'and') {
                               const secondAuthorRaw = this.extractLastNameFromAuthor(authors[1]); // Raw last name
                               if (secondAuthorRaw) {
                                       let secondPart = secondAuthorRaw; // Already lowercased by extractLastNameFromAuthor
                                       // Apply abbreviation to second author part
                                       if (config.authorAbbreviationStyle === 'firstThree' && secondPart.length > 3) {
                                               secondPart = secondPart.substring(0, 3);
                                       } else if (config.authorAbbreviationStyle === 'firstFour' && secondPart.length > 4) {
                                               secondPart = secondPart.substring(0, 4);
                                       }
                                       // Capitalize 'And' and the second author part
                                       authorPart += 'And' + secondPart.charAt(0).toUpperCase() + secondPart.slice(1);
                               }
                       } else if (authors.length === 2 && config.useTwoAuthorStyle === 'initial') {
                               const secondAuthorRaw = this.extractLastNameFromAuthor(authors[1]);
                               if (secondAuthorRaw) {
                                   authorPart += secondAuthorRaw.charAt(0).toUpperCase(); // Add capitalized initial
                               }
                       }
                       else if (maxAut > 1) { // Handle 3+ authors up to maxAut
                               for (let i = 1; i < maxAut; i++) {
                                       const nextAuthorRaw = this.extractLastNameFromAuthor(authors[i]);
                                       if (nextAuthorRaw) {
                                               // Add capitalized author initial
                                               authorPart += nextAuthorRaw.charAt(0).toUpperCase();
                                       }
                               }
                               // Add EtAl suffix if needed
                               if (authors.length > maxAut && config.useEtAl) {
                                       authorPart += 'EtAl';
                               }
                       }
                       else if (authors.length > 1 && maxAut === 1 && config.useEtAl) { // Handle case where maxAut is 1 but more authors exist
                               authorPart += 'EtAl';
                       }
               }

               // Combine author and year parts according to legacy format
               const delimiter = config.authorYearDelimiter || ''; // Ensure delimiter is string
               citekey = authorPart + delimiter + yearPart;

               // Add unique suffix if the citekey is too short
               if (citekey.length < config.minCitekeyLength) {
                       const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                       const shortDelimiter = config.shortCitekeyDelimiter || '';
                       citekey += shortDelimiter + randomSuffix;
               }

               // Final basic sanitization for legacy output
               return citekey.replace(/[^a-zA-Z0-9]/g, '');
       }


       /**
        * Extract the primary author part for a citekey (First author's last name).
        * Returns cleaned, lowercase string or a fallback like 'unknown' or title word.
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

               // Fallback to title if no author found
               const titleFallback = this.extractTitlePart(citationData, 1); // Use first significant title word
               if (titleFallback) {
                       return titleFallback; // Already cleaned/lowercased
               }

               // Ultimate fallback
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

               // Basic cleanup: lowercase, remove non-alphanumeric (allow hyphen)
               return lastName ? lastName.toLowerCase().replace(/[^a-z0-9-]/gi, '') : '';
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

       // Default options remain the same, ensure citekeyTemplate is empty
       static readonly defaultOptions: CitekeyOptions = {
               citekeyTemplate: '',
               useZoteroKeys: true,
               authorAbbreviationStyle: 'full',
               includeMultipleAuthors: false,
               maxAuthors: 3,
               useTwoAuthorStyle: 'and',
               useEtAl: true,
               authorYearDelimiter: '',
               shortCitekeyDelimiter: '',
               minCitekeyLength: 6
       };
}