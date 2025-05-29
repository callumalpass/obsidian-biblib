import { App, Platform, PluginSettingTab, Setting, TextAreaComponent, TextComponent, normalizePath, setIcon, Notice } from 'obsidian';
import BibliographyPlugin from '../../main';
import { CSL_ALL_CSL_FIELDS } from '../utils/csl-variables';
import { TemplatePlaygroundComponent } from './components/template-playground';
import { FavoriteLanguage, ModalFieldConfig } from '../types/settings';

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
	
	// Helper function to create template examples with code blocks
	private createTemplateExample(parent: HTMLElement, title: string, template: string, description: string) {
		const exampleContainer = parent.createDiv({
			cls: 'template-example-item'
		});
		
		// Create title
		new Setting(exampleContainer)
			.setName(title)
			.setHeading()
			.setClass('template-example-title');
		
		// Create description
		if (description) {
			exampleContainer.createEl('p', {
				text: description,
				cls: 'template-example-description'
			});
		}
		
		// Create code block
		const codeBlock = exampleContainer.createEl('pre', {
			cls: 'template-example-code'
		});
		
		codeBlock.createEl('code', {
			text: template
		});
		
		// Add copy button
		const copyButtonContainer = exampleContainer.createDiv({
			cls: 'template-example-actions'
		});
		
		const copyButton = copyButtonContainer.createEl('button', {
			cls: 'template-example-copy-button',
			text: 'Use this template'
		});
		
		// Add click handler to copy template to the main textarea
		copyButton.addEventListener('click', () => {
			// Find the template field (assuming it's the headerTemplateField)
			if (this.plugin.settings) {
				this.plugin.settings.headerTemplate = template;
				this.plugin.saveSettings();
				this.display(); // Refresh to show updated template
				new Notice('Template applied successfully!', 2000);
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
	
	/**
	 * Creates fragment with just the text
	 * (Tooltip functionality removed to simplify UI)
	 * @param text The text to display 
	 * @param tooltipText The tooltip text (unused now)
	 * @returns A document fragment with text
	 */
	private createTooltip(text: string, tooltipText: string): DocumentFragment {
		return this.createFragment(fragment => {
			fragment.appendText(text);
		});
	}
	
	/**
	 * Adds helper text below a component's input element
	 * @param component The component to add helper text to
	 * @param text The helper text
	 */
	private addHelperText(component: TextAreaComponent | TextComponent, text: string): void {
		component.inputEl.parentElement?.createDiv({
			cls: 'setting-item-description setting-helper-text',
			text: text
		});
	}

		/**
	 * Enhances Zotero connector section with additional information
	 * (Implementation removed as requested)
	 */
	private enhanceZoteroSettings(): void {
		// Helper text removed as requested
	}
	
	/**
	 * Enhances bibliography export settings with helpful information
	 * (Implementation removed as requested)
	 */
	private enhanceBibliographySettings(): void {
		// Helper text removed as requested
	}
	
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Create main settings container with improved styling
		const mainSettingsContainer = containerEl.createDiv({
			cls: 'biblib-settings-container'
		});

		// ==================== General Settings Section ====================
		this.renderGeneralSettings(mainSettingsContainer);

		// ==================== File Path Settings Section ====================
		this.renderFilePathSettings(mainSettingsContainer);

		// ==================== Template System Section ====================
		this.renderTemplatesSection(mainSettingsContainer);

		// ==================== Citekey Generation Section ====================
		this.renderCitekeyGenerationSection(mainSettingsContainer);

		// ==================== Custom Frontmatter Fields Section ====================
		this.renderCustomFrontmatterFieldsSection(mainSettingsContainer);

		// ==================== Favorite Languages Section ====================
		this.renderFavoriteLanguagesSection(mainSettingsContainer);

		// ==================== Default Modal Fields Section ====================
		this.renderDefaultModalFieldsSection(mainSettingsContainer);

		// ==================== Edit Modal Settings Section ====================
		this.renderEditModalSettingsSection(mainSettingsContainer);

		// ==================== Zotero Connector Section ====================
		if (!Platform.isMobile) {
			this.renderZoteroConnectorSection(mainSettingsContainer);
		}

		// ==================== Bibliography Builder Section ====================
		this.renderBibliographyBuilderSection(mainSettingsContainer);
		
		// Apply enhancements with setTimeout to ensure DOM is ready
		setTimeout(() => {
			this.enhanceFilePathSettings();
			this.enhanceCitekeySettings();
			if (!Platform.isMobile) {
				this.enhanceZoteroSettings();
			}
			this.enhanceBibliographySettings();
		}, 50);
	}

	/**
	 * Renders general settings section
	 */
	private renderGeneralSettings(containerEl: HTMLElement): void {
		// No heading for general settings as per guidelines
		
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
	 * Enhances file path settings with additional documentation and tooltips
	 * (Implementation removed as requested)
	 */
	private enhanceFilePathSettings(): void {
		// Helper text removed as requested
	}

	private renderFilePathSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('File organization').setHeading();
		
		new Setting(containerEl)
			.setName('Attachment folder path')
			.setDesc(this.createTooltip(
				'The folder where attachment files (PDFs, EPUBs, and other file types) will be stored. Use forward slashes for subfolders.',
				'This path is relative to your vault root. Attachments will be copied here when importing.'
			))
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
		new Setting(containerEl).setName('Custom frontmatter').setHeading();
		
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
			attr: { style: 'display: none;' }
		});
		
		// Function to update the warning message
		const updateWarningMessage = (fieldName: string) => {
			if (validateCslField(fieldName)) {
				warningEl.setText(`Warning: "${fieldName}" is a CSL standard field. Using it may produce invalid bibliography files. It is recommended to use a different name.`);
				warningEl.removeClass('warning-hidden');
				warningEl.addClass('warning-visible');
			} else {
				warningEl.removeClass('warning-visible');
				warningEl.addClass('warning-hidden');
			}
		};
		
		// Create header with toggle and delete button
		const headerEl = fieldEl.createDiv({ cls: 'custom-frontmatter-field-header' });
		
		// Add toggle to header
		const toggleSetting = new Setting(headerEl)
			.addToggle(toggle => toggle
				.setValue(field.enabled)
				.onChange(async (value) => {
					field.enabled = value;
					await this.plugin.saveSettings();
				})
			)
			.setName('Enabled')
			.setDesc('Include this field in new literature notes');
		
		// Add delete button to header
		toggleSetting.addExtraButton(button => button
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
		
		// Create container for field name
		const nameContainer = fieldEl.createDiv();
		nameContainer.createEl('label', { 
			text: 'Field name',
			cls: 'setting-item-name' 
		});
		
		// Create input for field name
		nameInputEl = nameContainer.createEl('input', {
			type: 'text',
			cls: 'custom-frontmatter-field-name',
			attr: {
				placeholder: 'Field name (e.g., tags, keywords)',
				value: field.name
			}
		});
		
		nameInputEl.addEventListener('change', async (event) => {
			const value = (event.target as HTMLInputElement).value;
			
			// Check if the field name is a CSL standard field
			if (validateCslField(value)) {
				// Add error class to input
				nameInputEl.addClass('is-invalid');
				
				// Show warning notice
				new Notice(`"${value}" is a CSL standard field. Using it may produce invalid bibliography files.`, 5000);
				
				// Update warning message
				updateWarningMessage(value);
			} else {
				// Remove error class if exists
				nameInputEl.removeClass('is-invalid');
				
				// Hide warning message
				warningEl.removeClass('warning-visible');
				warningEl.addClass('warning-hidden');
			}
			
			field.name = value;
			await this.plugin.saveSettings();
		});
		
		// Apply initial validation if needed
		if (field.name && validateCslField(field.name)) {
			nameInputEl.addClass('is-invalid');
			
			// Show warning message for initial state
			updateWarningMessage(field.name);
		}
		
		// Add warning container after the name input
		nameContainer.appendChild(warningEl);
		
		// Create container for template
		const templateContainer = fieldEl.createDiv({ cls: 'custom-frontmatter-template-container' });
		templateContainer.createEl('label', { 
			text: 'Template',
			cls: 'setting-item-name' 
		});
		templateContainer.createEl('div', { 
			text: 'Define the template for this frontmatter field.',
			cls: 'setting-item-description' 
		});
		
		// Create textarea for template
		const templateTextarea = templateContainer.createEl('textarea', {
			cls: 'custom-frontmatter-field-textarea',
			attr: {
				placeholder: 'Template (e.g., {{authors|capitalize}})',
				rows: 6
			}
		});
		templateTextarea.value = field.template;
		
		templateTextarea.addEventListener('change', async (event) => {
			const value = (event.target as HTMLTextAreaElement).value;
			field.template = value;
			await this.plugin.saveSettings();
		});

		return fieldEl;
	}

	/**
	 * Helper method to add explanation text to an existing setting
	 * @param settingName The name of the setting to find
	 * @param helpText The text to add
	 */
	private addSettingHelpText(settingName: string, helpText: string): void {
		document.querySelectorAll('.setting-item').forEach(item => {
			const nameEl = item.querySelector('.setting-item-name');
			if (nameEl && nameEl.textContent === settingName) {
				const descEl = item.querySelector('.setting-item-description');
				if (descEl) {
					const helpEl = document.createElement('div');
					helpEl.className = 'setting-helper-text';
					helpEl.textContent = helpText;
					descEl.appendChild(helpEl);
				}
			}
		});
	}
	
	/**
	 * Adds tooltips and helper text to citekey settings
	 * (Implementation removed as requested)
	 */
	private enhanceCitekeySettings(): void {
		// Helper text removed as requested
	}

	/**
	 * Renders citekey generation section
	 */
	private renderCitekeyGenerationSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Citation keys').setHeading();
		
		containerEl.createEl('p', {
			text: 'Configure how citekeys are generated for new literature notes.',
			cls: 'setting-item-description'
		});
		
		const citekeyTemplateContainer = containerEl.createDiv();
		let citekeyTemplateField: TextAreaComponent | null = null;

		// Create setting with textarea
		new Setting(citekeyTemplateContainer)
			.setName('Citekey template')
			.setDesc(this.createTooltip(
					'Define the pattern for automatically generated citation keys.',
					'Citation keys are unique identifiers used for referencing sources in academic writing. ' +
					'They are typically composed of author names, year, and sometimes title elements.'
				))
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
		
		new Setting(templateGuideContainer)
			.setName('Template System Guide')
			.setHeading();
		
		// Make the guide a collapsible details element (collapsed by default)
		const detailsEl = templateGuideContainer.createEl('details');
		detailsEl.createEl('summary', { text: 'Template system guide (Click to expand)' });
		const guideDiv = detailsEl.createEl('div', { cls: 'template-variables-list' });

		guideDiv.createEl('p', { text: 'The template system supports variable replacement, formatting options, conditionals, and loops.' });

		new Setting(guideDiv).setName('Basic variables').setHeading();
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

		new Setting(guideDiv).setName('Special array variables').setHeading();
		guideDiv.createEl('p', { text: 'These variables are arrays that can be used with loop syntax:' });
		const arrayVarsUl = guideDiv.createEl('ul');
		this.createListItem(arrayVarsUl, '{{authors}}, {{authors_family}}, {{authors_given}}', 'Author information arrays');
		this.createListItem(arrayVarsUl, '{{editors}}, {{translators}}, etc.', 'Other contributor role arrays (when present)');
		this.createListItem(arrayVarsUl, '{{pdflink}}, {{attachments}}', 'Attachment path and link arrays');
		this.createListItem(arrayVarsUl, '{{links}}', 'Array of links to related notes');
		
		new Setting(guideDiv).setName('Creating arrays in frontmatter').setHeading();
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
		
		new Setting(guideDiv).setName('Formatting options').setHeading();
		guideDiv.createEl('p', { text: 'You can format any variable using pipe syntax:' });
		const formatOptsUl = guideDiv.createEl('ul');
		this.createListItem(formatOptsUl, '{{variable|uppercase}}', 'ALL UPPERCASE');
		this.createListItem(formatOptsUl, '{{variable|lowercase}}', 'all lowercase');
		this.createListItem(formatOptsUl, '{{variable|capitalize}}', 'Capitalize First Letter Of Each Word');
		this.createListItem(formatOptsUl, '{{title|titleword}}', 'Extract first significant word from title');

		new Setting(guideDiv).setName('Conditionals and loops').setHeading();
		const conditionalsUl = guideDiv.createEl('ul');
		this.createListItem(conditionalsUl, '{{#variable}}Content shown if variable exists{{/variable}}', 'Positive conditional');
		this.createListItem(conditionalsUl, '{{^variable}}Content shown if variable is empty{{/variable}}', 'Negative conditional');
		this.createListItem(conditionalsUl, '{{#array}}{{.}} is the current item{{/array}}', 'Loop through arrays ({{.}} refers to current item)');
		this.createListItem(conditionalsUl, '{{#array}}{{^@first}}, {{/@first}}{{.}}{{/array}}', 'Using array position metadata (@first, @last, etc.)');
		
		new Setting(guideDiv).setName('Loop position metadata').setHeading();
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

		new Setting(guideDiv).setName('Accessing nested data').setHeading();
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
		
		new Setting(playgroundContainer)
			.setName('Template Playground')
			.setHeading();
		
		playgroundContainer.createEl('p', {
			text: 'Try out different templates and see the results instantly with sample data.',
			cls: 'setting-item-description'
		});
		
		// Add the template playground component
		new TemplatePlaygroundComponent(playgroundContainer);
		
		// Note Templates Section
		const templateSettingsContainer = containerEl.createDiv({ cls: 'template-settings-container' });
		
		new Setting(templateSettingsContainer)
			.setName('Note templates')
			.setHeading();
		
		templateSettingsContainer.createEl('p', {
			text: 'Configure templates used to generate literature notes.',
			cls: 'setting-item-description'
		});
		
		// Header template
		const headerTemplateContainer = templateSettingsContainer.createDiv();
		let headerTemplateField: TextAreaComponent | null = null;

		// Create setting with title and description
		const templateSetting = new Setting(headerTemplateContainer)
			.setName('Note content template')
			.setDesc('Template for the entire note body content. Define the complete structure of your literature notes here including headings, sections, and references. Frontmatter is configured separately.');
			
		// Add reset button to the setting
		templateSetting.addExtraButton(button => button
			.setIcon('reset')
			.setTooltip('Reset to default')
			.onClick(async () => {
				this.plugin.settings.headerTemplate = '# {{#title}}{{title}}{{/title}}{{^title}}{{citekey}}{{/title}}';
				await this.plugin.saveSettings();
				this.display(); // Refresh the settings page
			})
		);
		
		// Create div for the full-width textarea below the setting
		const textareaContainer = headerTemplateContainer.createDiv({
			cls: 'template-textarea-container'
		});
		
		// Create the textarea manually
		headerTemplateField = new TextAreaComponent(textareaContainer);
		headerTemplateField
			.setPlaceholder('# {{title}}\n\n## Summary\n\n## Key points\n\n## References\n{{#pdflink}}[[{{pdflink}}]]{{/pdflink}}')
			.setValue(this.plugin.settings.headerTemplate)
			.onChange(async (value) => {
				this.plugin.settings.headerTemplate = value;
				await this.plugin.saveSettings();
			});

		// Add examples section
		const headerExamplesContainer = headerTemplateContainer.createDiv({
			cls: 'template-examples-container'
		});

		headerExamplesContainer.createEl('details', {
			cls: 'template-examples-details'
		}, details => {
			details.createEl('summary', { text: 'Note template examples' });
			const examplesContainer = details.createDiv({
				cls: 'note-template-examples-container'
			});
			
			// Basic title only
			this.createTemplateExample(
				examplesContainer,
				"Simple title only",
				"# {{title}}",
				"A minimal example that just displays the work's title as a top-level heading."
			);
			
			// Title with year and authors
			this.createTemplateExample(
				examplesContainer,
				"Title with year and authors",
				"# {{title}} ({{year}})\n\n*{{authors}}*",
				"Adds the publication year in parentheses and the authors in italics below the title."
			);
			
			// Title with abstract
			this.createTemplateExample(
				examplesContainer,
				"Title with abstract section",
				"# {{title}}\n\n## Abstract\n\n{{abstract}}",
				"Includes the abstract in its own section for academic references."
			);
			
			// Comprehensive note
			this.createTemplateExample(
				examplesContainer,
				"Comprehensive note structure",
				"# {{title}}\n\n## Metadata\n- **Authors**: {{authors}}\n- **Year**: {{year}}\n- **Journal**: {{container-title}}\n\n## Notes\n\n## Key points\n\n## References\n{{#DOI}}DOI: {{DOI}}{{/DOI}}",
				"A full note structure with metadata section and placeholder headings for notes and key points."
			);
			
			// Research note
			this.createTemplateExample(
				examplesContainer,
				"Research note with quotes section",
				"# {{title}}\n\n## Summary\n\n## Quotes\n\n## Thoughts\n\n## References\n{{#pdflink}}📄 [[{{pdflink}}]]{{/pdflink}}\n{{#URL}}🔗 [Source]({{URL}}){{/URL}}",
				"Organized for research with sections for quotes, personal thoughts, and reference links."
			);
			
			// Note with drawing
			this.createTemplateExample(
				examplesContainer,
				"Note with drawing canvas",
				"# {{citekey}}: {{title}}\n\n![[{{citekey}}.excalidraw]]\n\n## Notes\n\n## References\n{{#attachments}}{{.}}\n{{/attachments}}",
				"Includes an excalidraw canvas for visual note-taking, named after the citekey."
			);
			
			// Zettelkasten style
			this.createTemplateExample(
				examplesContainer,
				"Zettelkasten-style note",
				"# {{citekey}} - {{title|capitalize}}\n\n## Summary\n\n## Concepts\n\n## Fleeting Notes\n\n## Permanent Notes\n- \n\n## Links\n- Related: \n{{#keywords}}{{#.}}- #{{.}}\n{{/.}}{{/keywords}}\n\n## References\n{{#DOI}}DOI: {{DOI}}{{/DOI}}\n{{#URL}}URL: {{URL}}{{/URL}}\n{{#authors}}{{#@first}}{{.}} {{year}}{{/@first}}{{/authors}}",
				"Structured for Zettelkasten method with sections for fleeting and permanent notes, and concept linking."
			);
			
			// Literature review style
			this.createTemplateExample(
				examplesContainer,
				"Literature review format",
				"# {{title}}\n\n**Authors:** {{authors}}\n**Year:** {{year}}\n**Journal:** {{container-title}}\n**Keywords:** {{#keywords}}{{.}}{{^@last}}, {{/@last}}{{/keywords}}\n\n## Problem Statement\n\n## Methodology\n\n## Key Findings\n\n## Limitations\n\n## Future Research\n\n## Relevance to My Research\n\n## Citation\n```\n{{authors_family.0}} et al. ({{year}}). {{title}}. {{container-title}}. {{#DOI}}https://doi.org/{{DOI}}{{/DOI}}\n```",
				"Comprehensive template for academic literature reviews with structured analysis sections."
			);
			
			// Cornell notes style
			this.createTemplateExample(
				examplesContainer,
				"Cornell notes method",
				"# {{title}} ({{year}})\n\n> [!cue] Cues\n> - Key concepts\n> - Main questions\n> - Terminology\n\n## Notes\n\n\n\n> [!summary] Summary\n> \n\n## Metadata\n- **Authors**: {{authors}}\n- **Publication**: {{container-title}}\n- **Link**: {{#DOI}}https://doi.org/{{DOI}}{{/DOI}}{{^DOI}}{{#URL}}{{URL}}{{/URL}}{{/DOI}}",
				"Based on the Cornell note-taking method with cues on the left and summary at the bottom."
			);
			
			// Callout-based template
			this.createTemplateExample(
				examplesContainer,
				"Callout-based template",
				"# {{title}}\n\n> [!info] Metadata\n> - **Authors**: {{authors}}\n> - **Year**: {{year}}\n> - **Journal**: {{container-title}}\n> - **DOI**: {{#DOI}}{{DOI}}{{/DOI}}\n\n> [!abstract] Abstract\n> {{abstract}}\n\n> [!quote] Key Quotes\n> \n\n> [!note] Notes\n> \n\n> [!example] Examples\n> \n\n> [!success] Strengths\n> \n\n> [!failure] Weaknesses\n> \n\n> [!question] Questions\n> \n\n> [!tip] Applications\n> ",
				"Uses Obsidian callouts to organize different aspects of literature notes with visual distinction."
			);
		});
	}

	private renderZoteroConnectorSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Zotero integration').setHeading();
		
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
		new Setting(instructionsEl).setName('How to use the Zotero Connector').setHeading();
		const ol = instructionsEl.createEl('ol');
		ol.createEl('li', {}, (li) => {
			li.appendText('Make sure Zotero desktop application is ');
			li.createEl('strong', { text: 'NOT' });
			li.appendText(' running');
		});
		ol.createEl('li', { text: 'Enable the Zotero Connector option above' });
		ol.createEl('li', { text: 'Use the Zotero Connector browser extension as normal' });
		ol.createEl('li', { text: 'When saving an item, the Zotero Connector will send the data to Obsidian instead of Zotero' });
		ol.createEl('li', { text: 'The bibliography modal will open with the data pre-filled' });
		ol.createEl('li', { text: 'Any PDF attachments will be downloaded and automatically linked' });
		instructionsEl.createEl('p', { text: 'Note: You can toggle this feature with the "Toggle Zotero Connector server" command.' });
	}

	/**
	 * Renders favorite languages section
	 */
	private renderFavoriteLanguagesSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Favorite languages').setHeading();
		
		containerEl.createEl('p', {
			text: 'Configure frequently used languages to appear at the top of language dropdowns in modals.',
			cls: 'setting-item-description'
		});

		// Container for favorite languages
		const favLangsContainer = containerEl.createDiv({ cls: 'favorite-languages-container' });

		// Add existing favorite languages
		if (this.plugin.settings.favoriteLanguages) {
			this.plugin.settings.favoriteLanguages.forEach((lang, index) => {
				this.addFavoriteLanguageRow(lang, index, favLangsContainer);
			});
		}

		// Add button to add a new favorite language
		new Setting(containerEl)
			.setName('Add favorite language')
			.addButton(button => button
				.setButtonText('Add language')
				.onClick(async () => {
					// Create a new language with default values
					const newLang = {
						code: '',
						name: ''
					};

					// Add to settings
					if (!this.plugin.settings.favoriteLanguages) {
						this.plugin.settings.favoriteLanguages = [];
					}
					this.plugin.settings.favoriteLanguages.push(newLang);
					await this.plugin.saveSettings();

					// Add to UI
					this.addFavoriteLanguageRow(newLang, this.plugin.settings.favoriteLanguages.length - 1, favLangsContainer);
				})
			);
	}

	/**
	 * Adds a favorite language row to the settings
	 */
	private addFavoriteLanguageRow(lang: FavoriteLanguage, index: number, container: HTMLElement): void {
		const langEl = container.createDiv({ cls: 'favorite-language-row' });

		new Setting(langEl)
			.setName('')
			.addText(text => text
				.setPlaceholder('Language code (e.g., en, nb, fi)')
				.setValue(lang.code)
				.onChange(async (value) => {
					this.plugin.settings.favoriteLanguages[index].code = value.trim();
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('Language name (e.g., English, Norwegian)')
				.setValue(lang.name)
				.onChange(async (value) => {
					this.plugin.settings.favoriteLanguages[index].name = value.trim();
					await this.plugin.saveSettings();
				}))
			.addButton(button => button
				.setIcon('up-chevron-glyph')
				.setTooltip('Move up')
				.setDisabled(index === 0)
				.onClick(async () => {
					if (index > 0) {
						const langs = this.plugin.settings.favoriteLanguages;
						[langs[index - 1], langs[index]] = [langs[index], langs[index - 1]];
						await this.plugin.saveSettings();
						this.display();
					}
				}))
			.addButton(button => button
				.setIcon('down-chevron-glyph')
				.setTooltip('Move down')
				.setDisabled(index === this.plugin.settings.favoriteLanguages.length - 1)
				.onClick(async () => {
					if (index < this.plugin.settings.favoriteLanguages.length - 1) {
						const langs = this.plugin.settings.favoriteLanguages;
						[langs[index], langs[index + 1]] = [langs[index + 1], langs[index]];
						await this.plugin.saveSettings();
						this.display();
					}
				}))
			.addButton(button => button
				.setIcon('trash')
				.setTooltip('Remove')
				.onClick(async () => {
					this.plugin.settings.favoriteLanguages.splice(index, 1);
					await this.plugin.saveSettings();
					langEl.remove();
				}));
	}

	/**
	 * Renders default modal fields section
	 */
	private renderDefaultModalFieldsSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Default modal fields').setHeading();
		
		const desc = containerEl.createEl('div', {
			cls: 'setting-item-description'
		});

		desc.createEl('p', { text: 'Configure which CSL-compliant fields appear as primary inputs in the "Create literature note" modal.' });
		desc.createEl('p', { text: 'This is useful for workflows that frequently use specific fields (e.g., archival research needing archive, archive-place, archive_location).' });

		// Container for default modal fields
		const fieldsContainer = containerEl.createDiv({ cls: 'default-modal-fields-container' });

		// Add existing default modal fields
		if (this.plugin.settings.defaultModalFields) {
			this.plugin.settings.defaultModalFields.forEach((field, index) => {
				this.addDefaultModalFieldRow(field, index, fieldsContainer);
			});
		}

		// Add button to add a new default field
		new Setting(containerEl)
			.setName('Add default modal field')
			.addButton(button => button
				.setButtonText('Add field')
				.onClick(async () => {
					// Create a new field with default values
					const newField = {
						name: '',
						label: '',
						type: 'text' as const,
						description: '',
						placeholder: '',
						required: false,
						defaultValue: ''
					};

					// Add to settings
					if (!this.plugin.settings.defaultModalFields) {
						this.plugin.settings.defaultModalFields = [];
					}
					this.plugin.settings.defaultModalFields.push(newField);
					await this.plugin.saveSettings();

					// Add to UI
					this.addDefaultModalFieldRow(newField, this.plugin.settings.defaultModalFields.length - 1, fieldsContainer);
				})
			);
	}

	/**
	 * Adds a default modal field row to the settings
	 */
	private addDefaultModalFieldRow(field: ModalFieldConfig, index: number, container: HTMLElement): void {
		const fieldEl = container.createDiv({ cls: 'default-modal-field' });

		// Field name (CSL key)
		new Setting(fieldEl)
			.setName('CSL field name')
			.setDesc('The CSL field key (e.g., "archive", "URL")')
			.addText(text => text
				.setPlaceholder('e.g., archive')
				.setValue(field.name)
				.onChange(async (value) => {
					this.plugin.settings.defaultModalFields[index].name = value.trim();
					await this.plugin.saveSettings();
				}));

		// Field label
		new Setting(fieldEl)
			.setName('Display label')
			.setDesc('The label shown in the modal')
			.addText(text => text
				.setPlaceholder('e.g., Archive Name')
				.setValue(field.label)
				.onChange(async (value) => {
					this.plugin.settings.defaultModalFields[index].label = value.trim();
					await this.plugin.saveSettings();
				}));

		// Field type
		new Setting(fieldEl)
			.setName('Field type')
			.setDesc('The type of input control')
			.addDropdown(dropdown => dropdown
				.addOption('text', 'Text')
				.addOption('textarea', 'Text Area')
				.addOption('number', 'Number')
				.addOption('date', 'Date')
				.addOption('toggle', 'Toggle')
				.addOption('dropdown', 'Dropdown')
				.setValue(field.type)
				.onChange(async (value: any) => {
					this.plugin.settings.defaultModalFields[index].type = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide options field
				}));

		// Description (optional)
		new Setting(fieldEl)
			.setName('Description')
			.setDesc('Optional help text shown below the field')
			.addText(text => text
				.setPlaceholder('Optional description')
				.setValue(field.description || '')
				.onChange(async (value) => {
					this.plugin.settings.defaultModalFields[index].description = value.trim();
					await this.plugin.saveSettings();
				}));

		// Placeholder (optional)
		new Setting(fieldEl)
			.setName('Placeholder')
			.setDesc('Optional placeholder text')
			.addText(text => text
				.setPlaceholder('Optional placeholder')
				.setValue(field.placeholder || '')
				.onChange(async (value) => {
					this.plugin.settings.defaultModalFields[index].placeholder = value.trim();
					await this.plugin.saveSettings();
				}));

		// Default value
		new Setting(fieldEl)
			.setName('Default value')
			.setDesc('Default value for new notes')
			.addText(text => text
				.setPlaceholder('Optional default value')
				.setValue(field.defaultValue?.toString() || '')
				.onChange(async (value) => {
					this.plugin.settings.defaultModalFields[index].defaultValue = value.trim();
					await this.plugin.saveSettings();
				}));

		// Required field toggle
		new Setting(fieldEl)
			.setName('Required field')
			.setDesc('Mark as required (for UI hint only)')
			.addToggle(toggle => toggle
				.setValue(field.required || false)
				.onChange(async (value) => {
					this.plugin.settings.defaultModalFields[index].required = value;
					await this.plugin.saveSettings();
				}));

		// Remove button
		new Setting(fieldEl)
			.setName('')
			.addButton(button => button
				.setButtonText('Remove field')
				.setWarning()
				.onClick(async () => {
					this.plugin.settings.defaultModalFields.splice(index, 1);
					await this.plugin.saveSettings();
					fieldEl.remove();
				}));

		// Add divider
		fieldEl.createEl('hr');
	}

	/**
	 * Renders edit modal settings section
	 */
	private renderEditModalSettingsSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Edit literature note settings').setHeading();
		
		containerEl.createEl('p', {
			text: 'Configure default behavior when editing existing literature notes.',
			cls: 'setting-item-description'
		});

		new Setting(containerEl)
			.setName('Regenerate citekey by default')
			.setDesc('When editing a note, regenerate the citekey if relevant data changes')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.editRegenerateCitekeyDefault)
				.onChange(async (value) => {
					this.plugin.settings.editRegenerateCitekeyDefault = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Update custom frontmatter by default')
			.setDesc('When editing a note, update custom frontmatter fields from templates')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.editUpdateCustomFrontmatterDefault)
				.onChange(async (value) => {
					this.plugin.settings.editUpdateCustomFrontmatterDefault = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Regenerate note body by default')
			.setDesc('When editing a note, regenerate the note body from the header template')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.editRegenerateBodyDefault)
				.onChange(async (value) => {
					this.plugin.settings.editRegenerateBodyDefault = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Rename file on citekey change')
			.setDesc('When the citekey changes during edit, rename the file to match')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.editRenameFileOnCitekeyChange)
				.onChange(async (value) => {
					this.plugin.settings.editRenameFileOnCitekeyChange = value;
					await this.plugin.saveSettings();
				}));
	}

	/**
	 * Renders bibliography builder section
	 */
	private renderBibliographyBuilderSection(containerEl: HTMLElement): void {
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
