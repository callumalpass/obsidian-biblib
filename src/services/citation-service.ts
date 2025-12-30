import Cite from 'citation-js';
import '@citation-js/plugin-bibtex';
// Import date functions if available, otherwise provide simple fallbacks
// You might need to install this: npm install @citation-js/date
import { parse as parseDate } from '@citation-js/date';
import { Citation, CslName, CslDate, ZoteroItem, ZoteroCreator } from '../types/citation';
import {
    ZOTERO_TYPES_TO_CSL,
    EXTRA_FIELDS_CSL_MAP,
    PRESERVE_CASE_FIELDS,
    FIELD_MAPPINGS,
    FieldMapping,
    ConverterType
} from '../data/zotero-mappings';

// Fallback date parser if @citation-js/date is not available or fails
const simpleParseDateFallback = (dateString: string): { 'date-parts': number[][] } | { 'raw': string } | undefined => {
    if (!dateString) return undefined;
    // Try YYYY-MM-DD, YYYY/MM/DD, YYYY-MM, YYYY/MM, YYYY
    const isoMatch = dateString.match(/^(\d{4})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        if (!isNaN(year)) {
            const dateParts: number[][] = [[year]];
            if (isoMatch[2]) {
                const month = parseInt(isoMatch[2], 10);
                if (!isNaN(month)) dateParts[0].push(month);
            }
            if (isoMatch[3]) {
                const day = parseInt(isoMatch[3], 10);
                if (!isNaN(day) && dateParts[0].length === 2) dateParts[0].push(day);
            }
            return { 'date-parts': dateParts };
        }
    }
    // If it doesn't look like a structured date, return raw
    return { 'raw': dateString };
};

const parseDateRobust = (dateStr: string | undefined | any): any => {
    if (!dateStr) return undefined;
    
    // Function to return current date in CSL format
    const getCurrentDate = () => {
        const now = new Date();
        return { 
            'date-parts': [[
                now.getFullYear(), 
                now.getMonth() + 1, // JavaScript months are 0-indexed
                now.getDate()
            ]] 
        };
    };
    
    // Check for various forms of current date markers
    // 1. String values
    if (typeof dateStr === 'string') {
        if (dateStr === "CURRENT" || dateStr === "CURREN" || dateStr === "CURRENT_DATE") {
            return getCurrentDate();
        }
    } 
    // 2. Objects with special properties
    else if (typeof dateStr === 'object' && dateStr !== null) {
        // Check if it's an object with a raw property containing a current date marker
        if ('raw' in dateStr && typeof dateStr.raw === 'string' && 
            (dateStr.raw === "CURRENT" || dateStr.raw === "CURREN" || dateStr.raw === "CURRENT_DATE")) {
            return getCurrentDate();
        }
        // Check if it's a CURRENT_DATE object
        else if ('CURRENT_DATE' in dateStr || dateStr.constructor?.name === 'CURRENT_DATE') {
            return getCurrentDate();
        }
        // Check if it's the exact object named CURRENT_DATE or contains that string
        else if (Object.prototype.toString.call(dateStr) === '[object CURRENT_DATE]' ||
                String(dateStr).includes('CURRENT_DATE')) {
            return getCurrentDate();
        }
    }
    
    try {
        // Handle object or string input appropriately
        let dateString: string;
        if (typeof dateStr === 'string') {
            dateString = dateStr;
        } else if (typeof dateStr === 'object' && dateStr !== null && 'raw' in dateStr && typeof dateStr.raw === 'string') {
            dateString = dateStr.raw;
        } else {
            console.warn(`Unable to process date: ${JSON.stringify(dateStr)}`);
            return { 'raw': String(dateStr) };
        }
        
        // @citation-js/date expects YYYY-MM-DD format primarily
        const datePart = dateString.split('T')[0];
        // Basic validation before passing to parseDate
        if (/^\d{4}(?:-\d{1,2}(?:-\d{1,2})?)?$/.test(datePart)) {
             // Use @citation-js/date if available and format matches
            if (typeof parseDate === 'function') {
                const parsed = parseDate(datePart);
                // Check if parseDate returned a valid structure
                if (parsed && parsed['date-parts'] && parsed['date-parts'][0] && parsed['date-parts'][0][0]) {
                    return parsed;
                }
            }
        }
        // Fallback for other formats or if parseDate failed/unavailable
        return simpleParseDateFallback(datePart);
    } catch (e) {
        console.warn(`Date parsing failed for "${dateStr}", using fallback:`, e);
        // Safely handle string conversion for error output
        const safeStr = typeof dateStr === 'string' ? dateStr : 
                       (typeof dateStr === 'object' && dateStr !== null && 'raw' in dateStr) ? 
                       String(dateStr.raw) : String(dateStr);
        
        // Try to get a string to parse as fallback
        let fallbackStr = "";
        if (typeof dateStr === 'string') {
            fallbackStr = dateStr;
        } else if (typeof dateStr === 'object' && dateStr !== null && 'raw' in dateStr && typeof dateStr.raw === 'string') {
            fallbackStr = dateStr.raw;
        } else {
            return { 'raw': String(dateStr) };
        }
        
        return simpleParseDateFallback(fallbackStr.split('T')[0]);
    }
};
// --- End Date Handling ---

