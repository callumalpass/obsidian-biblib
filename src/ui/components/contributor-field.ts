import { Contributor } from '../../types';

export class ContributorField {
    private containerEl: HTMLDivElement;
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
        [
            'author',
            'editor',
            'chair',
            'collection-editor',
            'compiler',
            'composer',
            'container-author',
            'contributor',
            'curator',
            'director',
            'editorial-director',
            'executive-producer',
            'guest',
            'host',
            'interviewer',
            'illustrator',
            'narrator',
            'organizer',
            'original-author',
            'performer',
            'producer',
            'recipient',
            'reviewed-author',
            'script-writer',
            'series-creator',
            'translator',
        ].forEach(roleOption => {
            this.roleSelect.createEl('option', { text: roleOption, value: roleOption });
        });
        this.roleSelect.value = this.contributor.role;
        this.roleSelect.onchange = () => {
            this.contributor.role = this.roleSelect.value;
            console.log(`Contributor role set to: ${this.contributor.role}`);
        };
        
        // Given name input
        this.givenInput = contributorDiv.createEl('input', { 
            type: 'text', 
            placeholder: 'Given Name', 
            cls: 'bibliography-input bibliography-contributor-given' 
        });
        this.givenInput.value = this.contributor.given;
        this.givenInput.oninput = () => {
            this.contributor.given = this.givenInput.value.trim();
            console.log(`Contributor given name set to: ${this.contributor.given}`);
        };
        
        // Family name input
        this.familyInput = contributorDiv.createEl('input', { 
            type: 'text', 
            placeholder: 'Family Name', 
            cls: 'bibliography-input bibliography-contributor-family' 
        });
        this.familyInput.value = this.contributor.family;
        this.familyInput.oninput = () => {
            this.contributor.family = this.familyInput.value.trim();
            console.log(`Contributor family name set to: ${this.contributor.family}`);
        };
        
        // Remove button
        this.removeButton = contributorDiv.createEl('button', { 
            text: 'Remove', 
            cls: 'bibliography-remove-contributor-button' 
        });
        this.removeButton.onclick = () => {
            this.onRemove(this.contributor);
            contributorDiv.remove();
            console.log('Contributor removed');
        };
    }
}