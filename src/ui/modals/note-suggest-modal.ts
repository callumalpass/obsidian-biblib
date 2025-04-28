import { App, FuzzySuggestModal, TFile } from 'obsidian';

/**
 * Modal for selecting markdown notes from the vault
 */
export class NoteSuggestModal extends FuzzySuggestModal<TFile> {
    private markdownFiles: TFile[];
    private onSelect: (file: TFile) => void;

    constructor(app: App, onSelect: (file: TFile) => void) {
        super(app);
        // Filter for markdown files only
        this.markdownFiles = this.app.vault.getMarkdownFiles();
        this.onSelect = onSelect;
        this.setPlaceholder("Search for notes to link...");
    }

    getItems(): TFile[] {
        return this.markdownFiles;
    }

    getItemText(file: TFile): string {
        // Display path for clarity
        return file.path;
    }

    onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(file);
    }
}