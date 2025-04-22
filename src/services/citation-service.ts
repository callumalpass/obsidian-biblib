import Cite from 'citation-js';
import '@citation-js/plugin-bibtex';
import { CitoidService } from './api/citoid';
import { Notice } from 'obsidian';

/**
 * Service to fetch and normalize citation data via Citation.js
 * Tries JSON via Citoid, parses; falls back to BibTeX via Citoid if needed.
 */
export class CitationService {
    private citoid: CitoidService;

    constructor() {
        // Use default CitoidService (fixed BibTeX endpoint)
        this.citoid = new CitoidService();
    }

    /**
     * Fetch normalized CSL-JSON for an identifier
     * @param id DOI, URL, or ISBN
     */
    async fetchNormalized(id: string): Promise<any> {
        // Fetch BibTeX from Citoid, parse via Citation.js, and output true CSL-JSON (hyphen-case keys)
        try {
            const bibtex = await this.citoid.fetchBibTeX(id);
            const cite = new Cite(bibtex);
            // Get hyphen-case CSL-JSON as a string (style "csl" yields CSL-JSON data)
            const jsonString = cite.get({
                style: 'csl',
                type: 'string',
            });
            const data = JSON.parse(jsonString);
            // Citoid returns a single entry
            return Array.isArray(data) ? data[0] : data;
        } catch (e) {
            console.error('Error fetching/parsing BibTeX from Citoid:', e);
            new Notice('Error fetching citation data. Please check the identifier and try again.');
            throw e;
        }
    }
    
    /**
     * Parse BibTeX string directly using Citation.js
     * @param bibtex Raw BibTeX string
     */
    parseBibTeX(bibtex: string): any {
        try {
            const cite = new Cite(bibtex);
            // Get hyphen-case CSL-JSON as a string
            const jsonString = cite.get({
                style: 'csl',
                type: 'string',
            });
            const data = JSON.parse(jsonString);
            // Return first entry if it's an array
            return Array.isArray(data) ? data[0] : data;
        } catch (e) {
            console.error('Error parsing BibTeX:', e);
            new Notice('Error parsing BibTeX. Please check the format and try again.');
            throw e;
        }
    }
}