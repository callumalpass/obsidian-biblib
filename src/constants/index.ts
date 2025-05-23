/**
 * Application-wide constants
 */

// Network and Server Configuration
export const DEFAULT_ZOTERO_PORT = 23119;
export const LOCALHOST = '127.0.0.1';

// Session Management
export const SESSION_CLEANUP_INTERVAL = 300000; // 5 minutes in milliseconds
export const SESSION_TIMEOUT = 600000; // 10 minutes in milliseconds

// UI Notification Durations
export const NOTICE_DURATION_SHORT = 2000; // 2 seconds
export const NOTICE_DURATION_MEDIUM = 4000; // 4 seconds
export const NOTICE_DURATION_LONG = 6000; // 6 seconds

// UI Text Constants
export const UI_TEXT = {
    PARSING_BIBTEX: 'Parsing BibTeX data...',
    PARSING: 'Parsing...',
    PARSE_BIBTEX: 'Parse BibTeX',
    LOADING: 'Loading...',
    LOOKUP: 'Lookup',
    FETCHING_DATA: 'Fetching citation data...'
} as const;

// File System
export const DEFAULT_ATTACHMENT_FOLDER = 'biblib';
export const DEFAULT_LITERATURE_NOTE_PATH = '/';

// Template Defaults
export const DEFAULT_FILENAME_TEMPLATE = '@{{citekey}}';
export const DEFAULT_CITEKEY_TEMPLATE = '{{authors_family.0|camelCase}}{{year}}';

// HTTP Status Codes
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_SERVER_ERROR: 500
} as const;

// Content Types
export const CONTENT_TYPE = {
    JSON: 'application/json',
    TEXT: 'text/plain',
    HTML: 'text/html'
} as const;

// Error Messages
export const ERROR_MESSAGES = {
    ZOTERO_PORT_IN_USE: 'Port is already in use. Is Zotero or another application running?',
    ZOTERO_PORT_ACCESS_DENIED: 'Permission denied for port. Try a port number above 1024.',
    BIBLIOGRAPHY_BUILD_FAILED: 'Error building bibliography files. Check console for details.',
    FILE_READ_FAILED: 'Failed to read file content',
    INVALID_CSL_DATA: 'Invalid CSL data format',
    TEMPLATE_PARSE_ERROR: 'Failed to parse template',
    BIBTEX_PARSE_FAILED: 'Error parsing BibTeX data. Please check the format and try again.',
    NO_BIBTEX_DATA: 'No valid citation data found in the BibTeX entry',
    EMPTY_BIBTEX: 'Please paste a BibTeX entry'
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
    ZOTERO_SERVER_STARTED: 'Zotero Connector server listening on port',
    BIBLIOGRAPHY_BUILDING: 'Building bibliography files...',
    BIBTEX_EXPORTING: 'Exporting BibTeX file...',
    NOTE_CREATED: 'Literature note created successfully',
    TEMPLATE_APPLIED: 'Template applied successfully!',
    BIBTEX_PARSED: 'BibTeX data successfully parsed and filled',
    CITOID_FILLED: 'Citation data successfully filled'
} as const;

// API Endpoints
export const API_ENDPOINTS = {
    CITOID_BASE: 'https://en.wikipedia.org/api/rest_v1/data/citation',
    CROSSREF_BASE: 'https://api.crossref.org/works'
} as const;

// Timeouts
export const TIMEOUTS = {
    API_REQUEST: 30000, // 30 seconds
    FILE_OPERATION: 10000, // 10 seconds
    DEBOUNCE_DELAY: 300 // 300ms for input debouncing
} as const;

// Limits
export const LIMITS = {
    MAX_TITLE_LENGTH: 255,
    MAX_ABSTRACT_LENGTH: 5000,
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    MAX_BATCH_IMPORT: 100
} as const;