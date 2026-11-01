import { App, TFile } from 'obsidian';
import { BibliographyBuilder, filterNotesForProfile } from '../bibliography-builder';
import { DEFAULT_SETTINGS } from '../../types/settings';

// The jest mock of obsidian (__mocks__/obsidian.ts) exposes its backing maps
const MockTFile = TFile as unknown as new (path: string) => TFile;
const vaultFiles = (app: App) => (app.vault as unknown as { files: Map<string, TFile> }).files;
const metadata = (app: App) => (app.metadataCache as unknown as { cache: Map<string, unknown> }).cache;

const note = (path: string, id: string, tags: string[]) => ({
    file: { path },
    frontmatter: { id, type: 'book', title: id, tags },
});

describe('filterNotesForProfile (issue #22)', () => {
    const notes = [
        note('Projects/thesis/@a.md', 'a', ['literature_note']),
        note('Projects/thesis/ch1/@b.md', 'b', ['literature_note', 'Methods']),
        note('Projects/thesis-old/@c.md', 'c', ['literature_note', 'methods']),
        note('@d.md', 'd', ['literature_note']),
    ];
    const ids = (selected: typeof notes) => selected.map(n => n.frontmatter.id);

    it('includes subfolders but not sibling folders with the same prefix', () => {
        expect(ids(filterNotesForProfile(notes, { folder: 'Projects/thesis/', tag: '' }))).toEqual(['a', 'b']);
    });

    it('matches tags case-insensitively, with or without #', () => {
        expect(ids(filterNotesForProfile(notes, { folder: '', tag: '#methods' }))).toEqual(['b', 'c']);
    });

    it('combines folder and tag filters, and empty filters match everything', () => {
        expect(ids(filterNotesForProfile(notes, { folder: 'Projects/thesis', tag: 'methods' }))).toEqual(['b']);
        expect(ids(filterNotesForProfile(notes, { folder: '', tag: '' }))).toHaveLength(4);
    });
});

describe('BibliographyBuilder export profiles (issue #22)', () => {
    let app: App;
    let written: Map<string, string>;

    beforeEach(() => {
        app = new App();
        written = new Map();
        jest.spyOn(app.vault, 'create').mockImplementation((path: string, content: string) => {
            written.set(path, content);
            const file = new MockTFile(path);
            vaultFiles(app).set(path, file);
            return Promise.resolve(file);
        });
        for (const [path, frontmatter] of [
            ['Projects/thesis/@smith2020.md', { id: 'smith2020', type: 'book', title: 'Thesis source', tags: ['literature_note'] }],
            ['Other/@jones2021.md', { id: 'jones2021', type: 'book', title: 'Other source', tags: ['literature_note'] }],
        ] as const) {
            vaultFiles(app).set(path, new MockTFile(path));
            metadata(app).set(path, { frontmatter });
        }
    });

    afterEach(() => jest.restoreAllMocks());

    const settingsWithProfile = () => ({
        ...DEFAULT_SETTINGS,
        bibliographyExportProfiles: [
            { name: 'Thesis', folder: 'Projects/thesis', tag: '', jsonPath: 'exports/thesis.json', bibtexPath: 'exports/thesis.bib' },
            { name: 'JSON only', folder: '', tag: '', jsonPath: 'exports/all.json', bibtexPath: '' },
        ],
    });

    it('writes each profile JSON with only its notes, alongside the main file', async () => {
        await new BibliographyBuilder(app, settingsWithProfile()).buildBibliography({ quiet: true });

        const ids = (path: string) => (JSON.parse(written.get(path) ?? '[]') as { id: string }[]).map(e => e.id);
        expect(ids(DEFAULT_SETTINGS.bibliographyJsonPath).sort()).toEqual(['jones2021', 'smith2020']);
        expect(ids('exports/thesis.json')).toEqual(['smith2020']);
        expect(ids('exports/all.json').sort()).toEqual(['jones2021', 'smith2020']);
    });

    it('writes each profile BibTeX with only its notes and skips empty paths', async () => {
        await new BibliographyBuilder(app, settingsWithProfile()).exportBibTeX({ quiet: true });

        expect(written.get(DEFAULT_SETTINGS.bibtexFilePath)).toContain('jones2021');
        const thesis = written.get('exports/thesis.bib') ?? '';
        expect(thesis).toContain('@book{smith2020,');
        expect(thesis).not.toContain('jones2021');
        expect([...written.keys()].filter(p => p.endsWith('.bib'))).toHaveLength(2);
    });
});
