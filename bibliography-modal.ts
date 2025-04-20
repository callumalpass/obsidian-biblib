import { App, Modal, Notice, Setting, requestUrl } from 'obsidian';
import * as jsyaml from 'js-yaml';
import { BibliographyPluginSettings } from './types';

export class BibliographyModal extends Modal {
  // Declare additionalFields as a class property
  additionalFields: { type: string; name: string; value: any }[] = [];
  // Form elements for reference and updating
  private idInput: HTMLInputElement;
  private typeDropdown: HTMLSelectElement;
  private titleInput: HTMLInputElement;
  private titleShortInput: HTMLInputElement;
  private pageInput: HTMLInputElement;
  private urlInput: HTMLInputElement;
  private containerTitleInput: HTMLInputElement;
  private yearInput: HTMLInputElement;
  private monthDropdown: HTMLSelectElement;
  private dayInput: HTMLInputElement;
  private publisherInput: HTMLInputElement;
  private publisherPlaceInput: HTMLInputElement;
  private editionInput: HTMLInputElement;
  private volumeInput: HTMLInputElement;
  private numberInput: HTMLInputElement;
  private languageDropdown: HTMLSelectElement;
  private doiInput: HTMLInputElement;
  private abstractInput: HTMLTextAreaElement;
  private contributorsListContainer: HTMLDivElement;
  private contributors: { role: string; given: string; family: string }[] = [];

  constructor(app: App, private settings: BibliographyPluginSettings) {
    super(app);
    console.log('BibliographyModal initialized');
  }
  
