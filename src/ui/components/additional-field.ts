import { AdditionalField } from '../../types/citation';

// Define standard CSL fields based on CSL v1.0.1/1.0.2 Appendix IV (all lowercase)
const CSL_STANDARD_VARIABLES = new Set([
  '', // Handle empty selection
  'abstract', 'annote', 'archive', 'archive_location', 'authority', 'call-number',
  'chapter-number', 'citation-key', 'citation-label', 'collection-number', 'collection-title',
  'container-title', 'dimensions', 'doi', 'edition', 'event', 'event-date', 'event-place',
  'first-reference-note-number', 'genre', 'isbn', 'issn', 'issue', 'jurisdiction',
  'keyword', 'language', 'license', 'locator', 'medium', 'note', 'number',
  'number-of-pages', 'number-of-volumes', 'original-author', 'original-date',
  'original-publisher', 'original-publisher-place', 'original-title', 'page',
  'page-first', 'part', 'pmcid', 'pmid', 'publisher', 'publisher-place',
  'references', 'reviewed-author', 'reviewed-title', 'scale', 'section',
  'source', 'status', 'supplement', 'title', 'title-short', 'url', 'version',
  'volume', 'year-suffix',
  // Date Variables also included above
  'accessed', 'available-date', 'issued', 'submitted'
]);

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
		const isNonStandard = fieldNameLower !== '' && !CSL_STANDARD_VARIABLES.has(fieldNameLower);
		if (isNonStandard) {
			this.fieldDiv.addClass('non-csl-field');
		} else {
			this.fieldDiv.removeClass('non-csl-field');
		}
    }
}
