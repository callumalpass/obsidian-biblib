export interface BibliographyPluginSettings {
    /**
     * The folder where PDF and EPUB attachments will be stored
     */
    attachmentFolderPath: string;
    
    /**
     * The folder where literature notes will be stored
     */
    literatureNotePath: string;
    
    /**
     * Whether to add a prefix to literature note filenames
     */
    usePrefix: boolean;
    
    /**
     * The prefix to add to literature note filenames
     */
    notePrefix: string;
    
    /**
     * Whether to create a subfolder for each citation
     */
    createAttachmentSubfolder: boolean;
    
    
    /**
     * Whether to include the dateCreated field in literature notes
     */
    includeDateCreated: boolean;
    
    /**
     * Whether to include the year field in literature notes 
     * (separate from the CSL-issued field)
     */
    includeYear: boolean;
    
    /**
     * Whether to include the authorLink field in literature notes
     */
    includeAuthorLink: boolean;
    
    /**
     * Whether to include the attachment field in literature notes
     */
    includeAttachment: boolean;
    
    /**
     * The path where to save the bibliography.json file
     * (relative to vault or absolute)
     */
    bibliographyJsonPath: string;
    
    /**
     * The path where to save the citekey list file (relative to vault or absolute)
     */
    citekeyListPath: string;
    
    /**
     * The path where to save the exported BibTeX file (relative to vault or absolute)
     */
    bibtexFilePath: string;
    
    /**
     * Template for the first header in literature notes.
     * Supports variables: {{title}}, {{citekey}}, {{year}}, {{authors}}, {{pdflink}}
     */
    headerTemplate: string;
    
    /**
     * Template for the first header in chapter notes.
     * Supports variables: {{title}}, {{citekey}}, {{year}}, {{authors}}, {{pdflink}}, {{container-title}}
     */
    chapterHeaderTemplate: string;
    /**
     * Tag used to identify literature notes
     */
    literatureNoteTag: string;
    /**
     * Whether to automatically open a newly created literature note
     */
    openNoteOnCreate: boolean;
    
    /**
     * Whether to enable the Zotero Connector server
     */
    enableZoteroConnector: boolean;
    
    /**
     * The port to use for the Zotero Connector server
     */
    zoteroConnectorPort: number;
    
    /**
     * Temporary folder path for downloaded PDFs from Zotero
     */
    tempPdfPath: string;
}

export const DEFAULT_SETTINGS: BibliographyPluginSettings = {
    attachmentFolderPath: 'biblib',
    literatureNotePath: '/',
    usePrefix: true,
    notePrefix: '@',
    createAttachmentSubfolder: true,
    // The Citoid API endpoint to fetch BibTeX (should point to the 'bibtex' path)
    includeDateCreated: true,
    includeYear: true,
    includeAuthorLink: true,
    includeAttachment: true,
    bibliographyJsonPath: 'biblib/bibliography.json',
    citekeyListPath: 'citekeylist.md',
    // Default path for exported BibTeX
    bibtexFilePath: 'biblib/bibliography.bib',
    headerTemplate: '# {{pdflink}}{{^pdflink}}{{citekey}}{{/pdflink}}',
    chapterHeaderTemplate: '# {{pdflink}}{{^pdflink}}{{title}}{{/pdflink}} (in {{container-title}})',
    literatureNoteTag: 'literature_note',
    openNoteOnCreate: true,
    // Zotero Connector settings
    enableZoteroConnector: false,
    zoteroConnectorPort: 23119,
    tempPdfPath: ''
};
