/**
 * Unified Template Engine for BibLib
 * 
 * Provides a consistent rendering system for all templated content:
 * - Custom frontmatter fields
 * - Header templates
 * - Citekey generation
 */
import { processYamlArray } from './yaml-utils';

export interface TemplateOptions {
    /** Whether to sanitize output for citekeys (alphanumeric only) */
    sanitizeForCitekey?: boolean;
    /** Whether to render as YAML array format */
    yamlArray?: boolean;
}

export class TemplateEngine {
    /**
     * Render a template with the given variables and options
     * 
     * @param template The template string
     * @param variables Object containing variable values
     * @param options Template processing options
     * @returns Rendered string
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
     * Process positive conditional blocks {{#variable}}content{{/variable}}
     * Also handles iteration if the variable is an array
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
     * Process negative conditional blocks {{^variable}}content{{/variable}}
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
     * Get a value from nested object properties using dot notation
     * Example: 'user.profile.name' gets variables.user.profile.name
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
     * Format a value based on specified format
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
     * Extract the first N significant words from a title
     * Used for titleword and shorttitle formatters
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
     * Generate a random alphanumeric string of the specified length
     * Used for the rand formatter
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