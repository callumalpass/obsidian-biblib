import { CslType } from '../utils/csl-variables';

/**
 * Contributor types follow CSL format
 */
export interface Contributor {
    role: string;
    /** Given name of the contributor, if available */
    given?: string;
    /** Family name of the contributor, if available */
    family?: string;
    /** Literal form of the contributor name, if provided */
    literal?: string;
    /** Any additional CSL contributor properties (e.g., affiliation, sequence, ORCID) */
    [key: string]: any;
}

/**
 * Date parts in CSL format
 */
export interface CslDateParts {
    'date-parts': (number | string)[][];
}

/**
 * Additional field for a citation
 */
export interface AdditionalField {
    type: string;
    name: string;
    value: any;
}

/**
 * CSL-compatible citation data
 */

export interface Citation {
    id: string;
    type: CslType;
    title: string;
    'title-short'?: string;
    URL?: string;
    DOI?: string;
    'container-title'?: string;
    publisher?: string;
    'publisher-place'?: string;
    edition?: string | number;
    volume?: string | number;
    number?: string | number;
    page?: string;
    language?: string;
    abstract?: string;
    issued?: CslDateParts;
    year?: string | number;
    month?: string | number;
    day?: string | number;
	author?: Array<{ given?: string; family?: string; literal?: string }>; 
    editor?: Array<{ given?: string; family?: string; literal?: string }>; 
    translator?: Array<{ given?: string; family?: string; literal?: string }>; 
    'container-author'?: Array<{ given?: string; family?: string; literal?: string }>;
    [key: string]: any; // For additional fields
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
