# BibLib

BibLib is an Obsidian plugin designed to transform your vault into a powerful, integrated academic reference manager.

## Table of Contents

1.  [Introduction](#introduction)
    *   [What is BibLib?](#what-is-biblib)
    *   [Why CSL-JSON in Frontmatter?](#introduction#why-csl-json-in-frontmatter)
2.  [Installation](#installation)
    *   [Manual Installation](#installation#manual-installation)
    *   [Installation via BRAT](#installation#installation-via-brat)
3.  [Core Concepts](core-concepts)
    *   [Literature Notes](core-concepts-#literature-notes)
    *   [CSL-JSON Metadata](core-concepts-#csl-json-metadata)
    *   [Citekeys](core-concepts-#citekeys)
    *   [Attachments](#attachments)
4.  [Key Features](key-features)
5.  [Usage Guide](usage-guide)
    *   [Creating a Literature Note](#creating-a-literature-note)
    *   [Using Metadata Lookup](#using-metadata-lookup)
    *   [Creating a Book Chapter Note](#creating-a-book-chapter-note)
    *   [Using the Zotero Connector (Desktop)](#using-the-zotero-connector-desktop)
    *   [Bulk Importing References](#bulk-importing-references)
    *   [Linking to References](#linking-to-references)
    *   [Generating Bibliography Files](#generating-bibliography-files)
    *   [Editing References](#editing-references)
    *   [Working with Attachments & PDF Annotations](#working-with-attachments--pdf-annotations)
6.  [Settings](settings)
    *   [General Settings](#general-settings)
    *   [File Path Settings](#file-path-settings)
    *   [Zotero Connector Settings](#zotero-connector-settings-desktop-only)
    *   [Bibliography Builder Settings](#bibliography-builder-settings)
    *   [Note Template Settings](#note-template-settings)
    *   [Citekey Generation Settings](#citekey-generation-settings)
    *   [Bulk Import Settings](#bulk-import-settings)
7.  [Templating System Guide](templating-system-guide)
    *   [Syntax Basics](#syntax-basics)
    *   [Available Variables](#available-variables)
    *   [Formatting Helpers](#formatting-helpers)
    *   [Conditionals](#conditionals)
    *   [Loops](#loops)
    *   [Examples](#examples)
8.  [Troubleshooting & FAQ](troubleshooting-faq)
9.  [License](license)

---

## Introduction

### What is BibLib?

BibLib is an Obsidian plugin that turns your vault into a robust academic reference manager. It stores each reference (paper, book, etc.) as a standard Markdown note. Bibliographic metadata is embedded within the note's YAML frontmatter using the Citation Style Language (CSL) JSON format.

By leveraging CSL – the same open standard used by tools like Pandoc – BibLib ensures your references are portable and ready for automated citation formatting. All your reference data lives in plain text (Markdown and YAML), making it future-proof, version-controllable, and easily searchable within Obsidian.

This approach keeps your reference library **inside Obsidian**, allowing you to link, manage, and connect sources just like any other notes. This is a significant advantage for academics, researchers, and students who desire an integrated knowledge management and writing workflow.

### Why CSL-JSON in Frontmatter?

Storing bibliographic data directly within your notes using the CSL-JSON standard offers several key benefits:

1.  **Open Standard & Interoperability:** CSL JSON is the lingua franca for citation data. Storing references in this format prevents vendor lock-in and ensures compatibility with external tools. You can directly use BibLib's generated bibliography files with citation processors like Pandoc/Citeproc to format citations and bibliographies in thousands of styles automatically.
2.  **Plain-Text Durability & Transparency:** Your entire reference library exists as human-readable Markdown and YAML. This makes it incredibly robust, easy to back up, and accessible even without Obsidian or BibLib. You can track changes using version control (like Git) and easily share references.
3.  **Unified Knowledge Base:** BibLib eliminates the need to constantly switch between a separate reference manager and your note-taking app. References become first-class citizens within your Obsidian vault. You can create links `[[YourReferenceNote]]` directly in your writing, use tags, view backlinks, and leverage Obsidian's powerful search and graph visualization capabilities to uncover connections between your ideas and your sources.
4.  **Pandoc-Ready Bibliography:** BibLib can generate a `bibliography.json` file containing the CSL-JSON data for all your literature notes. This file is directly consumable by Pandoc, allowing you to write manuscripts in Obsidian using simple citation keys (`[@citekey]`) and have Pandoc automatically generate perfectly formatted citations and a reference list in your desired style.
# Installation

> [!NOTE]
> As BibLib is currently awaiting approval for the official Obsidian Community Plugins list, you need to install it manually or using the BRAT plugin.

## Manual Installation

1.  Download the latest release package (`main.js`, `manifest.json`, `styles.css`) from the [Releases page](https://github.com/callumalpass/obsidian-biblib/releases) on GitHub.
2.  Navigate to your Obsidian vault's configuration directory: `<YourVault>/.obsidian/`.
3.  Go into the `plugins` sub-directory.
4.  Create a new folder named `biblib`.
5.  Copy the downloaded `main.js`, `manifest.json`, and `styles.css` files into the `biblib` folder.
6.  Restart Obsidian or reload the app (`Ctrl/Cmd + R`).
7.  Go to `Settings` -> `Community plugins`.
8.  Find "BibLib" in the list of installed plugins and toggle it **on**.

## Installation via BRAT

BRAT (Beta Reviewers Auto-update Tester) is an Obsidian plugin that helps install and update plugins that are not yet in the official community store.

1.  **Install BRAT:**
    *   Go to `Settings` -> `Community plugins` -> `Browse`.
    *   Search for "BRAT" and install it.
    *   Enable the BRAT plugin in the `Community plugins` list.
2.  **Add BibLib Beta:**
    *   Open the BRAT settings (`Settings` -> `Community Plugins` -> `Obsidian42 - BRAT`).
    *   Click on the `Add Beta plugin` button.
    *   Enter the GitHub repository path for BibLib: `callumalpass/obsidian-biblib`.
    *   Click `Add Plugin`. BRAT will download and install BibLib.
3.  **Enable BibLib:**
    *   Go back to `Settings` -> `Community plugins`.
    *   Find "BibLib" and toggle it **on**.

BRAT will also help you keep BibLib updated automatically as new beta versions are released.
# Core Concepts

Understanding these core concepts will help you get the most out of BibLib:

## Literature Notes

In BibLib, every reference (journal article, book, chapter, report, webpage, etc.) is represented as a single Markdown (`.md`) file within your Obsidian vault. This file is referred to as a "Literature Note".

*   **Content:** The body of the Markdown file is yours to use for summaries, critiques, quotes, connections to other notes, or any other analysis related to the reference.
*   **Metadata:** All the bibliographic information (author, title, year, publisher, DOI, etc.) is stored within the YAML frontmatter section at the top of the file.
*   **Filename:** By default, the filename is based on the reference's `citekey`, often prefixed with a character like `@` (e.g., `@Smith2023.md`). This is configurable in the settings.

Because references are standard Obsidian notes, you can link to them (`[[@Smith2023]]`), tag them (`#methodology`), organize them in folders, and view them in the graph like any other piece of knowledge in your vault.

## CSL-JSON Metadata

BibLib stores the bibliographic metadata in the YAML frontmatter using a structure based on the **Citation Style Language JSON (CSL-JSON)** standard. This is an open format designed specifically for citation data.

*   **Structure:** CSL-JSON defines standard field names (e.g., `title`, `author`, `editor`, `issued`, `DOI`, `URL`, `container-title`, `volume`, `page`).
*   **Data Types:** Fields have expected data types. For example, `author` and `editor` are typically arrays of objects, where each object has `family` and `given` name properties. The `issued` field contains date information in a structured `date-parts` format (e.g., `[[YYYY, MM, DD]]`).
*   **Benefits:** Using CSL-JSON ensures:
    *   **Portability:** Your data isn't locked into BibLib; it can be understood by many other academic tools.
    *   **Consistency:** Provides a standardized way to represent diverse reference types.
    *   **Automation:** Enables tools like Pandoc to automatically format citations and bibliographies based on this data.

> [!IMPORTANT]
> Obsidian's native Properties UI currently has limitations displaying nested YAML structures like the `author` array or `issued` date object common in CSL-JSON. You might see warnings like "Invalid YAML". **This is a display limitation in Obsidian, not an error in your data.** The YAML is valid, and the data is stored correctly for BibLib and external tools. View the note in Source Mode to see the raw, correctly structured YAML.

## Citekeys

A **citekey** (or citation key) is a short, unique identifier assigned to each literature note. It serves several purposes:

*   **Filename:** Often used as the base for the literature note's filename (e.g., `Smith2023` becomes `@Smith2023.md`).
*   **Linking:** Used to create links between your notes (`[[@Smith2023]]`).
*   **Citation:** Used in external tools like Pandoc to refer to the reference (`[@Smith2023]`).

BibLib automatically generates citekeys based on patterns you define in the settings (e.g., AuthorYear, AuthorTitleYear). You can override the automatically generated citekey when creating or editing a note. Good citekeys are typically short, memorable, and unique within your library.

## Attachments

BibLib allows you to associate files (typically PDFs or EPUBs) with your literature notes.

*   **Importing:** You can choose to **import** a file. BibLib will copy the file into a designated attachments folder within your vault (configurable in settings) and often rename it based on the citekey.
*   **Linking:** Alternatively, you can **link** to a file that already exists somewhere else in your vault. BibLib will store the path to this file.
*   **Zotero Connector:** When using the Zotero Connector integration, if a PDF is available for the reference, BibLib can automatically download and import it for you.
*   **Access:** The path to the associated attachment is stored in the frontmatter (often accessible via the `{{pdflink}}` template variable) allowing you to easily link to or open the attachment from the literature note.
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
# Usage Guide

This guide provides step-by-step instructions for common BibLib workflows.

## Creating a Literature Note

This is the primary way to add a new reference manually.

1.  **Open the Command Palette:** Press `Ctrl/Cmd + P`.
2.  **Run the Command:** Type "BibLib" and select **"BibLib: Create Literature Note"**.
3.  **The Bibliography Modal Appears:**
    *   **(Optional) Auto-fill:**
        *   **Identifier Lookup:** Enter a DOI, ISBN, PubMed ID, arXiv ID, or URL into the "Auto-lookup" field and click **Lookup**. BibLib will attempt to fetch metadata and fill the form.
        *   **Paste BibTeX:** Paste a full BibTeX entry into the text area under "Auto-fill from BibTeX" and click **Parse BibTeX**.
    *   **Select Type:** Choose the correct reference type (e.g., Journal Article, Book, Web Page) from the "Type" dropdown. This influences which fields are most relevant.
    *   **Fill Core Fields:** Enter the `Title`, `Year`, `Container title` (Journal/Book name), etc.
    *   **Add Contributors:**
        *   Click the "Role" dropdown (defaults to 'author') to select the type (author, editor, translator, etc.).
        *   Enter the `Given Name` and `Family Name`. For institutions or single-field names, use the `Family Name` field and leave `Given Name` blank (or use the `literal` field if adding via code/import).
        *   Click **"Add contributor"** to add more authors, editors, etc.
        *   Click **"Remove"** next to a contributor to delete them.
    *   **Add Additional Fields:**
        *   If you need fields not shown by default (e.g., `language`, `archive`, `call-number`, or custom fields), click **"Add field"**.
        *   Select the field `Type` (Standard, Number, Date).
        *   Choose the `Field name` from the dropdown (includes standard CSL fields) or type a custom name. *A warning appears for non-standard CSL names.*
        *   Enter the `Value`.
    *   **Attach File (Optional):**
        *   Under the "Attachment" section, select:
            *   `Import file`: Click **"Choose file"** to select a PDF/EPUB from your computer. BibLib will copy it into your vault.
            *   `Link to existing file`: Click **"Choose file"** to select a PDF/EPUB already inside your Obsidian vault.
            *   `None`: No attachment.
    *   **Link Related Notes (Optional):**
        *   Click **"Add Related Note"**.
        *   Search for and select existing notes in your vault that relate to this reference.
        *   Selected notes will be listed; click **"Remove"** to unselect. These links can be used in templates (e.g., `{{links}}`).
    *   **Review Citekey:** Check the auto-generated `Citekey` at the bottom. You can edit it manually or click the **Regenerate** icon (🔄) to update it based on current form data (requires Title and Author).
4.  **Create the Note:** Click the **"Create Note"** button.

BibLib will create a new `.md` file (e.g., `@Smith2023.md`) in the location specified in your settings, populate its YAML frontmatter with the CSL-JSON data, add content based on your header/body templates, and potentially open the note if configured.

## Using Metadata Lookup

Quickly populate the "Create Literature Note" modal:

1.  Open the modal (**BibLib: Create Literature Note**).
2.  In the **"Auto-fill"** section at the top:
    *   **By Identifier:** Paste a DOI (e.g., `10.1038/nrn3241`), ISBN, arXiv ID (`arXiv:1910.13461`), or a URL into the "Auto-lookup by identifier" field. Click **Lookup**.
    *   **By BibTeX:** Copy a complete BibTeX entry (e.g., from Google Scholar or a reference manager) and paste it into the larger text area. Click **Parse BibTeX**.
3.  BibLib will fetch/parse the data and fill the relevant fields in the modal below (Title, Authors, Year, Type, etc.).
4.  Review the populated fields, make any necessary corrections or additions (like adding an attachment).
5.  Check the generated `Citekey`.
6.  Click **"Create Note"**.

## Creating a Book Chapter Note

To add a chapter that belongs to a book already present as a literature note:

1.  **Ensure the Book Note Exists:** You must first have a literature note for the parent book (Type: `book` or `collection`).
2.  **Open the Command Palette:** Press `Ctrl/Cmd + P`.
3.  **Run the Command:** Select **"BibLib: Create book chapter entry"**.
    *   **Alternatively:** If you have the *book's* note open and active, run **"BibLib: Create chapter from current book"**. This pre-selects the book.
4.  **The Chapter Modal Appears:**
    *   **Select Book:** Use the "Book" dropdown to choose the parent book note from your vault. The book's path will be displayed below. *If you used the "Create chapter from current book" command, this will be pre-filled.*
    *   **Fill Chapter Details:** Enter the specific `Chapter title`, `Short title` (optional), and `Pages` for the chapter.
    *   **Chapter Citekey:** A default citekey (e.g., `BookCitekey.ch1`) might be suggested. Adjust as needed.
    *   **Chapter Contributors:** Add the *chapter's* authors using the "Add contributor" button. The *book's* editors or authors will be automatically included with the correct CSL roles (`editor`, `container-author`) in the final note's frontmatter – you usually don't need to re-add them here unless they are *also* chapter authors.
    *   **Other Fields:** Fill in chapter-specific DOI, abstract, or override the publication year/month/day if it differs from the book. Fields like Publisher will typically be inherited from the selected book.
    *   **Attachment/Related Notes:** Add attachments or link related notes specific to this chapter.
5.  **Create the Chapter Note:** Click **"Create Chapter Note"**.

BibLib creates a new note (Type: `chapter`) with the chapter's details and links it conceptually to the parent book via fields like `container-title` and potentially `container-author` in the frontmatter.

## Using the Zotero Connector (Desktop)

Import references directly from your browser:

1.  **Setup:**
    *   Go to BibLib Settings (`Settings` -> `Community Plugins` -> `BibLib`).
    *   Under "Zotero Connector", ensure **"Enable Zotero Connector"** is toggled **ON**. Note the `Connector port` (default 23119).
    *   **Crucially: Close the Zotero Desktop application.** BibLib needs to use the same port Zotero normally uses to listen for the connector. They cannot run simultaneously for this feature.
2.  **Importing:**
    *   Browse the web. When you find a journal article, book page, etc., that you want to save, click the Zotero Connector icon in your browser's toolbar (it might look like a 'Z' or a document).
    *   The Zotero Connector will send the citation data (and attempt to find/send a PDF if available) to the BibLib server running inside Obsidian.
    *   Obsidian should come to the foreground, and the **Bibliography Modal** will automatically open, pre-filled with the data received from the connector. The "Auto-fill" section will be collapsed with a notice.
    *   If a PDF was successfully downloaded, the "Attachment" section will show it as an "Import file" ready to be saved to your vault.
3.  **Review and Save:**
    *   Check the pre-filled information. Make any necessary adjustments.
    *   Verify the `Citekey`.
    *   Click **"Create Note"**.

The literature note is created, and the PDF (if any) is imported into your attachment folder.

> **To Stop:** Either disable the toggle in settings or run the command **"BibLib: Toggle Zotero Connector server"**. Remember to re-open Zotero Desktop if you need it.

## Bulk Importing References

Import multiple references from a BibTeX (`.bib`) or CSL-JSON (`.json`) file:

1.  **Prepare Import File:**
    *   Export references from your reference manager (Zotero, Mendeley, etc.) into either BibTeX (`.bib`) or CSL-JSON (`.json`) format.
    *   **For Zotero with Attachments:** When exporting from Zotero as BibTeX, make sure to check the **"Export Files"** option. This creates the `.bib` file *and* a `files` subfolder containing the PDFs. **Crucially, move both the `.bib` file AND the entire `files` folder into your Obsidian vault** before starting the import. BibLib needs them co-located to find the attachments referenced in the BibTeX.
2.  **Run the Command:** Open the Command Palette (`Ctrl/Cmd + P`) and select **"BibLib: Bulk import references"**.
3.  **Configure Import:**
    *   **Choose File:** Click **"Choose File"** and select the `.bib` or `.json` file *from within your vault*. The selected filename will appear.
    *   **Attachment handling:**
        *   `Ignore attachments`: BibLib won't look for or import any files referenced in the import data.
        *   `Import attachments to vault`: BibLib will try to find files referenced in the `file` field of the import data. For BibTeX/Zotero exports, it looks for the standard `files/ID/filename.pdf` structure relative to the `.bib` file's location. It will copy found attachments into your configured BibLib attachment folder.
    *   **Include annotations:** If checked, content from the BibTeX `annote` field will be added to the body of the created literature notes (useful for Zotero notes).
    *   **Citekey preference:**
        *   `Use imported citekeys`: Uses the keys present in the `.bib` or `.json` file as the `id` and filename base.
        *   `Generate new citekeys`: Ignores imported keys and generates new ones based on your BibLib citekey settings.
    *   **Conflict resolution:**
        *   `Skip existing notes`: If a note with the same target citekey already exists, the imported entry is skipped.
        *   `Overwrite existing notes`: If a note with the same target citekey exists, its content will be replaced with the data from the imported entry. **Use with caution!**
4.  **Start Import:** Click **"Start Import"**. A confirmation prompt will appear.
5.  **Confirm:** Click "OK" to proceed.

BibLib will process the file, creating literature notes based on your settings. Progress notices will appear. A final notice summarizes the number of notes created, skipped, and any errors encountered.

## Linking to References

Once literature notes exist, link to them like any other note:

*   **Standard Wikilink:** Type `[[` and start typing the citekey (including any prefix like `@`). Select the note from the suggestions. Example: `[[@Smith2023]]`.
*   **Pandoc Citation Syntax:** For academic writing intended for processing with Pandoc, use the standard Pandoc citation syntax: `[@Smith2023]`. This won't create an Obsidian link but will be correctly interpreted by Pandoc when using the `bibliography.json` or `.bib` file generated by BibLib. You can combine this with wikilinks if desired: `See [[@Smith2023|[@Smith2023]]] for details.`

## Generating Bibliography Files

Create compiled bibliography files for use with external tools or for backup:

1.  **Open the Command Palette:** `Ctrl/Cmd + P`.
2.  **Run Commands:**
    *   **`BibLib: Build bibliography`:** This command scans all literature notes and generates/updates:
        *   `bibliography.json`: A CSL-JSON file containing the metadata for all notes. Path configured in settings. Essential for Pandoc.
        *   `citekeylist.md`: A simple Markdown list of all `@citekey`s. Path configured in settings.
    *   **`BibLib: Export bibliography as BibTeX`:** This command generates/updates:
        *   `bibliography.bib`: A BibTeX file containing data for all notes. Path configured in settings.

Run these commands periodically or before writing/exporting documents that need a bibliography.

## Editing References

Modify bibliographic data directly in the note's frontmatter:

1.  Open the literature note (`.md` file).
2.  Switch to **Source Mode** (use the editor menu or `Ctrl/Cmd + E`).
3.  Edit the values within the YAML block (`--- ... ---`). For example, change the `year`, add a `URL`, or correct an author's name in the `author` array.
    ```yaml
    author:
      - family: Smith
        given: Alice # Corrected spelling
      - family: Jones
        given: Bob
    year: 2024 # Updated year
    URL: https://new-link.example.com # Added URL
    ```
4.  Switch back to Reading or Live Preview mode.

> **Remember:** Obsidian's Properties view might show warnings for nested CSL fields. Rely on Source Mode for accurate editing of complex fields like `author` or `issued`.

# Settings

BibLib's settings allow you to customize its behavior to fit your workflow. Access them via `Settings` -> `Community Plugins` -> `BibLib`.

## General Settings

*   **Literature note tag:**
    *   **Description:** The tag automatically added to the `tags` array in the frontmatter of every created literature note. BibLib uses this tag to identify which notes in your vault are part of your bibliography.
    *   **Default:** `literature_note`
    *   **Usage:** Essential for commands like "Build Bibliography" to find the correct notes. Choose a tag unique to your reference notes.

*   **Open note on create:**
    *   **Description:** If enabled, Obsidian will automatically open the newly created literature note in a new tab or pane after you click "Create Note" in the modal.
    *   **Default:** `true` (Enabled)
    *   **Usage:** Convenient for immediately adding summaries or notes after creating the reference entry. Disable if you prefer to create notes in batches without switching context.

## File Path Settings

These settings control where BibLib saves notes and attachments. Use forward slashes (`/`) for paths.

*   **Attachment folder path:**
    *   **Description:** The primary folder within your vault where imported attachments (PDFs, EPUBs) will be stored. Subfolders may be created inside this path based on the next setting.
    *   **Default:** `biblib`
    *   **Usage:** Choose a dedicated folder for your reference attachments (e.g., `attachments/references`, `resources/pdfs`).

*   **Create subfolder for attachments:**
    *   **Description:** If enabled, BibLib will create a subfolder named after the reference's `citekey` inside the main "Attachment folder path". The imported attachment will be placed inside this subfolder (e.g., `biblib/Smith2023/Smith2023.pdf`). If disabled, attachments are placed directly in the main attachment folder.
    *   **Default:** `true` (Enabled)
    *   **Usage:** Helps keep attachments organized, especially if you have many references. Disable for a flatter structure.

*   **Literature note location:**
    *   **Description:** The folder within your vault where new literature note (`.md`) files will be created. Use `/` for the vault root.
    *   **Default:** `/` (Vault root)
    *   **Usage:** Specify a folder like `References/` or `Sources/` to keep all literature notes together. Ensure the path ends with a `/` unless it's the root (`/`).

*   **Use prefix for literature notes:**
    *   **Description:** If enabled, the string defined in "Literature note prefix" will be added to the beginning of the filename for every new literature note.
    *   **Default:** `true` (Enabled)
    *   **Usage:** Helps distinguish literature notes visually in file explorers and links (e.g., `@Smith2023.md`). Disable if you prefer filenames based only on the citekey (e.g., `Smith2023.md`).

*   **Literature note prefix:**
    *   **Description:** The prefix string to use if "Use prefix" is enabled. This field is disabled if the toggle above is off.
    *   **Default:** `@`
    *   **Usage:** Common prefixes include `@`, `Ref-`, `Lit-`. Choose characters allowed in filenames.

## Zotero Connector Settings (Desktop Only)

Configure the integration with the Zotero browser connector. This feature requires Node.js and is only available on the desktop version of Obsidian.

*   **Enable Zotero Connector:**
    *   **Description:** Starts or stops the local HTTP server inside Obsidian that listens for data from the Zotero browser extension. **The Zotero Desktop application must be closed** for this server to start successfully, as they use the same default port. Once BibLib's server has started, Zotero can be re-opened. 
    *   **Default:** `false` (Disabled)
    *   **Usage:** Toggle ON to enable the integration. Toggle OFF to disable it (allowing Zotero Desktop to run normally). You can also toggle this using the command **"BibLib: Toggle Zotero Connector server"**.

*   **Connector port:**
    *   **Description:** The network port the local server listens on.
    *   **Default:** `23119`
    *   **Usage:** Should only be changed if port 23119 is already in use by another application on your system (and you cannot close that application). The Zotero browser connector expects to connect on this port.

*   **Temporary PDF folder:**
    *   **Description:** Optional. Specify a custom *system* path where PDFs downloaded via the connector should be temporarily stored before being imported into the Obsidian vault. If left empty, the system's default temporary directory is used.
    *   **Default:** (Empty - uses system temp)
    *   **Usage:** Generally, leave this empty unless you have specific reasons or permissions issues with the default system temporary folder. This is *not* a path inside your vault.

## Bibliography Builder Settings

Configure the output paths for files generated by the "Build Bibliography" and "Export BibTeX" commands. Paths are relative to the vault root.

*   **Bibliography JSON path:**
    *   **Description:** The full path, including filename, where the compiled CSL-JSON bibliography file will be saved.
    *   **Default:** `biblib/bibliography.json`
    *   **Usage:** This file is essential for use with tools like Pandoc.

*   **Citekey list path:**
    *   **Description:** The full path, including filename, where the Markdown list of all citekeys (prefixed, e.g., `@Smith2023`) will be saved.
    *   **Default:** `citekeylist.md`
    *   **Usage:** Useful for quick reference or autocompletion setups.

*   **BibTeX file path:**
    *   **Description:** The full path, including filename, where the exported BibTeX (`.bib`) file will be saved.
    *   **Default:** `biblib/bibliography.bib`
    *   **Usage:** For compatibility with LaTeX/BibTeX workflows or other tools that prefer `.bib` files.

## Note Template Settings

Customize the structure and content of newly created literature notes using BibLib's templating system. See the [Templating System Guide](#templating-system-guide) for full syntax details.

*   **Template System Guide:** An expandable section providing a comprehensive overview of the template syntax, available variables (like `{{title}}`, `{{authors}}`, `{{DOI}}`, `{{pdflink}}`), formatting options (`|lowercase`, `|abbr3`, `|date`), conditionals (`{{#variable}}...{{/variable}}`), and loops (`{{#array}}...{{/array}}`). Includes examples for headers, custom fields, and citekeys.

*   **Header template:**
    *   **Description:** Defines the Markdown content that appears at the very top of a new literature note, *above* the YAML frontmatter block. Uses the template engine.
    *   **Default:** `# [[{{pdflink}}]]{{^pdflink}}{{title}}{{/pdflink}}` (Creates a linked H1 heading using the PDF link if available, otherwise just the title).
    *   **Usage:** Customize the main heading. You might add the year `{{year}}` or authors `{{authors}}`. A reset button restores the default.

*   **Custom frontmatter fields:**
    *   **Description:** Define additional fields to be included in the YAML frontmatter beyond the core CSL data automatically added by BibLib. Each field uses the template engine for its value.
    *   **Interface:**
        *   A list of currently defined custom fields is shown.
        *   Each row has:
            *   **Toggle:** Enable/disable this field without deleting it.
            *   **Field name:** The key that will appear in the YAML (e.g., `status`, `reading_notes`, `aliases`). Use simple, lowercase names.
            *   **Template:** The template string whose rendered output will be the value for the field name (e.g., `to-read`, `[[Notes/{{citekey}}]]`, `["{{title|sentence}}", "{{citekey}}"]`).
            *   **Delete button (Trash icon):** Permanently remove this custom field definition.
        *   **"Add Field" button:** Adds a new row to define another custom field.
    *   **Defaults:** Includes pre-defined examples for fields like `year`, `dateCreated`, `status`, `aliases`, `author-links`, `attachment`, `keyword`, `related`. You can modify or delete these.
    *   **YAML Arrays/Objects:** If a template starts with `[` and ends with `]` (or `{` and `}`), BibLib attempts to parse the rendered output as JSON. This is crucial for creating proper YAML lists (e.g., for `aliases` or `tags`). Use syntax like `[{{#authors_family}}"[[Author/{{.}}]]"{{^@first}},{{/@first}}{{/authors_family}}]` to generate valid lists from loops.
    *   **Guide:** An expandable "Custom Frontmatter Fields Guide" provides detailed usage notes, warnings about CSL compatibility, examples for common use cases (aliases, author links, status tracking), and tips for creating YAML arrays.

## Citekey Generation Settings

Configure how the unique `citekey` (used for filenames and linking) is automatically generated.

*   **Citekey Generation Guide:** An expandable section explaining the purpose of citekeys and providing common format examples using the template system.

*   **Citekey template:**
    *   **Description:** The primary method for defining citekey formats. Uses the same template engine as other settings. If this field is *not empty*, it overrides the "Legacy" options below.
    *   **Default:** `{{author|lowercase}}{{title|titleword}}{{year}}` (e.g., `smithquantum2023`)
    *   **Syntax:** Use variables like `{{author}}`, `{{authors_family.0}}`, `{{year}}`, `{{title}}` combined with formatters like `|lowercase`, `|abbr3`, `|titleword`. Output is automatically sanitized (only letters and numbers kept).
    *   **Usage:** Define your preferred citation key style here. Leaving this *empty* enables the legacy options below.

*   **Legacy citekey generation:**
    *   **Description:** These options provide a simpler way to configure citekeys and are **only used if the "Citekey template" field above is empty.**
    *   **Settings:**
        *   **Author name format:** Choose how the first author's last name is abbreviated (`full`, `firstThree`, `firstFour`).
        *   **Include multiple authors:** Toggle whether to include subsequent authors.
        *   **(If multiple authors enabled):**
            *   **Two-author style:** How to format for exactly two authors (`And` or `Initial` of second).
            *   **Maximum authors:** How many authors to include before potentially using "EtAl".
            *   **Use "EtAl" suffix:** Add "EtAl" if authors exceed the maximum.
        *   **Author-year delimiter:** Character(s) placed between the author part and the year part (e.g., `_` for `Smith_2023`). Default is none.
        *   **Use Zotero keys (if available):** **Important legacy option.** If importing from Zotero (e.g., via bulk import or potentially the connector) and this is ON, BibLib will prioritize using the key provided by Zotero instead of generating one using the other legacy rules. *Note: This setting is ignored if a "Citekey template" is defined above.*
        *   **Minimum citekey length:** Add a random numeric suffix if the generated key is shorter than this.
        *   **Short citekey delimiter:** Character(s) placed before the random suffix for short keys.

## Bulk Import Settings

Configure default behaviors for the "Bulk import references" command. These can be overridden in the bulk import modal itself.

*   **Attachment handling:**
    *   **Description:** Default choice for how to handle files referenced in imported `.bib` or `.json` files.
    *   **Options:** `Ignore attachments`, `Import attachments to vault`.
    *   **Default:** `none`

*   **Include annotations in note body:**
    *   **Description:** Default setting for whether content from the BibTeX `annote` field should be added to the body of created notes.
    *   **Default:** `true`

*   **Citekey preference:**
    *   **Description:** Default choice for whether to use citekeys from the import file or generate new ones based on BibLib settings.
    *   **Options:** `Use imported citekeys`, `Generate new citekeys`.
    *   **Default:** `imported`

*   **Conflict resolution:**
    *   **Description:** Default action to take when a literature note with the same target citekey already exists during bulk import.
    *   **Options:** `Skip existing notes`, `Overwrite existing notes`.
    *   **Default:** `skip`
# Templating System Guide

BibLib uses a unified template engine based on Handlebars/Mustache syntax for customizing citekeys, note headers, and custom frontmatter fields. This provides powerful control over how your reference data is formatted and stored.

## Syntax Basics

*   **Variables:** Replace placeholders with data.
    *   Syntax: `{{variableName}}`
    *   Example: `{{title}}` inserts the reference's title.
    *   Nested Data: Use dot notation for nested CSL fields: `{{issued.date-parts.0.0}}` (for year).
*   **Formatters (Pipes):** Modify the output of a variable.
    *   Syntax: `{{variableName|formatterName}}`
    *   Example: `{{title|lowercase}}` inserts the title in all lowercase.
    *   Multiple formatters can be chained (though rarely needed): `{{author|lowercase|abbr3}}`.
*   **Conditionals:** Show content based on whether a variable exists (is "truthy" - not null, undefined, false, empty string, or empty array).
    *   **Positive:** `{{#variableName}}Content to show if variableName exists{{/variableName}}`
    *   **Negative:** `{{^variableName}}Content to show if variableName is missing or falsy{{/variableName}}`
    *   Example: `{{#DOI}}DOI: {{DOI}}{{/DOI}}{{^DOI}}No DOI found{{/DOI}}`
*   **Loops (Iteration):** Iterate over arrays (like authors, editors).
    *   Syntax: `{{#arrayName}}Content for each item{{/arrayName}}`
    *   Inside the loop:
        *   `{{.}}`: Represents the current item in the array.
        *   `{{@index}}`: 0-based index of the current item.
        *   `{{@number}}`: 1-based index (1, 2, 3...).
        *   `{{@first}}`: `true` if this is the first item, `false` otherwise.
        *   `{{@last}}`: `true` if this is the last item, `false` otherwise.
        *   `{{@odd}}`: `true` if `@index` is odd.
        *   `{{@even}}`: `true` if `@index` is even.
        *   `{{@length}}`: Total number of items in the array.
    *   Example: `Authors: {{#authors_family}}{{.}}{{^@last}}, {{/@last}}{{/authors_family}}` (Outputs: "Authors: Smith, Jones, Lee")

## Available Variables

When rendering a template, BibLib makes the following data available:

*   **All CSL Fields:** Every field present in the reference's CSL-JSON data is directly accessible (e.g., `{{title}}`, `{{DOI}}`, `{{URL}}`, `{{container-title}}`, `{{volume}}`, `{{page}}`, `{{publisher}}`, `{{abstract}}`, `{{language}}`). Remember that CSL field names are often lowercase and hyphenated. Acronyms like `DOI`, `URL`, `ISBN`, `ISSN`, `PMID`, `PMCID` are exceptions, stored in uppercase.
*   **Citekey:** `{{citekey}}` (The final, unique ID used for the note).
*   **Date Parts:**
    *   `{{year}}`, `{{month}}`, `{{day}}` (Simple numeric representations extracted from the `issued` date).
    *   `{{issued}}` (The full CSL date object, e.g., `{{issued.date-parts.0.0}}` for year). Access other date fields similarly (`accessed`, `event-date`, etc.).
*   **Contributors (Processed):**
    *   `{{authors}}`: A formatted string for the primary authors (e.g., "A. Smith et al.").
    *   `{{authors_raw}}`: Array of raw author objects (each with `family`, `given`, `literal`).
    *   `{{authors_family}}`: Array of author last names only.
    *   `{{authors_given}}`: Array of author first names only.
    *   *Similar variables exist for other roles*: `{{editors}}`, `{{editors_raw}}`, `{{editors_family}}`, `{{translators}}`, etc., based on roles present in the reference.
*   **Attachment:**
    *   `{{pdflink}}`: The vault path to the primary linked/imported attachment (e.g., `biblib/attachments/Smith2023/Smith2023.pdf`). Empty string if no attachment.
    *   `{{attachment}}`: A pre-formatted Obsidian wikilink to the attachment (e.g., `[[path/to/file.pdf|PDF]]`). Empty string if no attachment.
    *   `{{raw_pdflink}}`: Same as `{{pdflink}}`.
    *   `{{quoted_attachment}}`: The `{{attachment}}` string wrapped in double quotes (`"[[...]]"`), useful for placing links inside YAML arrays. Empty string if no attachment.
*   **Related Notes:** (Available if notes were linked in the creation modal)
    *   `{{links}}`: An array of pre-formatted Obsidian wikilinks to the related notes (e.g., `["[[Note A]]", "[[Folder/Note B]]"]`).
    *   `{{linkPaths}}`: An array of the raw file paths for the related notes (e.g., `["Note A.md", "Folder/Note B.md"]`).
    *   `{{links_string}}`: A single string containing all wikilinks, separated by ", " (e.g., `"[[Note A]], [[Folder/Note B]]"`).
*   **Current Date:** `{{currentDate}}` (Today's date in YYYY-MM-DD format).
*   **Annotation Content (Bulk Import Only):** `{{annote_content}}` (Content from the BibTeX `annote` field, potentially joined from multiple fields).

## Formatting Helpers (Pipes `|`)

Apply these after a variable name to modify its output:

*   `|upper` or `|uppercase`: Convert text to ALL UPPERCASE.
*   `|lower` or `|lowercase`: Convert text to all lowercase.
*   `|capitalize`: Convert text to Title Case (Capitalize First Letter Of Each Word).
*   `|sentence`: Capitalize only the first letter of the string.
*   `|json`: Format the variable's value as a JSON string (useful for complex objects/arrays in templates).
*   `|count`: If the variable is an array, output the number of items. Outputs `0` otherwise.
*   `|date`: Attempt to format the value as a localized date string (e.g., "10/15/2023"). Works best with standard date strings or numbers.
*   `|randN` or `|rand(N)`: Generate a random alphanumeric string of length N (e.g., `|rand5` gives 5 random characters). Default length is 5 if N is omitted. *Note: This formatter doesn't actually use the variable it's attached to; you can use it like `{{anyVariable|rand5}}` or even just `{{rand|5}}` in some contexts.*

**Citekey-Specific Formatters:** These are particularly useful within the "Citekey template" setting:

*   `|abbrN`: Abbreviate the string to its first N characters (e.g., `{{author|abbr3}}` -> "Smi").
*   `|titleword`: Extract the first "significant" word from a title (removes common stop words like "a", "the", "in", lowercases, and sanitizes).
*   `|shorttitle`: Extract the first 3 "significant" words from a title (concatenated, lowercased, sanitized).

## Conditionals (`{{#var}}`, `{{^var}}`)

Control template sections based on data presence:

*   `{{#DOI}}DOI: {{DOI}}{{/DOI}}`: Only shows "DOI: ..." if the `DOI` field exists and has a value.
*   `{{^pdflink}} (No PDF attached){{/pdflink}}`: Shows the message only if `pdflink` is empty or missing.
*   Conditionals work with boolean `true`/`false` values as well.

## Loops (`{{#array}}...{{/array}}`)

Iterate over arrays like `authors_raw`, `editors_family`, `tags`, or custom array fields:

*   **List Authors:**
    ```hbs
    Authors:
    {{#authors_raw}}
    - {{given}} {{family}} ({{@number}})
    {{/authors_raw}}
    ```
*   **Comma-Separated List:**
    ```hbs
    Keywords: {{#keyword}}{{.}}{{^@last}}, {{/@last}}{{/keyword}}
    ```
*   **Conditional Formatting in Loops:**
    ```hbs
    {{#authors_raw}}
      {{family}}{{#given}}, {{given}}{{/given}}{{#@last}} (Last Author){{/@last}}{{^@last}}; {{/@last}}
    {{/authors_raw}}
    ```

## Examples

**Header Template:**

*   `# {{title}} ({{year}})` -> "# Quantum Computing Basics (2023)"
*   `## {{#pdflink}}[[{{pdflink}}|PDF]] - {{/pdflink}}{{title}}` -> "## [[path/file.pdf|PDF]] - Quantum Computing Basics" (if PDF exists) OR "## Quantum Computing Basics" (if no PDF)
*   `{{citekey}}: {{title}}` -> "Smith2023: Quantum Computing Basics"

**Custom Frontmatter Fields:**

*   **Field Name:** `aliases`
    *   **Template:** `["{{title|sentence}}", "{{citekey}}"]`
    *   **Output YAML:** `aliases: ["Quantum computing basics", "Smith2023QuantumComputing"]`
*   **Field Name:** `author_links`
    *   **Template:** `[{{#authors_family}}"[[Authors/{{.}}]]"{{^@last}},{{/@last}}{{/authors_family}}]`
    *   **Output YAML:** `author_links: ["[[Authors/Smith]]", "[[Authors/Jones]]"]`
*   **Field Name:** `status`
    *   **Template:** `to-read`
    *   **Output YAML:** `status: to-read`
*   **Field Name:** `summary_note`
    *   **Template:** `[[Notes/{{citekey}} - Summary]]`
    *   **Output YAML:** `summary_note: "[[Notes/Smith2023QuantumComputing - Summary]]"`
*   **Field Name:** `full_citation`
    *   **Template:** `{{authors}} ({{year}}). {{title}}. *{{container-title}}*, {{volume}}{{#issue}}({{issue}}){{/issue}}, {{page}}. {{#DOI}}doi:{{DOI}}{{/DOI}}`
    *   **Output YAML:** `full_citation: Smith, A. et al. (2023). A Primer on Quantum Computing Algorithms. *Journal of Theoretical Physics*, 42(4), 123-145. doi:10.1234/jtp.2023.5678`

**Citekey Template:**

*   `{{author|lowercase}}{{year}}` -> `smith2023`
*   `{{authors_family.0|abbr3}}{{year}}` -> `smi2023`
*   `{{authors_family.0|lower}}{{year}}{{title|titleword}}` -> `smith2023quantum`
*   `Auth{{authors_family.0|abbr1}}{{authors_family.1|abbr1}}{{year}}` -> `AuthSJ2023` (For Smith and Jones)
*   `{{citekey|upper}}` -> `SMITH2023QUANTUMCOMPUTING` (Uses the *already generated* citekey and uppercases it - less common use case)
# Troubleshooting & FAQ

**Q: Why do I see "Invalid YAML" warnings in the Obsidian Properties panel for my literature notes?**

**A:** This is expected behavior due to limitations in Obsidian's current native metadata parser. It struggles to display or query deeply nested YAML structures, which are common and necessary in the CSL-JSON format used by BibLib (e.g., the `author` array of objects, or the `issued` date object).

**Your data is safe and correctly formatted according to YAML and CSL-JSON standards.** BibLib and external tools like Pandoc can read and use this data perfectly. The warning is purely a display issue within Obsidian's Properties UI. To view or edit the complex fields accurately, switch the note to **Source Mode**.

**Q: The Zotero Connector integration isn't working.**

**A:** Check the following:
1.  **Desktop Only:** This feature only works on Obsidian Desktop (Windows, macOS, Linux) because it requires Node.js APIs to run the local server. It will not work on mobile.
2.  **Server Enabled:** Go to BibLib settings and ensure "Enable Zotero Connector" is toggled ON.
3.  **Zotero Desktop Closed:** The Zotero Desktop application **must be completely closed** (not just minimized). BibLib needs to use the same network port (default 23119) that Zotero normally listens on. Once BibLib starts its server, Zotero can be reopened, but BibLib will receive data from the Connector.
4.  **Port Conflict:** Is another application using port 23119? Try changing the "Connector port" in BibLib settings to something different (e.g., 23120) and *also configure the Zotero browser connector* to use that same new port (this usually requires advanced configuration in the connector or browser, consult Zotero documentation). Sticking to the default 23119 and ensuring Zotero is closed is usually easier.
5.  **Browser Extension:** Ensure you have the official Zotero Connector browser extension installed and enabled in your browser.
6.  **Firewall:** Check if a firewall on your computer is blocking connections to the port BibLib is listening on (default 23119).


**Q: My custom frontmatter template for an array isn't creating a proper YAML list.**

**A:** To create a true YAML list (which Dataview and other tools can parse correctly), ensure your template:
1.  **Starts with `[` and ends with `]`**.
2.  **Properly quotes items** that contain spaces or special characters (like wikilinks). Use double quotes: `"[[Link Here]]"`.
3.  **Uses commas correctly between items**, especially within loops. Use `{{^@first}},{{/@first}}` *before* the item inside a loop to add commas except before the very first item.
    *   *Correct Example:* `[{{#authors_family}}{{^@first}},{{/@first}}"[[Authors/{{.}}]]"{{/authors_family}}]`
    *   *Incorrect Example (Missing quotes/commas):* `[[[Authors/{{.}}]] ]`

**Q: Attachments aren't being found during Bulk Import.**

**A:**
1.  **Zotero Export:** If importing from a Zotero BibTeX export, ensure you selected **"Export Files"** when exporting from Zotero.
2.  **File Location:** The `.bib` file *and* the associated `files` folder (created by Zotero during export) **must both be located inside your Obsidian vault** *before* you start the bulk import. BibLib looks for attachments relative to the `.bib` file's location using the paths stored within it (e.g., `files/12345/document.pdf`).
3.  **Attachment Handling Setting:** Ensure "Attachment handling" is set to `Import attachments to vault` in the Bulk Import modal (or in the plugin settings for the default).
4.  **File Paths in Source:** Check the `file` field within your `.bib` or `.json` file. Does the path accurately reflect where the file *will be* relative to the import file *within your vault*? Absolute paths from your computer's filesystem (e.g., `C:\Users\...`) will not work unless that exact path is somehow accessible *from within* the Obsidian environment (highly unlikely).

**Q: My citekeys look strange or aren't following my template.**

**A:**
1.  **Template vs. Legacy:** Check the "Citekey template" setting. If it has *any* text in it, BibLib uses the template engine. If it's *completely empty*, BibLib uses the "Legacy citekey generation" options below it. Make sure you are configuring the correct section based on whether the template field is empty or not.
2.  **Template Syntax:** If using the template, double-check your syntax. Are variable names correct (`{{author}}`, `{{year}}`, `{{title}}` etc.)? Are formatters spelled correctly (`|lowercase`, `|abbr3`, `|titleword`)?
3.  **Available Data:** The citekey generation depends on the data available *at the time of creation*. If you generate a citekey before filling in the author or year, the template might produce unexpected results. Use the regenerate button (🔄) in the modal after filling fields.
4.  **Sanitization:** Remember that template output for citekeys is automatically sanitized to include only letters and numbers (`a-zA-Z0-9`). Hyphens or other characters will be removed.

**Q: How do I edit complex CSL fields like authors?**

**A:** Open the literature note in **Source Mode** (`Ctrl/Cmd + E` toggles). Edit the YAML directly. For authors, it's an array of objects:
```yaml
author:
  - family: Smith
    given: Alice
  - family: Jones
    given: Bob P. # Added middle initial
```

For dates, use the `issued` field with `date-parts`

```yaml
issued:
  date-parts:
    - [2024, 5, 13] 
```

