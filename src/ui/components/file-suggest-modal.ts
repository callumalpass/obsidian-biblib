import { App, FuzzySuggestModal, TFile } from 'obsidian';

/**
 * Modal for selecting a file from the vault
 */
export class FileSuggestModal extends FuzzySuggestModal<TFile> {
    private files: TFile[];
    private onSelect: (file: TFile) => void;

    constructor(app: App, onSelect: (file: TFile) => void) {
        super(app);
        // Allow all file types
        this.files = this.app.vault.getFiles();
        this.onSelect = onSelect;
    }

    getItems(): TFile[] {
        return this.files;
    }

    getItemText(file: TFile): string {
        // Show extension type more prominently
        return `${file.path} (${file.extension.toUpperCase()})`;
    }

    onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(file);
    }
}
