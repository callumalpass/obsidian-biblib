// --- Interface for Citekey Generation Options ---
// Moved here from citekey-generator.ts to avoid circular dependency issues
// and keep settings-related types together.

/**
 * Options for citekey generation
 */
export interface CitekeyOptions {
        /**
         * User-defined template for citekey generation.
         * If provided, overrides other formatting options below.
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

        // --- Legacy Options (used only if citekeyTemplate is empty) ---

        /**
         * Style for author name abbreviation
         * - 'full': Use full author last name (e.g., "smith")
         * - 'firstThree': Use first three letters (e.g., "smi")
         * - 'firstFour': Use first four letters (e.g., "smit")
         * Default: 'full'
         */
        authorAbbreviationStyle: 'full' | 'firstThree' | 'firstFour';

        /**
         * Whether to include multiple authors in the citekey
         * Default: false
         */
        includeMultipleAuthors: boolean;

        /**
         * Maximum number of authors to include if includeMultipleAuthors is true
         * Default: 3
         */
        maxAuthors: number;

        /**
         * Style to use when there are exactly two authors
         * - 'and': Include both authors with "And" (e.g., "smithAndJones")
         * - 'initial': Include just the initial of second author (e.g., "smithJ")
         * Default: 'and'
         */
        useTwoAuthorStyle: 'and' | 'initial';

        /**
         * Whether to add "EtAl" when there are more authors than maxAuthors
         * Default: true
         */
        useEtAl: boolean;

        /**
         * Delimiter to use between author and year parts
         * Example: '_' for "smith_2023"
         * Default: '' (no delimiter)
         */
        authorYearDelimiter: string;

        /**
         * Delimiter to use before random suffix for short citekeys
         * Example: '_' for "sm_123"
         * Default: '' (no delimiter)
         */
        shortCitekeyDelimiter: string;

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

// --- Interface for Overall Plugin Settings ---

export interface BibliographyPluginSettings {
        attachmentFolderPath: string;
        literatureNotePath: string;
        usePrefix: boolean;
        notePrefix: string;
        filenameTemplate: string; // New filename template option
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
}

// --- Default Plugin Settings ---

export const DEFAULT_SETTINGS: BibliographyPluginSettings = {
        attachmentFolderPath: 'biblib',
        literatureNotePath: '/',
        usePrefix: true,
        notePrefix: '@',
        filenameTemplate: '@{{citekey}}',
        createAttachmentSubfolder: true,
        bibliographyJsonPath: 'biblib/bibliography.json',
        citekeyListPath: 'citekeylist.md',
        bibtexFilePath: 'biblib/bibliography.bib',
        headerTemplate: '# {{#pdflink}}[[{{pdflink}}|{{title}}]]{{/pdflink}}{{^pdflink}}{{title}}{{/pdflink}}',
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
                        name: 'status',
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
                        template: '[{{#pdflink}}"[[{{pdflink}}]]"{{/pdflink}}]',
                        enabled: true
                },
                {
                        name: 'keyword',
                        template: '[]',
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
                authorAbbreviationStyle: 'full',
                includeMultipleAuthors: false,
                maxAuthors: 3,
                useTwoAuthorStyle: 'and',
                useEtAl: true,
                authorYearDelimiter: '',
                shortCitekeyDelimiter: '',
                minCitekeyLength: 6
        },
        // Default bulk import settings
        bulkImportAttachmentHandling: 'none',
        bulkImportAnnoteToBody: true,
        bulkImportCitekeyPreference: 'imported',
        bulkImportConflictResolution: 'skip'
};

