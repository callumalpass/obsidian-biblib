import { App, Modal, Notice, Setting } from 'obsidian';
import { BibliographyPluginSettings } from '../../types/settings';
import { Contributor, AdditionalField, AttachmentData, AttachmentType, Citation } from '../../types/citation';
import { ContributorField } from '../components/contributor-field';
import { AdditionalFieldComponent } from '../components/additional-field';
import { FileSuggestModal } from '../components/file-suggest-modal';
import { NoteSuggestModal } from './note-suggest-modal';
import { CitationService } from '../../services/citation-service';
import { NoteCreationService } from '../../services';

/**
 * Abstract base class for bibliography entry modals.
 * Provides shared state management and UI components for contributors,
 * additional fields, attachments, and related notes.
 *
 * Subclasses must implement:
 * - onOpen(): Modal-specific form creation
 * - getFormValues(): Extract citation data from form
 * - validateForm(): Modal-specific validation
 * - handleSubmit(): Modal-specific submission handling
 */
export abstract class BaseBibliographyModal extends Modal {
    // Shared services (protected for subclass access)
    protected citationService: CitationService;
    protected noteCreationService: NoteCreationService;
    protected settings: BibliographyPluginSettings;

    // Shared data state
    protected additionalFields: AdditionalField[] = [];
    protected contributors: Contributor[] = [];
    protected relatedNotePaths: string[] = [];
    protected attachmentData: AttachmentData[] = [];

    // Shared UI element references
    protected attachmentsDisplayEl: HTMLElement;
    protected contributorsListContainer: HTMLDivElement;
    protected additionalFieldsContainer: HTMLDivElement;

    constructor(
        app: App,
        settings: BibliographyPluginSettings,
        citationService: CitationService,
        noteCreationService: NoteCreationService
    ) {
        super(app);
        this.settings = settings;
        this.citationService = citationService;
        this.noteCreationService = noteCreationService;
    }

    // ========================
    // ATTACHMENT METHODS
    // ========================

    /**
     * Handle adding an import attachment (file picker)
     */
    protected addImportAttachment(): void {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '*.*';

        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                this.attachmentData.push({
                    type: AttachmentType.IMPORT,
                    file: file,
                    filename: file.name
                });
                this.updateAttachmentsDisplay();
            }
        });

        fileInput.click();
    }

    /**
     * Handle adding a link attachment (vault file selector)
     */
    protected addLinkAttachment(): void {
        new FileSuggestModal(this.app, (file) => {
            this.attachmentData.push({
                type: AttachmentType.LINK,
                path: file.path
            });
            this.updateAttachmentsDisplay();
        }).open();
    }

    /**
     * Update the attachment list display
     */
    protected updateAttachmentsDisplay(displayEl?: HTMLElement): void {
        const el = displayEl || this.attachmentsDisplayEl;
        if (!el) return;

        el.empty();

        if (this.attachmentData.length === 0) {
            el.createSpan({
                text: 'No attachments',
                cls: 'setting-item-description'
            });
            return;
        }

        const list = el.createEl('ul', { cls: 'bibliography-attachments-list' });
        this.attachmentData.forEach((attachment, index) => {
            const li = list.createEl('li');
            const type = attachment.type === AttachmentType.IMPORT ? 'Import' : 'Link';
            const name = attachment.type === AttachmentType.IMPORT
                ? (attachment.filename || attachment.file?.name || 'Unknown')
                : (attachment.path?.split('/').pop() || 'Unknown');

            li.createSpan({ text: `${type}: ${name}` });
            li.createEl('button', {
                text: '×',
                cls: 'bibliography-remove-attachment-button'
            }).onclick = () => {
                this.attachmentData.splice(index, 1);
                this.updateAttachmentsDisplay(el);
            };
        });
    }

    /**
     * Create the attachment section with Import/Link buttons
     */
    protected createAttachmentButtons(container: HTMLElement): void {
        new Setting(container)
            .setName('Attachments')
            .setDesc('Import a file or link to an existing vault file')
            .addButton(button => {
                button.setButtonText('Import file')
                    .onClick(() => this.addImportAttachment());
            })
            .addButton(button => {
                button.setButtonText('Link file')
                    .onClick(() => this.addLinkAttachment());
            });

        this.attachmentsDisplayEl = container.createDiv({
            cls: 'bibliography-attachments-display'
        });
        this.updateAttachmentsDisplay();
    }

    // ========================
    // CONTRIBUTOR METHODS
    // ========================

    /**
     * Add a contributor field to the UI
     */
    protected addContributorField(
        role: string = 'author',
        family: string = '',
        given: string = '',
        literal: string = ''
    ): Contributor {
        this.contributorsListContainer.addClass('bibliography-contributors');

        const contributor: Contributor = {
            role,
            family: family || undefined,
            given: given || undefined,
            literal: literal || undefined
        };

        this.contributors.push(contributor);

        new ContributorField(
            this.contributorsListContainer,
            contributor,
            (toRemove) => {
                const index = this.contributors.findIndex(c =>
                    c.role === toRemove.role &&
                    c.family === toRemove.family &&
                    c.given === toRemove.given &&
                    c.literal === toRemove.literal
                );
                if (index !== -1) {
                    this.contributors.splice(index, 1);
                }
            }
        );

        return contributor;
    }

    // ========================
    // ADDITIONAL FIELD METHODS
    // ========================

    /**
     * Add an additional field to the UI
     */
    protected addAdditionalField(
        name: string = '',
        value: unknown = '',
        type: string = 'standard'
    ): void {
        this.additionalFieldsContainer.addClass('bibliography-additional-fields');

        const additionalField: AdditionalField = {
            name,
            value,
            type
        };

        new AdditionalFieldComponent(
            this.additionalFieldsContainer,
            additionalField,
            (field) => {
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

        this.additionalFields.push(additionalField);
    }

    // ========================
    // RELATED NOTES METHODS
    // ========================

    /**
     * Update the related notes display
     */
    protected updateRelatedNotesDisplay(displayEl: HTMLElement): void {
        displayEl.empty();

        if (this.relatedNotePaths.length === 0) {
            displayEl.createSpan({
                text: 'No related notes',
                cls: 'setting-item-description'
            });
            return;
        }

        const list = displayEl.createEl('ul', { cls: 'bibliography-related-notes-list' });
        this.relatedNotePaths.forEach(notePath => {
            const li = list.createEl('li');
            const basename = notePath.substring(notePath.lastIndexOf('/') + 1);
            li.createSpan({ text: basename });
            li.createEl('button', {
                text: '×',
                cls: 'bibliography-remove-related-note-button'
            }).onclick = () => {
                this.relatedNotePaths = this.relatedNotePaths.filter(p => p !== notePath);
                this.updateRelatedNotesDisplay(displayEl);
            };
        });
    }

    /**
     * Create the related notes section
     */
    protected createRelatedNotesButtons(container: HTMLElement): HTMLElement {
        const displayEl = container.createDiv({
            cls: 'bibliography-related-notes-display'
        });

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
        return displayEl;
    }

    // ========================
    // LIFECYCLE
    // ========================

    onClose(): void {
        this.contentEl.empty();
    }
}
