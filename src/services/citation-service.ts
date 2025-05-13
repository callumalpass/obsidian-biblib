import Cite from 'citation-js';
import '@citation-js/plugin-bibtex';
// Import date functions if available, otherwise provide simple fallbacks
// You might need to install this: npm install @citation-js/date
import { parse as parseDate, format as formatDate } from '@citation-js/date';

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

const ZOTERO_TYPES_TO_CSL: { [key: string]: string } = {
    artwork: 'graphic',
    attachment: 'document', // Best guess for attachments; they often don't map directly
    audioRecording: 'song',
    bill: 'bill',
    blogPost: 'post-weblog',
    book: 'book',
    bookSection: 'chapter',
    case: 'legal_case',
    computerProgram: 'software', // Mapping to software type directly
    conferencePaper: 'paper-conference',
    dictionaryEntry: 'entry-dictionary',
    document: 'document',
    email: 'personal_communication',
    encyclopediaArticle: 'entry-encyclopedia',
    film: 'motion_picture',
    forumPost: 'post',
    hearing: 'hearing',
    instantMessage: 'personal_communication',
    interview: 'interview',
    journalArticle: 'article-journal',
    letter: 'personal_communication',
    magazineArticle: 'article-magazine',
    manuscript: 'manuscript',
    map: 'map',
    newspaperArticle: 'article-newspaper',
    note: 'document', // Zotero notes are often just metadata containers
    patent: 'patent',
    podcast: 'song', // CSL lacks a distinct podcast type, 'song' or 'broadcast' are common workarounds
    presentation: 'speech',
    radioBroadcast: 'broadcast',
    report: 'report',
    statute: 'legislation',
    thesis: 'thesis',
    tvBroadcast: 'broadcast',
    videoRecording: 'motion_picture',
    webpage: 'webpage'
    // Ensure all expected Zotero types are covered or have a default
};

const mapZoteroCreatorToCsl = (creator: any): { literal: string } | { family: string, given?: string } | undefined => {
    if (!creator) return undefined;
    // Handle institutional authors or single-field names
    if (creator.name) return { literal: creator.name };
    // Handle individual authors with first/last names
    if (creator.lastName || creator.firstName) {
        const cslCreator: { family: string, given?: string } = {
            family: creator.lastName,
        };
        if (creator.firstName) {
            cslCreator.given = creator.firstName;
        }
        return cslCreator;
    }
    return undefined; // Invalid creator structure
};

const ZOTERO_CONVERTERS = {
    DATE: {
        toTarget: (date: string | undefined): any => {
            // Debug logging for date conversion issues
            // console.log(`Converting date: "${date}" (type: ${typeof date})`);
            return parseDateRobust(date);
        }
    },
    CREATORS: {
        toTarget: (creators: any[] | undefined) => {
            if (!creators) return undefined;
            return creators.map(mapZoteroCreatorToCsl).filter(Boolean);
        }
    },
    TAGS: {
        toTarget: (tags: any[] | undefined): string | undefined => (tags && tags.length > 0 ? tags.map(tag => tag.tag).join(', ') : undefined)
    },
    TYPE: {
        toTarget: (type: string): string => ZOTERO_TYPES_TO_CSL[type] || 'document' // Default to 'document'
    }
    // No specific 'toSource' needed for this direction
};

