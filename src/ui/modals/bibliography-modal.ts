import { App, Modal, Notice, Setting, ButtonComponent, FuzzySuggestModal, TFile } from 'obsidian';
import { NoteSuggestModal } from './note-suggest-modal';
import { BibliographyPluginSettings } from '../../types/settings';
import { Contributor, AdditionalField, Citation, AttachmentData, AttachmentType } from '../../types/citation';
import { ContributorField } from '../components/contributor-field';
import { AdditionalFieldComponent } from '../components/additional-field';
import { CitoidService } from '../../services/api/citoid';
import { CitationService } from '../../services/citation-service';
import { CitekeyGenerator } from '../../utils/citekey-generator';
import { CSL_TYPES } from '../../utils/csl-variables';
import { 
    NoteCreationService,
    TemplateVariableBuilderService,
    FrontmatterBuilderService, 
    NoteContentBuilderService,
    AttachmentManagerService,
    ReferenceParserService
} from '../../services';

// Keep this import for compatibility until we fully remove it
// import { FileManager } from '../../services/file-manager';

export class BibliographyModal extends Modal {
    // Services
    private citoidService: CitoidService;
    private citationService: CitationService;
    
    // Legacy service - will be replaced
    // private fileManager: FileManager;
    
    // New services
    private noteCreationService: NoteCreationService;
    
    // Data state
    private additionalFields: AdditionalField[] = [];
    private contributors: Contributor[] = [];
    private relatedNotePaths: string[] = [];
    
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
    
    // Flag for whether the modal is initialized
    private isInitialized: boolean = false;

    // Track how the modal was opened
    private openedViaCommand: boolean = true;
    
    constructor(
        app: App, 
        private settings: BibliographyPluginSettings, 
        openedViaCommand: boolean = true
    ) {
        super(app);
        
        // Initialize services
        this.citoidService = new CitoidService();
        
        // Pass the citekey options to ensure generated citekeys respect user settings
        this.citationService = new CitationService(this.settings.citekeyOptions);
        
        // Initialize legacy service (to be removed)
        // this.fileManager = new FileManager(app, settings);
        
        // Set up new service layer
        const templateVariableBuilder = new TemplateVariableBuilderService();
        const frontmatterBuilder = new FrontmatterBuilderService(templateVariableBuilder);
        const noteContentBuilder = new NoteContentBuilderService(frontmatterBuilder, templateVariableBuilder);
        const attachmentManager = new AttachmentManagerService(app, settings);
        const referenceParser = new ReferenceParserService(this.citationService);
        
        // Create the note creation service
        this.noteCreationService = new NoteCreationService(
            app,
            settings,
            referenceParser,
            noteContentBuilder,
            attachmentManager
        );
        
        this.openedViaCommand = openedViaCommand;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('bibliography-modal');

        // Modal title
        contentEl.createEl('h2', { text: 'Enter bibliographic information' });
        
        // Add Citoid lookup fields
        this.createCitoidLookupSection(contentEl);
        
        
        this.createAttachmentSection(contentEl);

        // Add horizontal separator
        contentEl.createEl('hr');

        // Add section title
        contentEl.createEl('h3', { text: 'Entry details' });

        // Create the main form
        this.createMainForm(contentEl);
        
        // Mark as initialized
        this.isInitialized = true;
    }
    