import { CitoidService } from './api/citoid'; // Adjust path if needed
import { Notice } from 'obsidian';
import { CitekeyGenerator } from '../utils/citekey-generator'; // Adjust path if needed


// --- Zotero to CSL Mapping Logic (Full Adaptation) ---
// Type mappings and field mappings are now loaded from src/data/zotero-mappings.json

const mapZoteroCreatorToCsl = (creator: any): { literal: string } | { family: string, given?: string } | undefined => {
    if (!creator) return undefined;
    
    // Handle institutional authors or single-field names
    if (creator.name) return { literal: creator.name };
    
    // Handle individual authors with first/last names
    if (creator.lastName || creator.firstName) {
        const cslCreator: { family: string, given?: string } = {
            family: creator.lastName || "",
        };
        if (creator.firstName) {
            cslCreator.given = creator.firstName;
        }
        return cslCreator;
    }
    
    // Handle web-specific author formats
    if (creator.fullName) return { literal: creator.fullName };
    if (creator.displayName) return { literal: creator.displayName };
    if (creator.text) return { literal: creator.text };
    
    // Try to extract any name-like fields
    for (const field of ['fullName', 'displayName', 'name', 'author', 'text', 'byline']) {
        if (creator[field]) return { literal: creator[field] };
    }
    
    // Last resort: if creator is just a string
    if (typeof creator === 'string') return { literal: creator };
    
    return undefined; // Invalid creator structure
};

// Converter functions for field transformations
const ZOTERO_CONVERTERS: Record<ConverterType, { toTarget: (value: unknown) => unknown }> = {
    DATE: {
        toTarget: (date: unknown): CslDate | undefined => {
            return parseDateRobust(date as string | undefined);
        }
    },
    CREATORS: {
        toTarget: (creators: unknown): CslName[] | undefined => {
            if (!creators || !Array.isArray(creators)) return undefined;
            return creators
                .map(mapZoteroCreatorToCsl)
                .filter((c): c is NonNullable<typeof c> => c !== undefined) as CslName[];
        }
    },
    TAGS: {
        toTarget: (tags: unknown): string | undefined => {
            if (!tags || !Array.isArray(tags)) return undefined;
            return tags.length > 0 ? tags.map((tag: { tag: string }) => tag.tag).join(', ') : undefined;
        }
    },
    TYPE: {
        toTarget: (type: unknown): string => ZOTERO_TYPES_TO_CSL[type as string] || 'document'
    }
};

/**
 * Get the appropriate converter function for a field mapping
 */
function getConverter(converterType: ConverterType | undefined): ((value: unknown) => unknown) | undefined {
    if (!converterType) return undefined;
    return ZOTERO_CONVERTERS[converterType]?.toTarget;
}

