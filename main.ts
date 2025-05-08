import { App, Plugin, Notice, Platform, TFile, debounce } from 'obsidian';
import { BibliographyModal } from './src/ui/modals/bibliography-modal';
import { ChapterModal } from './src/ui/modals/chapter-modal';
import { BulkImportModal } from './src/ui/modals/bulk-import-modal';
import { BibliographySettingTab } from './src/ui/settings-tab';
import { BibliographyPluginSettings, DEFAULT_SETTINGS } from './src/types/settings';
import { BibliographyBuilder } from './src/services/bibliography-builder';
// Removed static import: import { ConnectorServer } from './src/services/connector-server';
// Import the TYPE ONLY for type hints if needed
import type { ConnectorServer as ConnectorServerType } from './src/services/connector-server';
import { CitationService } from './src/services/citation-service';
import { AttachmentData, AttachmentType } from './src/types/citation';
import { ReferenceParserService } from './src/services/reference-parser-service';
import { TemplateVariableBuilderService } from './src/services/template-variable-builder-service';
import { FrontmatterBuilderService } from './src/services/frontmatter-builder-service';
import { NoteContentBuilderService } from './src/services/note-content-builder-service';
import { AttachmentManagerService } from './src/services/attachment-manager-service';
import { NoteCreationService } from './src/services/note-creation-service';
import { StatusBarService } from './src/services/status-bar-service';
import './styles.css';

// Suppress non-error console logging in production
console.log = () => {};
console.warn = () => {};

export default class BibliographyPlugin extends Plugin {
    settings: BibliographyPluginSettings;
    // Use the imported type or 'any' for the connector server instance
    private connectorServer: ConnectorServerType | null = null;
    private citationService: CitationService;

    // New service instances
    private referenceParserService: ReferenceParserService;
    private templateVariableBuilder: TemplateVariableBuilderService;
    private frontmatterBuilder: FrontmatterBuilderService;
    private noteContentBuilder: NoteContentBuilderService;
    private attachmentManager: AttachmentManagerService;
    private noteCreationService: NoteCreationService;
    private statusBarService: StatusBarService;
    
    // Track item processing to prevent duplicates from Zotero Connector
    private processingItem: boolean = false;

