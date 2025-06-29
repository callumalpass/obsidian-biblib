# Settings

This page details the available settings for the BibLib plugin.

## General Settings

*   **Literature note tag:** The tag to identify literature notes (default: `literature_note`).
*   **Open note on create:** If enabled, new literature notes are opened automatically.

## File Path Settings

*   **Attachment folder path:** The folder for imported attachments (default: `biblib`).
*   **Create subfolder for attachments:** If enabled, a subfolder named after the citekey is created for each reference's attachments.
*   **Literature note location:** The folder where new literature notes are saved (default: vault root).
*   **Filename template:** A template for generating filenames for literature notes (default: `@{{citekey}}`). Forward slashes (`/`) can be used to create subfolders.

## Zotero Connector Settings (Desktop Only)

*   **Enable Zotero Connector:** Toggles the local server for Zotero integration. The Zotero desktop app must be closed to enable this.
*   **Connector port:** The network port for the server (default: `23119`).
*   **Temporary PDF folder:** An optional system path for temporarily storing downloaded PDFs.

## Bibliography Builder Settings

*   **Bibliography JSON path:** The path for the generated CSL-JSON file (default: `biblib/bibliography.json`).
*   **Citekey list path:** The path for the generated Markdown list of citekeys (default: `citekeylist.md`).
*   **BibTeX file path:** The path for the exported BibTeX file (default: `biblib/bibliography.bib`).

## Note Template Settings

*   **Header template:** A template for the content that appears above the YAML frontmatter in new notes.
*   **Custom frontmatter fields:** Define additional fields to include in the YAML frontmatter. Each field's value is generated from a template.

## Citekey Generation Settings

*   **Citekey template:** The template for generating citekeys (default: `{{author|lowercase}}{{title|titleword}}{{year}}`).
*   **Use Zotero keys (if available):** If enabled, uses the citekey from Zotero if one is provided.
*   **Minimum citekey length:** A random numeric suffix is added if the generated citekey is shorter than this value (default: `6`).

## Bulk Import Settings

These are the default settings for the bulk import feature, which can be overridden in the import modal.

*   **Attachment handling:** `Ignore attachments` or `Import attachments to vault`.
*   **Include annotations in note body:** If enabled, content from the BibTeX `annote` field is added to the note body.
*   **Citekey preference:** `Use imported citekeys` or `Generate new citekeys`.
*   **Conflict resolution:** `Skip existing notes` or `Overwrite existing notes`.

## User Interface Settings

*   **Favorite Languages:** A list of languages to show at the top of language selection dropdowns.
*   **Default Modal Fields:** A list of fields to show by default in the "Create Literature Note" modal.

## Edit Modal Settings

*   **Regenerate citekey by default:** If enabled, the "Regenerate citekey" option is checked by default in the edit modal.
*   **Update templated frontmatter by default:** If enabled, custom frontmatter fields are re-evaluated when saving edits.
*   **Regenerate note body by default:** If enabled, the note body is replaced with the header template when saving edits.
*   **Rename file when citekey changes:** If enabled, the note file is renamed if the citekey changes.