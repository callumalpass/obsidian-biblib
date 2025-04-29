import { App, Plugin, Notice, Platform, TFile } from 'obsidian';
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
import './styles.css';

// Uncomment to suppress non-error console logging in production
// console.log = () => {};
// console.warn = () => {};

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
                        name: 'Toggle Zotero Connector Server',
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
                    const boundHandler = this.handleZoteroItemReceived.bind(this);
                    // Use document directly as event target as it's global
                    document.addEventListener('zotero-item-received', boundHandler);
                    // Register cleanup using Obsidian's mechanism
                    this.register(() => {
                        document.removeEventListener('zotero-item-received', boundHandler);
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
            // Instantiate using the dynamically imported class
            this.connectorServer = new ConnectorServerClass(this.settings);

            // ---- FIX: Add null check before calling start ----
            if (this.connectorServer) {
                await this.connectorServer.start(); // Call start on the instance
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
            } catch (error) {
                console.error("Error stopping connector server:", error);
                this.connectorServer = null; // Ensure it's null even if stop fails
            }
        }
    }

    /**
     * Handle the custom 'zotero-item-received' event dispatched by the ConnectorServer.
     */
    private handleZoteroItemReceived(event: CustomEvent): void {
        const { item, files } = event.detail;

        if (!item) {
            new Notice('Invalid Zotero item received');
            console.error('Invalid Zotero item data in event detail:', event.detail);
            return;
        }

        if (this.processingItem) {
            return;
        }
        this.processingItem = true;

        try {
            // Parse the Zotero item using the dedicated service method
            const cslData = this.citationService.parseZoteroItem(item);

            if (!cslData) {
                // parseZoteroItem should throw on failure, but double-check
                throw new Error('Failed to parse Zotero data.');
            }

            // Prepare attachment data if PDF files were downloaded
            let attachmentData: AttachmentData | null = null;
            if (files && Array.isArray(files) && files.length > 0) {
                // Assuming the ConnectorServer provides the temporary file path
                const filePath = files[0]; // Taking the first file for now
                try {
                    // Need 'fs' to read the file; this requires careful handling
                    // We'll assume the ConnectorServer has prepared a File object or similar accessible data
                    // For simplicity, let's modify ConnectorServer to pass File object if possible,
                    // or handle file reading within the try/catch here using desktop-only checks.

                    // *** Simplified Approach: Assume 'files' contains File objects if possible ***
                    // This part needs coordination with how ConnectorServer sends the event detail.
                    // If 'files' contains actual File objects:
                    if (files[0] instanceof File) {
                         attachmentData = {
                            type: AttachmentType.IMPORT,
                            file: files[0],
                            filename: files[0].name
                         };
                    }
                    // If 'files' contains paths (requires Node 'fs' on desktop):
                    else if (typeof files[0] === 'string' && !Platform.isMobile) {
                         const fs = require('fs');
                         if (fs.existsSync(filePath)) {
                            const fileName = filePath.split(/[/\\]/).pop() || 'document.pdf';
                            const fileData = fs.readFileSync(filePath);
                            const file = new File([fileData], fileName, { type: 'application/pdf' });
                            attachmentData = {
                                type: AttachmentType.IMPORT,
                                file: file,
                                filename: fileName
                            };
                         } else {
                            console.warn(`Attachment file path not found: ${filePath}`);
                         }
                    } else if (typeof files[0] === 'string' && Platform.isMobile) {
                        console.warn("Cannot access file paths directly on mobile for Zotero attachments.");
                    }
                } catch (fileError) {
                    console.error(`Error processing attachment file ${files[0]}:`, fileError);
                    new Notice('Error processing downloaded Zotero attachment.');
                }
            }

            // Open bibliography modal with pre-filled data
            // Set openedViaCommand to false since this is opened via Zotero
            const modal = new BibliographyModal(this.app, this.settings, false);
            modal.open();

            // Use a short timeout to allow the modal DOM to render before populating
            setTimeout(() => {
                try {
                    modal.populateFormFromCitoid(cslData);
                    if (attachmentData) {
                        modal.setAttachmentData(attachmentData);
                        new Notice(`Zotero data and attachment loaded.`);
                    } else {
                        new Notice('Zotero data loaded.');
                    }
                } catch (modalError) {
                    console.error("Error populating modal:", modalError);
                    new Notice("Error displaying Zotero data in modal.");
                    modal.close(); // Close the broken modal
                } finally {
                    // Ensure processing flag is reset even if modal population fails
                     setTimeout(() => { this.processingItem = false; }, 100);
                }
            }, 150); // Increased timeout slightly

        } catch (error) {
            console.error('Error processing Zotero item:', error);
            new Notice('Error processing Zotero item. Check console for details.');
             // Reset processing flag in case of error during parsing
             this.processingItem = false;
        }
        // Note: The processing flag is reset inside the setTimeout's finally block
        // or immediately above in the catch block for parsing errors.
    }

    async onunload() {
        // Stop the connector server if it's running
        this.stopConnectorServer();
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
