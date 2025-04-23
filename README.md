# **BibLib for Obsidian**

> [!NOTE]  
> This plugin is awaiting approval by the Obsidian team, so currently must be installed manually, or by using BRAT.

BibLib offers **an approach to academic reference management focused on simplicity and robustness *natively within Obsidian***. It treats your references as standard Markdown notes within your vault, grounding your bibliography in the durable and open formats of **plain text, structured YAML, and the widely-supported Citation Style Language (CSL) standard**. This promotes long-term accessibility and interoperability.

With BibLib, you manage your reference library directly alongside your notes, using Obsidian's linking, tagging, and querying capabilities. The **Zotero Connector integration** streamlines capture of web sources directly into Obsidian notes *without requiring the Zotero desktop application or database synchronization*.

BibLib aims to provide an integrated knowledge system where your references are first-class citizens within your Obsidian vault.


![Screenshot of biblib Obsidian plugin](https://github.com/callumalpass/obsidian-biblib/blob/main/screenshots/create-lit-note.gif?raw=true)

## **The BibLib Approach**

Traditional reference management often involves separate applications and synchronization. BibLib simplifies this by using Obsidian's core strengths and focusing on data robustness:

1. **Native Obsidian Storage:** Each reference (article, book, etc.) is a standard .md file. Bibliographic data resides within its YAML frontmatter, structured according to the CSL-JSON standard. Your references live *with* your notes.  
2. **Plain Text Foundation:** Using Markdown and YAML means your library is inherently **robust, portable, and future-proof**. It's searchable, version-controllable (e.g., with Git), and not locked into a proprietary format.  
3. **CSL Standard Compliance:** Storing metadata in a CSL-compatible structure offers key advantages. CSL is the **open standard** used by numerous academic tools. This ensures your data is **interoperable** (e.g., usable by Pandoc to create formatted citations/bibliographies) and remains **accessible** long-term.  
4. **Direct Capture with Zotero Connector:** Use the Zotero browser extension to capture citation data and PDFs. BibLib intercepts this data and creates Obsidian notes directly, **bypassing the need for the Zotero application or a separate library sync**. This provides web capture feeding directly into your Obsidian-native system.  
5. **Using Obsidian's Ecosystem:** Because references *are* notes, Obsidian's features work directly:  
   * **Linking:** Use standard \[\[wiki links\]\] to connect ideas or project outlines to source materials.  
   * **Discovery:** Utilize backlinks, tags, search, and graph view to explore connections.  
   * **Querying:** Employ plugins like Dataview to create dynamic lists of your references.  
6. **Integrated PDF Workflow:** Attach PDFs to reference notes. Link directly from annotations in your notes to specific locations within the source PDF using Obsidian's PDF viewer or tools like [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus).  
7. **Direct Output:** BibLib can generate a bibliography.json (CSL-JSON) or a BibTeX file directly from your notes' frontmatter. This file is ready for use with tools like Pandoc, removing manual export steps.

This approach prioritizes **simplicity through integration** and **robustness through open standards and plain text**, creating an integrated research environment within Obsidian.

## **Features**

* **Native Reference Management:** Store and manage bibliographic data as Markdown notes within Obsidian.  
* **Zotero Connector Integration:** Capture citations and PDFs directly from your browser into Obsidian notes (Desktop only).  
  * *No need for Zotero desktop app or database sync.*  
* **CSL-JSON Compatible Storage:** Bibliographic data stored in YAML frontmatter adheres to the CSL-JSON standard.  
* **Flexible Templating System:** Customize note titles, file paths, citekey formats, YAML frontmatter fields, and note body content via templates.  
* **Metadata Auto-Fetch:** Populate bibliographic data using DOI, URL, or ISBN via the Citoid API (parsing via Citation.js).  
* **Supports Various Publication Types:** Handles articles, books, chapters, reports, etc.  
* **Book Chapter Handling:** Create chapter entries that inherit data from parent book notes.  
* **Contributor Management:** Add authors, editors, translators, etc., with appropriate roles.  
* **PDF/EPUB Attachment Options:**  
  * Import files (copy to vault).  
  * Link to existing files within the vault.  
  * Automatic PDF download via Zotero Connector where available.  
* **Bibliography Generation:** Create bibliography.json (CSL-JSON) or export a .bib (BibTeX) file from notes for use with Pandoc or other tools.  
* **YAML Array Support:** Formats YAML arrays (e.g., for authors, keywords) in frontmatter.

> [!IMPORTANT]  
> Obsidian's built-in frontmatter parser currently only supports simple key-value pairs and cannot interpret nested structures (like CSL's author or issued fields). BibLib generates valid YAML and CSL-JSON, but you might see warnings in Obsidian's metadata panel for these nested fields. These warnings do not indicate an error with BibLib or your data; the nested data is stored correctly and usable by external tools like Pandoc. Obsidian simply cannot display or query these specific nested fields natively yet.

