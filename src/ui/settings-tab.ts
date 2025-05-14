import { App, Platform, PluginSettingTab, Setting, normalizePath, setIcon } from 'obsidian';
import BibliographyPlugin from '../../main';

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

	// Helper function to create list items with code and text
	private createListItem(parent: HTMLElement, codeText: string, description: string) {
		parent.createEl('li', {}, (li) => {
			li.createEl('code', { text: codeText });
			// Only add description if it exists
			if (description) {
				li.appendText(` - ${description}`);
			}
		});
	}

	// Helper function to create table rows
	private createTableRow(parent: HTMLElement, cells: string[], isHeader: boolean = false) {
		parent.createEl('tr', {}, (tr) => {
			cells.forEach((cellText) => {
				const cellType = isHeader ? 'th' : 'td';
				tr.createEl(cellType, {}, (cell) => {
					// Basic check if the text might be a template code
					if (cellText.includes('{{') || cellText.includes('|') || cellText.includes('`') || cellText.startsWith('[')) {
						// Render as code if it looks like a template or starts with [ (for JSON examples)
						cell.createEl('code', { text: cellText });
					} else {
						cell.appendText(cellText);
					}
				});
			});
		});
	}


	display(): void {
		const { containerEl } = this;
		containerEl.empty();


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

		// --- File Path Settings ---
		new Setting(containerEl).setName('File paths').setHeading();

		new Setting(containerEl)
			.setName('Attachment folder path')
			.setDesc('The folder where attachment files (PDFs, EPUBs, and other file types) will be stored. Use forward slashes for subfolders.')
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
					value = normalizePath(value.trim());
					if (value !== '/' && !value.endsWith('/')) value += '/';
					this.plugin.settings.literatureNotePath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Filename template')
			.setDesc(this.createFragment((frag: DocumentFragment) => {
				frag.appendText('Template for generating literature note filenames. Uses the same template system as headers and frontmatter.');
				frag.createEl('br');
				frag.appendText('Examples:');
				const ul = frag.createEl('ul');
				this.createListItem(ul, '@{{citekey}}', 'Standard citekey with @ prefix');
				this.createListItem(ul, '{{year}}-{{citekey}}', 'Year and citekey (2023-smith)');
				this.createListItem(ul, '{{type}}/{{citekey}}', 'Type-based folders (article/smith2023)');
				this.createListItem(ul, '{{citekey}} - {{title|capitalize}}', 'Citekey with title');
			}))
			.addTextArea(text => text
				.setPlaceholder('@{{citekey}}')
				.setValue(this.plugin.settings.filenameTemplate)
				.onChange(async (value) => {
					this.plugin.settings.filenameTemplate = value;
					await this.plugin.saveSettings();
				})
			)
			.addExtraButton(button => button
				.setIcon('reset')
				.setTooltip('Reset to default')
				.onClick(async () => {
					this.plugin.settings.filenameTemplate = '@{{citekey}}';
					await this.plugin.saveSettings();
					this.display(); // Refresh the settings page
				})
			);


		// --- Zotero Connector Settings ---
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

			// Instructions for using the Zotero Connector (using createEl)
			const instructionsEl = containerEl.createEl('div', { cls: 'setting-item-description' });
			// Use strong for visual hierarchy without semantic heading
			instructionsEl.createEl('strong', { text: 'How to use the Zotero Connector', cls:'setting-guide-subtitle' });
			const ol = instructionsEl.createEl('ol');
			ol.createEl('li', {}, (li) => {
				li.appendText('Make sure Zotero desktop application is ');
				li.createEl('strong', { text: 'NOT' });
				li.appendText(' running');
			});
			ol.createEl('li', { text: 'Enable the Zotero Connector option above' });
			ol.createEl('li', { text: 'Use the Zotero Connector browser extension as normal' });
			ol.createEl('li', { text: 'When saving an item, the Zotero Connector will send the data to Obsidian instead of Zotero' });
			ol.createEl('li', { text: 'The Bibliography Modal will open with the data pre-filled' });
			ol.createEl('li', { text: 'Any PDF attachments will be downloaded and automatically linked' });
			instructionsEl.createEl('p', { text: 'Note: You can toggle this feature with the "Toggle Zotero Connector Server" command.' });
		}

		// --- Bibliography Builder Settings ---
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

		// --- Note Template Settings ---
		new Setting(containerEl).setName('Note templates').setHeading();
		containerEl.createEl('p', {
			text: 'Configure the format of your literature notes.',
			cls: 'setting-item-description'
		});

		// --- Template System Guide ---
		const variablesDesc = containerEl.createEl('div', { cls: 'setting-item-description' });
		const detailsEl = variablesDesc.createEl('details');
		detailsEl.createEl('summary', { text: 'Template system guide' });
		const guideDiv = detailsEl.createEl('div', { cls: 'template-variables-list' });

		// Removed top-level title to match middle guide structure
		guideDiv.createEl('p', { text: 'BibLib uses a powerful, consistent template system across all templatable content (header templates, custom frontmatter fields, and citekeys). The syntax is inspired by Mustache templates and supports simple variable replacement, formatting options, conditionals, and loops.' });

		guideDiv.createEl('strong', { text: 'Basic variables', cls:'setting-guide-subtitle' });
		const basicVarsUl = guideDiv.createEl('ul');
		this.createListItem(basicVarsUl, '{{title}}', 'Title of the work');
		this.createListItem(basicVarsUl, '{{citekey}}', 'Citation key');
		this.createListItem(basicVarsUl, '{{year}}, {{month}}, {{day}}', 'Publication date parts');
		this.createListItem(basicVarsUl, '{{container-title}}', 'Journal or book title containing the work');
		this.createListItem(basicVarsUl, '{{authors}}', 'Formatted author list');
		this.createListItem(basicVarsUl, '{{pdflink}}', 'Path to attached PDF (if any)');
		this.createListItem(basicVarsUl, '{{DOI}}, {{URL}}', 'Digital identifiers');
		this.createListItem(basicVarsUl, '{{publisher}}, {{publisher-place}}', 'Publisher information');
		this.createListItem(basicVarsUl, '{{volume}}, {{number}}, {{page}}', 'Publication details');
		this.createListItem(basicVarsUl, '{{language}}, {{abstract}}, {{edition}}', 'Additional metadata');
		this.createListItem(basicVarsUl, '{{currentDate}}', "Today's date (YYYY-MM-DD)");
		this.createListItem(basicVarsUl, '{{currentTime}}', "Current time in ISO format (HH:MM:SS)");
		this.createListItem(basicVarsUl, '{{annote_content}}', "Content from BibTeX annote field (bulk import only)");

		guideDiv.createEl('strong', { text: 'Contributor variables', cls:'setting-guide-subtitle' });
		const contribVarsUl = guideDiv.createEl('ul');
		this.createListItem(contribVarsUl, '{{authors}}', 'Formatted author list (e.g., "A. Smith et al.")');
		this.createListItem(contribVarsUl, '{{authors_family}}', 'Array of author last names only');
		this.createListItem(contribVarsUl, '{{authors_given}}', 'Array of author first names only');
		this.createListItem(contribVarsUl, '{{editors}}, {{translators}}, etc.', 'Lists for other contributor types');

		guideDiv.createEl('strong', { text: 'Linking variables', cls:'setting-guide-subtitle' });
		const linkingVarsUl = guideDiv.createEl('ul');
		this.createListItem(linkingVarsUl, '{{links}}', 'Array of Obsidian wikilinks to selected related notes (e.g., ["[[Note A]]", "[[Folder/Note B]]"]).');
		this.createListItem(linkingVarsUl, '{{linkPaths}}', 'Array of raw file paths for selected related notes (e.g., ["Note A.md", "Folder/Note B.md"]).');
		this.createListItem(linkingVarsUl, '{{links_string}}', 'Comma-separated string of Obsidian wikilinks (e.g., "[[Note A]], [[Folder/Note B]]").');


		guideDiv.createEl('strong', { text: 'Formatting options', cls:'setting-guide-subtitle' });
		guideDiv.createEl('p', { text: 'You can format any variable using pipe syntax:' });
		const formatOptsUl = guideDiv.createEl('ul');
		this.createListItem(formatOptsUl, '{{variable|upper}} or {{variable|uppercase}}', 'ALL UPPERCASE');
		this.createListItem(formatOptsUl, '{{variable|lower}} or {{variable|lowercase}}', 'all lowercase');
		this.createListItem(formatOptsUl, '{{variable|capitalize}}', 'Capitalize First Letter Of Each Word');
		this.createListItem(formatOptsUl, '{{variable|sentence}}', 'First letter capitalized only');
		this.createListItem(formatOptsUl, '{{variable|date}}', 'Format as date');
		this.createListItem(formatOptsUl, '{{variable|json}}', 'Format as JSON string');
		this.createListItem(formatOptsUl, '{{variable|count}}', 'Count array items');
		this.createListItem(formatOptsUl, '{{rand|3}} or {{rand3}}', 'Generate random alphanumeric string (length 3)');

		guideDiv.createEl('strong', { text: 'Special citekey formatters', cls:'setting-guide-subtitle' });
		guideDiv.createEl('p', { text: 'These formatters are especially useful for citekey generation:' });
		const citekeyFormatOptsUl = guideDiv.createEl('ul');
		this.createListItem(citekeyFormatOptsUl, '{{variable|abbr3}}', 'First 3 characters');
		this.createListItem(citekeyFormatOptsUl, '{{variable|abbr4}}', 'First 4 characters');
		this.createListItem(citekeyFormatOptsUl, '{{title|titleword}}', 'First significant word of title');
		this.createListItem(citekeyFormatOptsUl, '{{title|shorttitle}}', 'First 3 significant words of title');

		guideDiv.createEl('strong', { text: 'Conditionals', cls:'setting-guide-subtitle' });
		guideDiv.createEl('p', { text: 'You can show content conditionally based on whether a variable exists:' });
		const conditionalsUl = guideDiv.createEl('ul');
		this.createListItem(conditionalsUl, '{{#variable}}Content shown if variable exists/is truthy{{/variable}}', '');
		this.createListItem(conditionalsUl, '{{^variable}}Content shown if variable is empty/falsy{{/variable}}', '');

		guideDiv.createEl('strong', { text: 'Loops', cls:'setting-guide-subtitle' });
		guideDiv.createEl('p', { text: 'Loop through array items using # syntax:' });
		const loopsUl = guideDiv.createEl('ul');
		this.createListItem(loopsUl, '{{#array}}{{.}} is the current item{{/array}}', 'Loop through arrays');
		this.createListItem(loopsUl, '{{@index}} (0-based), {{@first}} (true/false), {{@last}} (true/false)', 'Access loop information');
		this.createListItem(loopsUl, '{{@number}} (1-based), {{@odd}}, {{@even}}, {{@length}}', 'Other loop variables');

		guideDiv.createEl('strong', { text: 'Example templates', cls:'setting-guide-subtitle' });
		const examplesDiv = guideDiv.createEl('div', { cls: 'template-examples' });

		// Changed nested strong tags to simple paragraphs
		examplesDiv.createEl('p', { text: 'Header templates:' });
		const headerExamplesUl = examplesDiv.createEl('ul');
		this.createListItem(headerExamplesUl, '# [[{{pdflink}}]]{{^pdflink}}{{title}}{{/pdflink}}', 'Link to PDF if available, otherwise title');
		this.createListItem(headerExamplesUl, '# {{title}} ({{year}}){{#authors}} by {{authors}}{{/authors}}', 'Title with year and optional authors');
		this.createListItem(headerExamplesUl, '# {{citekey}} | {{title}}', 'Citation key and title');

		examplesDiv.createEl('p', { text: 'Custom frontmatter fields:' });
		const fmExamplesUl = examplesDiv.createEl('ul');
		this.createListItem(fmExamplesUl, '["{{title|sentence}}", "{{authors}} ({{year}})"]', 'Aliases with title and author+year format');
		this.createListItem(fmExamplesUl, '{{#authors_family}}[[Author/{{.}}]]{{^@last}}, {{/@last}}{{/authors_family}}', 'Author links with commas');
		this.createListItem(fmExamplesUl, '{{#abstract}}{{abstract|sentence}}{{/abstract}}{{^abstract}}No abstract available{{/abstract}}', 'Abstract with fallback');

		examplesDiv.createEl('p', { text: 'Citekey templates:' });
		const citekeyExamplesUl = examplesDiv.createEl('ul');
		this.createListItem(citekeyExamplesUl, '{{author|lowercase}}{{year}}', 'Basic author+year format (smithjones2023)');
		this.createListItem(citekeyExamplesUl, '{{author|abbr3}}{{year}}', 'Abbreviated author+year (smi2023)');
		this.createListItem(citekeyExamplesUl, '{{authors_family.0|lowercase}}{{#authors_family.1}}{{authors_family.1|abbr1}}{{/authors_family.1}}{{year}}', 'First author full name, second author initial if present');
		this.createListItem(citekeyExamplesUl, '{{author|lowercase}}{{year}}{{title|titleword}}', 'Author, year, and first significant title word');


		// --- Header Template Setting ---
		new Setting(containerEl)
			.setName('Header template')
			.setDesc(this.createFragment((frag: DocumentFragment) => {
				frag.appendText('Template for the first header in literature notes. Supports variables:');
				const ul = frag.createEl('ul');
				this.createListItem(ul, '{{title}}', 'The document title');
				this.createListItem(ul, '{{citekey}}', 'The citation key/ID');
				this.createListItem(ul, '{{year}}', 'The publication year');
				this.createListItem(ul, '{{authors}}', 'Formatted author list');
				ul.createEl('li', {}, (li) => {
					li.createEl('code', { text: '{{pdflink}}' });
					li.appendText(' - The raw attachment path (without braces, so you can use ');
					li.createEl('code', { text: '[[{{pdflink}}]]' });
					li.appendText(' to create a link)');
				});
				frag.createEl('br');
				frag.appendText('You can also use conditionals like ');
				frag.createEl('code', { text: '{{^pdflink}}Title if no PDF{{/pdflink}}' });
				frag.appendText('.');
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

		// --- Custom Frontmatter Fields Settings ---
		new Setting(containerEl).setName('Custom frontmatter fields').setHeading();

		const customFieldsDesc = containerEl.createEl('div', {
			cls: 'setting-item-description'
		});

		customFieldsDesc.createEl('p', { text: 'Define custom frontmatter fields with templated values. These will be added to new literature notes.' });

		// Add warning outside the collapsible guide so it's always visible
		customFieldsDesc.createEl('p', {}, (p) => {
			p.createEl('strong', { text: 'Warning: ' });
			p.appendText('Do not define templates for CSL-standard fields, as doing so may produce invalid bibliography files. ');
			p.createEl('a', { 
				text: 'See the CSL specification',
				href: 'https://docs.citationstyles.org/en/stable/specification.html#appendix-iv-variables'
			});
			p.appendText(' for a list of standard variables.');
		});

		const customFieldsDetails = customFieldsDesc.createEl('details', { cls: 'custom-fields-help' });
		customFieldsDetails.createEl('summary', { text: 'Custom frontmatter fields guide' });
        const customFieldsGuideDiv = customFieldsDetails.createEl('div'); // Container for the guide content

		customFieldsGuideDiv.createEl('p', { text: 'Custom frontmatter fields allow you to add any data you want to your literature notes using the same powerful template system as header templates and citekey generation. Fields will be added to the YAML frontmatter of your literature notes.' });

		customFieldsGuideDiv.createEl('p', {}, (p) => {
			p.createEl('strong', { text: 'Warning: ' });
			p.appendText('While custom fields offer flexibility, remember that the core strength of bibliographic data lies in standardized formats like CSL-JSON. Custom fields may not necessarily be readable by external CSL tools (like Zotero or reference managers) that expect standard fields. Prioritize using standard fields where possible.');
		});


		customFieldsGuideDiv.createEl('strong', { text: 'Important notes about custom fields', cls:'setting-guide-subtitle' });
		const notesUl = customFieldsGuideDiv.createEl('ul');
		notesUl.createEl('li', {}, (li) => {
			li.createEl('strong', { text: 'JSON Arrays/Objects: ' });
			li.appendText('If your template starts with ');
			li.createEl('code', { text: '[' });
			li.appendText(' and ends with ');
			li.createEl('code', { text: ']' });
			li.appendText(', or starts with ');
			li.createEl('code', { text: '{' });
			li.appendText(' and ends with ');
			li.createEl('code', { text: '}' });
			li.appendText(', it will be parsed as JSON. This is useful for creating arrays or objects in your frontmatter.');
		});
		notesUl.createEl('li', {}, (li) => {
			li.createEl('strong', { text: 'Accessibility: ' });
			li.appendText('Custom frontmatter fields can be queried in Obsidian\'s search and used by other plugins');
		});
		notesUl.createEl('li', {}, (li) => {
			li.createEl('strong', { text: 'Field names: ' });
			li.appendText('Use simple, lowercase names without spaces (e.g., ');
			li.createEl('code', { text: 'reading-status' });
			li.appendText(', ');
			li.createEl('code', { text: 'related-papers' });
			li.appendText(')');
		});

		customFieldsGuideDiv.createEl('strong', { text: 'Common use cases', cls:'setting-guide-subtitle' });
		const useCasesTable = customFieldsGuideDiv.createEl('table');
		const useCasesTHead = useCasesTable.createEl('thead');
		this.createTableRow(useCasesTHead, ['Use case', 'Field name', 'Template example'], true);
		const useCasesTBody = useCasesTable.createEl('tbody');
		this.createTableRow(useCasesTBody, ['Multiple aliases', 'aliases', '["{{title|sentence}}", "{{authors}} ({{year}})"]']);
		this.createTableRow(useCasesTBody, ['Author links (as array)', 'author-links', '[{{#authors_family}}{{^@first}},{{/@first}}"[[Author/{{.}}]]"{{/authors_family}}]']);
		this.createTableRow(useCasesTBody, ['Author links (as string)', 'author-links', '{{#authors_family}}[[Author/{{.}}]]{{^@last}}, {{/@last}}{{/authors_family}}']);
		this.createTableRow(useCasesTBody, ['Reading status', 'status', 'to-read']);
		this.createTableRow(useCasesTBody, ['Topic tags', 'keywords', '["research", "methodology", "{{container-title|lowercase}}"]']);
		this.createTableRow(useCasesTBody, ['Reading priority', 'priority', '{{#DOI}}high{{/DOI}}{{^DOI}}medium{{/DOI}}']);
		this.createTableRow(useCasesTBody, ['Citation count', 'importance', '{{#authors_family.0}}major{{/authors_family.0}}{{^authors_family.0}}minor{{/authors_family.0}}']);
		this.createTableRow(useCasesTBody, ['Field-specific data', 'field', '{{container-title|lowercase}}']);

		customFieldsGuideDiv.createEl('strong', { text: 'Advanced template examples', cls:'setting-guide-subtitle' });
		const advancedUl = customFieldsGuideDiv.createEl('ul');
		advancedUl.createEl('li', {}, (li) => {
			li.createEl('strong', { text: 'Formatted abstract: ' });
			li.createEl('code', { text: '{{#abstract}}{{abstract|sentence}}{{/abstract}}{{^abstract}}No abstract available{{/abstract}}' });
		});
		advancedUl.createEl('li', {}, (li) => {
			li.createEl('strong', { text: 'Citation: ' });
			li.createEl('code', { text: '{{authors}} ({{year}}). {{title}}. {{#container-title}}{{container-title}}, {{/container-title}}{{#volume}}{{volume}}{{#number}}({{number}}){{/number}}{{/volume}}{{#page}}, {{page}}{{/page}}.' });
		});
		advancedUl.createEl('li', {}, (li) => {
			li.createEl('strong', { text: 'Related works: ' });
			li.createEl('code', { text: '["{{title|titleword}}-related", "{{#container-title}}{{container-title|lowercase}}-papers{{/container-title}}"]' });
		});
		advancedUl.createEl('li', {}, (li) => {
			li.createEl('strong', { text: 'MOC inclusion: ' });
			li.createEl('code', { text: '[[{{#container-title}}{{container-title}} Papers{{/container-title}}{{^container-title}}Research Papers{{/container-title}}]]' });
		});

		customFieldsGuideDiv.createEl('strong', { text: 'Tips for custom frontmatter fields', cls:'setting-guide-subtitle' });
		const tipsUl = customFieldsGuideDiv.createEl('ul');
		tipsUl.createEl('li', { text: 'Use [[brackets]] in templates to create Obsidian links' });
		tipsUl.createEl('li', { text: 'Use #hashtags in templates to add inline tags' });
		tipsUl.createEl('li', {}, (li) => {
			li.appendText('Use ');
			li.createEl('code', { text: '{{variable|json}}' });
			li.appendText(' to properly format complex values');
		});
		tipsUl.createEl('li', {}, (li) => {
			li.appendText('Array fields (like ');
			li.createEl('code', { text: 'aliases' });
			li.appendText(') should use valid JSON array syntax: ');
			li.createEl('code', { text: '["item1", "item2"]' });
		});
		tipsUl.createEl('li', {}, (li) => {
			li.appendText('Custom fields can be queried in Obsidian search using ');
			li.createEl('code', { text: 'field:value' });
			li.appendText(' syntax');
		});

		customFieldsGuideDiv.createEl('strong', { text: 'Creating YAML arrays with templates', cls:'setting-guide-subtitle' });
		customFieldsGuideDiv.createEl('p', { text: 'If you want to create a YAML array (not a string) from a template with multiple items, follow these rules:' });
		const yamlArrayUl = customFieldsGuideDiv.createEl('ul');
		yamlArrayUl.createEl('li', {}, (li) => {
			li.appendText('Your template must ');
			li.createEl('strong', { text: 'start with ' });
			li.createEl('code', { text: '[' });
			li.createEl('strong', { text: ' and end with ' });
			li.createEl('code', { text: ']' });
		});
		yamlArrayUl.createEl('li', {}, (li) => {
			li.appendText('For arrays with fixed items: ');
			li.createEl('code', { text: '["item1", "item2", "{{variable}}"]' });
		});
		yamlArrayUl.createEl('li', {}, (li) => {
			li.appendText('For arrays from loop iterations, add commas between items using ');
			li.createEl('code', { text: '{{^@first}},{{/@first}}' });
			li.appendText(':');
		});
		yamlArrayUl.createEl('li', {}, (li) => {
			li.createEl('strong', { text: 'Example: ' });
			li.createEl('code', { text: '[{{#authors_family}}{{^@first}},{{/@first}}"[[Author/{{.}}]]"{{/authors_family}}]' });
		});
		yamlArrayUl.createEl('li', { text: 'Make sure items that contain special characters (like spaces or brackets) are quoted' });
		yamlArrayUl.createEl('li', { text: 'This will produce a proper YAML array in frontmatter, not a text string with brackets' });

		customFieldsGuideDiv.createEl('p', { text: 'See the Template System Guide above for full details on template syntax and available variables.' });

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

			// No need to adjust textarea height through JavaScript
			// We'll use CSS classes for consistent styling

			return fieldEl;
		};

		// Add existing custom frontmatter fields
		if (this.plugin.settings.customFrontmatterFields) {
			this.plugin.settings.customFrontmatterFields.forEach(field => {
				addCustomFieldRow(field, customFieldsContainer);
			});
		}

		// Add button to add a new custom field
		new Setting(containerEl)
			.setName('Add custom frontmatter field')
			.addButton(button => button
				.setButtonText('Add field')
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

		// --- Citekey Generation Guide ---
		const citekeyGuideEl = containerEl.createEl('div', { cls: 'setting-item-description' });
		const citekeyDetails = citekeyGuideEl.createEl('details');
		citekeyDetails.createEl('summary', { text: 'Citekey generation guide' });
		const citekeyGuideDiv = citekeyDetails.createEl('div');

		// Removed introductory paragraph to match middle guide structure
		citekeyGuideDiv.createEl('p', { text: 'Citekeys are unique identifiers for citations, used for cross-referencing in academic writing and knowledge management. BibLib now uses the same powerful template system for citekeys as it uses for other templates.' });

		citekeyGuideDiv.createEl('strong', { text: 'Common citekey formats:', cls:'setting-guide-subtitle' });
		const citekeyTable = citekeyGuideDiv.createEl('table');
		const citekeyTHead = citekeyTable.createEl('thead');
		this.createTableRow(citekeyTHead, ['Style', 'Template', 'Example'], true);
		const citekeyTBody = citekeyTable.createEl('tbody');
		this.createTableRow(citekeyTBody, ['Author-Year', '{{author|lowercase}}{{year}}', 'smith2023']);
		this.createTableRow(citekeyTBody, ['Author abbreviated', '{{author|abbr3}}{{year}}', 'smi2023']);
		this.createTableRow(citekeyTBody, ['Author-Year-Title', '{{author|lowercase}}{{year}}{{title|titleword}}', 'smith2023quantum']);
		this.createTableRow(citekeyTBody, ['Two authors with initials', '{{authors_family.0|lowercase}}{{#authors_family.1}}{{authors_family.1|abbr1}}{{/authors_family.1}}{{year}}', 'smithj2023']);
		this.createTableRow(citekeyTBody, ['APA-like format', '{{author|capitalize}}{{year}}', 'Smith2023']);

		citekeyGuideDiv.createEl('strong', { text: 'Most useful variables for citekeys:', cls:'setting-guide-subtitle' });
		const usefulCitekeyVarsUl = citekeyGuideDiv.createEl('ul');
		this.createListItem(usefulCitekeyVarsUl, '{{author}}', "First author's last name");
		this.createListItem(usefulCitekeyVarsUl, '{{authors_family}}', 'Array of all author last names');
		this.createListItem(usefulCitekeyVarsUl, '{{year}}', 'Publication year');
		this.createListItem(usefulCitekeyVarsUl, '{{title}}', 'Title (unformatted)');

		citekeyGuideDiv.createEl('strong', { text: 'Special formatters for citekeys:', cls:'setting-guide-subtitle' });
		const specialCitekeyFormattersUl = citekeyGuideDiv.createEl('ul');
		this.createListItem(specialCitekeyFormattersUl, '|lowercase', 'Convert to lowercase');
		this.createListItem(specialCitekeyFormattersUl, '|abbr3', 'Take first 3 characters');
		this.createListItem(specialCitekeyFormattersUl, '|abbr4', 'Take first 4 characters');
		this.createListItem(specialCitekeyFormattersUl, '|titleword', 'Extract first significant word from title');

		citekeyGuideDiv.createEl('strong', { text: 'Tips:', cls:'setting-guide-subtitle' });
		const citekeyTipsUl = citekeyGuideDiv.createEl('ul');
		citekeyTipsUl.createEl('li', { text: 'Citekeys should be unique across your library' });
		citekeyTipsUl.createEl('li', { text: 'Keep citekeys short but descriptive' });
		citekeyTipsUl.createEl('li', { text: 'Avoid spaces and special characters' });
		citekeyTipsUl.createEl('li', { text: 'Leave the field empty to use legacy options below' });


		// --- Citekey Template Setting ---
		new Setting(containerEl)
			.setName('Citekey template')
			.setDesc(this.createFragment((frag: DocumentFragment) => {
				frag.appendText('Define a custom template for generating citekeys using the unified template system. Example: ');
				frag.createEl('code', { text: '{{author|lowercase}}{{year}}' });
				frag.appendText(' produces "smith2023". See the guide above for more examples.');
				frag.createEl('br');
				frag.appendText('If this field is empty, the legacy options below will be used.');
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

		// --- Bulk Import Settings ---
		new Setting(containerEl).setName('Bulk import').setHeading();
		containerEl.createEl('p', {
			text: 'Configure how bulk imports from BibTeX (.bib) or CSL-JSON (.json) files behave.',
			cls: 'setting-item-description'
		});

		// Attachment handling
		new Setting(containerEl)
			.setName('Attachment handling')
			.setDesc('Choose how to handle attachments during bulk import')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'none': 'Ignore attachments',
					'import': 'Import attachments to vault'
				})
				.setValue(this.plugin.settings.bulkImportAttachmentHandling)
				.onChange(async (value: 'none' | 'import') => {
					this.plugin.settings.bulkImportAttachmentHandling = value;
					await this.plugin.saveSettings();
				})
			);

		// Annote to body
		new Setting(containerEl)
			.setName('Include annotations in note body')
			.setDesc('Include content from BibTeX "annote" field in the body of literature notes')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.bulkImportAnnoteToBody)
				.onChange(async (value) => {
					this.plugin.settings.bulkImportAnnoteToBody = value;
					await this.plugin.saveSettings();
				})
			);

		// Citekey preference
		new Setting(containerEl)
			.setName('Citekey preference')
			.setDesc('Choose whether to use citekeys from the import file or generate new ones')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'imported': 'Use imported citekeys',
					'generate': 'Generate new citekeys'
				})
				.setValue(this.plugin.settings.bulkImportCitekeyPreference)
				.onChange(async (value: 'imported' | 'generate') => {
					this.plugin.settings.bulkImportCitekeyPreference = value;
					await this.plugin.saveSettings();
				})
			);

		// Conflict resolution
		new Setting(containerEl)
			.setName('Conflict resolution')
			.setDesc('What to do when a literature note with the same citekey already exists')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'skip': 'Skip existing notes',
					'overwrite': 'Overwrite existing notes'
				})
				.setValue(this.plugin.settings.bulkImportConflictResolution)
				.onChange(async (value: 'skip' | 'overwrite') => {
					this.plugin.settings.bulkImportConflictResolution = value;
					await this.plugin.saveSettings();
				})
			);

	} // End of display()
} // End of class BibliographySettingTab
