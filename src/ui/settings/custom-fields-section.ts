import { Setting, Notice } from 'obsidian';
import BibliographyPlugin from '../../../main';
import { CSL_ALL_CSL_FIELDS } from '../../utils/csl-variables';
import { FavoriteLanguage } from '../../types/settings';

/**
 * Renders custom frontmatter fields section
 */
export function renderCustomFrontmatterFieldsSection(
    containerEl: HTMLElement,
    plugin: BibliographyPlugin
): void {
    new Setting(containerEl).setName('Custom frontmatter').setHeading();

    const customFieldsDesc = containerEl.createEl('div', {
        cls: 'setting-item-description'
    });

    customFieldsDesc.createEl('p', { text: 'Define custom frontmatter fields with templated values. These will be added to new literature notes.' });

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
    if (plugin.settings.customFrontmatterFields) {
        plugin.settings.customFrontmatterFields.forEach(field => {
            addCustomFieldRow(field, customFieldsContainer, plugin);
        });
    }

    // Add button to add a new custom field
    new Setting(containerEl)
        .setName('Add custom frontmatter field')
        .addButton(button => button
            .setButtonText('Add field')
            .onClick(async () => {
                const newField = {
                    name: '',
                    template: '',
                    enabled: true
                };

                if (!plugin.settings.customFrontmatterFields) {
                    plugin.settings.customFrontmatterFields = [];
                }
                plugin.settings.customFrontmatterFields.push(newField);
                await plugin.saveSettings();

                addCustomFieldRow(newField, customFieldsContainer, plugin);
            })
        );
}

/**
 * Adds a custom field row to the settings
 */
function addCustomFieldRow(
    field: { name: string, template: string, enabled: boolean },
    container: HTMLElement,
    plugin: BibliographyPlugin
): HTMLElement {
    const fieldEl = container.createDiv({ cls: 'custom-frontmatter-field' });

    const validateCslField = (fieldName: string): boolean => {
        return CSL_ALL_CSL_FIELDS.has(fieldName);
    };

    let nameInputEl: HTMLInputElement;

    const warningEl = fieldEl.createDiv({
        cls: 'custom-field-warning',
        attr: { style: 'display: none;' }
    });

    const updateWarningMessage = (fieldName: string) => {
        if (validateCslField(fieldName)) {
            warningEl.empty();

            const callout = warningEl.createDiv({ cls: 'callout callout-error' });
            callout.createDiv({ cls: 'callout-title', text: '❌ CSL Field Conflict' });

            const content = callout.createDiv({ cls: 'callout-content' });
            content.createEl('p').createEl('strong', { text: `"${fieldName}"` }).parentElement?.appendText(' is a standard CSL field and should not be used for custom frontmatter templates.');

            content.createEl('p', { text: 'Using CSL fields in custom templates may cause:' });
            const list = content.createEl('ul');
            list.createEl('li', { text: 'Conflicts with bibliography export tools' });
            list.createEl('li', { text: 'Invalid CSL-JSON output' });
            list.createEl('li', { text: 'Unexpected template behavior' });

            content.createEl('p', { text: `Please choose a different field name (e.g., "custom-${fieldName}", "${fieldName}-note", etc.)` });

            const linkP = content.createEl('p');
            linkP.createEl('a', {
                text: 'View CSL specification →',
                href: 'https://docs.citationstyles.org/en/stable/specification.html#appendix-iv-variables',
                attr: { target: '_blank' }
            });

            warningEl.removeClass('warning-hidden');
            warningEl.addClass('warning-visible');
            warningEl.style.display = 'block';
        } else {
            warningEl.removeClass('warning-visible');
            warningEl.addClass('warning-hidden');
            warningEl.style.display = 'none';
        }
    };

    // Create header with toggle and delete button
    const headerEl = fieldEl.createDiv({ cls: 'custom-frontmatter-field-header' });

    const toggleSetting = new Setting(headerEl)
        .addToggle(toggle => toggle
            .setValue(field.enabled)
            .onChange(async (value) => {
                field.enabled = value;
                await plugin.saveSettings();
            })
        )
        .setName('Enabled')
        .setDesc('Include this field in new literature notes');

    toggleSetting.addExtraButton(button => button
        .setIcon('trash')
        .setTooltip('Delete field')
        .onClick(async () => {
            plugin.settings.customFrontmatterFields =
                plugin.settings.customFrontmatterFields.filter(f =>
                    f !== field
                );
            await plugin.saveSettings();
            fieldEl.remove();
        })
    );

    // Create container for field name
    const nameContainer = fieldEl.createDiv();
    nameContainer.createEl('label', {
        text: 'Field name',
        cls: 'setting-item-name'
    });

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

        if (validateCslField(value)) {
            nameInputEl.addClass('is-invalid');
            new Notice(`"${value}" is a CSL standard field. Using it may produce invalid bibliography files.`, 5000);
            updateWarningMessage(value);
        } else {
            nameInputEl.removeClass('is-invalid');
            warningEl.removeClass('warning-visible');
            warningEl.addClass('warning-hidden');
        }

        field.name = value;
        await plugin.saveSettings();
    });

    if (field.name && validateCslField(field.name)) {
        nameInputEl.addClass('is-invalid');
        updateWarningMessage(field.name);
    }

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
        await plugin.saveSettings();
    });

    return fieldEl;
}

