import { App } from 'obsidian';
import { BibliographyPluginSettings } from '../types/settings';
import { CitationService } from '../services/citation-service';
import { ReferenceParserService } from '../services/reference-parser-service';
import { TemplateVariableBuilderService } from '../services/template-variable-builder-service';
import { FrontmatterBuilderService } from '../services/frontmatter-builder-service';
import { NoteContentBuilderService } from '../services/note-content-builder-service';
import { AttachmentManagerService } from '../services/attachment-manager-service';
import { NoteCreationService } from '../services/note-creation-service';
import { StatusBarService } from '../services/status-bar-service';

/**
 * Manages the initialization and access to services used by the bibliography plugin.
 * Provides dependency injection by creating services in the correct order and
 * maintaining references to them.
 */
export class ServiceManager {
    // Core services
    private citationService: CitationService;
    private templateVariableBuilder: TemplateVariableBuilderService;
    private frontmatterBuilder: FrontmatterBuilderService;
    private noteContentBuilder: NoteContentBuilderService;
    private attachmentManager: AttachmentManagerService;
    private referenceParserService: ReferenceParserService;
    private noteCreationService: NoteCreationService;
    private statusBarService: StatusBarService;

    constructor(
        private app: App,
        private settings: BibliographyPluginSettings
    ) {
        this.initializeServices();
    }

    /**
     * Initialize all services in the correct order to respect dependencies
     */
    private initializeServices(): void {
        // Initialize all services that DO NOT depend on Node.js modules first
        this.citationService = new CitationService(this.settings.citekeyOptions);
        this.templateVariableBuilder = new TemplateVariableBuilderService();
        this.frontmatterBuilder = new FrontmatterBuilderService(this.templateVariableBuilder);
        this.noteContentBuilder = new NoteContentBuilderService(
            this.frontmatterBuilder, 
            this.templateVariableBuilder
        );
        this.attachmentManager = new AttachmentManagerService(this.app, this.settings);
        this.referenceParserService = new ReferenceParserService(this.citationService);
        this.noteCreationService = new NoteCreationService(
            this.app,
            this.settings,
            this.referenceParserService,
            this.noteContentBuilder,
            this.attachmentManager
        );
        this.statusBarService = new StatusBarService(this.app);
    }

    /**
     * Update services when settings change
     */
    public updateServices(): void {
        // Recreate services that depend on settings
        this.citationService = new CitationService(this.settings.citekeyOptions);
        this.attachmentManager = new AttachmentManagerService(this.app, this.settings);
        this.referenceParserService = new ReferenceParserService(this.citationService);
        this.noteCreationService = new NoteCreationService(
            this.app,
            this.settings,
            this.referenceParserService,
            this.noteContentBuilder,
            this.attachmentManager
        );
    }

    /**
     * Get the citation service instance
     */
    public getCitationService(): CitationService {
        return this.citationService;
    }

    /**
     * Get the reference parser service instance
     */
    public getReferenceParserService(): ReferenceParserService {
        return this.referenceParserService;
    }

    /**
     * Get the template variable builder service instance
     */
    public getTemplateVariableBuilder(): TemplateVariableBuilderService {
        return this.templateVariableBuilder;
    }

    /**
     * Get the frontmatter builder service instance
     */
    public getFrontmatterBuilder(): FrontmatterBuilderService {
        return this.frontmatterBuilder;
    }

    /**
     * Get the note content builder service instance
     */
    public getNoteContentBuilder(): NoteContentBuilderService {
        return this.noteContentBuilder;
    }

    /**
     * Get the attachment manager service instance
     */
    public getAttachmentManager(): AttachmentManagerService {
        return this.attachmentManager;
    }

    /**
     * Get the note creation service instance
     */
    public getNoteCreationService(): NoteCreationService {
        return this.noteCreationService;
    }

    /**
     * Get the status bar service instance
     */
    public getStatusBarService(): StatusBarService {
        return this.statusBarService;
    }

    /**
     * Set new settings and update dependent services
     */
    public updateSettings(settings: BibliographyPluginSettings): void {
        this.settings = settings;
        this.updateServices();
    }

    /**
     * Cleanup service resources when plugin is unloaded
     */
    public onUnload(): void {
        // Perform any necessary cleanup for services
        // Most services don't need explicit cleanup as Obsidian handles
        // event listeners registered with plugin.register()
    }
}