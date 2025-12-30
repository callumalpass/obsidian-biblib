import { Setting, TextAreaComponent } from 'obsidian';
import BibliographyPlugin from '../../../main';
import { SettingsUIHelpers } from './settings-ui-helpers';

/**
 * Renders citekey generation section
 */
export function renderCitekeyGenerationSection(
    containerEl: HTMLElement,
    plugin: BibliographyPlugin,
    helpers: SettingsUIHelpers,
    refreshDisplay: () => void
): void {
    new Setting(containerEl).setName('Citation keys').setHeading();

    containerEl.createEl('p', {
        text: 'Configure how citekeys are generated for new literature notes.',
        cls: 'setting-item-description'
    });

    const citekeyTemplateContainer = containerEl.createDiv();
    let citekeyTemplateField: TextAreaComponent | null = null;

    new Setting(citekeyTemplateContainer)
        .setName('Citekey template')
        .setDesc(helpers.createTooltip(
            'Define the pattern for automatically generated citation keys.',
            'Citation keys are unique identifiers used for referencing sources in academic writing. ' +
            'They are typically composed of author names, year, and sometimes title elements.'
        ))
        .addTextArea(text => {
            citekeyTemplateField = text
                .setPlaceholder('{{authors_family.0|lowercase}}{{year}}')
                .setValue(plugin.settings.citekeyOptions.citekeyTemplate)
                .onChange(async (value) => {
                    plugin.settings.citekeyOptions.citekeyTemplate = value.trim();
                    await plugin.saveSettings();
                });
            return citekeyTemplateField;
        })
        .addExtraButton(button => button
            .setIcon('reset')
            .setTooltip('Reset to default')
            .onClick(async () => {
                plugin.settings.citekeyOptions.citekeyTemplate = '{{authors_family.0|lowercase}}{{year}}';
                await plugin.saveSettings();
                refreshDisplay();
            })
        );

    // Add examples section
    const citekeyExamplesContainer = citekeyTemplateContainer.createDiv({
        cls: 'template-examples-container'
    });

    citekeyExamplesContainer.createEl('details', {}, details => {
        details.createEl('summary', { text: 'Common citekey patterns' });
        const list = details.createEl('ul');

        helpers.createListItem(list, '{{authors_family.0|lowercase}}{{year}}', 'Basic author+year format (smith2023)');
        helpers.createListItem(list, '{{authors_family.0|abbr3}}{{year}}', 'First 3 letters of author + year (smi2023)');
        helpers.createListItem(list, '{{authors_family.0|lowercase}}{{year}}{{title|titleword}}', 'Author, year, and first significant title word');
        helpers.createListItem(list, '{{authors_family.0|lowercase}}{{#authors_family.1}}{{authors_family.1|abbr1}}{{/authors_family.1}}{{year}}', 'First author + initial of second author if present');
        helpers.createListItem(list, '{{authors_family.0|lowercase}}_{{authors_family.1|lowercase}}_{{year}}', 'Multiple authors with underscores');
    });

    // Citekey options
    new Setting(containerEl)
        .setName('Use Zotero keys (if available)')
        .setDesc('When importing from Zotero, use their citekey instead of generating one using the template above.')
        .addToggle(toggle => toggle
            .setValue(plugin.settings.citekeyOptions.useZoteroKeys)
            .onChange(async (value) => {
                plugin.settings.citekeyOptions.useZoteroKeys = value;
                await plugin.saveSettings();
            })
        );

    new Setting(containerEl)
        .setName('Minimum citekey length')
        .setDesc('Add a random suffix to citekeys shorter than this length')
        .addSlider(slider => slider
            .setLimits(3, 10, 1)
            .setValue(plugin.settings.citekeyOptions.minCitekeyLength)
            .setDynamicTooltip()
            .onChange(async (value) => {
                plugin.settings.citekeyOptions.minCitekeyLength = value;
                await plugin.saveSettings();
            })
        );
}
