# Settings

The settings interface is organized into tabs. This page documents each tab and its options.

## General

**Literature note tag** — The tag used to identify literature notes in your vault (default: `literature_note`). This tag is added to the frontmatter of every new literature note and is how BibLib finds references when generating bibliography files.

**Open note on create** — When enabled, new literature notes are opened automatically after creation.

## File organization

**Attachment folder path** — The folder where imported attachments are stored (default: `biblib`).

**Create subfolder for attachments** — When enabled, each reference's attachments are placed in a subfolder named after the citekey (e.g., `biblib/smith2023/document.pdf`).

**Literature note location** — The folder where new literature notes are saved. Defaults to the vault root.

**Filename template** — A template for generating filenames (default: `@{{citekey}}`). Forward slashes in the template create subfolders — for example, `{{type}}/{{citekey}}` would create `article-journal/smith2023.md`.

## Templates

**Note content template** — A template for the body of new literature notes. The frontmatter is configured separately through custom fields (see below).

This tab also includes a **Template Playground** for testing templates interactively and a built-in guide to the template syntax.

See the [Templating](templating-system-guide.md) page for the full syntax reference.

## Citation keys

**Citekey template** — The template for generating citekeys (default: `{{authors_family.0|lowercase}}{{year}}`). Any bibliographic field can be used, along with formatters.

**Use Zotero keys (if available)** — When enabled, references imported via the Zotero Connector or from Zotero-exported files use the citekey assigned by Zotero instead of generating a new one.

**Minimum citekey length** — If a generated citekey is shorter than this value (default: 6), a random numeric suffix is appended.

## Custom fields

### Custom frontmatter

Additional fields to include in the YAML frontmatter of new literature notes. Each field has a name and a template for its value. For example, a field named `year` with the template `{{year}}` extracts the publication year into a top-level frontmatter field.

!!! warning
    Do not define templates for fields that are part of the CSL-JSON standard (like `title`, `author`, or `issued`). Doing so may produce invalid bibliography files.

### Favorite languages

Languages that appear at the top of the language dropdown in creation and edit modals. Useful if you frequently work with references in specific languages.

## Modal configuration

### Default modal fields

Controls which CSL-JSON fields appear as primary inputs in the creation modal. The default set covers common fields like title, author, DOI, and abstract. If your workflow regularly uses less common fields (e.g., `archive`, `archive-place`, `archive_location` for archival research), you can add them here so they appear without needing to use the "Add field" button.

### Edit literature note settings

**Regenerate citekey by default** — Whether the "Regenerate citekey" checkbox is checked by default in the edit modal.

**Update custom frontmatter by default** — Whether custom frontmatter fields are re-evaluated when saving edits.

**Regenerate note body by default** — Whether the note body is replaced with the content template when saving edits. This is off by default to avoid overwriting your annotations.

**Rename file on citekey change** — Whether the note file is renamed when the citekey changes during an edit.

## Zotero integration

*Desktop only.*

**Enable Zotero Connector** — Starts a local HTTP server that receives references from the Zotero Connector browser extension. The Zotero desktop application must be closed, as both use the same port.

**Connector port** — The network port for the connector server (default: 23119, matching Zotero's default).

**Temporary PDF folder** — An optional system path for temporarily storing downloaded PDFs before they are imported into the vault.

## Bibliography export

**Bibliography JSON path** — Where the generated CSL-JSON file is written (default: `biblib/bibliography.json`).

**Citekey list path** — Where the Markdown citekey list is written (default: `citekeylist.md`).

**BibTeX file path** — Where the exported BibTeX file is written (default: `biblib/bibliography.bib`).
