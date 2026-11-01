import { App, TFile } from 'obsidian';
import { BibliographyAutoExporter, AUTO_EXPORT_DELAY } from '../bibliography-auto-export';
import { BibliographyBuilder } from '../bibliography-builder';
import { DEFAULT_SETTINGS } from '../../types/settings';

// The jest mock of obsidian (__mocks__/obsidian.ts) exposes its backing maps
const MockTFile = TFile as unknown as new (path: string) => TFile;
const vaultFiles = (app: App) => (app.vault as unknown as { files: Map<string, TFile> }).files;
const metadata = (app: App) => (app.metadataCache as unknown as { cache: Map<string, unknown> }).cache;

describe('BibliographyAutoExporter (issue #32)', () => {
    let app: App;
    let settings: typeof DEFAULT_SETTINGS;
    let exporter: BibliographyAutoExporter;
    let build: jest.SpyInstance;
    let bibtex: jest.SpyInstance;

    function addNote(path: string, frontmatter: Record<string, unknown> | undefined): TFile {
        const file = new MockTFile(path);
        vaultFiles(app).set(path, file);
        metadata(app).set(path, frontmatter ? { frontmatter } : {});
        return file;
    }

    beforeEach(() => {
        jest.useFakeTimers();
        (globalThis as unknown as { window: unknown }).window = {
            setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
            clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
        };
        app = new App();
        settings = { ...DEFAULT_SETTINGS, autoExportBibliography: true };
        exporter = new BibliographyAutoExporter(app, () => settings);
        build = jest.spyOn(BibliographyBuilder.prototype, 'buildBibliography').mockResolvedValue();
        bibtex = jest.spyOn(BibliographyBuilder.prototype, 'exportBibTeX').mockResolvedValue();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
        delete (globalThis as unknown as { window?: unknown }).window;
    });

    it('rebuilds once, quietly, after a burst of literature note edits', async () => {
        const note = addNote('@smith2020.md', { id: 'smith2020', tags: ['literature_note'] });

        exporter.handleChanged(note);
        jest.advanceTimersByTime(AUTO_EXPORT_DELAY - 1);
        exporter.handleChanged(note);
        jest.advanceTimersByTime(AUTO_EXPORT_DELAY - 1);
        expect(build).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        await Promise.resolve();
        expect(build).toHaveBeenCalledTimes(1);
        expect(build).toHaveBeenCalledWith({ quiet: true });
        await Promise.resolve();
        expect(bibtex).toHaveBeenCalledWith({ quiet: true });
    });

    it('ignores ordinary notes, including the generated citekey list', () => {
        exporter.handleChanged(addNote('citekeylist.md', undefined));
        exporter.handleChanged(addNote('daily.md', { tags: ['journal'] }));
        jest.advanceTimersByTime(AUTO_EXPORT_DELAY * 2);

        expect(build).not.toHaveBeenCalled();
    });

    it('rebuilds when a known literature note is deleted or loses its tag', () => {
        const note = addNote('@smith2020.md', { id: 'smith2020', tags: ['literature_note'] });
        exporter.handleChanged(note);
        jest.advanceTimersByTime(AUTO_EXPORT_DELAY);
        expect(build).toHaveBeenCalledTimes(1);

        metadata(app).set(note.path, { frontmatter: { id: 'smith2020', tags: [] } });
        exporter.handleChanged(note);
        jest.advanceTimersByTime(AUTO_EXPORT_DELAY);
        expect(build).toHaveBeenCalledTimes(2);

        // Already forgotten, so deleting it now is a no-op
        exporter.handleRemoved(note.path);
        jest.advanceTimersByTime(AUTO_EXPORT_DELAY);
        expect(build).toHaveBeenCalledTimes(2);
    });

    it('does nothing when the setting is off', () => {
        settings.autoExportBibliography = false;
        exporter.handleChanged(addNote('@smith2020.md', { id: 'smith2020', tags: ['literature_note'] }));
        jest.advanceTimersByTime(AUTO_EXPORT_DELAY * 2);

        expect(build).not.toHaveBeenCalled();
    });
});