/**
 * Renders favorite languages section
 */
export function renderFavoriteLanguagesSection(
    containerEl: HTMLElement,
    plugin: BibliographyPlugin,
    refreshDisplay: () => void
): void {
    new Setting(containerEl).setName('Favorite languages').setHeading();

    containerEl.createEl('p', {
        text: 'Configure frequently used languages to appear at the top of language dropdowns in modals.',
        cls: 'setting-item-description'
    });

    const favLangsContainer = containerEl.createDiv({ cls: 'favorite-languages-container' });

    if (plugin.settings.favoriteLanguages) {
        plugin.settings.favoriteLanguages.forEach((lang, index) => {
            addFavoriteLanguageRow(lang, index, favLangsContainer, plugin, refreshDisplay);
        });
    }

    new Setting(containerEl)
        .setName('Add favorite language')
        .addButton(button => button
            .setButtonText('Add language')
            .onClick(async () => {
                const newLang = {
                    code: '',
                    name: ''
                };

                if (!plugin.settings.favoriteLanguages) {
                    plugin.settings.favoriteLanguages = [];
                }
                plugin.settings.favoriteLanguages.push(newLang);
                await plugin.saveSettings();

                addFavoriteLanguageRow(newLang, plugin.settings.favoriteLanguages.length - 1, favLangsContainer, plugin, refreshDisplay);
            })
        );
}

/**
 * Adds a favorite language row to the settings
 */
function addFavoriteLanguageRow(
    lang: FavoriteLanguage,
    index: number,
    container: HTMLElement,
    plugin: BibliographyPlugin,
    refreshDisplay: () => void
): void {
    const langEl = container.createDiv({ cls: 'favorite-language-row' });

    new Setting(langEl)
        .setName('')
        .addText(text => text
            .setPlaceholder('Language code (e.g., en, nb, fi)')
            .setValue(lang.code)
            .onChange(async (value) => {
                plugin.settings.favoriteLanguages[index].code = value.trim();
                await plugin.saveSettings();
            }))
        .addText(text => text
            .setPlaceholder('Language name (e.g., English, Norwegian)')
            .setValue(lang.name)
            .onChange(async (value) => {
                plugin.settings.favoriteLanguages[index].name = value.trim();
                await plugin.saveSettings();
            }))
        .addButton(button => button
            .setIcon('up-chevron-glyph')
            .setTooltip('Move up')
            .setDisabled(index === 0)
            .onClick(async () => {
                if (index > 0) {
                    const langs = plugin.settings.favoriteLanguages;
                    [langs[index - 1], langs[index]] = [langs[index], langs[index - 1]];
                    await plugin.saveSettings();
                    refreshDisplay();
                }
            }))
        .addButton(button => button
            .setIcon('down-chevron-glyph')
            .setTooltip('Move down')
            .setDisabled(index === plugin.settings.favoriteLanguages.length - 1)
            .onClick(async () => {
                if (index < plugin.settings.favoriteLanguages.length - 1) {
                    const langs = plugin.settings.favoriteLanguages;
                    [langs[index], langs[index + 1]] = [langs[index + 1], langs[index]];
                    await plugin.saveSettings();
                    refreshDisplay();
                }
            }))
        .addButton(button => button
            .setIcon('trash')
            .setTooltip('Remove')
            .onClick(async () => {
                plugin.settings.favoriteLanguages.splice(index, 1);
                await plugin.saveSettings();
                langEl.remove();
            }));
}