    /**
     * Set the attachment data (for use by external callers)
     */
    public setAttachmentData(data: AttachmentData): void {
        this.attachmentData = data;
        
        // Update the UI to reflect the attachment, if the form is initialized
        if (this.isInitialized) {
            // If this is Zotero data, also collapse the auto-fill section
            if (data.type === AttachmentType.IMPORT) {
                const citoidContainer = this.contentEl.querySelector('.bibliography-citoid-container');
                if (citoidContainer) {
                    citoidContainer.addClass('collapsed');
                    
                    // Add a notice next to the toggle if not already there
                    const toggle = citoidContainer.querySelector('.bibliography-citoid-toggle');
                    if (toggle && !toggle.querySelector('.bibliography-zotero-notice')) {
                        const noticeEl = document.createElement('span');
                        noticeEl.className = 'bibliography-zotero-notice';
                        noticeEl.textContent = 'Zotero data loaded - auto-fill section collapsed';
                        toggle.appendChild(noticeEl);
                    }
                }
            }
            
            // Find the attachment section heading
            const headings = Array.from(this.contentEl.querySelectorAll('.setting-item-heading'));
            const attachmentHeading = headings.find(h => h.textContent?.includes('Attachment'));
            
            if (attachmentHeading) {
                // Find existing indicator and remove it if present
                const existingIndicator = attachmentHeading.querySelector('.zotero-attachment-indicator');
                if (existingIndicator) {
                    existingIndicator.remove();
                }
                
                // Create a visual indicator for Zotero attachment
                const indicatorEl = document.createElement('span');
                indicatorEl.className = 'zotero-attachment-indicator';
                indicatorEl.textContent = 'From Zotero Connector';
                
                // Add tooltip
                indicatorEl.setAttribute('aria-label', 'An attachment has been imported from Zotero Connector');
                
                // Add to heading
                attachmentHeading.appendChild(indicatorEl);
            }
            
            // Find the attachment dropdown element
            const attachmentSetting = this.contentEl.querySelectorAll('.setting').item(
                Array.from(this.contentEl.querySelectorAll('.setting-item-heading'))
                    .findIndex(h => h.textContent?.includes('Attachment')) + 1
            );
            
            const attachmentDropdown = attachmentSetting?.querySelector('select') as HTMLSelectElement;
            if (attachmentDropdown) {
                // Set the dropdown value based on the attachment type
                attachmentDropdown.value = data.type;
                // Dispatch change event to trigger the UI update
                attachmentDropdown.dispatchEvent(new Event('change'));
                
                // If we have file data, update the button text
                if (data.type === AttachmentType.IMPORT && data.file) {
                    const importButton = this.contentEl.querySelector('.setting-visible button') as HTMLButtonElement;
                    if (importButton) {
                        importButton.textContent = data.file.name;
                        
                        // Also add a note about Zotero source
                        const container = importButton.closest('.setting-item-control');
                        if (container) {
                            // Check if there's already a note
                            let noteEl = container.querySelector('.zotero-attachment-note');
                            if (!noteEl) {
                                const noteDiv = document.createElement('div');
                                noteDiv.className = 'zotero-attachment-note';
                                noteDiv.textContent = 'PDF imported from Zotero';
                                container.appendChild(noteDiv);
                            }
                        }
                    }
                } else if (data.type === AttachmentType.LINK && data.path) {
                    const linkButton = this.contentEl.querySelector('.setting-visible button') as HTMLButtonElement;
                    if (linkButton) {
                        // Extract just the filename from the path
                        const fileName = data.path.split('/').pop() || data.path;
                        linkButton.textContent = fileName;
                    }
                }
            }
        }
    }

    private createCitoidLookupSection(contentEl: HTMLElement) {
        const citoidContainer = contentEl.createDiv({ cls: 'bibliography-citoid-container' });
        
        // Create collapsible header
        const toggleHeader = citoidContainer.createDiv({ cls: 'bibliography-citoid-toggle' });
        toggleHeader.createEl('h3', { text: 'Auto-fill' });
        const toggleIcon = toggleHeader.createSpan({ cls: 'bibliography-citoid-toggle-icon', text: '▼' });
        
        // Determine if the section should be collapsed:
        // 1. If we have Zotero attachment data, always collapse and show a notice
        // 2. If opened via command, expand by default
        // 3. Otherwise, collapse by default
        if (this.attachmentData && this.attachmentData.type === AttachmentType.IMPORT) {
            toggleHeader.createSpan({
                cls: 'bibliography-zotero-notice',
                text: 'Zotero data loaded - auto-fill section collapsed'
            });
            citoidContainer.addClass('collapsed');
        } else if (!this.openedViaCommand) {
            // Collapse by default if not opened via command
            citoidContainer.addClass('collapsed');
        }
        
        // Toggle collapse on click
        toggleHeader.addEventListener('click', () => {
            citoidContainer.toggleClass('collapsed', !citoidContainer.hasClass('collapsed'));
            toggleIcon.textContent = citoidContainer.hasClass('collapsed') ? '▶' : '▼';
        });
        
        // Content container
        const citoidContent = citoidContainer.createDiv({ cls: 'bibliography-citoid-content' });
        
        // Create identifier field
        const citoidIdSetting = new Setting(citoidContent)
            .setName('Auto-lookup by identifier')
            .setDesc('DOI, ISBN, arXiv ID, URL');
        
        const citoidIdInput = citoidIdSetting.controlEl.createEl('input', {
            type: 'text',
            placeholder: 'E.g., 10.1038/nrn3241, arXiv:1910.13461'
        });
        
        // Add lookup button
        const lookupButton = new ButtonComponent(citoidIdSetting.controlEl)
            .setButtonText('Lookup')
            .setCta()
            .onClick(async () => {
                const identifier = citoidIdInput.value.trim();
                if (!identifier) {
                    new Notice('Please enter an identifier to lookup');
                    return;
                }
                
                // Disable button and show loading state
                lookupButton.setDisabled(true);
                lookupButton.setButtonText('Fetching...');
                
                try {
                    // Call Citoid service to get BibTeX
                    const cslData = await this.citationService.fetchNormalized(identifier);
                    
                    if (cslData) {
                        this.populateFormFromCitoid(cslData);
                        new Notice('Citation data loaded successfully');
                    } else {
                        new Notice('No citation data found for this identifier');
                    }
                } catch (error) {
                    console.error('Error fetching citation data:', error);
                    new Notice(`Error fetching citation data: ${error instanceof Error ? error.message : String(error)}`);
                } finally {
                    // Reset button state
                    lookupButton.setDisabled(false);
                    lookupButton.setButtonText('Lookup');
                }
            });
            
        // Add BibTeX paste section
        citoidContent.createEl('h3', { text: 'Auto-fill from BibTeX' });
        const bibtexContainer = citoidContent.createDiv({ cls: 'bibliography-bibtex-container' });
        
        const bibtexInput = bibtexContainer.createEl('textarea', {
            placeholder: 'Paste BibTeX entry here...',
            cls: 'bibliography-bibtex-input'
        });
        
        const bibtexButton = bibtexContainer.createEl('button', {
            text: 'Parse BibTeX',
            cls: 'bibliography-bibtex-button'
        });
        
        bibtexButton.onclick = () => {
            const bibtexText = bibtexInput.value.trim();
            if (!bibtexText) {
                new Notice('Please paste a BibTeX entry');
                return;
            }
            
            new Notice('Parsing BibTeX data...');
            bibtexButton.setAttr('disabled', 'true');
            bibtexButton.textContent = 'Parsing...';
            
            try {
                const normalizedData = this.citationService.parseBibTeX(bibtexText);
                if (!normalizedData) {
                    new Notice('No valid citation data found in the BibTeX entry');
                    return;
                }
                this.populateFormFromCitoid(normalizedData);
                new Notice('BibTeX data successfully parsed and filled');
            } catch (error) {
                console.error('Error parsing BibTeX data:', error);
                new Notice('Error parsing BibTeX data. Please check the format and try again.');
            } finally {
                bibtexButton.removeAttribute('disabled');
                bibtexButton.textContent = 'Parse BibTeX';
            }
        };
    }

