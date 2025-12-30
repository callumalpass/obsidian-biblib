import { Setting, normalizePath } from 'obsidian';
import BibliographyPlugin from '../../../main';

/**
 * Renders bibliography export settings section
 */
export function renderBibliographyBuilderSection(containerEl: HTMLElement, plugin: BibliographyPlugin): void {
    new Setting(containerEl).setName('Bibliography export').setHeading();

    containerEl.createEl('p', {
        text: 'Configure settings for the bibliography builder command.',
        cls: 'setting-item-description'
    });

    new Setting(containerEl)
        .setName('Bibliography JSON path')
        .setDesc('Path where to save the bibliography.json file (relative to vault)')
        .addText(text => text
            .setPlaceholder('biblib/bibliography.json')
            .setValue(plugin.settings.bibliographyJsonPath)
            .onChange(async (value) => {
                plugin.settings.bibliographyJsonPath = normalizePath(value.trim());
                await plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName('Citekey list path')
        .setDesc('Path where to save the citekeylist.md file (relative to vault)')
        .addText(text => text
            .setPlaceholder('citekeylist.md')
            .setValue(plugin.settings.citekeyListPath)
            .onChange(async (value) => {
                plugin.settings.citekeyListPath = normalizePath(value.trim());
                await plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName('BibTeX file path')
        .setDesc('Path where to save the exported BibTeX file (relative to vault)')
        .addText(text => text
            .setPlaceholder('biblib/bibliography.bib')
            .setValue(plugin.settings.bibtexFilePath)
            .onChange(async (value) => {
                plugin.settings.bibtexFilePath = normalizePath(value.trim());
                await plugin.saveSettings();
            }));
}
