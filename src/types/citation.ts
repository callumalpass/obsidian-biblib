import { CslType } from '../utils/csl-variables';

/**
 * CSL name structure for contributors
 */
export interface CslName {
    /** Given name of the contributor */
    given?: string;
    /** Family name of the contributor */
    family?: string;
    /** Literal form for institutional names or single-field names */
    literal?: string;
    /** Dropping particle (e.g., "van" in "Ludwig van Beethoven") */
    'dropping-particle'?: string;
    /** Non-dropping particle (e.g., "de" in "Charles de Gaulle") */
    'non-dropping-particle'?: string;
    /** Suffix (e.g., "Jr.", "III") */
    suffix?: string;
    /** Comma suffix flag for CSL processing */
    'comma-suffix'?: boolean;
    /** Static ordering flag for CSL processing */
    'static-ordering'?: boolean;
    /** Parse names flag for CSL processing */
    'parse-names'?: boolean;
}

/**
 * Contributor with role information (extends CslName for internal use)
 */
export interface Contributor extends CslName {
    /** Role of the contributor (e.g., 'author', 'editor', 'translator') */
    role: string;
}

/**
 * Date structure in CSL format
 * Supports both structured date-parts and raw/literal strings
 */
export interface CslDate {
    /** Structured date as [[year], [year, month], or [year, month, day]] */
    'date-parts'?: (number | string)[][];
    /** Raw date string when structured parsing fails */
    raw?: string;
    /** Literal date string for display */
    literal?: string;
    /** Season (1=spring, 2=summer, 3=fall, 4=winter) */
    season?: number | string;
    /** Circa flag for approximate dates */
    circa?: boolean | string;
}

/** @deprecated Use CslDate instead */
export interface CslDateParts {
    'date-parts': (number | string)[][];
}

/**
 * Additional field for custom citation metadata.
 * Value can be primitive types, arrays, or CSL date objects.
 */
export interface AdditionalField {
    type: 'text' | 'number' | 'date' | 'boolean' | 'list' | 'standard' | string;
    name: string;
    // Using any for value to maintain backward compatibility with dynamic property access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
}

/**
 * CSL-compatible citation data
 * Based on CSL 1.0.2 specification with common extensions
 */
export interface Citation {
    /** Unique identifier / citekey */
    id: string;
    /** CSL item type */
    type: CslType;
    /** Primary title */
    title: string;
    /** Abbreviated title */
    'title-short'?: string;

    // Identifiers
    /** Digital Object Identifier */
    DOI?: string;
    /** International Standard Book Number */
    ISBN?: string;
    /** International Standard Serial Number */
    ISSN?: string;
    /** URL for online resources */
    URL?: string;
    /** PubMed ID */
    PMID?: string;
    /** PubMed Central ID */
    PMCID?: string;

    // Container information
    /** Container title (journal, book, etc.) */
    'container-title'?: string;
    /** Abbreviated container title */
    'container-title-short'?: string;
    /** Collection/series title */
    'collection-title'?: string;
    /** Collection/series number */
    'collection-number'?: string | number;

    // Publication details
    /** Publisher name */
    publisher?: string;
    /** Place of publication */
    'publisher-place'?: string;
    /** Edition */
    edition?: string | number;
    /** Volume */
    volume?: string | number;
    /** Issue number */
    issue?: string | number;
    /** Generic number field */
    number?: string | number;
    /** Page range or page number */
    page?: string;
    /** First page (for legal citations) */
    'page-first'?: string;
    /** Number of pages */
    'number-of-pages'?: string | number;
    /** Number of volumes */
    'number-of-volumes'?: string | number;
    /** Chapter number */
    'chapter-number'?: string | number;
    /** Version */
    version?: string;

    // Dates
    /** Publication/issue date */
    issued?: CslDate;
    /** Date accessed (for online resources) */
    accessed?: CslDate;
    /** Event date */
    'event-date'?: CslDate;
    /** Original publication date */
    'original-date'?: CslDate;
    /** Submission date */
    submitted?: CslDate;

    // Legacy date fields (prefer issued with date-parts)
    /** @deprecated Use issued['date-parts'][0][0] instead */
    year?: string | number;
    /** @deprecated Use issued['date-parts'][0][1] instead */
    month?: string | number;
    /** @deprecated Use issued['date-parts'][0][2] instead */
    day?: string | number;

