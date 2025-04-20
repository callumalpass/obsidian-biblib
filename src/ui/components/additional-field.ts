import { AdditionalField } from '../../types/citation';

export class AdditionalFieldComponent {
    private containerEl: HTMLDivElement;
    public field: AdditionalField;
    private onRemove: (field: AdditionalField) => void;

    // UI elements
    private typeSelect: HTMLSelectElement;
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
        const fieldDiv = this.containerEl.createDiv({ cls: 'bibliography-additional-field' });
        
        // Type dropdown
        this.typeSelect = fieldDiv.createEl('select', { cls: 'bibliography-input bibliography-field-type' });
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
        this.fieldSelect = fieldDiv.createEl('select', { cls: 'bibliography-input bibliography-field-name' });
        this.updateFieldOptions();
        
        this.fieldSelect.onchange = () => {
            this.field.name = this.fieldSelect.value;
            this.updateValueInput(fieldDiv);
        };
        
        // Create value input
        this.valueInputContainer = fieldDiv.createDiv({ cls: 'bibliography-field-value-container' });
        this.updateValueInput(fieldDiv);
        
        // Remove button
        const removeButton = fieldDiv.createEl('button', { 
            text: 'Remove', 
            cls: 'bibliography-remove-field-button' 
        });
        removeButton.onclick = () => {
            this.onRemove(this.field);
            fieldDiv.remove();
        };
    }

    private updateFieldOptions(): void {
        // Clear existing options
        this.fieldSelect.empty();
        
        // Ensure field type is valid, default to standard if empty or invalid
        if (!this.field.type || !['standard', 'number', 'date'].includes(this.field.type)) {
            this.field.type = 'standard';
        }
        
        // Populate options based on field type
        let fieldOptions: string[] = [];
        if (this.field.type === 'standard') {
            fieldOptions = [
                '', 'abstract', 'annote', 'archive', 'archive_collection', 'archive_location', 'archive-place',
                'authority', 'call-number', 'citation-key', 'citation-label', 'collection-title',
                'container-title', 'dimensions', 'division', 'DOI', 'event-title', 'event-place',
                'genre', 'ISBN', 'ISSN', 'jurisdiction', 'keyword', 'language', 'license', 'medium',
                'note', 'original-publisher', 'original-publisher-place', 'original-title', 'part-title',
                'PMCID', 'PMID', 'publisher', 'publisher-place', 'references', 'reviewed-genre',
                'reviewed-title', 'scale', 'source', 'status', 'title-short', 'URL', 'volume-title',
                'year-suffix'
            ];
        } else if (this.field.type === 'number') {
            fieldOptions = [
                '', 'chapter-number', 'citation-number', 'collection-number', 'edition', 'issue', 'locator',
                'number', 'number-of-pages', 'number-of-volumes', 'page', 'page-first', 'part-number',
                'printing-number', 'section', 'supplement-number', 'version', 'volume'
            ];
        } else if (this.field.type === 'date') {
            fieldOptions = [
                '', 'accessed', 'available-date', 'event-date', 'issued', 'original-date', 'submitted'
            ];
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

    private updateValueInput(fieldDiv: HTMLDivElement): void {
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
}
