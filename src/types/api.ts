import { CslName, CslDate } from './citation';

/**
 * Response from the Citoid API
 */
export interface CitoidResponse {
    title?: string;
    type?: string;
    URL?: string;
    DOI?: string;
    'container-title'?: string;
    publisher?: string;
    'publisher-place'?: string;
    volume?: string | number;
    issue?: string | number;
    number?: string | number;
    page?: string;
    language?: string;
    abstract?: string;
    author?: CslName[];
    issued?: CslDate;
    year?: string | number;
    ISBN?: string | string[];
    ISSN?: string | string[];
    [key: string]: unknown;
}

/**
 * Response from the CrossRef API
 */
export interface CrossRefResponse {
    status?: string;
    message?: {
        title?: string[];
        type?: string;
        URL?: string;
        DOI?: string;
        'container-title'?: string[];
        publisher?: string;
        'publisher-place'?: string;
        volume?: string | number;
        issue?: string | number;
        page?: string;
        language?: string;
        abstract?: string;
        author?: CslName[];
        issued?: CslDate;
        ISBN?: string[];
        ISSN?: string[];
        [key: string]: unknown;
    };
}