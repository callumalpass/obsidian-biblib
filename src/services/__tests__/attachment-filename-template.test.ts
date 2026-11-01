import { App, TFile } from 'obsidian';
import { AttachmentManagerService } from '../attachment-manager-service';
import { AttachmentType } from '../../types/citation';
import { DEFAULT_SETTINGS } from '../../types/settings';

interface FakeFile { path: string; basename: string; extension: string; parent: { path: string } }

describe('Attachment filename template (issue #10)', () => {
    let app: App;
    let settings: typeof DEFAULT_SETTINGS;
    let service: AttachmentManagerService;
    let files: FakeFile[];
    let createdFolders: string[];

    const citation = {
        id: 'smith2023',
        type: 'article-journal',
        title: 'A study: of things?',
        issued: { 'date-parts': [[2023]] },
        author: [{ family: 'Smith', given: 'Jane' }, { family: 'Doe', given: 'John' }],
    };

    function addExisting(path: string) {
        const name = path.split('/').pop() as string;
        const dot = name.lastIndexOf('.');
        files.push({
            path,
            basename: name.slice(0, dot),
            extension: name.slice(dot + 1),
            parent: { path: path.slice(0, path.lastIndexOf('/')) },
        });
    }

    async function importPdf(citekey = 'smith2023', data: unknown = citation) {
        const file = { name: 'download.pdf', arrayBuffer: async () => new ArrayBuffer(0) } as unknown as File;
        return service.importAttachment({ type: AttachmentType.IMPORT, file }, citekey, data);
    }

    beforeEach(() => {
        app = new App();
        files = [];
        createdFolders = [];
        const vault = app.vault as unknown as Record<string, unknown>;
        vault.getFiles = () => files as unknown as TFile[];
        vault.createBinary = async (path: string) => { addExisting(path); };
        vault.createFolder = async (path: string) => { createdFolders.push(path); };
        settings = { ...DEFAULT_SETTINGS, attachmentFolderPath: 'biblib', createAttachmentSubfolder: false };
        service = new AttachmentManagerService(app, settings);
    });

    it('keeps the historical citekey naming with the default template', async () => {
        expect(await importPdf('smith:2023')).toBe('biblib/smith_2023.pdf');
    });

    it('renders template variables from the citation', async () => {
        settings.attachmentFilenameTemplate = '{{author}} {{year}} - {{title}}';
        expect(await importPdf()).toBe('biblib/Smith 2023 - A study_ of things_.pdf');
    });

    it('creates subfolders from "/" in the template', async () => {
        settings.attachmentFilenameTemplate = '{{type}}/{{citekey}}';
        settings.createAttachmentSubfolder = true;
        expect(await importPdf()).toBe('biblib/smith2023/article-journal/smith2023.pdf');
        expect(createdFolders).toContain('biblib/smith2023/article-journal');
    });

    it('falls back to the citekey when the template renders empty', async () => {
        settings.attachmentFilenameTemplate = '{{title}}';
        expect(await importPdf('smith2023', null)).toBe('biblib/smith2023.pdf');
    });

    it('adds a numeric suffix instead of overwriting', async () => {
        settings.attachmentFilenameTemplate = '{{author}} (draft)';
        expect(await importPdf()).toBe('biblib/Smith (draft).pdf');
        expect(await importPdf()).toBe('biblib/Smith (draft)_1.pdf');
        expect(await importPdf()).toBe('biblib/Smith (draft)_2.pdf');
    });
});
