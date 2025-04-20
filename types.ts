export interface BibliographyPluginSettings {
    attachmentFolderPath: string;
    literatureNotePath: string;
    usePrefix: boolean;
    notePrefix: string;
    createAttachmentSubfolder: boolean;
    citoidApiUrl: string;
}

export const DEFAULT_SETTINGS: BibliographyPluginSettings = {
    attachmentFolderPath: 'biblib',
    literatureNotePath: '/',
    usePrefix: true,
    notePrefix: '@',
    createAttachmentSubfolder: true,
    citoidApiUrl: 'https://en.wikipedia.org/api/rest_v1/data/citation/mediawiki/'
};
