import { App, Modal, Notice, Setting, TFile, ButtonComponent, FuzzySuggestModal } from 'obsidian';
import { NoteSuggestModal } from './note-suggest-modal';
import { BibliographyPluginSettings } from '../../types/settings';
import { Contributor, AdditionalField, Citation, AttachmentData, AttachmentType } from '../../types/citation';
import { ContributorField } from '../components/contributor-field';
import { AdditionalFieldComponent } from '../components/additional-field';
import { CitekeyGenerator } from '../../utils/citekey-generator';
import { 
    NoteCreationService,
    TemplateVariableBuilderService,
    FrontmatterBuilderService,
    NoteContentBuilderService,
    AttachmentManagerService,
    ReferenceParserService,
    CitationService
} from '../../services';

// Define type for book entries used in this modal
type BookEntry = { id: string; title: string; path: string; frontmatter: any };

export class ChapterModal extends Modal {
    // Services
    private noteCreationService: NoteCreationService;
    private citationService: CitationService;
    
    // Data state
    private additionalFields: AdditionalField[] = [];
    private contributors: Contributor[] = [];
    private bookEntries: BookEntry[] = []; // Use defined type
    private relatedNotePaths: string[] = [];
    private selectedBook: BookEntry | null = null; // Use defined type
    private attachmentData: AttachmentData[] = [];
    
    // Form elements
    private idInput: HTMLInputElement;
    private titleInput: HTMLInputElement;
    private titleShortInput: HTMLInputElement;
    private pageInput: HTMLInputElement;
    private bookDropdown: HTMLSelectElement;
    private bookPathDisplay: HTMLElement;
    private yearInput: HTMLInputElement;
    private monthDropdown: HTMLSelectElement;
    private dayInput: HTMLInputElement;
    private abstractInput: HTMLTextAreaElement;
    private contributorsListContainer: HTMLDivElement;
    private additionalFieldsContainer: HTMLDivElement;
    private doiInput: HTMLInputElement;
    
    // Attachment elements
    private attachmentTypeSelect: HTMLSelectElement;
    private filePathDisplay: HTMLElement; 
    private importSettingEl: HTMLElement;
    private linkSettingEl: HTMLElement;
    // Store ButtonComponent instances directly
    private linkButtonComponent: ButtonComponent | null = null;
    private importButtonComponent: ButtonComponent | null = null;

    private initialBookPath?: string;

    constructor(app: App, private settings: BibliographyPluginSettings, initialBookPath?: string) {
        super(app);
        
        // Initialize citation service for citekey generation
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
        
        this.initialBookPath = initialBookPath;
    }

    // Load initial book data if path provided
    private async loadInitialBook() {
         if (this.initialBookPath) {
            // Use noteCreationService for book retrieval
            const book = await this.noteCreationService.getBookEntryByPath(this.initialBookPath);
            if (book) {
                this.selectedBook = book; // Assign fetched book (type matches)
                // Only apply the book data after UI elements are created
                if (this.bookDropdown) {
                    this.bookDropdown.value = book.path; // Set dropdown value using path
                    this.populateFromBook(book); // Populate fields
                    this.bookPathDisplay.textContent = `Selected book path: ${book.path}`;
                    this.bookPathDisplay.removeClass('setting-hidden');
                    this.bookPathDisplay.addClass('setting-visible');
                }
            } else {
                 new Notice(`Could not load initial book: ${this.initialBookPath}`);
            }
         } 
    }
    
    async onOpen() {
        const { contentEl } = this;
        // Fix: Add classes separately
        contentEl.addClass('bibliography-modal');
        contentEl.addClass('chapter-modal'); 

        // Modal title
        contentEl.createEl('h2', { text: 'Create book chapter entry' });
        
        // Load available book entries for dropdown
        this.bookEntries = await this.noteCreationService.getBookEntries();
        
        // Create the main form UI
        this.createMainForm(contentEl);
        
        // Load the initial book data if a path was provided
        await this.loadInitialBook();
    }
    
