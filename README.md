# BibLib for Obsidian

> [!NOTE]
> This plugin is awaiting approval by the Obsidian team, so currently 
> must be installed manually, or by using BRAT. 

BibLib is a streamlined approach to academic reference management that leverages Obsidian's core strengths: plain text, interlinked notes, and powerful metadata. Unlike plugins that focus on Zotero integration, BibLib enables you to manage your entire reference library directly within Obsidian, eliminating synchronization complexities and giving you a fully integrated knowledge system.

![Screenshot of biblib Obsidian plugin](https://github.com/callumalpass/obsidian-biblib/blob/main/screenshots/create-lit-note.gif?raw=true)

## Why BibLib?

Most reference management solutions for Obsidian focus on integrating with external tools like Zotero. This often works well, but can sometimes introduce complexity through managing synchronization processes, dealing with different data formats, and working across two distinct applications.

BibLib helps to implement alternative approach by managing reference information directly within Obsidian. The idea is to treat bibliographic entries fundamentally like any other note in your vault.

Here's how this workflow functions:

- References as Markdown Notes: Each reference (article, book, chapter, etc.) is stored as a standard .md file. The **bibliographic data is contained within YAML frontmatter, structured to be compatible with the CSL-JSON standard commonly used by citation tools.**
- Direct Linking within Your Vault: Because references are just notes, you can link to them (and from them) using standard Obsidian [[wikilinks]]. This allows you to connect your ideas, meeting notes, or project plans directly to the relevant source material within the same system.
- Plain Text Simplicity and Durability: Using markdown and YAML means your reference data is stored in open, human-readable formats. This makes your library easily portable, searchable with standard text tools, manageable with version control (like Git), and less dependent on the future of any single piece of software.
- Utilizing Obsidian's Tools: Obsidian's built-in features like search, backlinks, tags, and graph view work directly on your reference notes. You can also use community plugins, such as Dataview, to query and organize your reference data in flexible ways (e.g., listing papers by author, year, or tag).
- Simplified Reference Entry: To ease the process of adding new references, BibLib includes tools to fetch bibliographic metadata automatically using identifiers like DOIs, URLs, or ISBNs via the Citoid and CrossRef APIs.
- Connecting Notes to Source Texts: The workflow integrates with Obsidian's handling of PDFs. You can link directly from a line in your notes to a specific page and location within a PDF attached to a reference note, keeping your arguments closely tied to the source text.
- Preparing for Publication: Since the YAML frontmatter is CSL-compatible, BibLib can generate a bibliography.json file from your notes (if you decide you don't like *this* plugin, it is also trivial to write your own script to convert the YAML frontmatter to a CSL file). This file can then be used directly with tools like Pandoc to create formatted citations and bibliographies in your final documents, avoiding manual export steps from external managers.

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
- CrossRef API integration for DOI lookups
- Build bibliography files from your literature notes

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

### Working with PDF Annotations

BibLib seamlessly integrates with Obsidian's native PDF capabilities, creating a powerful workflow for academic reading and citation:

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

- **Citoid API URL**: The URL for the Citoid API to fetch bibliographic data (default uses Wikipedia's Citoid API, with CrossRef API fallback for DOIs)

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


## Upcoming Features

- Bulk import of existing bibliographic data from BibTeX/CSL-JSON

## Important Note About Obsidian's YAML Parser

Obsidian's frontmatter parser only supports simple key-value pairs and does not handle nested objects in YAML. When using this plugin, you may see warnings in Obsidian for certain fields that BibLib generates (particularly the `authors` and `issued` fields). 

Please note that these warnings do not indicate a problem - the YAML generated by BibLib is completely valid and can be properly converted to CSL-JSON for use with tools like Pandoc. Obsidian simply cannot display or utilize the nested structure of these fields in its metadata views.

## License

MIT
