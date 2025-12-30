# Settings

This page details the available settings for the BibLib plugin. The settings are organized into tabs that match the plugin's settings interface in Obsidian.

## General

*   **Literature note tag:** The tag to identify literature notes (default: `literature_note`).
*   **Open note on create:** If enabled, new literature notes are opened automatically.

## File Organization

*   **Attachment folder path:** The folder for imported attachments (default: `biblib`).
*   **Create subfolder for attachments:** If enabled, a subfolder named after the citekey is created for each reference's attachments.
*   **Literature note location:** The folder where new literature notes are saved (default: vault root).
*   **Filename template:** A template for generating filenames for literature notes (default: `@{{citekey}}`). Forward slashes (`/`) can be used to create subfolders.

## Templates

*   **Note content template:** A template for the content that appears in the body of new notes. Frontmatter is configured separately via Custom Fields.

This tab also includes the **Template Playground** for testing templates and a comprehensive **Template System Guide** explaining variable syntax, formatters, conditionals, and loops.

See the [Templating](templating-system-guide.md) page for full documentation.

## Citation Keys

*   **Citekey template:** The template for generating citekeys (default: `{{authors_family.0|lowercase}}{{year}}`).
*   **Use Zotero keys (if available):** If enabled, uses the citekey from Zotero if one is provided.
*   **Minimum citekey length:** A random numeric suffix is added if the generated citekey is shorter than this value (default: `6`).

## Custom Fields

### Custom Frontmatter

Define additional fields to include in the YAML frontmatter of new literature notes. Each field's value is generated from a template.

!!! warning
    Do not define templates for CSL-standard fields, as doing so may produce invalid bibliography files.

### Favorite Languages

Configure frequently used languages to appear at the top of language dropdowns in modals.

## Modal Configuration

### Default Modal Fields

Configure which CSL-compliant fields appear as primary inputs in the "Create literature note" modal. This is useful for workflows that frequently use specific fields (e.g., archival research needing `archive`, `archive-place`, `archive_location`).

### Edit Literature Note Settings

*   **Regenerate citekey by default:** If enabled, the "Regenerate citekey" option is checked by default in the edit modal.
*   **Update custom frontmatter by default:** If enabled, custom frontmatter fields are re-evaluated when saving edits.
*   **Regenerate note body by default:** If enabled, the note body is replaced with the content template when saving edits.
*   **Rename file on citekey change:** If enabled, the note file is renamed if the citekey changes.

## Zotero Integration

*Desktop only*

*   **Enable Zotero Connector:** Toggles the local server for Zotero integration. The Zotero desktop app must be closed to enable this.
*   **Connector port:** The network port for the server (default: `23119`).
*   **Temporary PDF folder:** An optional system path for temporarily storing downloaded PDFs.

## Bibliography Export

*   **Bibliography JSON path:** The path for the generated CSL-JSON file (default: `biblib/bibliography.json`).
*   **Citekey list path:** The path for the generated Markdown list of citekeys (default: `citekeylist.md`).
*   **BibTeX file path:** The path for the exported BibTeX file (default: `biblib/bibliography.bib`).