## **How to Use**

### **Creating Literature Notes**

1. Open the command palette and select "BibLib: Create Literature Note".  
2. Enter the bibliographic information in the modal:  
   * **Auto-fill option**: Enter a DOI, URL, or ISBN and click "Lookup" to attempt to automatically fill the form using the Citoid API.  
   * Required fields: Citekey, Type, Title, Year (though requirements may vary slightly by Type).  
   * Optional fields depend on the publication type selected.  
3. Add contributors (authors, editors, etc.) using the dedicated section.  
4. Choose an attachment option:  
   * **No attachment**: No file will be linked or imported.  
   * **Import file**: Copies a selected PDF/EPUB to your configured attachment folder (potentially in a subfolder).  
   * **Link to existing file**: Creates a link to a file already present in your vault.  
5. Click "Create Note" to generate the formatted literature note based on your templates and settings.

### **Creating Book Chapter Entries**

1. There are two ways to initiate creating a chapter entry:  
   * Open the command palette and select "BibLib: Create Book Chapter Entry".  
   * While viewing an existing book-type literature note, open the command palette and select "BibLib: Create Chapter From Current Book".  
2. Enter the chapter-specific information:  
   * Required fields: Citekey, Title, Container Book (select from existing book notes), Year.  
3. When you select a container book from the dropdown (which lists notes of type 'book' or 'bookSection'), relevant information is automatically inherited and displayed:  
   * Publisher and publisher place.  
   * Book editors (mapped as container-author in CSL).  
   * Publication year.  
   * The book's attachment (offered as a "link to existing file" option).  
4. Add chapter-specific details:  
   * Chapter author(s).  
   * Page range (page field).  
   * Any other chapter-specific metadata.  
5. Choose an attachment option (similar to standard literature notes). The container book's PDF is suggested if available.  
6. Click "Create Chapter Note" to generate the formatted chapter note.

### **Building a Bibliography**

1. Ensure you have created literature notes for your references.  
2. Open the command palette and select "BibLib: Build Bibliography".  
3. The plugin will perform the following actions based on your settings:  
   * Generate a citekeylist.md file (path configurable) containing a list of all citekey values found in your literature notes.  
   * Create a comprehensive bibliography.json file (path configurable) containing the full CSL-JSON data extracted from the YAML frontmatter of all literature notes.  
4. These files can be used with external tools (like Pandoc for citations) or referenced within your vault.  
5. To export a unified BibTeX file, open the command palette and select "BibLib: Export Bibliography as BibTeX". The output path is configurable in Settings.

### **Using the Zotero Connector (Desktop Only)**

BibLib integrates with the Zotero Connector browser extension for direct capture:

