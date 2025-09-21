# BibLib for Obsidian

> [!NOTE]
> For more on why/how to use BibLib, see the [documentation](https://callumalpass.github.io/obsidian-biblib)

BibLib transforms Obsidian into an academic reference manager by storing each reference as a Markdown note with bibliographic metadata in YAML frontmatter using the [Citation Style Language](https://citationstyles.org/) (CSL) JSON format. BibLib ensures your references are portable and ready for automated citation formatting. All your reference data lives in plain text (Markdown and YAML), making it future-proof, version-controllable, and easy to work with in Obsidian's new Bases. This approach keeps your reference library **inside Obsidian**, so you can link and manage sources just like any other notes. 

![Screenshot of biblib Obsidian plugin](https://github.com/callumalpass/obsidian-biblib/blob/main/screenshots/create-lit-note.gif?raw=true)
**Automatic retrieval of literature note metadata**

<img width="954" height="987" alt="2025-09-21_16-01" src="https://github.com/user-attachments/assets/bda8cb07-35e3-4c73-8a12-1d061811106e" />
**Example frontmatter of a note**


## Why BibLib?

- **Open standard**: Uses CSL JSON format for universal compatibility with citation tools
- **Plain text storage**: All data in human-readable Markdown and YAML files
- **Native integration**: References are regular Obsidian notes that can be linked, tagged, and searched
- **Pandoc-ready**: Generates `bibliography.json` files for automated citation formatting

## Why Store References in CSL Frontmatter?

- **Open Standard & Interoperability:** CSL JSON is a widely adopted format for citations ([Citation Style Language - Wikipedia](https://en.wikipedia.org/wiki/Citation_Style_Language#:~:text=The%20Citation%20Style%20Language%20,1)). By storing references in this structure, your data isn’t locked into a proprietary system. You can use it with external tools (e.g. use BibLib’s output with Pandoc to generate formatted citations and bibliographies in any style). This means your Obsidian notes can directly feed into papers, articles, or thesis documents without manual re-formatting.  
- **Plain-Text Durability:** All reference information is saved as human-readable text (Markdown for notes, YAML for metadata). This makes your library durable and transparent. Even if Obsidian or the plugin isn’t available, you still have all your references accessible in plain text. You can track changes with version control (git) and collaborate or share references easily.  
- **Unified Knowledge Base:** Academics often juggle separate reference managers and note-taking apps. BibLib eliminates context-switching by treating references as first-class Obsidian notes. You can **wiki-link** `[[YourReferenceNote]]` in your writing, tag references, or see backlinks from your ideas to the sources. Your vault’s graph and search will reveal connections between literature and your notes. This integrated approach means your literature sources and your notes form a single connected knowledge graph.  
- **Pandoc-Ready Bibliography:** Because BibLib adheres to CSL JSON, it can output a `bibliography.json` for your entire library. This file can be fed directly to Pandoc or other processors to produce a properly formatted bibliography, without any extra conversion steps. In other words, writing a paper in Obsidian with citations is seamless – cite your sources and let Pandoc/Citeproc handle the formatting using your BibLib-generated bibliography.  

## Key Features

- **CSL-JSON Metadata in YAML:** Bibliographic details (authors, title, publication info, etc.) are stored in each note’s YAML frontmatter following the CSL JSON schema. This ensures compatibility with citation tools and long-term accessibility of data. (For example, an article note’s YAML might include an array of `author` objects, an `issued` date, etc., just like a CSL entry.)  
- **Native Obsidian Storage:** Each reference is a `.md` file in your vault, so no external database is needed. Your references “live” alongside your other notes. This means you can open, edit, link, or move them like any note. Attach PDFs or supplements to these notes to keep everything in one place.  **Zotero Connector Integration:** BibLib connects with the Zotero browser connector for one-click reference importing. With the plugin’s built-in local server (desktop only), clicking the Zotero Connector in your browser will send citation data (and PDFs when available) directly into Obsidian. BibLib opens a pre-filled modal to confirm the details and lets you save the new reference note instantly – no need to have Zotero running or to manually export/import data.  
- **Flexible Templating:** The plugin uses a Handlebars-based template system to customize how notes are created. You can define how titles are formatted (e.g. citekey patterns), which fields appear in YAML, and the content of the note’s body. For instance, you might have a template that automatically adds a “## Highlights” section in the note or formats the author list in a specific way. This is highly useful for tailoring literature notes to your academic workflow.  
- **Metadata Lookup (DOI/ISBN):** Instead of typing bibliographic data, use the **Lookup** feature. Provide a DOI, ISBN, or URL and BibLib will fetch metadata via the Citoid service (powered by Citation.js). This auto-fills the form with the reference details retrieved from Crossref, WikiData, or other sources, saving you time and ensuring accuracy.  
- **Supports All Reference Types:** Whether it’s a journal article, book, book chapter, report, thesis, etc., BibLib handles it. The fields in the YAML adjust based on the reference type you choose. You can even manage book chapters by linking them to a book entry – the plugin will inherit the book’s details (editors, publisher, etc.) for the chapter’s metadata. This hierarchical handling is great for organizing volumes with contributions.  
- **Attachment Management:** Attach PDFs or EPUBs to your reference notes with ease. When creating a note, you can choose to import a PDF into your vault (it will copy the file to a designated folder) or link to an existing file in your vault. If you used the Zotero Connector and it found a PDF, BibLib will auto-attach it for you. You can then open the PDF in Obsidian’s reader and even create anchored links to specific pages or annotations in your notes (for quick reference to quotes).  
- **Obsidian Integration:** Because each reference is a note, you can leverage Obsidian’s ecosystem on your bibliography: use the graph view to visualize connections, run searches or **Dataview** queries to list references (e.g., all papers by a certain author or in a certain year), and use tags or folders to categorize sources (e.g., #to-read, #methodology). *Note:* Obsidian’s current metadata UI doesn’t natively display nested YAML fields, so complex fields like the `author` list might show a warning. Don’t worry – the data is still stored correctly, and external tools or plugins can read it. This is a limitation of Obsidian’s parser, not of BibLib.  
- **Export to BibTeX or CSL JSON:** Need to use your references outside Obsidian? BibLib can compile all your reference notes into a single `bibliography.json` (CSL-JSON format) or a BibTeX `.bib` file at any time. This is handy for inserting into a manuscript or sharing with collaborators who use a reference manager. The export respects the data in your YAML, so it stays consistent.  
- **Import from Zotero or BibTeX/CSL-JSON files**: BibLib can import your references from Zotero or other reference managers. It can handle Zotero's attachments and the notes that you've taken in Zotero. Or, if you manage you references using just a BibTeX file, it can handle that as well!
- **PDF Annotation Linking:** If you highlight or annotate PDFs in Obsidian, you can copy direct links to those annotations and paste them in your literature note. BibLib makes it easy to connect a note’s commentary to the exact place in the source PDF. This tight coupling of notes and sources is ideal for academic writing and reviewing literature. Works great with [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus)

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