    private createAttachmentSection(contentEl: HTMLElement) {
        const attachmentContainer = contentEl.createDiv({ cls: 'attachment-container' });
        
        // Add section heading
        const attachmentHeading = attachmentContainer.createEl('div', { cls: 'setting-item-heading', text: 'Attachment' });
        
        // Create attachment setting
        const attachmentSetting = new Setting(attachmentContainer)
            .setDesc('Import or link to a PDF/EPUB attachment');
        
        // Create the attachment type dropdown
        const dropdownContainer = attachmentSetting.controlEl.createEl('div');
        const attachmentTypeDropdown = dropdownContainer.createEl('select', { cls: 'dropdown' });
        
        // Add options
        const noneOption = attachmentTypeDropdown.createEl('option', { value: AttachmentType.NONE, text: 'None' });
        const importOption = attachmentTypeDropdown.createEl('option', { value: AttachmentType.IMPORT, text: 'Import file' });
        const linkOption = attachmentTypeDropdown.createEl('option', { value: AttachmentType.LINK, text: 'Link to existing file' });
        
        // Import file input
        const importContainer = attachmentContainer.createDiv({ cls: 'setting hidden' });
        
        new Setting(importContainer)
            .setDesc('Select a PDF or EPUB file to import')
            .addButton(button => {
                button
                    .setButtonText('Choose file')
                    .onClick(() => {
                        // Create file input element
                        const fileInput = document.createElement('input');
                        fileInput.type = 'file';
                        fileInput.accept = '.pdf,.epub';
                        
                        // Handle file selection
                        fileInput.addEventListener('change', () => {
                            if (fileInput.files && fileInput.files.length > 0) {
                                const file = fileInput.files[0];
                                
                                // Update button text
                                button.setButtonText(file.name);
                                
                                // Store file data for later use
                                this.attachmentData = {
                                    type: AttachmentType.IMPORT,
                                    file: file,
                                    filename: file.name
                                };
                            }
                        });
                        
                        // Trigger file dialog
                        fileInput.click();
                    });
            });
        
        // Link to existing file
        const linkContainer = attachmentContainer.createDiv({ cls: 'setting hidden' });
        
        new Setting(linkContainer)
            .setDesc('Select an existing file in your vault')
            .addButton(button => {
                button
                    .setButtonText('Choose file')
                    .onClick(() => {
                        // Create a modal to select file from vault
                        new FileSuggestModal(this.app, (file) => {
                            // Update button text
                            button.setButtonText(file.name);
                            
                            // Store file data for later use
                            this.attachmentData = {
                                type: AttachmentType.LINK,
                                path: file.path
                            };
                        }).open();
                    });
            });
        
        // Add event listener to show/hide appropriate containers based on selection
        attachmentTypeDropdown.addEventListener('change', () => {
            const selectedValue = attachmentTypeDropdown.value as AttachmentType;
            
            // Hide all containers first
            importContainer.removeClass('visible');
            importContainer.addClass('hidden');
            linkContainer.removeClass('visible');
            linkContainer.addClass('hidden');
            
            // Show selected container
            if (selectedValue === AttachmentType.IMPORT) {
                importContainer.removeClass('hidden');
                importContainer.addClass('visible');
                this.attachmentData.type = AttachmentType.IMPORT;
            } else if (selectedValue === AttachmentType.LINK) {
                linkContainer.removeClass('hidden');
                linkContainer.addClass('visible');
                this.attachmentData.type = AttachmentType.LINK;
            } else {
                // None selected
                this.attachmentData = { type: AttachmentType.NONE };
            }
        });
    }

