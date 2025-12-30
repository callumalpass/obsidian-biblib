import { Setting } from 'obsidian';
import BibliographyPlugin from '../../../main';
import { CSL_ALL_CSL_FIELDS, CSL_DATE_FIELDS, CSL_NUMBER_FIELDS } from '../../utils/csl-variables';
import { ModalFieldConfig } from '../../types/settings';

/**
 * Renders default modal fields section
 */
export function renderDefaultModalFieldsSection(
    containerEl: HTMLElement,
    plugin: BibliographyPlugin,
    refreshDisplay: () => void
): void {
    new Setting(containerEl).setName('Default modal fields').setHeading();

    const desc = containerEl.createEl('div', {
        cls: 'setting-item-description'
    });

    desc.createEl('p', { text: 'Configure which CSL-compliant fields appear as primary inputs in the "Create literature note" modal.' });
    desc.createEl('p', { text: 'This is useful for workflows that frequently use specific fields (e.g., archival research needing archive, archive-place, archive_location).' });

    const fieldsContainer = containerEl.createDiv({ cls: 'default-modal-fields-container' });

    if (plugin.settings.defaultModalFields) {
        plugin.settings.defaultModalFields.forEach((field, index) => {
            addDefaultModalFieldRow(field, index, fieldsContainer, plugin, refreshDisplay);
        });
    }

    new Setting(containerEl)
        .setName('Add default modal field')
        .addButton(button => button
            .setButtonText('Add field')
            .onClick(async () => {
                const newField: ModalFieldConfig = {
                    name: '',
                    label: '',
                    type: 'text',
                    description: '',
                    placeholder: '',
                    required: false,
                    defaultValue: ''
                };

                if (!plugin.settings.defaultModalFields) {
                    plugin.settings.defaultModalFields = [];
                }
                plugin.settings.defaultModalFields.push(newField);
                await plugin.saveSettings();

                addDefaultModalFieldRow(newField, plugin.settings.defaultModalFields.length - 1, fieldsContainer, plugin, refreshDisplay);
            })
        );
}

/**
 * Detect the appropriate field type based on CSL field name
 */
function detectFieldType(fieldName: string): 'text' | 'textarea' | 'number' | 'date' | 'toggle' | 'dropdown' {
    if (CSL_DATE_FIELDS.includes(fieldName)) {
        return 'date';
    }

    if (CSL_NUMBER_FIELDS.includes(fieldName)) {
        return 'number';
    }

    if (fieldName === 'abstract' || fieldName === 'note' || fieldName === 'annote') {
        return 'textarea';
    }

    return 'text';
}

/**
 * Update field name validation for default modal fields
 */
function updateFieldNameValidation(fieldName: string, inputEl: HTMLInputElement, warningEl: HTMLElement): void {
    if (!fieldName || fieldName.trim() === '') {
        inputEl.removeClass('field-valid', 'field-invalid');
        warningEl.style.display = 'none';
        return;
    }

    const isCSLCompliant = CSL_ALL_CSL_FIELDS.has(fieldName);

    if (isCSLCompliant) {
        inputEl.removeClass('field-invalid');
        inputEl.addClass('field-valid');
        warningEl.style.display = 'none';
    } else {
        inputEl.removeClass('field-valid');
        inputEl.addClass('field-invalid');

        warningEl.empty();
        const callout = warningEl.createDiv({ cls: 'callout callout-warning' });
        callout.createDiv({ cls: 'callout-title', text: '⚠️ Non-CSL Field' });

        const content = callout.createDiv({ cls: 'callout-content' });
        content.createEl('p').appendText(`"${fieldName}" is not a standard CSL field. Default modal fields should be CSL-compliant to ensure compatibility with bibliography tools. Please choose a field from the dropdown or check the `);
        content.lastElementChild?.createEl('a', {
            text: 'CSL specification',
            href: 'https://docs.citationstyles.org/en/stable/specification.html#appendix-iv-variables',
            attr: { target: '_blank' }
        });
        content.lastElementChild?.appendText('.');

        warningEl.style.display = 'block';
    }
}

