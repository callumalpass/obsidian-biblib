import { Setting, TextAreaComponent, normalizePath } from 'obsidian';
import BibliographyPlugin from '../../../main';
import { SettingsUIHelpers } from './settings-ui-helpers';

/**
 * Renders file organization settings section
 */
export function renderFilePathSettings(
    containerEl: HTMLElement,
    plugin: BibliographyPlugin,
    helpers: SettingsUIHelpers,
    refreshDisplay: () => void
): void {
    new Setting(containerEl).setName('File organization').setHeading();

    new Setting(containerEl)
        .setName('Attachment folder path')
        .setDesc(helpers.createTooltip(
            'The folder where attachment files (PDFs, EPUBs, and other file types) will be stored. Use forward slashes for subfolders.',
            'This path is relative to your vault root. Attachments will be copied here when importing.'
        ))
        .addText(text => text
            .setPlaceholder('biblib')
            .setValue(plugin.settings.attachmentFolderPath)
            .onChange(async (value) => {
                value = normalizePath(value.trim());
                plugin.settings.attachmentFolderPath = value;
                await plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName('Create subfolder for attachments')
        .setDesc('Create a subfolder for each citation (e.g., biblib/citation-key/citation-key.pdf)')
        .addToggle(toggle => toggle
            .setValue(plugin.settings.createAttachmentSubfolder)
            .onChange(async (value) => {
                plugin.settings.createAttachmentSubfolder = value;
                await plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName('Literature note location')
        .setDesc('The folder where literature notes will be stored. Use forward slashes for subfolders. Use "/" for vault.')
        .addText(text => text
            .setPlaceholder('/')
            .setValue(plugin.settings.literatureNotePath)
            .onChange(async (value) => {
                value = normalizePath(value.trim());
                if (value !== '/' && !value.endsWith('/')) value += '/';
                plugin.settings.literatureNotePath = value;
                await plugin.saveSettings();
            }));

    // Filename template with preview
    const filenameTemplateContainer = containerEl.createDiv();
    let filenameTemplateField: TextAreaComponent | null = null;

    new Setting(filenameTemplateContainer)
        .setName('Filename template')
        .setDesc('Template for generating literature note filenames. Uses the same template system as headers and frontmatter.')
        .addTextArea(text => {
            filenameTemplateField = text
                .setPlaceholder('@{{citekey}}')
                .setValue(plugin.settings.filenameTemplate)
                .onChange(async (value) => {
                    plugin.settings.filenameTemplate = value;
                    await plugin.saveSettings();
                });
            return filenameTemplateField;
        })
        .addExtraButton(button => button
            .setIcon('reset')
            .setTooltip('Reset to default')
            .onClick(async () => {
                plugin.settings.filenameTemplate = '@{{citekey}}';
                await plugin.saveSettings();
                refreshDisplay();
            })
        );

    // Add examples section
    const filenameExamplesContainer = filenameTemplateContainer.createDiv({
        cls: 'template-examples-container'
    });

    filenameExamplesContainer.createEl('details', {}, details => {
        details.createEl('summary', { text: 'Common filename patterns' });
        const list = details.createEl('ul');

        helpers.createListItem(list, '@{{citekey}}', 'Standard citekey with @ prefix');
        helpers.createListItem(list, '{{year}}-{{citekey}}', 'Year and citekey (2023-smith)');
        helpers.createListItem(list, '{{type}}/{{citekey}}', 'Type-based folders (article/smith2023)');
        helpers.createListItem(list, '{{citekey}} - {{title|capitalize}}', 'Citekey with title');
        helpers.createListItem(list, 'Lit/{{authors_family.0|lowercase}}_{{year}}', 'Custom prefix with author and year');
    });
}
