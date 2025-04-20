import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { BibliographyPluginSettings } from '../../types/settings';
import { Contributor, AdditionalField, Citation, AttachmentData, AttachmentType } from '../../types/citation';
import { ContributorField } from '../components/contributor-field';
import { AdditionalFieldComponent } from '../components/additional-field';
import { CitekeyGenerator } from '../../utils/citekey-generator';
import { FileManager } from '../../services/file-manager';

export class ChapterModal extends Modal {
    // Services
    private fileManager: FileManager;
    
    // Data state
    private additionalFields: AdditionalField[] = [];
    private contributors: Contributor[] = [];
    private bookEntries: {id: string, title: string, path: string, frontmatter: any}[] = [];
    private selectedBook: {id: string, title: string, frontmatter: any} | null = null;
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
    
    // Attachment elements
    private attachmentTypeSelect: HTMLSelectElement;
    private filePathDisplay: HTMLElement;

    constructor(app: App, private settings: BibliographyPluginSettings, initialBookPath?: string) {
        super(app);
        this.fileManager = new FileManager(app, settings);
        
        // If initialBookPath is provided, try to load that book
        if (initialBookPath) {
            this.loadBook(initialBookPath);
        }
    }

    private async loadBook(bookPath: string) {
        const book = await this.fileManager.getBookEntryByPath(bookPath);
        if (book) {
            this.selectedBook = book;
            console.log('Loaded book:', this.selectedBook);
        }
    }
    
    async onOpen() {
        console.log('ChapterModal opened');
        const { contentEl } = this;
        contentEl.addClass('bibliography-modal');

        // Modal title
        contentEl.createEl('h2', { text: 'Create Book Chapter Entry' });
        
        // Load book entries
        this.bookEntries = await this.fileManager.getBookEntries();
        console.log(`Found ${this.bookEntries.length} book entries`);
        
        // Add section title
        contentEl.createEl('h3', { text: 'Chapter Details' });
        
        // Create the main form
        this.createMainForm(contentEl);
    }
    
