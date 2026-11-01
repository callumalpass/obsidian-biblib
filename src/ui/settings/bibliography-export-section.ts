import { Setting, normalizePath } from 'obsidian';
import BibliographyPlugin from '../../../main';
import { BibliographyExportProfile } from '../../types/settings';

/**
 * Renders bibliography export settings section
 */
export function renderBibliographyBuilderSection(
    containerEl: HTMLElement,
    plugin: BibliographyPlugin,
    refreshDisplay: () => void
): void {
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
        .setName('Bibtex file path')
        .setDesc('Path where to save the exported bibtex file (relative to vault)')
        .addText(text => text
            .setPlaceholder('biblib/bibliography.bib')
            .setValue(plugin.settings.bibtexFilePath)
            .onChange(async (value) => {
                plugin.settings.bibtexFilePath = normalizePath(value.trim());
                await plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName('Rebuild automatically')
        .setDesc('Rebuild the bibliography JSON, citekey list and bibtex file a few seconds after a literature note is created, edited, renamed or deleted.')
        .addToggle(toggle => toggle
            .setValue(plugin.settings.autoExportBibliography)
            .onChange(async (value) => {
                plugin.settings.autoExportBibliography = value;
                await plugin.saveSettings();
            }));

    renderExportProfiles(containerEl, plugin, refreshDisplay);
}

/**
 * Renders the list of extra export profiles, each limited to a folder and/or tag
 */
function renderExportProfiles(containerEl: HTMLElement, plugin: BibliographyPlugin, refreshDisplay: () => void): void {
    new Setting(containerEl).setName('Export profiles').setHeading();

    containerEl.createEl('p', {
        text: 'Write extra bibliography files limited to some literature notes, such as one per project. They are written by the same commands as the main export (and by automatic rebuilds). Leave a filter empty to include every literature note, and leave a path empty to skip that format.',
        cls: 'setting-item-description'
    });

    const update = async (index: number, changes: Partial<BibliographyExportProfile>) => {
        const profiles = [...plugin.settings.bibliographyExportProfiles];
        profiles[index] = { ...profiles[index], ...changes };
        plugin.settings.bibliographyExportProfiles = profiles;
        await plugin.saveSettings();
    };

    plugin.settings.bibliographyExportProfiles.forEach((profile, index) => {
        const profileEl = containerEl.createDiv({ cls: 'biblib-export-profile' });

        new Setting(profileEl)
            .setName('Profile name')
            .addText(text => text
                .setPlaceholder('Thesis')
                .setValue(profile.name)
                .onChange(async (value) => update(index, { name: value })))
            .addExtraButton(button => button
                .setIcon('trash')
                .setTooltip('Remove profile')
                .onClick(async () => {
                    plugin.settings.bibliographyExportProfiles =
                        plugin.settings.bibliographyExportProfiles.filter((_, i) => i !== index);
                    await plugin.saveSettings();
                    refreshDisplay();
                }));

        new Setting(profileEl)
            .setName('Folder')
            .setDesc('Only literature notes in this folder and its subfolders')
            .addText(text => text
                .setPlaceholder('Projects')
                .setValue(profile.folder)
                .onChange(async (value) => update(index, { folder: value.trim() })));

        new Setting(profileEl)
            .setName('Tag')
            .setDesc('Only literature notes that also have this tag')
            .addText(text => text
                .setPlaceholder('Thesis')
                .setValue(profile.tag)
                .onChange(async (value) => update(index, { tag: value.trim() })));

        new Setting(profileEl)
            .setName('Bibliography JSON path')
            .addText(text => text
                .setPlaceholder('biblib/thesis.json')
                .setValue(profile.jsonPath)
                .onChange(async (value) => update(index, { jsonPath: value.trim() ? normalizePath(value.trim()) : '' })));

        new Setting(profileEl)
            .setName('Bibtex file path')
            .addText(text => text
                .setPlaceholder('biblib/thesis.bib')
                .setValue(profile.bibtexPath)
                .onChange(async (value) => update(index, { bibtexPath: value.trim() ? normalizePath(value.trim()) : '' })));
    });

    new Setting(containerEl)
        .addButton(button => button
            .setButtonText('Add export profile')
            .onClick(async () => {
                plugin.settings.bibliographyExportProfiles = [
                    ...plugin.settings.bibliographyExportProfiles,
                    { name: '', folder: '', tag: '', jsonPath: '', bibtexPath: '' }
                ];
                await plugin.saveSettings();
                refreshDisplay();
            }));
}
