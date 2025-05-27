# BibLib for Obsidian

> [!NOTE]
> For more on why/how to use BibLib, see the [documentation](https://callumalpass.github.io/obsidian-biblib)

BibLib transforms Obsidian into an academic reference manager by storing each reference as a Markdown note with bibliographic metadata in YAML frontmatter using the [Citation Style Language](https://en.wikipedia.org/wiki/Citation_Style_Language) (CSL) JSON format. This approach integrates your reference library directly into your knowledge base while maintaining compatibility with standard citation tools like Pandoc.

![Screenshot of biblib Obsidian plugin](https://github.com/callumalpass/obsidian-biblib/blob/main/screenshots/create-lit-note.gif?raw=true)

## Why BibLib?

- **Open standard**: Uses CSL JSON format for universal compatibility with citation tools
- **Plain text storage**: All data in human-readable Markdown and YAML files
- **Native integration**: References are regular Obsidian notes that can be linked, tagged, and searched
- **Pandoc-ready**: Generates `bibliography.json` files for automated citation formatting

### Why CSL in Frontmatter

Storing bibliographic data as CSL JSON in YAML frontmatter puts your reference metadata and notes in the same file. Each literature note becomes self-contained - the structured citation data lives right above your summaries, quotes, and annotations. Since references are just Markdown files, Obsidian's standard features (search, links, tags, graph view) work naturally with your bibliography. Meanwhile, the CSL-formatted metadata means you can generate a `bibliography.json` that feeds directly into Pandoc or other citation processors without any conversion. The same file serves both as a working note in your vault and as a valid bibliographic entry for academic writing.

## Key Features

- **CSL-JSON metadata**: Bibliographic details stored in YAML frontmatter following CSL JSON schema
- **Native storage**: Each reference is a `.md` file in your vault - no external database needed
- **Zotero connector**: One-click import from browser via Zotero connector (desktop only)
- **Flexible templating**: Handlebars-based templates for customizing note creation and formatting
- **Metadata lookup**: Auto-fill reference data using DOI, ISBN, or URL via Citoid service
- **All reference types**: Supports articles, books, chapters, reports, theses, and more
- **Attachment management**: Import and link PDFs/EPUBs with annotation support
- **Import/export**: Import from Zotero/BibTeX and export to BibTeX or CSL-JSON
- **PDF annotations**: Link directly to highlights and annotations in attached PDFs

## Quick Start

1. **Create a reference**: Use command palette → "BibLib: Create Literature Note"
2. **Auto-fill metadata**: Click "Lookup" and enter a DOI, ISBN, or URL
3. **Import from web**: Enable connector server in settings, then use Zotero browser extension
4. **Generate bibliography**: Use "BibLib: Build Bibliography" to create `bibliography.json`

> [!NOTE]
> Obsidian's metadata UI may show warnings for nested YAML fields (like author arrays). This is a limitation of Obsidian's parser - your data is stored correctly and works with external tools.

## Settings Overview

### File Organization
- **Attachment folder**: Where PDFs/EPUBs are stored
- **Literature note location**: Where reference notes are created
- **Filename template**: Customize filenames (e.g., `@{{citekey}}`, `{{year}}-{{title}}`)

### Templates
- **Header/body templates**: Customize note structure using Handlebars syntax
- **Custom frontmatter fields**: Add, edit, or reorder YAML fields
- **Citekey generation**: Define patterns like `{{authors_family.0|lower}}{{year}}`

### Integration
- **Zotero connector**: Enable local server for browser imports (port 23119)
- **Bibliography paths**: Set locations for JSON/BibTeX exports

## Template System

BibLib uses Handlebars templating with CSL variables:

- **Variables**: `{{title}}`, `{{year}}`, `{{DOI}}`, `{{author.0.family}}`
- **Formatting**: `{{title|lowercase}}`, `{{authors_family.0|abbr3}}`
- **Conditionals**: `{{#variable}}...{{/variable}}`, `{{^variable}}...{{/variable}}`
- **Arrays**: Loop through `{{authors_family}}`, `{{editors}}`, etc.

### Pandoc-Compatible Citekeys

Generated citekeys follow Pandoc's rules:
- Must start with letter, digit, or underscore
- Can contain alphanumerics and `:.#$%&-+?<>~/`
- Examples: `smith2023`, `jones-allen_2022`, `brown_et.al:2021`

## License

MIT