function parseExtraField(extraString: string | undefined): Record<string, unknown> {
    if (!extraString) return {};
    const fields: Record<string, any> = {};
    const lines = extraString.trim().split('\n');

    for (const line of lines) {
        const parts = line.split(': ');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            // Handle potential quotes around value, especially if it contains newlines itself
            let value = parts.slice(1).join(': ').trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1).replace(/\\n/g, '\n');
            }

            // Determine correct key name and case
            let cslKey;
            if (EXTRA_FIELDS_CSL_MAP[key]) {
                cslKey = EXTRA_FIELDS_CSL_MAP[key];
            } else if (PRESERVE_CASE_FIELDS.includes(key)) {
                cslKey = key; // Preserve exact case for special fields
            } else if (PRESERVE_CASE_FIELDS.some(field => field.toLowerCase() === key.toLowerCase())) {
                // Find the correct case version if a case-insensitive match exists
                cslKey = PRESERVE_CASE_FIELDS.find(field => field.toLowerCase() === key.toLowerCase()) || key;
            } else {
                // Default to lowercase with hyphens for spaces
                cslKey = key.toLowerCase().replace(/\s+/g, '-');
            }

            // Basic type detection (can be enhanced)
            if (cslKey.toLowerCase().includes('date') || key.toLowerCase().includes('date')) {
                 const parsedDate = parseDateRobust(value);
                 // Check if parsing yielded a standard CSL date structure
                 if (parsedDate && (parsedDate['date-parts'] || parsedDate['raw'] || parsedDate['literal'])) {
                     fields[cslKey] = parsedDate;
                 } else {
                     fields[cslKey] = value; // Keep raw value if parsing fails completely
                 }
            } else {
                fields[cslKey] = value;
            }
        }
    }
    return fields;
}
// --- End Extra Field Parsing ---


// --- Citation Service Class ---
export class CitationService {
    private citoid: CitoidService;
    private citekeyOptions: any;

    constructor(citekeyOptions?: any) {
        this.citoid = new CitoidService();
        this.citekeyOptions = citekeyOptions || CitekeyGenerator.defaultOptions;
    }

    /**
     * Fetch normalized CSL-JSON for an identifier (DOI, URL, ISBN) via Citoid (BibTeX)
     */
    async fetchNormalized(id: string): Promise<any> {
        try {
            const bibtex = await this.citoid.fetchBibTeX(id);
            const cite = new Cite(bibtex);
            const jsonString = cite.get({ style: 'csl', type: 'string' });
            const data = JSON.parse(jsonString);
            let entry = Array.isArray(data) ? data[0] : data;

            // Post-process entry fetched via BibTeX if needed (e.g., ensure type exists)
            if (!entry) {
                 throw new Error("Citoid returned empty or invalid data.");
            }
            entry.type = entry.type || 'document'; // Ensure type exists


            // Generate citekey if no ID came from BibTeX or if it looks invalid
            if (!entry.id || typeof entry.id !== 'string' || entry.id.trim() === '') {
                entry.id = CitekeyGenerator.generate(entry, this.citekeyOptions);
            }
            // Optionally prefix non-Zotero IDs if desired, e.g.,
            // else { entry.id = `bib_${entry.id}`; }

            return entry;
        } catch (e: any) {
            console.error(`Error fetching/parsing BibTeX from Citoid for ID [${id}]:`, e);
            new Notice(`Error fetching citation data for ${id}. ${e.message || ''}`);
            throw e;
        }
    }

    /**
     * Parse BibTeX string directly using Citation.js
     */
    parseBibTeX(bibtex: string): any {
        try {
            const cite = new Cite(bibtex);
            const jsonString = cite.get({ style: 'csl', type: 'string' });
            const data = JSON.parse(jsonString);
            let entry = Array.isArray(data) ? data[0] : data;

            if (!entry) {
                 throw new Error("Parsed BibTeX resulted in empty data.");
            }
            entry.type = entry.type || 'document'; // Ensure type exists

            // Generate citekey if needed
            if (!entry.id || typeof entry.id !== 'string' || entry.id.trim() === '') {
                entry.id = CitekeyGenerator.generate(entry, this.citekeyOptions);
            }
             // Optionally prefix non-Zotero IDs if desired

            return entry;
        } catch (e: any) {
            console.error('Error parsing BibTeX:', e);
            new Notice(`Error parsing BibTeX. ${e.message || ''}`);
            throw e;
        }
    }

