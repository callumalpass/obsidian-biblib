import { AdditionalField } from '../../types/citation';
import {
  CSL_STANDARD_FIELDS,
  CSL_NUMBER_FIELDS,
  CSL_DATE_FIELDS,
  CSL_ALL_CSL_FIELDS,
} from '../../utils/csl-variables';

export class AdditionalFieldComponent {
    private containerEl: HTMLDivElement;
    public field: AdditionalField;
    private onRemove: (field: AdditionalField) => void;

    // UI elements
    private typeSelect: HTMLSelectElement;
    private fieldDiv: HTMLDivElement; // Store the main field row div
    private fieldSelect: HTMLSelectElement;
    private valueInputContainer: HTMLDivElement;

    constructor(
        containerEl: HTMLDivElement,
        field: AdditionalField,
        onRemove: (field: AdditionalField) => void
    ) {
        this.containerEl = containerEl;
        this.field = field;
        this.onRemove = onRemove;
        this.render();
    }

    private render(): void {
        this.fieldDiv = this.containerEl.createDiv({ cls: 'bibliography-additional-field' });
        
        // Type dropdown
        this.typeSelect = this.fieldDiv.createEl('select', { cls: 'bibliography-input bibliography-field-type' });
        ['Standard', 'Number', 'Date'].forEach(typeOption => {
            const option = this.typeSelect.createEl('option', { 
                text: typeOption, 
                value: typeOption.toLowerCase() 
            });
            
            // Select the current type or default to standard
            if (!this.field.type) {
                this.field.type = 'standard';
            }
            
            if (typeOption.toLowerCase() === this.field.type) {
                option.selected = true;
            }
        });
        
        this.typeSelect.onchange = () => {
            this.field.type = this.typeSelect.value || 'standard';
            this.updateFieldOptions();
        };
        
        // Field name dropdown
        this.fieldSelect = this.fieldDiv.createEl('select', { cls: 'bibliography-input bibliography-field-name' });
        this.updateFieldOptions();
        
        this.fieldSelect.onchange = () => {
            this.field.name = this.fieldSelect.value;
            this.updateValueInput();
            this.updateHighlight(); // Update highlight on name change
        };
        
        // Create value input
        this.valueInputContainer = this.fieldDiv.createDiv({ cls: 'bibliography-field-value-container' });
        this.updateValueInput();
        
        // Remove button
        const removeButton = this.fieldDiv.createEl('button', { 
            text: 'Remove', 
            cls: 'bibliography-remove-field-button' 
        });
        removeButton.onclick = () => {
            this.onRemove(this.field);
            this.fieldDiv.remove();
        };
        
        this.updateHighlight(); // Initial highlight check
    }

    private updateFieldOptions(): void {
        // Clear existing options
        this.fieldSelect.empty();
        
        // Ensure field type is valid, default to standard if empty or invalid
        if (!this.field.type || !['standard', 'number', 'date'].includes(this.field.type)) {
            this.field.type = 'standard';
        }
        
        // Populate options based on field type using centralized CSL field lists
        const fieldOptions: string[] = [];
        switch (this.field.type) {
            case 'number':
                fieldOptions.push(...CSL_NUMBER_FIELDS);
                break;
            case 'date':
                fieldOptions.push(...CSL_DATE_FIELDS);
                break;
            case 'standard':
            default:
                fieldOptions.push(...CSL_STANDARD_FIELDS);
                break;
        }
        
        // Add the current key if it's not in the standard options
        if (this.field.name && !fieldOptions.includes(this.field.name)) {
            fieldOptions.push(this.field.name);
        }
        
        // Create options for field name
        fieldOptions.forEach(fieldOption => {
            const option = this.fieldSelect.createEl('option', { 
                text: fieldOption, 
                value: fieldOption 
            });
            
            // Select the current field name
            if (fieldOption === this.field.name) {
                option.selected = true;
            }
        });
    }

    private updateValueInput(): void {
        // Remove any existing value input
        this.valueInputContainer.empty();
        
        // Create value input based on field type
        if (this.field.type === 'number') {
            const valueInput = this.valueInputContainer.createEl('input', { 
                type: 'number', 
                placeholder: 'Enter Value', 
                cls: 'bibliography-input bibliography-field-value' 
            });
            valueInput.value = this.field.value !== undefined ? this.field.value.toString() : '';
            valueInput.oninput = () => {
                this.field.value = Number(valueInput.value.trim()).toString();
            };
        } else if (this.field.type === 'date') {
            const valueInput = this.valueInputContainer.createEl('input', { 
                type: 'date', 
                cls: 'bibliography-input bibliography-field-value' 
            });
            valueInput.value = this.field.value !== undefined ? this.field.value.toString() : '';
            valueInput.oninput = () => {
                this.field.value = valueInput.value.trim();
            };
        } else {
            const valueInput = this.valueInputContainer.createEl('input', { 
                type: 'text', 
                placeholder: 'Enter Value', 
                cls: 'bibliography-input bibliography-field-value' 
            });
            valueInput.value = this.field.value !== undefined ? this.field.value.toString() : '';
            valueInput.oninput = () => {
                this.field.value = valueInput.value.trim();
            };
        }
    }

    /**
     * Adds or removes a highlight class based on whether the current field name is a standard CSL variable.
     */
    private updateHighlight(): void {
		const fieldNameLower = this.field.name?.toLowerCase() || ''; // Ensure lowercase and handle null/undefined
		const isNonStandard = fieldNameLower !== '' && !CSL_ALL_CSL_FIELDS.has(fieldNameLower);
		if (isNonStandard) {
			this.fieldDiv.addClass('non-csl-field');
		} else {
			this.fieldDiv.removeClass('non-csl-field');
		}
    }
}