/**
 * Adds a default modal field row to the settings
 */
function addDefaultModalFieldRow(
    field: ModalFieldConfig,
    index: number,
    container: HTMLElement,
    plugin: BibliographyPlugin,
    refreshDisplay: () => void
): void {
    const fieldEl = container.createDiv({ cls: 'default-modal-field' });

    let fieldNameInput: HTMLInputElement | null = null;
    let warningEl: HTMLElement | null = null;
    let typeDropdown: HTMLSelectElement | null = null;

    const fieldNameSetting = new Setting(fieldEl)
        .setName('CSL field name')
        .setDesc('The CSL field key (e.g., "archive", "URL")');

    fieldNameSetting
        .addText(text => {
            fieldNameInput = text.inputEl;
            text.setPlaceholder('e.g., archive')
                .setValue(field.name)
                .onChange(async (value) => {
                    const trimmedValue = value.trim();
                    plugin.settings.defaultModalFields[index].name = trimmedValue;

                    if (CSL_ALL_CSL_FIELDS.has(trimmedValue)) {
                        const detectedType = detectFieldType(trimmedValue);
                        plugin.settings.defaultModalFields[index].type = detectedType;
                        if (typeDropdown) {
                            typeDropdown.value = detectedType;
                            typeDropdown.disabled = true;
                        }
                    } else if (typeDropdown) {
                        typeDropdown.disabled = false;
                    }

                    await plugin.saveSettings();
                    if (fieldNameInput && warningEl) {
                        updateFieldNameValidation(trimmedValue, fieldNameInput, warningEl);
                    }
                });
            return text;
        })
        .addDropdown(dropdown => {
            dropdown.addOption('', 'Choose from CSL fields...');

            const sortedCSLFields = Array.from(CSL_ALL_CSL_FIELDS).sort();
            sortedCSLFields.forEach(cslField => {
                dropdown.addOption(cslField, cslField);
            });

            dropdown.onChange(async (value) => {
                if (value && value !== '' && fieldNameInput && warningEl) {
                    fieldNameInput.value = value;
                    plugin.settings.defaultModalFields[index].name = value;

                    if (CSL_ALL_CSL_FIELDS.has(value)) {
                        const detectedType = detectFieldType(value);
                        plugin.settings.defaultModalFields[index].type = detectedType;
                        if (typeDropdown) {
                            typeDropdown.value = detectedType;
                            typeDropdown.disabled = true;
                        }
                    } else if (typeDropdown) {
                        typeDropdown.disabled = false;
                    }

                    await plugin.saveSettings();
                    updateFieldNameValidation(value, fieldNameInput, warningEl);
                }
            });

            return dropdown;
        });

    warningEl = fieldEl.createDiv({
        cls: 'modal-field-warning',
        attr: { style: 'display: none;' }
    });

    if (fieldNameInput && warningEl) {
        updateFieldNameValidation(field.name, fieldNameInput, warningEl);
    }

    new Setting(fieldEl)
        .setName('Display label')
        .setDesc('The label shown in the modal')
        .addText(text => text
            .setPlaceholder('e.g., Archive Name')
            .setValue(field.label)
            .onChange(async (value) => {
                plugin.settings.defaultModalFields[index].label = value.trim();
                await plugin.saveSettings();
            }));

    new Setting(fieldEl)
        .setName('Field type')
        .setDesc('The type of input control')
        .addDropdown(dropdown => {
            typeDropdown = dropdown.selectEl as HTMLSelectElement;
            dropdown
                .addOption('text', 'Text')
                .addOption('textarea', 'Text Area')
                .addOption('number', 'Number')
                .addOption('date', 'Date')
                .addOption('toggle', 'Toggle')
                .addOption('dropdown', 'Dropdown')
                .setValue(field.type)
                .onChange(async (value: any) => {
                    plugin.settings.defaultModalFields[index].type = value;
                    await plugin.saveSettings();
                    refreshDisplay();
                });
            return dropdown;
        });

    if (field.name && CSL_ALL_CSL_FIELDS.has(field.name) && typeDropdown) {
        const detectedType = detectFieldType(field.name);
        if (field.type !== detectedType) {
            plugin.settings.defaultModalFields[index].type = detectedType;
            (typeDropdown as HTMLSelectElement).value = detectedType;
            plugin.saveSettings();
        }
        (typeDropdown as HTMLSelectElement).disabled = true;
    }

    new Setting(fieldEl)
        .setName('Description')
        .setDesc('Optional help text shown below the field')
        .addText(text => text
            .setPlaceholder('Optional description')
            .setValue(field.description || '')
            .onChange(async (value) => {
                plugin.settings.defaultModalFields[index].description = value.trim();
                await plugin.saveSettings();
            }));

    new Setting(fieldEl)
        .setName('Placeholder')
        .setDesc('Optional placeholder text')
        .addText(text => text
            .setPlaceholder('Optional placeholder')
            .setValue(field.placeholder || '')
            .onChange(async (value) => {
                plugin.settings.defaultModalFields[index].placeholder = value.trim();
                await plugin.saveSettings();
            }));

    new Setting(fieldEl)
        .setName('Default value')
        .setDesc('Default value for new notes')
        .addText(text => text
            .setPlaceholder('Optional default value')
            .setValue(field.defaultValue?.toString() || '')
            .onChange(async (value) => {
                plugin.settings.defaultModalFields[index].defaultValue = value.trim();
                await plugin.saveSettings();
            }));

    new Setting(fieldEl)
        .setName('Required field')
        .setDesc('Mark as required (for UI hint only)')
        .addToggle(toggle => toggle
            .setValue(field.required || false)
            .onChange(async (value) => {
                plugin.settings.defaultModalFields[index].required = value;
                await plugin.saveSettings();
            }));

    new Setting(fieldEl)
        .setName('')
        .addButton(button => button
            .setButtonText('Remove field')
            .setWarning()
            .onClick(async () => {
                plugin.settings.defaultModalFields.splice(index, 1);
                await plugin.saveSettings();
                fieldEl.remove();
            }));

    fieldEl.createEl('hr');
}

