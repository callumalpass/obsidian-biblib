import { requestUrl, Notice } from 'obsidian'; // Added Notice
import { CitoidResponse } from '../../types/api';
import { CrossRefService } from './crossref';

export class CitoidService {
    private apiUrl: string;
    private crossRefService: CrossRefService;

    constructor(apiUrl: string) {
        // Ensure URL is somewhat valid, default if not provided
        try {
             const url = new URL(apiUrl);
             this.apiUrl = url.toString();
        } catch (_) {
             console.warn(`Invalid Citoid API URL provided: ${apiUrl}. Defaulting.`);
             // Default to a known working endpoint (e.g., English Wikipedia)
             this.apiUrl = 'https://en.wikipedia.org/api/rest_v1/data/citation/mediawiki/'; 
        }
        // Ensure trailing slash
        if (!this.apiUrl.endsWith('/')) {
             this.apiUrl += '/';
        }
        
        this.crossRefService = new CrossRefService();
    }

    /**
     * Fetch metadata from Citoid API using a URL, DOI, or ISBN
     * Tries CrossRef first for DOIs as a potentially faster/more reliable source.
     * @param identifier URL, DOI, or ISBN to query
     * @returns Promise with the citation data or null if not found
     */
    async fetch(identifier: string): Promise<CitoidResponse | null> {
        let cleanedIdentifier = identifier.trim();
        let isDOI = false;

        try {
            // --- Identifier Cleaning & DOI Check ---
            if (cleanedIdentifier.toLowerCase().includes('doi.org/')) {
                cleanedIdentifier = cleanedIdentifier.substring(cleanedIdentifier.toLowerCase().indexOf('doi.org/') + 'doi.org/'.length);
                isDOI = true;
            } else if (cleanedIdentifier.toLowerCase().startsWith('doi:')) {
                cleanedIdentifier = cleanedIdentifier.substring(4);
                isDOI = true;
            } else if (/^10\.\d{4,}\/[-._;()/:A-Z0-9]+$/i.test(cleanedIdentifier)) {
                 isDOI = true;
            } else if (cleanedIdentifier.toLowerCase().startsWith('isbn:')) {
                cleanedIdentifier = cleanedIdentifier.substring(5);
            }
            // Add more cleaning/validation if needed (e.g., for ISBNs)

            // --- Try CrossRef First for DOIs --- 
            if (isDOI) {
                try {
                    new Notice('Trying CrossRef API for DOI...', 1500); // Short notice
                    const crossRefData = await this.crossRefService.fetch(cleanedIdentifier);
                    if (crossRefData) {
                         new Notice('Data successfully retrieved from CrossRef.', 2000);
                        return crossRefData;
                    }
                    // If CrossRef returns null (not found), proceed to Citoid
                     new Notice('DOI not found via CrossRef, trying Citoid API...', 2000);
                } catch (crossRefError) {
                    // Log error but proceed to Citoid as fallback
                    console.error('CrossRef API request failed, trying Citoid API as fallback:', crossRefError);
                    new Notice('CrossRef API failed, trying Citoid API...', 2000);
                }
            }
            
            // --- Request Citoid API --- 
            new Notice('Querying Citoid API...', 1500);
            const url = `${this.apiUrl}${encodeURIComponent(cleanedIdentifier)}`;
            
            const response = await requestUrl({
                url: url,
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Obsidian-Bibliography-Plugin (https://github.com/your-repo)' // Be a good citizen
                }
            });
            
            // --- Handle Citoid Response --- 
            if (response.status !== 200) {
                console.error(`Citoid API returned status ${response.status} for identifier: ${cleanedIdentifier}`);
                // Provide more specific error notice?
                new Notice(`Citoid API error: Status ${response.status}`, 5000);
                return null; // Changed from throwing error to returning null
            }
            
            const data = response.json;
            if (!data || (Array.isArray(data) && data.length === 0)) {
                console.warn(`No citation data found via Citoid for identifier: ${cleanedIdentifier}`);
                new Notice('No citation data found via Citoid.', 3000);
                return null;
            }
            
            // Citoid often returns an array, take the first result
            const result = Array.isArray(data) ? data[0] : data;
             new Notice('Data successfully retrieved from Citoid.', 2000);
            return result;

        } catch (error) {
            // Catch network errors or other unexpected issues
            console.error('Error fetching citation data:', error);
            new Notice('Error fetching citation data. Check console.', 5000);
            return null;
        }
    }
}