    private createMainForm(contentEl: HTMLElement) {
        // --- Chapter Identification --- 
        new Setting(contentEl).setName('Chapter identification').setHeading();

        // Citekey input (required)
        new Setting(contentEl)
            .setName('Citekey')
            .setDesc('Unique identifier for this chapter')
            .addText(text => {
                this.idInput = text.inputEl;
                text.setPlaceholder('Generated from author and year');
                
                // Add regenerate button as separate component
                const parentElement = text.inputEl.parentElement;
                if (!parentElement) return text;
                
                const regenerateButton = new ButtonComponent(parentElement)
                    .setIcon('reset')
                    .setTooltip('Regenerate citekey')
                    .onClick(() => {
                        // Get current form data for citekey generation
                        const formData = this.getFormValues();
                        
                        // Only attempt to generate if we have required fields
                        if (formData.title || (formData.author && formData.author.length)) {
                            // Generate citekey using current form data
                            const citekey = CitekeyGenerator.generate(formData, this.settings.citekeyOptions);
                            // Update ID field
                            this.idInput.value = citekey;
                        } else {
                            new Notice('Add title and contributors first to generate citekey');
                        }
                    });
                
                return text;
            });

        // Chapter title (required)
        new Setting(contentEl)
            .setName('Chapter title')
            .setDesc('Title of this specific chapter')
            .addText(text => {
                this.titleInput = text.inputEl;
                text.inputEl.addClass('bibliography-input-full');
                return text;
            });

        // Short title (optional)
        new Setting(contentEl)
            .setName('Short title')
            .setDesc('Abbreviated chapter title (optional)')
            .addText(text => {
                this.titleShortInput = text.inputEl;
                return text;
            });

        // Page range (optional)
        new Setting(contentEl)
            .setName('Pages')
            .setDesc('Page range of this chapter (e.g., 123-145)')
            .addText(text => {
                this.pageInput = text.inputEl;
                return text;
            });

        // --- Book Selection ---
        new Setting(contentEl).setName('Book information').setHeading();

        // Book selector (required)
        const bookSetting = new Setting(contentEl)
            .setName('Book')
            .setDesc('Select the book this chapter belongs to');
        
        // Create the book dropdown
        this.bookDropdown = bookSetting.controlEl.createEl('select', { cls: 'dropdown' });
        
        // Add empty option first 
        this.bookDropdown.createEl('option', { value: '', text: 'Select a book' });
        
        // Add available books from your literature notes
        this.bookEntries.forEach(book => {
            this.bookDropdown.createEl('option', { 
                value: book.path, 
                text: book.title || book.id 
            });
        });

        // Add "book path" display that will be shown when a book is selected
        this.bookPathDisplay = contentEl.createEl('div', { 
            cls: 'book-path-display setting-item setting-hidden',
        });

        // Add event listener for book selection
        this.bookDropdown.addEventListener('change', () => {
            const selectedPath = this.bookDropdown.value;
            
            if (selectedPath) {
                const selectedBook = this.bookEntries.find(book => book.path === selectedPath);
                
                if (selectedBook) {
                    this.selectedBook = selectedBook;
                    this.populateFromBook(selectedBook);
                    
                    // Show the book path for user reference
                    this.bookPathDisplay.textContent = `Selected book path: ${selectedPath}`;
                    this.bookPathDisplay.removeClass('setting-hidden');
                    this.bookPathDisplay.addClass('setting-visible');
                }
            } else {
                this.selectedBook = null;
                this.bookPathDisplay.addClass('setting-hidden');
                this.bookPathDisplay.removeClass('setting-visible');
            }
        });

        // DOI field
        new Setting(contentEl)
            .setName('DOI')
            .setDesc('Digital Object Identifier for this chapter (if available)')
            .addText(text => {
                this.doiInput = text.inputEl;
                return text;
            });

        // Create a simple grid for date inputs (apply only to chapter)
        const dateContainer = contentEl.createDiv({ cls: 'bibliography-date-container' });
        
        // Year field (optional override)
        const yearSetting = new Setting(dateContainer)
            .setName('Year')
            .setDesc('Publication year (if different from book)');
        
        this.yearInput = yearSetting.controlEl.createEl('input', { type: 'number' });
        this.yearInput.placeholder = 'YYYY';
        
        // Month field (optional)
        const monthSetting = new Setting(dateContainer)
            .setName('Month')
            .setDesc('Publication month (if applicable)');
        
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
        
        // Day field (optional)
        const daySetting = new Setting(dateContainer)
            .setName('Day')
            .setDesc('Publication day (if applicable)');
        
        this.dayInput = daySetting.controlEl.createEl('input', { type: 'number' });
        this.dayInput.placeholder = 'DD';
        this.dayInput.min = '1';
        this.dayInput.max = '31';

        // Language field
        new Setting(contentEl)
            .setName('Language')
            .setDesc('Primary language of the chapter')
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
                
                return dropdown;
            });

        // Abstract field
        new Setting(contentEl)
            .setName('Abstract')
            .setDesc('Chapter summary (optional)')
            .addTextArea(textarea => {
                this.abstractInput = textarea.inputEl;
                textarea.inputEl.rows = 4;
                textarea.inputEl.addClass('bibliography-input-full');
                return textarea;
            });

        // --- Contributors Section ---
        contentEl.createEl('h4', { text: 'Contributors' });
        
        // Container for contributor fields
        this.contributorsListContainer = contentEl.createDiv({ cls: 'bibliography-contributors' });
        
        // Start with one author field
        this.addContributorField('author');
        
        // Add button to add more contributors
        const addContributorButton = new ButtonComponent(contentEl)
            .setButtonText('Add contributor')
            .onClick(() => this.addContributorField('author'));

        // --- Additional Fields Section ---
        contentEl.createEl('h4', { text: 'Additional fields' });
        
        // Container for additional fields
        this.additionalFieldsContainer = contentEl.createDiv({ cls: 'bibliography-additional-fields' });
        
        // Add button to add more fields
        const addFieldButton = new ButtonComponent(contentEl)
            .setButtonText('Add field')
            .onClick(() => this.addAdditionalField('', '', 'standard'));
            
        // --- Related notes section ---
        contentEl.createEl('h4', { text: 'Related notes' });
        const relatedNotesSetting = new Setting(contentEl)
            .setName('Link related notes')
            .setDesc('Select existing notes in your vault that relate to this chapter.');

        // Container to display selected notes
        const relatedNotesDisplayEl = contentEl.createDiv({ cls: 'bibliography-related-notes-display' });
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

        // --- Attachment Section ---
        this.createAttachmentSection(contentEl);

        // --- Create final buttons (Cancel and Create Note) ---
        const finalButtonContainer = contentEl.createDiv({ cls: 'bibliography-form-buttons' });
        
        // Cancel button
        const cancelButton = finalButtonContainer.createEl('button', { 
            text: 'Cancel',
            cls: 'bibliography-cancel-button'
        });
        cancelButton.onclick = () => this.close();
        
        // Submit button
        const submitButton = finalButtonContainer.createEl('button', { 
            text: 'Create chapter note', 
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
     * Create the attachment section of the modal
     */
    private createAttachmentSection(contentEl: HTMLElement) {
        const attachmentContainer = contentEl.createDiv({ cls: 'attachment-container' });
        
        // Add section heading
        attachmentContainer.createEl('div', { cls: 'setting-item-heading', text: 'Chapter attachments' });
        
        // Create attachment setting
        const attachmentSetting = new Setting(attachmentContainer)
            .setDesc('Add attachments to this chapter');
        
        // Create the attachment type dropdown
        this.attachmentTypeSelect = attachmentSetting.controlEl.createEl('select', { cls: 'dropdown' });
        
        // Add options for Import, Link
        this.attachmentTypeSelect.createEl('option', { value: AttachmentType.IMPORT, text: 'Import new file' });
        this.attachmentTypeSelect.createEl('option', { value: AttachmentType.LINK, text: 'Link to existing file' });
        
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
        const attachmentsDisplayEl = attachmentContainer.createDiv({ cls: 'bibliography-attachments-display' });
        this.updateAttachmentsDisplay(attachmentsDisplayEl); // Initialize display
        
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
        fileInput.accept = '*.*'; // Allow all file types
        
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
    
    /**
     * Update the display of attachments
     */
    private updateAttachmentsDisplay(displayEl?: HTMLElement): void {
        // Find the display element if not provided
        const attachmentsDisplayEl = displayEl || this.contentEl.querySelector('.bibliography-attachments-display');
        if (!attachmentsDisplayEl) return;
        
        attachmentsDisplayEl.empty(); // Clear previous display
        
        if (this.attachmentData.length === 0) {
            attachmentsDisplayEl.setText('No attachments added.');
            return;
        }
        
        const listEl = attachmentsDisplayEl.createEl('ul', { cls: 'bibliography-attachments-list' });
        
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
                this.updateAttachmentsDisplay(attachmentsDisplayEl as HTMLElement); // Refresh display
            };
        });
    }

    /**
     * Add a contributor field to the UI and data model
     */
    private addContributorField(
        role: string = 'author', 
        family: string = '', 
        given: string = '',
        literal: string = ''
    ): Contributor {
        // Make sure the contributors container has the right class
        this.contributorsListContainer.addClass('bibliography-contributors');
        
        // Normalize empty values
        family = family || '';
        given = given || '';
        literal = literal || '';
        
        // Create contributor object
        const contributor: Contributor = {
            role,
            family,
            given,
            literal
        };
        
        // Add to contributors array - we push directly since we're handling duplicates by clearing
        this.contributors.push(contributor);
        
        // Create and append the component to the UI
        const component = new ContributorField(
            this.contributorsListContainer,
            contributor,
            (contributorToRemove) => {
                // Remove from contributors array - use a proper comparison since we need to find by value
                const index = this.contributors.findIndex(c => 
                    c.role === contributorToRemove.role &&
                    c.family === contributorToRemove.family &&
                    c.given === contributorToRemove.given &&
                    c.literal === contributorToRemove.literal
                );
                
                if (index !== -1) {
                    this.contributors.splice(index, 1);
                }
            }
        );
        
        // Return the created contributor
        return contributor;
    }

    /**
     * Add an additional field to the UI and data model
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
     * Populate form fields from book data for chapter creation
     */
    private populateFromBook(book: BookEntry) {
        if (!book) return;
        
        // Access frontmatter
        const fm = book.frontmatter;
        
        // Auto-generate citekey for chapter based on book ID
        // Only if ID field is empty or matches a previous book's pattern
        if (!this.idInput.value || this.idInput.value.includes('.ch')) {
            // Generate chapter citekey based on book ID
            this.idInput.value = `${book.id}.ch1`;
        }
        
        // We don't populate the title, as this is for the chapter title
        
        // First check if we have any real contributors already
        const hasRealContributors = this.contributors.some(c => 
            c.family || c.given || c.literal
        );
        
        if (!hasRealContributors) {
            // Clear everything
            this.contributorsListContainer.empty();
            this.contributors = [];
            
            
            // First, check for editors - they should be added to the chapter regardless of authors
            let editors: any[] = [];
            if (fm.editor && Array.isArray(fm.editor)) {
                editors = fm.editor.map((editor: any) => ({...editor, role: 'editor'}));
            } 
            else if (fm.editor && typeof fm.editor === 'object' && !Array.isArray(fm.editor)) {
                editors = [{...fm.editor, role: 'editor'}];
            }
            else if (fm.editor && typeof fm.editor === 'string' && fm.editor.trim()) {
                editors = [{role: 'editor', literal: fm.editor.trim()}];
            }
            
            // Add all editors found (with proper editor role)
            if (editors.length > 0) {
                editors.forEach((editor: any) => {
                    if (typeof editor === 'object') {
                        // Get properties with proper fallbacks
                        const family = editor.family || '';
                        const given = editor.given || '';
                        const literal = editor.literal || '';
                        
                        // Always use 'editor' role for editors
                        this.addContributorField('editor', family, given, literal);
                    } else if (typeof editor === 'string' && editor.trim()) {
                        this.addContributorField('editor', '', '', editor.trim());
                    }
                });
            }
            
            // Next, check for book authors to add as container-authors
            let containerAuthors: any[] = [];
            if (fm.author && Array.isArray(fm.author)) {
                containerAuthors = fm.author.map((author: any) => ({...author, role: 'container-author'}));
            } 
            else if (fm.author && typeof fm.author === 'object' && !Array.isArray(fm.author)) {
                containerAuthors = [{...fm.author, role: 'container-author'}];
            }
            else if (fm.author && typeof fm.author === 'string' && fm.author.trim()) {
                containerAuthors = [{role: 'container-author', literal: fm.author.trim()}];
            }
            
            // Add all container authors found
            if (containerAuthors.length > 0) {
                containerAuthors.forEach((containerAuthor: any) => {
                    if (typeof containerAuthor === 'object') {
                        // Get properties with proper fallbacks
                        const family = containerAuthor.family || '';
                        const given = containerAuthor.given || '';
                        const literal = containerAuthor.literal || '';
                        
                        // Add with container-author role
                        this.addContributorField('container-author', family, given, literal);
                    } else if (typeof containerAuthor === 'string' && containerAuthor.trim()) {
                        this.addContributorField('container-author', '', '', containerAuthor.trim());
                    }
                });
            }
            // Book authors are NOT added as chapter authors - they're handled via container-author
            // Chapter authors must be entered manually by the user
            
            // Add an empty author field for the chapter author 
            // (book authors are already captured in the citation as container-author)
            this.addContributorField('author');
        }
        
        // Handle book attachments - check all possible sources of attachment data
        const attachmentPaths: string[] = [];
        
        // Check for attachment_path field (direct path reference)
        if (fm.attachment_path) {
            const path = this.extractPathFromAttachment(fm.attachment_path);
            if (path) attachmentPaths.push(path);
        } 
        // Check for attachment field (may contain array or string)
        else if (fm.attachment) {
            if (Array.isArray(fm.attachment)) {
                // Process all attachments in the array
                for (const attachment of fm.attachment) {
                    const path = this.extractPathFromAttachment(attachment);
                    if (path) attachmentPaths.push(path);
                }
            } else if (typeof fm.attachment === 'string') {
                const path = this.extractPathFromAttachment(fm.attachment);
                if (path) attachmentPaths.push(path);
            }
        }
        
        // If we found attachment paths, add them to the attachmentData array
        if (attachmentPaths.length > 0) {
            // Clear existing attachments first
            this.attachmentData = [];
            
            // Add each path as a link attachment
            for (const path of attachmentPaths) {
                this.attachmentData.push({
                    type: AttachmentType.LINK,
                    path: path
                });
            }
            
            // Update the display
            this.updateAttachmentsDisplay();
        }
        
        // Copy additional fields from book that might be relevant to chapters
        const relevantFields = ['publisher', 'publisher-place', 'volume', 'edition', 'ISBN'];
        
        // Clear existing additional fields
        this.additionalFields = [];
        this.additionalFieldsContainer.empty();
        
        // Copy relevant fields from book frontmatter
        for (const field of relevantFields) {
            if (fm[field]) {
                this.addAdditionalField(field, fm[field], 'standard');
            }
        }
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
    
    /**
     * Helper method to extract file path from attachment references
     * Handles various formats including wikilinks [[file.pdf]]
     */
    private extractPathFromAttachment(attachment: string): string {
        // Handle wikilinks format: [[path/to/file.pdf]] or [[path/to/file.pdf|alias]]
        const wikiLinkMatch = attachment.match(/\[\[(.*?)(?:\|.*?)?\]\]/);
        if (wikiLinkMatch && wikiLinkMatch[1]) {
            return wikiLinkMatch[1];
        }
        
        // Handle markdown links: [name](path/to/file.pdf)
        const markdownLinkMatch = attachment.match(/\[.*?\]\((.*?)\)/);
        if (markdownLinkMatch && markdownLinkMatch[1]) {
            return markdownLinkMatch[1];
        }
        
        // Handle direct file paths (just return the string)
        if (attachment.endsWith('.pdf') || attachment.endsWith('.epub')) {
            return attachment;
        }
        
        return '';
    }

    /**
     * Get all form values as a Citation object
     */
    private getFormValues(): Citation {
        if (!this.selectedBook) {
            throw new Error("No book selected");
        }
        
        // Get selected book data
        const bookData = this.selectedBook.frontmatter;
        // Build citation object from form fields
        const citation: Citation = {
            id: this.idInput.value || CitekeyGenerator.generate({ 
                title: this.titleInput.value,
                author: this.contributors.filter(c => c.role === 'author')
            }, this.settings.citekeyOptions),
            type: 'chapter', // Fixed as chapter type
            title: this.titleInput.value,
            'title-short': this.titleShortInput.value || undefined,
            'container-title': bookData.title, // Book title
            publisher: bookData.publisher, // Book publisher
            'publisher-place': bookData['publisher-place'], // Book publisher place
            page: this.pageInput.value || undefined,
            DOI: this.doiInput.value || undefined,
            abstract: this.abstractInput.value || undefined,
            // Chapter-specific fields we may want to include
            'container-author': this.contributors.filter(c => c.role === 'container-author'), // Book authors as container-author
            volume: bookData.volume,
            edition: bookData.edition,
            isbn: bookData.ISBN,
        };
        
        // Handle date fields - prioritize chapter date if provided, otherwise use book date
        const year = this.yearInput.value.trim();
        const month = this.monthDropdown.value.trim();
        const day = this.dayInput.value.trim();
        
        if (year) {
            // If chapter has its own date info, use that
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
        } else if (bookData.issued) {
            // Otherwise use the book's date info
            citation.issued = bookData.issued;
            
            // Extract simple fields too
            if (bookData.year) {
                citation.year = bookData.year;
            }
            if (bookData.month) {
                citation.month = bookData.month;
            }
            if (bookData.day) {
                citation.day = bookData.day;
            }
        }
        
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

        // Add the book ID as a related publication
        citation.bookID = this.selectedBook.id;
        
        return citation;
    }

    /**
     * Validate form fields before submission
     */
    private validateForm(citation: Citation): boolean {
        let isValid = true;
        let message = 'Please complete all required fields:';
        
        // Check required fields
        if (!citation.title) {
            isValid = false;
            message += '\n- Chapter title is required';
        }
        
        if (!this.selectedBook) {
            isValid = false;
            message += '\n- You must select a book';
        }
        
        if (!citation.id) {
            isValid = false;
            message += '\n- Citekey is required';
        }
        
        // We don't require authors for chapters - they can inherit from the book
        // or be explicitly empty if needed

        if (!isValid) {
            new Notice(message);
        }
        return isValid;
    }

    /**
     * Handle form submission to create the chapter note
     */
    private async handleSubmit(citation: Citation): Promise<void> {
        if (!this.selectedBook) {
            new Notice('No book selected');
            return;
        }
        
        try {
            // Get book author info for merging contributors
            let bookContributors: Contributor[] = [];
            
            if (this.selectedBook.frontmatter) {
                // First add any chapter-specific contributors with valid content
                const finalUserContributors = this.contributors.filter(c => 
                    c.family || c.given || c.literal  // Only include contributors with content
                );
                
                // Then add book contributors with different roles
                const roles = ['editor', 'translator', 'director', 'contributor'];
                
                // Extract contributors from book frontmatter
                for (const role of roles) {
                    const contributors = this.selectedBook.frontmatter[role];
                    if (contributors && Array.isArray(contributors)) {
                        contributors.forEach((person: any) => {
                            if (typeof person === 'object') {
                                // Add as contributor with book role
                                bookContributors.push({
                                    role: role,
                                    family: person.family || '',
                                    given: person.given || '',
                                    literal: person.literal || ''
                                });
                            } else if (typeof person === 'string' && person.trim()) {
                                // Handle string-based contributors
                                bookContributors.push({
                                    role: role,
                                    family: '',
                                    given: '',
                                    literal: person.trim()
                                });
                            }
                        });
                    }
                }
                
                // Check if we need to add book authors
                // Only add book authors if we don't have chapter authors
                const hasChapterAuthors = finalUserContributors.some(c => c.role === 'author');
                
                if (!hasChapterAuthors && this.selectedBook.frontmatter.author && 
                    Array.isArray(this.selectedBook.frontmatter.author)) {
                    
                    this.selectedBook.frontmatter.author.forEach((person: any) => {
                        if (typeof person === 'object') {
                            bookContributors.push({
                                role: 'author',
                                family: person.family || '',
                                given: person.given || '',
                                literal: person.literal || ''
                            });
                        } else if (typeof person === 'string' && person.trim()) {
                            bookContributors.push({
                                role: 'author',
                                family: '',
                                given: '', 
                                literal: person.trim()
                            });
                        }
                    });
                }
            }
            
            // Combine contributors, adding book-level contributors
            const finalContributors = [
                ...this.contributors.filter(c => c.family || c.given || c.literal), // Only include non-empty contributors
                ...bookContributors
            ];
            
            // Add book path as additional field
            const bookPathField: AdditionalField = {
                name: 'book_path',
                value: this.selectedBook.path,
                type: 'standard'
            };
            
            const finalAdditionalFields = [
                ...this.additionalFields,
                bookPathField
            ];
            
            // Use the noteCreationService to create the chapter
            const result = await this.noteCreationService.createLiteratureNote({
                citation,
                contributors: finalContributors,
                additionalFields: finalAdditionalFields,
                attachmentData: this.attachmentData.length > 0 ? this.attachmentData : null,
                relatedNotePaths: this.relatedNotePaths.length > 0 ? this.relatedNotePaths : undefined
            });
            
            if (result.success) {
                this.close(); // Close modal on success
            } else {
                throw result.error || new Error('Unknown error creating chapter note');
            }
            
        } catch (error) {
            console.error('Error creating chapter note:', error);
            
            // Re-enable the submit button if it exists
            const submitButton = this.contentEl.querySelector('.create-button') as HTMLButtonElement | null;
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Create Chapter Note';
            }
            
            new Notice(`Error creating chapter note: ${error instanceof Error ? error.message : String(error)}`);
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
