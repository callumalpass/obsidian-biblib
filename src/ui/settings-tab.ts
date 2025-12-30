import { App, Platform, PluginSettingTab } from 'obsidian';
import BibliographyPlugin from '../../main';
import { SettingsUIHelpers } from './settings/settings-ui-helpers';
import { renderGeneralSettings } from './settings/general-settings-section';
import { renderFilePathSettings } from './settings/file-organization-section';
import { renderTemplatesSection } from './settings/templates-section';
import { renderCitekeyGenerationSection } from './settings/citekey-section';
import { renderCustomFrontmatterFieldsSection, renderFavoriteLanguagesSection } from './settings/custom-fields-section';
import { renderDefaultModalFieldsSection, renderEditModalSettingsSection } from './settings/modal-config-section';
import { renderZoteroConnectorSection } from './settings/zotero-section';
import { renderBibliographyBuilderSection } from './settings/bibliography-export-section';

export class BibliographySettingTab extends PluginSettingTab {
	plugin: BibliographyPlugin;
	private activeTab: string = 'general';
	private helpers: SettingsUIHelpers;

	constructor(app: App, plugin: BibliographyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.helpers = new SettingsUIHelpers(plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Create the tab navigation
		this.createTabNavigation(containerEl);

		// Create main settings container
		const mainSettingsContainer = containerEl.createDiv({
			cls: 'biblib-settings-container'
		});

		// Render the content for the active tab
		this.renderActiveTab(mainSettingsContainer);
	}

	/**
	 * Creates the tab navigation interface
	 */
	private createTabNavigation(containerEl: HTMLElement): void {
		const tabNavContainer = containerEl.createDiv({
			cls: 'biblib-tab-navigation'
		});

		const tabs = [
			{ id: 'general', name: 'General' },
			{ id: 'files', name: 'File Organization' },
			{ id: 'templates', name: 'Templates' },
			{ id: 'citekeys', name: 'Citation Keys' },
			{ id: 'fields', name: 'Custom Fields' },
			{ id: 'modal', name: 'Modal Configuration' },
			{ id: 'zotero', name: 'Zotero Integration' },
			{ id: 'export', name: 'Bibliography Export' }
		];

		// Filter out Zotero tab on mobile
		const availableTabs = Platform.isMobile ?
			tabs.filter(tab => tab.id !== 'zotero') :
			tabs;

		availableTabs.forEach(tab => {
			const tabButton = tabNavContainer.createEl('button', {
				cls: `biblib-tab-button ${this.activeTab === tab.id ? 'active' : ''}`,
				text: tab.name
			});

			tabButton.addEventListener('click', () => {
				this.activeTab = tab.id;
				this.display();
			});
		});
	}

	/**
	 * Renders the content for the currently active tab
	 */
	private renderActiveTab(containerEl: HTMLElement): void {
		const refreshDisplay = () => this.display();

		switch (this.activeTab) {
			case 'general':
				renderGeneralSettings(containerEl, this.plugin);
				break;
			case 'files':
				renderFilePathSettings(containerEl, this.plugin, this.helpers, refreshDisplay);
				break;
			case 'templates':
				renderTemplatesSection(containerEl, this.plugin, this.helpers, refreshDisplay);
				break;
			case 'citekeys':
				renderCitekeyGenerationSection(containerEl, this.plugin, this.helpers, refreshDisplay);
				break;
			case 'fields':
				renderCustomFrontmatterFieldsSection(containerEl, this.plugin);
				renderFavoriteLanguagesSection(containerEl, this.plugin, refreshDisplay);
				break;
			case 'modal':
				renderDefaultModalFieldsSection(containerEl, this.plugin, refreshDisplay);
				renderEditModalSettingsSection(containerEl, this.plugin);
				break;
			case 'zotero':
				if (!Platform.isMobile) {
					renderZoteroConnectorSection(containerEl, this.plugin);
				}
				break;
			case 'export':
				renderBibliographyBuilderSection(containerEl, this.plugin);
				break;
			default:
				renderGeneralSettings(containerEl, this.plugin);
				break;
		}
	}
}
