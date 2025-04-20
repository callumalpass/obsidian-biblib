import { requestUrl } from 'obsidian';
import { CitoidResponse, CrossRefResponse } from '../../types/api';

export class CrossRefService {
    /**
     * Fetch metadata from CrossRef API using a DOI
     * @param doi The DOI to query
     * @returns Promise with the citation data mapped to Citoid format, or null if not found
     */
    async fetch(doi: string): Promise<CitoidResponse> {
        try {
            const crossrefUrl = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
            console.log(`Trying CrossRef API: ${crossrefUrl}`);
            
            const crossrefResponse = await requestUrl({
                url: crossrefUrl,
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Obsidian-Bibliography-Plugin'
                }
            });
            
            if (crossrefResponse.status === 200 && crossrefResponse.json && crossrefResponse.json.message) {
                // Map CrossRef data to our format
                return this.mapToCitoidFormat(crossrefResponse.json.message);
            }
            
            return {} as CitoidResponse;
        } catch (error) {
            console.error('Error fetching from CrossRef API:', error);
            return {} as CitoidResponse;
        }
    }
    
    /**
     * Map CrossRef API data to Citoid format
     */
    mapToCitoidFormat(crossRefData: any): CitoidResponse {
        try {
            console.log('Mapping CrossRef data:', JSON.stringify(crossRefData, null, 2));
            
            const result: CitoidResponse = {
                title: crossRefData.title ? crossRefData.title[0] : '',
                type: this.mapCrossRefType(crossRefData.type),
                URL: crossRefData.URL || '',
                DOI: crossRefData.DOI || '',
            };
            
            // Handle authors
            if (crossRefData.author && Array.isArray(crossRefData.author)) {
                result.author = crossRefData.author.map((author: any) => ({
                    family: author.family || '',
                    given: author.given || ''
                }));
            }
            
            // Handle container title (journal, etc.)
            if (crossRefData['container-title'] && crossRefData['container-title'].length > 0) {
                result['container-title'] = crossRefData['container-title'][0];
            }
            
            // Handle publisher
            if (crossRefData.publisher) {
                result.publisher = crossRefData.publisher;
            }
            
            // Handle publisher place
            if (crossRefData['publisher-place']) {
                result['publisher-place'] = crossRefData['publisher-place'];
            }
            
            // Handle issue, volume, page
            if (crossRefData.issue) result.issue = crossRefData.issue;
            if (crossRefData.volume) result.volume = crossRefData.volume;
            if (crossRefData.page) result.page = crossRefData.page;
            
            // Handle ISBN
            if (crossRefData.ISBN && crossRefData.ISBN.length > 0) {
                result.ISBN = crossRefData.ISBN[0];
            }
            
            // Handle ISSN
            if (crossRefData.ISSN && crossRefData.ISSN.length > 0) {
                result.ISSN = crossRefData.ISSN[0];
            }
            
            // Handle language
            if (crossRefData.language) {
                result.language = crossRefData.language;
            }
            
            // Handle dates
            if (crossRefData.issued && crossRefData.issued['date-parts'] && 
                crossRefData.issued['date-parts'].length > 0) {
                result.issued = {
                    'date-parts': [crossRefData.issued['date-parts'][0]]
                };
                
                // Also set year separately for convenience
                if (crossRefData.issued['date-parts'][0][0]) {
                    result.year = crossRefData.issued['date-parts'][0][0];
                }
            }
            
            // Handle abstract
            if (crossRefData.abstract) {
                result.abstract = crossRefData.abstract;
            }
            
            // Handle short title
            if (crossRefData['short-title'] && crossRefData['short-title'].length > 0) {
                result['title-short'] = crossRefData['short-title'][0];
            }
            
            // Handle edition
            if (crossRefData.edition) {
                result.edition = crossRefData.edition;
            }
            
            // Handle collection title
            if (crossRefData['collection-title']) {
                result['collection-title'] = crossRefData['collection-title'];
            }
            
            // Copy any other relevant fields
            [
                'number', 'number-of-pages', 'number-of-volumes', 'page-first', 
                'references-count', 'journal-issue', 'status', 'accessed'
            ].forEach(field => {
                if (crossRefData[field]) {
                    result[field] = crossRefData[field];
                }
            });
            
            console.log('Mapped CrossRef data to Citoid format:', JSON.stringify(result, null, 2));
            return result;
        } catch (error) {
            console.error('Error mapping CrossRef data:', error);
            return {} as CitoidResponse;
        }
    }
    
    /**
     * Map CrossRef document type to CSL type
     */
    mapCrossRefType(type: string): string {
        const typeMap: {[key: string]: string} = {
            'journal-article': 'article-journal',
            'book-chapter': 'chapter',
            'proceedings-article': 'paper-conference',
            'book': 'book',
            'monograph': 'book',
            'report': 'report',
            'journal-issue': 'article-journal',
            'dissertation': 'thesis'
        };
        
        return typeMap[type] || 'article';
    }
}