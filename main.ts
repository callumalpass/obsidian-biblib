import { Plugin } from 'obsidian';
import { BibliographySettingTab } from './src/ui/settings-tab';
import { SettingsManager } from './src/managers/settings-manager';
import { ServiceManager } from './src/managers/service-manager';
import { CommandRegistry } from './src/managers/command-registry';
import { ZoteroConnectorManager } from './src/managers/zotero-connector-manager';
import type { BibliographyPluginSettings } from './src/types/settings';

export default class BibliographyPlugin extends Plugin {
    // Primary managers
    private settingsManager: SettingsManager;
    private serviceManager: ServiceManager;
    private commandRegistry: CommandRegistry;
    private zoteroConnectorManager: ZoteroConnectorManager | null = null;

    // Public accessor for settings
    public settings: BibliographyPluginSettings;

    async onload() {
        // Initialize the settings manager first
        this.settingsManager = new SettingsManager(this);
        this.settings = await this.settingsManager.loadSettings();

        // Initialize the service manager with loaded settings
        this.serviceManager = new ServiceManager(this.app, this.settings);

        // Initialize the command registry
        this.commandRegistry = new CommandRegistry(
            this.app,
            this,
            this.settings,
            this.serviceManager
        );

        // Register commands
        this.commandRegistry.registerCommands();

        // Initialize Zotero connector manager if needed
        this.initializeZoteroConnector();

        // Add settings tab
        this.addSettingTab(new BibliographySettingTab(this.app, this));
    }

    /**
     * Initialize the Zotero connector manager
     */
    private async initializeZoteroConnector(): Promise<void> {
        // Create the Zotero connector manager
        this.zoteroConnectorManager = new ZoteroConnectorManager(
            this.app,
            this,
            this.settings,
            this.serviceManager
        );

        // Initialize the Zotero connector
        await this.zoteroConnectorManager.initialize();

        // Initialize the status bar for Zotero connector
        this.zoteroConnectorManager.initializeStatusBar();
    }

    /**
     * Update settings and related services
     */
    async saveSettings() {
        // Save the settings
        await this.settingsManager.saveSettings();

        // Update services with new settings
        this.serviceManager.updateSettings(this.settings);
    }
    
    /**
     * Start the Zotero Connector server
     * This method is kept for backward compatibility with the settings tab
     */
    async startConnectorServer() {
        if (this.zoteroConnectorManager) {
            const { ConnectorServer } = await import('./src/services/connector-server');
            await this.zoteroConnectorManager.startConnectorServer(ConnectorServer);
        }
    }
    
    /**
     * Stop the Zotero Connector server
     * This method is kept for backward compatibility with the settings tab
     */
    stopConnectorServer() {
        if (this.zoteroConnectorManager) {
            this.zoteroConnectorManager.stopConnectorServer();
        }
    }

    /**
     * Update a partial set of settings 
     */
    async updateSettings(newSettings: Partial<BibliographyPluginSettings>): Promise<void> {
        // Update and save the settings
        this.settings = await this.settingsManager.updateSettings(newSettings);

        // Update services with new settings
        this.serviceManager.updateSettings(this.settings);
    }

    /**
     * Clean up when plugin is disabled
     */
    onunload() {
        // Stop the Zotero connector
        if (this.zoteroConnectorManager) {
            this.zoteroConnectorManager.onUnload();
        }

        // Cleanup services
        this.serviceManager.onUnload();
    }
}