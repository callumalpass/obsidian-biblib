import { App, Notice, Platform, Plugin, debounce } from 'obsidian';
import { BibliographyModal } from '../ui/modals/bibliography-modal';
import { BibliographyPluginSettings } from '../types/settings';
import { AttachmentData, AttachmentType } from '../types/citation';
import { CitationService } from '../services/citation-service';
import { StatusBarService } from '../services/status-bar-service';

// Import the TYPE ONLY for type hints, the actual class is loaded dynamically
import type { ConnectorServer as ConnectorServerType } from '../services/connector-server';

/**
 * Manages the Zotero Connector functionality including server management,
 * event handling, and Zotero item processing.
 */
export class ZoteroConnectorManager {
    private connectorServer: ConnectorServerType | null = null;
    
    // Track active bibliography modal for Zotero imports
    private activeZoteroModal: BibliographyModal | null = null;
    
    // Track item ID being processed to avoid duplicate modals
    private activeZoteroItemId: string | null = null;
    
    // Track processed session IDs to avoid duplicate imports
    private processedSessionIds: Set<string> = new Set();
    
    // Track item processing to prevent duplicates from Zotero Connector
    private processingItem: boolean = false;

    constructor(
        private app: App, 
        private plugin: Plugin,
        private settings: BibliographyPluginSettings,
        private citationService: CitationService,
        private statusBarService: StatusBarService
    ) {}

    /**
     * Initialize the Zotero connector functionality
     * This should be called during plugin load
     */
    public async initialize(): Promise<void> {
        // Only initialize on desktop
        if (Platform.isMobile) return;

        try {
            // Use dynamic import() to load ConnectorServer only on desktop
            const { ConnectorServer } = await import('../services/connector-server');

            // Register desktop-only event listeners
            this.registerEventListeners();

            // Register the toggle command
            this.registerToggleCommand(ConnectorServer);

            // Start connector server if enabled in settings
            if (this.settings.enableZoteroConnector) {
                await this.startConnectorServer(ConnectorServer);
            }
        } catch (err) {
            console.error("Failed to load ConnectorServer module:", err);
            new Notice("Failed to load Zotero Connector feature. Check console for details.");
        }
    }

    /**
     * Register event listeners for Zotero connector
     */
    private registerEventListeners(): void {
        // Main handler for Zotero items
        const boundItemHandler = this.handleZoteroItemReceived.bind(this);
        document.addEventListener('zotero-item-received', boundItemHandler);
        
        // Additional handler for late-arriving attachments
        const boundAttachmentHandler = this.handleAdditionalAttachments.bind(this);
        document.addEventListener('zotero-additional-attachments', boundAttachmentHandler);
        
        // Register cleanup using Obsidian's mechanism
        this.plugin.register(() => {
            document.removeEventListener('zotero-item-received', boundItemHandler);
            document.removeEventListener('zotero-additional-attachments', boundAttachmentHandler);
        });
    }

    /**
     * Register the toggle command for the Zotero connector
     */
    private registerToggleCommand(ConnectorServerClass: any): void {
        this.plugin.addCommand({
            id: 'toggle-zotero-connector',
            name: 'Toggle Zotero Connector server',
            callback: async () => {
                if (this.connectorServer) {
                    this.stopConnectorServer();
                    this.settings.enableZoteroConnector = false;
                    await this.plugin.saveData(this.settings);
                    new Notice('Zotero Connector server stopped');
                } else {
                    // Pass the dynamically imported class constructor
                    await this.startConnectorServer(ConnectorServerClass);
                    if (this.connectorServer) {
                        this.settings.enableZoteroConnector = true;
                        await this.plugin.saveData(this.settings);
                        new Notice('Zotero Connector server started');
                    }
                }
            },
        });
    }

    /**
     * Toggle the Zotero connector state
     */
    public async toggleZoteroConnector(): Promise<void> {
        if (this.connectorServer) {
            this.stopConnectorServer();
            this.settings.enableZoteroConnector = false;
            await this.plugin.saveData(this.settings);
            new Notice('Zotero Connector server stopped');
        } else {
            // On desktop, use dynamic import to get the ConnectorServer class
            try {
                const { ConnectorServer } = await import('../services/connector-server');
                await this.startConnectorServer(ConnectorServer);
                if (this.connectorServer) {
                    this.settings.enableZoteroConnector = true;
                    await this.plugin.saveData(this.settings);
                    new Notice('Zotero Connector server started');
                }
            } catch (error) {
                console.error("Failed to load ConnectorServer module:", error);
                new Notice("Failed to load Zotero Connector feature.");
            }
        }
    }

