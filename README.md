# **BibLib for Obsidian**

> [!NOTE]  
> This plugin is awaiting approval by the Obsidian team, so currently must be installed manually, or by using BRAT.

BibLib is an Obsidian plugin that turns your vault into a robust academic
reference manager. It stores each reference (paper, book, etc.) as a Markdown
note with bibliographic metadata in the YAML frontmatter using the Citation
Style Language (CSL) JSON format. By leveraging CSL – the same open standard
used by tools like Pandoc ([Citation Style Language - Wikipedia](https://en.wikipedia.org/wiki/Citation_Style_Language#:~:text=The%20Citation%20Style%20Language%20,1))
– BibLib ensures your references are portable and
ready for automated citation formatting. All your reference data lives in plain
text (Markdown and YAML), making it future-proof, version-controllable, and
easily searchable. This approach keeps your reference library **inside
Obsidian**, so you can link and manage sources just like any other notes, which
is a big win for academics and researchers who want an integrated workflow.

![Screenshot of biblib Obsidian plugin](https://github.com/callumalpass/obsidian-biblib/blob/main/screenshots/create-lit-note.gif?raw=true)

## Why Store References in CSL Frontmatter?

- **Open Standard & Interoperability:** CSL JSON is a widely adopted format for
  citations ([Citation Style Language - Wikipedia](https://en.wikipedia.org/wiki/Citation_Style_Language#:~:text=The%20Citation%20Style%20Language%20,1)). By storing references in this structure, your data
  isn’t locked into a proprietary system. You can use it with external tools
  (e.g. use BibLib’s output with Pandoc to generate formatted citations and
  bibliographies in any style). This means your Obsidian notes can directly
  feed into papers, articles, or thesis documents without manual re-formatting.  
- **Plain-Text Durability:** All reference information is saved as
  human-readable text (Markdown for notes, YAML for metadata). This makes your
  library durable and transparent. Even if Obsidian or the plugin isn’t
  available, you still have all your references accessible in plain text. You
  can track changes with version control (git) and collaborate or share
  references easily.  
- **Unified Knowledge Base:** Academics often juggle separate reference
  managers and note-taking apps. BibLib eliminates context-switching by
  treating references as first-class Obsidian notes. You can **wiki-link**
  `[[YourReferenceNote]]` in your writing, tag references, or see backlinks
  from your ideas to the sources. Your vault’s graph and search will reveal
  connections between literature and your notes. This integrated approach means
  your literature sources and your notes form a single connected knowledge
  graph.  
- **Pandoc-Ready Bibliography:** Because BibLib adheres to CSL JSON, it can
  output a `bibliography.json` for your entire library (or a subset). This file
  can be fed directly to Pandoc or other processors to produce a properly
  formatted bibliography, without any extra conversion steps. In other words,
  writing a paper in Obsidian with citations is seamless – cite your sources
  and let Pandoc/Citeproc handle the formatting using your BibLib-generated
  bibliography.  

## Key Features

- **CSL-JSON Metadata in YAML:** Bibliographic details (authors, title,
  publication info, etc.) are stored in each note’s YAML frontmatter following
  the CSL JSON schema. This ensures compatibility with citation tools and
  long-term accessibility of data. (For example, an article note’s YAML might
  include an array of `author` objects, an `issued` date, etc., just like a CSL
  entry.)  
- **Native Obsidian Storage:** Each reference is a `.md` file in your vault, so
  no external database is needed. Your references “live” alongside your other
  notes. This means you can open, edit, link, or move them like any note.
  Attach PDFs or supplements to these notes to keep everything in one place.  
- **Zotero Connector Integration:** BibLib connects with the Zotero browser
  connector for one-click reference importing. With the plugin’s built-in local
  server (desktop only), clicking the Zotero Connector in your browser will
  send citation data (and PDFs when available) directly into Obsidian. BibLib
  opens a pre-filled modal to confirm the details and lets you save the new
  reference note instantly – no need to have Zotero running or to manually
  export/import data.  
- **Flexible Templating:** The plugin uses a Handlebars-based template system
  to customize how notes are created. You can define how titles
  are formatted (e.g. citekey patterns), which fields appear in YAML, and the
  content of the note’s body. For instance, you might have a template that
  automatically adds a “## Highlights” section in the note or formats the
  author list in a specific way. This is highly useful for tailoring literature
  notes to your academic workflow.  
- **Metadata Lookup (DOI/ISBN):** Instead of typing bibliographic data, use the
  **Lookup** feature. Provide a DOI, ISBN, or URL and BibLib will fetch
  metadata via the Citoid service (powered by Citation.js). This auto-fills the
  form with the reference details retrieved from Crossref, WikiData, or other
  sources, saving you time and ensuring accuracy.  
- **Supports All Reference Types:** Whether it’s a journal article, book, book
  chapter, report, thesis, etc., BibLib handles it. The fields in the YAML
  adjust based on the reference type you choose. You can even manage book
  chapters by linking them to a book entry – the plugin will inherit the book’s
  details (editors, publisher, etc.) for the chapter’s metadata. This
  hierarchical handling is great for organizing volumes with contributions.  
- **Attachment Management:** Attach PDFs or EPUBs to your reference notes with
  ease. When creating a note, you can choose to import a PDF into your vault
  (it will copy the file to a designated folder) or link to an existing file in
  your vault. If you used the Zotero Connector and it found a PDF, BibLib will
  auto-attach it for you. You can then open the PDF in Obsidian’s reader and
  even create anchored links to specific pages or annotations in your notes
  (for quick reference to quotes).  
- **Obsidian Integration:** Because each reference is a note, you can leverage
  Obsidian’s ecosystem on your bibliography: use the graph view to visualize
  connections, run searches or **Dataview** queries to list references (e.g.,
  all papers by a certain author or in a certain year), and use tags or folders
  to categorize sources (e.g., #to-read, #methodology). *Note:* Obsidian’s
  current metadata UI doesn’t natively display nested YAML fields, so complex
  fields like the `author` list might show a warning. Don’t worry – the data is
  still stored correctly, and external tools or plugins can read it. This is a
  limitation of Obsidian’s parser, not of BibLib.  
- **Export to BibTeX or CSL JSON:** Need to use your references outside
  Obsidian? BibLib can compile all your reference notes into a single
  `bibliography.json` (CSL-JSON format) or a BibTeX `.bib` file at any time.
  This is handy for inserting into a manuscript or sharing with collaborators
  who use a reference manager. The export respects the data in your YAML, so it
  stays consistent.  
- **PDF Annotation Linking:** If you highlight or annotate PDFs in Obsidian,
  you can copy direct links to those annotations and paste them in your
  literature note. BibLib makes it easy to connect a note’s commentary to the
  exact place in the source PDF. This tight coupling of
  notes and sources is ideal for academic writing and reviewing literature. 
  Works great with [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus)

## Usage Overview

- **Creating a New Reference Note:** Open the command palette in Obsidian and
  select **“BibLib: Create Literature Note.”** A form will appear where you can
  input bibliographic details. You can choose the reference type (article, book,
  etc.), then fill in fields like title, year, etc. You can also add
  authors/editors in a dedicated section. To save time, use the **Lookup**
  button with a DOI, ISBN, or URL to auto-populate fields from online
  databases. Once satisfied, click **“Create Note”** – BibLib will generate a
  new Markdown note in your vault (using your template settings) with all the
  info in the YAML frontmatter. If you selected a PDF to import or the Zotero
  Connector provided one, the file will be placed in your attachments folder
  and linked in the note.  
- **Using the Zotero Connector (Web Import):** For one-click imports while
  browsing, enable the **Connector Server** in BibLib settings (desktop only).
  Make sure the Zotero desktop app is closed (to free up the connector port).
  With the server running, whenever you find a paper or book webpage, click the
  Zotero browser extension icon. BibLib will intercept the data and open the
  new reference modal inside Obsidian, already filled out. You can tweak any
  details (or the citekey) and then create the note. This saves a ton of time
  for researchers: you grab references straight from your web research session
	  into Obsidian without juggling CSV exports or manual entry. *(Behind the
	  scenes, Zotero’s connector sends data to a local HTTP port 23119, which
	  BibLib listens on.)*  
- **Organizing and Linking:** Once you have some literature notes, you can link
  to them from your other notes using Obsidian’s standard link syntax
  `[[citekey]]` (where “citekey” is whatever unique key you gave the reference,
  like `Smith2020` for a 2020 paper by Smith). This lets you reference sources
  contextually in your notes. For example, in a lecture notes file you might
  write “According to [[Smith2020]], ...” which serves both as a cue for you
  and a direct link to the full reference details. You might also tag reference
  notes (e.g., tag all methodology-related sources with `#methodology`) or put
  them in a folder structure if you prefer. All of Obsidian’s discovery
  features (backlinking, graph view, etc.) apply, helping you see where a
  reference was cited in your notes or which themes a source connects to.  
- **Generating a Bibliography File:** Whenever you need an updated bibliography
  of your vault’s references (for writing or backup), use **“BibLib: Build
  Bibliography.”** This will scan all your literature notes and compile a
  `bibliography.json` containing all their metadata. You can also export a
  BibTeX file via **“BibLib: Export Bibliography as BibTeX.”** in the command
  palette. The paths for these output files are configurable in settings. By
  maintaining this compiled bibliography, you enable other workflows – for
  example, if you write a paper in Markdown with Pandoc, you can point Pandoc
  to `bibliography.json` and cite using `[@citekey]` syntax, and it will
  produce fully formatted citations and a references list. Academic users will
  find this extremely useful for writing manuscripts in Obsidian while
  satisfying journal or thesis citation format requirements.  
- **Editing References:** If you need to update a reference’s details, you can
  simply edit the YAML frontmatter of the note. All fields are plain text. For
  example, if a publication year was missing or you want to add an issue number,
  just open the note, click the YAML in edit mode and make changes. (Future
  enhancements will include an “Edit Reference” dialog for convenience – see
  development plans below.) Keep in mind Obsidian’s Properties panel might not
  show nested fields correctly (it could show a warning or nothing for an
  `author` list), so rely on the raw YAML view when editing complex fields.  
- **Working with PDF Highlights:** When reviewing attached PDFs in Obsidian,
  you can highlight text or add comments. To tie these into your literature
  notes, copy the highlight link (Obsidian’s PDF viewer provides a way to copy
  a link to the highlight/selection). Paste this in your literature note under
  a relevant section (e.g., under a “Notes” or “Key Quotes” heading). This
  creates an interactive reference — clicking it opens the PDF to that exact
  spot. Over time, you build a note that not only summarizes a source but
  points to the critical passages in the original, which is great for writing
  literature reviews or when you need to double-check a quote’s context.  

> [!IMPORTANT]  Obsidian's built-in frontmatter parser currently only supports
> simple key-value pairs and cannot interpret nested structures (like CSL's
> author or issued fields). BibLib generates valid YAML and CSL-JSON, but you
> might see warnings in Obsidian's metadata panel for these nested fields.
> These warnings do not indicate an error with BibLib or your data; the nested
> data is stored correctly and usable by external tools like Pandoc. Obsidian
> simply cannot display or query these specific nested fields natively yet.

## **Settings**

BibLib offers customization options to tailor the workflow:

### **File Paths**

* **Attachment folder path**: Specify the default directory within your vault
  where imported PDF/EPUB attachments will be stored.  
* **Create subfolder for attachments**: If enabled, creates a subfolder named
  after the citekey within the attachment folder for each reference's files.  
* **Literature note location**: Specify the default directory where new
  literature notes (.md files) will be created.  
* **Use prefix for literature notes**: If enabled, adds a prefix to the
  filename of literature notes.  
* **Literature note prefix**: Define the prefix string (e.g., Lit/, Ref-) to be
  added if the above option is enabled.

### **Custom Frontmatter Fields & Templating**

BibLib uses a template engine (based on Handlebars syntax) for customizing
various aspects of your notes. This allows you to define exactly what fields
appear in your YAML frontmatter and how the note itself is structured.

* **Header Template**: Define the template for the main content *above* the
  frontmatter block (e.g., `## {{title}}`).  
* **Custom Frontmatter Fields**: Manage the fields included in the YAML
  frontmatter. You can add, edit, reorder, or disable fields. Each field has:  
  * **Field Name**: The key used in the YAML (e.g., status, keywords).  
  * **Template**: A Handlebars template defining the value for that key. Use
	CSL variables (`{{title}}`, `{{author.0.family}}`) and helpers. Templates
	starting with `[` and ending with `]` will attempt to parse the content as
	a YAML array (e.g., `[{{#authors_family}}"[[Author/{{.}}]]"{{^@last}},
	{{/@last}}{{/authors_family}}]`).  
  * **Enabled**: Toggle whether this field is included.  
* **Body Template**: Define a template for the content *below* the frontmatter
  block in newly created notes.

**Template System Basics:**

* Variables: `{{variable}}` (e.g., `{{title}}`, `{{year}}`, `{{DOI}}`). Access
  nested CSL data using dot notation (e.g., `{{issued.date-parts.0.0}}` for
  year).  
* Formatting Helpers: `{{variable|format}}` (e.g., `{{title|lowercase}}`).
  Common formats include uppercase, lowercase, capitalize, sentence. Specific
  helpers exist for citekeys (see below).  
* Negative Conditional Blocks: `{{^variable}}Content if variable is
  missing{{/variable}}`
* Positive Conditional Blocks: `{{#variable}}Content if variable is
  present{{\variable}}`.  
* Available Variables: Includes all standard CSL fields detected for the
  reference, plus computed fields like `{{authors}}` (formatted string),
  `{{pdflink}}` (path to linked attachment), `{{currentDate}}`. Arrays like
  `{{authors_family}}`, `{{authors_given}}`, `{{editor}}` are available for
  looping.  
* Consult the plugin settings panel for more detailed syntax examples and a
  list of available formatting helpers.

This system provides **control** over how your reference data is stored and presented.

### **Bibliography Builder**

* **Bibliography JSON path**: Set the vault path (including filename) where the
  bibliography.json file will be saved.  
* **Citekey list path**: Set the vault path (including filename) where the
  citekeylist.md file will be saved.  
* **BibTeX file path**: Set the vault path (including filename) where the
  exported .bib file will be saved.

### **Zotero Connector Server (Desktop Only)**

* **Enable Connector Server**: Toggle the local server on/off. Must be enabled
  to use the Zotero Connector integration.  
* **Connector Server Port**: The network port the server listens on. Default is
  23119, matching Zotero's default. Change only if needed due to port
  conflicts.  
* **Temporary PDF folder**: A system temporary directory where PDFs downloaded
  via the connector are initially stored before being imported into the vault.
  Usually does not need changing.

## **Citekey Generation**

Define automated citekey patterns using the **templating engine**, providing
consistent and predictable keys for your references.

* **Citekey Template**: Enter a Handlebars template defining the desired
  citekey format. Examples:  
  * `{{authors_family.0|lower}}{{year}}` -> smith2023  
  * `{{authors_family.0|lower}}{{year}}{{title|abbr1}}` -> smith2023q (using
	first letter of first significant title word)  
  * `{{authors_family.0|abbr3}}{{year}}` -> smi2023 (using first 3 letters of
	first author's last name)  
* **Special Citekey Formatters**: In addition to standard formatters, specific
  helpers are available for citekey generation:  
  * `|abbrN`: Abbreviate to first N characters (e.g., |abbr3).  
  * `|titleword`: First significant word of the title (lowercase).  
  * `|abbrTitleWordN`: First N letters of the first significant title word.  
  * `|shorttitle`: First few significant words of the title.  
  * (Consult settings for a full list).  

## **Upcoming Features**

* Bulk import from existing BibTeX/CSL-JSON files.  
* Export individuals files to various formats.

## **License**

MIT
