import { Notice, TextAreaComponent, TextComponent } from 'obsidian';
import BibliographyPlugin from '../../../main';

/**
 * Shared helper functions for settings UI components
 */
export class SettingsUIHelpers {
    constructor(private plugin: BibliographyPlugin) {}

    /**
     * Create a document fragment with a callback
     */
    createFragment(callback: (frag: DocumentFragment) => void): DocumentFragment {
        const fragment = document.createDocumentFragment();
        callback(fragment);
        return fragment;
    }

    /**
     * Create a list item with code and text description
     */
    createListItem(parent: HTMLElement, codeText: string, description: string): void {
        parent.createEl('li', {}, (li) => {
            li.createEl('code', { text: codeText });
            if (description) {
                li.appendText(` - ${description}`);
            }
        });
    }

    /**
     * Create a template example with code block and copy button
     */
    createTemplateExample(parent: HTMLElement, title: string, template: string, description: string): void {
        const exampleContainer = parent.createDiv({
            cls: 'template-example-item'
        });

        // Create title
        exampleContainer.createEl('h4', {
            text: title,
            cls: 'template-example-title'
        });

        // Create description
        if (description) {
            exampleContainer.createEl('p', {
                text: description,
                cls: 'template-example-description'
            });
        }

        // Create code block
        const codeBlock = exampleContainer.createEl('pre', {
            cls: 'template-example-code'
        });

        codeBlock.createEl('code', {
            text: template
        });

        // Add copy button
        const copyButtonContainer = exampleContainer.createDiv({
            cls: 'template-example-actions'
        });

        const copyButton = copyButtonContainer.createEl('button', {
            cls: 'template-example-copy-button',
            text: 'Use this template'
        });

        // Add click handler to copy template to the main textarea
        copyButton.addEventListener('click', () => {
            if (this.plugin.settings) {
                this.plugin.settings.headerTemplate = template;
                this.plugin.saveSettings();
                new Notice('Template applied successfully!', 2000);
            }
        });
    }

    /**
     * Create a table row with cells
     */
    createTableRow(parent: HTMLElement, cells: string[], isHeader: boolean = false): void {
        parent.createEl('tr', {}, (tr) => {
            cells.forEach((cellText) => {
                const cellType = isHeader ? 'th' : 'td';
                tr.createEl(cellType, {}, (cell) => {
                    // Basic check if the text might be a template code
                    if (cellText.includes('{{') || cellText.includes('|') || cellText.includes('`') || cellText.startsWith('[')) {
                        cell.createEl('code', { text: cellText });
                    } else {
                        cell.appendText(cellText);
                    }
                });
            });
        });
    }

    /**
     * Creates fragment with just the text (tooltip functionality removed)
     */
    createTooltip(text: string, _tooltipText: string): DocumentFragment {
        return this.createFragment(fragment => {
            fragment.appendText(text);
        });
    }

    /**
     * Adds helper text below a component's input element
     */
    addHelperText(component: TextAreaComponent | TextComponent, text: string): void {
        component.inputEl.parentElement?.createDiv({
            cls: 'setting-item-description setting-helper-text',
            text: text
        });
    }

    /**
     * Helper method to add explanation text to an existing setting
     */
    addSettingHelpText(settingName: string, helpText: string): void {
        document.querySelectorAll('.setting-item').forEach(item => {
            const nameEl = item.querySelector('.setting-item-name');
            if (nameEl && nameEl.textContent === settingName) {
                const descEl = item.querySelector('.setting-item-description');
                if (descEl) {
                    const helpEl = document.createElement('div');
                    helpEl.className = 'setting-helper-text';
                    helpEl.textContent = helpText;
                    descEl.appendChild(helpEl);
                }
            }
        });
    }
}