    // Contributors
    /** Authors */
    author?: CslName[];
    /** Editors */
    editor?: CslName[];
    /** Translators */
    translator?: CslName[];
    /** Container authors (e.g., book author for chapter) */
    'container-author'?: CslName[];
    /** Collection editors */
    'collection-editor'?: CslName[];
    /** Directors (for audiovisual) */
    director?: CslName[];
    /** Composers */
    composer?: CslName[];
    /** Interviewers */
    interviewer?: CslName[];
    /** Recipients (for correspondence) */
    recipient?: CslName[];
    /** Reviewed authors */
    'reviewed-author'?: CslName[];
    /** Generic contributors */
    contributor?: CslName[];

    // Content metadata
    /** Abstract/summary */
    abstract?: string;
    /** Language code */
    language?: string;
    /** Keywords (comma-separated) */
    keyword?: string;
    /** Notes */
    note?: string;
    /** Genre/type specification */
    genre?: string;
    /** Medium (e.g., "CD", "DVD") */
    medium?: string;
    /** Dimensions (e.g., running time) */
    dimensions?: string;
    /** Scale (for maps) */
    scale?: string;
    /** Status (e.g., legal status) */
    status?: string;

    // Archival
    /** Archive name */
    archive?: string;
    /** Location within archive */
    archive_location?: string;
    /** Archive place */
    'archive-place'?: string;
    /** Call number */
    'call-number'?: string;
    /** Source database/catalog */
    source?: string;

    // Legal/authority
    /** Issuing authority */
    authority?: string;
    /** Jurisdiction */
    jurisdiction?: string;
    /** References (for legal citations) */
    references?: string;
    /** Section */
    section?: string;

    // Events
    /** Event title */
    'event-title'?: string;
    /** Event place */
    'event-place'?: string;

    // Original publication
    /** Original publisher */
    'original-publisher'?: string;
    /** Original publication place */
    'original-publisher-place'?: string;
    /** Original title */
    'original-title'?: string;

    // Review
    /** Reviewed title */
    'reviewed-title'?: string;
    /** Reviewed genre */
    'reviewed-genre'?: string;

    // Rights
    /** Copyright/license information */
    rights?: string;
    /** License */
    license?: string;

    // Index for additional/custom fields not in the spec
    [key: string]: unknown;
}

/**
 * Zotero creator structure before conversion to CSL
 */
export interface ZoteroCreator {
    creatorType: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    fieldMode?: number;
}

/**
 * Unified creator input format for mapping from various sources.
 * Handles both Zotero-style (firstName/lastName) and CSL-style (given/family) formats.
 */
export interface CreatorInput {
    // CSL-style fields
    family?: string;
    given?: string;
    literal?: string;
    // Zotero-style fields
    firstName?: string;
    lastName?: string;
    name?: string;
    // Metadata
    creatorType?: string;
    fieldMode?: number;
}

/**
 * Zotero item structure before conversion to CSL
 */
export interface ZoteroItem {
    key?: string;
    itemType: string;
    title?: string;
    creators?: ZoteroCreator[];
    date?: string;
    accessDate?: string;
    url?: string;
    DOI?: string;
    ISBN?: string;
    abstractNote?: string;
    extra?: string;
    tags?: Array<{ tag: string }>;
    attachments?: ZoteroAttachment[];
    [key: string]: unknown;
}

/**
 * Zotero attachment structure before conversion
 */
export interface ZoteroAttachment {
    id?: string;
    key?: string;
    itemType: 'attachment';
    linkMode?: 'linked_url' | 'imported_file' | 'linked_file';
    contentType?: string;
    title?: string;
    url?: string;
    filename?: string;
    path?: string;
    parentItem?: string;
}

/**
 * Session item for connector-server with typed attachments
 */
export interface SessionItem extends Omit<ZoteroItem, 'attachments'> {
    attachments?: ZoteroAttachment[];
    id?: string;
}

/**
 * Result of date parsing operations
 */
export interface ParsedDate {
    /** Parsed date components as [year], [year, month], or [year, month, day] */
    dateParts?: number[];
    /** Raw unparsed string when structured parsing fails */
    raw?: string;
    /** Whether this represents the current date */
    isCurrent?: boolean;
    /** Year component for easy access */
    year?: number;
    /** Month component (1-12) for easy access */
    month?: number;
    /** Day component (1-31) for easy access */
    day?: number;
}

/**
 * Options for attaching files to citations
 */
export enum AttachmentType {
    NONE = 'none',
    IMPORT = 'import',
    LINK = 'link'
}

/**
 * Attachment data for a citation
 */
export interface AttachmentData {
    type: AttachmentType;
    file?: File;          // For imported files
    path?: string;        // For linked files
    filename?: string;    // For displaying the filename
}
