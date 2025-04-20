import { requestUrl } from 'obsidian';
import { CitoidResponse } from '../../types/api';
import { CrossRefService } from './crossref';

export class CitoidService {
    private apiUrl: string;
    private crossRefService: CrossRefService;

    constructor(apiUrl: string) {
        this.apiUrl = apiUrl;
        this.crossRefService = new CrossRefService();
    }

    /**
     * Fetch metadata from Citoid API using a URL, DOI, or ISBN
     * @param identifier URL, DOI, or ISBN to query
     * @returns Promise with the citation data or null if not found
     */
    async fetch(identifier: string): Promise<CitoidResponse | null> {
        try {
            // Ensure the URL has a trailing slash
            let apiUrl = this.apiUrl;
            if (!apiUrl.endsWith('/')) {
                apiUrl += '/';
            }
            
            // Clean up identifiers if needed
            if (identifier.toLowerCase().includes('doi.org/')) {
                // Extract just the DOI part
                identifier = identifier.split('doi.org/')[1];
            } else if (identifier.toLowerCase().startsWith('doi:')) {
                // Remove the 'doi:' prefix
                identifier = identifier.substring(4);
            } else if (identifier.toLowerCase().startsWith('isbn:')) {
                // Remove the 'isbn:' prefix
                identifier = identifier.substring(5);
            }
            
            // Try alternative format if Wikipedia Citoid API doesn't work
            // If it's a DOI, we can try the CrossRef API directly
            if (/10\.\d{4,}\/[-._;()/:A-Z0-9]+$/i.test(identifier)) {
                try {
                    const crossRefData = await this.crossRefService.fetch(identifier);
                    if (crossRefData) {
                        return crossRefData;
                    }
                } catch (crossRefError) {
                    console.error('CrossRef API failed, trying Citoid API as fallback');
                }
            }
            
            // Prepare and make the request to Citoid API
            const url = `${apiUrl}${encodeURIComponent(identifier)}`;
            
            const response = await requestUrl({
                url: url,
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Obsidian-Bibliography-Plugin'
                }
            });
            
            if (response.status !== 200) {
                console.error(`Citoid API returned status ${response.status}`);
                throw new Error(`Citoid API returned status ${response.status}`);
            }
            
            // Parse the response (typically an array of citations)
            const data = response.json;
            if (!data || (Array.isArray(data) && data.length === 0)) {
                console.error('No citation data found');
                return null;
            }
            
            // Return the first item if it's an array
            return Array.isArray(data) ? data[0] : data;
        } catch (error) {
            console.error('Error fetching from Citoid API:', error);
            return null;
        }
    }
}
