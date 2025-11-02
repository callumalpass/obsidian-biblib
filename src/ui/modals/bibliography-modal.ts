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
import { 
    ERROR_MESSAGES, 
    SUCCESS_MESSAGES, 
    UI_TEXT,
    NOTICE_DURATION_SHORT 
} from '../../constants';

export class BibliographyModal extends Modal {
    // Services
    private citoidService: CitoidService;
    protected citationService: CitationService;
    private noteCreationService: NoteCreationService;
    
    // Data state
    protected additionalFields: AdditionalField[] = [];
    protected contributors: Contributor[] = [];
    protected relatedNotePaths: string[] = [];
    
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
    
    // Attachment UI elements
    private attachmentTypeSelect: HTMLSelectElement;
    private importSettingEl: HTMLElement;
    private linkSettingEl: HTMLElement;
    private importButtonComponent: ButtonComponent | null = null;
    private linkButtonComponent: ButtonComponent | null = null;
    protected attachmentsDisplayEl: HTMLElement;
    
    // Multiple attachments support
    protected attachmentData: AttachmentData[] = [];
    
    // Storage for user-defined default field inputs
    private defaultFieldInputs: Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = new Map();
    
    // Flag for whether the modal is initialized
    private isInitialized: boolean = false;

    // Track how the modal was opened
    private openedViaCommand: boolean = true;
    
    constructor(
        app: App, 
        protected settings: BibliographyPluginSettings, 
        openedViaCommand: boolean = true
    ) {
        super(app);
        
        // Initialize services
        this.citoidService = new CitoidService();
        
        // Pass the citekey options to ensure generated citekeys respect user settings
        this.citationService = new CitationService(this.settings.citekeyOptions);
        
        
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
     * Get the current attachment data (for duplicate checking)
     */
    public getAttachmentData(): AttachmentData[] {
        return this.attachmentData;
    }
    
    /**
     * Set the attachment data (for use by external callers)
     */
    public setAttachmentData(data: AttachmentData): void {
        // Add the attachment to the list
        this.attachmentData.push(data);
        
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
            
            // Update the attachments display
            this.updateAttachmentsDisplay();
        }
    }
    