    /**
     * Start the Zotero Connector server. Only runs on desktop.
     * Accepts the ConnectorServer class constructor obtained via dynamic import.
     */
    public async startConnectorServer(ConnectorServerClass?: any): Promise<void> {
        // Redundant check, but good practice
        if (Platform.isMobile) return;

        if (this.connectorServer) {
            return;
        }

        // Check if the class constructor was provided (it should be on desktop)
        if (!ConnectorServerClass) {
            console.error("ConnectorServer class was not provided to startConnectorServer. Cannot start.");
            new Notice("Internal error: Failed to initialize Zotero Connector.");
            return;
        }

        try {
            // Instantiate using the dynamically imported class
            this.connectorServer = new ConnectorServerClass(this.app, this.settings);

            // Add null check before calling start
            if (this.connectorServer) {
                await this.connectorServer.start(); // Call start on the instance
                // Update status bar after successful start
                this.statusBarService.setConnectorServer(this.connectorServer);
            } else {
                // This case should ideally not happen if instantiation succeeded
                console.error("ConnectorServer instance is null immediately after instantiation.");
                new Notice("Failed to start Zotero Connector: Instance creation error.");
                // Ensure it remains null if something went wrong during instantiation
                this.connectorServer = null;
            }
        } catch (error: any) { // Explicitly type error
            console.error('Failed to start connector server:', error);
            new Notice(`Failed to start Zotero Connector server: ${error.message}`);
            this.connectorServer = null; // Reset on failure
            // Update status bar after failure
            this.statusBarService.setConnectorServer(null);
        }
    }

    /**
     * Stop the Zotero Connector server.
     */
    public stopConnectorServer(): void {
        if (this.connectorServer) {
            try {
                this.connectorServer.stop(); // Call stop on the instance
                this.connectorServer = null;
                // Update status bar after stopping
                this.statusBarService.setConnectorServer(null);
            } catch (error) {
                console.error("Error stopping connector server:", error);
                this.connectorServer = null; // Ensure it's null even if stop fails
                // Update status bar after error
                this.statusBarService.setConnectorServer(null);
            }
        }
    }

    /**
     * Initialize the status bar for Zotero connector
     */
    public initializeStatusBar(): void {
        this.statusBarService.addZoteroStatusBarItem(
            this.plugin, 
            this.toggleZoteroConnector.bind(this)
        );
    }

    /**
     * Handle the custom 'zotero-item-received' event dispatched by the ConnectorServer.
     */
    private handleZoteroItemReceived(event: CustomEvent): void {
        const { item, files, sessionID } = event.detail;

        if (!item) {
            new Notice('Invalid Zotero item received');
            console.error('Invalid Zotero item data in event detail:', event.detail);
            return;
        }

        const itemId = item.id || 'unknown';
        
        // Check if we've already processed this session ID
        if (sessionID && this.processedSessionIds.has(sessionID)) {
            return;
        }
        
        // Check if we're already processing an item
        if (this.processingItem) {
            // If we're already processing this exact item (by ID), just add the new attachments
            if (this.activeZoteroItemId === itemId && this.activeZoteroModal) {
                // Just process new attachments for the existing modal
                this.processZoteroAttachments(files, this.activeZoteroModal);
                return;
            }
            // If it's a different item or no modal, must wait
            return;
        }
        
        // Not currently processing, so start processing this item
        this.processingItem = true;
        this.activeZoteroItemId = itemId;
        
        // Add this session ID to the processed set
        if (sessionID) {
            this.processedSessionIds.add(sessionID);
            
            // Keep the set from growing too large by pruning old entries
            // after 10 minutes or when it exceeds 50 entries
            setTimeout(() => {
                this.processedSessionIds.delete(sessionID);
            }, 10 * 60 * 1000); // 10 minutes
            
            if (this.processedSessionIds.size > 50) {
                // Remove the oldest entries (first ones added)
                const iterator = this.processedSessionIds.values();
                for (let i = 0; i < 10; i++) {
                    const toDelete = iterator.next().value;
                    if (toDelete) this.processedSessionIds.delete(toDelete);
                }
            }
        }

        try {
            // For webpage/news items, try to extract author from extra fields
            if ((!item.creators || !Array.isArray(item.creators) || item.creators.length === 0) &&
                (item.itemType === 'webpage' || item.itemType === 'newspaperArticle')) {
                // Look for potential author info in other fields
                if (item.byline) {
                    if (!item.creators) item.creators = [];
                    item.creators.push({ creatorType: 'author', name: item.byline });
                }
            }
            
            // Parse the Zotero item using the dedicated service method
            const cslData = this.citationService.parseZoteroItem(item);

            if (!cslData) {
                // parseZoteroItem should throw on failure, but double-check
                throw new Error('Failed to parse Zotero data.');
            }

            // Open bibliography modal with pre-filled data
            // Set openedViaCommand to false since this is opened via Zotero
            const modal = new BibliographyModal(this.app, this.settings, false);
            
            // Store reference to the modal for potential future attachments
            this.activeZoteroModal = modal;
            
            modal.open();

            // Use debounce to allow the modal DOM to render before populating
            // The debounced function will run after 150ms of inactivity
            const populateModal = debounce(() => {
                try {
                    // First populate with the citation data
                    modal.populateFormFromCitoid(cslData);
                    
                    // Then process any attachments we have now
                    this.processZoteroAttachments(files, modal);
                    
                    new Notice('Zotero data loaded');
                } catch (modalError) {
                    console.error("Error populating modal:", modalError);
                    new Notice("Error displaying Zotero data in modal.");
                    modal.close(); // Close the broken modal
                    this.resetZoteroProcessing(); // Make sure to reset processing state
                }
            }, 150);

            // Execute the debounced function
            populateModal();
            
            // Set up a listener for when the modal is closed
            modal.onClose = () => {
                this.resetZoteroProcessing();
            };

        } catch (error) {
            console.error('Error processing Zotero item:', error);
            new Notice('Error processing Zotero item. Check console for details.');
            // Reset all Zotero processing state
            this.resetZoteroProcessing();
        }
    }
    
