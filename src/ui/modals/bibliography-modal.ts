import { App, Modal, Notice, Setting, ButtonComponent } from 'obsidian'; // Added ButtonComponent
import { BibliographyPluginSettings } from '../../types/settings';
import { Contributor, AdditionalField, Citation, AttachmentData, AttachmentType } from '../../types/citation';
import { ContributorField } from '../components/contributor-field';
import { AdditionalFieldComponent } from '../components/additional-field';
import { CitoidService } from '../../services/api/citoid';
import { CitationService } from '../../services/citation-service';
import { CitekeyGenerator } from '../../utils/citekey-generator';
import { FileManager } from '../../services/file-manager';

export class BibliographyModal extends Modal {
    // Services
    private citoidService: CitoidService;
    private citationService: CitationService;
    private fileManager: FileManager;
    
    // Data state
    private additionalFields: AdditionalField[] = [];
    private contributors: Contributor[] = [];
    
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
    private additionalFieldsContainer: HTMLDivElement;
    
    // Attachment data in the new structure
    private attachmentData: AttachmentData = { type: AttachmentType.NONE };

    constructor(app: App, private settings: BibliographyPluginSettings) {
        super(app);
        // Initialize services with fixed BibTeX endpoint
        this.citoidService = new CitoidService();
        this.citationService = new CitationService();
        this.fileManager = new FileManager(app, settings);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('bibliography-modal');

        // Modal title
        contentEl.createEl('h2', { text: 'Enter Bibliographic Information' });
        
        // Add Citoid lookup fields
        this.createCitoidLookupSection(contentEl);
        
        // Add horizontal separator
        contentEl.createEl('hr');
        
        // Add section title
        contentEl.createEl('h3', { text: 'Entry Details' });

        // Create the main form
        this.createMainForm(contentEl);
    }