    /**
     * Parse Zotero JSON data using the robust custom mapping.
     */
    parseZoteroItem(zoteroItem: any): any {
        if (!zoteroItem || typeof zoteroItem !== 'object') {
            console.error('Invalid Zotero item provided:', zoteroItem);
            new Notice('Cannot process invalid Zotero item data.');
            throw new Error('Invalid Zotero item provided.');
        }
        
        // Special check for creators
        if (!zoteroItem.creators || !Array.isArray(zoteroItem.creators) || zoteroItem.creators.length === 0) {
            // For web pages and news articles, try to infer creators from other fields
            if (zoteroItem.itemType === 'webpage' || zoteroItem.itemType === 'newspaperArticle') {
                // Look for byline, author, or other possible fields
                if (zoteroItem.byline) {
                    zoteroItem.creators = [{ 
                        creatorType: 'author', 
                        name: zoteroItem.byline 
                    }];
                } else if (zoteroItem.extra && zoteroItem.extra.includes('Author:')) {
                    // Try to extract author from extra field
                    const match = /Author:\s*([^\n]+)/i.exec(zoteroItem.extra);
                    if (match && match[1]) {
                        zoteroItem.creators = [{ 
                            creatorType: 'author', 
                            name: match[1].trim() 
                        }];
                    }
                }
            }
        }

        try {
            // Use the robust direct mapping
            const cslData = this.mapZoteroToCslRobust(zoteroItem);

            // --- Citekey Handling ---
            let generatedCitekey = false;
            // Prefer Zotero key if configured and available
            if (cslData._zoteroKey && this.citekeyOptions.useZoteroKeys) {
                cslData.id = cslData._zoteroKey;
            } else {
                // Generate if no ID exists after mapping OR if ID came from Zotero key but we DON'T want it
                 if (!cslData.id || cslData.id === cslData._zoteroKey) {
                    cslData.id = CitekeyGenerator.generate(cslData, this.citekeyOptions);
                    generatedCitekey = true;
                 }
            }
            // Clean up temporary key
            delete cslData._zoteroKey;
            // If we generated a key, ensure it doesn't conflict with a potential DOI etc.
            // This is a simplistic check; real collision handling might be needed
            if (generatedCitekey && (cslData.id === cslData.DOI || cslData.id === cslData.URL)) {
                 console.warn(`Generated citekey ${cslData.id} conflicts with DOI/URL. Consider refining generation pattern.`);
            }


            // --- Optional: Integrate "Extra" field post-processing ---
            if (cslData._extraFieldContent) {
                const extraCslFields = parseExtraField(cslData._extraFieldContent);
                // Merge extra fields. Be careful about overwriting crucial fields like 'type' or 'id'
                // unless specifically intended by the 'extra' field content.
                for (const key in extraCslFields) {
                    if (key !== 'id' && key !== 'type') { // Protect essential fields
                         cslData[key] = extraCslFields[key];
                    } else if (key === 'type' && extraCslFields[key]) {
                         // Allow type override from extra if valid CSL type? Risky.
                         console.warn(`Type override attempted via 'extra' field: ${extraCslFields[key]}`);
                         // cslData[key] = extraCslFields[key]; // Uncomment cautiously
                    }
                }
                delete cslData._extraFieldContent; // Clean up
            }
            // --- End Extra Field Handling ---


            // Final check for essential fields
             if (!cslData.type) cslData.type = 'document'; // Ensure type exists
             if (!cslData.id) { // Should have been generated by now, but as a last resort
                 console.warn("CSL data missing ID after all processing, generating fallback.");
                 cslData.id = CitekeyGenerator.generate(cslData, this.citekeyOptions);
             }


            return cslData;

        } catch (e: any) {
            console.error('Error mapping Zotero item to CSL:', e);
            console.error('Problematic Zotero Item:', JSON.stringify(zoteroItem, null, 2)); // Log item for debugging

            // Minimal Fallback: Try Citation.js internal parsing (often less accurate for Zotero)
             try {
                console.warn("Falling back to Citation.js internal parsing for Zotero data (may be inaccurate).");
                const cite = new Cite([zoteroItem], { forceType: '@zotero/json' }); // Hint type if possible
                const jsonString = cite.get({ style: 'csl', type: 'string' });
                const data = JSON.parse(jsonString);
                let entry = Array.isArray(data) ? data[0] : data;

                if (!entry) {
                    throw new Error("Citation.js fallback resulted in empty data.");
                }

                 // Ensure type exists
                entry.type = entry.type || 'document';

                 // Handle ID from fallback
                if (!entry.id || typeof entry.id !== 'string' || entry.id.trim() === '') {
                    entry.id = CitekeyGenerator.generate(entry, this.citekeyOptions);
                } else if (entry.id === zoteroItem.key && !this.citekeyOptions.useZoteroKeys){
                    // Regenerate if ID came from Zotero key but we don't want it
                    entry.id = CitekeyGenerator.generate(entry, this.citekeyOptions);
                }

                return entry;
             } catch(fallbackError: any) {
                console.error('Citation.js fallback also failed:', fallbackError);
                new Notice(`Error processing Zotero data: ${e.message || 'Mapping failed'}. Fallback failed.`);
                // Decide whether to throw original error or fallback error
                throw e; // Re-throw the original mapping error as it's likely more informative
             }
        }
    }


