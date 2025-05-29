// ./src/ui/components/additional-field.ts

import { AdditionalField } from '../../types/citation';
import {
  CSL_STANDARD_FIELDS,
  CSL_NUMBER_FIELDS,
  CSL_DATE_FIELDS,
  CSL_ALL_CSL_FIELDS,
} from '../../utils/csl-variables';

export class AdditionalFieldComponent {
    public containerEl: HTMLDivElement; // Parent container for all additional fields
    public field: AdditionalField;
    private onRemove: (field: AdditionalField) => void;

    // UI elements
    private typeSelect: HTMLSelectElement;
    public fieldDiv: HTMLDivElement; // The main div for this specific field's controls
    private fieldSelect: HTMLSelectElement;
    private valueInputContainer: HTMLDivElement;
    private removeButton: HTMLButtonElement;
    private warningTextEl: HTMLDivElement | null = null; // Element for the warning text

    constructor(
        containerEl: HTMLDivElement,
        field: AdditionalField,
        onRemove: (field: AdditionalField) => void
    ) {
        this.containerEl = containerEl; // This is the overall container (e.g., bibliography-additional-fields)
        this.field = field;
        this.onRemove = onRemove;
        this.render();
    }

    private render(): void {
        // Create the div for this specific field's input row FIRST
        this.fieldDiv = this.containerEl.createDiv({ cls: 'bibliography-additional-field' });

        // --- Populate the fieldDiv with controls ---
        // Type dropdown
        this.typeSelect = this.fieldDiv.createEl('select', { cls: 'bibliography-input bibliography-field-type' });
        ['Standard', 'Number', 'Date'].forEach(typeOption => {
            const option = this.typeSelect.createEl('option', {
                text: typeOption,
                value: typeOption.toLowerCase()
            });
            if (!this.field.type) this.field.type = 'standard';
            if (typeOption.toLowerCase() === this.field.type) option.selected = true;
        });
        this.typeSelect.onchange = () => {
            this.field.type = this.typeSelect.value || 'standard';
            this.updateFieldOptions();
            this.updateValueInput();
            this.updateHighlight();
        };

        // Field name dropdown
        this.fieldSelect = this.fieldDiv.createEl('select', { cls: 'bibliography-input bibliography-field-name' });
        this.updateFieldOptions();
        this.fieldSelect.onchange = () => {
            this.field.name = this.fieldSelect.value;
            this.updateHighlight();
        };

        // Value input container
        this.valueInputContainer = this.fieldDiv.createDiv({ cls: 'bibliography-field-value-container' });
        this.updateValueInput();

        // Remove button
        this.removeButton = this.fieldDiv.createEl('button', {
            text: 'Remove',
            cls: 'bibliography-remove-field-button'
        });
        this.removeButton.onclick = () => {
            // Remove the warning text too if it exists when the field is removed
            if (this.warningTextEl) {
                this.warningTextEl.remove();
            }
            this.onRemove(this.field);
            this.fieldDiv.remove(); // Remove the main field div
        };

        // --- Initial state update ---
        // Call updateHighlight AFTER the fieldDiv is fully rendered and added to the DOM
        // It will handle creating/placing the warning text element outside the fieldDiv if needed
        this.updateHighlight();
    }

    // updateFieldOptions remains the same as before...
    private updateFieldOptions(): void {
        const currentName = this.fieldSelect.value;
        this.fieldSelect.empty();

        if (!this.field.type || !['standard', 'number', 'date'].includes(this.field.type)) {
            this.field.type = 'standard';
        }

        const fieldOptions: string[] = [];
        switch (this.field.type) {
            case 'number': fieldOptions.push(...CSL_NUMBER_FIELDS); break;
            case 'date': fieldOptions.push(...CSL_DATE_FIELDS); break;
            case 'standard': default: fieldOptions.push(...CSL_STANDARD_FIELDS); break;
        }

        if (this.field.name && !fieldOptions.includes(this.field.name)) {
             if (!CSL_ALL_CSL_FIELDS.has(this.field.name)){
                fieldOptions.push(this.field.name);
             }
        }

        fieldOptions.sort();

        fieldOptions.forEach(fieldOption => {
            const option = this.fieldSelect.createEl('option', {
                text: fieldOption,
                value: fieldOption
            });
            if (fieldOption === this.field.name || fieldOption === currentName) {
                option.selected = true;
                 if (this.field.name !== fieldOption) {
                     this.field.name = fieldOption;
                 }
            }
        });
        if (!this.field.name && this.fieldSelect.value) {
             this.field.name = this.fieldSelect.value;
        } else if (!this.field.name && fieldOptions.length > 0) {
            this.field.name = fieldOptions[0];
            this.fieldSelect.value = fieldOptions[0];
        }
    }


