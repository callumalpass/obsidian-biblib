import { App, Plugin, Notice } from 'obsidian';
import { BibliographyModal } from './src/ui/modals/bibliography-modal';
import { BibliographySettingTab } from './src/ui/settings-tab';
import { BibliographyPluginSettings, DEFAULT_SETTINGS } from './src/types/settings';
import { BibliographyBuilder } from './src/services/bibliography-builder';
import './styles.css';

export default class BibliographyPlugin extends Plugin {
    settings: BibliographyPluginSettings;

    async onload() {
        await this.loadSettings();

        // Add command to create a literature note
        this.addCommand({
            id: 'create-literature-note',
            name: 'Create Literature Note',
            callback: () => {
                new BibliographyModal(this.app, this.settings).open();
            },
        });
        
        // Add command to build bibliography
        this.addCommand({
            id: 'build-bibliography',
            name: 'Build Bibliography',
            callback: async () => {
                try {
                    new Notice('Building bibliography files...');
                    const builder = new BibliographyBuilder(this.app, this.settings);
                    await builder.buildBibliography();
                } catch (error) {
                    console.error('Error building bibliography:', error);
                    new Notice('Error building bibliography files. Check console for details.');
                }
            },
        });

        this.addSettingTab(new BibliographySettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}