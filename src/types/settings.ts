// --- Interface for Citekey Generation Options ---
// Moved here from citekey-generator.ts to avoid circular dependency issues
// and keep settings-related types together.

/**
 * Options for citekey generation
 */
export interface CitekeyOptions {
        /**
         * User-defined template for citekey generation.
         * Example: '{{author|lowercase}}{{year}}{{title|titleword}}'
         * Uses the same Mustache syntax as other templates.
         * Default: '{{author|lowercase}}{{year}}'
         */
        citekeyTemplate: string;

        /**
         * Whether to use Zotero keys when available
         * Default: true
         */
        useZoteroKeys: boolean;
        
        /**
         * Minimum length for a citekey before adding a random suffix
         * Default: 6
         */
        minCitekeyLength: number;
}


/**
 * Interface for custom frontmatter field templates
 */
export interface CustomFrontmatterField {
    name: string;    // Field name in frontmatter
    template: string; // Template with variables
    enabled: boolean; // Whether this field is enabled
}

/**
 * Interface for favorite languages configuration
 */
export interface FavoriteLanguage {
    code: string;  // ISO 639-1 or 639-2 language code
    name: string;  // Display name for the language
}

/**
 * Interface for configurable modal field definitions
 */
export interface ModalFieldConfig {
    name: string; // CSL field key (e.g., "archive", "URL")
    label: string; // Display label (e.g., "Archive Name")
    type: 'text' | 'textarea' | 'number' | 'date' | 'toggle' | 'dropdown'; // Input control type
    description?: string;
    placeholder?: string;
    required?: boolean; // For UI hint/future validation
    options?: Array<{ value: string; text: string }>; // For dropdown
    defaultValue?: string | boolean | number; // For new notes
}

// --- Utility function for parsing tags ---

/**
 * Parse a tag string into an array of individual tags.
 * Supports comma-separated and space-separated formats.
 * @param tagString The string containing one or more tags
 * @returns Array of individual tags, trimmed and filtered for empty values
 */
export function parseLiteratureNoteTags(tagString: string): string[] {
	if (!tagString || tagString.trim() === '') {
		return [];
	}

	// Split by comma or whitespace, trim each tag, and filter out empty strings
	return tagString
		.split(/[,\s]+/)
		.map(tag => tag.trim())
		.filter(tag => tag.length > 0);
}

// --- Interface for Overall Plugin Settings ---

export interface BibliographyPluginSettings {
        attachmentFolderPath: string;
        literatureNotePath: string;
        filenameTemplate: string; // Filename template option
        createAttachmentSubfolder: boolean;
        // Bibliography and file options
        bibliographyJsonPath: string;
        citekeyListPath: string;
        bibtexFilePath: string;
        // Template options
        headerTemplate: string;
        chapterHeaderTemplate: string;
        // Other settings
        literatureNoteTag: string;
        openNoteOnCreate: boolean;
        enableZoteroConnector: boolean;
        zoteroConnectorPort: number;
        tempPdfPath: string;
        // Template systems
        customFrontmatterFields: CustomFrontmatterField[]; // Custom frontmatter fields with templating
        citekeyOptions: CitekeyOptions; // Uses the interface defined above
        // Bulk import settings
        bulkImportAttachmentHandling: 'none' | 'import';
        bulkImportAnnoteToBody: boolean;
        bulkImportCitekeyPreference: 'imported' | 'generate';
        bulkImportConflictResolution: 'skip' | 'overwrite';
        // Favorite languages settings
        favoriteLanguages: FavoriteLanguage[];
        // Default modal fields configuration
        defaultModalFields: ModalFieldConfig[];
        // Edit modal settings
        editRegenerateCitekeyDefault: boolean;
        editUpdateCustomFrontmatterDefault: boolean;
        editRegenerateBodyDefault: boolean;
        editRenameFileOnCitekeyChange: boolean;
}

// --- Default Plugin Settings ---

export const DEFAULT_SETTINGS: BibliographyPluginSettings = {
        attachmentFolderPath: 'biblib',
        literatureNotePath: '/',
        filenameTemplate: '@{{citekey}}',
        createAttachmentSubfolder: true,
        bibliographyJsonPath: 'biblib/bibliography.json',
        citekeyListPath: 'citekeylist.md',
        bibtexFilePath: 'biblib/bibliography.bib',
        headerTemplate: '# {{#title}}{{title}}{{/title}}{{^title}}{{citekey}}{{/title}} \n\n _Notes_',
        chapterHeaderTemplate: '# {{#pdflink}}[[{{pdflink}}|{{title}}]]{{/pdflink}}{{^pdflink}}{{title}}{{/pdflink}} (in {{container-title}})',
        literatureNoteTag: 'literature_note',
        openNoteOnCreate: true,
        enableZoteroConnector: false,
        zoteroConnectorPort: 23119,
        tempPdfPath: '',
        // Default custom frontmatter fields
        customFrontmatterFields: [
                {
                        name: 'year',
                        template: '{{year}}',
                        enabled: true
                },
                {
                        name: 'dateCreated',
                        template: '{{currentDate}}',
                        enabled: true
                },
                {
                        name: 'reading-status',
                        template: 'to-read',
                        enabled: true
                },
                {
                        name: 'aliases',
                        template: '["{{title|sentence}}"]',
                        enabled: true
                },
                {
                        name: 'author-links',
                        template: '[{{#authors}}"[[Author/{{.}}]]",{{/authors}}]',
                        enabled: true
                },
                {
                        name: 'attachment',
                        template: '[{{#attachments}}{{.}},{{/attachments}}]',
                        enabled: true
                },
                {
                        name: 'related',
                        template: '[{{links}}]',
                        enabled: true
                }
        ],
        // Default citekey options
        citekeyOptions: {
                citekeyTemplate: '{{author|lowercase}}{{title|titleword}}{{year}}', // Default to mustache template
                useZoteroKeys: false,
                minCitekeyLength: 6
        },
        // Default bulk import settings
        bulkImportAttachmentHandling: 'none',
        bulkImportAnnoteToBody: true,
        bulkImportCitekeyPreference: 'imported',
        bulkImportConflictResolution: 'skip',
        // Default favorite languages
        favoriteLanguages: [
                { code: 'en', name: 'English' },
                { code: 'de', name: 'German' }
        ],
        // Default modal fields (empty by default, users can add archival fields etc.)
        defaultModalFields: [],
        // Default edit modal settings
        editRegenerateCitekeyDefault: false,
        editUpdateCustomFrontmatterDefault: true,
        editRegenerateBodyDefault: false,
        editRenameFileOnCitekeyChange: true
};

