//@ts-nocheck
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
                        .setDesc(this.createFragment((frag: DocumentFragment) => {
                            frag.appendText('Add authorLink field with Obsidian links to author pages');
                            frag.createEl('br');
                            frag.createEl('span', {
                                text: 'Legacy option: Consider using a custom frontmatter field instead with template:',
                                cls: 'setting-item-description'
                            });
                            frag.createEl('br');
                            frag.createEl('code', {
                                text: '[{{#authors_family}}{{^@first}},{{/@first}}"[[Author/{{.}}]]"{{/authors_family}}]',
                                cls: 'template-example'
                            });
                        }))
                        .addToggle(toggle => toggle
                                .setValue(this.plugin.settings.includeAuthorLink)
                                .onChange(async (value) => {
                                        this.plugin.settings.includeAuthorLink = value;
                                        await this.plugin.saveSettings();
                                }));

                new Setting(containerEl)
                        .setName('Include attachment links')
                        .setDesc(this.createFragment((frag: DocumentFragment) => {
                            frag.appendText('Add attachment field with Obsidian links to attached files');
                            frag.createEl('br');
                            frag.createEl('span', {
                                text: 'Legacy option: Consider using a custom frontmatter field instead with template:',
                                cls: 'setting-item-description'
                            });
                            frag.createEl('br');
                            frag.createEl('code', {
                                text: '{{#pdflink}}[["{{pdflink}}"]]{{/pdflink}}',
                                cls: 'template-example'
                            });
                        }))
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
                    <summary>Template System Guide</summary>
                    <div class="template-variables-list">
                        <h3>BibLib Template System</h3>
                        <p>BibLib uses a powerful, consistent template system across all templatable content (header templates, custom frontmatter fields, and citekeys). The syntax is inspired by Mustache templates and supports simple variable replacement, formatting options, conditionals, and loops.</p>
                        
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
                            <li><code>{{authors}}</code> - Formatted author list (e.g., "A. Smith et al.")</li>
                            <li><code>{{authors_family}}</code> - Array of author last names only</li>
                            <li><code>{{authors_given}}</code> - Array of author first names only</li>
                            <li><code>{{editors}}</code>, <code>{{translators}}</code>, etc. - Lists for other contributor types</li>
                        </ul>
                        
                        <h4>Formatting options</h4>
                        <p>You can format any variable using pipe syntax:</p>
                        <ul>
                            <li><code>{{variable|upper}}</code> or <code>{{variable|uppercase}}</code> - ALL UPPERCASE</li>
                            <li><code>{{variable|lower}}</code> or <code>{{variable|lowercase}}</code> - all lowercase</li>
                            <li><code>{{variable|capitalize}}</code> - Capitalize First Letter Of Each Word</li>
                            <li><code>{{variable|sentence}}</code> - First letter capitalized only</li>
                            <li><code>{{variable|date}}</code> - Format as date</li>
                            <li><code>{{variable|json}}</code> - Format as JSON string</li>
                            <li><code>{{variable|count}}</code> - Count array items</li>
                        </ul>
                        
                        <h4>Special citekey formatters</h4>
                        <p>These formatters are especially useful for citekey generation:</p>
                        <ul>
                            <li><code>{{variable|abbr3}}</code> - First 3 characters</li>
                            <li><code>{{variable|abbr4}}</code> - First 4 characters</li>
                            <li><code>{{title|titleword}}</code> - First significant word of title</li>
                            <li><code>{{title|shorttitle}}</code> - First 3 significant words of title</li>
                        </ul>
                        
                        <h4>Conditionals</h4>
                        <p>You can show content conditionally based on whether a variable exists:</p>
                        <ul>
                            <li><code>{{#variable}}Content shown if variable exists/is truthy{{/variable}}</code></li>
                            <li><code>{{^variable}}Content shown if variable is empty/falsy{{/variable}}</code></li>
                        </ul>
                        
                        <h4>Loops</h4>
                        <p>Loop through array items using # syntax:</p>
                        <ul>
                            <li><code>{{#array}}{{.}} is the current item{{/array}}</code> - Loop through arrays</li>
                            <li>Access loop information: <code>{{@index}}</code> (0-based), <code>{{@first}}</code> (true/false), <code>{{@last}}</code> (true/false)</li>
                            <li>Other loop variables: <code>{{@number}}</code> (1-based), <code>{{@odd}}</code>, <code>{{@even}}</code>, <code>{{@length}}</code></li>
                        </ul>
                        
                        <h4>Example templates</h4>
                        <div class="template-examples">
                            <h5>Header templates</h5>
                            <ul>
                                <li><code># [[{{pdflink}}]]{{^pdflink}}{{title}}{{/pdflink}}</code> - Link to PDF if available, otherwise title</li>
                                <li><code># {{title}} ({{year}}){{#authors}} by {{authors}}{{/authors}}</code> - Title with year and optional authors</li>
                                <li><code># {{citekey}} | {{title}}</code> - Citation key and title</li>
                            </ul>
                            
                            <h5>Custom frontmatter fields</h5>
                            <ul>
                                <li><code>["{{title|sentence}}", "{{authors}} ({{year}})"]</code> - Aliases with title and author+year format</li>
                                <li><code>{{#authors_family}}[[Author/{{.}}]]{{^@last}}, {{/@last}}{{/authors_family}}</code> - Author links with commas</li>
                                <li><code>{{#abstract}}{{abstract|sentence}}{{/abstract}}{{^abstract}}No abstract available{{/abstract}}</code> - Abstract with fallback</li>
                            </ul>
                            
                            <h5>Citekey templates</h5>
                            <ul>
                                <li><code>{{author|lowercase}}{{year}}</code> - Basic author+year format (smithjones2023)</li>
                                <li><code>{{author|abbr3}}{{year}}</code> - Abbreviated author+year (smi2023)</li>
                                <li><code>{{authors_family.0|lowercase}}{{#authors_family.1}}{{authors_family.1|abbr1}}{{/authors_family.1}}{{year}}</code> - First author full name, second author initial if present</li>
                                <li><code>{{author|lowercase}}{{year}}{{title|titleword}}</code> - Author, year, and first significant title word</li>
                            </ul>
                        </div>
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
                    <summary>Custom Frontmatter Fields Guide</summary>
                    
                    <p>Custom frontmatter fields allow you to add any data you want to your literature notes using the same powerful 
                    template system as header templates and citekey generation. Fields will be added to the YAML frontmatter 
                    of your literature notes.</p>
                    
                    <h4>Important notes about custom fields</h4>
                    <ul>
                        <li><strong>JSON Arrays/Objects:</strong> If your template starts with <code>[</code> and ends with <code>]</code>, 
                          or starts with <code>{</code> and ends with <code>}</code>, it will be parsed as JSON. This is useful for 
                          creating arrays or objects in your frontmatter.</li>
                        <li><strong>Accessibility:</strong> Custom frontmatter fields can be queried in Obsidian's search and used by other plugins</li>
                        <li><strong>Field Names:</strong> Use simple, lowercase names without spaces (e.g., <code>reading-status</code>, <code>related-papers</code>)</li>
                    </ul>
                    
                    <h4>Common Use Cases</h4>
                    <table>
                        <tr>
                            <th>Use Case</th>
                            <th>Field Name</th>
                            <th>Template Example</th>
                        </tr>
                        <tr>
                            <td>Multiple aliases</td>
                            <td>aliases</td>
                            <td><code>["{{title|sentence}}", "{{authors}} ({{year}})"]</code></td>
                        </tr>
                        <tr>
                            <td>Author links (as array)</td>
                            <td>author-links</td>
                            <td><code>[{{#authors_family}}{{^@first}},{{/@first}}"[[Author/{{.}}]]"{{/authors_family}}]</code></td>
                        </tr>
                        <tr>
                            <td>Author links (as string)</td>
                            <td>author-links</td>
                            <td><code>{{#authors_family}}[[Author/{{.}}]]{{^@last}}, {{/@last}}{{/authors_family}}</code></td>
                        </tr>
                        <tr>
                            <td>Reading status</td>
                            <td>status</td>
                            <td><code>to-read</code></td>
                        </tr>
                        <tr>
                            <td>Topic tags</td>
                            <td>keywords</td>
                            <td><code>["research", "methodology", "{{container-title|lowercase}}"]</code></td>
                        </tr>
                        <tr>
                            <td>Reading priority</td>
                            <td>priority</td>
                            <td><code>{{#DOI}}high{{/DOI}}{{^DOI}}medium{{/DOI}}</code></td>
                        </tr>
                        <tr>
                            <td>Citation count</td>
                            <td>importance</td>
                            <td><code>{{#authors_family.0}}major{{/authors_family.0}}{{^authors_family.0}}minor{{/authors_family.0}}</code></td>
                        </tr>
                        <tr>
                            <td>Field-specific data</td>
                            <td>field</td>
                            <td><code>{{container-title|lowercase}}</code></td>
                        </tr>
                    </table>
                    
                    <h4>Advanced Template Examples</h4>
                    <ul>
                        <li><strong>Formatted abstract:</strong> <code>{{#abstract}}{{abstract|sentence}}{{/abstract}}{{^abstract}}No abstract available{{/abstract}}</code></li>
                        <li><strong>Citation:</strong> <code>{{authors}} ({{year}}). {{title}}. {{#container-title}}{{container-title}}, {{/container-title}}{{#volume}}{{volume}}{{#number}}({{number}}){{/number}}{{/volume}}{{#page}}, {{page}}{{/page}}.</code></li>
                        <li><strong>Related works:</strong> <code>["{{title|titleword}}-related", "{{#container-title}}{{container-title|lowercase}}-papers{{/container-title}}"]</code></li>
                        <li><strong>MOC inclusion:</strong> <code>[[{{#container-title}}{{container-title}} Papers{{/container-title}}{{^container-title}}Research Papers{{/container-title}}]]</code></li>
                    </ul>
                    
                    <h4>Tips for Custom Frontmatter Fields</h4>
                    <ul>
                        <li>Use <code>[[brackets]]</code> in templates to create Obsidian links</li>
                        <li>Use <code>#hashtags</code> in templates to add inline tags</li>
                        <li>Use <code>{{variable|json}}</code> to properly format complex values</li>
                        <li>Array fields (like <code>aliases</code>) should use valid JSON array syntax: <code>["item1", "item2"]</code></li>
                        <li>Custom fields can be queried in Obsidian search using <code>field:value</code> syntax</li>
                    </ul>
                    
                    <h4>Creating YAML Arrays with Templates</h4>
                    <p>If you want to create a YAML array (not a string) from a template with multiple items, follow these rules:</p>
                    <ul>
                        <li>Your template must <strong>start with <code>[</code> and end with <code>]</code></strong></li>
                        <li>For arrays with fixed items: <code>["item1", "item2", "{{variable}}"]</code></li>
                        <li>For arrays from loop iterations, add commas between items using <code>{{^@first}},{{/@first}}</code>:</li>
                        <li><strong>Example:</strong> <code>[{{#authors_family}}{{^@first}},{{/@first}}"[[Author/{{.}}]]"{{/authors_family}}]</code></li>
                        <li>Make sure items that contain special characters (like spaces or brackets) are quoted</li>
                        <li>This will produce a proper YAML array in frontmatter, not a text string with brackets</li>
                    </ul>
                    
                    <p>See the Template System Guide above for full details on template syntax and available variables.</p>
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
                // Add a detailed guide specific to citekey generation
                const citekeyGuideEl = containerEl.createEl('div', { cls: 'setting-item-description' });
                citekeyGuideEl.innerHTML = `
                <details>
                    <summary>Citekey Generation Guide</summary>
                    <div>
                        <p>Citekeys are unique identifiers for citations, used for cross-referencing in academic writing and knowledge management.
                        BibLib now uses the same powerful template system for citekeys as it uses for other templates.</p>
                        
                        <h4>Common citekey formats:</h4>
                        <table>
                            <tr>
                                <th>Style</th>
                                <th>Template</th>
                                <th>Example</th>
                            </tr>
                            <tr>
                                <td>Author-Year</td>
                                <td><code>{{author|lowercase}}{{year}}</code></td>
                                <td>smith2023</td>
                            </tr>
                            <tr>
                                <td>Author abbreviated</td>
                                <td><code>{{author|abbr3}}{{year}}</code></td>
                                <td>smi2023</td>
                            </tr>
                            <tr>
                                <td>Author-Year-Title</td>
                                <td><code>{{author|lowercase}}{{year}}{{title|titleword}}</code></td>
                                <td>smith2023quantum</td>
                            </tr>
                            <tr>
                                <td>Two authors with initials</td>
                                <td><code>{{authors_family.0|lowercase}}{{#authors_family.1}}{{authors_family.1|abbr1}}{{/authors_family.1}}{{year}}</code></td>
                                <td>smithj2023</td>
                            </tr>
                            <tr>
                                <td>APA-like format</td>
                                <td><code>{{author|capitalize}}{{year}}</code></td>
                                <td>Smith2023</td>
                            </tr>
                        </table>
                        
                        <h4>Most useful variables for citekeys:</h4>
                        <ul>
                            <li><code>{{author}}</code> - First author's last name</li>
                            <li><code>{{authors_family}}</code> - Array of all author last names</li>
                            <li><code>{{year}}</code> - Publication year</li>
                            <li><code>{{title}}</code> - Title (unformatted)</li>
                        </ul>
                        
                        <h4>Special formatters for citekeys:</h4>
                        <ul>
                            <li><code>|lowercase</code> - Convert to lowercase</li>
                            <li><code>|abbr3</code> - Take first 3 characters</li>
                            <li><code>|abbr4</code> - Take first 4 characters</li>
                            <li><code>|titleword</code> - Extract first significant word from title</li>
                        </ul>
                        
                        <h4>Tips:</h4>
                        <ul>
                            <li>Citekeys should be unique across your library</li>
                            <li>Keep citekeys short but descriptive</li>
                            <li>Avoid spaces and special characters</li>
                            <li>Leave the field empty to use legacy options below</li>
                        </ul>
                    </div>
                </details>
                `;
                
                new Setting(containerEl)
                        .setName('Citekey template')
                        .setDesc(this.createFragment((frag: DocumentFragment) => {
                                frag.appendText('Define a custom template for generating citekeys using the unified template system. Example: ');
                                frag.createEl('code', { text: '{{author|lowercase}}{{year}}' });
                                frag.appendText(' produces "smith2023". See the guide above for more examples.');
                                frag.createEl('br');
                                frag.appendText('If this field is empty, the legacy options below will be used.');
                                // Add note about backward compatibility
                                frag.createEl('br');
                                frag.appendText('Note: Old format with square brackets is auto-converted to the new syntax.');
                        }))
                        .addTextArea(text => text
                            .setPlaceholder('{{author}}{{year}}')
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