import { App, Plugin, Notice } from 'obsidian';
import { BibliographyModal } from './src/ui/modals/bibliography-modal';
import { ChapterModal } from './src/ui/modals/chapter-modal';
import { BibliographySettingTab } from './src/ui/settings-tab';
import { BibliographyPluginSettings, DEFAULT_SETTINGS } from './src/types/settings';
import { BibliographyBuilder } from './src/services/bibliography-builder';
import './styles.css';

// Suppress non-error console logging
console.log = () => {};
console.warn = () => {};

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
        
        // Add command to create a chapter entry
        this.addCommand({
            id: 'create-chapter-entry',
            name: 'Create Book Chapter Entry',
            callback: () => {
                new ChapterModal(this.app, this.settings).open();
            },
        });
        
        // Add command to create a chapter from current book note
        this.addCommand({
            id: 'create-chapter-from-current-book',
            name: 'Create Chapter From Current Book',
            checkCallback: (checking) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) return false;
                
                const cache = this.app.metadataCache.getFileCache(activeFile);
                if (!cache || !cache.frontmatter) return false;
                
                // Check if it's a book type entry
                const frontmatter = cache.frontmatter;
                if (!frontmatter.type || !['book', 'collection', 'document'].includes(frontmatter.type)) {
                    return false;
                }
                
                // Check if it has the configured literature note tag
                const tags = frontmatter.tags;
                if (!tags || !Array.isArray(tags) || !tags.includes(this.settings.literatureNoteTag)) {
                    return false;
                }
                
                if (checking) return true;
                
                // Open chapter modal with the current book
                new ChapterModal(this.app, this.settings, activeFile.path).open();
                return true;
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
        
        // Add command to export all references as BibTeX
        this.addCommand({
            id: 'export-bibtex',
            name: 'Export Bibliography as BibTeX',
            callback: async () => {
                try {
                    new Notice('Exporting BibTeX file...');
                    const builder = new BibliographyBuilder(this.app, this.settings);
                    await builder.exportBibTeX();
                } catch (_error) {
                    // Errors are logged by BibliographyBuilder
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