    async onload() {
        await this.loadSettings();

        // Initialize all services that DO NOT depend on Node.js modules first
        this.citationService = new CitationService(this.settings.citekeyOptions);
        this.templateVariableBuilder = new TemplateVariableBuilderService();
        this.frontmatterBuilder = new FrontmatterBuilderService(this.templateVariableBuilder);
        this.noteContentBuilder = new NoteContentBuilderService(this.frontmatterBuilder, this.templateVariableBuilder);
        this.attachmentManager = new AttachmentManagerService(this.app, this.settings);
        this.referenceParserService = new ReferenceParserService(this.citationService);
        this.noteCreationService = new NoteCreationService(
            this.app,
            this.settings,
            this.referenceParserService,
            this.noteContentBuilder,
            this.attachmentManager
        );
        this.statusBarService = new StatusBarService(this.app, this.connectorServer);

        // --- Add Commands (Platform Independent) ---

        this.addCommand({
            id: 'create-literature-note',
            name: 'Create literature note',
            callback: () => {
                new BibliographyModal(this.app, this.settings, true).open();
            },
        });

        this.addCommand({
            id: 'create-chapter-entry',
            name: 'Create book chapter entry',
            callback: () => {
                new ChapterModal(this.app, this.settings).open();
            },
        });

        this.addCommand({
            id: 'bulk-import-references',
            name: 'Bulk import references',
            callback: () => {
                new BulkImportModal(this.app, this.settings, this.noteCreationService).open();
            },
        });

        this.addCommand({
            id: 'create-chapter-from-current-book',
            name: 'Create chapter from current book',
            checkCallback: (checking) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) return false;

                const cache = this.app.metadataCache.getFileCache(activeFile);
                if (!cache || !cache.frontmatter) return false;

                const frontmatter = cache.frontmatter;
                if (!frontmatter.type || !['book', 'collection', 'document'].includes(frontmatter.type)) {
                    return false;
                }

                const tags = frontmatter.tags;
                if (!tags || !Array.isArray(tags) || !tags.includes(this.settings.literatureNoteTag)) {
                    return false;
                }

                if (checking) return true;

                new ChapterModal(this.app, this.settings, activeFile.path).open();
                return true;
            },
        });

        this.addCommand({
            id: 'build-bibliography',
            name: 'Build bibliography',
            callback: async () => {
                try {
                    new Notice('Building bibliography files...');
                    const builder = new BibliographyBuilder(this.app, this.settings);
                    await builder.buildBibliography();
                } catch (error) {
                    console.error('Error building bibliography:', error);
                    new Notice('Error building bibliography files. Check console for details.');
                }
            },
        });

        this.addCommand({
            id: 'export-bibtex',
            name: 'Export bibliography as BibTeX',
            callback: async () => {
                try {
                    new Notice('Exporting BibTeX file...');
                    const builder = new BibliographyBuilder(this.app, this.settings);
                    await builder.exportBibTeX();
                } catch (_error) {
                    // Errors are logged by BibliographyBuilder
                }
            },
        });

        // --- Desktop-Only Functionality ---
        if (!Platform.isMobile) {
            // Use dynamic import() to load ConnectorServer only on desktop
            import('./src/services/connector-server')
                .then(({ ConnectorServer }) => {

                    // --- Add Desktop-Only Commands ---
                    this.addCommand({
                        id: 'toggle-zotero-connector',
                        name: 'Toggle Zotero Connector server',
                        callback: async () => {
                            if (this.connectorServer) {
                                this.stopConnectorServer();
                                this.settings.enableZoteroConnector = false;
                                await this.saveSettings();
                                new Notice('Zotero Connector server stopped');
                            } else {
                                // Pass the dynamically imported class constructor
                                await this.startConnectorServer(ConnectorServer);
                                if (this.connectorServer) {
                                    this.settings.enableZoteroConnector = true;
                                    await this.saveSettings();
                                    new Notice('Zotero Connector server started');
                                }
                            }
                        },
                    });

                    // --- Register Desktop-Only Event Listeners ---
                    // Main handler for Zotero items
                    const boundItemHandler = this.handleZoteroItemReceived.bind(this);
                    document.addEventListener('zotero-item-received', boundItemHandler);
                    
                    // Additional handler for late-arriving attachments
                    const boundAttachmentHandler = this.handleAdditionalAttachments.bind(this);
                    document.addEventListener('zotero-additional-attachments', boundAttachmentHandler);
                    
                    // Register cleanup using Obsidian's mechanism
                    this.register(() => {
                        document.removeEventListener('zotero-item-received', boundItemHandler);
                        document.removeEventListener('zotero-additional-attachments', boundAttachmentHandler);
                    });

                    // --- Initialize Desktop-Only Features ---
                    // Start connector server if enabled in settings
                    if (this.settings.enableZoteroConnector) {
                        this.startConnectorServer(ConnectorServer);
                    }

                })
                .catch(err => {
                    // This catch block will execute if the dynamic import fails.
                    // On mobile, this isn't an error (the import isn't attempted).
                    // On desktop, a failure here indicates a problem loading the module.
                    console.error("Failed to load ConnectorServer module (unexpected on desktop):", err);
                    new Notice("Failed to load Zotero Connector feature. Check console for details.");
                });
        } 

        // Add settings tab (works on both platforms)
        this.addSettingTab(new BibliographySettingTab(this.app, this));
        
        // Add status bar item for Zotero connector (enabled on both platforms to show status)
        this.statusBarService.addZoteroStatusBarItem(this, this.toggleZoteroConnector.bind(this));
    }
    
    /**
     * Toggle the Zotero connector state
     */
    private async toggleZoteroConnector(): Promise<void> {
        if (this.connectorServer) {
            this.stopConnectorServer();
            this.settings.enableZoteroConnector = false;
            await this.saveSettings();
            new Notice('Zotero Connector server stopped');
        } else {
            // On desktop, use dynamic import to get the ConnectorServer class
            try {
                const { ConnectorServer } = await import('./src/services/connector-server');
                await this.startConnectorServer(ConnectorServer);
                if (this.connectorServer) {
                    this.settings.enableZoteroConnector = true;
                    await this.saveSettings();
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
    async startConnectorServer(ConnectorServerClass?: any): Promise<void> {
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
            // Instantiate using the dynamically imported class - pass the app instance as required
            this.connectorServer = new ConnectorServerClass(this.app, this.settings);

            // ---- FIX: Add null check before calling start ----
            if (this.connectorServer) {
                await this.connectorServer.start(); // Call start on the instance
                // Update status bar after successful start
                this.statusBarService.setConnectorServer(this.connectorServer);
            } else {
                 // This case should ideally not happen if instantiation succeeded, but belts and suspenders
                 console.error("ConnectorServer instance is null immediately after instantiation.");
                 new Notice("Failed to start Zotero Connector: Instance creation error.");
                 // Ensure it remains null if something went wrong during instantiation implicitly
                 this.connectorServer = null;
            }
            // ---- End Fix ----

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
    stopConnectorServer(): void {
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

    // Track active bibliography modal for Zotero imports
    private activeZoteroModal: BibliographyModal | null = null;
    // Track item ID being processed to avoid duplicate modals
    private activeZoteroItemId: string | null = null;
    // Track processed session IDs to avoid duplicate imports
    private processedSessionIds: Set<string> = new Set();

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
        
        // Additional fix: Check if we've already processed this session ID
        if (sessionID && this.processedSessionIds.has(sessionID)) {
            console.log(`Skipping duplicate item event for session ${sessionID}, already processed`);
            return;
        }
        
        // Check if we're already processing an item
        if (this.processingItem) {
            // If we're already processing this exact item (by ID), just add the new attachments
            if (this.activeZoteroItemId === itemId && this.activeZoteroModal) {
                console.log(`Adding attachments to existing modal for item ${itemId}`);
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
        
        console.log(`Processing ${files.length} attachment(s) from Zotero`);
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
                        console.log(`Skipping duplicate File object attachment: ${filePath.name}`);
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
                    console.log(`Added File object attachment: ${filePath.name}`);
                }
                // If 'files' contains paths (requires Node 'fs' on desktop):
                else if (typeof filePath === 'string' && !Platform.isMobile) {
                    const fs = require('fs');
                    if (fs.existsSync(filePath)) {
                        const fileName = filePath.split(/[/\\]/).pop() || 'document.pdf';
                        
                        // Skip if we've already processed a file with this name or path
                        if (processedFiles.has(fileName) || processedFiles.has(filePath)) {
                            console.log(`Skipping duplicate file path attachment: ${fileName}`);
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
                        console.log(`Added file path attachment: ${fileName} (${mimeType})`);
                    } else {
                        console.warn(`Attachment file path not found: ${filePath}`);
                    }
                } else if (typeof filePath === 'string' && Platform.isMobile) {
                    console.warn("Cannot access file paths directly on mobile for Zotero attachments.");
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
            console.log("Additional attachments event received but no files were included");
            return;
        }
        
        // Check if we're already tracking files to avoid duplicates
        const processedAttachmentPaths = new Set<string>();
        
        // Check for duplicate paths before processing
        files.forEach(file => {
            if (typeof file === 'string') {
                processedAttachmentPaths.add(file);
            } else if (file instanceof File) {
                processedAttachmentPaths.add(file.name);
            }
        });
        
        // Log with more detail about duplication status
        console.log(`Received ${files.length} additional attachment(s) for item ${itemId} (${processedAttachmentPaths.size} unique)`);
        
        // Check if we have an active modal for this item
        if (this.activeZoteroItemId === itemId && this.activeZoteroModal) {
            // Process the new attachments and add them to the existing modal
            this.processZoteroAttachments(files, this.activeZoteroModal);
        } else {
            console.log(`No active modal found for item ${itemId}, cannot add additional attachments`);
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
            
            console.log("Zotero processing state reset");
        }, 100);
    }

    async onunload() {
        // Stop the connector server if it's running
        this.stopConnectorServer();
        
        // Remove status bar item
        if (this.statusBarService) {
            this.statusBarService.remove();
        }
        
        // Other cleanup tasks if needed
        // Event listeners registered with this.register() are cleaned up automatically
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        // Ensure citekeyOptions is properly initialized with defaults
        this.settings.citekeyOptions = {
            ...DEFAULT_SETTINGS.citekeyOptions, // Start with defaults
            ...(this.settings.citekeyOptions || {}) // Merge saved options
        };
         // Ensure customFrontmatterFields exists and is an array
        if (!Array.isArray(this.settings.customFrontmatterFields)) {
            this.settings.customFrontmatterFields = DEFAULT_SETTINGS.customFrontmatterFields;
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);

        // Update services that depend on settings
        if (this.citationService) {
            this.citationService = new CitationService(this.settings.citekeyOptions);
        }
        if (this.attachmentManager) {
            // AttachmentManager might need re-initialization or an update method
            this.attachmentManager = new AttachmentManagerService(this.app, this.settings);
        }
        if (this.referenceParserService) {
             // ReferenceParserService depends on CitationService, which might have changed
             this.referenceParserService = new ReferenceParserService(this.citationService);
        }
        if (this.noteCreationService) {
            // NoteCreationService depends on multiple services/settings
            this.noteCreationService = new NoteCreationService(
                this.app,
                this.settings,
                this.referenceParserService,
                this.noteContentBuilder, // Assumes this doesn't need updating
                this.attachmentManager
            );
        }
        if (this.connectorServer) {
            // Update the server settings if it's running
            // Need to add an updateSettings method to ConnectorServer or restart it
             // Simple approach: restart if port changed (requires ConnectorServer class access)
             // This restart logic needs to be inside the desktop-only section or guarded
             // if (!Platform.isMobile) { ... restart logic ... }
        }
    }
}