    /**
     * Robustly map Zotero item data to CSL-JSON format using detailed rules.
     */
    private mapZoteroToCslRobust(item: any): Record<string, any> {
        const csl: Record<string, any> = {};

        // 1. Determine Target CSL Type (needed for conditional mapping)
        const targetType = ZOTERO_TYPES_TO_CSL[item.itemType] || 'document';
        // Set type early, might be overridden by 'extra' field later if allowed
        csl.type = targetType;
        
        // Direct handling for accessDate special cases (CURREN, CURRENT, CURRENT_DATE)
        const isTodayDate = (val: any): boolean => {
            if (!val) return false;
            
            // String checks
            if (typeof val === 'string') {
                return val === "CURREN" || val === "CURRENT" || val === "CURRENT_DATE";
            }
            
            // Object checks
            if (typeof val === 'object' && val !== null) {
                // Check raw property
                if ('raw' in val && typeof val.raw === 'string') {
                    return val.raw === "CURREN" || val.raw === "CURRENT" || val.raw === "CURRENT_DATE";
                }
                
                // Check for CURRENT_DATE object/property
                return 'CURRENT_DATE' in val || 
                       val.constructor?.name === 'CURRENT_DATE' || 
                       String(val).includes('CURRENT_DATE') ||
                       Object.prototype.toString.call(val) === '[object CURRENT_DATE]';
            }
            
            return false;
        };
        
        if (isTodayDate(item.accessDate)) {
            // console.log("Special handling for current date in accessDate:", item.accessDate);
            const now = new Date();
            csl.accessed = { 
                'date-parts': [[now.getFullYear(), now.getMonth() + 1, now.getDate()]] 
            };
        }

        // 2. Prepare Source Data (Group creators for easy access by Zotero field name)
        const sourceData: Record<string, any> = { ...item }; // Shallow copy item
        const creatorsBySourceField: Record<string, any[]> = {};
        if (item.creators && Array.isArray(item.creators)) {
            item.creators.forEach((creator: any) => {
                // Use the specific Zotero creatorType field name (e.g., 'author', 'editor', 'bookAuthor')
                const creatorSourceField = creator.creatorType;
                if (creatorSourceField && typeof creatorSourceField === 'string') {
                    if (!creatorsBySourceField[creatorSourceField]) {
                        creatorsBySourceField[creatorSourceField] = [];
                    }
                    creatorsBySourceField[creatorSourceField].push(creator);
                } else {
                    // Handle creators without a type - perhaps map to 'author' or 'contributor'?
                    const defaultField = 'author';
                     if (!creatorsBySourceField[defaultField]) {
                        creatorsBySourceField[defaultField] = [];
                    }
                    creatorsBySourceField[defaultField].push(creator);
                    console.warn("Zotero creator found without creatorType:", creator);
                }
            });
        }
        // Add special handling for news articles / web pages
        if (item.itemType === 'newspaperArticle' || item.itemType === 'webpage') {
            // Try to extract authors from other fields for news sources
            if ((!creatorsBySourceField.author || creatorsBySourceField.author.length === 0) && 
                (!creatorsBySourceField.reporter || creatorsBySourceField.reporter.length === 0)) {
                
                // If we have byline or bylineHtml fields (common in news sites)
                if (item.byline) {
                    creatorsBySourceField.author = [{ 
                        creatorType: 'author', 
                        name: item.byline 
                    }];
                }
                // Check for creator array in original form
                else if (item.creators && Array.isArray(item.creators) && item.creators.length) {
                    // Process creators array differently than the default approach
                    for (const creator of item.creators) {
                        const field = creator.creatorType || 'author';
                        if (!creatorsBySourceField[field]) {
                            creatorsBySourceField[field] = [];
                        }
                        creatorsBySourceField[field].push(creator);
                    }
                }
            }
        }
        
        // Add the grouped creators back to sourceData, overwriting the original array
        Object.assign(sourceData, creatorsBySourceField);
        delete sourceData.creators; // Clean up original array key

        // 3. Apply Mappings Iteratively (using FIELD_MAPPINGS from JSON)
        FIELD_MAPPINGS.forEach((rule: FieldMapping) => {
            // Check 'whenItemType' condition against original Zotero itemType
            let applies = true;
            if (rule.whenItemType) {
                if (!rule.whenItemType.includes(item.itemType)) {
                    applies = false;
                }
            }

            if (applies) {
                const sourceValue = sourceData[rule.source];

                // Proceed only if the source field exists and has a value
                if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
                    let targetValue: unknown = sourceValue; // Default to direct copy

                    // Apply converter if specified
                    const converter = getConverter(rule.converter);
                    if (converter) {
                        try {
                            targetValue = converter(sourceValue);
                        } catch(convertError: unknown) {
                            const errorMessage = convertError instanceof Error ? convertError.message : String(convertError);
                            console.warn(`Converter error for field "${rule.source}" -> "${rule.target}":`, errorMessage, " Raw value:", sourceValue);
                            targetValue = undefined; // Skip assignment if converter fails
                        }
                    }

                    // Assign to CSL object if the final value is valid
                    if (targetValue !== undefined && targetValue !== null) {
                         // Handle special flags
                         if (rule.zoteroOnly) {
                             if (rule.source === 'key') csl._zoteroKey = targetValue;
                         } else if (rule.extraField) {
                              if (rule.source === 'extra') csl._extraFieldContent = targetValue;
                         } else {
                            // Preserve case for special fields
                            let targetKey = rule.target;
                            if (PRESERVE_CASE_FIELDS.some(field => field.toLowerCase() === targetKey.toLowerCase())) {
                                targetKey = PRESERVE_CASE_FIELDS.find(field =>
                                    field.toLowerCase() === targetKey.toLowerCase()) || targetKey;
                            }

                            csl[targetKey] = targetValue;
                         }
                    }
                }
            }
        });