// Full unidirectional mapping (Zotero -> CSL) based on the provided JS file
// 'when.source.itemType' checks the Zotero type *before* conversion.
const ZOTERO_MAPPING: Array<{
    source: string;
    target: string;
    convert?: { toTarget: (value: any) => any };
    when?: { source?: { itemType?: string | string[] } };
    zoteroOnly?: boolean;
    extraField?: boolean;
}> = [
    { source: 'key', target: 'id', zoteroOnly: true }, // Special handling for Zotero key
    { source: 'itemType', target: 'type', convert: ZOTERO_CONVERTERS.TYPE },
    { source: 'tags', target: 'keyword', convert: ZOTERO_CONVERTERS.TAGS },

    // Identifiers (common)
    { source: 'DOI', target: 'DOI' },
    { source: 'ISBN', target: 'ISBN' },
    { source: 'ISSN', target: 'ISSN' },
    { source: 'url', target: 'URL' },

    // Titles (common)
    { source: 'title', target: 'title' },
    { source: 'shortTitle', target: 'title-short' },
    { source: 'journalAbbreviation', target: 'container-title-short', when: { source: { itemType: 'journalArticle' } } }, // Map to CSL standard field

    // Dates (common)
    { source: 'date', target: 'issued', convert: ZOTERO_CONVERTERS.DATE },
    { source: 'accessDate', target: 'accessed', convert: ZOTERO_CONVERTERS.DATE },

    // Abstract & Notes
    { source: 'abstractNote', target: 'abstract' },
    { source: 'extra', target: 'note', extraField: true }, // Special handling for extra field

    // Publication Details (common)
    { source: 'place', target: 'publisher-place' }, // General mapping, might be refined by specific types below
    { source: 'publisher', target: 'publisher' }, // General mapping
    { source: 'edition', target: 'edition' },
    { source: 'volume', target: 'volume' },
    { source: 'issue', target: 'issue' }, // Often used for journal issue
    { source: 'pages', target: 'page' }, // CSL uses 'page' for page range
    { source: 'numberOfVolumes', target: 'number-of-volumes' },
    { source: 'numPages', target: 'number-of-pages' }, // Zotero uses numPages

    // Language, Archive, etc. (common)
    { source: 'language', target: 'language' },
    { source: 'archive', target: 'archive' },
    { source: 'archiveLocation', target: 'archive_location' },
    { source: 'libraryCatalog', target: 'source' }, // e.g., Database name
    { source: 'callNumber', target: 'call-number' },
    { source: 'rights', target: 'rights' }, // CSL standard field

    // Series Info
    { source: 'series', target: 'collection-title' },
    { source: 'seriesNumber', target: 'collection-number' },
    { source: 'seriesTitle', target: 'collection-title' }, // Zotero uses both 'series' and 'seriesTitle'
    { source: 'seriesEditor', target: 'collection-editor', convert: ZOTERO_CONVERTERS.CREATORS }, // Maps to CSL role

    // --- Type-Specific Mappings ---

    // Creators (Mapped by Zotero field name to CSL role)
    { source: 'author', target: 'author', convert: ZOTERO_CONVERTERS.CREATORS }, // Covers many types
    { source: 'editor', target: 'editor', convert: ZOTERO_CONVERTERS.CREATORS }, // Covers book, bookSection, etc.
    { source: 'translator', target: 'translator', convert: ZOTERO_CONVERTERS.CREATORS },
    { source: 'contributor', target: 'contributor', convert: ZOTERO_CONVERTERS.CREATORS }, // Generic CSL role
    { source: 'bookAuthor', target: 'container-author', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: 'bookSection' } } },
    { source: 'reviewedAuthor', target: 'reviewed-author', convert: ZOTERO_CONVERTERS.CREATORS }, // For reviews
    { source: 'recipient', target: 'recipient', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: ['letter', 'email', 'personal_communication'] } } },
    { source: 'interviewer', target: 'interviewer', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: 'interview' } } },
    { source: 'interviewee', target: 'author', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: 'interview' } } }, // Interviewee often primary creator
    { source: 'director', target: 'director', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: ['film', 'videoRecording', 'tvBroadcast', 'radioBroadcast'] } } },
    { source: 'producer', target: 'producer', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: ['film', 'videoRecording', 'tvBroadcast', 'radioBroadcast'] } } }, // CSL standard role
    { source: 'scriptwriter', target: 'script-writer', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: ['film', 'videoRecording', 'tvBroadcast', 'radioBroadcast'] } } }, // CSL uses hyphen
    { source: 'artist', target: 'author', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: 'artwork' } } }, // CSL typically uses 'author' for graphic
    { source: 'sponsor', target: 'author', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: 'bill' } } }, // Sponsor as primary creator for bill
    { source: 'inventor', target: 'author', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: 'patent' } } }, // Inventor as primary creator for patent
    { source: 'cartographer', target: 'author', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: 'map' } } }, // Cartographer as primary creator for map
    { source: 'composer', target: 'composer', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: ['audioRecording', 'podcast'] } } }, // CSL standard role
    { source: 'performer', target: 'performer', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: 'audioRecording' } } }, // CSL standard role (though often mapped to author in song type)
    { source: 'presenter', target: 'author', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: 'presentation' } } }, // Presenter as primary creator for speech
    { source: 'programmer', target: 'author', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: 'computerProgram' } } }, // Programmer as primary creator for software
    { source: 'podcaster', target: 'author', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: 'podcast' } } }, // Podcaster as primary creator
    { source: 'guest', target: 'guest', convert: ZOTERO_CONVERTERS.CREATORS, when: { source: { itemType: ['tvBroadcast', 'radioBroadcast', 'podcast'] } } }, // Specific role for broadcasts/podcasts

    // Container Titles (Specific Zotero fields -> CSL container-title)
    { source: 'publicationTitle', target: 'container-title', when: { source: { itemType: ['journalArticle', 'magazineArticle', 'newspaperArticle'] } } },
    { source: 'bookTitle', target: 'container-title', when: { source: { itemType: 'bookSection' } } },
    { source: 'websiteTitle', target: 'container-title', when: { source: { itemType: 'webpage' } } },
    { source: 'forumTitle', target: 'container-title', when: { source: { itemType: 'forumPost' } } },
    { source: 'blogTitle', target: 'container-title', when: { source: { itemType: 'blogPost' } } },
    { source: 'proceedingsTitle', target: 'container-title', when: { source: { itemType: 'conferencePaper' } } },
    { source: 'encyclopediaTitle', target: 'container-title', when: { source: { itemType: 'encyclopediaArticle' } } },
    { source: 'dictionaryTitle', target: 'container-title', when: { source: { itemType: 'dictionaryEntry' } } },
    { source: 'programTitle', target: 'container-title', when: { source: { itemType: ['tvBroadcast', 'radioBroadcast'] } } }, // For broadcasts
    { source: 'reporter', target: 'container-title', when: { source: { itemType: 'case' } } }, // Legal case reporter
    { source: 'code', target: 'container-title', when: { source: { itemType: ['bill', 'statute'] } } }, // Legal code

    // Specific Dates (Zotero field -> CSL date variable)
    { source: 'dateDecided', target: 'issued', convert: ZOTERO_CONVERTERS.DATE, when: { source: { itemType: 'case' } } },
    { source: 'dateEnacted', target: 'issued', convert: ZOTERO_CONVERTERS.DATE, when: { source: { itemType: 'statute' } } },
    { source: 'issueDate', target: 'issued', convert: ZOTERO_CONVERTERS.DATE, when: { source: { itemType: 'patent' } } },
    { source: 'filingDate', target: 'submitted', convert: ZOTERO_CONVERTERS.DATE, when: { source: { itemType: 'patent' } } },

    // Legal & Patent Specific Fields
    { source: 'caseName', target: 'title', when: { source: { itemType: 'case' } } }, // Case name is the title
    { source: 'court', target: 'authority', when: { source: { itemType: 'case' } } }, // CSL authority
    { source: 'docketNumber', target: 'number', when: { source: { itemType: 'case' } } }, // CSL number
    { source: 'reporterVolume', target: 'volume', when: { source: { itemType: 'case' } } },
    { source: 'firstPage', target: 'page', when: { source: { itemType: 'case' } } }, // CSL page
    { source: 'history', target: 'references', when: { source: { itemType: ['bill', 'case', 'hearing', 'statute'] } } }, // CSL references
    { source: 'nameOfAct', target: 'title', when: { source: { itemType: 'statute' } } }, // Act name is the title
    { source: 'codeNumber', target: 'volume', when: { source: { itemType: 'statute' } } }, // Often corresponds to volume in CSL
    { source: 'publicLawNumber', target: 'number', when: { source: { itemType: 'statute' } } }, // CSL number
    { source: 'session', target: 'chapter-number', when: { source: { itemType: ['bill', 'hearing', 'statute'] } } }, // Session often maps to chapter
    { source: 'legislativeBody', target: 'authority', when: { source: { itemType: ['bill', 'hearing'] } } }, // CSL authority
    { source: 'documentNumber', target: 'number', when: { source: { itemType: 'hearing' } } }, // CSL number
    { source: 'committee', target: 'section', when: { source: { itemType: 'hearing' } } }, // Committee can map to section
    { source: 'issuingAuthority', target: 'authority', when: { source: { itemType: 'patent' } } }, // CSL authority
    { source: 'legalStatus', target: 'status', when: { source: { itemType: 'patent' } } }, // CSL status
    { source: 'patentNumber', target: 'number', when: { source: { itemType: 'patent' } } }, // CSL number
    { source: 'priorityNumbers', target: 'issue', when: { source: { itemType: 'patent' } } }, // Can map to issue
    { source: 'references', target: 'references', when: { source: { itemType: 'patent' } } }, // CSL references
    { source: 'applicationNumber', target: 'call-number', when: { source: { itemType: 'patent' } } }, // Use call-number as generic ID field

    // Bill Specific
    { source: 'billNumber', target: 'number', when: { source: { itemType: 'bill' } } },
    { source: 'codeVolume', target: 'volume', when: { source: { itemType: 'bill' } } },
    { source: 'codePages', target: 'page', when: { source: { itemType: 'bill' } } },

    // Report Specific
    { source: 'reportNumber', target: 'number', when: { source: { itemType: 'report' } } },
    { source: 'reportType', target: 'genre', when: { source: { itemType: 'report' } } },
    { source: 'institution', target: 'publisher', when: { source: { itemType: 'report' } } }, // Institution is often the publisher

    // Thesis Specific
    { source: 'thesisType', target: 'genre', when: { source: { itemType: 'thesis' } } },
    { source: 'university', target: 'publisher', when: { source: { itemType: 'thesis' } } }, // University is the publisher

    // Web Specific
    { source: 'websiteType', target: 'genre', when: { source: { itemType: ['webpage', 'blogPost'] } } },

    // Communication Specific (Email, Letter, IM)
    { source: 'subject', target: 'title', when: { source: { itemType: 'email' } } }, // Subject as title for email
    { source: 'letterType', target: 'genre', when: { source: { itemType: 'letter' } } }, // e.g., "Personal communication"

    // Conference Paper Specific
    { source: 'conferenceName', target: 'event-title', when: { source: { itemType: 'conferencePaper' } } }, // CSL event-title

    // Presentation Specific
    { source: 'meetingName', target: 'event-title', when: { source: { itemType: 'presentation' } } }, // CSL event-title
    { source: 'presentationType', target: 'genre', when: { source: { itemType: 'presentation' } } },

    // Map Specific
    { source: 'scale', target: 'scale', when: { source: { itemType: 'map' } } }, // CSL scale
    { source: 'mapType', target: 'genre', when: { source: { itemType: 'map' } } },

    // Audiovisual Specific
    { source: 'runningTime', target: 'dimensions', when: { source: { itemType: ['film', 'videoRecording', 'audioRecording', 'tvBroadcast', 'radioBroadcast', 'podcast'] } } }, // Use dimensions for duration
    { source: 'artworkSize', target: 'dimensions', when: { source: { itemType: 'artwork' } } }, // Use dimensions for size
    { source: 'interviewMedium', target: 'medium', when: { source: { itemType: 'interview' } } }, // CSL medium
    { source: 'artworkMedium', target: 'medium', when: { source: { itemType: 'artwork' } } },
    { source: 'audioRecordingFormat', target: 'medium', when: { source: { itemType: ['audioRecording', 'radioBroadcast', 'podcast'] } } },
    { source: 'videoRecordingFormat', target: 'medium', when: { source: { itemType: ['film', 'videoRecording', 'tvBroadcast'] } } },
    { source: 'label', target: 'publisher', when: { source: { itemType: 'audioRecording' } } }, // Record label as publisher
    { source: 'studio', target: 'publisher', when: { source: { itemType: ['film', 'videoRecording'] } } }, // Studio as publisher
    { source: 'network', target: 'publisher', when: { source: { itemType: ['tvBroadcast', 'radioBroadcast'] } } }, // Network as publisher
    { source: 'episodeNumber', target: 'number', when: { source: { itemType: ['tvBroadcast', 'radioBroadcast', 'podcast'] } } }, // Use CSL number for episode

    // Software Specific
    { source: 'company', target: 'publisher', when: { source: { itemType: 'computerProgram' } } }, // Company as publisher
    { source: 'programmingLanguage', target: 'genre', when: { source: { itemType: 'computerProgram' } } }, // Language as genre
    { source: 'system', target: 'medium', when: { source: { itemType: 'computerProgram' } } }, // System requirements as medium
    { source: 'version', target: 'version', when: { source: { itemType: 'computerProgram' } } }, // CSL version

    // Manuscript Specific
    { source: 'manuscriptType', target: 'genre', when: { source: { itemType: 'manuscript' } } },

    // Forum Post Specific
    { source: 'postType', target: 'genre', when: { source: { itemType: 'forumPost' } } },

    // Newspaper Specific Section
    { source: 'section', target: 'section', when: { source: { itemType: 'newspaperArticle' } } },

    // Miscellaneous rarely used Zotero fields potentially mappable
    // 'attorneyAgent', 'commenter', 'cosponsor', 'counsel', 'wordsBy', 'castMember' could map to 'contributor' if needed
];

