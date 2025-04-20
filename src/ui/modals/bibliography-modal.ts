import { App, Modal, Notice, Setting } from 'obsidian';
import { BibliographyPluginSettings } from '../../types/settings';
import { Contributor, AdditionalField, Citation, AttachmentData, AttachmentType } from '../../types/citation';
import { ContributorField } from '../components/contributor-field';
import { AdditionalFieldComponent } from '../components/additional-field';
import { CitoidService } from '../../services/api/citoid';
import { CslMapper } from '../../utils/csl-mapper';
import { CitekeyGenerator } from '../../utils/citekey-generator';
import { FileManager } from '../../services/file-manager';

export class BibliographyModal extends Modal {
    // Services
    private citoidService: CitoidService;
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
        this.citoidService = new CitoidService(settings.citoidApiUrl);
        this.fileManager = new FileManager(app, settings);
        console.log('BibliographyModal initialized');
    }

    onOpen() {
        console.log('BibliographyModal opened');
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
                const citationData = await this.citoidService.fetch(identifier);
                
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
    }

    private createMainForm(contentEl: HTMLElement) {
        // Citekey input (required)
        new Setting(contentEl)
            .setName('Citekey')
            .addText(text => {
                this.idInput = text.inputEl;
                text.setPlaceholder('Enter Citekey').onChange(value => {
                    console.log(`Citekey set to: ${value.trim()}`);
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
                console.log(`Initial type set to: article`);

                dropdown.onChange(value => {
                    console.log(`Type set to: ${value}`);
                });
            });

        // Title input (required)
        new Setting(contentEl)
            .setName('Title')
            .addText(text => {
                this.titleInput = text.inputEl;
                text.setPlaceholder('Enter Title').onChange(value => {
                    console.log(`Title set to: ${value.trim()}`);
                });
            });

        // Title-Short input (optional)
        new Setting(contentEl)
            .setName('Title-Short')
            .addText(text => {
                this.titleShortInput = text.inputEl;
                text.setPlaceholder('Enter Short Title').onChange(value => {
                    console.log(`Title-Short set to: ${value.trim()}`);
                });
            });

        // Page input
        new Setting(contentEl)
            .setName('Page')
            .addText(text => {
                this.pageInput = text.inputEl;
                text.setPlaceholder('Enter Page or Page Range').onChange(value => {
                    console.log(`Page set to: ${value.trim()}`);
                });
            });

        // URL input
        new Setting(contentEl)
            .setName('URL')
            .addText(text => {
                this.urlInput = text.inputEl;
                text.setPlaceholder('Enter URL').onChange(value => {
                    console.log(`URL set to: ${value.trim()}`);
                });
            });

        // Contributors section
        new Setting(contentEl).setName('Contributors');
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

        // Date of Publication inputs
        new Setting(contentEl)
            .setName('Year')
            .addText(text => {
                this.yearInput = text.inputEl;
                text.setPlaceholder('Enter Year').onChange(value => {
                    console.log(`Year set to: ${value.trim()}`);
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
                    console.log(`Month set to: ${value.trim()}`);
                    // If "select option" is chosen, the value needs to be cleared
                    if(value == '0') {
                        console.log(`Month reset`);
                    }
                });
            });

        new Setting(contentEl)
            .setName('Day')
            .addText(text => {
                this.dayInput = text.inputEl;
                text.setPlaceholder('Enter Day (optional)').onChange(value => {
                    console.log(`Day set to: ${value.trim()}`);
                });
            });

        // Container Title input
        new Setting(contentEl)
            .setName('Container Title')
            .addText(text => {
                this.containerTitleInput = text.inputEl;
                text.setPlaceholder('Enter Container Title').onChange(value => {
                    console.log(`Container Title set to: ${value.trim()}`);
                });
            });

        // Publisher input
        new Setting(contentEl)
            .setName('Publisher')
            .addText(text => {
                this.publisherInput = text.inputEl;
                text.setPlaceholder('Enter Publisher').onChange(value => {
                    console.log(`Publisher set to: ${value.trim()}`);
                });
            });

        // Publisher Place input
        new Setting(contentEl)
            .setName('Publisher Place')
            .addText(text => {
                this.publisherPlaceInput = text.inputEl;
                text.setPlaceholder('Enter Publisher Place').onChange(value => {
                    console.log(`Publisher Place set to: ${value.trim()}`);
                });
            });

        // Edition input
        new Setting(contentEl)
            .setName('Edition')
            .addText(text => {
                this.editionInput = text.inputEl;
                text.setPlaceholder('Enter Edition (optional)').onChange(value => {
                    console.log(`Edition set to: ${value.trim()}`);
                });
            });

        // Volume input
        new Setting(contentEl)
            .setName('Volume')
            .addText(text => {
                this.volumeInput = text.inputEl;
                text.setPlaceholder('Enter Volume (optional)').onChange(value => {
                    console.log(`Volume set to: ${value.trim()}`);
                });
            });

        // Number input
        new Setting(contentEl)
            .setName('Number')
            .addText(text => {
                this.numberInput = text.inputEl;
                text.setPlaceholder('Enter Number (optional)').onChange(value => {
                    console.log(`Number set to: ${value.trim()}`);
                });
            });

        // Language input (dropdown for standardization)
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
                    console.log(`Language set to: ${value.trim()}`);
                });
            });

        // DOI input
        new Setting(contentEl)
            .setName('DOI')
            .addText(text => {
                this.doiInput = text.inputEl;
                text.setPlaceholder('Enter DOI').onChange(value => {
                    console.log(`DOI set to: ${value.trim()}`);
                });
            });

        // Abstract input
        new Setting(contentEl)
            .setName('Abstract')
            .addTextArea(text => {
                this.abstractInput = text.inputEl as HTMLTextAreaElement;
                text.setPlaceholder('Enter Abstract').onChange(value => {
                    console.log('Abstract set');
                });
            });

        // Attachment section
        const attachmentSection = new Setting(contentEl)
            .setName('Attachment')
            .setDesc('Choose how to handle the attachment');
            
        // Create import button
        const importButton = new Setting(contentEl)
            .setName('Select File to Import')
            .addButton(button => {
                button.setButtonText('Choose File').onClick(async () => {
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = '.pdf, .epub';
                    fileInput.onchange = () => {
                        if (fileInput.files && fileInput.files.length > 0) {
                            this.attachmentData = {
                                type: AttachmentType.IMPORT,
                                file: fileInput.files[0],
                                filename: fileInput.files[0].name
                            };
                            button.setButtonText(fileInput.files[0].name);
                            console.log(`Attachment selected: ${fileInput.files[0].name}`);
                        }
                    };
                    fileInput.click();
                });
            });
            
        // Create link button
        const linkButton = new Setting(contentEl)
            .setName('Link to Existing File')
            .addButton(button => {
                button.setButtonText('Select File Path').onClick(async () => {
                    // Create a text input for the file path
                    const filePathInput = document.createElement('input');
                    filePathInput.type = 'text';
                    filePathInput.placeholder = 'Enter file path in vault';
                    filePathInput.style.width = '100%';
                    
                    // Create a temporary modal to get the file path
                    const modal = new Modal(this.app);
                    modal.titleEl.textContent = 'Enter Path to File';
                    
                    const form = modal.contentEl.createDiv();
                    form.appendChild(filePathInput);
                    
                    const buttonContainer = modal.contentEl.createDiv();
                    buttonContainer.style.marginTop = '1rem';
                    
                    const submitButton = buttonContainer.createEl('button', {
                        text: 'Link File',
                        cls: 'mod-cta'
                    });
                    submitButton.onclick = () => {
                        const filePath = filePathInput.value.trim();
                        if (filePath) {
                            this.attachmentData = {
                                type: AttachmentType.LINK,
                                path: filePath,
                                filename: filePath.split('/').pop() || filePath
                            };
                            button.setButtonText(filePath.split('/').pop() || filePath);
                            modal.close();
                        }
                    };
                    
                    const cancelButton = buttonContainer.createEl('button', {
                        text: 'Cancel'
                    });
                    cancelButton.onclick = () => {
                        modal.close();
                    };
                    
                    modal.open();
                });
            });
            
        // Initially remove both buttons from DOM
        importButton.settingEl.detach();
        linkButton.settingEl.detach();
        
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
                
                // Clear previous buttons
                importButton.settingEl.detach();
                linkButton.settingEl.detach();
                
                // Add appropriate button based on selection
                if (value === 'import') {
                    attachmentSection.settingEl.insertAdjacentElement('afterend', importButton.settingEl);
                } else if (value === 'link') {
                    attachmentSection.settingEl.insertAdjacentElement('afterend', linkButton.settingEl);
                }
            });
        });

        // Additional CSL fields section
        new Setting(contentEl).setName('Additional Fields');
        this.additionalFieldsContainer = contentEl.createDiv();

        // Button to add additional fields
        const addFieldButton = contentEl.createEl('button', { 
            text: 'Add Field', 
            cls: 'bibliography-add-field-button' 
        });
        addFieldButton.onclick = () => {
            this.addAdditionalField('standard', '', '');
        };

        // Submit button
        const buttonContainer = contentEl.createDiv();
        const submitButton = buttonContainer.createEl('button', { 
            text: 'Create Note', 
            cls: 'create-button' 
        });
        submitButton.onclick = () => {
            // Get the current form values
            const citation: Citation = this.getFormValues();
            
            // Validate required fields before proceeding
            if (!this.validateForm(citation)) {
                return;
            }
            
            console.log('Submit button clicked, all validations passed');
            this.handleSubmit(citation);
        };
    }

    /**
     * Add a contributor field with pre-filled data
     */
    private addContributor(role: string = 'author', given: string = '', family: string = ''): void {
        const contributor: Contributor = { role, given, family };
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
     * Add an additional field
     */
    private addAdditionalField(type: string = 'standard', name: string = '', value: any = ''): void {
        // Ensure type is one of the allowed values
        const validType = ['standard', 'number', 'date'].includes(type.toLowerCase()) ? 
                          type.toLowerCase() : 'standard';
                          
        const field: AdditionalField = { type: validType, name, value };
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
     * Populate form fields from Citoid API data
     */
    private populateFormFromCitoid(citationData: any): void {
        try {
            console.log('Received citation data:', citationData);
            
            // Normalize citation data to CSL format
            const normalizedData = CslMapper.normalizeToCslFormat(citationData);
            console.log('Normalized citation data:', normalizedData);
            
            // Map basic fields
            if (normalizedData.id) {
                this.idInput.value = normalizedData.id;
                this.idInput.dispatchEvent(new Event('input'));
            } else if (normalizedData.key) {
                // Use Zotero key if present
                this.idInput.value = normalizedData.key;
                this.idInput.dispatchEvent(new Event('input'));
            } else if (normalizedData.title) {
                // Generate ID from title if not present
                this.idInput.value = CitekeyGenerator.generate(normalizedData);
                this.idInput.dispatchEvent(new Event('input'));
            }
            
            // Log the citekey being set
            console.log(`Citekey set to: ${this.idInput.value}`);
            
            // Type - handle both CSL 'type' and Zotero 'itemType'
            if (normalizedData.type) {
                // Find best match for the type
                const typeValue = CslMapper.mapCitoidType(normalizedData.type);
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
            
            new Notice('Citation data successfully retrieved and filled');
        } catch (error) {
            console.error('Error populating form from Citoid data:', error);
            new Notice('Error populating form from citation data');
        }
    }

    /**
     * Handle contributors from Citoid data
     */
    private handleContributors(citationData: any): void {
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
                            this.addContributor(role, person[0] || '', person[1] || '');
                            foundContributors = true;
                        } else if (person.length === 1) {
                            this.addContributor(role, '', person[0] || '');
                            foundContributors = true;
                        }
                    }
                    // Handle literal names (institutions)
                    else if (person.literal) {
                        this.addContributor(role, '', person.literal);
                        foundContributors = true;
                    } 
                    // Handle CSL format with family/given
                    else if (person.family) {
                        // Add contributor field
                        this.addContributor(role, person.given || '', person.family);
                        foundContributors = true;
                    }
                    // Try other name formats
                    else if (typeof person === 'object') {
                        // Try other field combinations
                        const lastName = person.lastName || person.family || person.surname || '';
                        const firstName = person.firstName || person.given || person.forename || '';
                        
                        if (lastName || firstName) {
                            this.addContributor(role, firstName, lastName);
                            foundContributors = true;
                        }
                    }
                    // Handle string format (just a name)
                    else if (typeof person === 'string' && person.trim()) {
                        this.addContributor(role, '', person.trim());
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
                    this.addContributor(role, firstName, lastName);
                    foundContributors = true;
                } else if (creator.name) {
                    // Institutional author
                    this.addContributor(role, '', creator.name);
                    foundContributors = true;
                }
            });
        }
        
        // If no contributors were added, add a blank one
        if (!foundContributors) {
            this.addContributor('author', '', '');
        }
    }

    /**
     * Handle additional fields that may be in Citoid data but not in the main form
     */
    private handleAdditionalFields(citationData: any): void {
        // List of fields that are already handled in the main form
        const handledFields = [
            'id', 'type', 'title', 'title-short', 'shortTitle', 'URL', 'DOI', 
            'container-title', 'publisher', 'publisher-place', 'volume', 'issue', 
            'number', 'page', 'language', 'abstract', 'edition', 'issued', 'year',
            'author', 'editor', 'translator', 'container-author'
        ];
        
        // List of source fields that get mapped to CSL fields (should be excluded from additional fields)
        const mappedSourceFields = [
            'itemType', 'journalAbbreviation', 'shortTitle', 'publicationTitle', 
            'bookTitle', 'conferenceName', 'proceedingsTitle', 'encyclopediaTitle', 
            'dictionaryTitle', 'websiteTitle', 'reportNumber', 'billNumber', 
            'seriesNumber', 'patentNumber', 'numPages', 'numberOfVolumes', 
            'isbn', 'issn', 'date', 'accessDate', 'dateDecided', 'dateEnacted', 
            'pages', 'firstPage', 'place', 'archive_location', 'event_place', 
            'publisher_place', 'abstractNote', 'creators'
        ];
        
        // Clear existing additional fields
        this.additionalFieldsContainer.empty();
        this.additionalFields = [];
        
        // Collect additional fields
        Object.keys(citationData).forEach(key => {
            // Skip fields that are handled in the main form or are source fields for CSL mapping
            if ((!handledFields.includes(key) && !mappedSourceFields.includes(key)) && citationData[key]) {
                // Determine field type and format the value
                let fieldType = 'standard';
                let fieldValue = citationData[key];
                
                // Handle different data types
                if (typeof fieldValue === 'number') {
                    fieldType = 'number';
                } else if (fieldValue && typeof fieldValue === 'object' && fieldValue['date-parts']) {
                    fieldType = 'date';
                } else if (Array.isArray(fieldValue) && fieldValue.length > 0) {
                    // For arrays (like ISBN, ISSN), take the first value
                    fieldValue = fieldValue[0];
                }
                
                // Add the field
                this.addAdditionalField(fieldType, key, fieldValue);
                console.log(`Added additional field: ${key} (${fieldType}) = ${JSON.stringify(fieldValue)}`);
            }
        });
    }

    /**
     * Get all form values as a citation object
     */
    private getFormValues(): Citation {
        return {
            id: this.idInput.value.trim(),
            type: this.typeDropdown.value,
            title: this.titleInput.value.trim(),
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
            year: this.yearInput.value.trim(),
            month: this.monthDropdown.value !== '0' ? this.monthDropdown.value : undefined,
            day: this.dayInput.value.trim() || undefined
        };
    }

    /**
     * Validate the form before submission
     */
    private validateForm(citation: Citation): boolean {
        if (!citation.id) {
            new Notice('Citekey is required.');
            return false;
        }
        if (!citation.title) {
            new Notice('Title is required.');
            return false;
        }
        if (!citation.type) {
            new Notice('Type is required.');
            return false;
        }
        if (!citation.year) {
            new Notice('Year is required.');
            return false;
        }
        return true;
    }

    /**
     * Handle form submission
     */
    private async handleSubmit(citation: Citation): Promise<void> {
        console.log('Handling submit');
        try {
            await this.fileManager.createLiteratureNote(
                citation,
                this.contributors,
                this.additionalFields,
                this.attachmentData.type !== AttachmentType.NONE ? this.attachmentData : null
            );
            this.close();
        } catch (error) {
            console.error('Error creating literature note:', error);
            new Notice('Error creating literature note.');
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        console.log('BibliographyModal closed');
    }
}