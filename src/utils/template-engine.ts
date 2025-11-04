/**
 * Unified Template Engine for BibLib
 *
 * A Handlebars-inspired template engine that renders templates with variables,
 * conditionals, loops, and formatters. Used throughout BibLib for:
 * - Custom frontmatter field templates
 * - Note header templates
 * - Citekey generation templates
 * - Filename templates
 *
 * **Supported Syntax:**
 * - Variables: `{{variable}}` or `{{variable|formatter}}`
 * - Nested properties: `{{author.0.family}}` or `{{authors_family.0}}`
 * - Conditionals: `{{#variable}}content{{/variable}}` (if truthy)
 * - Inverted conditionals: `{{^variable}}content{{/variable}}` (if falsy)
 * - Array iteration: `{{#array}}{{.}}{{/array}}` with special variables
 *   - `{{.}}` - current item
 *   - `{{@index}}` - 0-based index
 *   - `{{@first}}`, `{{@last}}` - boolean flags
 * - Formatters: `{{value|upper}}`, `{{title|truncate:30}}`, `{{author|abbr3}}`
 * - Random strings: `{{rand|5}}` or `{{rand5}}`
 *
 * @example
 * ```typescript
 * const result = TemplateEngine.render(
 *   '{{author|lower}}{{year}}',
 *   { author: 'Smith', year: 2023 }
 * );
 * // => "smith2023"
 *
 * const withFormatting = TemplateEngine.render(
 *   '{{title|titleword|upper}}',
 *   { title: 'The Art of Computer Programming' },
 *   { sanitizeForCitekey: true }
 * );
 * // => "ART"
 * ```
 */
import { processYamlArray } from './yaml-utils';

/**
 * Options for controlling template rendering behavior.
 */
export interface TemplateOptions {
    /**
     * Whether to sanitize output for Pandoc citekey compliance.
     * When enabled, ensures the result starts with a letter/digit/underscore
     * and contains only allowed characters.
     */
    sanitizeForCitekey?: boolean;

    /**
     * Whether to render as a YAML array format.
     * Applies special formatting for array values in YAML frontmatter.
     */
    yamlArray?: boolean;
}

/**
 * Static template engine for rendering Handlebars-style templates.
 *
 * All methods are static as the engine is stateless and doesn't require
 * instantiation. Each render call is independent with its own variable context.
 */
