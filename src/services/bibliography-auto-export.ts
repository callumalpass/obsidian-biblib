import { App, Plugin, TAbstractFile, TFile } from 'obsidian';
import { BibliographyPluginSettings } from '../types/settings';
import { BibliographyBuilder, isLiteratureNoteFrontmatter } from './bibliography-builder';

/** Wait this long after the last literature note change before rebuilding. */
export const AUTO_EXPORT_DELAY = 3000;

/**
 * Keeps the bibliography JSON, citekey list and BibTeX file up to date by rebuilding
 * them shortly after a literature note is created, edited, renamed or deleted, when
 * the "Rebuild automatically" setting is on.
 */
export class BibliographyAutoExporter {
    private timer: number | null = null;
    /** Paths of literature notes seen so far, so deletions and untagging trigger a rebuild. */
    private knownNotePaths = new Set<string>();

    constructor(
        private app: App,
        private getSettings: () => BibliographyPluginSettings
    ) {}

    register(plugin: Plugin): void {
        plugin.registerEvent(this.app.metadataCache.on('changed', (file) => this.handleChanged(file)));
        plugin.registerEvent(this.app.vault.on('delete', (file) => this.handleRemoved(file.path)));
        plugin.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
            this.handleRemoved(oldPath);
            this.handleChanged(file);
        }));
        plugin.register(() => this.cancel());
        this.app.workspace.onLayoutReady(() => void this.refreshKnownNotes());
    }

    handleChanged(file: TAbstractFile): void {
        if (!(file instanceof TFile) || file.extension !== 'md') return;

        const settings = this.getSettings();
        const frontmatter: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (isLiteratureNoteFrontmatter(frontmatter, settings.literatureNoteTag)) {
            this.knownNotePaths.add(file.path);
            this.schedule();
        } else if (this.knownNotePaths.delete(file.path)) {
            // No longer a literature note (tag or citekey removed)
            this.schedule();
        }
    }

    handleRemoved(path: string): void {
        if (this.knownNotePaths.delete(path)) {
            this.schedule();
        }
    }

    cancel(): void {
        if (this.timer !== null) {
            window.clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private schedule(): void {
        if (!this.getSettings().autoExportBibliography) return;

        this.cancel();
        this.timer = window.setTimeout(() => {
            this.timer = null;
            void this.rebuild();
        }, AUTO_EXPORT_DELAY);
    }

    private async refreshKnownNotes(): Promise<void> {
        const notes = await new BibliographyBuilder(this.app, this.getSettings()).findLiteratureNotes();
        this.knownNotePaths = new Set(notes.map(note => note.file.path));
    }

    private async rebuild(): Promise<void> {
        const builder = new BibliographyBuilder(this.app, this.getSettings());
        try {
            await builder.buildBibliography({ quiet: true });
            await builder.exportBibTeX({ quiet: true });
        } catch (error) {
            // Builders show their own error notices
            console.error('Automatic bibliography rebuild failed:', error);
        }
    }
}
