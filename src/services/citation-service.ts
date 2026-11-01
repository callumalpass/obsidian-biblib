import Cite from 'citation-js';
import '@citation-js/plugin-bibtex';
import { Citation, CslName, CslDate, ZoteroItem, ZoteroCreator } from '../types/citation';
import {
    ZOTERO_TYPES_TO_CSL,
    EXTRA_FIELDS_CSL_MAP,
    PRESERVE_CASE_FIELDS,
    FIELD_MAPPINGS,
    FieldMapping,
    ConverterType
} from '../data/zotero-mappings';
import { DateParser } from '../utils/date-parser';
import { CitoidService } from './api/citoid';
import { Notice } from 'obsidian';
import { CitekeyGenerator } from '../utils/citekey-generator'; // Adjust path if needed
import { CitekeyOptions } from '../types/settings';
import { CSL_TYPES } from '../utils/csl-variables';
import { asString, errorMessage, formatUnknown, getString, isRecord } from '../utils/type-guards';


// --- Zotero to CSL Mapping Logic (Full Adaptation) ---
// Type mappings and field mappings are now loaded from src/data/zotero-mappings.json

type MutableCitation = Partial<Citation> & Record<string, unknown>;

const toCslType = (value: unknown): Citation['type'] => {
    return typeof value === 'string' && (CSL_TYPES as readonly string[]).includes(value)
        ? value as Citation['type']
        : 'document';
};

const mapZoteroCreatorToCsl = (creator: unknown): { literal: string } | { family: string, given?: string } | undefined => {
    if (typeof creator === 'string') return { literal: creator };
    if (!isRecord(creator)) return undefined;
    
    // Handle institutional authors or single-field names
    const name = getString(creator, 'name');
    if (name) return { literal: name };
    
    // Handle individual authors with first/last names
    const lastName = getString(creator, 'lastName');
    const firstName = getString(creator, 'firstName');
    if (lastName || firstName) {
        const cslCreator: { family: string, given?: string } = {
            family: lastName || "",
        };
        if (firstName) {
            cslCreator.given = firstName;
        }
        return cslCreator;
    }
    
    // Handle web-specific author formats
    const fullName = getString(creator, 'fullName');
    if (fullName) return { literal: fullName };
    const displayName = getString(creator, 'displayName');
    if (displayName) return { literal: displayName };
    const text = getString(creator, 'text');
    if (text) return { literal: text };
    
    // Try to extract any name-like fields
    for (const field of ['fullName', 'displayName', 'name', 'author', 'text', 'byline']) {
        const value = getString(creator, field);
        if (value) return { literal: value };
    }

    return undefined; // Invalid creator structure
};