        // 4. Post-processing and Fallbacks within the robust mapper
        // Example: Ensure 'issued' exists if only 'year' was provided directly in Zotero data
        if (!csl.issued && item.year) {
             const yearNum = parseInt(item.year, 10);
             if (!isNaN(yearNum)) {
                 csl.issued = { 'date-parts': [[yearNum]] };
             }
        }
        // Example: If CSL type is 'song' but no 'author' mapped, try mapping 'performer' to 'author' as a fallback
        if (csl.type === 'song' && !csl.author && csl.performer) {
             csl.author = csl.performer;
             // Optionally delete csl.performer if you only want one primary creator role listed
        }
        // Add more specific post-processing rules as needed

        // Final case correction for any special fields that might have been missed or set elsewhere
        PRESERVE_CASE_FIELDS.forEach(field => {
            const lowerField = field.toLowerCase();
            // If we have this field but with wrong case
            if (csl[lowerField] !== undefined && csl[field] === undefined) {
                csl[field] = csl[lowerField];
                delete csl[lowerField];
            }
        });
        
        // Special handling for accessed date - ensure it has proper date-parts structure
        if (csl.accessed) {
            const isCurrentDateFormat = (val: any): boolean => {
                if (typeof val !== 'object' || val === null) return false;
                
                // Check for raw property with current date value
                if ('raw' in val && typeof val.raw === 'string') {
                    return val.raw === "CURREN" || val.raw === "CURRENT" || val.raw === "CURRENT_DATE";
                }
                
                // Check for CURRENT_DATE object or property
                return 'CURRENT_DATE' in val || 
                       val.constructor?.name === 'CURRENT_DATE' || 
                       String(val).includes('CURRENT_DATE') ||
                       Object.prototype.toString.call(val) === '[object CURRENT_DATE]';
            };
            
            if (isCurrentDateFormat(csl.accessed)) {
                // console.log("Post-processing fixing current date in accessed field:", csl.accessed);
                const now = new Date();
                csl.accessed = { 
                    'date-parts': [[now.getFullYear(), now.getMonth() + 1, now.getDate()]] 
                };
            }
        }

        return csl;
    }
}