// --- Optional: Extra Field Parsing ---
const EXTRA_FIELDS_CSL_MAP: { [key: string]: string } = {
    // Map common Zotero 'extra' keys to CSL keys
    'Original Date': 'original-date',
    'Event Date': 'event-date',
    'Original Publisher': 'original-publisher',
    'Original Publisher Place': 'original-publisher-place',
    'Original Title': 'original-title',
    'Reviewed Title': 'reviewed-title', // For book reviews etc.
    PMCID: 'PMCID',
    PMID: 'PMID',
    // Add more specific mappings if you frequently use certain 'extra' fields
};

// Fields that should preserve their case (typically acronyms)
const PRESERVE_CASE_FIELDS = [
    'DOI', 'ISBN', 'ISSN', 'PMID', 'PMCID', 'URL', 'ORCID'
];

function parseExtraField(extraString: string | undefined): Record<string, any> {
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
        // Add the grouped creators back to sourceData, overwriting the original array
        Object.assign(sourceData, creatorsBySourceField);
        delete sourceData.creators; // Clean up original array key

        // 3. Apply Mappings Iteratively
        ZOTERO_MAPPING.forEach(rule => {
            // Check 'when' condition against original Zotero itemType
            let applies = true;
            if (rule.when?.source?.itemType) {
                 const requiredTypes = Array.isArray(rule.when.source.itemType)
                    ? rule.when.source.itemType
                    : [rule.when.source.itemType];
                 if (!requiredTypes.includes(item.itemType)) {
                     applies = false;
                 }
            }
            // Could add target type checks here: if (rule.when?.target?.type && rule.when.target.type !== csl.type) applies = false;

            if (applies) {
                const sourceValue = sourceData[rule.source];
                
                // Special debug for accessDate issues
                // if (rule.source === 'accessDate') {
                    // console.log(`Processing accessDate: "${sourceValue}" (type: ${typeof sourceValue})`);
                    // console.log('Full sourceData:', JSON.stringify(sourceData));
                // }

                // Proceed only if the source field exists and has a value
                if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
                    let targetValue = sourceValue; // Default to direct copy

                    // Apply converter if specified
                    if (rule.convert) {
                        try {
                            targetValue = rule.convert.toTarget(sourceValue);
                        } catch(convertError: any) {
                            console.warn(`Converter error for field "${rule.source}" -> "${rule.target}":`, convertError.message, " Raw value:", sourceValue);
                            targetValue = undefined; // Skip assignment if converter fails
                        }
                    }

                    // Assign to CSL object if the final value is valid
                    // Allow empty strings only if source was explicitly empty string? (Usually filter out)
                    if (targetValue !== undefined && targetValue !== null) {
                         // Handle special flags
                         if (rule.zoteroOnly) {
                             if (rule.source === 'key') csl._zoteroKey = targetValue;
                         } else if (rule.extraField) {
                              if (rule.source === 'extra') csl._extraFieldContent = targetValue;
                         } else {
                            // Normal assignment: Prevent overwriting existing CSL value unless the new value is non-empty?
                            // Simple overwrite is usually fine as mappings should be ordered logically or non-overlapping
                            
                            // Preserve case for special fields
                            let targetKey = rule.target;
                            if (PRESERVE_CASE_FIELDS.some(field => field.toLowerCase() === targetKey.toLowerCase())) {
                                // Find the correct case version
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
