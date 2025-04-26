import { App, Modal, Setting, Notice, normalizePath } from 'obsidian';
import { BibliographyPluginSettings } from '../../types/settings';
import { FileManager } from '../../services/file-manager';

/**
 * Modal for configuring and initiating a bulk import operation
 */
export class BulkImportModal extends Modal {
    private settings: BibliographyPluginSettings;
    private fileManager: FileManager;
    private selectedFile: File | null = null;
    private selectedFileName: string = '';

    // Current state for settings within this modal
    private importSettings: {
        attachmentHandling: 'none' | 'import';
        annoteToBody: boolean;
        citekeyPreference: 'imported' | 'generate';
        conflictResolution: 'skip' | 'overwrite';
    };

    constructor(app: App, settings: BibliographyPluginSettings) {
        super(app);
        this.settings = settings;
        this.fileManager = new FileManager(app, settings);
        
        // Initialize import settings from plugin settings
        this.importSettings = {
            attachmentHandling: settings.bulkImportAttachmentHandling,
            annoteToBody: settings.bulkImportAnnoteToBody,
            citekeyPreference: settings.bulkImportCitekeyPreference,
            conflictResolution: settings.bulkImportConflictResolution
        };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('bibliography-bulk-import-modal');

        // Modal title
        contentEl.createEl('h2', { text: 'Bulk Import References' });

        // Warning message
        const warningEl = contentEl.createDiv({ cls: 'bulk-import-warning' });
        warningEl.createEl('p', { text: 'Warning: This operation may create or overwrite many files. Consider backing up your vault first.' });
        warningEl.createEl('p', { 
            text: 'Tip: For Zotero exports, use the native BibTeX export format (not Better BibTeX) to include PDFs and annotations.'
        });

        // File selection
        new Setting(contentEl)
            .setName('Import file')
            .setDesc('Select a BibTeX (.bib) or CSL-JSON (.json) file to import')
            .addButton(button => button
                .setButtonText('Choose File')
                .onClick(() => {
                    // Create and trigger an input element to select a file
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.bib,.json';
                    input.multiple = false;
                    
                    input.onchange = async (event) => {
                        // @ts-ignore - files exists on target
                        const file = event.target.files[0];
                        if (file) {
                            this.selectedFile = file;
                            this.selectedFileName = file.name;
                            
                            // Update the UI to show the selected file
                            const fileInfoEl = contentEl.querySelector('.file-info');
                            if (fileInfoEl) {
                                fileInfoEl.textContent = `Selected: ${this.selectedFileName}`;
                                fileInfoEl.addClass('has-file');
                            }
                        }
                    };
                    
                    input.click();
                })
            );

        // File info display
        const fileInfoEl = contentEl.createDiv({ cls: 'file-info', text: 'No file selected' });

        // Import settings
        contentEl.createEl('h3', { text: 'Import Settings' });

        // Attachment handling
        new Setting(contentEl)
            .setName('Attachment handling')
            .setDesc('Choose how to handle attachments referenced in the import file')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    'none': 'Ignore attachments',
                    'import': 'Import attachments to vault'
                })
                .setValue(this.importSettings.attachmentHandling)
                .onChange(value => {
                    this.importSettings.attachmentHandling = value as 'none' | 'import';
                })
            );

        // Annotations/Notes
        new Setting(contentEl)
            .setName('Include annotations')
            .setDesc('Include content from BibTeX "annote" field in the body of literature notes')
            .addToggle(toggle => toggle
                .setValue(this.importSettings.annoteToBody)
                .onChange(value => {
                    this.importSettings.annoteToBody = value;
                })
            );

        // Citekey preference
        new Setting(contentEl)
            .setName('Citekey preference')
            .setDesc('Choose whether to use citekeys from the import file or generate new ones')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    'imported': 'Use imported citekeys',
                    'generate': 'Generate new citekeys'
                })
                .setValue(this.importSettings.citekeyPreference)
                .onChange(value => {
                    this.importSettings.citekeyPreference = value as 'imported' | 'generate';
                })
            );

        // Conflict resolution
        new Setting(contentEl)
            .setName('Conflict resolution')
            .setDesc('What to do when a literature note with the same citekey already exists')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    'skip': 'Skip existing notes',
                    'overwrite': 'Overwrite existing notes'
                })
                .setValue(this.importSettings.conflictResolution)
                .onChange(value => {
                    this.importSettings.conflictResolution = value as 'skip' | 'overwrite';
                })
            );

        // Import button
        const importButtonContainer = contentEl.createDiv({ cls: 'import-button-container' });
        const importButton = importButtonContainer.createEl('button', {
            text: 'Start Import',
            cls: 'mod-cta'
        });
        
        importButton.onclick = async () => {
            if (!this.selectedFile) {
                new Notice('Please select a file to import');
                return;
            }
            
            // Confirm before proceeding
            if (!confirm('Are you sure you want to proceed with the bulk import? This operation may create multiple files in your vault.')) {
                return;
            }
            
            // Disable the button during import
            importButton.disabled = true;
            importButton.textContent = 'Importing...';
            
            try {
                // Save current settings back to plugin settings
                this.settings.bulkImportAttachmentHandling = this.importSettings.attachmentHandling;
                this.settings.bulkImportAnnoteToBody = this.importSettings.annoteToBody;
                this.settings.bulkImportCitekeyPreference = this.importSettings.citekeyPreference;
                this.settings.bulkImportConflictResolution = this.importSettings.conflictResolution;
                
                // Read the file content
                const fileContent = await this.readFileContent(this.selectedFile);
                const fileExt = this.selectedFileName.split('.').pop()?.toLowerCase();
                
                // Start the import process
                await this.fileManager.importReferencesFromContent(
                    fileContent, 
                    fileExt || '', 
                    this.selectedFileName,
                    this.importSettings
                );
                
                // Close the modal after successful import
                this.close();
            } catch (error) {
                console.error('Bulk import failed:', error);
                new Notice(`Import failed: ${error.message || 'Unknown error'}`);
                
                // Re-enable the button
                importButton.disabled = false;
                importButton.textContent = 'Start Import';
            }
        };
    }

    /**
     * Read file content as text
     * @param file The file to read
     * @returns The file content as a string
     */
    private readFileContent(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                } else if (reader.result instanceof ArrayBuffer) {
                    // Convert ArrayBuffer to string if needed
                    const decoder = new TextDecoder('utf-8');
                    resolve(decoder.decode(reader.result));
                } else {
                    reject(new Error("Failed to read file content"));
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}