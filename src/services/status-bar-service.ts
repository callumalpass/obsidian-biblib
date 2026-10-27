import { App, Platform, Plugin } from 'obsidian';
import type { ConnectorServer } from './connector-server';

export class StatusBarService {
    private statusBarItem: HTMLElement | null = null;
    private app: App;
    private connectorServer: ConnectorServer | null = null;

    constructor(app: App, connectorServer: ConnectorServer | null = null) {
        this.app = app;
        this.connectorServer = connectorServer;
    }

    /**
     * Initialize the status bar item for the plugin
     * @param plugin The plugin instance to register the status bar with
     * @param toggleCallback Optional callback function to toggle the server state
     */
    public addZoteroStatusBarItem(plugin: Plugin, toggleCallback?: () => Promise<void>): void {
        // The connector is desktop-only. Avoid duplicate items on reinitialization.
        if (Platform.isMobile || this.statusBarItem) return;

        this.statusBarItem = plugin.addStatusBarItem();
        
        // Add null check
        if (!this.statusBarItem) {
            console.error("Failed to create status bar item");
            return;
        }
        
        this.statusBarItem.addClass('zotero-connector-status');
        
        // Initialize with current status
        this.updateZoteroStatusBar();
        
        // Make the status bar item clickable to toggle the server
        if (!Platform.isMobile && toggleCallback) {
            this.statusBarItem.onclick = async () => {
                await toggleCallback();
                // Status bar will be updated by the callback
            };
            
            // Add tooltip
            this.statusBarItem.title = "Click to toggle Zotero connector server";
        } else {
            // On mobile, just show status without click action
            this.statusBarItem.title = "Zotero connector status (mobile not supported)";
        }
    }
    
    /**
     * Update the status bar item to reflect the current state of the Zotero connector
     */
    public updateZoteroStatusBar(): void {
        // Early return if statusBarItem is null
        if (!this.statusBarItem) return;
        
        if (this.connectorServer) {
            // Server is running
            this.statusBarItem.show();
            this.statusBarItem.empty();
            this.statusBarItem.addClass('active');
            this.statusBarItem.removeClass('inactive');
            
            // Add icon and text
            const iconSpan = this.statusBarItem.createSpan({ cls: 'status-icon' });
            iconSpan.textContent = '●'; // Filled circle for active
            
            const textSpan = this.statusBarItem.createSpan({ cls: 'status-text' });
            textSpan.textContent = 'Zotero connector active';
        } else {
            // A disabled connector should not occupy status bar space. Startup
            // failures are reported by the connector manager through notices.
            this.statusBarItem.hide();
            this.statusBarItem.empty();
            this.statusBarItem.removeClass('active');
        }
    }

    /**
     * Update the connector server reference
     * @param connectorServer The connector server instance
     */
    public setConnectorServer(connectorServer: ConnectorServer | null): void {
        this.connectorServer = connectorServer;
        this.updateZoteroStatusBar();
    }

    /**
     * Remove the status bar item
     */
    public remove(): void {
        if (this.statusBarItem) {
            this.statusBarItem.remove();
            this.statusBarItem = null;
        }
    }
}