    /**
     * Update the display of attachments
     */
    protected updateAttachmentsDisplay(): void {
        if (!this.attachmentsDisplayEl) return;
        
        this.attachmentsDisplayEl.empty(); // Clear previous display
        
        if (this.attachmentData.length === 0) {
            this.attachmentsDisplayEl.setText('No attachments added.');
            return;
        }
        
        const listEl = this.attachmentsDisplayEl.createEl('ul', { cls: 'bibliography-attachments-list' });
        
        this.attachmentData.forEach((attachment, index) => {
            const listItemEl = listEl.createEl('li');
            
            // Determine display name based on attachment type
            let displayName = '';
            if (attachment.type === AttachmentType.IMPORT && attachment.file) {
                displayName = attachment.filename || attachment.file.name;
                listItemEl.createSpan({
                    cls: 'attachment-type-badge import',
                    text: 'IMPORT'
                });
            } else if (attachment.type === AttachmentType.LINK && attachment.path) {
                displayName = attachment.path.split('/').pop() || attachment.path;
                listItemEl.createSpan({
                    cls: 'attachment-type-badge link',
                    text: 'LINK'
                });
            }
            
            // Add file name
            const nameSpan = listItemEl.createSpan({ text: displayName });
            
            // Add remove button
            const removeButton = listItemEl.createEl('button', {
                cls: 'bibliography-remove-attachment-button',
                text: 'Remove'
            });
            removeButton.onclick = () => {
                this.attachmentData.splice(index, 1);
                this.updateAttachmentsDisplay(); // Refresh display
            };
        });
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
        if (this.attachmentData.length > 0 && this.attachmentData[0].type === AttachmentType.IMPORT) {
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
            .setDesc('DOI, ISBN, arXiv ID, URL, PubMed, PMC, Wikidata QIDs');
        
        const citoidIdInput = citoidIdSetting.controlEl.createEl('input', {
            type: 'text',
            placeholder: 'E.g., 10.1038/nrn3241, arXiv:1910.13461'
        });
        
        // Add lookup button
        const lookupButton = new ButtonComponent(citoidIdSetting.controlEl)
            .setButtonText(UI_TEXT.LOOKUP)
            .setCta()
            .onClick(async () => {
                const identifier = citoidIdInput.value.trim();
                if (!identifier) {
                    new Notice('Please enter an identifier to lookup');
                    return;
                }
                
                // Disable button and show loading state
                lookupButton.setDisabled(true);
                lookupButton.setButtonText(UI_TEXT.LOADING);
                
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
                new Notice(ERROR_MESSAGES.EMPTY_BIBTEX);
                return;
            }
            
            new Notice(UI_TEXT.PARSING_BIBTEX);
            bibtexButton.setAttr('disabled', 'true');
            bibtexButton.textContent = UI_TEXT.PARSING;
            
            try {
                const normalizedData = this.citationService.parseBibTeX(bibtexText);
                if (!normalizedData) {
                    new Notice(ERROR_MESSAGES.NO_BIBTEX_DATA);
                    return;
                }
                this.populateFormFromCitoid(normalizedData);
                new Notice(SUCCESS_MESSAGES.BIBTEX_PARSED);
            } catch (error) {
                console.error('Error parsing BibTeX data:', error);
                new Notice(ERROR_MESSAGES.BIBTEX_PARSE_FAILED);
            } finally {
                bibtexButton.removeAttribute('disabled');
                bibtexButton.textContent = UI_TEXT.PARSE_BIBTEX;
            }
        };
    }

    private createAttachmentSection(contentEl: HTMLElement) {
        const attachmentContainer = contentEl.createDiv({ cls: 'attachment-container' });
        
        // Add section heading
        const attachmentHeading = attachmentContainer.createEl('div', { cls: 'setting-item-heading', text: 'Attachments' });
        
        // Create attachment setting
        const attachmentSetting = new Setting(attachmentContainer)
            .setDesc('Add attachments to this citation');
        
        // Create the attachment type dropdown
        const dropdownContainer = attachmentSetting.controlEl.createEl('div');
        const attachmentTypeDropdown = dropdownContainer.createEl('select', { cls: 'dropdown' });
        
        // Store dropdown reference
        this.attachmentTypeSelect = attachmentTypeDropdown;
        
        // Add options
        const importOption = attachmentTypeDropdown.createEl('option', { value: AttachmentType.IMPORT, text: 'Import file' });
        const linkOption = attachmentTypeDropdown.createEl('option', { value: AttachmentType.LINK, text: 'Link to existing file' });
        
        // Add button - add it directly to the setting
        attachmentSetting.addButton(button => {
            button
                .setButtonText('Add attachment')
                .setCta() // Make it a call-to-action button
                .onClick(() => {
                    // Handle adding attachment based on the selected type
                    if (this.attachmentTypeSelect.value === AttachmentType.IMPORT.toString()) {
                        this.addImportAttachment();
                    } else if (this.attachmentTypeSelect.value === AttachmentType.LINK.toString()) {
                        this.addLinkAttachment();
                    }
                });
        });
        
        // Create container for displaying attachments list
        this.attachmentsDisplayEl = attachmentContainer.createDiv({ cls: 'bibliography-attachments-display' });
        this.updateAttachmentsDisplay(); // Initialize display
        
        // Import file input - store references for use with import dialog
        this.importSettingEl = document.createElement('div');
        
        // Link to existing file - store references for use with link dialog
        this.linkSettingEl = document.createElement('div');
    }
    
    /**
     * Handle adding an import attachment
     */
    private addImportAttachment(): void {
        // Create file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '*.*'; // Allow all file types, not just PDF/EPUB
        
        // Handle file selection
        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                
                // Create a new attachment data object
                const newAttachment: AttachmentData = {
                    type: AttachmentType.IMPORT,
                    file: file,
                    filename: file.name
                };
                
                // Add to attachments list
                this.attachmentData.push(newAttachment);
                
                // Update the display
                this.updateAttachmentsDisplay();
            }
        });
        
        // Trigger file dialog
        fileInput.click();
    }
    
    /**
     * Handle adding a link attachment
     */
    private addLinkAttachment(): void {
        // Create a modal to select file from vault
        new FileSuggestModal(this.app, (file) => {
            // Create a new attachment data object
            const newAttachment: AttachmentData = {
                type: AttachmentType.LINK,
                path: file.path
            };
            
            // Add to attachments list
            this.attachmentData.push(newAttachment);
            
            // Update the display
            this.updateAttachmentsDisplay();
        }).open();
    }
    
    // We no longer need the updateAttachmentVisibility method as we've changed the UI approach

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
                dropdown.addOption('article-journal', 'Journal article');
                dropdown.addOption('book', 'Book');
                dropdown.addOption('chapter', 'Book chapter');
                dropdown.addOption('paper-conference', 'Conference paper');
                dropdown.addOption('report', 'Report');
                dropdown.addOption('thesis', 'Thesis');
                dropdown.addOption('webpage', 'Web page');
                
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
            const monthNumber = (index + 1).toString();
            this.monthDropdown.createEl('option', { 
                value: monthNumber, 
                text: monthNumber.padStart(2, '0') // Display "01", "02", etc.
            });
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
                dropdown.addOption('', 'Select language...');
                
                // Add favorite languages from settings
                if (this.settings.favoriteLanguages && this.settings.favoriteLanguages.length > 0) {
                    this.settings.favoriteLanguages.forEach(lang => {
                        if (lang.code && lang.name) {
                            dropdown.addOption(lang.code, lang.name);
                        }
                    });
                    
                    // Add a visual separator (disabled option)
                    const separatorOption = dropdown.selectEl.createEl('option', {
                        text: '──────────────',
                        value: '_separator'
                    });
                    separatorOption.disabled = true;
                }
                
                // Standard language list (excluding any that are already in favorites)
                const standardLanguages = [
                    { code: 'en', name: 'English' },
                    { code: 'fr', name: 'French' },
                    { code: 'de', name: 'German' },
                    { code: 'es', name: 'Spanish' },
                    { code: 'it', name: 'Italian' },
                    { code: 'ja', name: 'Japanese' },
                    { code: 'zh', name: 'Chinese' },
                    { code: 'ru', name: 'Russian' },
                    { code: 'pt', name: 'Portuguese' },
                    { code: 'ar', name: 'Arabic' },
                    { code: 'ko', name: 'Korean' },
                    { code: 'la', name: 'Latin' },
                    { code: 'el', name: 'Greek' },
                    { code: 'other', name: 'Other' }
                ];
                
                // Get favorite language codes for exclusion
                const favoriteCodes = new Set(this.settings.favoriteLanguages?.map(lang => lang.code) || []);
                
                // Add standard languages that aren't in favorites
                standardLanguages.forEach(lang => {
                    if (!favoriteCodes.has(lang.code)) {
                        dropdown.addOption(lang.code, lang.name);
                    }
                });
                
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
        
        // User-defined default fields section
        if (this.settings.defaultModalFields && this.settings.defaultModalFields.length > 0) {
            formContainer.createEl('h4', { text: 'Custom fields' });
            const defaultFieldsContainer = formContainer.createDiv({ cls: 'bibliography-default-fields' });
            this.createDefaultFields(defaultFieldsContainer);
        }
        
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
        formContainer.createEl('h4', { text: 'Related notes' });
        const relatedNotesSetting = new Setting(formContainer)
            .setName('Link related notes')
            .setDesc('Select existing notes in your vault that relate to this entry.');

        // Container to display selected notes
        const relatedNotesDisplayEl = formContainer.createDiv({ cls: 'bibliography-related-notes-display' });
        this.updateRelatedNotesDisplay(relatedNotesDisplayEl); // Set initial state

        // Add button to trigger note selection
        relatedNotesSetting.addButton(button => button
            .setButtonText('Add related note')
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
            text: 'Create note', 
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
            
            // Populate user-defined default fields if they exist in the CSL data
            this.defaultFieldInputs.forEach((inputEl, fieldName) => {
                if (cslData[fieldName] !== undefined && cslData[fieldName] !== null) {
                    const value = cslData[fieldName];
                    
                    if (inputEl instanceof HTMLInputElement && inputEl.type === 'checkbox') {
                        inputEl.checked = !!value;
                    } else if (inputEl instanceof HTMLInputElement && inputEl.type === 'date') {
                        // Handle CSL date format
                        let dateString = '';
                        if (typeof value === 'string') {
                            dateString = value;
                        } else if (value && typeof value === 'object' && 'date-parts' in value && value['date-parts'][0]) {
                            const parts = value['date-parts'][0];
                            if (parts.length >= 3) {
                                dateString = `${parts[0]}-${parts[1].toString().padStart(2, '0')}-${parts[2].toString().padStart(2, '0')}`;
                            } else if (parts.length >= 2) {
                                dateString = `${parts[0]}-${parts[1].toString().padStart(2, '0')}-01`;
                            } else if (parts.length >= 1) {
                                dateString = `${parts[0]}-01-01`;
                            }
                        }
                        inputEl.value = dateString;
                    } else if (inputEl instanceof HTMLSelectElement || inputEl instanceof HTMLTextAreaElement || inputEl instanceof HTMLInputElement) {
                        inputEl.value = value.toString();
                    }
                }
            });
            
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
            
            // Also exclude user-defined default fields
            this.defaultFieldInputs.forEach((_, fieldName) => {
                excludedFields.add(fieldName);
            });
            
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
                    
                    // Create field in UI (this will also add to internal state)
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
        
        // Always add to additionalFields array - we'll filter out empty ones when saving
        this.additionalFields.push(additionalField);
    }

    /**
     * Create user-defined default fields
     */
    private createDefaultFields(container: HTMLElement): void {
        this.settings.defaultModalFields.forEach(fieldConfig => {
            const setting = new Setting(container)
                .setName(fieldConfig.label)
                .setDesc(fieldConfig.description || '');

            let inputEl: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

            switch (fieldConfig.type) {
                case 'text':
                    setting.addText(text => {
                        inputEl = text.inputEl;
                        if (fieldConfig.placeholder) text.setPlaceholder(fieldConfig.placeholder);
                        if (fieldConfig.defaultValue) text.setValue(fieldConfig.defaultValue.toString());
                        return text;
                    });
                    break;

                case 'textarea':
                    setting.addTextArea(textarea => {
                        inputEl = textarea.inputEl;
                        if (fieldConfig.placeholder) textarea.setPlaceholder(fieldConfig.placeholder);
                        if (fieldConfig.defaultValue) textarea.setValue(fieldConfig.defaultValue.toString());
                        textarea.inputEl.rows = 3;
                        return textarea;
                    });
                    break;

                case 'number':
                    setting.addText(text => {
                        inputEl = text.inputEl;
                        text.inputEl.type = 'number';
                        if (fieldConfig.placeholder) text.setPlaceholder(fieldConfig.placeholder);
                        if (fieldConfig.defaultValue) text.setValue(fieldConfig.defaultValue.toString());
                        return text;
                    });
                    break;

                case 'date':
                    setting.addText(text => {
                        inputEl = text.inputEl;
                        text.inputEl.type = 'date';
                        
                        // Handle CSL date format for default value
                        if (fieldConfig.defaultValue) {
                            let dateString = '';
                            const defaultVal = fieldConfig.defaultValue;
                            
                            if (typeof defaultVal === 'string') {
                                dateString = defaultVal;
                            } else if (typeof defaultVal === 'object' && defaultVal && 'date-parts' in defaultVal) {
                                const parts = (defaultVal as any)['date-parts'][0];
                                if (parts && parts.length >= 3) {
                                    dateString = `${parts[0]}-${parts[1].toString().padStart(2, '0')}-${parts[2].toString().padStart(2, '0')}`;
                                } else if (parts && parts.length >= 2) {
                                    dateString = `${parts[0]}-${parts[1].toString().padStart(2, '0')}-01`;
                                } else if (parts && parts.length >= 1) {
                                    dateString = `${parts[0]}-01-01`;
                                }
                            }
                            
                            text.setValue(dateString);
                        }
                        return text;
                    });
                    break;

                case 'toggle':
                    setting.addToggle(toggle => {
                        // For toggle, we'll store the checkbox element
                        inputEl = toggle.toggleEl as any;
                        if (fieldConfig.defaultValue) toggle.setValue(fieldConfig.defaultValue as boolean);
                        return toggle;
                    });
                    break;

                case 'dropdown':
                    setting.addDropdown(dropdown => {
                        inputEl = dropdown.selectEl;
                        if (fieldConfig.options) {
                            fieldConfig.options.forEach(opt => {
                                dropdown.addOption(opt.value, opt.text);
                            });
                        }
                        if (fieldConfig.defaultValue) dropdown.setValue(fieldConfig.defaultValue.toString());
                        return dropdown;
                    });
                    break;
            }

            // Store the input element for later retrieval
            if (inputEl!) {
                this.defaultFieldInputs.set(fieldConfig.name, inputEl);
            }

            // Add required indicator if needed
            if (fieldConfig.required) {
                setting.nameEl.createSpan({ text: ' *', cls: 'required-indicator' });
            }
        });
    }

    /**
     * Get all form values as a Citation object
     */
    protected getFormValues(): Citation {
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
        
        // Add values from user-defined default fields
        this.defaultFieldInputs.forEach((inputEl, fieldName) => {
            let value: any;
            
            if (inputEl instanceof HTMLInputElement && inputEl.type === 'checkbox') {
                value = inputEl.checked;
            } else if (inputEl instanceof HTMLInputElement && inputEl.type === 'date') {
                // Handle date fields with CSL format conversion
                const dateValue = inputEl.value;
                if (dateValue) {
                    const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    if (dateMatch) {
                        value = {
                            'date-parts': [[
                                parseInt(dateMatch[1], 10),
                                parseInt(dateMatch[2], 10),
                                parseInt(dateMatch[3], 10)
                            ]]
                        };
                    } else {
                        // Fallback for invalid dates
                        value = { 'raw': dateValue };
                    }
                }
            } else if (inputEl instanceof HTMLSelectElement || inputEl instanceof HTMLTextAreaElement || inputEl instanceof HTMLInputElement) {
                value = inputEl.value;
            }
            
            // Only add non-empty values (but allow false for checkboxes)
            if (value !== undefined && value !== '' && !(inputEl instanceof HTMLInputElement && inputEl.type === 'checkbox' && value === false)) {
                citation[fieldName] = value;
            }
        });
        
        return citation;
    }

    /**
     * Update the display of related notes
     * @param displayEl The HTML element to update
     */
    protected updateRelatedNotesDisplay(displayEl: HTMLElement): void {
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
        
        // Clean up any empty contributor fields
        const authors = this.contributors.filter(contributor => 
            contributor.role === 'author'
        );
        
        // Clean up any empty author fields (this doesn't affect validation)
        authors.forEach(author => {
            if (author.family === '') author.family = undefined;
            if (author.given === '') author.given = undefined;
            if (author.literal === '') author.literal = undefined;
        });

        if (!isValid) {
            new Notice(message);
        }
        return isValid;
    }

    /**
     * Handle form submission: create the literature note
     */
    protected async handleSubmit(citation: Citation): Promise<void> {
        try {
            // Use the new service layer to create the note
            const result = await this.noteCreationService.createLiteratureNote({
                citation,
                contributors: this.contributors, 
                additionalFields: this.additionalFields, 
                attachmentData: this.attachmentData.length > 0 ? this.attachmentData : null,
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
                submitButton.textContent = 'Create note';
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
        // Allow all file types
        this.files = this.app.vault.getFiles();
        this.onSelect = onSelect;
    }
    
    getItems(): TFile[] {
        return this.files;
    }
    
    getItemText(file: TFile): string {
        // Show extension type more prominently
        return `${file.path} (${file.extension.toUpperCase()})`;
    }
    
    onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(file);
    }
}
