import { App } from 'obsidian';
import { NoteCreationService } from '../note-creation-service';
import { ReferenceParserService } from '../reference-parser-service';
import { NoteContentBuilderService } from '../note-content-builder-service';
import { AttachmentManagerService } from '../attachment-manager-service';
import { DEFAULT_SETTINGS } from '../../types/settings';

function serviceWith(overrides: Partial<typeof DEFAULT_SETTINGS>): NoteCreationService {
    return new NoteCreationService(
        new App(),
        { ...DEFAULT_SETTINGS, ...overrides },
        {} as ReferenceParserService,
        {} as NoteContentBuilderService,
        {} as AttachmentManagerService
    );
}

describe('NoteCreationService.getLiteratureNotePath', () => {
    const cslData = {
        title: 'Deep Things',
        type: 'article-journal',
        author: [{ family: 'Smith', given: 'Jo' }],
        issued: { 'date-parts': [[2020, 5]] }
    };

    it('takes the year from CSL issued when there is no year field', () => {
        const service = serviceWith({ literatureNotePath: 'refs', filenameTemplate: '{{year}}-{{author}}' });

        expect(service.getLiteratureNotePath('smith2020', cslData)).toBe('refs/2020-Smith.md');
    });

    it('keeps subfolders from the filename template', () => {
        const service = serviceWith({ literatureNotePath: 'refs', filenameTemplate: '{{type}}/@{{citekey}}' });

        expect(service.getLiteratureNotePath('smith2020', cslData)).toBe('refs/article-journal/@smith2020.md');
    });
});
