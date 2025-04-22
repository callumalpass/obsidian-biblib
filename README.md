# BibLib for Obsidian

> [!NOTE]
> This plugin is awaiting approval by the Obsidian team, so currently 
> must be installed manually, or by using BRAT. 

BibLib is a streamlined approach to academic reference management that leverages Obsidian's core strengths: plain text, interlinked notes, and powerful metadata. BibLib enables you to manage your entire reference library directly within Obsidian, providing a fully integrated knowledge system. With the new Zotero Connector integration, you can now capture citations and PDFsinto Obsidian directly from your browser with a single click, combining the best of both worlds: Zotero's powerful web capture with Obsidian's knowledge management capabilities.

![Screenshot of biblib Obsidian plugin](https://github.com/callumalpass/obsidian-biblib/blob/main/screenshots/create-lit-note.gif?raw=true)

## Why BibLib?

BibLib provides a unique approach to reference management by letting you maintain your bibliography natively within Obsidian's ecosystem. While it now includes Zotero Connector integration for easy web capture, it doesn't require you to maintain a separate Zotero database or deal with complex synchronization processes.

With BibLib, you get the best of both worlds:
- **Zotero's powerful web capture** - use the Zotero browser extension to grab citations and PDFs with one click
- **Native Obsidian storage** - all data stays in your vault as markdown notes with structured YAML frontmatter
- **No external dependencies** - no need to run Zotero alongside Obsidian or manage synchronization

The core idea is simple: treat bibliographic entries fundamentally like any other note in your vault.

Here's how this workflow functions:

- **Browser to Obsidian in One Click**: With the Zotero Connector integration, capture citations and PDFs directly from your browser with a single click - no need to manually copy DOIs or download PDFs separately.
- **References as Markdown Notes**: Each reference (article, book, chapter, etc.) is stored as a standard .md file. The **bibliographic data is contained within YAML front matter, structured to be compatible with the CSL-JSON standard commonly used by citation tools.**
- **Direct Linking within Your Vault**: Because references are just notes, you can link to them (and from them) using standard Obsidian [[wiki links]]. This allows you to connect your ideas, meeting notes, or project plans directly to the relevant source material within the same system.
- **Plain Text Simplicity and Durability**: Using markdown and YAML means your reference data is stored in open, human-readable formats. This makes your library easily portable, searchable with standard text tools, manageable with version control (like Git), and less dependent on the future of any single piece of software.
- **Utilizing Obsidian's Tools**: Obsidian's built-in features like search, backlinks, tags, and graph view work directly on your reference notes. You can also use community plugins, such as Dataview, to query and organize your reference data in flexible ways (e.g., listing papers by author, year, or tag).
- **Simplified Reference Entry**: To ease the process of adding new references, BibLib fetches BibTeX from the Citoid API (using DOIs, URLs, or ISBNs) and uses Citation.js to parse it into true CSL-JSON, or captures data directly from your browser via the Zotero Connector.
- **Connecting Notes to Source Texts**: The workflow integrates with Obsidian's handling of PDFs. You can link directly from a line in your notes to a specific page and location within a PDF attached to a reference note, keeping your arguments closely tied to the source text.
- **Preparing for Publication**: Since the YAML frontmatter is CSL-compatible, BibLib can generate a bibliography.json file from your notes (if you decide you don't like *this* plugin, it is also trivial to write your own script to convert the YAML frontmatter to a CSL file). This file can then be used directly with tools like Pandoc to create formatted citations and bibliographies in your final documents, avoiding manual export steps from external managers.

This approach has proven effective for my personal academic workflow for several years, offering a good balance of simplicity and power. When combined with plugins like [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus), BibLib creates a comprehensive environment for managing both reference metadata and annotations in a unified, interlinked system.

## Features

- Create literature notes with complete bibliographic information
- Support for various publication types (articles, books, chapters, etc.)
- Create book chapter entries that inherit properties from their container book
- Add and manage contributors with different roles (authors, editors, translators, etc.)
- Link to PDF/EPUB attachments with flexible options:
  - Import files (copy to bibliography folder)
  - Link to existing files in your vault
- Full support for Citation Style Language (CSL) fields
- Customizable note prefixes and file locations
- Automatic creation of contributor links
- Auto-fill citation data using DOI, URL, or ISBN via Citoid API
 - Citation.js parsing of BibTeX into CSL-JSON for seamless DOI, URL, and ISBN support
- **Zotero Connector integration** - capture citations and PDFs directly from your browser with one click
- Automatic PDF download and attachment from supported sites
- Build bibliography files from your literature notes

> [!NOTE]
> Obsidian's frontmatter parser only supports simple key-value pairs and does not handle nested objects in YAML. When using this plugin, you may see warnings in Obsidian for certain fields that BibLib generates (particularly the `authors` and `issued` fields). 
> 
> Please note that these warnings do not indicate a problem - the YAML generated by BibLib is completely valid and can be properly converted to CSL-JSON for use with tools like Pandoc. Obsidian simply cannot display or utilize the nested structure of these fields in its metadata views.

## How to Use

### Creating Literature Notes

1. Open the command palette and select "Create Literature Note"
2. Enter the bibliographic information in the modal:
   - **Auto-fill option**: Enter a DOI, URL, or ISBN and click "Lookup" to automatically fill the form
   - Required fields: Citekey, Type, Title, Year
   - Optional fields depend on the publication type
3. Add contributors (authors, editors, etc.)
4. Choose an attachment option:
   - No attachment
   - Import file (copies PDF/EPUB to your configured attachment folder)
   - Link to existing file (creates a link to a file already in your vault)
5. Click "Create Note" to generate a formatted literature note

### Creating Book Chapter Entries

1. There are two ways to create a chapter entry:
   - Open the command palette and select "Create Book Chapter Entry"
   - While viewing a book entry, open the command palette and select "Create Chapter From Current Book"
2. Enter the chapter information:
   - Required fields: Citekey, Title, Container Book, Year
   - The container book dropdown shows all book entries in your vault
3. When you select a container book, relevant information is automatically inherited:
   - Publisher and publisher place
   - Book editors (mapped as container-authors)
   - Publication year
   - Book's attachment (as a link option)
4. Add chapter-specific information:
   - Chapter author(s)
   - Page range
   - Chapter-specific metadata
5. Choose an attachment option:
   - No attachment
   - Import a new file
   - Link to an existing file (the container book's PDF is suggested if available)
6. Click "Create Chapter Note" to generate a formatted chapter note

### Building a Bibliography

1. Create literature notes for your references using the method above
2. Open the command palette and select "Build Bibliography"
3. The plugin will:
   - Generate a `citekeylist.md` file with all citation keys
   - Create a comprehensive `bibliography.json` file with full citation data
4. These files can be used with external tools or referenced in your notes
5. To export a unified BibTeX file from all your literature notes, open the command palette and select "Export Bibliography as BibTeX" (path configurable in Settings).

### Using the Zotero Connector (Desktop Only)

BibLib now includes direct integration with the Zotero Connector browser extension, allowing you to capture citations and PDFs with a single click:

1. In BibLib settings, enable the "Zotero Connector Server" option
2. Install the [Zotero Connector](https://www.zotero.org/download/connectors) extension for your browser
3. Make sure Zotero desktop application is **NOT running** (it uses the same port by default)
4. When browsing a site with scholarly content:
   - Simply click the Zotero button in your browser toolbar
   - The connector will automatically detect and send data to BibLib
5. BibLib will:
   - Automatically open the bibliography modal with pre-filled citation data
   - Download and attach PDFs when available from supported sites (like arXiv, publisher sites, etc.)
   - Allow you to customize the citekey before saving
   - Create a properly formatted literature note with all metadata

> [!NOTE]
> The Zotero Connector feature is only available on desktop versions of Obsidian due to platform limitations on mobile devices.
>
> **Advanced usage:** If you want to use both Zotero desktop and BibLib simultaneously, you'll need to:
> 1. Change the port in BibLib settings to something different (e.g., 23118)
> 2. Hold Shift when clicking the Zotero button to manually select server
> 3. Enter the custom address (e.g., `http://127.0.0.1:23118`)

### Working with PDF Annotations

BibLib integrates with Obsidian's native PDF capabilities, creating a workflow for academic reading and citation:

1. Attach PDFs to your literature notes during creation
2. Open PDFs directly from your literature notes
3. Create precise annotations using Obsidian's PDF viewer
4. Insert citations in your notes using Obsidian's annotation syntax:
   ```
   [[smith2023.pdf#page=42&selection=17,1,21,22|Smith 2023, p. 42]]
   ```
5. Enhance your PDF workflow with compatible plugins like [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus)

This workflow keeps your references, PDFs, and annotations all within the same system, creating a truly integrated research environment.

## Settings

### File Paths

- **Attachment folder path**: Where PDF and EPUB attachments will be stored
- **Create subfolder for attachments**: Option to create a subfolder for each citation
- **Literature note location**: Where literature notes will be stored
- **Use prefix for literature notes**: Option to add a prefix to literature note filenames
- **Literature note prefix**: The prefix to add to literature note filenames

### API Settings

- **Citoid API URL**: Fixed to Wikipedia's `/citation/bibtex/` endpoint; BibTeX is parsed via Citation.js into CSL-JSON

### Custom Frontmatter Fields

- **Include date created**: Add a dateCreated field with creation timestamp
- **Include year field**: Add a separate year field for easy filtering
- **Include author links**: Add authorLink field with Obsidian links to author pages
- **Include attachment links**: Add attachment field with Obsidian links to attached files

### Note Templates

- **Header Template**: Customize the format of the first header in literature notes using variables:
  - `{{title}}` - The title of the reference
  - `{{citekey}}` - The citation key
  - `{{year}}` - Publication year
  - `{{authors}}` - Formatted author names
  - `{{pdflink}}` - Link to the attached PDF (if available)
  - Supports conditional blocks with `{{^variable}}fallback{{/variable}}`
- **Chapter Header Template**: Customize the format of the first header in chapter notes with additional variables:
  - `{{container-title}}` - The title of the container book

### Bibliography Builder

- **Bibliography JSON path**: Where to save the bibliography.json file
- **Citekey list path**: Where to save the citekeylist.md file
- **BibTeX file path**: Where to save the exported BibTeX file

### Zotero Connector Server (Desktop Only)

- **Enable Connector Server**: Start a local server to intercept Zotero connector browser requests
- **Connector Server Port**: The port to run the Zotero connector server on (default: 23119, same as Zotero)
- **Temporary PDF folder**: The folder where temporary PDFs from the connector will be stored


## Upcoming Features

- Bulk import of existing bibliographic data from BibTeX/CSL-JSON

## Citekey Generation

BibLib provides flexible citekey generation with customizable options:

- Author name formats: full, first three, or first four letters
- Multiple author handling: include information from co-authors
- Two-author styles: Author1AndAuthor2 or Author1J (initial)
- Style options for three or more authors: Author1JK or Author1EtAl
- Customizable delimiters between author and year: smith_2023
- Length validation with random suffixes for short citekeys
- Special handling for Zotero keys

You can configure all citekey options in the settings tab under "Citekey generation".

## License

MIT
