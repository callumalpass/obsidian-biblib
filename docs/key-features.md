# Features

## Literature Note Management

- **Create Literature Notes**: Add references via modal interface with manual entry or automatic metadata lookup (DOI, ISBN, PubMed ID, arXiv ID, URL).
- **Edit Literature Notes**: Modify existing reference metadata.
- **Book Chapter Support**: Create chapter entries that link to parent book references.

## Metadata Lookup

BibLib can fetch bibliographic metadata from:

- **DOI**: Crossref
- **ISBN**: Open Library
- **PubMed ID**: PubMed
- **arXiv ID**: arXiv
- **URL**: Citoid service (extracts metadata from web pages)

## Templating System

Templates use Handlebars-style syntax and can customize:

- **Citekeys**: Generate citation keys from bibliographic data
- **Filenames**: Control file naming and folder organization
- **Note Content**: Define the structure of new literature notes
- **Custom Frontmatter**: Add fields to YAML frontmatter with templated values

See the [Templating](templating-system-guide.md) page for details.

## Import and Export

- **Bulk Import**: Import references from BibTeX (`.bib`) or CSL-JSON (`.json`) files.
- **Bibliography Export**: Generate CSL-JSON or BibTeX files from your literature notes.

## Zotero Connector

On desktop, BibLib can receive references from the Zotero Connector browser extension. This requires the Zotero desktop application to be closed (both use the same port).

## Attachment Management

- **Import Attachments**: Copy PDFs and other files into your vault.
- **Link Existing Files**: Connect literature notes to files already in your vault.
- **Organized Storage**: Optionally create subfolders for each reference's attachments.
