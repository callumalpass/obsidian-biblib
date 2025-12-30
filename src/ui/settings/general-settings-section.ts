import { Setting } from 'obsidian';
import BibliographyPlugin from '../../../main';

/**
 * Renders general settings section
 */
export function renderGeneralSettings(containerEl: HTMLElement, plugin: BibliographyPlugin): void {
    new Setting(containerEl)
        .setName('Literature note tag')
        .setDesc('Tag(s) used to identify literature notes in frontmatter. Separate multiple tags with commas or spaces (e.g., "literature_note, excalidraw").')
        .addText(text => text
            .setPlaceholder('literature_note')
            .setValue(plugin.settings.literatureNoteTag)
            .onChange(async (value) => {
                plugin.settings.literatureNoteTag = value.trim();
                await plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName('Open note on create')
        .setDesc('Automatically open a newly created literature note in the workspace')
        .addToggle(toggle => toggle
            .setValue(plugin.settings.openNoteOnCreate)
            .onChange(async (value) => {
                plugin.settings.openNoteOnCreate = value;
                await plugin.saveSettings();
            }));
}
