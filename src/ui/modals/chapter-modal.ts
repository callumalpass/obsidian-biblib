import { App, Modal, Notice, Setting, TFile, ButtonComponent } from 'obsidian'; // Added ButtonComponent
import { BibliographyPluginSettings } from '../../types/settings';
import { Contributor, AdditionalField, Citation, AttachmentData, AttachmentType } from '../../types/citation';
import { ContributorField } from '../components/contributor-field';
import { AdditionalFieldComponent } from '../components/additional-field';
import { CitekeyGenerator } from '../../utils/citekey-generator';
import { FileManager } from '../../services/file-manager';

// Define type for book entries used in this modal
// Ensures consistency with FileManager return types
type BookEntry = { id: string; title: string; path: string; frontmatter: any };

export class ChapterModal extends Modal {
    // Services
    private fileManager: FileManager;
    
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
        this.fileManager = new FileManager(app, settings);
        this.initialBookPath = initialBookPath;
    }

    // Load initial book data if path provided
    private async loadInitialBook() {
         if (this.initialBookPath) {
             // FetchBook returns BookEntry or null (now includes path)
            const book = await this.fileManager.getBookEntryByPath(this.initialBookPath);
            if (book) {
                this.selectedBook = book; // Assign fetched book (type matches)
                // Only apply the book data after UI elements are created
                if (this.bookDropdown) {
                    this.bookDropdown.value = book.path; // Set dropdown value using path
                    this.populateFromBook(book); // Populate fields
                    this.bookPathDisplay.textContent = `Selected book path: ${book.path}`;
                    this.bookPathDisplay.style.display = 'block'; // Ensure visible
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
        this.bookEntries = await this.fileManager.getBookEntries(); // Returns BookEntry[]
        
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
                text.setPlaceholder('e.g., authorYEARchapter').onChange(value => {
                     // Potential validation
                });
            });

        // Title input (required)
        new Setting(contentEl)
            .setName('Chapter Title')
            .addText(text => {
                this.titleInput = text.inputEl;
                text.setPlaceholder('Enter Chapter Title').onChange(value => {
                    // Auto-generate a citekey if the title is provided and citekey is empty
                    if (value.trim() && !this.idInput.value.trim() && this.selectedBook) {
                        const baseCitation = { 
                            title: value.trim(),
                            year: this.yearInput?.value.trim() || this.selectedBook?.frontmatter?.year?.toString() || '',
                            author: this.contributors
                                .filter(c => c.role === 'author')
                                .map(c => ({ given: c.given, family: c.family }))
                        };
                        // Suggest a key combining book and chapter info
                        const generatedKey = CitekeyGenerator.generate(baseCitation);
                        // Sanitize combined key (remove unsafe characters)
                        const suggestedKey = `${this.selectedBook.id}_${generatedKey}`.replace(/[^a-zA-Z0-9_\-]+/g, '_'); 
                        this.idInput.value = suggestedKey;
                        this.idInput.dispatchEvent(new Event('input'));
                        new Notice(`Generated citekey: ${suggestedKey}`, 3000);
                    }
                });
            });

        // Title-Short input (optional)
        new Setting(contentEl)
            .setName('Short Title')
            .addText(text => {
                this.titleShortInput = text.inputEl;
                text.setPlaceholder('Enter Short Title (optional)').onChange(value => {});
            });

        // Page input
        new Setting(contentEl)
            .setName('Page Range')
            .addText(text => {
                this.pageInput = text.inputEl;
                text.setPlaceholder('e.g., 45-67').onChange(value => {});
            });

        // --- Container Book Selection --- 
        new Setting(contentEl).setName('Container Book').setHeading();

        const bookSetting = new Setting(contentEl)
            // .setName('Container Book') Name moved to heading
            .setDesc('Select the book that contains this chapter');
            
        // Add the dropdown
        bookSetting.addDropdown(dropdown => {
            this.bookDropdown = dropdown.selectEl;
            dropdown.addOption('', 'Select a Book...'); // Empty default option
            
            this.bookEntries.forEach(book => {
                // Use book path as value, title as display text
                dropdown.addOption(book.path, `${book.title} (${book.id})`);
            });
            
            // Set initial value if a book is already selected (e.g., from constructor)
            if (this.selectedBook) {
                dropdown.setValue(this.selectedBook.path);
            }
            
            dropdown.onChange(async (selectedPath) => {
                if (selectedPath) {
                    // Find the full book entry based on the selected path
                    const book = this.bookEntries.find(b => b.path === selectedPath);
                    if (book) {
                        this.selectedBook = book; // Type is correct (BookEntry)
                        this.populateFromBook(book); // Pass correct type
                        this.bookPathDisplay.textContent = `Selected book path: ${selectedPath}`;
                        this.bookPathDisplay.style.display = 'block'; // Show the path display
                    } else {
                         console.warn('Selected book path not found in loaded entries:', selectedPath);
                         this.selectedBook = null; 
                         this.bookPathDisplay.textContent = 'Error: Could not load selected book.';
                         this.bookPathDisplay.style.display = 'block';
                    }
                } else {
                    this.selectedBook = null;
                     // TODO: Consider clearing fields populated by the previous book
                     // this.clearBookPopulatedFields(); 
                    this.bookPathDisplay.textContent = 'No book selected';
                    this.bookPathDisplay.style.display = 'none'; // Hide path display
                }
            });
        });
        
        // Add a display area for the selected book path (initially hidden)
        this.bookPathDisplay = contentEl.createDiv({ cls: 'bibliography-book-path setting-item-description' });
        this.bookPathDisplay.style.display = this.selectedBook ? 'block' : 'none'; 
        this.bookPathDisplay.textContent = this.selectedBook ? `Selected book path: ${this.selectedBook.path}` : '';

        // --- Chapter Contributors ---
        new Setting(contentEl).setName('Chapter Contributors').setHeading();
        // Container for contributor fields
        const contributorsContainer = contentEl.createDiv({ cls: 'bibliography-contributors-container' });
        this.contributorsListContainer = contributorsContainer.createDiv({ cls: 'bibliography-contributors-list' });
        // Add Contributor button (uses Obsidian Setting for consistent styling)
        // Add Contributor button
        new Setting(contributorsContainer)
            .addButton(button => {
                button.setButtonText('Add Contributor')
                    .onClick(() => {
                        this.addContributor('author', '', '');
                    });
            });

        // Add initial contributor field if none populated from book
        if (this.contributors.length === 0) {
            this.addContributor('author', '', '');
        }

        // --- Publication Details (Chapter Specific) --- 
         new Setting(contentEl).setName('Chapter Publication Details').setHeading();

        // Year (may differ from book year)
        new Setting(contentEl)
            .setName('Year')
            .addText(text => {
                this.yearInput = text.inputEl;
                text.setPlaceholder('Enter Year (if differs from book)').onChange(value => {});
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
                dropdown.onChange(value => {});
            });

        new Setting(contentEl)
            .setName('Day')
            .addText(text => {
                this.dayInput = text.inputEl;
                text.setPlaceholder('Enter Day (optional)').onChange(value => {});
            });
            
        // DOI (Chapter specific DOI, if exists)
        new Setting(contentEl)
            .setName('DOI')
            .setDesc('Chapter-specific DOI, if available')
            .addText(text => {
                this.doiInput = text.inputEl;
                text.setPlaceholder('Enter DOI (optional)').onChange(value => {});
            });

        // Abstract
        new Setting(contentEl)
            .setName('Abstract')
            .addTextArea(text => {
                this.abstractInput = text.inputEl;
                text.setPlaceholder('Enter Abstract (optional)').onChange(value => {});
            });

        // --- Attachment --- 
        new Setting(contentEl).setName('Attachment').setHeading();
        const attachmentSection = new Setting(contentEl)
            // .setName('Attachment') // Name moved to heading
            .setDesc('Handle attachment (optional)');
        
       // Create import button setting (hidden initially)
        const importSetting = new Setting(contentEl)
            .setName('Select File to Import')
            .addButton(button => {
                // Store the ButtonComponent instance
                this.importButtonComponent = button; 
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
                            // Use || '' fallback for potentially undefined filename
                            button.setButtonText(this.attachmentData.filename || 'Choose File'); 
                            this.filePathDisplay.textContent = `Selected for import: ${this.attachmentData.filename || ''}`;
                            this.filePathDisplay.style.display = 'block';
                        }
                    };
                    fileInput.click();
                });
            });
        this.importSettingEl = importSetting.settingEl; // Store setting element
            
        // Create link button setting (hidden initially)
        const linkSetting = new Setting(contentEl)
            .setName('Link to Existing File')
            .addButton(button => {
                // Store the ButtonComponent instance
                this.linkButtonComponent = button; 
                button.setButtonText('Select File Path').onClick(async () => {
                    // Suggest book's attachment first if available
                    let suggestedPath = '';
                    if (this.selectedBook?.frontmatter?.attachment) {
                         const bookAttachmentLink = this.selectedBook.frontmatter.attachment[0];
                         // Regex to extract path from [[path]] or [[path|alias]]
                         const matches = bookAttachmentLink?.match(/\[\[(.*?)(?:\|.*?)?\]\]/);
                         if (matches && matches[1]) {
                             suggestedPath = matches[1];
                         }
                    }

                    // Create a temporary modal to get the file path
                    const linkModal = new Modal(this.app);
                    linkModal.contentEl.addClass('bibliography-link-modal');
                    linkModal.titleEl.textContent = 'Enter Path to File';

                    const form = linkModal.contentEl.createDiv();
                    const filePathInput = form.createEl('input', { 
                        type: 'text', 
                        placeholder: 'Enter file path in vault'
                    });
                    filePathInput.addClass('link-path-input'); // Use CSS class
                    if (suggestedPath) {
                        filePathInput.value = suggestedPath;
                        const suggestionEl = form.createDiv({ cls: 'setting-item-description' });
                        suggestionEl.textContent = `Suggested path from book: ${suggestedPath}`;
                    }
                    
                    const buttonContainer = linkModal.contentEl.createDiv();
                    buttonContainer.addClass('link-button-container'); // Use CSS class
                    
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
                             // Use || '' fallback for potentially undefined filename
                             // Use the stored ButtonComponent instance
                            this.linkButtonComponent?.setButtonText(this.attachmentData.filename || 'Select File Path'); 
                            this.filePathDisplay.textContent = `Linked to: ${filePath}`;
                             this.filePathDisplay.style.display = 'block';
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
         this.linkSettingEl = linkSetting.settingEl; // Store setting element
            
        // Add dropdown for attachment type
        attachmentSection.addDropdown(dropdown => {
            this.attachmentTypeSelect = dropdown.selectEl;
            dropdown.addOptions({
                'none': 'No Attachment',
                'import': 'Import File (Copy to biblib folder)',
                'link': 'Link to Existing File'
            });
            dropdown.onChange(value => {
                this.attachmentData.type = value as AttachmentType;
                this.attachmentData.file = undefined;
                this.attachmentData.path = undefined;

                // Show/hide appropriate setting element
                this.importSettingEl.style.display = (value === 'import') ? '' : 'none';
                this.linkSettingEl.style.display = (value === 'link') ? '' : 'none';
                
                // Reset button texts and file path display using stored components
                this.importButtonComponent?.setButtonText('Choose File'); 
                this.linkButtonComponent?.setButtonText('Select File Path');
                this.filePathDisplay.textContent = 'No file selected';
                this.filePathDisplay.style.display = (value === 'none') ? 'none' : 'block';
            });
        });
        
        // Display area for showing the selected/linked file path
        this.filePathDisplay = contentEl.createDiv({ cls: 'bibliography-file-path setting-item-description' });
        this.filePathDisplay.style.display = 'none'; // Initially hidden
        
         // Add the hidden settings elements to the DOM *after* the dropdown setting
        attachmentSection.settingEl.insertAdjacentElement('afterend', this.linkSettingEl);
        attachmentSection.settingEl.insertAdjacentElement('afterend', this.importSettingEl);
         // Initially hide them
         this.importSettingEl.style.display = 'none';
         this.linkSettingEl.style.display = 'none';


        // --- Additional CSL fields section --- 
        new Setting(contentEl).setName('Additional Fields').setHeading();
        this.additionalFieldsContainer = contentEl.createDiv();

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
            text: 'Create Chapter Note', 
            cls: 'mod-cta create-button' 
        });
        submitButton.onclick = async () => {
            const citation = this.getFormValues();
            if (!this.validateForm(citation)) {
                return;
            }
            submitButton.disabled = true;
            submitButton.textContent = 'Creating...';
            await this.handleSubmit(citation);
            // Button state handled in handleSubmit
        };
    }
    
    /**
     * Add a contributor UI component
     */
    private addContributor(role: string = 'author', given: string = '', family: string = ''): ContributorField | null {
        const contributor: Contributor = { role, given, family };
        // Allow multiple blank contributor entries; only prevent duplicates when both given and family are non-empty
        const isDuplicate = this.contributors.some(c => c.role === role && c.given === given && c.family === family);
        if ((given || family) && isDuplicate) {
            // Only block duplicates for entries where user has filled in a name
            return null;
        }
        this.contributors.push(contributor);
        
       return new ContributorField(
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
    private addAdditionalField(type: AdditionalField['type'] = 'standard', name: string = '', value: any = ''): AdditionalFieldComponent | null {
        // Avoid adding duplicate fields by name
        const existingFieldIndex = this.additionalFields.findIndex(f => f.name === name);
        let field: AdditionalField;

        if (existingFieldIndex === -1) {
             field = { type, name, value };
             this.additionalFields.push(field);
        } else {
             // Update existing field value and type
             this.additionalFields[existingFieldIndex].value = value;
             this.additionalFields[existingFieldIndex].type = type;
             // Don't add a new UI component if one already exists for this field name
             console.warn(`Field ${name} already exists. Updating value.`);
             // Find and update existing component if possible (requires storing component refs)
             // TODO: Implement component update if needed, instead of just returning null
             return null; 
        }

        return new AdditionalFieldComponent(
            this.additionalFieldsContainer,
            field,
            (fieldToRemove) => {
                this.additionalFields = this.additionalFields.filter(f => f !== fieldToRemove);
            }
        );
    }
    
    /**
     * Populate form fields based on the selected container book
     */
    private populateFromBook(book: BookEntry): void { // Use BookEntry type
        // --- Clear previous book-related fields --- 
        const bookRelatedFieldNames = new Set([
            'container-title', 'container-title-short', 'collection-title', 
            'collection-number', 'publisher', 'publisher-place', 'ISBN'
        ]);
        const bookRelatedContributorRoles = new Set(['editor', 'container-author']);

        this.additionalFields = this.additionalFields.filter(field => !bookRelatedFieldNames.has(field.name));
        this.contributors = this.contributors.filter(c => !bookRelatedContributorRoles.has(c.role)); 

        // --- Re-render fields/contributors --- 
        this.additionalFieldsContainer.empty(); 
        this.additionalFields.forEach(f => this.addAdditionalField(f.type, f.name, f.value));
        this.contributorsListContainer.empty();
        this.contributors.forEach(c => this.addContributor(c.role, c.given, c.family));
        // Ensure at least one author field exists for the chapter if none remain
        if (!this.contributors.some(c => c.role === 'author')) {
             this.addContributor('author', '', '');
        }

        // --- Populate fields from book --- 
        this.addAdditionalField('standard', 'container-title', book.title);
        if (book.frontmatter['title-short']) {
            this.addAdditionalField('standard', 'container-title-short', book.frontmatter['title-short']);
        }
        if (book.frontmatter['collection-title']) {
            this.addAdditionalField('standard', 'collection-title', book.frontmatter['collection-title']);
        }
        if (book.frontmatter['collection-number']) {
            this.addAdditionalField('number', 'collection-number', book.frontmatter['collection-number']);
        }
        if (book.frontmatter.publisher) {
            this.addAdditionalField('standard', 'publisher', book.frontmatter.publisher);
        }
        if (book.frontmatter['publisher-place']) {
            this.addAdditionalField('standard', 'publisher-place', book.frontmatter['publisher-place']);
        }
        if (book.frontmatter.ISBN) {
            this.addAdditionalField('standard', 'ISBN', book.frontmatter.ISBN);
        }
        
        // Set year/date info only if chapter fields are empty
        if (!this.yearInput.value && book.frontmatter.year) {
            this.yearInput.value = book.frontmatter.year.toString();
            this.yearInput.dispatchEvent(new Event('input'));
        }
        if (this.monthDropdown.value === '0' && book.frontmatter.issued?.['date-parts']?.[0]?.[1]) {
             this.monthDropdown.value = book.frontmatter.issued['date-parts'][0][1].toString();
             this.monthDropdown.dispatchEvent(new Event('change'));
        }
         if (!this.dayInput.value && book.frontmatter.issued?.['date-parts']?.[0]?.[2]) {
             this.dayInput.value = book.frontmatter.issued['date-parts'][0][2].toString();
             this.dayInput.dispatchEvent(new Event('input'));
        }

        // Add book editors as chapter editors (CSL 'editor')
        let foundEditors = false;
        const processEditor = (editor: any) => {
             if (editor && typeof editor === 'object') {
                 if (editor.literal) {
                     // Add contributor returns null if duplicate, which is fine
                      this.addContributor('editor', '', editor.literal);
                      foundEditors = true;
                 } else if (editor.family || editor.given) { // Check if either part exists
                     // Add contributor returns null if duplicate
                     this.addContributor('editor', editor.given || '', editor.family || '');
                     foundEditors = true;
                 }
             }
        };

        const editorRolesToCheck = ['editor', 'collection-editor', 'container-author'];
        editorRolesToCheck.forEach(role => {
             if (book.frontmatter[role] && Array.isArray(book.frontmatter[role])) {
                 book.frontmatter[role].forEach(processEditor);
             }
        });

        if (foundEditors) {
            new Notice('Populated editors from container book.', 3000);
        }
        
        // Offer to use book's attachment
        if (book.frontmatter.attachment && Array.isArray(book.frontmatter.attachment) && book.frontmatter.attachment.length > 0) {
            const attachmentLink = book.frontmatter.attachment[0]; 
            const matches = attachmentLink.match(/\[\[(.*?)(?:\|.*?)?\]\]/);
            
            if (matches && matches[1]) {
                const filePath = matches[1];
                // Set the select dropdown to "link" option
                this.attachmentTypeSelect.value = 'link';
                this.attachmentTypeSelect.dispatchEvent(new Event('change')); // Trigger onChange to show correct button
                
                // Setup the attachment data
                this.attachmentData = {
                    type: AttachmentType.LINK,
                    path: filePath,
                    filename: filePath.split('/').pop() || filePath
                };
                
                // Update the link button text and file path display
                // Use stored ButtonComponent instance
                this.linkButtonComponent?.setButtonText(this.attachmentData.filename || 'Select File Path');
                this.filePathDisplay.textContent = `Linked to: ${filePath}`;
                this.filePathDisplay.style.display = 'block';
                new Notice(`Pre-filled attachment link from book: ${filePath}`, 3000);
            }
        }
    }
    
    /**
     * Get all form values as a Citation object (ready for FileManager)
     */
    private getFormValues(): Citation {
        const citation: Citation = {
            // Required fields
            id: this.idInput.value.trim(),
            type: 'chapter', // Fixed type for this modal
            title: this.titleInput.value.trim(),
            year: this.yearInput.value.trim(), // Required by validation
            // Optional chapter-specific fields
            'title-short': this.titleShortInput.value.trim() || undefined,
            page: this.pageInput.value.trim() || undefined,
            abstract: this.abstractInput.value.trim() || undefined,
            month: this.monthDropdown.value !== '0' ? this.monthDropdown.value : undefined,
            day: this.dayInput.value.trim() || undefined,
            DOI: this.doiInput.value.trim() || undefined,
             // Container info (conditionally added)
            'container-title': this.selectedBook?.title || undefined, 
            // Inherit tags from container book, excluding the literature note tag
            tags: this.selectedBook?.frontmatter?.tags && Array.isArray(this.selectedBook.frontmatter.tags)
                ? [...new Set(
                    this.selectedBook.frontmatter.tags
                        .filter((tag: string) => tag !== this.settings.literatureNoteTag)
                )]
                : []
        };
        
        // Ensure container-title is present if a book is selected
        if (!citation['container-title'] && this.selectedBook) {
            citation['container-title'] = this.selectedBook.title; // Fallback
        }
        
        return citation;
    }
    
    /**
     * Validate the form before submission
     */
    private validateForm(citation: Citation): boolean {
        let isValid = true;
        let message = '';

        // Helper to add/remove invalid class
        const validateField = (inputEl: HTMLElement | null, condition: boolean, errorMsg: string): boolean => {
            if (!inputEl) return true; // Skip if element doesn't exist, assume valid
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
        validateField(this.titleInput, !!citation.title, 'Chapter Title is required.');
        validateField(this.bookDropdown, !!this.selectedBook, 'Container book selection is required.');

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
         // Combine chapter contributors and additional fields with book info
         const finalContributors = [...this.contributors];
         const finalAdditionalFields = [...this.additionalFields];

         // Add book editors (handled by populateFromBook adding them with role 'editor')
         // Add book-level fields from additionalFields (already added by populateFromBook)

        try {
            await this.fileManager.createLiteratureNote(
                citation,
                finalContributors,
                finalAdditionalFields,
                this.attachmentData.type !== AttachmentType.NONE ? this.attachmentData : null
            );
            this.close(); // Close modal on success
        } catch (error) { 
            // Error notice shown by FileManager
            console.error('Error creating chapter note:', error);
            // Re-enable the submit button
             const submitButton = this.contentEl.querySelector('.create-button') as HTMLButtonElement | null;
             if (submitButton) {
                 submitButton.disabled = false;
                 submitButton.textContent = 'Create Chapter Note';
             }
        }
    }

    onClose() {
        const { contentEl } = this;
        // Clean up DOM elements
        contentEl.empty();
    }
}
