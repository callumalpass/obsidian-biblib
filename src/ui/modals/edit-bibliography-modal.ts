import { App, Modal, Notice, Setting, TFile, ButtonComponent, ToggleComponent, stringifyYaml } from 'obsidian';
import { BibliographyModal } from './bibliography-modal';
import { BibliographyPluginSettings } from '../../types/settings';
import { Citation, Contributor, AdditionalField, AttachmentData, AttachmentType } from '../../types/citation';
import { ContributorField } from '../components/contributor-field';
import { AdditionalFieldComponent } from '../components/additional-field';
import { CitekeyGenerator } from '../../utils/citekey-generator';
import { TemplateEngine } from '../../utils/template-engine';
import { processYamlArray } from '../../utils/yaml-utils';
import { 
    CSL_ALL_CSL_FIELDS, 
    CSL_NAME_FIELDS, 
    CSL_NUMBER_FIELDS, 
    CSL_DATE_FIELDS 
} from '../../utils/csl-variables';
import { 
    NoteCreationService,
    TemplateVariableBuilderService,
    FrontmatterBuilderService,
    NoteContentBuilderService,
    AttachmentManagerService,
    ReferenceParserService,
    CitationService
} from '../../services';

export class EditBibliographyModal extends BibliographyModal {
    private fileToEdit: TFile;
    private parsedFrontmatter: any;
    
    // Regeneration options
    private regenerateCitekeyOnSave: boolean;
    private updateCustomFrontmatterOnSave: boolean;
    private regenerateBodyOnSave: boolean;
    
    // Toggle controls
    private regenerateCitekeyToggle: ToggleComponent;
    private updateCustomFrontmatterToggle: ToggleComponent;
    private regenerateBodyToggle: ToggleComponent;

    constructor(app: App, settings: BibliographyPluginSettings, fileToEdit: TFile) {
        super(app, settings, false); // false = not opened via command
        this.fileToEdit = fileToEdit;
        
        // Initialize with settings defaults
        this.regenerateCitekeyOnSave = settings.editRegenerateCitekeyDefault;
        this.updateCustomFrontmatterOnSave = settings.editUpdateCustomFrontmatterDefault;
        this.regenerateBodyOnSave = settings.editRegenerateBodyDefault;
    }

    onOpen() {
        // Get frontmatter
        const cache = this.app.metadataCache.getCache(this.fileToEdit.path);
        this.parsedFrontmatter = cache?.frontmatter;
        
        if (!this.parsedFrontmatter) {
            new Notice('No frontmatter found in the selected file');
            this.close();
            return;
        }

        // Call parent onOpen to create the form
        super.onOpen();
        
        // Change modal title
        const titleEl = this.contentEl.querySelector('h2');
        if (titleEl) {
            titleEl.textContent = 'Edit literature note';
        }
        
        // Add regeneration options before submit buttons
        this.addRegenerationOptions();
        
        // Populate form with existing data
        this.populateFormFromCSLFrontmatter(this.parsedFrontmatter);
    }

    /**
     * Add regeneration option toggles to the modal
     */
    private addRegenerationOptions(): void {
        // Find the button container (it's the last element before closing)
        const buttonContainers = this.contentEl.querySelectorAll('.bibliography-form-buttons');
        const buttonContainer = buttonContainers[buttonContainers.length - 1];
        
        if (!buttonContainer || !buttonContainer.parentElement) return;
        
        // Create options container before the buttons
        const optionsContainer = buttonContainer.parentElement.createDiv({ 
            cls: 'edit-options-container' 
        });
        buttonContainer.parentElement.insertBefore(optionsContainer, buttonContainer);
        
        optionsContainer.createEl('h4', { text: 'Update options' });
        
        // Create a description for the section
        const optionsDesc = optionsContainer.createEl('p', {
            cls: 'setting-item-description',
            text: 'Choose which parts of the note should be updated when saving changes:'
        });
        
        // Citekey regeneration toggle
        new Setting(optionsContainer)
            .setName('Regenerate citekey')
            .setDesc('Generate a new citekey based on current data (may rename the file)')
            .addToggle(toggle => {
                this.regenerateCitekeyToggle = toggle;
                toggle.setValue(this.regenerateCitekeyOnSave)
                    .onChange(value => {
                        this.regenerateCitekeyOnSave = value;
                    });
            });

        // Custom frontmatter update toggle
        new Setting(optionsContainer)
            .setName('Update templated frontmatter')
            .setDesc('Re-evaluate custom frontmatter field templates with current data')
            .addToggle(toggle => {
                this.updateCustomFrontmatterToggle = toggle;
                toggle.setValue(this.updateCustomFrontmatterOnSave)
                    .onChange(value => {
                        this.updateCustomFrontmatterOnSave = value;
                    });
            });

        // Note body regeneration toggle with warning
        const bodyRegenerationSetting = new Setting(optionsContainer)
            .setName('Regenerate note body')
            .setDesc('Replace the entire note body with the header template')
            .addToggle(toggle => {
                this.regenerateBodyToggle = toggle;
                toggle.setValue(this.regenerateBodyOnSave)
                    .onChange(value => {
                        this.regenerateBodyOnSave = value;
                        this.updateBodyWarningVisibility(value, warningEl);
                    });
            });

        // Warning for body regeneration
        const warningEl = optionsContainer.createDiv({
            cls: 'edit-body-warning',
            attr: { style: this.regenerateBodyOnSave ? 'display: block;' : 'display: none;' }
        });
        
        warningEl.createEl('div', {
            cls: 'callout callout-warning',
        }, (callout) => {
            callout.createEl('div', { cls: 'callout-title', text: '⚠️ Warning' });
            callout.createEl('div', { 
                cls: 'callout-content', 
                text: 'Regenerating the note body will replace all content you\'ve added to this note with the header template. This action cannot be undone.' 
            });
        });
    }

