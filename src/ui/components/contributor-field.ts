import { Contributor } from '../../types';
import { CSL_NAME_FIELDS } from '../../utils/csl-variables';

export class ContributorField {
    public containerEl: HTMLDivElement; // Changed to public for CSS access
    public contributor: Contributor;
    private onRemove: (contributor: Contributor) => void;

    // UI elements
    private roleSelect: HTMLSelectElement;
    private givenInput: HTMLInputElement;
    private familyInput: HTMLInputElement;
    private removeButton: HTMLButtonElement;

    constructor(
        containerEl: HTMLDivElement, 
        contributor: Contributor, 
        onRemove: (contributor: Contributor) => void
    ) {
        this.containerEl = containerEl;
        this.contributor = contributor;
        this.onRemove = onRemove;
        this.render();
    }

    private render(): void {
        const contributorDiv = this.containerEl.createDiv({ cls: 'bibliography-contributor' });
        
        // Role dropdown
        this.roleSelect = contributorDiv.createEl('select', { cls: 'bibliography-input bibliography-contributor-role' });

        CSL_NAME_FIELDS.forEach(roleOption => {
            this.roleSelect.createEl('option', { text: roleOption, value: roleOption });
        });
        this.roleSelect.value = this.contributor.role;
        this.roleSelect.onchange = () => {
            this.contributor.role = this.roleSelect.value;
        };
        
        // Given name input
        this.givenInput = contributorDiv.createEl('input', { 
            type: 'text', 
            placeholder: 'Given name', 
            cls: 'bibliography-input bibliography-contributor-given' 
        });
        this.givenInput.value = this.contributor.given ?? '';
        
        // Use both input and change events to ensure data is updated immediately
        const updateGivenName = () => {
            this.contributor.given = this.givenInput.value.trim();
        };
        this.givenInput.oninput = updateGivenName;
        this.givenInput.onchange = updateGivenName;
        this.givenInput.onblur = updateGivenName;
        
        // Family name input
        this.familyInput = contributorDiv.createEl('input', { 
            type: 'text', 
            placeholder: 'Family name', 
            cls: 'bibliography-input bibliography-contributor-family' 
        });
        this.familyInput.value = this.contributor.family ?? '';
        
        // Use both input and change events to ensure data is updated immediately 
        const updateFamilyName = () => {
            this.contributor.family = this.familyInput.value.trim();
        };
        this.familyInput.oninput = updateFamilyName;
        this.familyInput.onchange = updateFamilyName;
        this.familyInput.onblur = updateFamilyName;
        
        // Remove button
        this.removeButton = contributorDiv.createEl('button', { 
            text: 'Remove', 
            cls: 'bibliography-remove-contributor-button' 
        });
        this.removeButton.onclick = () => {
            this.onRemove(this.contributor);
            contributorDiv.remove();
        };
    }
}