  /**
   * Fetch metadata from Citoid API using a URL, DOI, or ISBN
   * @param identifier URL, DOI, or ISBN to query
   * @returns Promise with the citation data or null if not found
   */
  async fetchFromCitoid(identifier: string): Promise<any | null> {
    try {
      // Ensure the URL has a trailing slash
      let apiUrl = this.settings.citoidApiUrl;
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
          const crossrefUrl = `https://api.crossref.org/works/${encodeURIComponent(identifier)}`;
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
            return this.mapCrossRefToCitoid(crossrefResponse.json.message);
          }
        } catch (crossRefError) {
          console.log('CrossRef API failed, trying Citoid API as fallback');
        }
      }
      
      // Prepare and make the request to Citoid API
      const url = `${apiUrl}${encodeURIComponent(identifier)}`;
      console.log(`Fetching from Citoid API: ${url}`);
      
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
  
  /**
   * Map CrossRef API data to Citoid format
   */
  mapCrossRefToCitoid(crossRefData: any): any {
    try {
      console.log('Mapping CrossRef data:', JSON.stringify(crossRefData, null, 2));
      
      const result: any = {
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
      return null;
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
  
  /**
   * Normalize citation data from various sources (Citoid, Zotero) to CSL format
   * @param citationData Raw citation data from API
   * @returns Normalized citation data in CSL format
   */
  normalizeToCslFormat(citationData: any): any {
    // Create a deep copy to avoid modifying the original data
    const normalized = JSON.parse(JSON.stringify(citationData));
    
    // Map of non-CSL fields to their CSL equivalents
    const fieldMappings: {[key: string]: string} = {
      'itemType': 'type',
      'journalAbbreviation': 'container-title-short',
      'shortTitle': 'title-short',
      'publicationTitle': 'container-title',
      'bookTitle': 'container-title',
      'conferenceName': 'event',
      'proceedingsTitle': 'container-title',
      'encyclopediaTitle': 'container-title',
      'dictionaryTitle': 'container-title',
      'websiteTitle': 'container-title',
      'reportNumber': 'number',
      'billNumber': 'number',
      'seriesNumber': 'number',
      'patentNumber': 'number',
      'numPages': 'number-of-pages',
      'numberOfVolumes': 'number-of-volumes',
      'isbn': 'ISBN',
      'issn': 'ISSN',
      'date': 'issued',
      'accessDate': 'accessed',
      'dateDecided': 'issued',
      'dateEnacted': 'issued',
      'pages': 'page',
      'firstPage': 'page-first',
      'place': 'publisher-place',
      'archive_location': 'archive-location',
      'event_place': 'event-place',
      'publisher_place': 'publisher-place',
      'abstractNote': 'abstract'
    };
    
    // Map non-CSL fields to their CSL equivalents
    Object.keys(fieldMappings).forEach(key => {
      if (normalized[key] !== undefined) {
        const cslKey = fieldMappings[key];
        // Only set if the target field doesn't already exist
        if (normalized[cslKey] === undefined) {
          normalized[cslKey] = normalized[key];
        }
      }
    });
    
    // Handle Zotero itemType -> CSL type mapping
    if (normalized.itemType && !normalized.type) {
      normalized.type = this.mapZoteroType(normalized.itemType);
    }
    
    // Handle author field in MediaWiki format (array of [firstName, lastName] arrays)
    if (normalized.author && Array.isArray(normalized.author)) {
      // Check if the first element is an array (MediaWiki format)
      if (normalized.author.length > 0 && Array.isArray(normalized.author[0])) {
        console.log('Converting MediaWiki author format to CSL format');
        
        // Convert MediaWiki format to CSL format
        normalized.author = normalized.author.map((nameArray: string[]) => {
          if (nameArray.length >= 2) {
            return {
              given: nameArray[0], // First element is the given name
              family: nameArray[1]  // Second element is the family name
            };
          } else if (nameArray.length === 1) {
            // If only one name component, treat as family name
            return {
              family: nameArray[0]
            };
          }
          return null;
        }).filter((name): name is { family: string; given?: string } => name !== null);
        
        console.log('Converted authors:', normalized.author);
      }
    }
    
    // Handle creators/contributors fields and convert to CSL format
    if (normalized.creators && Array.isArray(normalized.creators)) {
      // Process creators by type
      const creatorsByType = this.processCreators(normalized.creators);
      
      // Add to normalized data
      Object.keys(creatorsByType).forEach(role => {
        normalized[role] = creatorsByType[role];
      });
      
      // Remove the original creators array
      delete normalized.creators;
    }
    
    // Handle dates in Zotero format (YYYY-MM-DD) and convert to CSL format
    ['date', 'accessDate', 'dateDecided', 'dateEnacted'].forEach(dateField => {
      if (normalized[dateField] && typeof normalized[dateField] === 'string') {
        const dateParts = normalized[dateField].split('-').map(Number);
        const cslField = fieldMappings[dateField] || dateField;
        
        // Convert to CSL date format
        normalized[cslField] = {
          'date-parts': [dateParts.filter((part): part is number => !isNaN(part))]
        };
        
        // Remove the original date field
        if (dateField !== cslField) {
          delete normalized[dateField];
        }
      }
    });
    
    // Handle tags and add as keywords
    if (normalized.tags && Array.isArray(normalized.tags) && normalized.tags.length > 0) {
      // Extract tag values
      const tags = normalized.tags
        .filter((tag): tag is {tag: string} | string => tag && (typeof tag === 'object' ? 'tag' in tag : typeof tag === 'string'))
        .map((tag): string => typeof tag === 'string' ? tag : tag.tag);
      
      if (tags.length > 0) {
        // Join tags into a keyword string (CSL uses a single 'keyword' field)
        if (!normalized.keyword) {
          normalized.keyword = tags.join(', ');
        }
        
        // Also add as separate 'tags' field for non-CSL usage
        normalized.tags = tags;
      }
    }
    
    // Handle ISBN, convert to string if it's an array
    if (normalized.ISBN && Array.isArray(normalized.ISBN) && normalized.ISBN.length > 0) {
      normalized.ISBN = normalized.ISBN[0];
    }
    
    // Handle ISSN, convert to string if it's an array
    if (normalized.ISSN && Array.isArray(normalized.ISSN) && normalized.ISSN.length > 0) {
      normalized.ISSN = normalized.ISSN[0];
    }
    
    // Convert numPages to number-of-pages if not already set
    if (normalized.numPages && !normalized['number-of-pages']) {
      normalized['number-of-pages'] = parseInt(normalized.numPages, 10) || normalized.numPages;
      delete normalized.numPages;
    }
    
    return normalized;
  }
  
  /**
   * Map Zotero item types to CSL types
   */
  mapZoteroType(zoteroType: string): string {
    const typeMap: {[key: string]: string} = {
      'journalArticle': 'article-journal',
      'magazineArticle': 'article-magazine',
      'newspaperArticle': 'article-newspaper',
      'book': 'book',
      'bookSection': 'chapter',
      'thesis': 'thesis',
      'manuscript': 'manuscript',
      'letter': 'personal_communication',
      'interview': 'interview',
      'film': 'motion_picture',
      'artwork': 'graphic',
      'webpage': 'webpage',
      'report': 'report',
      'bill': 'bill',
      'case': 'legal_case',
      'hearing': 'hearing',
      'patent': 'patent',
      'statute': 'legislation',
      'email': 'personal_communication',
      'map': 'map',
      'blogPost': 'post-weblog',
      'instantMessage': 'personal_communication',
      'forumPost': 'post',
      'audioRecording': 'song',
      'presentation': 'speech',
      'videoRecording': 'motion_picture',
      'tvBroadcast': 'broadcast',
      'radioBroadcast': 'broadcast',
      'podcast': 'song',
      'computerProgram': 'software',
      'conferencePaper': 'paper-conference',
      'document': 'article',
      'encyclopediaArticle': 'entry-encyclopedia',
      'dictionaryEntry': 'entry-dictionary'
    };
    
    return typeMap[zoteroType] || 'article';
  }
  
  /**
   * Process creator array into CSL-compatible format
   * @param creators Array of creators from Zotero
   * @returns Object with creators organized by role
   */
  processCreators(creators: any[]): any {
    const result: {[key: string]: any[]} = {};
    
    creators.forEach(creator => {
      // Map Zotero creator types to CSL roles
      const roleMap: {[key: string]: string} = {
        'author': 'author',
        'editor': 'editor',
        'bookAuthor': 'container-author',
        'composer': 'composer',
        'director': 'director',
        'interviewer': 'interviewer',
        'recipient': 'recipient',
        'reviewedAuthor': 'reviewed-author',
        'seriesEditor': 'collection-editor',
        'translator': 'translator'
      };
      
      let role = creator.creatorType || 'author';
      role = roleMap[role] || role;
      
      if (!result[role]) {
        result[role] = [];
      }
      
      // Handle different name formats
      let person = {};
      if (creator.firstName && creator.lastName) {
        person = {
          given: creator.firstName,
          family: creator.lastName
        };
      } else if (creator.given && creator.family) {
        person = {
          given: creator.given,
          family: creator.family
        };
      } else if (creator.name) {
        // For corporation/institutional authors
        person = { literal: creator.name };
      }
      
      result[role].push(person);
    });
    
    return result;
  }
  
  /**
   * Map Citoid API data to form fields
   * @param citationData Data returned from Citoid API
   */
  populateFormFromCitoid(citationData: any): void {
    try {
      console.log('Received citation data:', citationData);
      
      // Normalize citation data to CSL format
      const normalizedData = this.normalizeToCslFormat(citationData);
      console.log('Normalized citation data:', normalizedData);
      
      // Map basic fields
      if (normalizedData.id) {
        this.idInput.value = normalizedData.id;
        this.idInput.dispatchEvent(new Event('input')); // Trigger input event
      } else if (normalizedData.key) {
        // Use Zotero key if present
        this.idInput.value = normalizedData.key;
        this.idInput.dispatchEvent(new Event('input')); // Trigger input event
      } else if (normalizedData.title) {
        // Generate ID from title if not present
        this.idInput.value = this.generateCitekey(normalizedData);
        this.idInput.dispatchEvent(new Event('input')); // Trigger input event
      }
      
      // Log the citekey being set
      console.log(`Citekey set to: ${this.idInput.value}`);
      
      // Type - handle both CSL 'type' and Zotero 'itemType'
      if (normalizedData.type) {
        // Find best match for the type
        const typeValue = this.mapCitoidType(normalizedData.type);
        if (typeValue && this.typeDropdown.querySelector(`option[value="${typeValue}"]`)) {
          this.typeDropdown.value = typeValue;
          // Trigger change event to update any dependent fields
          this.typeDropdown.dispatchEvent(new Event('change'));
        }
      }
      
      // Title fields
      if (normalizedData.title) {
        this.titleInput.value = normalizedData.title;
        this.titleInput.dispatchEvent(new Event('input'));
      }
      
      if (normalizedData['title-short']) {
        this.titleShortInput.value = normalizedData['title-short'];
        this.titleShortInput.dispatchEvent(new Event('input'));
      }
      
      // URL
      if (normalizedData.URL) {
        this.urlInput.value = normalizedData.URL;
        this.urlInput.dispatchEvent(new Event('input'));
      }
      
      // DOI
      if (normalizedData.DOI) {
        this.doiInput.value = normalizedData.DOI;
        this.doiInput.dispatchEvent(new Event('input'));
      }
      
      // Container title (journal, book title, etc.)
      if (normalizedData['container-title']) {
        this.containerTitleInput.value = normalizedData['container-title'];
        this.containerTitleInput.dispatchEvent(new Event('input'));
      }
      
      // Publisher
      if (normalizedData.publisher) {
        this.publisherInput.value = normalizedData.publisher;
        this.publisherInput.dispatchEvent(new Event('input'));
      }
      
      // Publisher place
      if (normalizedData['publisher-place']) {
        this.publisherPlaceInput.value = normalizedData['publisher-place'];
        this.publisherPlaceInput.dispatchEvent(new Event('input'));
      }
      
      // Volume, issue, pages
      if (normalizedData.volume) {
        this.volumeInput.value = normalizedData.volume.toString();
        this.volumeInput.dispatchEvent(new Event('input'));
      }
      
      if (normalizedData.issue) {
        this.numberInput.value = normalizedData.issue.toString();
        this.numberInput.dispatchEvent(new Event('input'));
      } else if (normalizedData.number) {
        this.numberInput.value = normalizedData.number.toString();
        this.numberInput.dispatchEvent(new Event('input'));
      }
      
      if (normalizedData.page) {
        this.pageInput.value = normalizedData.page.toString();
        this.pageInput.dispatchEvent(new Event('input'));
      }
      
      // Language
      if (normalizedData.language && this.languageDropdown.querySelector(`option[value="${normalizedData.language}"]`)) {
        this.languageDropdown.value = normalizedData.language;
        this.languageDropdown.dispatchEvent(new Event('change'));
      }
      
      // Edition
      if (normalizedData.edition) {
        this.editionInput.value = normalizedData.edition.toString();
        this.editionInput.dispatchEvent(new Event('input'));
      }
      
      // Abstract
      if (normalizedData.abstract) {
        this.abstractInput.value = normalizedData.abstract;
        this.abstractInput.dispatchEvent(new Event('input'));
      }
      
      // Date (issued)
      if (normalizedData.issued && normalizedData.issued['date-parts'] && normalizedData.issued['date-parts'][0]) {
        const dateParts = normalizedData.issued['date-parts'][0];
        if (dateParts[0]) { // Year
          this.yearInput.value = dateParts[0].toString();
          this.yearInput.dispatchEvent(new Event('input'));
        }
        if (dateParts[1]) { // Month
          this.monthDropdown.value = dateParts[1].toString();
          this.monthDropdown.dispatchEvent(new Event('change'));
        }
        if (dateParts[2]) { // Day
          this.dayInput.value = dateParts[2].toString();
          this.dayInput.dispatchEvent(new Event('input'));
        }
      } else if (normalizedData.year) {
        // Fallback to year field if issued date-parts not available
        this.yearInput.value = normalizedData.year.toString();
        this.yearInput.dispatchEvent(new Event('input'));
      }
      
      // Contributors (authors, editors, etc.)
      this.handleContributors(normalizedData);
      
      // Handle any additional fields that might be present
      this.handleAdditionalFields(normalizedData);
      
      // Get the container for additional fields - look for the container div
      let additionalFieldsContainer = document.querySelector('.bibliography-modal > div > div');

      if (!additionalFieldsContainer) {
        console.error('Could not find additional fields container, trying alternative selector');
        // Try a more specific approach - find the div after the "Additional Fields" heading
        const additionalFieldsHeading = Array.from(document.querySelectorAll('.bibliography-modal .setting-item-name'))
          .find(el => el.textContent === 'Additional Fields');
        
        if (additionalFieldsHeading) {
          // Get the parent .setting-item and then the next div
          const settingItem = additionalFieldsHeading.closest('.setting-item');
          additionalFieldsContainer = settingItem?.nextElementSibling as HTMLDivElement;
        }
      }
      
      if (!additionalFieldsContainer) {
        console.error('Could not find additional fields container');
      } else {
        // Clear existing field elements
        const existingFields = additionalFieldsContainer.querySelectorAll('.bibliography-additional-field');
        existingFields.forEach(field => field.remove());
        
        // Add the additional fields to the UI
        this.additionalFields.forEach(field => {
          // Add UI element for this field
          const fieldDiv = additionalFieldsContainer?.createDiv({ cls: 'bibliography-additional-field' });
          
          // Create type dropdown
          if (fieldDiv) {
            const typeSelect = fieldDiv.createEl('select', { cls: 'bibliography-input bibliography-field-type' });
            ['', 'Standard', 'Number', 'Date'].forEach((typeOption: string) => {
            const option = typeSelect.createEl('option', { 
              text: typeOption, 
              value: typeOption.toLowerCase() 
            });
            
            // Select the current type
            if (typeOption.toLowerCase() === field.type) {
              option.selected = true;
            }
          });
          
          // Create field name dropdown
          const fieldSelect = fieldDiv.createEl('select', { cls: 'bibliography-input bibliography-field-name' });
          
          // Populate options based on field type
          let fieldOptions: string[] = [];
          if (field.type === 'standard') {
            fieldOptions = [
              '', 'abstract', 'annote', 'archive', 'archive_collection', 'archive_location', 'archive-place',
              'authority', 'call-number', 'citation-key', 'citation-label', 'collection-title',
              'container-title', 'dimensions', 'division', 'DOI', 'event-title', 'event-place',
              'genre', 'ISBN', 'ISSN', 'jurisdiction', 'keyword', 'language', 'license', 'medium',
              'note', 'original-publisher', 'original-publisher-place', 'original-title', 'part-title',
              'PMCID', 'PMID', 'publisher', 'publisher-place', 'references', 'reviewed-genre',
              'reviewed-title', 'scale', 'source', 'status', 'title-short', 'URL', 'volume-title',
              'year-suffix'
            ];
          } else if (field.type === 'number') {
            fieldOptions = [
              '', 'chapter-number', 'citation-number', 'collection-number', 'edition', 'issue', 'locator',
              'number', 'number-of-pages', 'number-of-volumes', 'page', 'page-first', 'part-number',
              'printing-number', 'section', 'supplement-number', 'version', 'volume'
            ];
          } else if (field.type === 'date') {
            fieldOptions = [
              '', 'accessed', 'available-date', 'event-date', 'issued', 'original-date', 'submitted'
            ];
          }
          
          // Add the current key if it's not in the standard options
          if (!fieldOptions.includes(field.name)) {
            fieldOptions.push(field.name);
          }
          
          // Create options for field name
          fieldOptions.forEach(fieldOption => {
            const option = fieldSelect.createEl('option', { 
              text: fieldOption, 
              value: fieldOption 
            });
            
            // Select the current field name
            if (fieldOption === field.name) {
              option.selected = true;
            }
          });
          
          // Create value input based on field type
          const valueDiv = fieldDiv.createDiv({ cls: 'bibliography-field-value-container' });
          if (field.type === 'number') {
            const valueInput = valueDiv.createEl('input', { 
              type: 'number', 
              placeholder: 'Enter Value', 
              cls: 'bibliography-input bibliography-field-value' 
            });
            valueInput.value = field.value.toString();
          } else if (field.type === 'date') {
            const valueInput = valueDiv.createEl('input', { 
              type: 'date', 
              cls: 'bibliography-input bibliography-field-value' 
            });
            valueInput.value = field.value.toString();
          } else {
            const valueInput = valueDiv.createEl('input', { 
              type: 'text', 
              placeholder: 'Enter Value', 
              cls: 'bibliography-input bibliography-field-value' 
            });
            valueInput.value = field.value.toString();
          }
          
          // Add remove button
          const removeButton = fieldDiv.createEl('button', { 
            text: 'Remove', 
            cls: 'bibliography-remove-field-button' 
          });
          removeButton.onclick = () => {
            this.additionalFields = this.additionalFields.filter(f => f !== field);
            fieldDiv.remove();
          };
        });
      }
      
      new Notice('Citation data successfully retrieved and filled');
    } catch (error) {
      console.error('Error populating form from Citoid data:', error);
      new Notice('Error populating form from citation data');
    }
  }
  
  /**
   * Generate a citekey from citation data
   */
  generateCitekey(citationData: any): string {
    try {
      let citekey = '';
      let authorPart = '';
      let yearPart = '';
      
      // Extract author/creator information
      if (citationData.key) {
        // If Zotero key exists, use it
        return citationData.key;
      }
      
      // Handle different author formats
      if (citationData.author) {
        if (Array.isArray(citationData.author)) {
          const firstAuthor = citationData.author[0];
          if (firstAuthor) {
            if (typeof firstAuthor === 'object') {
              // Handle CSL format {family, given}
              if (firstAuthor.family) {
                authorPart = firstAuthor.family.toLowerCase().replace(/\s+/g, '');
              } else if (firstAuthor.lastName) {
                authorPart = firstAuthor.lastName.toLowerCase().replace(/\s+/g, '');
              } else if (firstAuthor.literal) {
                // For institutional authors
                authorPart = firstAuthor.literal.split(' ')[0].toLowerCase().replace(/[^\w]/g, '');
              }
            } else if (Array.isArray(firstAuthor)) {
              // Handle MediaWiki format [firstName, lastName]
              if (firstAuthor.length > 1) {
                authorPart = firstAuthor[1].toLowerCase().replace(/\s+/g, '');
              } else if (firstAuthor.length === 1) {
                authorPart = firstAuthor[0].toLowerCase().replace(/\s+/g, '');
              }
            } else if (typeof firstAuthor === 'string') {
              // Handle string format
              authorPart = firstAuthor.split(' ')[0].toLowerCase().replace(/[^\w]/g, '');
            }
          }
        }
      } else if (citationData.creators && Array.isArray(citationData.creators) && citationData.creators.length > 0) {
        // Handle Zotero creators format
        const firstCreator = citationData.creators[0];
        if (firstCreator.lastName || firstCreator.family) {
          authorPart = (firstCreator.lastName || firstCreator.family).toLowerCase().replace(/\s+/g, '');
        } else if (firstCreator.name) {
          authorPart = firstCreator.name.split(' ')[0].toLowerCase().replace(/[^\w]/g, '');
        }
      }
      
      // If no author found, use title
      if (!authorPart && citationData.title) {
        // Use the first word of the title if no author
        const titleWords = citationData.title.split(/\s+/);
        // Skip articles and common short words
        const skipWords = ['a', 'an', 'the', 'and', 'or', 'but', 'on', 'in', 'at', 'to', 'for', 'with'];
        let wordIndex = 0;
        while (wordIndex < titleWords.length && skipWords.includes(titleWords[wordIndex].toLowerCase())) {
          wordIndex++;
        }
        if (wordIndex < titleWords.length) {
          authorPart = titleWords[wordIndex].toLowerCase().replace(/[^\w]/g, '');
        } else {
          authorPart = titleWords[0].toLowerCase().replace(/[^\w]/g, '');
        }
      }
      
      // If still no author part, use fallback
      if (!authorPart) {
        authorPart = 'citation';
      }
      
      // Add year if available
      if (citationData.issued && citationData.issued['date-parts'] && 
          citationData.issued['date-parts'][0] && citationData.issued['date-parts'][0][0]) {
        yearPart = citationData.issued['date-parts'][0][0].toString();
      } else if (citationData.year) {
        yearPart = citationData.year.toString();
      } else if (citationData.date) {
        // Try to extract year from date string
        const yearMatch = citationData.date.match(/\b(\d{4})\b/);
        if (yearMatch) {
          yearPart = yearMatch[1];
        }
      } else {
        // Current year as fallback
        yearPart = new Date().getFullYear().toString();
      }
      
      // Combine parts to form citekey
      citekey = authorPart + yearPart;
      
      // If it's very short, append something to make it more unique
      if (citekey.length < 6) {
        const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        citekey += randomSuffix;
      }
      
      console.log(`Generated citekey: ${citekey} from author: ${authorPart} and year: ${yearPart}`);
      return citekey;
    } catch (error) {
      console.error('Error generating citekey:', error);
      return 'citation' + new Date().getFullYear();
    }
  }
  
  /**
   * Map Citoid type to CSL type
   */
  mapCitoidType(citoidType: string): string {
    // Convert to lowercase for consistency
    const type = citoidType.toLowerCase();
    
    // Direct mappings for common types
    const typeMap: {[key: string]: string} = {
      'article-journal': 'article-journal',
      'article-magazine': 'article-magazine',
      'article-newspaper': 'article-newspaper',
      'book': 'book',
      'chapter': 'chapter',
      'webpage': 'webpage',
      'paper-conference': 'paper-conference',
      'thesis': 'thesis',
      'report': 'report'
    };
    
    // Return mapped type or fallback to original
    return typeMap[type] || type;
  }
  
  /**
   * Handle contributors from Citoid data
   */
  handleContributors(citationData: any): void {
    // Clear existing contributors first
    this.contributorsListContainer.innerHTML = '';
    this.contributors = [];
    
    // Process different contributor types
    const contributorTypes = [
      'author', 'editor', 'translator', 'container-author', 'collection-editor', 
      'composer', 'director', 'interviewer', 'illustrator', 'original-author', 
      'recipient', 'reviewed-author'
    ];
    
    let foundContributors = false;
    
    // Process CSL-format contributors (person objects with family/given)
    contributorTypes.forEach(role => {
      if (citationData[role] && Array.isArray(citationData[role])) {
        citationData[role].forEach((person: any) => {
          // Handle array format [firstName, lastName]
          if (Array.isArray(person)) {
            if (person.length >= 2) {
              this.addContributorField(role, person[0] || '', person[1] || '');
              foundContributors = true;
            } else if (person.length === 1) {
              this.addContributorField(role, '', person[0] || '');
              foundContributors = true;
            }
          }
          // Handle literal names (institutions)
          else if (person.literal) {
            this.addContributorField(role, '', person.literal);
            foundContributors = true;
          } 
          // Handle CSL format with family/given
          else if (person.family) {
            // Add contributor field
            this.addContributorField(role, person.given || '', person.family);
            foundContributors = true;
          }
          // Try other name formats
          else if (typeof person === 'object') {
            // Try other field combinations
            const lastName = person.lastName || person.family || person.surname || '';
            const firstName = person.firstName || person.given || person.forename || '';
            
            if (lastName || firstName) {
              this.addContributorField(role, firstName, lastName);
              foundContributors = true;
            }
          }
          // Handle string format (just a name)
          else if (typeof person === 'string' && person.trim()) {
            this.addContributorField(role, '', person.trim());
            foundContributors = true;
          }
        });
      }
    });
    
    // Special handling for Zotero "creators" format
    if (citationData.creators && Array.isArray(citationData.creators)) {
      citationData.creators.forEach((creator: any) => {
        // Map Zotero creator types to standard roles
        const roleMap: {[key: string]: string} = {
          'author': 'author',
          'editor': 'editor', 
          'bookAuthor': 'container-author',
          'seriesEditor': 'collection-editor'
        };
        
        const role = roleMap[creator.creatorType] || creator.creatorType || 'author';
        
        if (creator.lastName || creator.family) {
          const lastName = creator.lastName || creator.family;
          const firstName = creator.firstName || creator.given || '';
          this.addContributorField(role, firstName, lastName);
          foundContributors = true;
        } else if (creator.name) {
          // Institutional author
          this.addContributorField(role, '', creator.name);
          foundContributors = true;
        }
      });
    }
    
    // If no contributors were added, add a blank one
    if (!foundContributors) {
      this.addContributorField('author', '', '');
    }
  }
  
  /**
   * Add a contributor field with pre-filled data
   */
  addContributorField(role: string = 'author', given: string = '', family: string = ''): void {
    const contributorDiv = this.contributorsListContainer.createDiv({ cls: 'bibliography-contributor' });
    let contributor = { role, given, family };
    this.contributors.push(contributor);
    
    const roleSelect = contributorDiv.createEl('select', { cls: 'bibliography-input bibliography-contributor-role' });
    [
      'author',
      'editor',
      'chair',
      'collection-editor',
      'compiler',
      'composer',
      'container-author',
      'contributor',
      'curator',
      'director',
      'editorial-director',
      'executive-producer',
      'guest',
      'host',
      'interviewer',
      'illustrator',
      'narrator',
      'organizer',
      'original-author',
      'performer',
      'producer',
      'recipient',
      'reviewed-author',
      'script-writer',
      'series-creator',
      'translator',
    ].forEach(roleOption => {
      roleSelect.createEl('option', { text: roleOption, value: roleOption });
    });
    roleSelect.value = contributor.role;
    roleSelect.onchange = () => {
      contributor.role = roleSelect.value;
      console.log(`Contributor role set to: ${contributor.role}`);
    };
    
    const givenInput = contributorDiv.createEl('input', { type: 'text', placeholder: 'Given Name', cls: 'bibliography-input bibliography-contributor-given' });
    givenInput.value = given;
    givenInput.oninput = () => {
      contributor.given = givenInput.value.trim();
      console.log(`Contributor given name set to: ${contributor.given}`);
    };
    
    const familyInput = contributorDiv.createEl('input', { type: 'text', placeholder: 'Family Name', cls: 'bibliography-input bibliography-contributor-family' });
    familyInput.value = family;
    familyInput.oninput = () => {
      contributor.family = familyInput.value.trim();
      console.log(`Contributor family name set to: ${contributor.family}`);
    };
    
    const removeButton = contributorDiv.createEl('button', { text: 'Remove', cls: 'bibliography-remove-contributor-button' });
    removeButton.onclick = () => {
      this.contributors = this.contributors.filter(c => c !== contributor);
      contributorDiv.remove();
      console.log('Contributor removed');
    };
  }
  
  /**
   * Handle additional fields that may be in Citoid data but not in the main form
   * Ensures all fields are valid CSL fields
   */
  handleAdditionalFields(citationData: any): void {
    // List of fields that are already handled in the main form
    const handledFields = [
      'id', 'type', 'title', 'title-short', 'shortTitle', 'URL', 'DOI', 
      'container-title', 'publisher', 'publisher-place', 'volume', 'issue', 
      'number', 'page', 'language', 'abstract', 'edition', 'issued', 'year',
      'author', 'editor', 'translator', 'container-author'
    ];
    
    // Map of non-CSL fields to their CSL equivalents
    const fieldMappings: {[key: string]: string} = {
      'itemType': 'type',
      'journalAbbreviation': 'container-title-short',
      'shortTitle': 'title-short',
      'publicationTitle': 'container-title',
      'bookTitle': 'container-title',
      'conferenceName': 'event',
      'proceedingsTitle': 'container-title',
      'encyclopediaTitle': 'container-title',
      'dictionaryTitle': 'container-title',
      'websiteTitle': 'container-title',
      'reportNumber': 'number',
      'billNumber': 'number',
      'seriesNumber': 'number',
      'patentNumber': 'number',
      'numPages': 'number-of-pages',
      'numberOfVolumes': 'number-of-volumes',
      'isbn': 'ISBN',
      'issn': 'ISSN',
      'date': 'issued',
      'accessDate': 'accessed',
      'dateDecided': 'issued',
      'dateEnacted': 'issued',
      'pages': 'page',
      'firstPage': 'page-first',
      'creators': 'author',
      'place': 'publisher-place',
      'archive_location': 'archive-location',
      'event_place': 'event-place',
      'publisher_place': 'publisher-place'
    };
    
    // List of valid CSL fields for the additional fields section
    const validCSLFields = [
      'abstract', 'annote', 'archive', 'archive-location', 'archive-place',
      'authority', 'call-number', 'citation-label', 'citation-number',
      'collection-editor', 'collection-number', 'collection-title',
      'container-title', 'container-title-short', 'dimensions', 'event',
      'event-date', 'event-place', 'genre', 'ISBN', 'ISSN', 'jurisdiction',
      'keyword', 'locator', 'medium', 'note', 'original-date', 'original-publisher',
      'original-publisher-place', 'original-title', 'part-number', 'PMCID', 'PMID',
      'printing-number', 'references', 'reviewed-author', 'reviewed-title',
      'scale', 'section', 'source', 'status', 'supplement-number', 'version'
    ];
    
    // Clear existing additional fields
    this.additionalFields = [];
    
    // Collect additional fields, mapping to CSL where needed
    Object.keys(citationData).forEach(key => {
      if (!handledFields.includes(key) && citationData[key]) {
        // Map field names to CSL fields if a mapping exists
        const cslKey = fieldMappings[key] || key;
        
        // Skip if this is a known field that's already handled elsewhere
        if (handledFields.includes(cslKey)) {
          console.log(`Skipping ${key} (maps to ${cslKey}) as it's handled elsewhere`);
          return;
        }
        
        // Skip if this is not a valid CSL field and has no mapping
        if (!validCSLFields.includes(cslKey) && !Object.values(fieldMappings).includes(cslKey)) {
          console.log(`Skipping non-CSL field: ${key} -> ${cslKey}`);
          return;
        }
        
        // Get the value
        let fieldValue = citationData[key];
        
        // Determine field type and format the value
        let fieldType = 'standard';
        
        // Handle different data types
        if (typeof fieldValue === 'number') {
          fieldType = 'number';
        } else if (fieldValue && typeof fieldValue === 'object' && fieldValue['date-parts']) {
          fieldType = 'date';
          // Keep as object with date-parts
        } else if (Array.isArray(fieldValue) && fieldValue.length > 0) {
          // For arrays (like ISBN, ISSN), take the first value
          fieldValue = fieldValue[0];
        }
        
        // Add the field to additional fields array
        this.additionalFields.push({
          type: fieldType,
          name: cslKey,
          value: fieldValue
        });
        
        console.log(`Added additional CSL field: ${cslKey} (${fieldType}) = ${JSON.stringify(fieldValue)}`);
      }
    });
  }

  onOpen() {
    console.log('BibliographyModal opened');
    const { contentEl } = this;
    contentEl.addClass('bibliography-modal');

    // Modal title
    contentEl.createEl('h2', { text: 'Enter Bibliographic Information' });
    
    // Add Citoid lookup fields
    const citoidContainer = contentEl.createDiv({ cls: 'bibliography-citoid-container' });
    citoidContainer.createEl('h3', { text: 'Auto-fill from DOI, URL, or ISBN' });
    
    const citoidInputContainer = citoidContainer.createDiv({ cls: 'bibliography-citoid-input-container' });
    const citoidInput = citoidInputContainer.createEl('input', { 
      type: 'text', 
      placeholder: 'Enter DOI, URL, or ISBN',
      cls: 'bibliography-citoid-input'
    });
    
    const citoidButton = citoidInputContainer.createEl('button', { 
      text: 'Lookup', 
      cls: 'bibliography-citoid-button'
    });
    
    citoidButton.onclick = async () => {
      const identifier = citoidInput.value.trim();
      if (!identifier) {
        new Notice('Please enter a DOI, URL, or ISBN');
        return;
      }
      
      new Notice('Looking up citation data...');
      citoidButton.setAttr('disabled', 'true');
      citoidButton.textContent = 'Looking up...';
      
      try {
        const citationData = await this.fetchFromCitoid(identifier);
        
        if (!citationData) {
          new Notice('No citation data found for the provided identifier');
          return;
        }
        
        // Populate the form with the citation data
        this.populateFormFromCitoid(citationData);
      } catch (error) {
        console.error('Error fetching citation data:', error);
        new Notice('Error fetching citation data. Please check the identifier and try again.');
      } finally {
        citoidButton.removeAttribute('disabled');
        citoidButton.textContent = 'Lookup';
      }
    };
    
    // Add horizontal separator
    contentEl.createEl('hr');

    // Citekey input (required)
    let id = '';
    new Setting(contentEl)
      .setName('Citekey')
      .addText(text => {
        this.idInput = text.inputEl;
        text.setPlaceholder('Enter Citekey').onChange(value => {
          id = value.trim();
          console.log(`Citekey set to: ${id}`); // Log the citekey input
        });
      });

    // Type input (dropdown with validation)
    let type = 'article';
    new Setting(contentEl)
      .setName('Type')
      .addDropdown(dropdown => {
        this.typeDropdown = dropdown.selectEl;
        dropdown.addOptions({
          article: 'Article',
          'article-journal': 'Journal Article',
          'article-magazine': 'Magazine Article',
          'article-newspaper': 'Newspaper Article',
          bill: 'Bill',
          book: 'Book',
          broadcast: 'Broadcast',
          chapter: 'Chapter',
          classic: 'Classic',
          collection: 'Collection',
          dataset: 'Dataset',
          document: 'Document',
          entry: 'Entry',
          'entry-dictionary': 'Dictionary Entry',
          'entry-encyclopedia': 'Encyclopedia Entry',
          event: 'Event',
          figure: 'Figure',
          graphic: 'Graphic',
          hearing: 'Hearing',
          interview: 'Interview',
          legal_case: 'Legal Case',
          legislation: 'Legislation',
          manuscript: 'Manuscript',
          map: 'Map',
          motion_picture: 'Motion Picture',
          musical_score: 'Musical Score',
          pamphlet: 'Pamphlet',
          'paper-conference': 'Conference Paper',
          patent: 'Patent',
          performance: 'Performance',
          periodical: 'Periodical',
          personal_communication: 'Personal Communication',
          post: 'Post',
          'post-weblog': 'Weblog Post',
          regulation: 'Regulation',
          report: 'Report',
          review: 'Review',
          'review-book': 'Book Review',
          software: 'Software',
          song: 'Song',
          speech: 'Speech',
          standard: 'Standard',
          thesis: 'Thesis',
          treaty: 'Treaty',
          webpage: 'Webpage',
        });
		console.log(`Initial type set to: ${type}`);

        dropdown.onChange(value => {
          type = value;
          console.log(`Type set to: ${type}`); // Log the selected type
        });
      });

    // Title input (required)
    let title = '';
    new Setting(contentEl)
      .setName('Title')
      .addText(text => {
        this.titleInput = text.inputEl;
        text.setPlaceholder('Enter Title').onChange(value => {
          title = value.trim();
          console.log(`Title set to: ${title}`); // Log the title input
        });
      });

    // Title-Short input (optional)
    let titleShort = '';
    new Setting(contentEl)
      .setName('Title-Short')
      .addText(text => {
        this.titleShortInput = text.inputEl;
        text.setPlaceholder('Enter Short Title').onChange(value => {
          titleShort = value.trim();
          console.log(`Title-Short set to: ${titleShort}`); // Log the short title input
        });
      });

    // Page input (new field for page or page range)
    let page = '';
    new Setting(contentEl)
      .setName('Page')
      .addText(text => {
        this.pageInput = text.inputEl;
        text.setPlaceholder('Enter Page or Page Range').onChange(value => {
          page = value.trim();
          console.log(`Page set to: ${page}`); // Log the page input
        });
      });

    // URL input (new field for URL)
    let url = '';
    new Setting(contentEl)
      .setName('URL')
      .addText(text => {
        this.urlInput = text.inputEl;
        text.setPlaceholder('Enter URL').onChange(value => {
          url = value.trim();
          console.log(`URL set to: ${url}`); // Log the URL input
        });
      });

    // Contributors (dynamic fields)
    new Setting(contentEl).setName('Contributors');
    this.contributors = [];
    const contributorsContainer = contentEl.createDiv();
    this.contributorsListContainer = contributorsContainer.createDiv({ cls: 'bibliography-contributors-list' });

    const addContributorButton = contentEl.createEl('button', { text: 'Add Contributor', cls: 'bibliography-add-contributor-button' });
    addContributorButton.onclick = () => {
      this.addContributorField('author', '', '');
    };

    // Add initial contributor fields
    this.addContributorField('author', '', '');

    // Date of Publication input
    let year = '', month = '', day = '';
    new Setting(contentEl)
      .setName('Year')
      .addText(text => {
        this.yearInput = text.inputEl;
        text.setPlaceholder('Enter Year').onChange(value => {
          year = value.trim();
          console.log(`Year set to: ${year}`); // Log the year input
        });
      });

    new Setting(contentEl)
      .setName('Month')
      .addDropdown(dropdown => {
        this.monthDropdown = dropdown.selectEl;
        dropdown.addOptions({
          '0': 'Select Month (optional)',
          '1': 'January',
          '2': 'February',
          '3': 'March',
          '4': 'April',
          '5': 'May',
          '6': 'June',
          '7': 'July',
          '8': 'August',
          '9': 'September',
          '10': 'October',
          '11': 'November',
          '12': 'December',
        });

        dropdown.onChange(value => {
          month = value.trim();
          console.log(`Month set to: ${month}`); // Log the month input
          // If "select option" is chosen, the value needs to be cleared
          if(month == '0') {
            month = '';
            console.log(`Month reset`); // Log the month input
          };
        });
      });

    new Setting(contentEl)
      .setName('Day')
      .addText(text => {
        this.dayInput = text.inputEl;
        text.setPlaceholder('Enter Day (optional)').onChange(value => {
          day = value.trim();
          console.log(`Day set to: ${day}`); // Log the day input
        });
      });

    // Container Title input
    let containerTitle = '';
    new Setting(contentEl)
      .setName('Container Title')
      .addText(text => {
        this.containerTitleInput = text.inputEl;
        text.setPlaceholder('Enter Container Title').onChange(value => {
          containerTitle = value.trim();
          console.log(`Container Title set to: ${containerTitle}`); // Log the container title input
        });
      });

    // Publisher input
    let publisher = '';
    new Setting(contentEl)
      .setName('Publisher')
      .addText(text => {
        this.publisherInput = text.inputEl;
        text.setPlaceholder('Enter Publisher').onChange(value => {
          publisher = value.trim();
          console.log(`Publisher set to: ${publisher}`); // Log the publisher input
        });
      });

    // Publisher Place input
    let publisherPlace = '';
    new Setting(contentEl)
      .setName('Publisher Place')
      .addText(text => {
        this.publisherPlaceInput = text.inputEl;
        text.setPlaceholder('Enter Publisher Place').onChange(value => {
          publisherPlace = value.trim();
          console.log(`Publisher Place set to: ${publisherPlace}`); // Log the publisher place input
        });
      });

    // Edition input
    let edition = '';
    new Setting(contentEl)
      .setName('Edition')
      .addText(text => {
        this.editionInput = text.inputEl;
        text.setPlaceholder('Enter Edition (optional)').onChange(value => {
          edition = value.trim();
          console.log(`Edition set to: ${edition}`); // Log the edition input
        });
      });

    // Volume input
    let volume = '';
    new Setting(contentEl)
      .setName('Volume')
      .addText(text => {
        this.volumeInput = text.inputEl;
        text.setPlaceholder('Enter Volume (optional)').onChange(value => {
          volume = value.trim();
          console.log(`Volume set to: ${volume}`); // Log the volume input
        });
      });

    // Number input
    let number = '';
    new Setting(contentEl)
      .setName('Number')
      .addText(text => {
        this.numberInput = text.inputEl;
        text.setPlaceholder('Enter Number (optional)').onChange(value => {
          number = value.trim();
          console.log(`Number set to: ${number}`); // Log the number input
        });
      });

    // Language input (dropdown for standardization)
    let language = '';
    new Setting(contentEl)
      .setName('Language')
      .addDropdown(dropdown => {
        this.languageDropdown = dropdown.selectEl;
        dropdown.addOptions({
          '': 'Select Language',
          'en': 'English',
          'fr': 'French',
          'de': 'German',
          'es': 'Spanish',
          'it': 'Italian',
          'zh': 'Chinese',
          'ja': 'Japanese',
          'ko': 'Korean',
          'ru': 'Russian',
        });
        dropdown.onChange(value => {
          language = value.trim();
          console.log(`Language set to: ${language}`); // Log the language input
        });
      });

    // DOI input
    let doi = '';
    new Setting(contentEl)
      .setName('DOI')
      .addText(text => {
        this.doiInput = text.inputEl;
        text.setPlaceholder('Enter DOI').onChange(value => {
          doi = value.trim();
          console.log(`DOI set to: ${doi}`); // Log the DOI input
        });
      });

    // Abstract input
    let abstract = '';
    new Setting(contentEl)
      .setName('Abstract')
      .addTextArea(text => {
        this.abstractInput = text.inputEl as HTMLTextAreaElement;
        text.setPlaceholder('Enter Abstract').onChange(value => {
          abstract = value.trim();
          console.log('Abstract set'); // Log when the abstract is set
        });
      });

    // File attachment
    let attachment: File | null = null;
    new Setting(contentEl)
      .setName('Attach PDF')
      .addButton(button => {
        button.setButtonText('Choose File').onClick(async () => {
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = '.pdf, .epub';
          fileInput.onchange = () => {
            if (fileInput.files && fileInput.files.length > 0) {
              attachment = fileInput.files[0];
              button.setButtonText(attachment.name);
              console.log(`Attachment selected: ${attachment.name}`); // Log the selected attachment
            }
          };
          fileInput.click();
        });
      });


  // Additional CSL fields section
  new Setting(contentEl).setName('Additional Fields');
  const additionalFieldsContainer = contentEl.createDiv();

  const addAdditionalField = () => {
    console.log('Adding additional field'); // Log when adding an additional field
    const fieldDiv = additionalFieldsContainer.createDiv({ cls: 'bibliography-additional-field' });
    let field = { type: '', name: '', value: '' };
    this.additionalFields.push(field);

    // Dropdown for selecting CSL field type
    const typeSelect = fieldDiv.createEl('select', { cls: 'bibliography-input bibliography-field-type' });
    ['', 'Standard', 'Number', 'Date'].forEach(typeOption => {
      typeSelect.createEl('option', { text: typeOption, value: typeOption.toLowerCase() });
    });
    typeSelect.onchange = () => {
      field.type = typeSelect.value;
      console.log(`Field type set to: ${field.type}`); // Log the selected field type

      // Update CSL field options based on type
      updateFieldSelectOptions();
    };

    // Dropdown for selecting CSL field name
    const fieldSelect = fieldDiv.createEl('select', { cls: 'bibliography-input bibliography-field-name' });
    const updateFieldSelectOptions = () => {
      fieldSelect.empty(); // Clear existing options
	  let fieldOptions: string[] = [];

      if (field.type === 'standard') {
        fieldOptions = [
          '', 'abstract', 'annote', 'archive', 'archive_collection', 'archive_location', 'archive-place',
          'authority', 'call-number', 'citation-key', 'citation-label', 'collection-title',
          'container-title', 'dimensions', 'division', 'DOI', 'event-title', 'event-place',
          'genre', 'ISBN', 'ISSN', 'jurisdiction', 'keyword', 'language', 'license', 'medium',
          'note', 'original-publisher', 'original-publisher-place', 'original-title', 'part-title',
          'PMCID', 'PMID', 'publisher', 'publisher-place', 'references', 'reviewed-genre',
          'reviewed-title', 'scale', 'source', 'status', 'title-short', 'URL', 'volume-title',
          'year-suffix'
        ];
      } else if (field.type === 'number') {
        fieldOptions = [
          '', 'chapter-number', 'citation-number', 'collection-number', 'edition', 'issue', 'locator',
          'number', 'number-of-pages', 'number-of-volumes', 'page', 'page-first', 'part-number',
          'printing-number', 'section', 'supplement-number', 'version', 'volume'
        ];
      } else if (field.type === 'date') {
        fieldOptions = [
          '', 'accessed', 'available-date', 'event-date', 'issued', 'original-date', 'submitted'
        ];
      }
	  fieldOptions.forEach((fieldOption: string) => {
    	fieldSelect.createEl('option', { text: fieldOption, value: fieldOption });
	  });

    };


    fieldSelect.onchange = () => {
      field.name = fieldSelect.value;
      console.log(`Field name set to: ${field.name}`); // Log the selected field name

      // Remove any existing value input and create a new one based on field type
      const valueInputContainer = fieldDiv.querySelector('.bibliography-field-value-container');
      if (valueInputContainer) {
        valueInputContainer.remove();
      }
      const valueDiv = fieldDiv.createDiv({ cls: 'bibliography-field-value-container' });
      if (field.type === 'number') {
        const valueInput = valueDiv.createEl('input', { type: 'number', placeholder: 'Enter Value', cls: 'bibliography-input bibliography-field-value' });
        valueInput.oninput = () => {
		  field.value = Number(valueInput.value.trim()).toString();

          console.log(`Field value set to: ${field.value}`); // Log the field value input
        };
      } else if (field.type === 'date') {
        const valueInput = valueDiv.createEl('input', { type: 'date', cls: 'bibliography-input bibliography-field-value' });
        valueInput.oninput = () => {
          field.value = valueInput.value.trim();
          console.log(`Field value set to: ${field.value}`); // Log the field value input
        };
      } else {
        const valueInput = valueDiv.createEl('input', { type: 'text', placeholder: 'Enter Value', cls: 'bibliography-input bibliography-field-value' });
        valueInput.oninput = () => {
          field.value = valueInput.value.trim();
          console.log(`Field value set to: ${field.value}`); // Log the field value input
        };
      }
    };
    // Remove button for the additional field
    const removeButton = fieldDiv.createEl('button', { text: 'Remove', cls: 'bibliography-remove-field-button' });
    removeButton.onclick = () => {
      this.additionalFields = this.additionalFields.filter(f => f !== field);
      fieldDiv.remove();
      console.log('Additional field removed'); // Log when an additional field is removed
    };

  };

// Button to add additional fields
const addFieldButton = contentEl.createEl('button', { text: 'Add Field', cls: 'bibliography-add-field-button' });
addFieldButton.onclick = () => {
  addAdditionalField();
};

    // Submit button
    const buttonContainer = contentEl.createDiv();
    const submitButton = buttonContainer.createEl('button', { text: 'Create Note', cls: 'create-button' });
    submitButton.onclick = () => {
      // Get the current citekey value directly from the input field
      const currentId = this.idInput.value.trim();
      console.log('Current citekey value from input field:', currentId);
      
      // Get current values from form fields (for debugging)
      console.log('Form state on submit:', {
        id: currentId,
        title: title,
        type: type,
        year: year
      });
      
      // Validate required fields before proceeding
      if (!currentId) {
        new Notice('Citekey is required.');
        return;
      }
      if (!title) {
        new Notice('Title is required.');
        return;
      }
      if (!type) {
        new Notice('Type is required.');
        return;
      }
      if (!year) {
        new Notice('Year is required.');
        return;
      }
      
      console.log('Submit button clicked, all validations passed');
      // Use this.contributors instead of the undefined contributors variable, and use currentId
      this.handleSubmit(currentId, title, titleShort, this.contributors, containerTitle, year, month, day, type, publisher, publisherPlace, edition, volume, number, language, doi, abstract, attachment, page, url);
    };
  }

  async handleSubmit(
    id: string,
    title: string,
    titleShort: string,
    contributors: { role: string; given: string; family: string }[],
    containerTitle: string,
    year: string,
    month: string,
    day: string,
    type: string,
    publisher: string,
    publisherPlace: string,
    edition: string,
    volume: string,
    number: string,
    language: string,
    doi: string,
    abstract: string,
    attachment: File | null,
    page: string,
    url: string
  ): Promise<void> {
    console.log('Handling submit');
    // Handle the creation of the YAML and the new note
    // Create frontmatter in CSL-compatible format
    const frontmatter: any = {
      id,
      type,
      title,
      // Use CSL date format for issued date
      issued: {
        'date-parts': [[Number(year), month ? Number(month) : '', day ? Number(day) : ''].filter((v) => v !== '')],
      },
      // Add standard CSL fields (only if they have values)
      ...(titleShort && { 'title-short': titleShort }),
      ...(page && { page }),
      ...(url && { URL: url }),
      ...(containerTitle && { 'container-title': containerTitle }),
      ...(publisher && { publisher }),
      ...(publisherPlace && { 'publisher-place': publisherPlace }),
      ...(edition && { edition: isNaN(Number(edition)) ? edition : Number(edition) }),
      ...(volume && { volume: isNaN(Number(volume)) ? volume : Number(volume) }),
      ...(number && { number: isNaN(Number(number)) ? number : Number(number) }),
      ...(language && { language }),
      ...(doi && { DOI: doi }),
      ...(abstract && { abstract }),
      // Add metadata fields (non-CSL)
      dateAdded: new Date().toISOString(),
      tags: ['literature_note'],
    };

    // Add contributors to frontmatter
    contributors.forEach(contributor => {
      if (contributor.given || contributor.family) {
        if (!frontmatter[contributor.role]) {
          frontmatter[contributor.role] = [];
        }
        frontmatter[contributor.role].push({
          family: contributor.family,
          ...(contributor.given && { given: contributor.given }),
        });
        console.log(`Contributor added: ${contributor.role}, ${contributor.given} ${contributor.family}`); // Log contributor details
      }
    });

    // Add authorLink to frontmatter
    const authorLinks: string[] = contributors
      .filter(contributor => contributor.role === 'author' && contributor.family)
      .map(contributor => {
        const fullName = `${contributor.given ? `${contributor.given} ` : ''}${contributor.family}`;
        return `[[Author/${fullName}|${fullName}]]`;
      });

    if (authorLinks.length > 0) {
      frontmatter.authorLink = authorLinks;
      console.log('Author links added'); // Log when author links are added
    }

	this.additionalFields.forEach((field: { type: string; name: string; value: any }) => {
     if (field.name && field.value !== '') {
       // Assign based on type
       if (field.type === 'date') {
         // For date type fields, ensure they have the proper CSL date-parts structure
         if (typeof field.value === 'object' && field.value['date-parts']) {
           // It's already in CSL format
           frontmatter[field.name] = field.value;
         } else if (typeof field.value === 'string') {
           // Parse date string (YYYY-MM-DD)
           const dateParts = field.value.split('-').map(Number).filter(part => !isNaN(part));
           frontmatter[field.name] = { 'date-parts': [dateParts] };
         }
       } else if (field.type === 'number') {
         // Ensure numbers are stored as numbers, not strings
         const numValue = parseFloat(field.value);
         frontmatter[field.name] = isNaN(numValue) ? field.value : numValue;
       } else {
         // For standard fields, use the value as is
         frontmatter[field.name] = field.value;
       }
       console.log(`Additional field added: ${field.name}, ${typeof frontmatter[field.name] === 'object' ? JSON.stringify(frontmatter[field.name]) : frontmatter[field.name]}`);
     }
   });


	const biblibPath = this.settings.attachmentFolderPath;
    if (!this.app.vault.getAbstractFileByPath(biblibPath)) {
      await this.app.vault.createFolder(biblibPath);
      console.log(`Folder created: ${biblibPath}`); // Log folder creation
    }
	let attachmentPath = '';
	if (attachment) {
		const fileExtension = attachment.name.split('.').pop();

		if (this.settings.createAttachmentSubfolder) {
			// Create subfolder if enabled
			const attachmentFolderPath = `${biblibPath}/${id}`;
			if (!this.app.vault.getAbstractFileByPath(attachmentFolderPath)) {
				await this.app.vault.createFolder(attachmentFolderPath);
				console.log(`Folder created: ${attachmentFolderPath}`);
			}
			attachmentPath = `${attachmentFolderPath}/${id}.${fileExtension}`;
		} else {
			// Store directly in attachment folder
			attachmentPath = `${biblibPath}/${id}.${fileExtension}`;
		}

		const arrayBuffer = await attachment.arrayBuffer();
		const data = new Uint8Array(arrayBuffer);
		await this.app.vault.createBinary(attachmentPath, data);
		frontmatter.attachment = [`[[${attachmentPath}|${id}]]`];
		console.log(`Attachment saved: ${attachmentPath}`);
	}

    const yaml = jsyaml.dump(frontmatter);
    const content = `---\n${yaml}---\n\n# [[biblib/${id}/${id}.pdf|${id}]]\n\n`;
	// Use settings for note filename and path
    const prefix = this.settings.usePrefix ? this.settings.notePrefix : '';
    const fileName = `${prefix}${id}.md`;
    const notePath = `${this.settings.literatureNotePath}${fileName}`.replace(/\/+/g, '/');

    await this.app.vault.create(notePath, content);
    new Notice(`Literature note "${title}" created.`);
    console.log(`Literature note created: ${notePath}`); // Log note creation
    this.close();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    console.log('BibliographyModal closed'); // Log when modal is closed
  }
}
