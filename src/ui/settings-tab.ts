import { App, Platform, PluginSettingTab, Setting, normalizePath } from 'obsidian';
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
        new Setting(containerEl).setName('File paths').setHeading();

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
                
        // Zotero Connector Settings - Only show on desktop
        if (!Platform.isMobile) {
            new Setting(containerEl).setName('Zotero Connector').setHeading();
            
            containerEl.createEl('p', { 
                text: 'Configure settings for the Zotero Connector integration. Note: This feature is only available on desktop.',
                cls: 'setting-item-description'
            });
            
            new Setting(containerEl)
                .setName('Enable Zotero Connector')
                .setDesc('Allow the plugin to receive data from the Zotero Connector browser extension. Note: Zotero should NOT be running when using this feature.')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.enableZoteroConnector)
                    .onChange(async (value) => {
                        this.plugin.settings.enableZoteroConnector = value;
                        await this.plugin.saveSettings();
                        
                        // Start or stop the connector server based on the setting
                        if (value) {
                            this.plugin.startConnectorServer();
                        } else {
                            this.plugin.stopConnectorServer();
                        }
                    }));
                    
            new Setting(containerEl)
                .setName('Connector port')
                .setDesc('The port to use for the Zotero Connector server. Default is 23119, which is the standard Zotero port.')
                .addText(text => text
                    .setPlaceholder('23119')
                    .setValue(this.plugin.settings.zoteroConnectorPort?.toString() || '23119')
                    .onChange(async (value) => {
                        const portNum = parseInt(value.trim());
                        if (!isNaN(portNum) && portNum > 0 && portNum < 65536) {
                            this.plugin.settings.zoteroConnectorPort = portNum;
                            await this.plugin.saveSettings();
                            
                            // Restart the server if it's running
                            if (this.plugin.settings.enableZoteroConnector) {
                                this.plugin.stopConnectorServer();
                                this.plugin.startConnectorServer();
                            }
                        }
                    }));
                    
            new Setting(containerEl)
                .setName('Temporary PDF folder')
                .setDesc('Optional: Specify a custom folder for temporarily storing PDFs downloaded from Zotero. Leave empty to use the system temp directory.')
                .addText(text => text
                    .setPlaceholder('System temp directory')
                    .setValue(this.plugin.settings.tempPdfPath || '')
                    .onChange(async (value) => {
                        this.plugin.settings.tempPdfPath = value.trim();
                        await this.plugin.saveSettings();
                    }));
                    
            // Instructions for using the Zotero Connector
            const instructionsEl = containerEl.createEl('div', { cls: 'setting-item-description' });
            instructionsEl.innerHTML = `
                <h3>How to use the Zotero Connector</h3>
                <ol>
                    <li>Make sure Zotero desktop application is <strong>NOT</strong> running</li>
                    <li>Enable the Zotero Connector option above</li>
                    <li>Use the Zotero Connector browser extension as normal</li>
                    <li>When saving an item, the Zotero Connector will send the data to Obsidian instead of Zotero</li>
                    <li>The Bibliography Modal will open with the data pre-filled</li>
                    <li>Any PDF attachments will be downloaded and automatically linked</li>
                </ol>
                <p>Note: You can toggle this feature with the "Toggle Zotero Connector Server" command.</p>
            `;
        }
                
        // Frontmatter Field Settings
        new Setting(containerEl).setName('Custom frontmatter fields').setHeading();
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
        new Setting(containerEl).setName('Bibliography builder').setHeading();
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
        
        new Setting(containerEl)
            .setName('BibTeX file path')
            .setDesc('Path where to save the exported BibTeX file (relative to vault)')
            .addText(text => text
                .setPlaceholder('biblib/bibliography.bib')
                .setValue(this.plugin.settings.bibtexFilePath)
                .onChange(async (value) => {
                    this.plugin.settings.bibtexFilePath = normalizePath(value.trim());
                    await this.plugin.saveSettings();
                }));
                
        // Note Template Settings
        new Setting(containerEl).setName('Note templates').setHeading();
        containerEl.createEl('p', { 
            text: 'Configure the format of your literature notes.',
            cls: 'setting-item-description'
        });
        
        new Setting(containerEl)
            .setName('Header template')
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