// Converter functions for field transformations
const ZOTERO_CONVERTERS: Record<ConverterType, { toTarget: (value: unknown) => unknown }> = {
    DATE: {
        toTarget: (date: unknown): CslDate | undefined => {
            return DateParser.toCslDate(DateParser.parse(date));
        }
    },
    CREATORS: {
        toTarget: (creators: unknown): CslName[] | undefined => {
            if (!creators || !Array.isArray(creators)) return undefined;
            return creators
                .map(mapZoteroCreatorToCsl)
                .filter((c): c is NonNullable<typeof c> => c !== undefined);
        }
    },
    TAGS: {
        toTarget: (tags: unknown): string | undefined => {
            if (!tags || !Array.isArray(tags)) return undefined;
            const tagNames = tags
                .filter(isRecord)
                .map((tag) => getString(tag, 'tag'))
                .filter((tag): tag is string => Boolean(tag));
            return tagNames.length > 0 ? tagNames.join(', ') : undefined;
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
    const fields: Record<string, unknown> = {};
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
            let cslKey: string;
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
                const cslDate = DateParser.toCslDate(DateParser.parse(value));
                // Check if parsing yielded a standard CSL date structure
                if (cslDate && (cslDate['date-parts'] || cslDate['raw'] || cslDate['literal'])) {
                    fields[cslKey] = cslDate;
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
    private citekeyOptions: CitekeyOptions;

    constructor(citekeyOptions?: CitekeyOptions) {
        this.citoid = new CitoidService();
        this.citekeyOptions = citekeyOptions || CitekeyGenerator.defaultOptions;
    }

    private normalizeCitationData(data: unknown, emptyMessage: string): Citation {
        const rawEntry: unknown = Array.isArray(data) ? (data as unknown[])[0] : data;
        if (!isRecord(rawEntry)) {
            throw new Error(emptyMessage);
        }

        const entry: MutableCitation = { ...rawEntry };
        entry.type = toCslType(entry.type);

        const entryId = asString(entry.id);
        if (!entryId || entryId.trim() === '') {
            entry.id = CitekeyGenerator.generate(entry, this.citekeyOptions);
        }

        if (!asString(entry.title)) {
            entry.title = asString(entry.id) || 'Untitled';
        }

        return entry as Citation;
    }

    /**
     * Fetch normalized CSL-JSON for an identifier (DOI, URL, ISBN) via Citoid (BibTeX)
     */
    async fetchNormalized(id: string): Promise<Citation> {
        try {
            const bibtex = await this.citoid.fetchBibTeX(id);
            const cite = new Cite(bibtex);
            const jsonString = cite.get({ style: 'csl', type: 'string' }) as unknown;
            if (typeof jsonString !== 'string') {
                throw new Error('Citoid returned non-string citation data.');
            }
            const data: unknown = JSON.parse(jsonString);
            const entry = this.normalizeCitationData(data, 'Citoid returned empty or invalid data.');

            // The id here is the BibTeX label Citoid made up (e.g. smith_title_2020), not the
            // user's key: apply the citekey template unless "Use Zotero keys" is on.
            if (!this.citekeyOptions.useZoteroKeys) {
                entry.id = CitekeyGenerator.generate(entry, this.citekeyOptions);
                delete (entry as MutableCitation)['citation-key'];
            }

            return entry;
        } catch (error: unknown) {
            console.error(`Error fetching/parsing BibTeX from Citoid for ID [${id}]:`, error);
            new Notice(`Error fetching citation data for ${id}. ${errorMessage(error)}`);
            throw error;
        }
    }

    /**
     * Parse BibTeX string directly using Citation.js
     */
    parseBibTeX(bibtex: string): Citation {
        try {
            const cite = new Cite(bibtex);
            const jsonString = cite.get({ style: 'csl', type: 'string' }) as unknown;
            if (typeof jsonString !== 'string') {
                throw new Error('BibTeX parser returned non-string citation data.');
            }
            const data: unknown = JSON.parse(jsonString);
            const entry = this.normalizeCitationData(data, 'Parsed BibTeX resulted in empty data.');
             // Optionally prefix non-Zotero IDs if desired

            return entry;
        } catch (error: unknown) {
            console.error('Error parsing BibTeX:', error);
            new Notice(`Error parsing BibTeX. ${errorMessage(error)}`);
            throw error;
        }
    }

    /**
     * Parse Zotero JSON data using the robust custom mapping.
     */
    parseZoteroItem(zoteroItem: ZoteroItem): Citation {
        if (!isRecord(zoteroItem)) {
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
            const zoteroKey = asString(cslData._zoteroKey);
            if (zoteroKey && this.citekeyOptions.useZoteroKeys) {
                cslData.id = zoteroKey;
            } else {
                // Generate if no ID exists after mapping OR if ID came from Zotero key but we DON'T want it
                 if (!cslData.id || cslData.id === zoteroKey) {
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
            const extraFieldContent = asString(cslData._extraFieldContent);
            if (extraFieldContent) {
                const extraCslFields = parseExtraField(extraFieldContent);
                // Merge extra fields. Be careful about overwriting crucial fields like 'type' or 'id'
                // unless specifically intended by the 'extra' field content.
                for (const key in extraCslFields) {
                    if (key !== 'id' && key !== 'type') { // Protect essential fields
                         cslData[key] = extraCslFields[key];
                    } else if (key === 'type' && extraCslFields[key]) {
                         // Allow type override from extra if valid CSL type? Risky.
                         console.warn(`Type override attempted via 'extra' field: ${formatUnknown(extraCslFields[key])}`);
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


            if (!asString(cslData.title)) {
                cslData.title = asString(zoteroItem.title) || asString(cslData.id) || 'Untitled';
            }

            return cslData as Citation;

        } catch (error: unknown) {
            console.error('Error mapping Zotero item to CSL:', error);
            console.error('Problematic Zotero Item:', JSON.stringify(zoteroItem, null, 2)); // Log item for debugging

            // Minimal Fallback: Try Citation.js internal parsing (often less accurate for Zotero)
             try {
                console.warn("Falling back to Citation.js internal parsing for Zotero data (may be inaccurate).");
                const cite = new Cite([zoteroItem], { forceType: '@zotero/json' }); // Hint type if possible
                const jsonString = cite.get({ style: 'csl', type: 'string' }) as unknown;
                if (typeof jsonString !== 'string') {
                    throw new Error('Citation.js fallback returned non-string citation data.');
                }
	                const data: unknown = JSON.parse(jsonString);
	                const entry = this.normalizeCitationData(data, 'Citation.js fallback resulted in empty data.');

                 // Handle ID from fallback
	                if (!entry.id || typeof entry.id !== 'string' || entry.id.trim() === '') {
	                    entry.id = CitekeyGenerator.generate(entry, this.citekeyOptions);
	                } else if (entry.id === zoteroItem.key && !this.citekeyOptions.useZoteroKeys){
                    // Regenerate if ID came from Zotero key but we don't want it
                    entry.id = CitekeyGenerator.generate(entry, this.citekeyOptions);
                }

                return entry;
	             } catch(fallbackError: unknown) {
	                console.error('Citation.js fallback also failed:', fallbackError);
	                new Notice(`Error processing Zotero data: ${errorMessage(error)}. Fallback failed.`);
	                // Decide whether to throw original error or fallback error
	                throw error; // Re-throw the original mapping error as it's likely more informative
	             }
        }
    }


    /**
     * Robustly map Zotero item data to CSL-JSON format using detailed rules.
     */
    private mapZoteroToCslRobust(item: ZoteroItem): MutableCitation {
        const csl: MutableCitation = {};

        // 1. Determine Target CSL Type (needed for conditional mapping)
        const targetType = toCslType(ZOTERO_TYPES_TO_CSL[item.itemType]);
        // Set type early, might be overridden by 'extra' field later if allowed
        csl.type = targetType;
        
        // Direct handling for accessDate special cases (CURREN, CURRENT, CURRENT_DATE)
        const isTodayDate = (val: unknown): boolean => {
            if (!val) return false;
            
            // String checks
            if (typeof val === 'string') {
                return val === "CURREN" || val === "CURRENT" || val === "CURRENT_DATE";
            }
            
            // Object checks
            if (isRecord(val)) {
                // Check raw property
                if ('raw' in val && typeof val.raw === 'string') {
                    return val.raw === "CURREN" || val.raw === "CURRENT" || val.raw === "CURRENT_DATE";
                }
                
                // Check for CURRENT_DATE object/property
                const constructorName = typeof val.constructor === 'function' ? val.constructor.name : '';
                return 'CURRENT_DATE' in val ||
                       constructorName === 'CURRENT_DATE' ||
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
        const sourceData: Record<string, unknown> = { ...item }; // Shallow copy item
        const creatorsBySourceField: Record<string, unknown[]> = {};
        if (item.creators && Array.isArray(item.creators)) {
            item.creators.forEach((creator: ZoteroCreator) => {
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
        const year = item.year;
        if (!csl.issued && year !== undefined) {
            const yearNum = typeof year === 'number' ? year : parseInt(year, 10);
            if (!isNaN(yearNum)) {
                csl.issued = { 'date-parts': [[yearNum]] };
            }
        }
        // Example: If CSL type is 'song' but no 'author' mapped, try mapping 'performer' to 'author' as a fallback
        if (csl.type === 'song' && !csl.author && Array.isArray(csl.performer)) {
            csl.author = csl.performer.filter(isRecord);
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
            const isCurrentDateFormat = (val: unknown): boolean => {
	                if (!isRecord(val)) return false;
                
                // Check for raw property with current date value
                if ('raw' in val && typeof val.raw === 'string') {
                    return val.raw === "CURREN" || val.raw === "CURRENT" || val.raw === "CURRENT_DATE";
                }
                
                // Check for CURRENT_DATE object or property
                const constructorName = typeof val.constructor === 'function' ? val.constructor.name : '';
                return 'CURRENT_DATE' in val ||
                       constructorName === 'CURRENT_DATE' ||
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
