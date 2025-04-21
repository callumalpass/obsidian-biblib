import { App, PluginSettingTab, Setting, normalizePath } from 'obsidian';
import BibliographyPlugin from '../../main';

export class BibliographySettingTab extends PluginSettingTab {
    plugin: BibliographyPlugin;

    constructor(app: App, plugin: BibliographyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // new Setting(containerEl).setName('BibLib Settings').setHeading();
        // Allow customization of the tag used for literature notes
        new Setting(containerEl)
            .setName('Literature note tag')
            .setDesc('Tag used to identify literature notes in frontmatter')
            .addText(text => text
                .setValue(this.plugin.settings.literatureNoteTag)
                .onChange(async (value) => {
                    this.plugin.settings.literatureNoteTag = value.trim();
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Open note on create')
            .setDesc('Automatically open a newly created literature note in the workspace')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.openNoteOnCreate)
                .onChange(async (value) => {
                    this.plugin.settings.openNoteOnCreate = value;
                    await this.plugin.saveSettings();
                }));

        // File Path Settings
        new Setting(containerEl).setName('File Paths').setHeading();

        new Setting(containerEl)
            .setName('Attachment folder path')
            .setDesc('The folder where PDF and EPUB attachments will be stored. Use forward slashes for subfolders.')
            .addText(text => text
                .setPlaceholder('biblib')
                .setValue(this.plugin.settings.attachmentFolderPath)
                .onChange(async (value) => {
                    value = normalizePath(value.trim());
                    this.plugin.settings.attachmentFolderPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Create subfolder for attachments')
            .setDesc('Create a subfolder for each citation (e.g., biblib/citation-key/citation-key.pdf)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.createAttachmentSubfolder)
                .onChange(async (value) => {
                    this.plugin.settings.createAttachmentSubfolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Literature note location')
            .setDesc('The folder where literature notes will be stored. Use forward slashes for subfolders. Use "/" for vault root.')
            .addText(text => text
                .setPlaceholder('/')
                .setValue(this.plugin.settings.literatureNotePath)
                .onChange(async (value) => {
                    // Normalize path, ensure it ends with a slash for directory
                    value = normalizePath(value.trim());
                    if (value !== '/' && !value.endsWith('/')) value += '/';
                    this.plugin.settings.literatureNotePath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Use prefix for literature notes')
            .setDesc('Add a prefix to literature note filenames')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.usePrefix)
                .onChange(async (value) => {
                    this.plugin.settings.usePrefix = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Literature note prefix')
            .setDesc('The prefix to add to literature note filenames (e.g., "@" for "@citation-key.md")')
            .addText(text => text
                .setPlaceholder('@')
                .setValue(this.plugin.settings.notePrefix)
                .setDisabled(!this.plugin.settings.usePrefix)
                .onChange(async (value) => {
                    this.plugin.settings.notePrefix = value;
                    await this.plugin.saveSettings();
                }));
                
        // API Settings
        new Setting(containerEl).setName('API Settings').setHeading();
        
        new Setting(containerEl)
            .setName('Citoid API URL')
            .setDesc('The URL for the Citoid API to fetch bibliographic data. For DOIs, the plugin will also try CrossRef API as a fallback.')
            .addText(text => text
                .setPlaceholder('https://en.wikipedia.org/api/rest_v1/data/citation/mediawiki/')
                .setValue(this.plugin.settings.citoidApiUrl)
                .onChange(async (value) => {
                    this.plugin.settings.citoidApiUrl = value;
                    await this.plugin.saveSettings();
                }));
                
        // Frontmatter Field Settings
        new Setting(containerEl).setName('Custom Frontmatter Fields').setHeading();
        containerEl.createEl('p', { 
            text: 'Configure which additional non-CSL fields to include in your literature notes.',
            cls: 'setting-item-description'
        });
        
        new Setting(containerEl)
            .setName('Include date created')
            .setDesc('Add a dateCreated field with the current date/time when the note is created')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeDateCreated)
                .onChange(async (value) => {
                    this.plugin.settings.includeDateCreated = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName('Include year field')
            .setDesc('Add a separate year field for easy filtering (in addition to the CSL-standard issued field)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeYear)
                .onChange(async (value) => {
                    this.plugin.settings.includeYear = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName('Include author links')
            .setDesc('Add authorLink field with Obsidian links to author pages')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeAuthorLink)
                .onChange(async (value) => {
                    this.plugin.settings.includeAuthorLink = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName('Include attachment links')
            .setDesc('Add attachment field with Obsidian links to attached files')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeAttachment)
                .onChange(async (value) => {
                    this.plugin.settings.includeAttachment = value;
                    await this.plugin.saveSettings();
                }));
                
        // Bibliography Builder Settings
        new Setting(containerEl).setName('Bibliography Builder').setHeading();
        containerEl.createEl('p', { 
            text: 'Configure settings for the bibliography builder command.',
            cls: 'setting-item-description'
        });
        
        new Setting(containerEl)
            .setName('Bibliography JSON path')
            .setDesc('Path where to save the bibliography.json file (relative to vault)')
            .addText(text => text
                .setPlaceholder('biblib/bibliography.json')
                .setValue(this.plugin.settings.bibliographyJsonPath)
                .onChange(async (value) => {
                    this.plugin.settings.bibliographyJsonPath = normalizePath(value.trim());
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName('Citekey list path')
            .setDesc('Path where to save the citekeylist.md file (relative to vault)')
            .addText(text => text
                .setPlaceholder('citekeylist.md')
                .setValue(this.plugin.settings.citekeyListPath)
                .onChange(async (value) => {
                    this.plugin.settings.citekeyListPath = normalizePath(value.trim());
                    await this.plugin.saveSettings();
                }));
                
        // Note Template Settings
        new Setting(containerEl).setName('Note Templates').setHeading();
        containerEl.createEl('p', { 
            text: 'Configure the format of your literature notes.',
            cls: 'setting-item-description'
        });
        
        new Setting(containerEl)
            .setName('Header Template')
            .setDesc('Template for the first header in literature notes. Supports variables: {{title}}, {{citekey}}, {{year}}, {{authors}}, {{pdflink}}')
            .addTextArea(text => text
                .setPlaceholder('# {{pdflink}}{{^pdflink}}{{title}}{{/pdflink}}')
                .setValue(this.plugin.settings.headerTemplate)
                .onChange(async (value) => {
                    this.plugin.settings.headerTemplate = value;
                    await this.plugin.saveSettings();
                })
            )
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('Reset to default')
                .onClick(async () => {
                    this.plugin.settings.headerTemplate = '# {{pdflink}}{{^pdflink}}{{title}}{{/pdflink}}';
                    await this.plugin.saveSettings();
                    this.display(); // Refresh the settings page
                })
            );
    }
}