    private createCitoidLookupSection(contentEl: HTMLElement) {
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
                // Fetch normalized CSL via Citation.js (tries JSON then BibTeX)
                const normalizedData = await this.citationService.fetchNormalized(identifier);
                if (!normalizedData) {
                    new Notice('No citation data found for the provided identifier');
                    return;
                }
                this.populateFormFromCitoid(normalizedData);
            } catch (error) {
                console.error('Error fetching citation data:', error);
                new Notice('Error fetching citation data. Please check the identifier and try again.');
            } finally {
                citoidButton.removeAttribute('disabled');
                citoidButton.textContent = 'Lookup';
            }
        };
    }

    private createMainForm(contentEl: HTMLElement) {
        // Citekey input (required)
        new Setting(contentEl)
            .setName('Citekey')
            .addText(text => {
                this.idInput = text.inputEl;
                text.setPlaceholder('Enter Citekey')
                  .onChange(value => {
                     // Potential future validation or auto-generation logic
                  });
            });

        // Type input (dropdown with validation)
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

                dropdown.onChange(value => {
                    // Potential future logic based on type change
                });
            });

        // Title input (required)
        new Setting(contentEl)
            .setName('Title')
            .addText(text => {
                this.titleInput = text.inputEl;
                text.setPlaceholder('Enter Title').onChange(value => {
                     // Potential future logic
                });
            });

        // Title-Short input (optional)
        new Setting(contentEl)
            .setName('Title-Short')
            .addText(text => {
                this.titleShortInput = text.inputEl;
                text.setPlaceholder('Enter Short Title').onChange(value => {
                    // Potential future logic
                });
            });

        // Page input
        new Setting(contentEl)
            .setName('Page')
            .addText(text => {
                this.pageInput = text.inputEl;
                text.setPlaceholder('Enter Page or Page Range').onChange(value => {
                     // Potential future logic
                });
            });

        // URL input
        new Setting(contentEl)
            .setName('URL')
            .addText(text => {
                this.urlInput = text.inputEl;
                text.setPlaceholder('Enter URL').onChange(value => {
                     // Potential future logic
                });
            });

        // Contributors section
        new Setting(contentEl).setName('Contributors').setHeading(); // Use heading for clarity
        const contributorsContainer = contentEl.createDiv();
        this.contributorsListContainer = contributorsContainer.createDiv({ cls: 'bibliography-contributors-list' });

        const addContributorButton = contentEl.createEl('button', { 
            text: 'Add Contributor', 
            cls: 'bibliography-add-contributor-button' 
        });
        addContributorButton.onclick = () => {
            this.addContributor('author', '', '');
        };

        // Add initial contributor field
        this.addContributor('author', '', '');

        // --- Date of Publication inputs ---
         new Setting(contentEl).setName('Publication Date').setHeading(); // Use heading for clarity

        new Setting(contentEl)
            .setName('Year')
            .addText(text => {
                this.yearInput = text.inputEl;
                text.setPlaceholder('Enter Year').onChange(value => {
                     // Potential future logic
                });
            });

        new Setting(contentEl)
            .setName('Month')
            .addDropdown(dropdown => {
                this.monthDropdown = dropdown.selectEl;
                dropdown.addOptions({
                    '0': 'Select Month (optional)',
                    '1': 'January', '2': 'February', '3': 'March', '4': 'April', 
                    '5': 'May', '6': 'June', '7': 'July', '8': 'August', 
                    '9': 'September', '10': 'October', '11': 'November', '12': 'December',
                });
                // Set initial value if needed, maybe based on current month?
                dropdown.onChange(value => {
                    // If "select option" is chosen, the value needs to be cleared internally
                    // No explicit action needed here unless dependent logic exists
                });
            });

        new Setting(contentEl)
            .setName('Day')
            .addText(text => {
                this.dayInput = text.inputEl;
                text.setPlaceholder('Enter Day (optional)').onChange(value => {
                     // Potential future logic
                });
            });

        // --- Publication Details --- 
        new Setting(contentEl).setName('Publication Details').setHeading(); // Use heading for clarity

        // Container Title input
        new Setting(contentEl)
            .setName('Container Title')
            .setDesc('e.g., Journal, Book Title, Website')
            .addText(text => {
                this.containerTitleInput = text.inputEl;
                text.setPlaceholder('Enter Container Title').onChange(value => {
                     // Potential future logic
                });
            });

        // Publisher input
        new Setting(contentEl)
            .setName('Publisher')
            .addText(text => {
                this.publisherInput = text.inputEl;
                text.setPlaceholder('Enter Publisher').onChange(value => {
                     // Potential future logic
                });
            });

        // Publisher Place input
        new Setting(contentEl)
            .setName('Publisher Place')
            .addText(text => {
                this.publisherPlaceInput = text.inputEl;
                text.setPlaceholder('Enter Publisher Place').onChange(value => {
                     // Potential future logic
                });
            });

        // Edition input
        new Setting(contentEl)
            .setName('Edition')
            .addText(text => {
                this.editionInput = text.inputEl;
                text.setPlaceholder('Enter Edition (optional)').onChange(value => {
                     // Potential future logic
                });
            });

        // Volume input
        new Setting(contentEl)
            .setName('Volume')
            .addText(text => {
                this.volumeInput = text.inputEl;
                text.setPlaceholder('Enter Volume (optional)').onChange(value => {
                     // Potential future logic
                });
            });

        // Number input (can mean Issue, Report Number, etc.)
        new Setting(contentEl)
            .setName('Number')
            .setDesc('e.g., Issue number, Report number')
            .addText(text => {
                this.numberInput = text.inputEl;
                text.setPlaceholder('Enter Number (optional)').onChange(value => {
                     // Potential future logic
                });
            });

        // Language input (dropdown for standardization)
        new Setting(contentEl)
            .setName('Language')
            .addDropdown(dropdown => {
                this.languageDropdown = dropdown.selectEl;
                // Consider adding more languages or making this configurable
                dropdown.addOptions({
                    '': 'Select Language',
                    'en': 'English', 'fr': 'French', 'de': 'German', 'es': 'Spanish',
                    'it': 'Italian', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean',
                    'ru': 'Russian',
                });
                dropdown.onChange(value => {
                     // Potential future logic
                });
            });

        // DOI input
        new Setting(contentEl)
            .setName('DOI')
            .addText(text => {
                this.doiInput = text.inputEl;
                text.setPlaceholder('Enter DOI').onChange(value => {
                     // Potential future logic
                });
            });

        // Abstract input
        new Setting(contentEl)
            .setName('Abstract')
            .addTextArea(text => {
                this.abstractInput = text.inputEl;
                text.setPlaceholder('Enter Abstract').onChange(value => {
                     // Potential future logic
                });
            });

        // --- Attachment Section --- 
        new Setting(contentEl).setName('Attachment').setHeading();

        const attachmentSection = new Setting(contentEl)
            // .setName('Attachment') // Name moved to heading
            .setDesc('Choose how to handle the attachment');
            
        // Create import button setting (hidden initially)
        const importSetting = new Setting(contentEl)
            .setName('Select File to Import')
            .addButton(button => {
                button.setButtonText('Choose File').onClick(async () => {
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = '.pdf, .epub'; // Accept common formats
                    fileInput.onchange = () => {
                        if (fileInput.files && fileInput.files.length > 0) {
                            this.attachmentData = {
                                type: AttachmentType.IMPORT,
                                file: fileInput.files[0],
                                filename: fileInput.files[0].name
                            };
                            // Use || '' as fallback for potentially undefined filename
                            button.setButtonText(this.attachmentData.filename || 'Choose File'); 
                        }
                    };
                    fileInput.click();
                });
            });
            
        // Create link button setting (hidden initially)
        const linkSetting = new Setting(contentEl)
            .setName('Link to Existing File')
            .addButton(button => {
                button.setButtonText('Select File Path').onClick(async () => {
                    // Create a temporary modal to get the file path
                    const linkModal = new Modal(this.app);
                    linkModal.contentEl.addClass('bibliography-link-modal'); // Add class for styling
                    linkModal.titleEl.textContent = 'Enter Path to File';
                    
                    const form = linkModal.contentEl.createDiv();
                    const filePathInput = form.createEl('input', { 
                        type: 'text', 
                        placeholder: 'Enter file path in vault'
                    });
                    filePathInput.addClass('link-path-input'); // Use CSS class
                    
                    const buttonContainer = linkModal.contentEl.createDiv();
                    buttonContainer.addClass('link-button-container'); // Use CSS class
                    
                    const submitButton = buttonContainer.createEl('button', {
                        text: 'Link File',
                        cls: 'mod-cta' // Call to action style
                    });
                    submitButton.onclick = () => {
                        const filePath = filePathInput.value.trim();
                        if (filePath) {
                            this.attachmentData = {
                                type: AttachmentType.LINK,
                                path: filePath, // Path will be normalized by FileManager
                                filename: filePath.split('/').pop() || filePath
                            };
                             // Use || '' as fallback for potentially undefined filename
                            button.setButtonText(this.attachmentData.filename || 'Select File Path'); 
                            linkModal.close();
                        }
                    };
                    
                    const cancelButton = buttonContainer.createEl('button', {
                        text: 'Cancel'
                    });
                    cancelButton.onclick = () => {
                        linkModal.close();
                    };
                    
                    linkModal.open();
                });
            });
            
        // Initially hide both buttons from DOM
        importSetting.settingEl.style.display = 'none';
        linkSetting.settingEl.style.display = 'none';
        // Add them to the DOM but hidden
        attachmentSection.settingEl.insertAdjacentElement('afterend', importSetting.settingEl);
        attachmentSection.settingEl.insertAdjacentElement('afterend', linkSetting.settingEl); 
        
        // Add dropdown for attachment type
        attachmentSection.addDropdown(dropdown => {
            dropdown.addOptions({
                'none': 'No Attachment',
                'import': 'Import File (Copy to biblib folder)',
                'link': 'Link to Existing File'
            });
            dropdown.onChange(value => {
                // Update attachment data type
                this.attachmentData.type = value as AttachmentType;
                this.attachmentData.file = undefined; // Clear file/path when type changes
                this.attachmentData.path = undefined;
                
                // Show/hide appropriate button setting
                importSetting.settingEl.style.display = (value === 'import') ? '' : 'none';
                linkSetting.settingEl.style.display = (value === 'link') ? '' : 'none';
                
                // Reset button texts if needed (Cast to ButtonComponent)
                (importSetting.components[0] as ButtonComponent).setButtonText('Choose File'); 
                (linkSetting.components[0] as ButtonComponent).setButtonText('Select File Path');
            });
        });

        // --- Additional CSL fields section --- 
        new Setting(contentEl).setName('Additional Fields').setHeading();

        // Add explanation for highlighted fields
		const additionalFieldsDesc = contentEl.createEl('p', { 
		    cls: 'setting-item-description', // Use standard Obsidian description class
		    text: 'Fields that are not standard CSL variables will be highlighted. These are often imported from external sources but may not be recognized by all citation tools.'
		});

        this.additionalFieldsContainer = contentEl.createDiv();

        // Button to add additional fields
        const addFieldButton = contentEl.createEl('button', { 
            text: 'Add Field', 
            cls: 'bibliography-add-field-button' 
        });
        addFieldButton.onclick = () => {
            this.addAdditionalField('standard', '', '');
        };

        // --- Submit Button --- 
        const finalButtonContainer = contentEl.createDiv({cls: 'bibliography-submit-container'});
        const submitButton = finalButtonContainer.createEl('button', { 
            text: 'Create Note', 
            cls: 'mod-cta create-button' // Use call to action style
        });
        submitButton.onclick = async () => { // Make async
            // Get the current form values
            const citation: Citation = this.getFormValues();
            
            // Validate required fields before proceeding
            if (!this.validateForm(citation)) {
                return;
            }
            
            // Disable button during submission
            submitButton.disabled = true;
            submitButton.textContent = 'Creating...';

            await this.handleSubmit(citation);

            // Re-enable button after submission (handled in handleSubmit success/error)
             // submitButton.disabled = false; 
             // submitButton.textContent = 'Create Note';
        };
    }

    /**
     * Add a contributor field UI component
     * @param role - CSL role (e.g., 'author')
     * @param dataOrGiven - raw CSL contributor object or given name string
     * @param family - family name (used when dataOrGiven is a given name)
     */
    private addContributor(role: string = 'author', dataOrGiven: any = '', family?: string): void {
        let contributor: Contributor;
        // If provided a raw CSL contributor object, merge all its properties
        if (dataOrGiven && typeof dataOrGiven === 'object') {
            contributor = { role, ...dataOrGiven };
        } else {
            // Otherwise treat dataOrGiven as the given name and family as the family name
            contributor = { role, given: dataOrGiven || '', family: family || '' };
        }
        this.contributors.push(contributor);
        
        new ContributorField(
            this.contributorsListContainer,
            contributor,
            (contributorToRemove) => {
                this.contributors = this.contributors.filter(c => c !== contributorToRemove);
            }
        );
    }

    /**
     * Add an additional field UI component
     */
    private addAdditionalField(type: AdditionalField['type'] = 'standard', name: string = '', value: any = ''): void {
        const field: AdditionalField = { type, name, value };
        this.additionalFields.push(field);
        
        new AdditionalFieldComponent(
            this.additionalFieldsContainer,
            field,
            (fieldToRemove) => {
                this.additionalFields = this.additionalFields.filter(f => f !== fieldToRemove);
            }
        );
    }

    /**
     * Populate form fields from Citoid API data (normalized CSL)
     */
    private populateFormFromCitoid(normalizedData: any): void {
        try {
            // Map common camelCase keys from Citoid/Citation.js into hyphen-case for form fields
            // (e.g., containerTitle -> container-title, publisherPlace -> publisher-place, titleShort -> title-short)
            const remap: [string, string][] = [
                ['titleShort', 'title-short'],
                ['containerTitle', 'container-title'],
                ['publisherPlace', 'publisher-place'],
            ];
            for (const [camel, dash] of remap) {
                if (normalizedData[camel] !== undefined && normalizedData[dash] === undefined) {
                    normalizedData[dash] = normalizedData[camel];
                }
            }
            // --- Populate Basic Fields ---
            let generatedCitekey = false;
            if (normalizedData.id) {
                this.idInput.value = normalizedData.id;
            } else if (normalizedData.key) { // Zotero key fallback
                this.idInput.value = normalizedData.key;
            } else if (normalizedData.title) {
                 // Generate key using potentially available author/year from normalized data
                this.idInput.value = CitekeyGenerator.generate(normalizedData); 
                generatedCitekey = true;
            }
            this.idInput.dispatchEvent(new Event('input'));
            if (generatedCitekey) new Notice(`Generated citekey: ${this.idInput.value}`, 3000); // Short notice
            
            if (normalizedData.type) {
                // Set the type dropdown if the value matches one of the options
                const val = normalizedData.type;
                if (this.typeDropdown.querySelector(`option[value="${val}"]`)) {
                    this.typeDropdown.value = val;
                    this.typeDropdown.dispatchEvent(new Event('change'));
                }
            }
            
            if (normalizedData.title) {
                this.titleInput.value = normalizedData.title;
                this.titleInput.dispatchEvent(new Event('input'));
            }
            if (normalizedData['title-short']) {
                this.titleShortInput.value = normalizedData['title-short'];
                this.titleShortInput.dispatchEvent(new Event('input'));
            }
            if (normalizedData.URL) {
                this.urlInput.value = normalizedData.URL;
                this.urlInput.dispatchEvent(new Event('input'));
            }
            if (normalizedData.DOI) {
                this.doiInput.value = normalizedData.DOI;
                this.doiInput.dispatchEvent(new Event('input'));
            }
            if (normalizedData['container-title']) {
                this.containerTitleInput.value = normalizedData['container-title'];
                this.containerTitleInput.dispatchEvent(new Event('input'));
            }
            if (normalizedData.publisher) {
                this.publisherInput.value = normalizedData.publisher;
                this.publisherInput.dispatchEvent(new Event('input'));
            }
            if (normalizedData['publisher-place']) {
                this.publisherPlaceInput.value = normalizedData['publisher-place'];
                this.publisherPlaceInput.dispatchEvent(new Event('input'));
            }
            if (normalizedData.volume) {
                this.volumeInput.value = normalizedData.volume.toString();
                this.volumeInput.dispatchEvent(new Event('input'));
            }
            // Handle both issue and number as potential fields for issue number
            const issueOrNumber = normalizedData.issue || normalizedData.number;
            if (issueOrNumber) {
                this.numberInput.value = issueOrNumber.toString();
                this.numberInput.dispatchEvent(new Event('input'));
            }
            if (normalizedData.page) {
                this.pageInput.value = normalizedData.page.toString();
                this.pageInput.dispatchEvent(new Event('input'));
            }
            if (normalizedData.language && this.languageDropdown.querySelector(`option[value="${normalizedData.language}"]`)) {
                this.languageDropdown.value = normalizedData.language;
                this.languageDropdown.dispatchEvent(new Event('change'));
            }
            if (normalizedData.edition) {
                this.editionInput.value = normalizedData.edition.toString();
                this.editionInput.dispatchEvent(new Event('input'));
            }
            if (normalizedData.abstract) {
                this.abstractInput.value = normalizedData.abstract;
                this.abstractInput.dispatchEvent(new Event('input'));
            }
            
            // --- Populate Date --- 
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
            } else if (normalizedData.year) { // Fallback to year field
                this.yearInput.value = normalizedData.year.toString();
                this.yearInput.dispatchEvent(new Event('input'));
            }
            
            // --- Populate Contributors --- 
            // Debug: inspect full normalizedData
            this.handleContributors(normalizedData);
            
            // --- Populate Additional Fields --- 
            this.handleAdditionalFields(normalizedData);
            
            new Notice('Citation data successfully retrieved and filled');
        } catch (error) {
            console.error('Error populating form from Citoid data:', error);
            new Notice('Error populating form from citation data');
        }
    }

    /**
     * Handle contributors from normalized CSL data
     * Supports raw CSL contributor objects (with arbitrary properties) and plain string names
     */
    private handleContributors(normalizedData: any): void {
        // Clear existing contributor UI elements and internal state
        this.contributorsListContainer.empty();
        this.contributors = [];
        
        // Populate primary contributors: authors and editors
        let added = false;
        // Authors
        if (Array.isArray(normalizedData.author) && normalizedData.author.length) {
            normalizedData.author.forEach((person: any) => {
                this.addContributor('author', person);
                added = true;
            });
        }
        // Editors
        if (Array.isArray(normalizedData.editor) && normalizedData.editor.length) {
            normalizedData.editor.forEach((person: any) => {
                this.addContributor('editor', person);
                added = true;
            });
        }
        // Fallback: one empty author field if none found
        if (!added) {
            this.addContributor('author', '', '');
        }
    }

    /**
     * Handle additional fields from normalized CSL data
     */
    private handleAdditionalFields(normalizedData: any): void {
        // List of fields already handled explicitly in the main form
        const mainFormFields = new Set([
            'id', 'type', 'title', 'title-short', 'URL', 'DOI', 'container-title', 
            'publisher', 'publisher-place', 'volume', 'issue', 'number', 'page', 
            'language', 'abstract', 'edition', 'issued', 'year',
             // Contributor roles handled separately
            'author', 'editor', 'translator', 'container-author', 'collection-editor', 
            'composer', 'director', 'interviewer', 'illustrator', 'original-author', 
            'recipient', 'reviewed-author', 'chair', 'compiler', 'contributor', 
            'curator', 'editorial-director', 'executive-producer', 'guest', 'host', 
            'narrator', 'organizer', 'performer', 'producer', 'script-writer', 
            'series-creator',
			// Source-specific fields whose values are mapped elsewhere or should be ignored
			// 'publisherTitle', 'itemType',
            // Fields used internally or mapped
            'key', 'tags' 
        ]);

        // Clear existing additional field UI elements and internal state
        this.additionalFieldsContainer.empty();
        this.additionalFields = [];
        
        Object.keys(normalizedData).forEach(key => {
             // Ensure the value is not null or undefined before processing
            if (!mainFormFields.has(key) && normalizedData[key] != null) { 
                const value = normalizedData[key];
                let fieldType: AdditionalField['type'] = 'standard';
                let fieldValue: any = value;
                
                // Determine type for component rendering
                if (typeof value === 'number') {
                    fieldType = 'number';
                } else if (typeof value === 'object' && value['date-parts']) {
                    fieldType = 'date';
                    // Convert CSL date to YYYY-MM-DD for input field, if possible
                    const dp = value['date-parts'][0];
                    if (dp && dp.length > 0) {
                         // Pad month/day with leading zeros if needed
                         const yearStr = dp[0]?.toString() || '';
                         const monthStr = dp[1]?.toString().padStart(2, '0') || '';
                         const dayStr = dp[2]?.toString().padStart(2, '0') || '';
                         // Construct date string based on available parts
                         if (yearStr && monthStr && dayStr) fieldValue = `${yearStr}-${monthStr}-${dayStr}`;
                         else if (yearStr && monthStr) fieldValue = `${yearStr}-${monthStr}`;
                         else if (yearStr) fieldValue = yearStr;
                         else fieldValue = ''; // Fallback if no parts
                    } else {
                        fieldValue = ''; // Fallback if date-parts are empty
                    }
                } else if (Array.isArray(value)) {
                    // Handle arrays - join with comma or just take first? For now, join.
                     fieldValue = value.join(', ');
                } else if (typeof value === 'object') {
                     // Convert simple objects to string (avoid [object Object])
                    try {
                        fieldValue = JSON.stringify(value);
                    } catch (e) {
                        fieldValue = '[Object]'; // Fallback for complex/circular objects
                    }
                }
                // Ensure fieldValue is a string or number for input components
                if (typeof fieldValue !== 'number') {
                     fieldValue = String(fieldValue); 
                }
                
                this.addAdditionalField(fieldType, key, fieldValue);
            }
        });
    }

    /**
     * Get all form values as a Citation object (ready for FileManager)
     */
    private getFormValues(): Citation {
        // Create base citation with core fields
        const citation: Citation = {
            // Required fields
            id: this.idInput.value.trim(),
            type: this.typeDropdown.value as any, // Assume value is a valid CSL type
            title: this.titleInput.value.trim(),
            year: this.yearInput.value.trim(), // Year is required by validation
            // Optional fields from main form
            'title-short': this.titleShortInput.value.trim() || undefined,
            URL: this.urlInput.value.trim() || undefined,
            DOI: this.doiInput.value.trim() || undefined,
            'container-title': this.containerTitleInput.value.trim() || undefined,
            publisher: this.publisherInput.value.trim() || undefined,
            'publisher-place': this.publisherPlaceInput.value.trim() || undefined,
            edition: this.editionInput.value.trim() || undefined,
            volume: this.volumeInput.value.trim() || undefined,
            number: this.numberInput.value.trim() || undefined,
            page: this.pageInput.value.trim() || undefined,
            language: this.languageDropdown.value || undefined,
            abstract: this.abstractInput.value.trim() || undefined,
            month: this.monthDropdown.value !== '0' ? this.monthDropdown.value : undefined,
            day: this.dayInput.value.trim() || undefined,
            // Tags might have been added during populateForm
            tags: this.additionalFields.find(f => f.name === 'tags')?.value || [] 
        };
        
        // Remove tags field from additional fields if it exists, as it's handled separately
         this.additionalFields = this.additionalFields.filter(f => f.name !== 'tags');
        
        return citation;
    }

    /**
     * Validate the form before submission
     */
    private validateForm(citation: Citation): boolean {
        let isValid = true;
        let message = '';

        // Helper to add/remove invalid class
        const validateField = (inputEl: HTMLElement | null, condition: boolean, errorMsg: string) => {
            if (!inputEl) return condition; // Skip if element doesn't exist, assume valid
            if (!condition) {
                isValid = false;
                message = message || errorMsg;
                inputEl.addClass('invalid');
            } else {
                inputEl.removeClass('invalid');
            }
            return condition; // Return condition for chaining checks
        };

        validateField(this.idInput, !!citation.id, 'Citekey is required.');
        validateField(this.titleInput, !!citation.title, 'Title is required.');
        validateField(this.typeDropdown, !!citation.type, 'Type is required.');

        if (validateField(this.yearInput, !!citation.year, 'Year is required.')) {
             validateField(this.yearInput, !isNaN(Number(citation.year)), 'Year must be a number.');
        }

        if (!isValid) {
            new Notice(message);
        }
        return isValid;
    }

    /**
     * Handle form submission: call FileManager to create the note
     */
    private async handleSubmit(citation: Citation): Promise<void> {
        try {
            await this.fileManager.createLiteratureNote(
                citation,
                this.contributors, // Pass current state of contributors
                this.additionalFields, // Pass current state of additional fields
                this.attachmentData.type !== AttachmentType.NONE ? this.attachmentData : null
            );
            this.close(); // Close modal on success
        } catch (error) {
            // Error notice is shown by FileManager
            console.error('Error creating literature note:', error);
            // Re-enable the submit button if it exists
             const submitButton = this.contentEl.querySelector('.create-button') as HTMLButtonElement | null;
             if (submitButton) {
                 submitButton.disabled = false;
                 submitButton.textContent = 'Create Note';
             }
        }
    }

    onClose() {
        const { contentEl } = this;
        // Clean up DOM elements to prevent memory leaks
        contentEl.empty();
    }
}
