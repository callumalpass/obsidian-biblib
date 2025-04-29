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