    private createMainForm(contentEl: HTMLElement) {
        const formContainer = contentEl.createDiv({ cls: 'bibliography-form' });
        
        // Contributors section
        formContainer.createEl('h4', { text: 'Contributors' });
        
        // Container for contributor fields
        this.contributorsListContainer = formContainer.createDiv({ cls: 'bibliography-contributors' });
        
        // Add initial contributor field (typically an author)
        this.addContributorField('author');
        
        // Add button to add more contributors
        const addContributorButton = new ButtonComponent(formContainer)
            .setButtonText('Add contributor')
            .onClick(() => this.addContributorField('author'));

		// --- ADDED: Horizontal Rule ---
        formContainer.createEl('hr');

        // Create core fields section
        const coreFieldsContainer = formContainer.createDiv({ cls: 'bibliography-form-core' });
        
        
        // Type field (CSL type)
        new Setting(coreFieldsContainer)
            .setName('Type')
            .setDesc('Type of reference')
            .addDropdown(dropdown => {
                // Add common types first
                dropdown.addOption('article-journal', 'Journal Article');
                dropdown.addOption('book', 'Book');
                dropdown.addOption('chapter', 'Book Chapter');
                dropdown.addOption('paper-conference', 'Conference Paper');
                dropdown.addOption('report', 'Report');
                dropdown.addOption('thesis', 'Thesis');
                dropdown.addOption('webpage', 'Web Page');
                
                // Add divider
                dropdown.addOption('divider1', '------------------');
                
                // Add all other CSL types alphabetically
                const cslTypes = [...CSL_TYPES].filter(type => 
                    !['article-journal', 'book', 'chapter', 'paper-conference', 'report', 'thesis', 'webpage'].includes(type)
                ).sort();
                
                cslTypes.forEach(type => {
                    // Format the type label for display (capitalize, replace hyphens with spaces)
                    const labelText = type
                        .split('-')
                        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    
                    dropdown.addOption(type, labelText);
                });
                
                // Set article-journal as default
                dropdown.setValue('article-journal');
                
                this.typeDropdown = dropdown.selectEl;
                
                // Remove divider items if they ever get selected
                dropdown.onChange(value => {
                    if (value.startsWith('divider')) {
                        dropdown.setValue('article-journal');
                    }
                });
                
                return dropdown;
            });
        
        // Title field
        new Setting(coreFieldsContainer)
            .setName('Title')
            .setDesc('Title of the work')
            .addText(text => {
                this.titleInput = text.inputEl;
                text.inputEl.addClass('bibliography-input-full');
                return text;
            });
        
        // Short title field
        new Setting(coreFieldsContainer)
            .setName('Short title')
            .setDesc('Abbreviated title (optional)')
            .addText(text => {
                this.titleShortInput = text.inputEl;
                return text;
            });
        
        // Page field
        new Setting(coreFieldsContainer)
            .setName('Pages')
            .setDesc('Page range (e.g., 123-145)')
            .addText(text => {
                this.pageInput = text.inputEl;
                return text;
            });
        
        // URL field
        new Setting(coreFieldsContainer)
            .setName('URL')
            .setDesc('Web address')
            .addText(text => {
                this.urlInput = text.inputEl;
                text.inputEl.type = 'url';
                return text;
            });
        
        // Container title field (journal, book, etc.)
        new Setting(coreFieldsContainer)
            .setName('Container title')
            .setDesc('Journal, book, or website name')
            .addText(text => {
                this.containerTitleInput = text.inputEl;
                text.inputEl.addClass('bibliography-input-full');
                return text;
            });
        
        // Create a simple grid for date inputs
        const dateContainer = coreFieldsContainer.createDiv({ cls: 'bibliography-date-container' });
        
        // Year field
        const yearSetting = new Setting(dateContainer)
            .setName('Year')
            .setDesc('Publication year');
        
        this.yearInput = yearSetting.controlEl.createEl('input', { type: 'number' });
        this.yearInput.placeholder = 'YYYY';
        
        // Month field
        const monthSetting = new Setting(dateContainer)
            .setName('Month')
            .setDesc('Publication month');
        
        this.monthDropdown = monthSetting.controlEl.createEl('select');
        // Add month options
        this.monthDropdown.createEl('option', { value: '', text: '' });
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
        
        months.forEach((month, index) => {
            this.monthDropdown.createEl('option', { value: (index + 1).toString(), text: month });
        });
        
        // Day field
        const daySetting = new Setting(dateContainer)
            .setName('Day')
            .setDesc('Publication day');
        
        this.dayInput = daySetting.controlEl.createEl('input', { type: 'number' });
        this.dayInput.placeholder = 'DD';
        this.dayInput.min = '1';
        this.dayInput.max = '31';
        
        // Publisher field
        new Setting(coreFieldsContainer)
            .setName('Publisher')
            .setDesc('Name of publisher')
            .addText(text => {
                this.publisherInput = text.inputEl;
                return text;
            });
        
        // Publisher place field
        new Setting(coreFieldsContainer)
            .setName('Publisher place')
            .setDesc('Location of publisher')
            .addText(text => {
                this.publisherPlaceInput = text.inputEl;
                return text;
            });
        
        // Edition field
        new Setting(coreFieldsContainer)
            .setName('Edition')
            .setDesc('Edition number or description')
            .addText(text => {
                this.editionInput = text.inputEl;
                return text;
            });
        
        // Volume field
        new Setting(coreFieldsContainer)
            .setName('Volume')
            .setDesc('Volume number')
            .addText(text => {
                this.volumeInput = text.inputEl;
                return text;
            });
        
        // Number/Issue field
        new Setting(coreFieldsContainer)
            .setName('Number/Issue')
            .setDesc('Issue or number identifier')
            .addText(text => {
                this.numberInput = text.inputEl;
                return text;
            });
        
        // Language field
        new Setting(coreFieldsContainer)
            .setName('Language')
            .setDesc('Primary language of the work')
            .addDropdown(dropdown => {
                dropdown.addOption('', 'Select language');
                dropdown.addOption('en', 'English');
                dropdown.addOption('fr', 'French');
                dropdown.addOption('de', 'German');
                dropdown.addOption('es', 'Spanish');
                dropdown.addOption('it', 'Italian');
                dropdown.addOption('ja', 'Japanese');
                dropdown.addOption('zh', 'Chinese');
                dropdown.addOption('ru', 'Russian');
                dropdown.addOption('pt', 'Portuguese');
                dropdown.addOption('ar', 'Arabic');
                dropdown.addOption('ko', 'Korean');
                dropdown.addOption('la', 'Latin');
                dropdown.addOption('el', 'Greek');
                dropdown.addOption('other', 'Other');
                
                this.languageDropdown = dropdown.selectEl;
                return dropdown;
            });
        
        // DOI field
        new Setting(coreFieldsContainer)
            .setName('DOI')
            .setDesc('Digital Object Identifier')
            .addText(text => {
                this.doiInput = text.inputEl;
                return text;
            });
        
        // Abstract field
        new Setting(coreFieldsContainer)
            .setName('Abstract')
            .setDesc('Summary of the work')
            .addTextArea(textarea => {
                this.abstractInput = textarea.inputEl;
                textarea.inputEl.rows = 4;
                textarea.inputEl.addClass('bibliography-input-full');
                return textarea;
            });
        
        
        // Additional fields section
        formContainer.createEl('h4', { text: 'Additional fields' });
        
        // Container for additional fields
        this.additionalFieldsContainer = formContainer.createDiv({ cls: 'bibliography-additional-fields' });
        
        // Add button to add more fields
        const addFieldButton = new ButtonComponent(formContainer)
            .setButtonText('Add field')
            .onClick(() => this.addAdditionalField('', '', 'standard'));
            
		// --- ADDED: Horizontal Rule ---
        formContainer.createEl('hr');

        // --- Related Notes Section ---
        formContainer.createEl('h4', { text: 'Related Notes' });
        const relatedNotesSetting = new Setting(formContainer)
            .setName('Link related notes')
            .setDesc('Select existing notes in your vault that relate to this entry.');

        // Container to display selected notes
        const relatedNotesDisplayEl = formContainer.createDiv({ cls: 'bibliography-related-notes-display' });
        this.updateRelatedNotesDisplay(relatedNotesDisplayEl); // Set initial state

        // Add button to trigger note selection
        relatedNotesSetting.addButton(button => button
            .setButtonText('Add Related Note')
            .onClick(() => {
                // Open the Note Suggest Modal
                new NoteSuggestModal(this.app, (selectedFile) => {
                    if (selectedFile && !this.relatedNotePaths.includes(selectedFile.path)) {
                        this.relatedNotePaths.push(selectedFile.path);
                        this.updateRelatedNotesDisplay(relatedNotesDisplayEl); // Update UI
                    } else if (selectedFile) {
                        new Notice(`Note "${selectedFile.basename}" is already selected.`);
                    }
                }).open();
            }));

		// --- ADDED: Horizontal Rule ---
        formContainer.createEl('hr');

        formContainer.createEl('h4', { text: 'Identifier' });
		new Setting(formContainer) // <-- Appended to formContainer now
            .setName('Citekey')
            .setDesc('Unique citation key used as filename')
            .addText(text => {
                this.idInput = text.inputEl;
                text.setPlaceholder('Autogenerated from author and year');

                // Add regenerate button - with null check to satisfy TS
                const parentElement = text.inputEl.parentElement;
                if (!parentElement) return text;

                const regenerateButton = new ButtonComponent(parentElement)
                    .setIcon('reset')
                    .setTooltip('Regenerate citekey')
                    .onClick(() => {
                        // Get current form data for citekey generation
                        const formData = this.getFormValues();

                        // Only attempt to generate if we have required fields
                        if (formData.title || (formData.author && formData.author.length > 0)) {
                            // Generate citekey using current form data
                            const citekey = CitekeyGenerator.generate(formData, this.settings.citekeyOptions);
                            // Update ID field
                            this.idInput.value = citekey;
                        } else {
                            new Notice('Add author and title first to generate citekey');
                        }
                    });

                return text;
            });
        
        // Create final buttons (Cancel and Create Note)
        const finalButtonContainer = formContainer.createDiv({ cls: 'bibliography-form-buttons' });
        
        // Cancel button
        const cancelButton = finalButtonContainer.createEl('button', { 
            text: 'Cancel',
            cls: 'bibliography-cancel-button'
        });
        cancelButton.onclick = () => this.close();
        
        // Submit button
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
        };
    }

    /**
     * Populate form fields from CSL data (e.g., from Citoid or Zotero)
     */
    public populateFormFromCitoid(cslData: any): void {
        // Only proceed if we have form elements initialized
        if (!this.isInitialized) {
            console.warn('Cannot populate form before it is initialized');
            return;
        }
        
        try {
            // ID field - use cslData.id but allow changing
            if (cslData.id) {
                this.idInput.value = cslData.id;
            }
            
            // Auto-generate ID if not present but we have author and year
            if (!cslData.id && (cslData.author || cslData.issued)) {
                const citekey = CitekeyGenerator.generate(cslData, this.settings.citekeyOptions);
                this.idInput.value = citekey;
            }
            
            // Type dropdown - find closest match to CSL type
            if (cslData.type) {
                // Set dropdown value if the type exists in options
                const typeOption = this.typeDropdown.querySelector(`option[value="${cslData.type}"]`);
                if (typeOption) {
                    this.typeDropdown.value = cslData.type;
                } else {
                    // Default to article-journal if type not found
                    this.typeDropdown.value = 'article-journal';
                    console.warn(`CSL type "${cslData.type}" not found in dropdown options`);
                }
            }
            
            // Basic text fields - simple mapping
            this.titleInput.value = cslData.title || '';
            this.titleShortInput.value = cslData['title-short'] || cslData.shortTitle || '';
            this.pageInput.value = cslData.page || '';
            this.urlInput.value = cslData.URL || '';
            this.containerTitleInput.value = cslData['container-title'] || cslData.journal || '';
            this.publisherInput.value = cslData.publisher || '';
            this.publisherPlaceInput.value = cslData['publisher-place'] || '';
            this.volumeInput.value = cslData.volume || '';
            this.numberInput.value = cslData.number || cslData.issue || '';
            this.doiInput.value = cslData.DOI || '';
            this.abstractInput.value = cslData.abstract || '';
            this.editionInput.value = cslData.edition || '';
            
            // Date fields - try issued date or individual field values
            if (cslData.issued && cslData.issued['date-parts'] && 
                cslData.issued['date-parts'][0] && cslData.issued['date-parts'][0].length > 0) {
                
                const dateParts = cslData.issued['date-parts'][0];
                this.yearInput.value = dateParts[0] || '';
                
                if (dateParts.length > 1) {
                    this.monthDropdown.value = dateParts[1].toString();
                }
                
                if (dateParts.length > 2) {
                    this.dayInput.value = dateParts[2].toString();
                }
            } else {
                // Try individual fields if issued.date-parts not available
                this.yearInput.value = cslData.year || '';
                if (cslData.month) {
                    this.monthDropdown.value = cslData.month.toString();
                }
                if (cslData.day) {
                    this.dayInput.value = cslData.day.toString();
                }
            }
            
            // Language dropdown
            if (cslData.language) {
                // Try to match language code or set to "other"
                const langOption = this.languageDropdown.querySelector(`option[value="${cslData.language}"]`);
                if (langOption) {
                    this.languageDropdown.value = cslData.language;
                } else {
                    this.languageDropdown.value = 'other';
                }
            }
            
            // Clear existing contributors
            this.contributors = [];
            this.contributorsListContainer.empty();
            
            // Process contributors - handle different formats
            const contributorTypes = ['author', 'editor', 'translator', 'contributor'];
            
            let hasContributors = false;
            contributorTypes.forEach(role => {
                if (cslData[role] && Array.isArray(cslData[role])) {
                    hasContributors = true;
                    cslData[role].forEach((person: any) => {
                        // Add to internal state
                        // this.contributors.push({
                        //     role: role,
                        //     family: person.family || '',
                        //     given: person.given || '',
                        //     literal: person.literal || ''
                        // });
                        
                        // Create field in UI
                        this.addContributorField(role, person.family, person.given, person.literal);
                    });
                }
            });
            
            // Add a default empty author field if no contributors found
            if (!hasContributors) {
                this.addContributorField('author');
            }
            
            // Clear existing additional fields
            this.additionalFields = [];
            this.additionalFieldsContainer.empty();
            
            // Add any non-standard fields as additional fields
            // Exclude common fields that are already in the form
            const excludedFields = new Set([
                'id', 'type', 'title', 'title-short', 'page', 'URL', 'container-title',
                'publisher', 'publisher-place', 'volume', 'number', 'issue', 'DOI',
                'abstract', 'issued', 'year', 'month', 'day', 'language', 'edition',
                'author', 'editor', 'translator', 'contributor', 'shortTitle', 'journal',
                // Skip citation.js internal fields
                '_graph', '_item', '_attachment', 
                // Skip non-CSL fields that shouldn't be in frontmatter
                'annote', 'file', 'attachment'
            ]);
            
            // Add remaining fields as additional fields
            let hasAdditionalFields = false;
            
            for (const [key, value] of Object.entries(cslData)) {
                if (!excludedFields.has(key) && value !== undefined && value !== null) {
                    hasAdditionalFields = true;
                    
                    // Determine field type
                    let fieldType = 'standard';
                    if (typeof value === 'number') {
                        fieldType = 'number';
                    } else if (typeof value === 'object' && value !== null && 'date-parts' in value) {
                        fieldType = 'date';
                    }
                    
                    // Add to internal state
                    this.additionalFields.push({
                        name: key,
                        value: value,
                        type: fieldType
                    });
                    
                    // Create field in UI
                    this.addAdditionalField(key, value, fieldType);
                }
            }
            
        } catch (error) {
            console.error('Error populating form from CSL data:', error);
            new Notice('Error populating form. Some fields may be incomplete.');
        }
    }

    /**
     * Add a contributor field to the form
     */
    private addContributorField(
        role: string = 'author', 
        family: string = '', 
        given: string = '',
        literal: string = ''
    ): void {
        // Make sure the contributors container has the right class
        this.contributorsListContainer.addClass('bibliography-contributors');
        
        // Create contributor object
        const contributor: Contributor = {
            role,
            family,
            given,
            literal
        };
        
        // Always add to contributors array, even if empty
        // This ensures the contributor exists in the array as soon as the field is created
        this.contributors.push(contributor);
        
        // Create and append the component
        const component = new ContributorField(
            this.contributorsListContainer,
            contributor,
            (contributor) => {
                // Remove from contributors array
                const index = this.contributors.findIndex(c => 
                    c.role === contributor.role &&
                    c.family === contributor.family &&
                    c.given === contributor.given &&
                    c.literal === contributor.literal
                );
                
                if (index !== -1) {
                    this.contributors.splice(index, 1);
                }
            }
        );
    }

    /**
     * Add an additional field to the form
     */
    private addAdditionalField(name: string = '', value: any = '', type: string = 'standard'): void {
        // Make sure the container has the right class
        this.additionalFieldsContainer.addClass('bibliography-additional-fields');
        // Create field object
        const additionalField: AdditionalField = {
            name,
            value,
            type
        };
        
        // Create and append the component
        const component = new AdditionalFieldComponent(
            this.additionalFieldsContainer,
            additionalField,
            (field) => {
                // Remove from additionalFields array
                const index = this.additionalFields.findIndex(f => 
                    f.name === field.name &&
                    f.value === field.value &&
                    f.type === field.type
                );
                
                if (index !== -1) {
                    this.additionalFields.splice(index, 1);
                }
            }
        );
        
        // Add to additionalFields array if name provided
        if (name) {
            this.additionalFields.push(additionalField);
        }
    }

    /**
     * Get all form values as a Citation object
     */
    private getFormValues(): Citation {
        // Build citation object from form fields
        const citation: Citation = {
            id: this.idInput.value || CitekeyGenerator.generate({ 
                title: this.titleInput.value,
                author: this.contributors.filter(c => c.role === 'author')
            }, this.settings.citekeyOptions),
            type: this.typeDropdown.value as (typeof CSL_TYPES)[number],
            title: this.titleInput.value,
            'title-short': this.titleShortInput.value || undefined,
            page: this.pageInput.value || undefined,
            URL: this.urlInput.value || undefined,
            'container-title': this.containerTitleInput.value || undefined,
            publisher: this.publisherInput.value || undefined,
            'publisher-place': this.publisherPlaceInput.value || undefined,
            edition: this.editionInput.value || undefined,
            volume: this.volumeInput.value || undefined,
            number: this.numberInput.value || undefined,
            language: this.languageDropdown.value || undefined,
            DOI: this.doiInput.value || undefined,
            abstract: this.abstractInput.value || undefined
        };

		// Add author data specifically for citekey generation purposes
		citation.author = this.contributors
			.filter(c => c.role === 'author' && (c.family || c.given || c.literal)) // Get authors with some name info
			.map(c => {
				const authorData: { family?: string; given?: string; literal?: string } = {};
				if (c.family) authorData.family = c.family;
				if (c.given) authorData.given = c.given;
				// Include literal only if family/given are missing, typically for institutions
				if (c.literal && !c.family && !c.given) authorData.literal = c.literal;
				return authorData;
			})
			.filter(a => a.family || a.given || a.literal); // Ensure we don't have empty objects
        
        // Handle date fields
        const year = this.yearInput.value.trim();
        const month = this.monthDropdown.value.trim();
        const day = this.dayInput.value.trim();
        
        if (year) {
            citation.year = year;
            if (month) {
                citation.month = month;
                if (day) {
                    citation.day = day;
                }
            }
            
            // Build CSL issued field
            citation.issued = {
                'date-parts': [[
                    year ? Number(year) : undefined,
                    month ? Number(month) : undefined,
                    day ? Number(day) : undefined
                ].filter(v => v !== undefined) as number[]]
            };
        }
        
        return citation;
    }

    /**
     * Update the display of related notes
     * @param displayEl The HTML element to update
     */
    private updateRelatedNotesDisplay(displayEl: HTMLElement): void {
        displayEl.empty(); // Clear previous display

        if (this.relatedNotePaths.length === 0) {
            displayEl.setText('No notes selected.');
            return;
        }

        const listEl = displayEl.createEl('ul', { cls: 'bibliography-related-notes-list' });

        this.relatedNotePaths.forEach(notePath => {
            const listItemEl = listEl.createEl('li');
            // Display basename for better readability
            const basename = notePath.substring(notePath.lastIndexOf('/') + 1);
            listItemEl.createSpan({ text: basename }); // Display note name/path

            // Add remove button
            const removeButton = listItemEl.createEl('button', {
                cls: 'bibliography-remove-related-note-button',
                text: 'Remove'
            });
            removeButton.onclick = () => {
                this.relatedNotePaths = this.relatedNotePaths.filter(p => p !== notePath);
                this.updateRelatedNotesDisplay(displayEl); // Refresh the display
            };
        });
    }
    
    private validateForm(citation: Citation): boolean {
        let isValid = true;
        let message = 'Please complete all required fields:';
        
        // Check required fields
        if (!citation.title) {
            isValid = false;
            message += '\n- Title is required';
        }
        
        if (!citation.type) {
            isValid = false;
            message += '\n- Type is required';
        }
        
        // ID will be auto-generated if empty
        
        // Check for at least one author with content
        const authors = this.contributors.filter(contributor => 
            contributor.role === 'author'
        );
        
        // First check if we have any author contributors at all
        if (authors.length === 0) {
            isValid = false;
            message += '\n- At least one contributor with role "author" is required';
        } else {
            // Then check if any of them have content
            const hasAuthorWithContent = authors.some(author => 
                (author.family && author.family.trim() !== '') || 
                (author.given && author.given.trim() !== '') || 
                (author.literal && author.literal.trim() !== '')
            );
            
            if (!hasAuthorWithContent) {
                isValid = false;
                message += '\n- At least one author must have a name (family or given)';
                
                // Force refresh contributor fields
                authors.forEach(author => {
                    if (author.family === '') author.family = undefined;
                    if (author.given === '') author.given = undefined;
                    if (author.literal === '') author.literal = undefined;
                });
            }
        }

        if (!isValid) {
            new Notice(message);
        }
        return isValid;
    }

    /**
     * Handle form submission: create the literature note
     */
    private async handleSubmit(citation: Citation): Promise<void> {
        try {
            // Use the new service layer to create the note
            const result = await this.noteCreationService.createLiteratureNote({
                citation,
                contributors: this.contributors, 
                additionalFields: this.additionalFields, 
                attachmentData: this.attachmentData.type !== AttachmentType.NONE ? this.attachmentData : null,
                relatedNotePaths: this.relatedNotePaths.length > 0 ? this.relatedNotePaths : undefined
            });
            
            if (result.success) {
                this.close(); // Close modal on success
            } else {
                throw result.error || new Error('Unknown error creating note');
            }
        } catch (error) {
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
        contentEl.empty();
    }
}

/**
 * Modal for selecting a file from the vault
 */
class FileSuggestModal extends FuzzySuggestModal<TFile> {
    private files: TFile[];
    private onSelect: (file: TFile) => void;
    
    constructor(app: App, onSelect: (file: TFile) => void) {
        super(app);
        this.files = this.app.vault.getFiles().filter(file => 
            file.extension === 'pdf' || file.extension === 'epub');
        this.onSelect = onSelect;
    }
    
    getItems(): TFile[] {
        return this.files;
    }
    
    getItemText(file: TFile): string {
        return file.path;
    }
    
    onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(file);
    }
}
