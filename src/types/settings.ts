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
     * The URL for the Citoid API to fetch bibliographic data
     */
    citoidApiUrl: string;
    
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
     * The path where to save the citekeylist.md file
     * (relative to vault or absolute)
     */
    citekeyListPath: string;
    
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
}

export const DEFAULT_SETTINGS: BibliographyPluginSettings = {
    attachmentFolderPath: 'biblib',
    literatureNotePath: '/',
    usePrefix: true,
    notePrefix: '@',
    createAttachmentSubfolder: true,
    citoidApiUrl: 'https://en.wikipedia.org/api/rest_v1/data/citation/mediawiki/',
    includeDateCreated: true,
    includeYear: true,
    includeAuthorLink: true,
    includeAttachment: true,
    bibliographyJsonPath: 'biblib/bibliography.json',
    citekeyListPath: 'citekeylist.md',
    headerTemplate: '# {{pdflink}}{{^pdflink}}{{citekey}}{{/pdflink}}',
    chapterHeaderTemplate: '# {{pdflink}}{{^pdflink}}{{title}}{{/pdflink}} (in {{container-title}})',
    literatureNoteTag: 'literature_note'
};