    /**
     * Show/hide body regeneration warning
     */
    private updateBodyWarningVisibility(show: boolean, warningEl: HTMLElement): void {
        warningEl.style.display = show ? 'block' : 'none';
    }

    /**
     * Populate form from CSL frontmatter
     */
    private populateFormFromCSLFrontmatter(frontmatter: any): void {
        const cslData: any = {};
        const contributors: { [role: string]: any[] } = {};
        
        // Process each frontmatter field
        for (const [key, value] of Object.entries(frontmatter)) {
            // Skip non-CSL fields and internal Obsidian fields
            if (key.startsWith('cssclass') || key === 'tags' || key === 'aliases') {
                continue;
            }
            
            // Check if it's a name field (author, editor, etc.)
            if (CSL_NAME_FIELDS.includes(key) && Array.isArray(value)) {
                contributors[key] = value;
            } else {
                // Include all fields in cslData so they can be loaded as additional fields
                cslData[key] = value;
            }
        }
        
        // Convert contributors to the format expected by populateFormFromCitoid
        for (const [role, names] of Object.entries(contributors)) {
            cslData[role] = names;
        }
        
        // Populate attachments
        if (frontmatter.attachment || frontmatter.pdflink) {
            const attachments = frontmatter.attachment || frontmatter.pdflink;
            if (Array.isArray(attachments)) {
                // Filter to ensure only valid string paths are processed
                const validPaths = attachments.filter(path => 
                    typeof path === 'string' && path.trim().length > 0
                );
                validPaths.forEach(path => {
                    this.attachmentData.push({
                        type: AttachmentType.LINK,
                        path: path
                    });
                });
            } else if (typeof attachments === 'string' && attachments.trim().length > 0) {
                this.attachmentData.push({
                    type: AttachmentType.LINK,
                    path: attachments
                });
            }
        }
        
        // Populate related notes
        if (frontmatter.related || frontmatter.links) {
            const related = frontmatter.related || frontmatter.links;
            if (Array.isArray(related)) {
                // Filter to ensure only valid string paths are processed
                this.relatedNotePaths = related.filter(path => 
                    typeof path === 'string' && path.trim().length > 0
                );
            } else if (typeof related === 'string' && related.trim().length > 0) {
                this.relatedNotePaths = [related];
            }
        }
        
        // Use the parent class method to populate the form
        this.populateFormFromCitoid(cslData);
        
        // Update attachment display
        if (this.attachmentsDisplayEl) {
            this.updateAttachmentsDisplay();
        }
        
        // Update related notes display
        const relatedNotesDisplay = this.contentEl.querySelector('.bibliography-related-notes-display');
        if (relatedNotesDisplay instanceof HTMLElement) {
            this.updateRelatedNotesDisplay(relatedNotesDisplay);
        }
    }