/**
 * Renders edit modal settings section
 */
export function renderEditModalSettingsSection(containerEl: HTMLElement, plugin: BibliographyPlugin): void {
    new Setting(containerEl).setName('Edit literature note settings').setHeading();

    containerEl.createEl('p', {
        text: 'Configure default behavior when editing existing literature notes.',
        cls: 'setting-item-description'
    });

    new Setting(containerEl)
        .setName('Regenerate citekey by default')
        .setDesc('When editing a note, regenerate the citekey if relevant data changes')
        .addToggle(toggle => toggle
            .setValue(plugin.settings.editRegenerateCitekeyDefault)
            .onChange(async (value) => {
                plugin.settings.editRegenerateCitekeyDefault = value;
                await plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName('Update custom frontmatter by default')
        .setDesc('When editing a note, update custom frontmatter fields from templates')
        .addToggle(toggle => toggle
            .setValue(plugin.settings.editUpdateCustomFrontmatterDefault)
            .onChange(async (value) => {
                plugin.settings.editUpdateCustomFrontmatterDefault = value;
                await plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName('Regenerate note body by default')
        .setDesc('When editing a note, regenerate the note body from the header template')
        .addToggle(toggle => toggle
            .setValue(plugin.settings.editRegenerateBodyDefault)
            .onChange(async (value) => {
                plugin.settings.editRegenerateBodyDefault = value;
                await plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName('Rename file on citekey change')
        .setDesc('When the citekey changes during edit, rename the file to match')
        .addToggle(toggle => toggle
            .setValue(plugin.settings.editRenameFileOnCitekeyChange)
            .onChange(async (value) => {
                plugin.settings.editRenameFileOnCitekeyChange = value;
                await plugin.saveSettings();
            }));
}
