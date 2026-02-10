# Features

## Literature note management

References are created through a modal interface. You can fill in fields manually, or provide an identifier (DOI, ISBN, PubMed ID, arXiv ID, or URL) to fetch metadata automatically. Pasting a BibTeX entry is also supported. Existing literature notes can be edited through a similar modal that pre-fills the current metadata.

BibLib includes support for book chapters as a distinct reference type. Chapter notes link to a parent book note, inheriting shared metadata (publisher, editors) while recording chapter-specific details like title, page range, and chapter authors.

## Metadata lookup

When creating a reference, you can enter an identifier and BibLib will fetch the bibliographic metadata from an appropriate source. DOIs are resolved via Crossref, ISBNs via Open Library, and PubMed and arXiv IDs via their respective APIs. For URLs, the Citoid service (maintained by the Wikimedia Foundation) extracts metadata from web pages. The fetched data is converted to CSL-JSON and used to populate the creation form.

## Templating

BibLib uses a Handlebars-style template engine for generating citekeys, filenames, note content, and custom frontmatter fields. Templates can reference any bibliographic field, apply formatters (case conversion, truncation, abbreviation), use conditionals, and iterate over arrays. This makes it possible to customize how references are named, filed, and structured without modifying the plugin itself.

See the [Templating](templating-system-guide.md) page for the full syntax and available formatters.

## Import and export

References can be bulk-imported from BibTeX (`.bib`) or CSL-JSON (`.json`) files. During import you can choose whether to use the existing citekeys or generate new ones, how to handle attachments, and what to do when a citekey already exists in the vault.

For export, BibLib generates CSL-JSON and BibTeX bibliography files from the literature notes in your vault. These files can be used with Pandoc or any other tool that accepts standard bibliography formats.

## Zotero Connector

On desktop, BibLib can act as a receiver for the Zotero Connector browser extension. When enabled, clicking the Zotero button in your browser sends the reference data to Obsidian instead of Zotero, opening the creation modal with the fields pre-filled. PDFs are imported automatically when available. This requires the Zotero desktop application to be closed, since both use the same network port.

## Attachment management

Files can be imported into the vault (copied to a configurable attachment folder) or linked if they already exist in the vault. An optional setting creates a subfolder per reference, keeping attachments organized. During bulk import from Zotero-exported BibTeX files, BibLib resolves file paths from the BibTeX `file` field and imports the associated PDFs.