    /**
     * Override handleSubmit to update the existing file
     */
    protected async handleSubmit(citation: Citation): Promise<void> {
        try {
            // Get updated modal data
            const updatedModalData = {
                citation: this.getFormValues(),
                contributors: this.contributors,
                additionalFields: this.additionalFields,
                attachmentData: this.attachmentData,
                relatedNotePaths: this.relatedNotePaths
            };

            // Read current file content
            const originalFileContent = await this.app.vault.read(this.fileToEdit);
            
            // Get existing frontmatter
            const existingFrontmatter = this.parsedFrontmatter || {};
            
            // Get current citekey
            const currentCitekey = existingFrontmatter.id || existingFrontmatter.citekey;
            let newCitekey = currentCitekey;
            
            // Generate new citekey if requested
            if (this.regenerateCitekeyOnSave) {
                newCitekey = CitekeyGenerator.generate(updatedModalData.citation, this.settings.citekeyOptions);
                updatedModalData.citation.id = newCitekey;
            }
            
            // Start with existing frontmatter to preserve non-CSL fields
            const finalFrontmatterOutput: any = { ...existingFrontmatter };
            
            // Merge CSL data from modal
            for (const [key, value] of Object.entries(updatedModalData.citation)) {
                if (value !== undefined && value !== '') {
                    finalFrontmatterOutput[key] = value;
                }
            }
            
            // Merge contributors
            const contributorsByRole: { [role: string]: any[] } = {};
            updatedModalData.contributors.forEach(contributor => {
                if (!contributorsByRole[contributor.role]) {
                    contributorsByRole[contributor.role] = [];
                }
                
                const nameData: any = {};
                if (contributor.family) nameData.family = contributor.family;
                if (contributor.given) nameData.given = contributor.given;
                if (contributor.literal) nameData.literal = contributor.literal;
                
                if (Object.keys(nameData).length > 0) {
                    contributorsByRole[contributor.role].push(nameData);
                }
            });
            
            // Update frontmatter with contributors
            for (const [role, names] of Object.entries(contributorsByRole)) {
                if (names.length > 0) {
                    finalFrontmatterOutput[role] = names;
                } else {
                    delete finalFrontmatterOutput[role];
                }
            }
            
            // Clear any old contributor fields that are now empty
            CSL_NAME_FIELDS.forEach(field => {
                if (!contributorsByRole[field] && finalFrontmatterOutput[field]) {
                    delete finalFrontmatterOutput[field];
                }
            });
            
            // Merge additional fields
            updatedModalData.additionalFields.forEach(field => {
                // Filter out fields without names
                if (!field.name || field.name.trim() === '') {
                    return;
                }
                
                // For date fields, check if value exists and is not empty
                if (field.type === 'date') {
                    if (field.value == null || 
                        (typeof field.value === 'string' && field.value.trim() === '') ||
                        (typeof field.value === 'object' && (!field.value['date-parts'] || field.value['date-parts'].length === 0))) {
                        return;
                    }
                    
                    if (typeof field.value === 'object' && field.value !== null) {
                        // Valid CSL date object
                        finalFrontmatterOutput[field.name] = field.value;
                    } else if (typeof field.value === 'string' && field.value !== '') {
                        // Date string that wasn't converted to CSL format
                        // Try to convert it
                        const dateMatch = field.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                        if (dateMatch) {
                            const cslDate = {
                                'date-parts': [[
                                    parseInt(dateMatch[1], 10),
                                    parseInt(dateMatch[2], 10),
                                    parseInt(dateMatch[3], 10)
                                ]]
                            };
                            finalFrontmatterOutput[field.name] = cslDate;
                        } else {
                            // Store as raw date string if parsing fails
                            const rawDate = { 'raw': field.value };
                            finalFrontmatterOutput[field.name] = rawDate;
                        }
                    }
                } else {
                    // For non-date fields, check standard empty conditions
                    if (field.value != null && field.value !== '') {
                        finalFrontmatterOutput[field.name] = field.value;
                    }
                }
            });
            
            // Update attachment links
            if (updatedModalData.attachmentData.length > 0) {
                const attachmentPaths = updatedModalData.attachmentData.map(a => a.path);
                finalFrontmatterOutput.attachment = attachmentPaths;
            } else {
                delete finalFrontmatterOutput.attachment;
                delete finalFrontmatterOutput.pdflink;
            }
            
            // Update related note links
            if (updatedModalData.relatedNotePaths.length > 0) {
                finalFrontmatterOutput.related = updatedModalData.relatedNotePaths;
            } else {
                delete finalFrontmatterOutput.related;
                delete finalFrontmatterOutput.links;
            }
            
            // Update custom frontmatter fields if requested
            if (this.updateCustomFrontmatterOnSave) {
                const templateVariableBuilder = new TemplateVariableBuilderService();
                const templateVariables = templateVariableBuilder.buildVariables(
                    finalFrontmatterOutput,
                    updatedModalData.contributors,
                    updatedModalData.attachmentData.map(a => a.path).filter((p): p is string => p !== undefined),
                    updatedModalData.relatedNotePaths
                );
                
                // Process each enabled custom field
                for (const field of this.settings.customFrontmatterFields) {
                    if (field.enabled) {
                        try {
                            // Skip if field name already exists in frontmatter (don't overwrite standard fields)
                            if (finalFrontmatterOutput.hasOwnProperty(field.name)) {
                                continue;
                            }
                            
                            // Determine if this looks like an array/object template
                            const isArrayTemplate = field.template.trim().startsWith('[') && 
                                                   field.template.trim().endsWith(']');
                            
                            // Render the template with appropriate options
                            const renderedValue = TemplateEngine.render(
                                field.template,
                                templateVariables, 
                                { yamlArray: isArrayTemplate }
                            );
                            
                            // Handle different types of rendered values
                            if ((renderedValue.startsWith('[') && renderedValue.endsWith(']')) || 
                                (renderedValue.startsWith('{') && renderedValue.endsWith('}'))) {
                                try {
                                    // For array templates, process with our shared utility function first
                                    const processedValue = isArrayTemplate ? processYamlArray(renderedValue) : renderedValue;
                                    
                                    // Parse as JSON for arrays and objects
                                    finalFrontmatterOutput[field.name] = JSON.parse(processedValue);
                                } catch (e) {
                                    // Special handling for array templates that should be empty arrays
                                    if (isArrayTemplate && (renderedValue.trim() === '[]' || renderedValue.trim() === '[ ]')) {
                                        finalFrontmatterOutput[field.name] = [];
                                    } else {
                                        // If JSON parsing fails, store as string
                                        console.warn(`Failed to parse JSON for field ${field.name}: ${renderedValue}`);
                                        finalFrontmatterOutput[field.name] = renderedValue;
                                    }
                                }
                            } else {
                                // For non-JSON values, store directly
                                finalFrontmatterOutput[field.name] = renderedValue;
                            }
                        } catch (error) {
                            console.error(`Error rendering custom field ${field.name}:`, error);
                        }
                    }
                }
            }
            
            // Convert frontmatter to YAML string
            const newFrontmatterString = stringifyYaml(finalFrontmatterOutput);
            
            // Determine note body
            let newBody: string;
            if (this.regenerateBodyOnSave) {
                // Regenerate body from template
                const templateVariableBuilder = new TemplateVariableBuilderService();
                const templateVariables = templateVariableBuilder.buildVariables(
                    finalFrontmatterOutput,
                    updatedModalData.contributors,
                    updatedModalData.attachmentData.map(a => a.path).filter((p): p is string => p !== undefined),
                    updatedModalData.relatedNotePaths
                );
                newBody = TemplateEngine.render(this.settings.headerTemplate, templateVariables);
            } else {
                // Extract existing body
                const frontmatterRegex = /^---\n[\s\S]*?\n---\n*/;
                const match = originalFileContent.match(frontmatterRegex);
                if (match) {
                    newBody = originalFileContent.substring(match[0].length);
                } else {
                    newBody = originalFileContent;
                }
            }
            
            // Combine new frontmatter and body
            const newFullContent = `---\n${newFrontmatterString.trim()}\n---\n\n${newBody.trim()}`;
            
            // Update the file
            await this.app.vault.modify(this.fileToEdit, newFullContent);
            
            // Handle file renaming if citekey changed
            if (newCitekey !== currentCitekey && this.settings.editRenameFileOnCitekeyChange) {
                const newFileName = await this.generateFileName(finalFrontmatterOutput);
                const newPath = this.fileToEdit.parent?.path 
                    ? `${this.fileToEdit.parent.path}/${newFileName}.md`
                    : `${newFileName}.md`;
                
                if (newPath !== this.fileToEdit.path) {
                    await this.app.fileManager.renameFile(this.fileToEdit, newPath);
                }
            }
            
            new Notice('Literature note updated successfully');
            this.close();
            
        } catch (error) {
            console.error('Error updating literature note:', error);
            new Notice(`Failed to update note: ${error.message}`);
        }
    }
    
    /**
     * Generate filename from frontmatter data
     */
    private async generateFileName(frontmatter: any): Promise<string> {
        const templateVariableBuilder = new TemplateVariableBuilderService();
        const templateVariables = templateVariableBuilder.buildVariables(
            frontmatter,
            this.contributors,
            this.attachmentData.map(a => a.path).filter((p): p is string => p !== undefined),
            this.relatedNotePaths
        );
        
        let filename = TemplateEngine.render(this.settings.filenameTemplate, templateVariables);
        
        // Sanitize filename
        filename = filename.replace(/[\\/:*?"<>|]/g, '-');
        
        return filename;
    }
}