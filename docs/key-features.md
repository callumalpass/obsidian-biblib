# Key Features

BibLib integrates reference management into your Obsidian workflow. Here are its key capabilities:

*   **CSL-JSON Metadata in YAML:** Stores bibliographic details (authors, title, year, DOI, etc.) in YAML frontmatter using the CSL-JSON standard. Ensures data portability and compatibility with citation tools like Pandoc.
    ```yaml
    ---
    id: Smith2023QuantumComputing
    type: article-journal
    title: A Primer on Quantum Computing Algorithms
    author:
      - family: Smith
        given: Alice
      - family: Jones
        given: Bob
    issued:
      date-parts:
        - [2023, 10, 15]
    container-title: Journal of Theoretical Physics
    volume: 42
    issue: 4
    page: 123-145
    DOI: 10.1234/jtp.2023.5678
    tags:
      - literature_note
      - quantum_computing
      - methodology
    pdflink: biblib/attachments/Smith2023QuantumComputing/Smith2023QuantumComputing.pdf
    ---
    ```

*   **Native Obsidian Storage:** Each reference *is* an Obsidian Markdown note (`.md`). No external databases or libraries are required. Manage references using standard Obsidian features: linking, tagging, folders, search, graph view.

*   **Zotero Connector Integration (Desktop Only):** Intercepts saves from the Zotero browser connector. Click the Zotero icon in your browser, and BibLib opens a pre-filled modal in Obsidian to create the literature note instantly. Automatically downloads and attaches PDFs if available. *(Requires the BibLib connector server to be enabled in settings and the Zotero desktop app to be closed. Zotero can be re-opened once you've established a connection between BibLib and the Connector).*

*   **Flexible Templating System:** Customize literature note creation using a template engine (Handlebars-based syntax). Define:
    *   **Citekey patterns:** Automatically generate consistent citekeys (e.g., `AuthorYear`, `AuthorYearTitleWord`).
    *   **Header templates:** Control the content and formatting appearing *above* the YAML frontmatter.
    *   **Custom frontmatter fields:** Add your own metadata fields (e.g., `status: to-read`, `project: Thesis`) with templated values.
    *   **Body templates:** Define default content *below* the YAML frontmatter for new notes.

*   **Metadata Lookup (DOI/ISBN/URL):** Auto-fill reference details by providing an identifier. BibLib fetches data from online sources (Citoid API via Citation.js, querying Crossref, DataCite, etc.) saving manual entry and reducing errors. Supports parsing pasted BibTeX entries directly in the modal.

*   **Comprehensive Reference Type Support:** Handles all standard CSL types (journal articles, books, chapters, reports, webpages, theses, patents, etc.). The input form adapts to show relevant fields for the selected type. Special support for book chapters, inheriting details from the parent book note.

*   **Attachment Management:**
    *   **Import:** Copy external PDF/EPUB files into a designated vault folder, typically organized by citekey.
    *   **Link:** Reference PDF/EPUB files already existing within your vault.
    *   **Auto-Attach (Zotero):** Automatically imports PDFs captured by the Zotero Connector.
    *   The attachment path is stored in the frontmatter, easily accessible via the `{{pdflink}}` template variable for linking (`[[{{pdflink}}]]`).

*   **Deep Obsidian Integration:**
    *   **Linking:** Create wiki-links (`[[@citekey]]`) to reference sources within your notes.
    *   **Backlinks/Graph View:** Visualize connections between your ideas and the literature.
    *   **Search & Dataview:** Query your reference metadata using Obsidian's search or the Dataview plugin (e.g., `LIST FROM #literature_note WHERE author.family = "Smith"`). *Note: Dataview querying of nested CSL fields like `author` requires specific syntax.*
    *   **Tagging & Folders:** Organize references using standard Obsidian methods.

*   **Export to BibTeX & CSL-JSON:** Generate `bibliography.bib` (BibTeX) or `bibliography.json` (CSL-JSON) files containing data from all your literature notes. Essential for use with external tools like Pandoc, LaTeX, or sharing with collaborators. Also generates a simple `citekeylist.md` for quick reference.

*   **Bulk Import (BibTeX/CSL-JSON):** Import entire libraries from `.bib` or `.json` files. Handles attachments (if co-located according to Zotero export structure or referenced by path within the vault) and Zotero annotation fields (`annote`). Configurable options for handling citekey conflicts and preferences.

*   **PDF Annotation Linking:** Works well with Obsidian's PDF viewer and annotation tools (like PDF++). Copy links to highlights or comments in your attached PDFs and paste them into your literature note to create direct connections between your notes/analysis and the source text.