    // updateValueInput remains the same as before...
    private updateValueInput(): void {
        this.valueInputContainer.empty();
        const commonClasses = 'bibliography-input bibliography-field-value';
        let valueInput: HTMLInputElement | HTMLTextAreaElement;

        if (this.field.type === 'number') {
            valueInput = this.valueInputContainer.createEl('input', { type: 'number', placeholder: 'Enter number', cls: commonClasses });
        } else if (this.field.type === 'date') {
            valueInput = this.valueInputContainer.createEl('input', { type: 'date', cls: commonClasses });
        } else {
            if (this.field.name === 'abstract' || this.field.name === 'note') {
                 valueInput = this.valueInputContainer.createEl('textarea', { placeholder: 'Enter value', cls: commonClasses });
                 valueInput.rows = 2;
            } else {
                 valueInput = this.valueInputContainer.createEl('input', { type: 'text', placeholder: 'Enter value', cls: commonClasses });
            }
        }

        // Handle value setting and change events differently for dates
        if (this.field.type === 'date') {
            // Convert CSL date object to date string for display
            let dateString = '';
            if (this.field.value) {
                if (typeof this.field.value === 'string') {
                    dateString = this.field.value;
                } else if (this.field.value['date-parts'] && this.field.value['date-parts'][0]) {
                    const parts = this.field.value['date-parts'][0];
                    if (parts.length >= 3) {
                        dateString = `${parts[0]}-${parts[1].toString().padStart(2, '0')}-${parts[2].toString().padStart(2, '0')}`;
                    } else if (parts.length >= 2) {
                        dateString = `${parts[0]}-${parts[1].toString().padStart(2, '0')}-01`;
                    } else if (parts.length >= 1) {
                        dateString = `${parts[0]}-01-01`;
                    }
                }
            }
            (valueInput as HTMLInputElement).value = dateString;
            
            // Convert date string to CSL date format when saving
            const updateDateValue = () => {
                const inputValue = (valueInput as HTMLInputElement).value.trim();
                if (inputValue) {
                    const dateMatch = inputValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    if (dateMatch) {
                        this.field.value = {
                            'date-parts': [[
                                parseInt(dateMatch[1], 10),
                                parseInt(dateMatch[2], 10),
                                parseInt(dateMatch[3], 10)
                            ]]
                        };
                    } else {
                        // Fallback for invalid dates
                        this.field.value = { 'raw': inputValue };
                    }
                } else {
                    this.field.value = '';
                }
            };
            
            // Use multiple events to ensure we catch the change
            valueInput.addEventListener('change', updateDateValue);
            valueInput.addEventListener('input', updateDateValue);
            valueInput.addEventListener('blur', updateDateValue);
        } else {
            // Standard handling for non-date fields
            valueInput.value = this.field.value != null ? String(this.field.value) : '';
            valueInput.oninput = () => { this.field.value = valueInput.value.trim(); };
            valueInput.onchange = () => { this.field.value = valueInput.value.trim(); };
        }
    }


    /**
     * Adds or removes a highlight class to the field row AND manages a warning
     * text element displayed *below* the field row if the name is non-standard.
     */
    private updateHighlight(): void {
        const fieldName = this.field.name || '';
        const isNonStandard = fieldName !== '' && !CSL_ALL_CSL_FIELDS.has(fieldName);

        if (isNonStandard) {
            // Add highlighting class to the main field div
            this.fieldDiv.addClass('non-csl-field');

            // Add or update the warning text element *after* the fieldDiv
            if (!this.warningTextEl) {
                // Create the warning element
                this.warningTextEl = createDiv({ // Use Obsidian's createDiv for convenience
                    cls: 'bibliography-field-warning setting-item-description',
                    text: 'This field name is not a standard CSL variable and may not be compatible with other tools.'
                });

                // Insert it into the parent container, right after the fieldDiv
                this.fieldDiv.parentNode?.insertBefore(this.warningTextEl, this.fieldDiv.nextSibling);

            }
        } else {
            // Remove highlighting class
            this.fieldDiv.removeClass('non-csl-field');

            // Hide or remove the warning text element if it exists
            if (this.warningTextEl) {
                 // Option 1: Remove the element completely (cleaner DOM)
                 this.warningTextEl.remove();
                 this.warningTextEl = null;

            }
        }
    }
}
