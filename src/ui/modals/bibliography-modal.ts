import { App, Modal, Notice, Setting, ButtonComponent } from 'obsidian';
import { NoteSuggestModal } from './note-suggest-modal';
import { FileSuggestModal } from '../components/file-suggest-modal';
import { BibliographyPluginSettings } from '../../types/settings';
import { Contributor, AdditionalField, Citation, AttachmentData, AttachmentType } from '../../types/citation';
import { ContributorField } from '../components/contributor-field';
import { AdditionalFieldComponent } from '../components/additional-field';
import { CitoidService } from '../../services/api/citoid';
import { CitationService } from '../../services/citation-service';
import { CitekeyGenerator } from '../../utils/citekey-generator';
import { CSL_TYPES } from '../../utils/csl-variables';
import { NoteCreationService } from '../../services';
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
    private dateInput: HTMLInputElement;
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
        citoidService: CitoidService,
        citationService: CitationService,
        noteCreationService: NoteCreationService,
        openedViaCommand: boolean = true
    ) {
        super(app);

        // Store injected services
        this.citoidService = citoidService;
        this.citationService = citationService;
        this.noteCreationService = noteCreationService;

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
        this.attachmentsDisplayEl.empty();

        if (this.attachmentData.length === 0) {
            this.attachmentsDisplayEl.createSpan({ text: 'No attachments', cls: 'setting-item-description' });
            return;
        }

        const list = this.attachmentsDisplayEl.createEl('ul', { cls: 'bibliography-attachments-list' });
        this.attachmentData.forEach((attachment, index) => {
            const li = list.createEl('li');
            const type = attachment.type === AttachmentType.IMPORT ? 'Import' : 'Link';
            const name = attachment.type === AttachmentType.IMPORT
                ? (attachment.filename || attachment.file?.name || 'Unknown')
                : (attachment.path?.split('/').pop() || 'Unknown');

            li.createSpan({ text: `${type}: ${name}` });
            li.createEl('button', { text: '×', cls: 'bibliography-remove-attachment-button' })
                .onclick = () => { this.attachmentData.splice(index, 1); this.updateAttachmentsDisplay(); };
        });
    }

    private createCitoidLookupSection(contentEl: HTMLElement) {
        // Use native <details> for collapsible section
        const details = contentEl.createEl('details', { cls: 'bibliography-autofill-details' });

        // Determine if should be open by default
        const shouldBeOpen = this.openedViaCommand &&
            !(this.attachmentData.length > 0 && this.attachmentData[0].type === AttachmentType.IMPORT);
        if (shouldBeOpen) {
            details.setAttribute('open', '');
        }

        // Summary (clickable header)
        const summary = details.createEl('summary');
        summary.createSpan({ text: 'Auto-fill from identifier or BibTeX' });
        if (this.attachmentData.length > 0 && this.attachmentData[0].type === AttachmentType.IMPORT) {
            summary.createSpan({ cls: 'bibliography-zotero-notice', text: ' (Zotero data loaded)' });
        }

        // Content
        const citoidContent = details.createDiv({ cls: 'bibliography-autofill-content' });

        // Identifier lookup
        new Setting(citoidContent)
            .setName('Lookup by identifier')
            .setDesc('DOI, ISBN, arXiv ID, URL, PubMed, PMC, Wikidata QIDs')
            .addText(text => {
                text.setPlaceholder('e.g., 10.1038/nrn3241');
                text.inputEl.addClass('bibliography-identifier-input');
            })
            .addButton(button => {
                button.setButtonText(UI_TEXT.LOOKUP).setCta();
                button.onClick(async () => {
                    const input = citoidContent.querySelector('.bibliography-identifier-input') as HTMLInputElement;
                    const identifier = input?.value.trim();
                    if (!identifier) {
                        new Notice('Please enter an identifier');
                        return;
                    }

                    button.setDisabled(true);
                    button.setButtonText(UI_TEXT.LOADING);

                    try {
                        const cslData = await this.citationService.fetchNormalized(identifier);
                        if (cslData) {
                            this.populateFormFromCitoid(cslData);
                            new Notice('Citation data loaded');
                        } else {
                            new Notice('No citation data found');
                        }
                    } catch (error) {
                        new Notice(`Error: ${error instanceof Error ? error.message : String(error)}`);
                    } finally {
                        button.setDisabled(false);
                        button.setButtonText(UI_TEXT.LOOKUP);
                    }
                });
            });

        // BibTeX paste
        const bibtexSetting = new Setting(citoidContent)
            .setName('Paste BibTeX')
            .setDesc('Parse a BibTeX entry to fill the form');

        const bibtexInput = bibtexSetting.controlEl.createEl('textarea', {
            placeholder: 'Paste BibTeX here...',
            cls: 'bibliography-bibtex-input'
        });

        bibtexSetting.addButton(button => {
            button.setButtonText('Parse');
            button.onClick(() => {
                const bibtexText = bibtexInput.value.trim();
                if (!bibtexText) {
                    new Notice(ERROR_MESSAGES.EMPTY_BIBTEX);
                    return;
                }

                button.setDisabled(true);
                button.setButtonText(UI_TEXT.PARSING);

                try {
                    const normalizedData = this.citationService.parseBibTeX(bibtexText);
                    if (!normalizedData) {
                        new Notice(ERROR_MESSAGES.NO_BIBTEX_DATA);
                        return;
                    }
                    this.populateFormFromCitoid(normalizedData);
                    new Notice(SUCCESS_MESSAGES.BIBTEX_PARSED);
                } catch (error) {
                    new Notice(ERROR_MESSAGES.BIBTEX_PARSE_FAILED);
                } finally {
                    button.setDisabled(false);
                    button.setButtonText('Parse');
                }
            });
        });
    }

    private createAttachmentSection(contentEl: HTMLElement) {
        new Setting(contentEl)
            .setName('Attachments')
            .setDesc('Import a file or link to an existing vault file')
            .addButton(button => {
                button.setButtonText('Import file').onClick(() => this.addImportAttachment());
            })
            .addButton(button => {
                button.setButtonText('Link file').onClick(() => this.addLinkAttachment());
            });

        this.attachmentsDisplayEl = contentEl.createDiv({ cls: 'bibliography-attachments-display' });
        this.updateAttachmentsDisplay();
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
    
    private createMainForm(contentEl: HTMLElement) {
        const formContainer = contentEl.createDiv({ cls: 'bibliography-form' });

        this.createContributorsSection(formContainer);
        this.createCoreFieldsSection(formContainer);
        this.createCustomFieldsSection(formContainer);
        this.createAdditionalFieldsSection(formContainer);
        this.createRelatedNotesSection(formContainer);
        this.createCitekeySection(formContainer);
        this.createActionButtons(formContainer);
    }

    private createContributorsSection(container: HTMLElement): void {
        container.createEl('h4', { text: 'Contributors' });
        this.contributorsListContainer = container.createDiv({ cls: 'bibliography-contributors' });
        this.addContributorField('author');

        new ButtonComponent(container)
            .setButtonText('Add contributor')
            .onClick(() => this.addContributorField('author'));
    }

    private createCoreFieldsSection(container: HTMLElement): void {
        // Type dropdown
        new Setting(container)
            .setName('Type')
            .setDesc('Type of reference')
            .addDropdown(dropdown => {
                const commonTypes = ['article-journal', 'book', 'chapter', 'paper-conference', 'report', 'thesis', 'webpage'];
                const commonLabels = ['Journal article', 'Book', 'Book chapter', 'Conference paper', 'Report', 'Thesis', 'Web page'];

                commonTypes.forEach((type, i) => dropdown.addOption(type, commonLabels[i]));
                dropdown.addOption('divider1', '------------------');

                [...CSL_TYPES].filter(t => !commonTypes.includes(t)).sort().forEach(type => {
                    const label = type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    dropdown.addOption(type, label);
                });

                dropdown.setValue('article-journal');
                this.typeDropdown = dropdown.selectEl;
                dropdown.onChange(v => { if (v.startsWith('divider')) dropdown.setValue('article-journal'); });
            });

        // Title
        new Setting(container).setName('Title').setDesc('Title of the work')
            .addText(t => { this.titleInput = t.inputEl; t.inputEl.addClass('bibliography-input-full'); });

        // Short title
        new Setting(container).setName('Short title').setDesc('Abbreviated title (optional)')
            .addText(t => { this.titleShortInput = t.inputEl; });

        // Pages
        new Setting(container).setName('Pages').setDesc('Page range (e.g., 123-145)')
            .addText(t => { this.pageInput = t.inputEl; });

        // URL
        new Setting(container).setName('URL').setDesc('Web address')
            .addText(t => { this.urlInput = t.inputEl; t.inputEl.type = 'url'; });

        // Container title
        new Setting(container).setName('Container title').setDesc('Journal, book, or website name')
            .addText(t => { this.containerTitleInput = t.inputEl; t.inputEl.addClass('bibliography-input-full'); });

        // Date
        new Setting(container).setName('Date').setDesc('Publication date (YYYY, YYYY-MM, or YYYY-MM-DD)')
            .addText(t => { this.dateInput = t.inputEl; t.setPlaceholder('e.g., 2024, 2024-03, 2024-03-15'); });

        // Publisher
        new Setting(container).setName('Publisher').setDesc('Name of publisher')
            .addText(t => { this.publisherInput = t.inputEl; });

        // Publisher place
        new Setting(container).setName('Publisher place').setDesc('Location of publisher')
            .addText(t => { this.publisherPlaceInput = t.inputEl; });

        // Edition
        new Setting(container).setName('Edition').setDesc('Edition number or description')
            .addText(t => { this.editionInput = t.inputEl; });

        // Volume
        new Setting(container).setName('Volume').setDesc('Volume number')
            .addText(t => { this.volumeInput = t.inputEl; });

        // Number/Issue
        new Setting(container).setName('Number/Issue').setDesc('Issue or number identifier')
            .addText(t => { this.numberInput = t.inputEl; });

        // Language
        new Setting(container).setName('Language').setDesc('Primary language of the work')
            .addDropdown(dropdown => {
                dropdown.addOption('', 'Select language...');

                // Favorites first
                if (this.settings.favoriteLanguages?.length) {
                    this.settings.favoriteLanguages.forEach(lang => {
                        if (lang.code && lang.name) dropdown.addOption(lang.code, lang.name);
                    });
                    const sep = dropdown.selectEl.createEl('option', { text: '──────────────', value: '_separator' });
                    sep.disabled = true;
                }

                const standardLangs = [
                    { code: 'en', name: 'English' }, { code: 'fr', name: 'French' },
                    { code: 'de', name: 'German' }, { code: 'es', name: 'Spanish' },
                    { code: 'it', name: 'Italian' }, { code: 'ja', name: 'Japanese' },
                    { code: 'zh', name: 'Chinese' }, { code: 'ru', name: 'Russian' },
                    { code: 'pt', name: 'Portuguese' }, { code: 'ar', name: 'Arabic' },
                    { code: 'ko', name: 'Korean' }, { code: 'la', name: 'Latin' },
                    { code: 'el', name: 'Greek' }, { code: 'other', name: 'Other' }
                ];
                const favCodes = new Set(this.settings.favoriteLanguages?.map(l => l.code) || []);
                standardLangs.forEach(l => { if (!favCodes.has(l.code)) dropdown.addOption(l.code, l.name); });

                this.languageDropdown = dropdown.selectEl;
            });

        // DOI
        new Setting(container).setName('DOI').setDesc('Digital Object Identifier')
            .addText(t => { this.doiInput = t.inputEl; });

        // Abstract
        new Setting(container).setName('Abstract').setDesc('Summary of the work')
            .addTextArea(t => { this.abstractInput = t.inputEl; t.inputEl.rows = 4; t.inputEl.addClass('bibliography-input-full'); });
    }

    private createCustomFieldsSection(container: HTMLElement): void {
        if (this.settings.defaultModalFields?.length) {
            container.createEl('h4', { text: 'Custom fields' });
            const fieldsContainer = container.createDiv({ cls: 'bibliography-default-fields' });
            this.createDefaultFields(fieldsContainer);
        }
    }

    private createAdditionalFieldsSection(container: HTMLElement): void {
        container.createEl('h4', { text: 'Additional fields' });
        this.additionalFieldsContainer = container.createDiv({ cls: 'bibliography-additional-fields' });

        new ButtonComponent(container)
            .setButtonText('Add field')
            .onClick(() => this.addAdditionalField('', '', 'standard'));
    }

    private createRelatedNotesSection(container: HTMLElement): void {
        const displayEl = container.createDiv({ cls: 'bibliography-related-notes-display' });

        new Setting(container)
            .setName('Related notes')
            .setDesc('Link existing notes that relate to this entry')
            .addButton(btn => btn.setButtonText('Add note').onClick(() => {
                new NoteSuggestModal(this.app, (file) => {
                    if (file && !this.relatedNotePaths.includes(file.path)) {
                        this.relatedNotePaths.push(file.path);
                        this.updateRelatedNotesDisplay(displayEl);
                    } else if (file) {
                        new Notice(`"${file.basename}" is already selected.`);
                    }
                }).open();
            }));

        this.updateRelatedNotesDisplay(displayEl);
    }

    private createCitekeySection(container: HTMLElement): void {
        new Setting(container)
            .setName('Citekey')
            .setDesc('Unique citation key used as filename')
            .addText(text => {
                this.idInput = text.inputEl;
                text.setPlaceholder('Autogenerated from author and year');
            })
            .addButton(btn => {
                btn.setIcon('reset').setTooltip('Regenerate citekey').onClick(() => {
                    const formData = this.getFormValues();
                    if (formData.title || formData.author?.length) {
                        this.idInput.value = CitekeyGenerator.generate(formData, this.settings.citekeyOptions);
                    } else {
                        new Notice('Add author and title first to generate citekey');
                    }
                });
            });
    }

    private createActionButtons(container: HTMLElement): void {
        const btnContainer = container.createDiv({ cls: 'bibliography-form-buttons' });

        new ButtonComponent(btnContainer).setButtonText('Cancel').onClick(() => this.close());

        const submitBtn = new ButtonComponent(btnContainer)
            .setButtonText('Create note')
            .setCta()
            .onClick(async () => {
                const citation = this.getFormValues();
                if (!this.validateForm(citation)) return;

                submitBtn.setDisabled(true);
                submitBtn.setButtonText('Creating...');
                await this.handleSubmit(citation);
            });
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
            
            // Date field - build partial date string (YYYY, YYYY-MM, or YYYY-MM-DD)
            if (cslData.issued && cslData.issued['date-parts'] &&
                cslData.issued['date-parts'][0] && cslData.issued['date-parts'][0].length > 0) {
                const dateParts = cslData.issued['date-parts'][0];
                let dateStr = String(dateParts[0]);
                if (dateParts[1]) {
                    dateStr += `-${String(dateParts[1]).padStart(2, '0')}`;
                    if (dateParts[2]) {
                        dateStr += `-${String(dateParts[2]).padStart(2, '0')}`;
                    }
                }
                this.dateInput.value = dateStr;
            } else if (cslData.year) {
                let dateStr = String(cslData.year);
                if (cslData.month) {
                    dateStr += `-${String(cslData.month).padStart(2, '0')}`;
                    if (cslData.day) {
                        dateStr += `-${String(cslData.day).padStart(2, '0')}`;
                    }
                }
                this.dateInput.value = dateStr;
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
        
        // Handle date field - parse YYYY, YYYY-MM, or YYYY-MM-DD
        const dateValue = this.dateInput.value.trim();
        if (dateValue) {
            // Try full date first (YYYY-MM-DD)
            let dateMatch = dateValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (dateMatch) {
                const year = parseInt(dateMatch[1], 10);
                const month = parseInt(dateMatch[2], 10);
                const day = parseInt(dateMatch[3], 10);
                citation.year = year.toString();
                citation.month = month.toString();
                citation.day = day.toString();
                citation.issued = { 'date-parts': [[year, month, day]] };
            } else {
                // Try year-month (YYYY-MM)
                dateMatch = dateValue.match(/^(\d{4})-(\d{1,2})$/);
                if (dateMatch) {
                    const year = parseInt(dateMatch[1], 10);
                    const month = parseInt(dateMatch[2], 10);
                    citation.year = year.toString();
                    citation.month = month.toString();
                    citation.issued = { 'date-parts': [[year, month]] };
                } else {
                    // Try year only (YYYY)
                    dateMatch = dateValue.match(/^(\d{4})$/);
                    if (dateMatch) {
                        const year = parseInt(dateMatch[1], 10);
                        citation.year = year.toString();
                        citation.issued = { 'date-parts': [[year]] };
                    }
                }
            }
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
        displayEl.empty();

        if (this.relatedNotePaths.length === 0) {
            displayEl.createSpan({ text: 'No related notes', cls: 'setting-item-description' });
            return;
        }

        const list = displayEl.createEl('ul', { cls: 'bibliography-related-notes-list' });
        this.relatedNotePaths.forEach(notePath => {
            const li = list.createEl('li');
            const basename = notePath.substring(notePath.lastIndexOf('/') + 1);
            li.createSpan({ text: basename });
            li.createEl('button', { text: '×', cls: 'bibliography-remove-related-note-button' })
                .onclick = () => {
                    this.relatedNotePaths = this.relatedNotePaths.filter(p => p !== notePath);
                    this.updateRelatedNotesDisplay(displayEl);
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
