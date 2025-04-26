import { App, Modal, Notice, Setting, TFile, ButtonComponent, FuzzySuggestModal } from 'obsidian';
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

// Legacy import for compatibility
import { FileManager } from '../../services/file-manager';

// Define type for book entries used in this modal
// Ensures consistency with FileManager return types
type BookEntry = { id: string; title: string; path: string; frontmatter: any };

export class ChapterModal extends Modal {
    // Legacy service
    private fileManager: FileManager;
    
    // New services
    private noteCreationService: NoteCreationService;
    private citationService: CitationService;
    
    // Data state
    private additionalFields: AdditionalField[] = [];
    private contributors: Contributor[] = [];
    private bookEntries: BookEntry[] = []; // Use defined type
    private selectedBook: BookEntry | null = null; // Use defined type
    private attachmentData: AttachmentData = { type: AttachmentType.NONE };
    
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
        
        // Initialize legacy service for backwards compatibility
        this.fileManager = new FileManager(app, settings);
        
        // Initialize citation service for citekey generation
        this.citationService = new CitationService(settings.citekeyOptions);
        
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
        contentEl.createEl('h2', { text: 'Create Book Chapter Entry' });
        
        // Load available book entries for dropdown
        this.bookEntries = await this.noteCreationService.getBookEntries();
        
        // Create the main form UI
        this.createMainForm(contentEl);
        