1. In BibLib settings, navigate to the "Zotero Connector Server" section and enable the "Enable Connector Server" option.  
2. Install the [Zotero Connector](https://www.zotero.org/download/connectors) extension for your browser (Chrome, Firefox, Edge, Safari).  
3. **Crucially: Ensure the Zotero desktop application is *NOT running***. BibLib needs to listen on the same communication port (default 23119\) that Zotero normally uses to receive data from the connector. If Zotero is running, it will intercept the data instead of BibLib.  
4. When browsing a webpage containing bibliographic data (e.g., a journal article page, arXiv preprint, book page):  
   * Click the Zotero Connector icon in your browser toolbar.  
   * The connector detects the metadata and sends it to the locally running server (which BibLib is now providing).  
5. BibLib will:  
   * Automatically open the "Create Literature Note" modal within Obsidian, pre-filled with the captured citation data.  
   * If the connector successfully identifies and downloads a PDF, BibLib will automatically select the "Import file" option and pre-fill the path to the downloaded temporary file.  
   * Allow you to review and customize the citekey, type, and other fields before saving.  
   * Create a fully formatted literature note within your vault upon clicking "Create Note".

> [!NOTE]  
> This feature requires Obsidian running on a desktop operating system because it needs permission to run a local web server to listen for the connector. It is not available on mobile versions of Obsidian.

### **Working with PDF Annotations**

BibLib facilitates linking your notes to specific parts of attached PDFs:

1. Attach PDFs to your literature notes during creation or add them later via links.  
2. Open the PDF from the literature note using Obsidian's built-in viewer.  
3. Create highlights or annotations within the PDF viewer.  
4. You can copy references to these annotations (often via a right-click menu in the PDF viewer or sidebar) and paste them into your Markdown notes. This typically creates links like:  
   `[[MyReference2023.pdf#page=12&annotation=ABCDEF123]]`

   or using selection coordinates:  
   `[[AnotherPaper2024.pdf#page=5&selection=10,0,25,50|See discussion on p.5]]`

5. This allows precise linking between your thoughts or summaries and the exact location in the source text. Consider using plugins like [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus) for enhanced PDF interaction features within Obsidian.

## **Settings**

BibLib offers customization options to tailor the workflow:

### **File Paths**

* **Attachment folder path**: Specify the default directory within your vault where imported PDF/EPUB attachments will be stored.  
* **Create subfolder for attachments**: If enabled, creates a subfolder named after the citekey within the attachment folder for each reference's files.  
* **Literature note location**: Specify the default directory where new literature notes (.md files) will be created.  
* **Use prefix for literature notes**: If enabled, adds a prefix to the filename of literature notes.  
* **Literature note prefix**: Define the prefix string (e.g., Lit/, Ref-) to be added if the above option is enabled.

### **Custom Frontmatter Fields & Templating**

BibLib uses a template engine (based on Handlebars syntax) for customizing various aspects of your notes. This allows you to define exactly what fields appear in your YAML frontmatter and how the note itself is structured.

* **Header Template**: Define the template for the main content *above* the frontmatter block (e.g., `## {{title}}`).  
* **Custom Frontmatter Fields**: Manage the fields included in the YAML frontmatter. You can add, edit, reorder, or disable fields. Each field has:  
  * **Field Name**: The key used in the YAML (e.g., status, keywords).  
  * **Template**: A Handlebars template defining the value for that key. Use CSL variables (`{{title}}`, `{{author.0.family}}`) and helpers. Templates starting with `[` and ending with `]` will attempt to parse the content as a YAML array (e.g., `[{{#authors_family}}"[[Author/{{.}}]]"{{^@last}}, {{/@last}}{{/authors_family}}]`).  
  * **Enabled**: Toggle whether this field is included.  
* **Body Template**: Define a template for the content *below* the frontmatter block in newly created notes.

**Template System Basics:**

* Variables: `{{variable}}` (e.g., `{{title}}`, `{{year}}`, `{{DOI}}`). Access nested CSL data using dot notation (e.g., `{{issued.date-parts.0.0}}` for year).  
* Formatting Helpers: `{{variable|format}}` (e.g., `{{title|lowercase}}`). Common formats include uppercase, lowercase, capitalize, sentence. Specific helpers exist for citekeys (see below).  
* Negative Conditional Blocks: `{{^variable}}Content if variable is missing{{/variable}}`
* Positive Conditional Blocks: `{{#variable}}Content if variable is present{{\variable}}`.  
* Available Variables: Includes all standard CSL fields detected for the reference, plus computed fields like `{{authors}}` (formatted string), `{{pdflink}}` (path to linked attachment), `{{currentDate}}`. Arrays like `{{authors_family}}`, `{{authors_given}}`, `{{editor}}` are available for looping.  
* Consult the plugin settings panel for more detailed syntax examples and a list of available formatting helpers.

This system provides **control** over how your reference data is stored and presented.

### **Bibliography Builder**

* **Bibliography JSON path**: Set the vault path (including filename) where the bibliography.json file will be saved.  
* **Citekey list path**: Set the vault path (including filename) where the citekeylist.md file will be saved.  
* **BibTeX file path**: Set the vault path (including filename) where the exported .bib file will be saved.

### **Zotero Connector Server (Desktop Only)**

* **Enable Connector Server**: Toggle the local server on/off. Must be enabled to use the Zotero Connector integration.  
* **Connector Server Port**: The network port the server listens on. Default is 23119, matching Zotero's default. Change only if needed due to port conflicts.  
* **Temporary PDF folder**: A system temporary directory where PDFs downloaded via the connector are initially stored before being imported into the vault. Usually does not need changing.

## **Citekey Generation**

Define automated citekey patterns using the **templating engine**, providing consistent and predictable keys for your references.

* **Citekey Template**: Enter a Handlebars template defining the desired citekey format. Examples:  
  * `{{authors_family.0|lower}}{{year}}` -> smith2023  
  * `{{authors_family.0|lower}}{{year}}{{title|abbr1}}` -> smith2023q (using first letter of first significant title word)  
  * `{{authors_family.0|abbr3}}{{year}}` -> smi2023 (using first 3 letters of first author's last name)  
* **Special Citekey Formatters**: In addition to standard formatters, specific helpers are available for citekey generation:  
  * `|abbrN`: Abbreviate to first N characters (e.g., |abbr3).  
  * `|titleword`: First significant word of the title (lowercase).  
  * `|abbrTitleWordN`: First N letters of the first significant title word.  
  * `|shorttitle`: First few significant words of the title.  
  * (Consult settings for a full list).  

*(Legacy citekey generation options might still be present in settings for backward compatibility but using the template is recommended for flexibility.)*

This template-driven approach provides **consistent citekeys** tailored to your preferences.

## **Upcoming Features**

* Bulk import from existing BibTeX/CSL-JSON files.  
* Export individuals files to various formats.

## **License**

MIT
