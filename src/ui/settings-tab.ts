import { App, Platform, PluginSettingTab, Setting, normalizePath, setIcon } from 'obsidian';
import BibliographyPlugin from '../../main';
// Note: No need to import CitekeyOptions here anymore

export class BibliographySettingTab extends PluginSettingTab {
        plugin: BibliographyPlugin;

        constructor(app: App, plugin: BibliographyPlugin) {
                super(app, plugin);
                this.plugin = plugin;
        }

        private createFragment(callback: (frag: DocumentFragment) => void): DocumentFragment {
                const fragment = document.createDocumentFragment();
                callback(fragment);
                return fragment;
        }

        display(): void {
                const { containerEl } = this;
                containerEl.empty();

                // General Settings
                new Setting(containerEl).setName('General').setHeading();

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
                        .setDesc('The folder where literature notes will be stored. Use forward slashes for subfolders. Use "/" for vault.')
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
                                        // Refresh display to enable/disable prefix input
                                        this.display();
                                        await this.plugin.saveSettings();
                                }));

                new Setting(containerEl)
                        .setName('Literature note prefix')
                        .setDesc('The prefix to add to literature note filenames (e.g., "@" for "@citation-key.md")')
                        .addText(text => text
                                .setPlaceholder('@')
                                .setValue(this.plugin.settings.notePrefix)
                                .setDisabled(!this.plugin.settings.usePrefix) // Disable if usePrefix is false
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
                
                // Add description listing the available template variables
                const variablesDesc = containerEl.createEl('div', { cls: 'setting-item-description' });
                variablesDesc.innerHTML = `
                <details>
                    <summary>Available template variables</summary>
                    <div class="template-variables-list">
                        <h4>Basic variables</h4>
                        <ul>
                            <li><code>{{title}}</code> - Title of the work</li>
                            <li><code>{{citekey}}</code> - Citation key</li>
                            <li><code>{{year}}</code>, <code>{{month}}</code>, <code>{{day}}</code> - Publication date parts</li>
                            <li><code>{{container-title}}</code> - Journal or book title containing the work</li>
                            <li><code>{{authors}}</code> - Formatted author list</li>
                            <li><code>{{pdflink}}</code> - Path to attached PDF (if any)</li>
                            <li><code>{{DOI}}</code>, <code>{{URL}}</code> - Digital identifiers</li>
                            <li><code>{{publisher}}</code>, <code>{{publisher-place}}</code> - Publisher information</li>
                            <li><code>{{volume}}</code>, <code>{{number}}</code>, <code>{{page}}</code> - Publication details</li>
                            <li><code>{{language}}</code>, <code>{{abstract}}</code>, <code>{{edition}}</code> - Additional metadata</li>
                            <li><code>{{currentDate}}</code> - Today's date (YYYY-MM-DD)</li>
                        </ul>
                        
                        <h4>Contributor variables</h4>
                        <ul>
                            <li><code>{{authors}}</code> - Array of all author names</li>
                            <li><code>{{authors_family}}</code> - Array of author last names only</li>
                            <li><code>{{authors_given}}</code> - Array of author first names only</li>
                            <li><code>{{editors}}</code>, <code>{{translators}}</code>, etc. - Lists for other contributor types</li>
                        </ul>
                        
                        <h4>Formatting options</h4>
                        <ul>
                            <li><code>{{variable|upper}}</code> - UPPERCASE</li>
                            <li><code>{{variable|lower}}</code> - lowercase</li>
                            <li><code>{{variable|capitalize}}</code> - Capitalize First Letter Of Each Word</li>
                            <li><code>{{variable|sentence}}</code> - First letter capitalized only</li>
                            <li><code>{{variable|date}}</code> - Format as date</li>
                        </ul>
                        
                        <h4>Conditionals and loops</h4>
                        <ul>
                            <li><code>{{#variable}}Content shown if variable exists{{/variable}}</code></li>
                            <li><code>{{^variable}}Content shown if variable is empty{{/variable}}</code></li>
                            <li><code>{{#array}}{{.}} is the current item{{/array}}</code> - Loop through arrays</li>
                        </ul>
                    </div>
                </details>
                `;

                new Setting(containerEl)
                        .setName('Header template')
                        .setDesc(this.createFragment((frag: DocumentFragment) => {
                            frag.appendText('Template for the first header in literature notes. Supports variables:');
                            frag.createEl('ul', {}, (ul) => {
                                ul.createEl('li', {}, (li) => {
                                    li.createEl('code', { text: '{{title}}' });
                                    li.appendText(' - The document title');
                                });
                                ul.createEl('li', {}, (li) => {
                                    li.createEl('code', { text: '{{citekey}}' });
                                    li.appendText(' - The citation key/ID');
                                });
                                ul.createEl('li', {}, (li) => {
                                    li.createEl('code', { text: '{{year}}' });
                                    li.appendText(' - The publication year');
                                });
                                ul.createEl('li', {}, (li) => {
                                    li.createEl('code', { text: '{{authors}}' });
                                    li.appendText(' - Formatted author list');
                                });
                                ul.createEl('li', {}, (li) => {
                                    li.createEl('code', { text: '{{pdflink}}' });
                                    li.appendText(' - The raw attachment path (without braces, so you can use ');
                                    li.createEl('code', { text: '[[{{pdflink}}]]' });
                                    li.appendText(' to create a link)');
                                });
                            });
                            frag.appendText('You can also use conditionals like ');
                            frag.createEl('code', { text: '{{^pdflink}}Title if no PDF{{/pdflink}}' });
                        }))
                        .addTextArea(text => text
                                .setPlaceholder('# [[{{pdflink}}]]{{^pdflink}}{{title}}{{/pdflink}}')
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
                                        this.plugin.settings.headerTemplate = '# [[{{pdflink}}]]{{^pdflink}}{{title}}{{/pdflink}}';
                                        await this.plugin.saveSettings();
                                        this.display(); // Refresh the settings page
                                })
                        );

                // Custom Frontmatter Fields Settings
                new Setting(containerEl).setName('Custom frontmatter fields').setHeading();
                
                const customFieldsDesc = containerEl.createEl('div', { 
                    cls: 'setting-item-description'
                });
                
                customFieldsDesc.innerHTML = `
                <p>Define custom frontmatter fields with templated values. These will be added to new literature notes.</p>
                
                <details class="custom-fields-help">
                    <summary>Template syntax and available variables</summary>
                    
                    <h4>Basic syntax</h4>
                    <ul>
                        <li><code>{{variable}}</code> - Insert a variable value</li>
                        <li><code>{{variable|format}}</code> - Format a variable (e.g., <code>{{title|uppercase}}</code>)</li>
                        <li><code>{{#variable}}Show if exists{{/variable}}</code> - Conditional content (shows only if variable exists or is true)</li>
                        <li><code>{{^variable}}Show if missing/empty{{/variable}}</code> - Negative conditional (shows only if variable is missing or empty)</li>
                        <li><code>{{#array}}{{.}} is current item{{/array}}</code> - Iterate through an array</li>
                    </ul>
                    
                    <h4>Common variables</h4>
                    <ul>
                        <li><code>{{title}}</code> - The document title</li>
                        <li><code>{{citekey}}</code> - The citation key/ID</li>
                        <li><code>{{year}}</code> - Publication year</li>
                        <li><code>{{month}}</code>, <code>{{day}}</code> - Publication date parts</li>
                        <li><code>{{authors}}</code> - Formatted author list (e.g., "A. Smith et al.")</li>
                        <li><code>{{pdflink}}</code> - Path to attached PDF file (without brackets)</li>
                        <li><code>{{currentDate}}</code> - Today's date in YYYY-MM-DD format</li>
                    </ul>
                    
                    <h4>CSL variables</h4>
                    <p>All <a href="https://docs.citationstyles.org/en/stable/specification.html#appendix-iv-variables" target="_blank">CSL variables</a> are supported including:</p>
                    <ul>
                        <li><code>{{DOI}}</code>, <code>{{URL}}</code>, <code>{{ISSN}}</code> - Digital identifiers</li>
                        <li><code>{{container-title}}</code> - Journal or book title</li>
                        <li><code>{{volume}}</code>, <code>{{issue}}</code>, <code>{{page}}</code>, <code>{{number}}</code> - Publication details</li>
                        <li><code>{{publisher}}</code>, <code>{{publisher-place}}</code> - Publisher information</li>
                        <li><code>{{abstract}}</code>, <code>{{note}}</code> - Document content</li>
                    </ul>
                    
                    <h4>Contributor lists</h4>
                    <ul>
                        <li><code>{{authors}}</code> - Formatted list of authors (e.g., "A. Smith et al.")</li>
                        <li><code>{{authors_family}}</code> - Array of author last names (e.g., ["Smith", "Jones"])</li>
                        <li><code>{{authors_given}}</code> - Array of author first names (e.g., ["Alex", "Lee"])</li>
                        <li><code>{{#authors_family}}{{.}}{{/authors_family}}</code> - Loop through all author last names</li>
                        <li><code>{{editors}}</code>, <code>{{translators}}</code> - Lists for other contributor types</li>
                    </ul>
                    
                    <h4>Formatting options</h4>
                    <ul>
                        <li><code>{{variable|upper}}</code> or <code>{{variable|uppercase}}</code> - ALL UPPERCASE</li>
                        <li><code>{{variable|lower}}</code> or <code>{{variable|lowercase}}</code> - all lowercase</li>
                        <li><code>{{variable|capitalize}}</code> - Capitalize First Letter Of Each Word</li>
                        <li><code>{{variable|sentence}}</code> - Capitalize first letter only</li>
                        <li><code>{{variable|date}}</code> - Format as date (if possible)</li>
                        <li><code>{{variable|count}}</code> - Count array items (e.g., number of authors)</li>
                    </ul>
                    
                    <h4>Examples</h4>
                    <ul>
                        <li><code>{{#authors_family}}[[Author/{{.}}]]{{^@last}}, {{/@last}}{{/authors_family}}</code> - Create links to all authors</li>
                        <li><code>reading-{{year}}-{{currentDate|date}}</code> - Create reading ID with year and current date</li>
                        <li><code>{{#abstract}}{{abstract|sentence}}{{/abstract}}{{^abstract}}No abstract available{{/abstract}}</code> - Show abstract with fallback</li>
                    </ul>
                </details>
                `;
                
                // Container for custom frontmatter fields
                const customFieldsContainer = containerEl.createDiv({ cls: 'custom-frontmatter-fields-container' });
                
                // Function to add a new field row to the settings
                const addCustomFieldRow = (field: { name: string, template: string, enabled: boolean }, container: HTMLElement) => {
                    const fieldEl = container.createDiv({ cls: 'custom-frontmatter-field' });
                    
                    const fieldSettingEl = new Setting(fieldEl)
                        .addToggle(toggle => toggle
                            .setValue(field.enabled)
                            .onChange(async (value) => {
                                field.enabled = value;
                                await this.plugin.saveSettings();
                            })
                        )
                        .addText(text => text
                            .setPlaceholder('Field name')
                            .setValue(field.name)
                            .onChange(async (value) => {
                                field.name = value;
                                await this.plugin.saveSettings();
                            })
                        )
                        .addTextArea(text => text
                            .setPlaceholder('Template (e.g. {{authors|capitalize}})')
                            .setValue(field.template)
                            .onChange(async (value) => {
                                field.template = value;
                                await this.plugin.saveSettings();
                            })
                        )
                        .addExtraButton(button => button
                            .setIcon('trash')
                            .setTooltip('Delete field')
                            .onClick(async () => {
                                // Remove the field from settings
                                this.plugin.settings.customFrontmatterFields = 
                                    this.plugin.settings.customFrontmatterFields.filter(f => 
                                        f !== field
                                    );
                                await this.plugin.saveSettings();
                                // Remove the UI element
                                fieldEl.remove();
                            })
                        );
                    
                    // Adjust textarea height
                    const textarea = fieldSettingEl.controlEl.querySelector('textarea');
                    if (textarea) {
                        textarea.style.minHeight = '60px';
                    }
                    
                    return fieldEl;
                };
                
                // Add existing custom frontmatter fields
                if (this.plugin.settings.customFrontmatterFields) {
                    this.plugin.settings.customFrontmatterFields.forEach(field => {
                        addCustomFieldRow(field, customFieldsContainer);
                    });
                }
                
                // Add button to add a new custom field
                const addFieldButton = new Setting(containerEl)
                    .setName('Add custom frontmatter field')
                    .addButton(button => button
                        .setButtonText('Add Field')
                        .onClick(async () => {
                            // Create a new field with default values
                            const newField = {
                                name: '',
                                template: '',
                                enabled: true
                            };
                            
                            // Add to settings
                            if (!this.plugin.settings.customFrontmatterFields) {
                                this.plugin.settings.customFrontmatterFields = [];
                            }
                            this.plugin.settings.customFrontmatterFields.push(newField);
                            await this.plugin.saveSettings();
                            
                            // Add to UI
                            addCustomFieldRow(newField, customFieldsContainer);
                        })
                    );
                
                // --- Citekey Generation Settings ---
                new Setting(containerEl).setName('Citekey generation').setHeading();
                containerEl.createEl('p', {
                        text: 'Configure how citekeys are generated for new literature notes.',
                        cls: 'setting-item-description'
                });
				
				// Store the initial state to compare against
				let wasInitiallyEmpty = this.plugin.settings.citekeyOptions.citekeyTemplate === '';

                // New Template Setting
                new Setting(containerEl)
                        .setName('Citekey template')
                        .setDesc(this.createFragment((frag: DocumentFragment) => {
                                frag.appendText('Define a custom template for generating citekeys. Placeholders like ');
                                frag.createEl('code', { text: '[auth]' });
                                frag.appendText(', ');
                                frag.createEl('code', { text: '[year]' });
                                frag.appendText(', ');
                                frag.createEl('code', { text: '[title]' });
                                frag.appendText(', ');
                                frag.createEl('code', { text: '[shorttitle]' });
                                frag.appendText(' will be replaced. Add modifiers like ');
                                frag.createEl('code', { text: ':lower' });
                                frag.appendText(' or ');
                                frag.createEl('code', { text: ':abbr(3)' });
                                frag.appendText('. Example: ');
                                frag.createEl('code', { text: '[auth:lower]_[year]' });
                                frag.appendText('.');
                                frag.createEl('br');
                                frag.appendText('If this field is empty, the legacy options below will be used.');
                                // TODO: Add link to documentation for all placeholders/modifiers
                        }))
					// Inside your display() method where you create the setting:
						.addTextArea(text => text
							.setPlaceholder('[auth][year]')
							.setValue(this.plugin.settings.citekeyOptions.citekeyTemplate)
							.onChange(async (value) => {
								const trimmedValue = value.trim();
								const isEmpty = trimmedValue === '';
								let needsDisplayUpdate = false;

								// Check if the emptiness state changed
								if ((wasInitiallyEmpty && !isEmpty) || (!wasInitiallyEmpty && isEmpty)) {
									needsDisplayUpdate = true;
									wasInitiallyEmpty = isEmpty; // Update the state for the next change
								}

								// Always save the setting on change
								this.plugin.settings.citekeyOptions.citekeyTemplate = trimmedValue;
								await this.plugin.saveSettings();

								// Refresh display only if the emptiness state changed
								if (needsDisplayUpdate) {
									this.display(); // Refresh settings tab
								}
							}));

                // --- Legacy Citekey Options (Show only if template is empty) ---
                if (!this.plugin.settings.citekeyOptions.citekeyTemplate) {
						new Setting(containerEl).setName('Legacy citekey generation').setHeading();
                        const legacySection = containerEl.createDiv(); // Use a container for styling/grouping
                        legacySection.addClass('settings-legacy-citekey'); // Add a class for potential styling
                        legacySection.createEl('p', {
                                text: 'These options are used only when the Citekey template field above is empty.',
                                cls: 'setting-item-description'
                        });

                        // Author format options
                        new Setting(legacySection)
                                .setName('Author name format')
                                .setDesc('Choose how author names are formatted in citekeys')
                                .addDropdown(dropdown => dropdown
                                        .addOptions({
                                                'full': 'Full last name (e.g., "smith2023")',
                                                'firstThree': 'First three letters (e.g., "smi2023")',
                                                'firstFour': 'First four letters (e.g., "smit2023")'
                                        })
                                        .setValue(this.plugin.settings.citekeyOptions.authorAbbreviationStyle)
                                        .onChange(async (value: 'full' | 'firstThree' | 'firstFour') => {
                                                this.plugin.settings.citekeyOptions.authorAbbreviationStyle = value;
                                                await this.plugin.saveSettings();
                                        })
                                );

                        // Multiple authors options
                        new Setting(legacySection)
                                .setName('Include multiple authors')
                                .setDesc('Include information from multiple authors in the citekey')
                                .addToggle(toggle => toggle
                                        .setValue(this.plugin.settings.citekeyOptions.includeMultipleAuthors)
                                        .onChange(async (value) => {
                                                this.plugin.settings.citekeyOptions.includeMultipleAuthors = value;
                                                await this.plugin.saveSettings();
                                                this.display(); // Refresh to show/hide dependent settings
                                        })
                                );

                        // Show dependent options only if 'Include multiple authors' is true
                        if (this.plugin.settings.citekeyOptions.includeMultipleAuthors) {
                                // Two-author style
                                new Setting(legacySection)
                                        .setName('Two-author style')
                                        .setDesc('How to format citekeys with exactly two authors')
                                        .setClass('setting-indent') // Indent this setting
                                        .addDropdown(dropdown => dropdown
                                                .addOptions({
                                                        'and': 'Use "And" (e.g., "smithAndJones2023")',
                                                        'initial': 'Use initial (e.g., "smithJ2023")'
                                                })
                                                .setValue(this.plugin.settings.citekeyOptions.useTwoAuthorStyle)
                                                .onChange(async (value: 'and' | 'initial') => {
                                                        this.plugin.settings.citekeyOptions.useTwoAuthorStyle = value;
                                                        await this.plugin.saveSettings();
                                                })
                                        );

                                // Max authors
                                new Setting(legacySection)
                                        .setName('Maximum authors')
                                        .setDesc('Maximum number of authors to include in the citekey')
                                        .setClass('setting-indent')
                                        .addSlider(slider => slider
                                                .setLimits(1, 5, 1)
                                                .setValue(this.plugin.settings.citekeyOptions.maxAuthors)
                                                .setDynamicTooltip()
                                                .onChange(async (value) => {
                                                        this.plugin.settings.citekeyOptions.maxAuthors = value;
                                                        await this.plugin.saveSettings();
                                                })
                                        );

                                // Et al option
                                new Setting(legacySection)
                                        .setName('Use "EtAl" suffix')
                                        .setDesc('Add "EtAl" when there are more authors than the maximum (e.g., "smithEtAl2023")')
                                        .setClass('setting-indent')
                                        .addToggle(toggle => toggle
                                                .setValue(this.plugin.settings.citekeyOptions.useEtAl)
                                                .onChange(async (value) => {
                                                        this.plugin.settings.citekeyOptions.useEtAl = value;
                                                        await this.plugin.saveSettings();
                                                })
                                        );
                        } // End of 'Include multiple authors' dependent settings

                        // Delimiter settings
                        new Setting(legacySection)
                                .setName('Author-year delimiter')
                                .setDesc('Character to place between author and year (e.g., "_" for "smith_2023")')
                                .addText(text => text
                                        .setPlaceholder('No delimiter')
                                        .setValue(this.plugin.settings.citekeyOptions.authorYearDelimiter)
                                        .onChange(async (value) => {
                                                this.plugin.settings.citekeyOptions.authorYearDelimiter = value;
                                                await this.plugin.saveSettings();
                                        })
                                );

                        // Use Zotero keys (moved inside legacy section as template overrides this)
                        new Setting(legacySection)
                                .setName('Use Zotero keys (if available)')
                                .setDesc('When importing from Zotero, use their citekey instead of generating one using the options above.')
                                .addToggle(toggle => toggle
                                        .setValue(this.plugin.settings.citekeyOptions.useZoteroKeys)
                                        .onChange(async (value) => {
                                                this.plugin.settings.citekeyOptions.useZoteroKeys = value;
                                                await this.plugin.saveSettings();
                                        })
                                );

                        // Advanced options
                        new Setting(legacySection)
                                .setName('Minimum citekey length')
                                .setDesc('Add a random suffix to citekeys shorter than this length')
                                .addSlider(slider => slider
                                        .setLimits(3, 10, 1)
                                        .setValue(this.plugin.settings.citekeyOptions.minCitekeyLength)
                                        .setDynamicTooltip()
                                        .onChange(async (value) => {
                                                this.plugin.settings.citekeyOptions.minCitekeyLength = value;
                                                await this.plugin.saveSettings();
                                        })
                                );

                        new Setting(legacySection)
                                .setName('Short citekey delimiter')
                                .setDesc('Character to place before random suffix for short citekeys (e.g., "_" for "sm_123")')
                                .addText(text => text
                                        .setPlaceholder('No delimiter')
                                        .setValue(this.plugin.settings.citekeyOptions.shortCitekeyDelimiter)
                                        .onChange(async (value) => {
                                                this.plugin.settings.citekeyOptions.shortCitekeyDelimiter = value;
                                                await this.plugin.saveSettings();
                                        })
                                );

                } // End of legacy options block (if !citekeyTemplate)

        } // End of display()
} // End of class BibliographySettingTab

