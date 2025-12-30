import { Setting } from 'obsidian';
import BibliographyPlugin from '../../../main';

/**
 * Renders Zotero connector settings section
 */
export function renderZoteroConnectorSection(containerEl: HTMLElement, plugin: BibliographyPlugin): void {
    new Setting(containerEl).setName('Zotero integration').setHeading();

    containerEl.createEl('p', {
        text: 'Configure settings for the Zotero Connector integration. Note: This feature is only available on desktop.',
        cls: 'setting-item-description'
    });

    new Setting(containerEl)
        .setName('Enable Zotero Connector')
        .setDesc('Allow the plugin to receive data from the Zotero Connector browser extension. Note: Zotero should NOT be running when using this feature.')
        .addToggle(toggle => toggle
            .setValue(plugin.settings.enableZoteroConnector)
            .onChange(async (value) => {
                plugin.settings.enableZoteroConnector = value;
                await plugin.saveSettings();
                if (value) {
                    plugin.startConnectorServer();
                } else {
                    plugin.stopConnectorServer();
                }
            }));

    new Setting(containerEl)
        .setName('Connector port')
        .setDesc('The port to use for the Zotero Connector server. Default is 23119, which is the standard Zotero port.')
        .addText(text => text
            .setPlaceholder('23119')
            .setValue(plugin.settings.zoteroConnectorPort?.toString() || '23119')
            .onChange(async (value) => {
                const portNum = parseInt(value.trim());
                if (!isNaN(portNum) && portNum > 0 && portNum < 65536) {
                    plugin.settings.zoteroConnectorPort = portNum;
                    await plugin.saveSettings();
                    if (plugin.settings.enableZoteroConnector) {
                        plugin.stopConnectorServer();
                        plugin.startConnectorServer();
                    }
                }
            }));

    new Setting(containerEl)
        .setName('Temporary PDF folder')
        .setDesc('Optional: Specify a custom folder for temporarily storing PDFs downloaded from Zotero. Leave empty to use the system temp directory.')
        .addText(text => text
            .setPlaceholder('System temp directory')
            .setValue(plugin.settings.tempPdfPath || '')
            .onChange(async (value) => {
                plugin.settings.tempPdfPath = value.trim();
                await plugin.saveSettings();
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