    /**
     * Process Zotero attachment files and add them to the modal
     */
    private processZoteroAttachments(files: any[], modal: BibliographyModal): void {
        // Process attachments if we have any
        if (!files || !Array.isArray(files) || files.length === 0) {
            return;
        }
        
        let attachmentsAdded = 0;
        
        // Track already processed attachments to prevent duplicates
        const processedFiles = new Set<string>();
        
        // Get existing attachments from modal to check for duplicates
        const existingAttachments = modal.getAttachmentData();
        for (const existing of existingAttachments) {
            if (existing.filename) {
                processedFiles.add(existing.filename);
            } else if (existing.file) {
                processedFiles.add(existing.file.name);
            } else if (existing.path) {
                const fileName = existing.path.split(/[/\\]/).pop() || '';
                if (fileName) processedFiles.add(fileName);
            }
        }
        
        // Process each file in the array
        for (const filePath of files) {
            try {
                // If 'files' contains actual File objects:
                if (filePath instanceof File) {
                    // Skip if we've already processed a file with this name
                    if (processedFiles.has(filePath.name)) {
                        continue;
                    }
                    
                    const attachmentData: AttachmentData = {
                        type: AttachmentType.IMPORT,
                        file: filePath,
                        filename: filePath.name
                    };
                    modal.setAttachmentData(attachmentData);
                    processedFiles.add(filePath.name);
                    attachmentsAdded++;
                }
                // If 'files' contains paths (requires Node 'fs' on desktop):
                else if (typeof filePath === 'string' && !Platform.isMobile) {
                    const fs = require('fs');
                    if (fs.existsSync(filePath)) {
                        const fileName = filePath.split(/[/\\]/).pop() || 'document.pdf';
                        
                        // Skip if we've already processed a file with this name or path
                        if (processedFiles.has(fileName) || processedFiles.has(filePath)) {
                            continue;
                        }
                        
                        const fileData = fs.readFileSync(filePath);
                        
                        // Determine MIME type based on extension
                        let mimeType = 'application/octet-stream'; // Default type
                        const ext = fileName.toLowerCase().split('.').pop();
                        if (ext === 'pdf') mimeType = 'application/pdf';
                        else if (ext === 'html' || ext === 'htm') mimeType = 'text/html';
                        else if (ext === 'epub') mimeType = 'application/epub+zip';
                        
                        const file = new File([fileData], fileName, { type: mimeType });
                        const attachmentData: AttachmentData = {
                            type: AttachmentType.IMPORT,
                            file: file,
                            filename: fileName
                        };
                        modal.setAttachmentData(attachmentData);
                        processedFiles.add(fileName);
                        processedFiles.add(filePath); // Also track the full path
                        attachmentsAdded++;
                    }
                }
            } catch (fileError) {
                console.error(`Error processing attachment file ${filePath}:`, fileError);
                new Notice(`Error processing Zotero attachment: ${typeof filePath === 'string' ? filePath.split(/[/\\]/).pop() : 'Unknown file'}`);
            }
        }
        
        // Show notice only if we added attachments
        if (attachmentsAdded > 0) {
            new Notice(`${attachmentsAdded} attachment(s) added to Zotero item`);
        }
    }
    
    /**
     * Handle additional attachments event that arrives after the initial item event
     * This is specifically for slow-loading attachments like PDFs
     */
    private handleAdditionalAttachments(event: CustomEvent): void {
        const { itemId, files, sessionID } = event.detail;
        
        if (!files || !Array.isArray(files) || files.length === 0) {
            return;
        }
        
        // Check if we have an active modal for this item
        if (this.activeZoteroItemId === itemId && this.activeZoteroModal) {
            // Process the new attachments and add them to the existing modal
            this.processZoteroAttachments(files, this.activeZoteroModal);
        }
    }
    
    /**
     * Reset all Zotero processing state
     */
    private resetZoteroProcessing(): void {
        // Use a small timeout to ensure any queued operations complete
        setTimeout(() => {
            this.processingItem = false;
            this.activeZoteroItemId = null;
            this.activeZoteroModal = null;
            
            // Don't clear the entire processed sessions set - we still want to prevent
            // duplicates after modal is closed. Individual entries are cleaned up on their
            // own timer or when the set grows too large.
        }, 100);
    }

    /**
     * Get the connector server instance
     */
    public getConnectorServer(): ConnectorServerType | null {
        return this.connectorServer;
    }

    /**
     * Check if the connector server is running
     */
    public isServerRunning(): boolean {
        return this.connectorServer !== null;
    }

    /**
     * Clean up resources when the plugin is unloaded
     */
    public onUnload(): void {
        this.stopConnectorServer();
    }
}