export class TemplateEngine {
    /**
     * Render a template string with variables and optional formatting.
     *
     * This is the main entry point for template rendering. It processes templates
     * in the following order:
     * 1. Positive conditional blocks (`{{#var}}...{{/var}}`)
     * 2. Negative conditional blocks (`{{^var}}...{{/var}}`)
     * 3. Variable substitutions (`{{var}}` or `{{var|format}}`)
     * 4. Optional sanitization for citekeys (Pandoc rules)
     * 5. Optional YAML array formatting
     *
     * **Formatter Chaining:**
     * You can chain formatters: `{{title|lowercase|truncate:20}}`
     *
     * **Special Variables:**
     * - In array iterations: `.`, `@index`, `@first`, `@last`, `@odd`, `@even`
     * - Random strings: Use `{{rand|N}}` or `{{randN}}` for N-character random string
     *
     * @param template - The template string to render
     * @param variables - Object containing variable values (supports nested objects)
     * @param options - Optional rendering configuration
     * @returns The rendered string
     *
     * @example
     * ```typescript
     * // Basic variable substitution
     * TemplateEngine.render('{{name}}', { name: 'John' });
     * // => "John"
     *
     * // With formatter
     * TemplateEngine.render('{{name|upper}}', { name: 'John' });
     * // => "JOHN"
     *
     * // Conditional block
     * TemplateEngine.render('{{#hasEmail}}Email: {{email}}{{/hasEmail}}',
     *   { hasEmail: true, email: 'test@example.com' });
     * // => "Email: test@example.com"
     *
     * // Array iteration
     * TemplateEngine.render('{{#authors}}{{.}}, {{/authors}}',
     *   { authors: ['Smith', 'Jones'] });
     * // => "Smith, Jones, "
     *
     * // Citekey generation
     * TemplateEngine.render('{{author|lower}}{{year}}',
     *   { author: 'Smith', year: 2023 },
     *   { sanitizeForCitekey: true });
     * // => "smith2023"
     * ```
     */
    static render(
        template: string,
        variables: { [key: string]: any },
        options: TemplateOptions = {}
    ): string {
        // Start with the template
        let result = template;
        
        // Process the template in order
        result = this.processPositiveBlocks(result, variables);
        result = this.processNegativeBlocks(result, variables);
        result = this.processVariables(result, variables);
        
        // Apply citekey sanitization if requested
        if (options.sanitizeForCitekey) {
            // Apply Pandoc's citekey rules:
            // 1. Must start with a letter, digit, or underscore
            // 2. Can contain alphanumerics and internal punctuation (:.#$%&-+?<>~/)
            
            // First, ensure the key starts with a valid character
            if (!/^[a-zA-Z0-9_]/.test(result)) {
                // If it doesn't start with a valid character, replace with an underscore
                result = '_' + result;
            }
            
            // Allow alphanumerics and Pandoc's permitted punctuation
            result = result.replace(/[^a-zA-Z0-9_:.#$%&\-+?<>~/]/g, '');
            
            // Remove trailing punctuation (only internal punctuation is allowed)
            result = result.replace(/[:.#$%&\-+?<>~/]+$/g, '');
        }
        
        // Process special YAML array format if requested
        if (options.yamlArray && template.startsWith('[') && template.endsWith(']')) {
            return processYamlArray(result);
        }
        
        return result;
    }
    
    /**
     * Process positive conditional blocks and array iterations.
     *
     * Handles `{{#variable}}content{{/variable}}` syntax:
     * - For arrays: Iterates over each element, rendering content for each
     * - For truthy non-arrays: Renders content once
     * - For falsy values: Renders nothing
     *
     * **Array Iteration Variables:**
     * Within array blocks, the following special variables are available:
     * - `.` - Current array item
     * - `@index` - Current index (0-based)
     * - `@number` - Current number (1-based)
     * - `@first` - Boolean, true for first item
     * - `@last` - Boolean, true for last item
     * - `@odd` - Boolean, true for odd-indexed items
     * - `@even` - Boolean, true for even-indexed items
     * - `@length` - Total array length
     *
     * Processes blocks recursively to support nested loops and conditionals.
     *
     * @param template - The template string to process
     * @param variables - Available variables for substitution
     * @returns Template with positive blocks processed
     * @private
     *
     * @example
     * ```typescript
     * // Array iteration
     * processPositiveBlocks(
     *   '{{#authors}}{{.}}{{^@last}}, {{/@last}}{{/authors}}',
     *   { authors: ['Smith', 'Jones', 'Brown'] }
     * );
     * // => "Smith, Jones, Brown"
     *
     * // Conditional rendering
     * processPositiveBlocks('{{#hasDOI}}DOI: {{doi}}{{/hasDOI}}',
     *   { hasDOI: true, doi: '10.1234/example' });
     * // => "DOI: 10.1234/example"
     * ```
     */
    private static processPositiveBlocks(template: string, variables: { [key: string]: any }): string {
        // Regex for positive blocks {{#variable}}content{{/variable}}
        const blockRegex = /\{\{#([^}]+)\}\}(.*?)\{\{\/\1\}\}/gs;
        
        return template.replace(blockRegex, (match, key, content) => {
            const trimmedKey = key.trim();
            const value = this.getNestedValue(variables, trimmedKey);
            
            // If the value is an array, iterate over it
            if (Array.isArray(value)) {
                if (value.length === 0) {
                    return ''; // Empty array = don't render
                }
                
                // Map each item in the array through the template
                return value.map((item, index) => {
                    // For each iteration, create a new variables object
                    // with enhanced metadata about the iteration
                    const iterationVars = { 
                        ...variables, 
                        '.': item,                               // Current item
                        '@index': index,                         // Current index (0-based)
                        '@number': index + 1,                    // Current number (1-based)
                        '@first': index === 0,                   // Is this the first item?
                        '@last': index === value.length - 1,     // Is this the last item?
                        '@odd': index % 2 === 1,                 // Is this an odd-indexed item?
                        '@even': index % 2 === 0,                // Is this an even-indexed item?
                        '@length': value.length,                 // Total number of items
                    };
                    
                    // Process this iteration's content recursively
                    let itemContent = this.processPositiveBlocks(content, iterationVars);
                    itemContent = this.processNegativeBlocks(itemContent, iterationVars);
                    itemContent = this.processVariables(itemContent, iterationVars);
                    
                    return itemContent;
                }).join('');
            }
            
            // For non-arrays, treat as a simple conditional
            return value ? content : '';
        });
    }
    
    /**
     * Process negative (inverted) conditional blocks.
     *
     * Handles `{{^variable}}content{{/variable}}` syntax:
     * - Renders content when variable is falsy, empty, or doesn't exist
     * - Falsy values include: undefined, null, empty string, empty array
     *
     * This is the logical opposite of positive blocks (`{{#variable}}`).
     *
     * @param template - The template string to process
     * @param variables - Available variables for evaluation
     * @returns Template with negative blocks processed
     * @private
     *
     * @example
     * ```typescript
     * processNegativeBlocks('{{^authors}}No authors listed{{/authors}}',
     *   { authors: [] });
     * // => "No authors listed"
     *
     * processNegativeBlocks('{{^doi}}No DOI available{{/doi}}',
     *   { title: 'Example' });
     * // => "No DOI available"
     * ```
     */
    private static processNegativeBlocks(template: string, variables: { [key: string]: any }): string {
        // Regex for negative blocks {{^variable}}content{{/variable}}
        const blockRegex = /\{\{\^([^}]+)\}\}(.*?)\{\{\/\1\}\}/gs;
        
        return template.replace(blockRegex, (match, key, content) => {
            const trimmedKey = key.trim();
            const value = this.getNestedValue(variables, trimmedKey);
            
            // Consider empty arrays, empty strings, null, and undefined as falsy
            const isFalsy = value === undefined || 
                           value === null || 
                           value === '' || 
                           (Array.isArray(value) && value.length === 0);
                           
            return isFalsy ? content : '';
        });
    }
    
    /**
     * Process variable replacements {{variable}} or {{variable|format}}
     * Also supports special case {{rand|N}} or {{randN}} for random strings
     */
    private static processVariables(template: string, variables: { [key: string]: any }): string {
        // First, handle the special case of {{rand|N}} or {{randN}}
        // This format doesn't require an actual variable to exist
        template = template.replace(/\{\{(rand)(?:\|(\d+))?\}\}/g, (match, key, length) => {
            const len = length ? parseInt(length, 10) : 5;
            return this.generateRandomString(len);
        });
        
        // Regex for variables, optionally with formats {{variable}} or {{variable|format}}
        const variableRegex = /\{\{([^#^}|]+)(?:\|([^}]+))?\}\}/g;
        
        return template.replace(variableRegex, (match, key, format) => {
            const trimmedKey = key.trim();
            
            // Skip keys that start with # or ^ as those are handled by block processors
            if (trimmedKey.startsWith('#') || trimmedKey.startsWith('^')) {
                return '';
            }
            
            // Get the value, handling nested properties
            const value = this.getNestedValue(variables, trimmedKey);
            
            // If the value is undefined/null, return empty string
            if (value === undefined || value === null) {
                return '';
            }
            
            // If a format is specified, apply it
            if (format) {
                return this.formatValue(value, format.trim());
            }
            
            // Otherwise, return the value as string
            if (typeof value === 'object') {
                try {
                    return JSON.stringify(value);
                } catch (e) {
                    return '[Object]';
                }
            }
            
            // Return string value
            return String(value);
        });
    }
    
    /**
     * Get a value from nested object properties using dot notation.
     *
     * Supports two access patterns:
     * 1. Direct property: `'title'` → `obj.title`
     * 2. Nested dot notation: `'author.0.family'` → `obj.author[0].family`
     *
     * Returns `undefined` if any intermediate property doesn't exist.
     * This prevents errors when accessing deeply nested optional properties.
     *
     * @param obj - The object to traverse
     * @param path - Property path (can use dot notation)
     * @returns The value at the path, or undefined if not found
     * @private
     *
     * @example
     * ```typescript
     * const data = { author: [{ family: 'Smith', given: 'John' }], year: 2023 };
     *
     * getNestedValue(data, 'year');
     * // => 2023
     *
     * getNestedValue(data, 'author.0.family');
     * // => "Smith"
     *
     * getNestedValue(data, 'author.1.family');
     * // => undefined (array doesn't have index 1)
     * ```
     */
    private static getNestedValue(obj: { [key: string]: any }, path: string): any {
        // Handle direct property access
        if (obj[path] !== undefined) {
            return obj[path];
        }
        
        // Handle dot notation for nested properties
        const parts = path.split('.');
        let current = obj;
        
        for (const part of parts) {
            if (current === undefined || current === null) {
                return undefined;
            }
            
            current = current[part];
        }
        
        return current;
    }
    
    /**
     * Apply a formatter to a value.
     *
     * Supports 30+ formatters organized into categories:
     *
     * **Text Case:**
     * - `upper`, `uppercase` - Convert to uppercase
     * - `lower`, `lowercase` - Convert to lowercase
     * - `capitalize` - Capitalize first letter of each word
     * - `sentence` - Capitalize first letter only
     * - `title` - Title case
     *
     * **Length/Truncation:**
     * - `truncate[:N]` - Truncate to N characters (default 30)
     * - `ellipsis[:N]` - Truncate with "..." (default 30)
     * - `abbr[N]` - First N characters (abbr1, abbr2, abbr3, abbr4)
     *
     * **String Manipulation:**
     * - `replace:find:replacement` - Regex find and replace
     * - `trim` - Remove leading/trailing whitespace
     * - `prefix:text` - Add prefix
     * - `suffix:text` - Add suffix
     * - `pad:length:char` - Pad to length with character
     * - `slice:start[:end]` - Substring
     *
     * **Numbers:**
     * - `number[:precision]` - Format as number with optional decimal places
     *
     * **Arrays:**
     * - `count` - Array length
     * - `join[:delimiter]` - Join array with delimiter (default: comma)
     * - `split:delimiter` - Split string into array
     *
     * **Dates:**
     * - `date[:format]` - Format date (iso, short, long, year, month, day)
     *
     * **Specialized:**
     * - `titleword` - First significant word from title (skips stop words)
     * - `shorttitle` - First 3 significant words
     * - `json` - Convert to JSON string
     * - `urlencode` / `urldecode` - URL encoding
     *
     * **Random:**
     * - `rand[N]` - Random alphanumeric string of length N
     *
     * @param value - The value to format
     * @param format - The formatter name and optional parameters (e.g., "truncate:30")
     * @returns Formatted string
     * @private
     *
     * @example
     * ```typescript
     * formatValue('HELLO', 'lower');
     * // => "hello"
     *
     * formatValue('A Long Title Here', 'truncate:10');
     * // => "A Long Tit"
     *
     * formatValue('Smith', 'abbr3');
     * // => "Smi"
     *
     * formatValue(['a', 'b', 'c'], 'join: and ');
     * // => "a and b and c"
     * ```
     */
    private static formatValue(value: any, format: string): string {
        // Check for formatters with parameters (e.g. truncate:30)
        const formatParts = format.split(':');
        const formatName = formatParts[0];
        const formatArgs = formatParts.slice(1);
        
        // Check if this is a special "rand" formatter for random sequences
        if (formatName.startsWith('rand')) {
            // Extract the length from the format string (e.g., 'rand5' → length=5)
            const lengthMatch = formatName.match(/^rand(\d+)$/);
            if (lengthMatch) {
                const length = parseInt(lengthMatch[1], 10);
                return this.generateRandomString(length);
            }
        }

        // Get the string representation of the value for text operations
        const stringValue = String(value);
        
        // Process formatters with their potential arguments
        switch (formatName) {
            // Text case formatters
            case 'upper':
            case 'uppercase':
                return stringValue.toUpperCase();
                
            case 'lower':
            case 'lowercase':
                return stringValue.toLowerCase();
                
            case 'capitalize':
                return stringValue.replace(/(?:^|\s)\S/g, match => match.toUpperCase());
                
            case 'sentence':
                return stringValue.charAt(0).toUpperCase() + stringValue.slice(1);
                
            case 'title':
                return stringValue.replace(/(?:^|\s)\S/g, match => match.toUpperCase());
                
            // Length-based formatters
            case 'truncate':
                const length = formatArgs.length > 0 ? parseInt(formatArgs[0], 10) : 30;
                return stringValue.length > length 
                    ? stringValue.substring(0, length) 
                    : stringValue;
                
            case 'ellipsis':
                const maxLength = formatArgs.length > 0 ? parseInt(formatArgs[0], 10) : 30;
                return stringValue.length > maxLength 
                    ? stringValue.substring(0, maxLength) + '...'
                    : stringValue;
                
            // Content manipulation formatters
            case 'replace':
                if (formatArgs.length >= 2) {
                    const find = formatArgs[0];
                    const replace = formatArgs[1];
                    return stringValue.replace(new RegExp(find, 'g'), replace);
                }
                return stringValue;
                
            case 'trim':
                return stringValue.trim();
                
            case 'prefix':
                return formatArgs.length > 0 
                    ? formatArgs[0] + stringValue
                    : stringValue;
                
            case 'suffix':
                return formatArgs.length > 0 
                    ? stringValue + formatArgs[0]
                    : stringValue;
                
            case 'pad':
                if (formatArgs.length >= 2) {
                    const length = parseInt(formatArgs[0], 10);
                    const padChar = formatArgs[1] || ' ';
                    return stringValue.padStart(length, padChar);
                }
                return stringValue;
                
            case 'slice':
                if (formatArgs.length >= 2) {
                    const start = parseInt(formatArgs[0], 10);
                    const end = parseInt(formatArgs[1], 10);
                    return stringValue.slice(start, end);
                } else if (formatArgs.length == 1) {
                    const start = parseInt(formatArgs[0], 10);
                    return stringValue.slice(start);
                }
                return stringValue;
                
            // Number formatters
            case 'number':
                try {
                    const num = parseFloat(stringValue);
                    if (isNaN(num)) return stringValue;
                    
                    const precision = formatArgs.length > 0 
                        ? parseInt(formatArgs[0], 10)
                        : undefined;
                        
                    return precision !== undefined
                        ? num.toFixed(precision)
                        : num.toString();
                } catch (e) {
                    return stringValue;
                }
                
            // Data structure formatters
            case 'json':
                try {
                    return JSON.stringify(value);
                } catch (e) {
                    return '[Invalid JSON]';
                }
                
            case 'count':
                if (Array.isArray(value)) {
                    return String(value.length);
                }
                return '0';
                
            // Date formatters  
            case 'date':
                try {
                    const date = new Date(value);
                    if (formatArgs.length > 0) {
                        // Simple date format patterns
                        const format = formatArgs[0];
                        if (format === 'iso') return date.toISOString();
                        if (format === 'short') return date.toLocaleDateString();
                        if (format === 'long') return date.toLocaleDateString(undefined, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                        if (format === 'year') return date.getFullYear().toString();
                        if (format === 'month') return (date.getMonth() + 1).toString();
                        if (format === 'day') return date.getDate().toString();
                    }
                    return date.toLocaleDateString();
                } catch (e) {
                    return stringValue;
                }
                
            // Abbreviation formatters
            case 'abbr':
            case 'abbr1':
                return stringValue.charAt(0);
                
            case 'abbr2':
                return stringValue.substring(0, 2);
                
            case 'abbr3':
                return stringValue.substring(0, 3);
                
            case 'abbr4':
                return stringValue.substring(0, 4);
                
            // Specialized formatters
            case 'titleword':
                return this.extractTitleWord(stringValue, 1);
                
            case 'shorttitle':
                return this.extractTitleWord(stringValue, 3);
                
            // Split and join
            case 'split':
                if (formatArgs.length >= 1) {
                    const delimiter = formatArgs[0] || ',';
                    return stringValue.split(delimiter).join(',');
                }
                return stringValue;
                
            case 'join':
                if (Array.isArray(value) && formatArgs.length >= 1) {
                    const joinChar = formatArgs[0] || ',';
                    return value.join(joinChar);
                }
                return Array.isArray(value) ? value.join(',') : stringValue;
                
            // URL formatting
            case 'urlencode':
                return encodeURIComponent(stringValue);
                
            case 'urldecode':
                return decodeURIComponent(stringValue);
                
            default:
                // If format includes a colon but formatter isn't recognized
                if (formatParts.length > 1) {
                    return stringValue;
                }
                
                // Check for a truncate formatter with a number (truncate30)
                const truncateMatch = formatName.match(/^truncate(\d+)$/);
                if (truncateMatch) {
                    const truncateLength = parseInt(truncateMatch[1], 10);
                    return stringValue.length > truncateLength
                        ? stringValue.substring(0, truncateLength)
                        : stringValue;
                }
                
                // Check for an abbreviation formatter with a number (abbr5)
                const abbrMatch = formatName.match(/^abbr(\d+)$/);
                if (abbrMatch) {
                    const abbrLength = parseInt(abbrMatch[1], 10);
                    return stringValue.substring(0, abbrLength);
                }
                
                // If format is not recognized, return value as is
                return stringValue;
        }
    }
    
    /**
     * Extract the first N significant words from a title, excluding stop words.
     *
     * Used by the `titleword` and `shorttitle` formatters for citekey generation.
     * This method:
     * 1. Removes HTML tags from the title
     * 2. Splits into words
     * 3. Filters out common stop words (a, an, the, and, or, etc.)
     * 4. Takes first N significant words
     * 5. Joins them and removes punctuation
     * 6. Converts to lowercase
     *
     * If no significant words are found, falls back to using all words
     * (even stop words) to ensure a result is always returned.
     *
     * @param title - The title string to process
     * @param wordCount - Number of words to extract (default: 1)
     * @returns Lowercase string with first N significant words, no spaces
     * @private
     *
     * @example
     * ```typescript
     * extractTitleWord('The Art of Computer Programming', 1);
     * // => "art" (skips "the")
     *
     * extractTitleWord('A Study on Machine Learning', 3);
     * // => "studymachinelearning" (skips "a" and "on")
     *
     * extractTitleWord('An Introduction', 1);
     * // => "introduction" (skips "an")
     * ```
     */
    private static extractTitleWord(title: string, wordCount: number = 1): string {
        if (!title) {
            return '';
        }
        
        // Remove common HTML tags before splitting
        const cleanTitle = title.replace(/<[^>]+>/g, '');
        const titleWords = cleanTitle.split(/\s+/);
        
        // Common stop words to skip
        const skipWords = new Set([
            'a', 'an', 'the', 'and', 'or', 'but', 'on', 'in', 'at', 'to', 'for', 'with', 'of', 'from', 'by',
            'as', 'into', 'like', 'near', 'over', 'past', 'since', 'upon'
        ]);
        
        const significantWords = titleWords
            .map(word => word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')) // Remove punctuation
            .filter(word => word && !skipWords.has(word.toLowerCase()));
        
        let resultWords: string[];
        if (significantWords.length > 0) {
            resultWords = significantWords.slice(0, wordCount);
        } else if (titleWords.length > 0) {
            // Fallback: use first N words even if they're skip words
            resultWords = titleWords.slice(0, wordCount)
                .map(word => word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''))
                .filter(word => word);
        } else {
            return ''; // No title words found
        }
        
        // Combine words, lowercase, and sanitize according to Pandoc's rules
        const result = resultWords.join('').toLowerCase();
        
        // Only allow alphanumerics - we're stricter here since this is just for title words
        // The final citekey will be sanitized according to the full rules elsewhere
        return result.replace(/[^a-z0-9]/gi, '');
    }
    
    /**
     * Generate a cryptographically random alphanumeric string.
     *
     * Used by the `{{rand|N}}` template variable and `rand` formatter.
     * Useful for generating unique citekeys when collisions occur.
     *
     * The string contains only letters (a-z, A-Z) and digits (0-9).
     * Length is clamped between 1 and 32 characters for safety.
     *
     * @param length - Desired length of the random string (default: 5, max: 32)
     * @returns Random alphanumeric string
     * @private
     *
     * @example
     * ```typescript
     * generateRandomString(5);
     * // => "aB3xQ" (example, actual output is random)
     *
     * generateRandomString(10);
     * // => "k2JhP9mNz4" (example)
     * ```
     */
    private static generateRandomString(length: number = 5): string {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        
        // Ensure length is valid
        const finalLength = Math.max(1, Math.min(32, length));
        
        for (let i = 0; i < finalLength; i++) {
            const randomIndex = Math.floor(Math.random() * chars.length);
            result += chars.charAt(randomIndex);
        }
        
        return result;
    }
}