        // Load the initial book data if a path was provided
        await this.loadInitialBook();
    }
    
    private createMainForm(contentEl: HTMLElement) {
        // --- Chapter Identification --- 
        new Setting(contentEl).setName('Chapter Identification').setHeading();

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
        new Setting(contentEl).setName('Book Information').setHeading();

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
            this.monthDropdown.createEl('option', { value: (index + 1).toString(), text: month });
        });
        
        // Day field (optional)
        const daySetting = new Setting(dateContainer)
            .setName('Day')
            .setDesc('Publication day (if applicable)');
        
        this.dayInput = daySetting.controlEl.createEl('input', { type: 'number' });
        this.dayInput.placeholder = 'DD';
        this.dayInput.min = '1';
        this.dayInput.max = '31';

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
        contentEl.createEl('h3', { text: 'Contributors' });
        
        // Container for contributor fields
        this.contributorsListContainer = contentEl.createDiv({ cls: 'bibliography-contributors' });
        
        // Start with one author field
        this.addContributorField('author');
        
        // Add button to add more contributors
        const addContributorButton = new ButtonComponent(contentEl)
            .setButtonText('Add contributor')
            .onClick(() => this.addContributorField('author'));

        // --- Additional Fields Section ---
        contentEl.createEl('h3', { text: 'Additional fields' });
        
        // Container for additional fields
        this.additionalFieldsContainer = contentEl.createDiv({ cls: 'bibliography-additional-fields' });
        
        // Add button to add more fields
        const addFieldButton = new ButtonComponent(contentEl)
            .setButtonText('Add field')
            .onClick(() => this.addAdditionalField('', '', 'standard'));

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
            text: 'Create Chapter Note', 
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
        attachmentContainer.createEl('div', { cls: 'setting-item-heading', text: 'Chapter Attachment' });
        
        // Create attachment setting
        const attachmentSetting = new Setting(attachmentContainer)
            .setDesc('Optionally attach a PDF/EPUB for this specific chapter');
        
        // Create attachment type dropdown
        this.attachmentTypeSelect = attachmentSetting.controlEl.createEl('select', { cls: 'dropdown' });
        
        // Add options for None, Import, Link
        this.attachmentTypeSelect.createEl('option', { value: AttachmentType.NONE, text: 'None' });
        this.attachmentTypeSelect.createEl('option', { value: AttachmentType.IMPORT, text: 'Import new file' });
        this.attachmentTypeSelect.createEl('option', { value: AttachmentType.LINK, text: 'Link to existing file' });
        
        // Container for import file option
        this.importSettingEl = attachmentContainer.createDiv({ cls: 'setting' });
        this.importSettingEl.style.display = 'none'; // Hide initially
        
        const importSetting = new Setting(this.importSettingEl)
            .setDesc('Select a PDF or EPUB file to import');
            
        // Add button to select file for import
        importSetting.addButton(button => {
            this.importButtonComponent = button; // Store reference to button
            button.setButtonText('Choose file');
            button.onClick(() => {
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
                            file: file
                        };
                    }
                });
                
                // Trigger file dialog
                fileInput.click();
            });
            return button;
        });
        
        // Create link to existing file option
        this.linkSettingEl = attachmentContainer.createDiv({ cls: 'setting' });
        this.linkSettingEl.style.display = 'none'; // Hide initially
        
        const linkSetting = new Setting(this.linkSettingEl)
            .setDesc('Select an existing file in your vault');
            
        // Add button to select file to link
        linkSetting.addButton(button => {
            this.linkButtonComponent = button; // Store reference to button
            button.setButtonText('Choose file');
            button.onClick(() => {
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
            return button;
        });
        
        // Add event listener to show/hide appropriate containers based on selection
        this.attachmentTypeSelect.addEventListener('change', () => {
            const selectedType = this.attachmentTypeSelect.value as AttachmentType;
            
            // Hide all containers first
            this.importSettingEl.style.display = 'none';
            this.linkSettingEl.style.display = 'none';
            
            // Show selected container
            if (selectedType === AttachmentType.IMPORT) {
                this.importSettingEl.style.display = 'block';
                
                // Reset attachment data if type changed but no specific file selected yet
                if (this.attachmentData.type !== AttachmentType.IMPORT || !this.attachmentData.file) {
                    this.attachmentData = {
                        type: AttachmentType.IMPORT
                    };
                    // Reset button text if needed
                    if (this.importButtonComponent)
                        this.importButtonComponent.setButtonText('Choose file');
                }
            } else if (selectedType === AttachmentType.LINK) {
                this.linkSettingEl.style.display = 'block';
                
                // Reset attachment data if type changed but no path selected yet
                if (this.attachmentData.type !== AttachmentType.LINK || !this.attachmentData.path) {
                    this.attachmentData = {
                        type: AttachmentType.LINK
                    };
                    // Reset button text if needed
                    if (this.linkButtonComponent)
                        this.linkButtonComponent.setButtonText('Choose file');
                }
            } else {
                // No attachment
                this.attachmentData = {
                    type: AttachmentType.NONE
                };
            }
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
        
        // Add to contributors array if values provided
        if (role || family || given || literal) {
            this.contributors.push({
                role,
                family,
                given,
                literal
            });
        }
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
        
        // Some types are duplicated on this.additionalFields (it holds different data)
        const fm = book.frontmatter;
        
        // Auto-generate citekey for chapter based on book ID
        // Only if ID field is empty or matches a previous book's pattern
        if (!this.idInput.value || this.idInput.value.includes('.ch')) {
            // Generate chapter citekey based on book ID
            this.idInput.value = `${book.id}.ch1`;
        }
        
        // We don't populate the title, as this is for the chapter title
        
        // If no contributors have been added yet, copy the book's authors as default
        if (this.contributors.length === 0 || 
            (this.contributors.length === 1 && !this.contributors[0].family && !this.contributors[0].given)) {
            
            // Clear existing contributors from UI
            this.contributorsListContainer.empty();
            this.contributors = [];
            
            // Copy book authors if available
            if (fm.author && Array.isArray(fm.author)) {
                fm.author.forEach((author: any) => {
                    this.addContributorField('author', author.family, author.given, author.literal);
                });
            }
        }
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
            id: this.idInput.value,
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
            'container-author': bookData.author, // Book author
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
        
        // Check for at least one author
        const hasAuthor = this.contributors.some(contributor => 
            contributor.role === 'author' && 
            (contributor.family || contributor.given || contributor.literal)
        );
        
        if (!hasAuthor) {
            isValid = false;
            message += '\n- At least one author is required';
        }

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
                const roles = ['editor', 'translator', 'director', 'contributor'];
                
                // Extract contributors from book frontmatter
                for (const role of roles) {
                    const contributors = this.selectedBook.frontmatter[role];
                    if (contributors && Array.isArray(contributors)) {
                        contributors.forEach((person: any) => {
                            // Add as contributor with book role
                            bookContributors.push({
                                role: role,
                                family: person.family || '',
                                given: person.given || '',
                                literal: person.literal || ''
                            });
                        });
                    }
                }
            }
            
            // Combine contributors, adding book-level contributors
            // (Note: we only handle specific roles, and avoid duplicating author roles)
            const finalContributors = [
                ...this.contributors,
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
                attachmentData: this.attachmentData.type !== AttachmentType.NONE ? this.attachmentData : null
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
