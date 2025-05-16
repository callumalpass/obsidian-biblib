import { App, Platform, PluginSettingTab, Setting, TextAreaComponent, normalizePath, setIcon, Notice } from 'obsidian';
import BibliographyPlugin from '../../main';
import { CSL_ALL_CSL_FIELDS } from '../utils/csl-variables';
import { TemplatePlaygroundComponent } from './components/template-playground';

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

		// ==================== General Settings Section ====================
		this.renderGeneralSettings(containerEl);

		// ==================== File Path Settings Section ====================
		this.renderFilePathSettings(containerEl);

		// ==================== Template System Section ====================
		this.renderTemplatesSection(containerEl);

		// ==================== Citekey Generation Section ====================
		this.renderCitekeyGenerationSection(containerEl);

		// ==================== Custom Frontmatter Fields Section ====================
		this.renderCustomFrontmatterFieldsSection(containerEl);

		// ==================== Zotero Connector Section ====================
		if (!Platform.isMobile) {
			this.renderZoteroConnectorSection(containerEl);
		}

		// ==================== Bibliography Builder Section ====================
		this.renderBibliographyBuilderSection(containerEl);
	}

	/**
	 * Renders general settings section
	 */
	private renderGeneralSettings(containerEl: HTMLElement): void {
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
	}

	/**
	 * Renders file path settings section
	 */
	private renderFilePathSettings(containerEl: HTMLElement): void {
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

		// Filename template with preview
		const filenameTemplateContainer = containerEl.createDiv();
		let filenameTemplateField: TextAreaComponent | null = null;

		// Create setting with textarea
		new Setting(filenameTemplateContainer)
			.setName('Filename template')
			.setDesc('Template for generating literature note filenames. Uses the same template system as headers and frontmatter.')
			.addTextArea(text => {
				filenameTemplateField = text
					.setPlaceholder('@{{citekey}}')
					.setValue(this.plugin.settings.filenameTemplate)
					.onChange(async (value) => {
						this.plugin.settings.filenameTemplate = value;
						await this.plugin.saveSettings();
					});
				return filenameTemplateField;
			})
			.addExtraButton(button => button
				.setIcon('reset')
				.setTooltip('Reset to default')
				.onClick(async () => {
					this.plugin.settings.filenameTemplate = '@{{citekey}}';
					await this.plugin.saveSettings();
					this.display(); // Refresh the settings page
				})
			);

		// No preview - template playground is available

		// Add examples section
		const filenameExamplesContainer = filenameTemplateContainer.createDiv({
			cls: 'template-examples-container'
		});

		filenameExamplesContainer.createEl('details', {}, details => {
			details.createEl('summary', { text: 'Common filename patterns' });
			const list = details.createEl('ul');
			
			this.createListItem(list, '@{{citekey}}', 'Standard citekey with @ prefix');
			this.createListItem(list, '{{year}}-{{citekey}}', 'Year and citekey (2023-smith)');
			this.createListItem(list, '{{type}}/{{citekey}}', 'Type-based folders (article/smith2023)');
			this.createListItem(list, '{{citekey}} - {{title|capitalize}}', 'Citekey with title');
			this.createListItem(list, 'Lit/{{authors_family.0|lowercase}}_{{year}}', 'Custom prefix with author and year');
		});
	}




	/**
	 * Renders custom frontmatter fields section
	 */
	private renderCustomFrontmatterFieldsSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Custom frontmatter fields').setHeading();

		const customFieldsDesc = containerEl.createEl('div', {
			cls: 'setting-item-description'
		});

		customFieldsDesc.createEl('p', { text: 'Define custom frontmatter fields with templated values. These will be added to new literature notes.' });

		// Add warning outside the collapsible guide
		customFieldsDesc.createEl('p', {}, (p) => {
			p.createEl('strong', { text: 'Warning: ' });
			p.appendText('Do not define templates for CSL-standard fields, as doing so may produce invalid bibliography files. ');
			p.createEl('a', { 
				text: 'See the CSL specification',
				href: 'https://docs.citationstyles.org/en/stable/specification.html#appendix-iv-variables'
			});
			p.appendText(' for a list of standard variables.');
		});

		// Container for custom frontmatter fields
		const customFieldsContainer = containerEl.createDiv({ cls: 'custom-frontmatter-fields-container' });

		// Add existing custom frontmatter fields
		if (this.plugin.settings.customFrontmatterFields) {
			this.plugin.settings.customFrontmatterFields.forEach(field => {
				this.addCustomFieldRow(field, customFieldsContainer);
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
					this.addCustomFieldRow(newField, customFieldsContainer);
				})
			);
	}

	/**
	 * Adds a custom field row to the settings
	 */
	private addCustomFieldRow(field: { name: string, template: string, enabled: boolean }, container: HTMLElement): HTMLElement {
		const fieldEl = container.createDiv({ cls: 'custom-frontmatter-field' });

		// Function to validate if field name is a CSL standard field
		const validateCslField = (fieldName: string): boolean => {
			return CSL_ALL_CSL_FIELDS.has(fieldName);
		};

		let nameInputEl: HTMLInputElement;
		
		// Create an element for field warnings
		const warningEl = fieldEl.createDiv({ 
			cls: 'custom-field-warning',
			attr: { style: 'display: none; margin-top: 8px; color: var(--text-error); font-size: 0.85em;' }
		});
		
		// Function to update the warning message
		const updateWarningMessage = (fieldName: string) => {
			if (validateCslField(fieldName)) {
				warningEl.setText(`Warning: "${fieldName}" is a CSL standard field. Using it may produce invalid bibliography files. It is recommended to use a different name.`);
				warningEl.style.display = 'block';
			} else {
				warningEl.style.display = 'none';
			}
		};
		
		const fieldSettingEl = new Setting(fieldEl)
			.addToggle(toggle => toggle
				.setValue(field.enabled)
				.onChange(async (value) => {
					field.enabled = value;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => {
				text
					.setPlaceholder('Field name')
					.setValue(field.name)
					.onChange(async (value) => {
						// Check if the field name is a CSL standard field
						if (validateCslField(value)) {
							// Add error class to input
							nameInputEl.addClass('is-invalid');
							nameInputEl.parentElement?.addClass('has-error');
							
							// Show warning notice
							new Notice(`"${value}" is a CSL standard field. Using it may produce invalid bibliography files.`, 5000);
							
							// Update warning message
							updateWarningMessage(value);
						} else {
							// Remove error class if exists
							nameInputEl.removeClass('is-invalid');
							nameInputEl.parentElement?.removeClass('has-error');
							
							// Hide warning message
							warningEl.style.display = 'none';
						}
						
						field.name = value;
						await this.plugin.saveSettings();
					});
					
				// Store reference to the input element
				nameInputEl = text.inputEl;
				
				// Apply initial validation if needed
				if (field.name && validateCslField(field.name)) {
					nameInputEl.addClass('is-invalid');
					nameInputEl.parentElement?.addClass('has-error');
					
					// Show warning message for initial state
					updateWarningMessage(field.name);
				}
				
				return text;
			})
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

		return fieldEl;
	}

	/**
	 * Renders citekey generation section
	 */
	private renderCitekeyGenerationSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Citekey generation').setHeading();
		containerEl.createEl('p', {
			text: 'Configure how citekeys are generated for new literature notes.',
			cls: 'setting-item-description'
		});
		
		const citekeyTemplateContainer = containerEl.createDiv();
		let citekeyTemplateField: TextAreaComponent | null = null;

		// Create setting with textarea
		new Setting(citekeyTemplateContainer)
			.setName('Citekey template')
			.setDesc('Define the pattern for automatically generated citation keys.')
			.addTextArea(text => {
				citekeyTemplateField = text
					.setPlaceholder('{{authors_family.0|lowercase}}{{year}}')
					.setValue(this.plugin.settings.citekeyOptions.citekeyTemplate)
					.onChange(async (value) => {
						this.plugin.settings.citekeyOptions.citekeyTemplate = value.trim();
						await this.plugin.saveSettings();
					});
				return citekeyTemplateField;
			})
			.addExtraButton(button => button
				.setIcon('reset')
				.setTooltip('Reset to default')
				.onClick(async () => {
					this.plugin.settings.citekeyOptions.citekeyTemplate = '{{authors_family.0|lowercase}}{{year}}';
					await this.plugin.saveSettings();
					this.display(); // Refresh the settings page
				})
			);

		// No preview - template playground is available

		// Add examples section
		const citekeyExamplesContainer = citekeyTemplateContainer.createDiv({
			cls: 'template-examples-container'
		});

		citekeyExamplesContainer.createEl('details', {}, details => {
			details.createEl('summary', { text: 'Common citekey patterns' });
			const list = details.createEl('ul');
			
			this.createListItem(list, '{{authors_family.0|lowercase}}{{year}}', 'Basic author+year format (smith2023)');
			this.createListItem(list, '{{authors_family.0|abbr3}}{{year}}', 'First 3 letters of author + year (smi2023)');
			this.createListItem(list, '{{authors_family.0|lowercase}}{{year}}{{title|titleword}}', 'Author, year, and first significant title word');
			this.createListItem(list, '{{authors_family.0|lowercase}}{{#authors_family.1}}{{authors_family.1|abbr1}}{{/authors_family.1}}{{year}}', 'First author + initial of second author if present');
			this.createListItem(list, '{{authors_family.0|lowercase}}_{{authors_family.1|lowercase}}_{{year}}', 'Multiple authors with underscores');
		});

		// Citekey options
		new Setting(containerEl)
			.setName('Use Zotero keys (if available)')
			.setDesc('When importing from Zotero, use their citekey instead of generating one using the template above.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.citekeyOptions.useZoteroKeys)
				.onChange(async (value) => {
					this.plugin.settings.citekeyOptions.useZoteroKeys = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
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
	}

	/**
	 * Renders templates section
	 */
	private renderTemplatesSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Templates').setHeading();
		
		// Introduction to template system
		const templateIntro = containerEl.createEl('div', { cls: 'setting-item-description' });
		templateIntro.createEl('p', { 
			text: 'BibLib uses a powerful template system across all content. Templates use a Mustache-like syntax for literature notes, filenames, and frontmatter fields.'
		});
		
		// Add template guide FIRST - move it from the bottom to the top
		const templateGuideContainer = containerEl.createDiv({ 
			cls: 'template-guide-container',
			attr: { style: 'margin-top: 16px; margin-bottom: 24px;' }
		});
		
		templateGuideContainer.createEl('h3', { 
			text: 'Template System Guide',
			cls: 'setting-item-name' 
		});
		
		// Make the guide a collapsible details element (collapsed by default)
		const detailsEl = templateGuideContainer.createEl('details');
		detailsEl.createEl('summary', { text: 'Template system guide (Click to expand)' });
		const guideDiv = detailsEl.createEl('div', { cls: 'template-variables-list' });

		guideDiv.createEl('p', { text: 'The template system supports variable replacement, formatting options, conditionals, and loops.' });

		guideDiv.createEl('strong', { text: 'Basic variables', cls:'setting-guide-subtitle' });
		const basicVarsUl = guideDiv.createEl('ul');
		this.createListItem(basicVarsUl, '{{title}}', 'Title of the work');
		this.createListItem(basicVarsUl, '{{citekey}}', 'Citation key');
		this.createListItem(basicVarsUl, '{{year}}, {{month}}, {{day}}', 'Publication date parts');
		this.createListItem(basicVarsUl, '{{container-title}}', 'Journal or book title containing the work');
		this.createListItem(basicVarsUl, '{{authors}}', 'List of authors (formatted as "J. Smith et al." for 3+ authors, full names in arrays)');
		this.createListItem(basicVarsUl, '{{authors_family}}', 'Array of author family names (["Smith", "Jones", ...])');
		this.createListItem(basicVarsUl, '{{authors_given}}', 'Array of author given names (["John", "Maria", ...])');
		this.createListItem(basicVarsUl, '{{pdflink}}', 'Array of attachment file paths');
		this.createListItem(basicVarsUl, '{{attachments}}', 'Array of formatted attachment links (e.g., [[file.pdf|PDF]])');
		this.createListItem(basicVarsUl, '{{DOI}}, {{URL}}', 'Digital identifiers');
		this.createListItem(basicVarsUl, '{{currentDate}}', "Today's date (YYYY-MM-DD)");

		guideDiv.createEl('strong', { text: 'Special array variables', cls:'setting-guide-subtitle' });
		guideDiv.createEl('p', { text: 'These variables are arrays that can be used with loop syntax:' });
		const arrayVarsUl = guideDiv.createEl('ul');
		this.createListItem(arrayVarsUl, '{{authors}}, {{authors_family}}, {{authors_given}}', 'Author information arrays');
		this.createListItem(arrayVarsUl, '{{editors}}, {{translators}}, etc.', 'Other contributor role arrays (when present)');
		this.createListItem(arrayVarsUl, '{{pdflink}}, {{attachments}}', 'Attachment path and link arrays');
		this.createListItem(arrayVarsUl, '{{links}}', 'Array of links to related notes');
		
		guideDiv.createEl('strong', { text: 'Creating arrays in frontmatter', cls:'setting-guide-subtitle' });
		guideDiv.createEl('p', { text: 'To create YAML arrays in frontmatter templates, use JSON array syntax with square brackets:' });
		const arrayExamplesUl = guideDiv.createEl('ul');
		this.createListItem(arrayExamplesUl, '[{{#authors}}"[[Author/{{.}}]]",{{/authors}}]', 'Creates array like ["[[Author/John Smith]]", "[[Author/Maria Jones]]"]');
		this.createListItem(arrayExamplesUl, '[{{#authors_family}}{{^@first}},{{/@first}}"{{.}}"{{/authors_family}}]', 'Array with commas between items (no trailing comma)');
		this.createListItem(arrayExamplesUl, '["{{title}}", {{#DOI}}"{{DOI}}",{{/DOI}} "{{year}}"]', 'Fixed array with conditional elements');
		
		guideDiv.createEl('p', { 
			text: 'Important: Arrays must be valid JSON to be processed correctly. Common issues to avoid:'
		});
		
		const arrayIssuesUl = guideDiv.createEl('ul');
		this.createListItem(arrayIssuesUl, 'Trailing commas', 'Example: ["item1", "item2",] - the last comma breaks the array');
		this.createListItem(arrayIssuesUl, 'Missing quotes', 'All text items must be quoted: ["ok"] not [ok]');
		this.createListItem(arrayIssuesUl, 'Unbalanced brackets', 'Ensure opening [ has a matching closing ]');
		this.createListItem(arrayIssuesUl, 'Use {{^@first}}, {{/@first}} to add commas only between items, not after the last item', '');
		
		guideDiv.createEl('p', { 
			text: 'Use the Template Playground in YAML mode to test your array templates.'
		});
		
		guideDiv.createEl('strong', { text: 'Formatting options', cls:'setting-guide-subtitle' });
		guideDiv.createEl('p', { text: 'You can format any variable using pipe syntax:' });
		const formatOptsUl = guideDiv.createEl('ul');
		this.createListItem(formatOptsUl, '{{variable|uppercase}}', 'ALL UPPERCASE');
		this.createListItem(formatOptsUl, '{{variable|lowercase}}', 'all lowercase');
		this.createListItem(formatOptsUl, '{{variable|capitalize}}', 'Capitalize First Letter Of Each Word');
		this.createListItem(formatOptsUl, '{{title|titleword}}', 'Extract first significant word from title');

		guideDiv.createEl('strong', { text: 'Conditionals and loops', cls:'setting-guide-subtitle' });
		const conditionalsUl = guideDiv.createEl('ul');
		this.createListItem(conditionalsUl, '{{#variable}}Content shown if variable exists{{/variable}}', 'Positive conditional');
		this.createListItem(conditionalsUl, '{{^variable}}Content shown if variable is empty{{/variable}}', 'Negative conditional');
		this.createListItem(conditionalsUl, '{{#array}}{{.}} is the current item{{/array}}', 'Loop through arrays ({{.}} refers to current item)');
		this.createListItem(conditionalsUl, '{{#array}}{{^@first}}, {{/@first}}{{.}}{{/array}}', 'Using array position metadata (@first, @last, etc.)');
		
		guideDiv.createEl('strong', { text: 'Loop position metadata', cls:'setting-guide-subtitle' });
		guideDiv.createEl('p', { text: 'When iterating through arrays, you can use these special variables to control formatting:' });
		const loopMetadataUl = guideDiv.createEl('ul');
		this.createListItem(loopMetadataUl, '{{@index}}', 'Zero-based index (0, 1, 2, ...)');
		this.createListItem(loopMetadataUl, '{{@number}}', 'One-based index (1, 2, 3, ...)');
		this.createListItem(loopMetadataUl, '{{@first}}', 'Boolean - true if first item');
		this.createListItem(loopMetadataUl, '{{@last}}', 'Boolean - true if last item');
		this.createListItem(loopMetadataUl, '{{@odd}}', 'Boolean - true for odd-indexed items (1, 3, 5, ...)');
		this.createListItem(loopMetadataUl, '{{@even}}', 'Boolean - true for even-indexed items (0, 2, 4, ...)');
		this.createListItem(loopMetadataUl, '{{@length}}', 'Total length of the array being iterated');
		
		guideDiv.createEl('p', { text: 'Example using position metadata:' });
		guideDiv.createEl('pre', {}, pre => {
			pre.createEl('code', { 
				text: '{{#authors}}\n  {{@number}}. {{.}}{{^@last}},{{/@last}}{{#@last}}.{{/@last}}\n{{/authors}}'
			});
		});
		guideDiv.createEl('p', { text: 'Would produce: "1. John Smith, 2. Maria Rodriguez, 3. Wei Zhang."' });

		guideDiv.createEl('strong', { text: 'Accessing nested data', cls:'setting-guide-subtitle' });
		guideDiv.createEl('p', { text: 'Use dot notation to access nested properties and array items:' });
		const nestedUl = guideDiv.createEl('ul');
		this.createListItem(nestedUl, '{{authors_family.0}}', 'First author family name');
		this.createListItem(nestedUl, '{{issued.date-parts.0.0}}', 'Year from nested CSL date structure');
		this.createListItem(nestedUl, '{{#authors}}{{#@first}}First author: {{.}}{{/@first}}{{/authors}}', 'Conditional within a loop');
		
		guideDiv.createEl('p', {}, (p) => {
			p.appendText('See the ');
			const link = p.createEl('a', {
				text: 'full documentation',
				href: "https://callumalpass.github.io/obsidian-biblib"
			});
			p.appendText(' for more details on the template system.');
		});
		
		// Now add the template playground AFTER the guide
		const playgroundContainer = containerEl.createDiv({ cls: 'template-playground-wrapper' });
		
		playgroundContainer.createEl('h3', { 
			text: 'Template Playground',
			cls: 'setting-item-name'
		});
		
		playgroundContainer.createEl('p', {
			text: 'Try out different templates and see the results instantly with sample data.',
			cls: 'setting-item-description'
		});
		
		// Add the template playground component
		new TemplatePlaygroundComponent(playgroundContainer);
		
		// Note Templates Section
		const templateSettingsContainer = containerEl.createDiv({ cls: 'template-settings-container' });
		
		templateSettingsContainer.createEl('h3', { 
			text: 'Note Templates',
			cls: 'setting-item-name' 
		});
		
		templateSettingsContainer.createEl('p', {
			text: 'Configure templates used to generate literature notes.',
			cls: 'setting-item-description'
		});
		
		// Header template
		const headerTemplateContainer = templateSettingsContainer.createDiv();
		let headerTemplateField: TextAreaComponent | null = null;

		// Create setting with textarea
		new Setting(headerTemplateContainer)
			.setName('Header template')
			.setDesc('Template for the first header in literature notes.')
			.addTextArea(text => {
				headerTemplateField = text
					.setPlaceholder('# {{title}}')
					.setValue(this.plugin.settings.headerTemplate)
					.onChange(async (value) => {
						this.plugin.settings.headerTemplate = value;
						await this.plugin.saveSettings();
					});
				return headerTemplateField;
			})
			.addExtraButton(button => button
				.setIcon('reset')
				.setTooltip('Reset to default')
				.onClick(async () => {
					this.plugin.settings.headerTemplate = '# {{#title}}{{title}}{{/title}}{{^title}}{{citekey}}{{/title}}';
					await this.plugin.saveSettings();
					this.display(); // Refresh the settings page
				})
			);

		// Add examples section
		const headerExamplesContainer = headerTemplateContainer.createDiv({
			cls: 'template-examples-container'
		});

		headerExamplesContainer.createEl('details', {}, details => {
			details.createEl('summary', { text: 'Common header patterns' });
			const list = details.createEl('ul');
			
			this.createListItem(list, '# {{title}}', 'Just the title');
			this.createListItem(list, '# {{title}} ({{year}})', 'Title with year in parentheses');
			this.createListItem(list, '# [[{{pdflink}}|{{title}}]]', 'Title linked to PDF');
			this.createListItem(list, '# {{#pdflink}}[[{{pdflink}}]]{{/pdflink}}{{^pdflink}}{{title}}{{/pdflink}}', 'PDF link if available, otherwise title');
			this.createListItem(list, '# {{citekey}}: {{title}}', 'Citekey and title');
		});
	}

	private renderZoteroConnectorSection(containerEl: HTMLElement): void {
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

	/**
	 * Renders bibliography builder section
	 */
	private renderBibliographyBuilderSection(containerEl: HTMLElement): void {
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
	}
}