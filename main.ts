import { App, Plugin, Notice, Platform, TFile } from 'obsidian';
import { BibliographyModal } from './src/ui/modals/bibliography-modal';
import { ChapterModal } from './src/ui/modals/chapter-modal';
import { BibliographySettingTab } from './src/ui/settings-tab';
import { BibliographyPluginSettings, DEFAULT_SETTINGS } from './src/types/settings';
import { BibliographyBuilder } from './src/services/bibliography-builder';
import { ConnectorServer } from './src/services/connector-server';
import { CitationService } from './src/services/citation-service';
import { AttachmentData, AttachmentType } from './src/types/citation';
import './styles.css';

// Uncomment to suppress non-error console logging in production
// console.log = () => {};
// console.warn = () => {};

export default class BibliographyPlugin extends Plugin {
    settings: BibliographyPluginSettings;
    private connectorServer: ConnectorServer | null = null;
    private citationService: CitationService;

    async onload() {
        await this.loadSettings();
        
        this.citationService = new CitationService(this.settings.citekeyOptions);

        // Add command to create a literature note
        this.addCommand({
            id: 'create-literature-note',
            name: 'Create literature note',
            callback: () => {
                new BibliographyModal(this.app, this.settings).open();
            },
        });
        
        // Add command to create a chapter entry
        this.addCommand({
            id: 'create-chapter-entry',
            name: 'Create book chapter entry',
            callback: () => {
                new ChapterModal(this.app, this.settings).open();
            },
        });
        
        // Add command to create a chapter from current book note
        this.addCommand({
            id: 'create-chapter-from-current-book',
            name: 'Create chapter from current book',
            checkCallback: (checking) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) return false;
                
                const cache = this.app.metadataCache.getFileCache(activeFile);
                if (!cache || !cache.frontmatter) return false;
                
                // Check if it's a book type entry
                const frontmatter = cache.frontmatter;
                if (!frontmatter.type || !['book', 'collection', 'document'].includes(frontmatter.type)) {
                    return false;
                }
                
                // Check if it has the configured literature note tag
                const tags = frontmatter.tags;
                if (!tags || !Array.isArray(tags) || !tags.includes(this.settings.literatureNoteTag)) {
                    return false;
                }
                
                if (checking) return true;
                
                // Open chapter modal with the current book
                new ChapterModal(this.app, this.settings, activeFile.path).open();
                return true;
            },
        });
        
        // Add command to build bibliography
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
        
        // Add command to export all references as BibTeX
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
        
        // Add command to toggle Zotero Connector server (only on desktop)
        if (!Platform.isMobile) {
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
                        await this.startConnectorServer();
                        if (this.connectorServer) {
                            this.settings.enableZoteroConnector = true;
                            await this.saveSettings();
                            new Notice('Zotero Connector server started');
                        }
                    }
                },
            });

            // Register event listener for Zotero item received
            // Use standard event listener, but store reference so we can clean up
            const boundHandler = this.handleZoteroItemReceived.bind(this);
            document.addEventListener('zotero-item-received', boundHandler);
            
            // Register for cleanup when plugin unloads
            this.register(() => {
                document.removeEventListener('zotero-item-received', boundHandler);
            });
            
            // Start connector server if enabled in settings
            if (this.settings.enableZoteroConnector) {
                this.startConnectorServer();
            }
        }

        this.addSettingTab(new BibliographySettingTab(this.app, this));
    }
    
    async startConnectorServer(): Promise<void> {
        // Only allow on desktop platforms
        if (Platform.isMobile) {
            new Notice('Zotero Connector is not supported on mobile devices');
            return;
        }
        
        if (this.connectorServer) return;
        
        this.connectorServer = new ConnectorServer(this.settings);
        try {
            await this.connectorServer.start();
        } catch (error) {
            console.error('Failed to start connector server:', error);
            new Notice(`Failed to start Zotero Connector server: ${error.message}`);
            this.connectorServer = null;
        }
    }
    
    stopConnectorServer(): void {
        if (this.connectorServer) {
            this.connectorServer.stop();
            this.connectorServer = null;
        }
    }
    
    // Track item processing to prevent duplicates
    private processingItem: boolean = false;
    
    /**
     * Handle Zotero item received event
     */
    private handleZoteroItemReceived(event: CustomEvent): void {
        const { item, files } = event.detail;
        
        if (!item) {
            new Notice('Invalid Zotero item received');
            return;
        }
        
        // Check if we're already processing an item to prevent duplicates
        if (this.processingItem) {
            return;
        }
        
        // Set processing flag
        this.processingItem = true;
        
        try {
            // Parse the Zotero item with Citation.js
            const cslData = this.citationService.parseZoteroItem(item);
            
            if (!cslData) {
                new Notice('Failed to parse Zotero data. Check console for details.');
                return;
            }
            
            // Create attachment data if PDF files were downloaded
            let attachmentData: AttachmentData | null = null;
            if (files && files.length > 0) {
                const filePath = files[0];
                const fs = require('fs');
                
                // Check if the file exists
                if (fs.existsSync(filePath)) {
                    const fileName = filePath.split('/').pop() || 'document.pdf';
                    
                    // Create a File object from the file data
                    const fileData = fs.readFileSync(filePath);
                    const file = new File([fileData], fileName, { type: 'application/pdf' });
                    
                    attachmentData = {
                        type: AttachmentType.IMPORT,
                        file: file,
                        filename: fileName
                    };
                    // Attachment data prepared
                }
            }
            
            // Open bibliography modal with pre-filled data
            const modal = new BibliographyModal(this.app, this.settings);
            modal.open();
            
            // We need to wait a bit for the modal to initialize
            setTimeout(() => {
                // Double check that we have required fields 
                const expectedFields = ['title', 'author', 'type', 'issued'];
                const missingFields = expectedFields.filter(field => !cslData[field]);
                if (missingFields.length > 0) {
                    // Silent validation - no need to log warnings
                }
                
                modal.populateFormFromCitoid(cslData);
                
                // Set attachment data if available
                if (attachmentData) {
                    modal.setAttachmentData(attachmentData);
                    new Notice(`Zotero data and PDF attachment loaded. Ready for saving.`);
                } else {
                    new Notice('Zotero data loaded. Please check all fields before saving.');
                }
            }, 300);
            
        } catch (error) {
            console.error('Error processing Zotero item:', error);
            new Notice('Error processing Zotero item. Check console for details.');
        } finally {
            // Clear the processing flag after a slight delay to prevent race conditions
            setTimeout(() => {
                this.processingItem = false;
            }, 500);
        }
    }

    async onunload() {
        // Stop the connector server if it's running
        this.stopConnectorServer();
        
        // No need to clean up event listeners - registerDomEvent handles that automatically
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        
        // Ensure citekeyOptions is properly initialized with defaults
        if (!this.settings.citekeyOptions) {
            this.settings.citekeyOptions = DEFAULT_SETTINGS.citekeyOptions;
        } else {
            // Make sure all required properties exist
            this.settings.citekeyOptions = Object.assign({}, 
                DEFAULT_SETTINGS.citekeyOptions, 
                this.settings.citekeyOptions);
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
        
        // Update citation service with new options if it exists
        if (this.citationService) {
            this.citationService = new CitationService(this.settings.citekeyOptions);
        }
    }
}