    private createMainForm(contentEl: HTMLElement) {
        // Citekey input (required)
        new Setting(contentEl)
            .setName('Citekey')
            .setDesc('Unique identifier for this chapter')
            .addText(text => {
                this.idInput = text.inputEl;
                text.setPlaceholder('Enter Citekey').onChange(value => {
                    console.log(`Citekey set to: ${value.trim()}`);
                });
            });

        // Title input (required)
        new Setting(contentEl)
            .setName('Chapter Title')
            .addText(text => {
                this.titleInput = text.inputEl;
                text.setPlaceholder('Enter Chapter Title').onChange(value => {
                    console.log(`Title set to: ${value.trim()}`);
                    
                    // Auto-generate a citekey if the title is provided and citekey is empty
                    if (value.trim() && !this.idInput.value.trim()) {
                        const baseCitation = { 
                            title: value.trim(),
                            year: this.yearInput ? this.yearInput.value.trim() : '',
                            author: this.contributors
                                .filter(c => c.role === 'author')
                                .map(c => ({ given: c.given, family: c.family }))
                        };
                        const citekey = CitekeyGenerator.generate(baseCitation);
                        this.idInput.value = citekey;
                        this.idInput.dispatchEvent(new Event('input'));
                    }
                });
            });

        // Title-Short input (optional)
        new Setting(contentEl)
            .setName('Short Title')
            .addText(text => {
                this.titleShortInput = text.inputEl;
                text.setPlaceholder('Enter Short Title').onChange(value => {
                    console.log(`Title-Short set to: ${value.trim()}`);
                });
            });

        // Page input
        new Setting(contentEl)
            .setName('Page Range')
            .addText(text => {
                this.pageInput = text.inputEl;
                text.setPlaceholder('Enter Page Range (e.g., 45-67)').onChange(value => {
                    console.log(`Page set to: ${value.trim()}`);
                });
            });

        // Container Book dropdown
        const bookSetting = new Setting(contentEl)
            .setName('Container Book')
            .setDesc('Select the book that contains this chapter');
            
        // Add the dropdown
        bookSetting.addDropdown(dropdown => {
            this.bookDropdown = dropdown.selectEl;
            
            // Add empty option
            dropdown.addOption('', 'Select a Book...');
            
            // Add options for each book
            this.bookEntries.forEach(book => {
                dropdown.addOption(book.path, book.title);
            });
            
            // Set initial value if book is already selected
            if (this.selectedBook) {
                const bookPath = this.bookEntries.find(b => b.id === this.selectedBook.id)?.path;
                if (bookPath) {
                    dropdown.setValue(bookPath);
                }
            }
            
            dropdown.onChange(async (value) => {
                if (value) {
                    const book = await this.fileManager.getBookEntryByPath(value);
                    if (book) {
                        this.selectedBook = book;
                        this.populateFromBook(book);
                        this.bookPathDisplay.textContent = value;
                        console.log(`Selected book: ${book.title}`);
                    }
                } else {
                    this.selectedBook = null;
                    this.bookPathDisplay.textContent = 'No book selected';
                }
            });
        });
        
        // Add a display for the book path
        this.bookPathDisplay = contentEl.createEl('div', { 
            cls: 'bibliography-book-path',
            text: this.selectedBook ? this.selectedBook.frontmatter.path : 'No book selected'
        });

        // Contributors section
        new Setting(contentEl).setName('Chapter Contributors');
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

        // Date of Publication
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
            });

        new Setting(contentEl)
            .setName('Day')
            .addText(text => {
                this.dayInput = text.inputEl;
                text.setPlaceholder('Enter Day (optional)').onChange(value => {
                    console.log(`Day set to: ${value.trim()}`);
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
        
        // Create import button setting
        const importSetting = new Setting(contentEl)
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
                            this.filePathDisplay.textContent = fileInput.files[0].name;
                        }
                    };
                    fileInput.click();
                });
            });
            
        // Create link button setting
        const linkSetting = new Setting(contentEl)
            .setName('Link to Existing File')
            .addButton(button => {
                button.setButtonText('Select File Path').onClick(async () => {
                    // If a book is selected and has an attachment, offer to use that
                    if (this.selectedBook && this.selectedBook.frontmatter.attachment) {
                        const path = this.selectedBook.frontmatter.attachment[0];
                        if (path) {
                            // Extract the actual path from the wiki link format [[path|text]]
                            const matches = path.match(/\[\[(.*?)(?:\|.*?)?\]\]/);
                            if (matches && matches[1]) {
                                const filePath = matches[1];
                                this.attachmentData = {
                                    type: AttachmentType.LINK,
                                    path: filePath,
                                    filename: filePath.split('/').pop() || filePath
                                };
                                button.setButtonText(filePath.split('/').pop() || filePath);
                                this.filePathDisplay.textContent = filePath;
                                return;
                            }
                        }
                    }
                    
                    // Otherwise let the user pick a file from the vault
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
                            this.filePathDisplay.textContent = filePath;
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
            
        // Initially remove both settings from DOM
        importSetting.settingEl.detach();
        linkSetting.settingEl.detach();
        
        // Add dropdown for attachment type
        attachmentSection.addDropdown(dropdown => {
            this.attachmentTypeSelect = dropdown.selectEl;
            dropdown.addOptions({
                'none': 'No Attachment',
                'import': 'Import File (Copy to biblib folder)',
                'link': 'Link to Existing File'
            });
            dropdown.onChange(value => {
                // Update attachment data type
                this.attachmentData.type = value as AttachmentType;
                
                // Clear previous settings
                importSetting.settingEl.detach();
                linkSetting.settingEl.detach();
                
                // Add appropriate setting based on selection
                if (value === 'import') {
                    attachmentSection.settingEl.insertAdjacentElement('afterend', importSetting.settingEl);
                } else if (value === 'link') {
                    attachmentSection.settingEl.insertAdjacentElement('afterend', linkSetting.settingEl);
                }
            });
        });
        
        // Display for showing the selected file
        this.filePathDisplay = contentEl.createEl('div', {
            cls: 'bibliography-file-path',
            text: 'No file selected'
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
            text: 'Create Chapter Note', 
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
     * Populate form fields from the selected book
     */
    private populateFromBook(book: {id: string, title: string, frontmatter: any}): void {
        // Clear any existing container fields
        this.additionalFields = this.additionalFields.filter(field => 
            !['container-title', 'container-title-short', 'collection-title', 'collection-number'].includes(field.name)
        );
        
        // Set container-title from book title
        this.addAdditionalField('standard', 'container-title', book.title);
        
        // Add container-title-short if available
        if (book.frontmatter['title-short']) {
            this.addAdditionalField('standard', 'container-title-short', book.frontmatter['title-short']);
        }
        
        // Add series info if available
        if (book.frontmatter['collection-title']) {
            this.addAdditionalField('standard', 'collection-title', book.frontmatter['collection-title']);
        }
        if (book.frontmatter['collection-number']) {
            this.addAdditionalField('number', 'collection-number', book.frontmatter['collection-number']);
        }
        
        // Set publisher info if it exists in the book
        if (book.frontmatter.publisher) {
            this.additionalFields = this.additionalFields.filter(f => f.name === 'publisher');
            this.addAdditionalField('standard', 'publisher', book.frontmatter.publisher);
        }
        
        if (book.frontmatter['publisher-place']) {
            this.additionalFields = this.additionalFields.filter(f => f.name === 'publisher-place');
            this.addAdditionalField('standard', 'publisher-place', book.frontmatter['publisher-place']);
        }
        
        // Add ISBN if available
        if (book.frontmatter.ISBN) {
            this.additionalFields = this.additionalFields.filter(f => f.name === 'ISBN');
            this.addAdditionalField('standard', 'ISBN', book.frontmatter.ISBN);
        }
        
        // Add book-specific identifiers if needed
        if (book.frontmatter.DOI && !this.doiInput.value) {
            this.doiInput.value = book.frontmatter.DOI;
            this.doiInput.dispatchEvent(new Event('input'));
        }
        
        // Set year/date info if not already set
        if (!this.yearInput.value && book.frontmatter.year) {
            this.yearInput.value = book.frontmatter.year.toString();
            this.yearInput.dispatchEvent(new Event('input'));
        }
        
        // Add editors as container-authors if they exist
        let foundEditors = false;
        
        // Remove existing container-authors
        this.contributors = this.contributors.filter(c => c.role !== 'container-author');
        
        // Try different editor field formats that might exist in the frontmatter
        if (book.frontmatter.editor && Array.isArray(book.frontmatter.editor)) {
            // Standard editor format
            book.frontmatter.editor.forEach((editor: any) => {
                if (editor.family) {
                    this.addContributor('editor', editor.given || '', editor.family);
                    foundEditors = true;
                }
            });
        } else if (book.frontmatter.collection_editor && Array.isArray(book.frontmatter.collection_editor)) {
            // Alternative collection editor format
            book.frontmatter.collection_editor.forEach((editor: any) => {
                if (editor.family) {
                    this.addContributor('editor', editor.given || '', editor.family);
                    foundEditors = true;
                }
            });
        }
        
        if (foundEditors) {
            new Notice('Imported editors from container book as editors');
        }
        }
        
        // Offer to use same attachment if available
        if (book.frontmatter.attachment && Array.isArray(book.frontmatter.attachment) && book.frontmatter.attachment.length > 0) {
            const attachmentLink = book.frontmatter.attachment[0];
            const matches = attachmentLink.match(/\[\[(.*?)(?:\|.*?)?\]\]/);
            
            if (matches && matches[1]) {
                const filePath = matches[1];
                // Set the select to "link" option
                this.attachmentTypeSelect.value = 'link';
                this.attachmentTypeSelect.dispatchEvent(new Event('change'));
                
                // Setup the attachment data
                this.attachmentData = {
                    type: AttachmentType.LINK,
                    path: filePath,
                    filename: filePath.split('/').pop() || filePath
                };
                
                // Update the display
                this.filePathDisplay.textContent = filePath;
            }
        }
    }
    
    /**
     * Get all form values as a citation object
     */
    private getFormValues(): Citation {
        const citation: Citation = {
            id: this.idInput.value.trim(),
            type: 'chapter',
            title: this.titleInput.value.trim(),
            'title-short': this.titleShortInput.value.trim() || undefined,
            page: this.pageInput.value.trim() || undefined,
            abstract: this.abstractInput.value.trim() || undefined,
            year: this.yearInput.value.trim(),
            month: this.monthDropdown.value !== '0' ? this.monthDropdown.value : undefined,
            day: this.dayInput.value.trim() || undefined
        };
        
        // Add container title if a book is selected
        if (this.selectedBook) {
            citation['container-title'] = this.selectedBook.title;
        }
        
        return citation;
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
        if (!citation.year) {
            new Notice('Year is required.');
            return false;
        }
        if (!citation['container-title']) {
            new Notice('Container book is required.');
            return false;
        }
        return true;
    }
    
    /**
     * Handle form submission
     */
    private async handleSubmit(citation: Citation): Promise<void> {
        console.log('Handling submit for chapter');
        try {
            await this.fileManager.createLiteratureNote(
                citation,
                this.contributors,
                this.additionalFields,
                this.attachmentData.type !== AttachmentType.NONE ? this.attachmentData : null
            );
            this.close();
        } catch (error) {
            console.error('Error creating chapter note:', error);
            new Notice('Error creating chapter note.');
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        console.log('ChapterModal closed');
    }
}
