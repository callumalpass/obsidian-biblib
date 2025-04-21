import { requestUrl, Notice } from 'obsidian';
// CitoidService only provides BibTeX fetching; JSON metadata via Citation.js

export class CitoidService {
    private apiUrl: string = 'https://en.wikipedia.org/api/rest_v1/data/citation/bibtex/';

    constructor() {
        // Fixed BibTeX endpoint; no CrossRef fallback
    }

    /**
     * Fetch BibTeX from Citoid API using DOI or URL.
     * @param identifier URL, DOI, or ISBN
     * @returns Promise resolving to BibTeX string
     */
    async fetchBibTeX(identifier: string): Promise<string> {
        const cleaned = encodeURIComponent(identifier.trim());
        // Attempt to fetch BibTeX at configured endpoint
        const fetchBib = async (baseUrl: string): Promise<string> => {
            const fullUrl = `${baseUrl}${cleaned}`;
            const resp = await requestUrl({
                url: fullUrl,
                method: 'GET',
                headers: {
                    'Accept': 'application/x-bibtex',
                    'User-Agent': 'Obsidian-BibLib'
                }
            });
            if (resp.status !== 200) {
                throw new Error(`Citoid BibTeX fetch failed: ${resp.status} at ${fullUrl}`);
            }
            return resp.text;
        };

        try {
            let text = await fetchBib(this.apiUrl);
            // If the response is not valid BibTeX (doesn't start with '@'), try fallback to '/bibtex/' path
            if (!text.trim().startsWith('@')) {
                // Fallback to try retrieving valid BibTeX
                // Derive fallback base URL: replace 'mediawiki/' with 'bibtex/', or append 'bibtex/'
                let fallbackBase = this.apiUrl;
                if (fallbackBase.includes('/mediawiki/')) {
                    fallbackBase = fallbackBase.replace(/\/mediawiki\/$/, '/bibtex/');
                } else if (!fallbackBase.includes('/bibtex/')) {
                    fallbackBase = fallbackBase.replace(/\/?$/, '/') + 'bibtex/';
                }
                text = await fetchBib(fallbackBase);
                if (!text.trim().startsWith('@')) {
                    throw new Error('Fallback Citoid endpoint did not return valid BibTeX');
                }
            }
            return text;
        } catch (err) {
            console.error('Error fetching BibTeX from Citoid:', err);
            throw err;
        }
    }

}
