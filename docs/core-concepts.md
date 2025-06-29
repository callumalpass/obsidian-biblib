# Core Concepts

This section explains the main components of BibLib.

## Literature Notes

A "Literature Note" is a standard Markdown (`.md`) file in your Obsidian vault that represents a single reference (e.g., a journal article, book, or report).

*   **Content:** The body of the Markdown file can be used for notes, summaries, or analysis of the reference.
*   **Metadata:** Bibliographic information (author, title, year, etc.) is stored in the YAML frontmatter of the file.
*   **Filename:** The filename for a literature note is generated from a template defined in the settings. The default is `@{{citekey}}`.

Since literature notes are regular Obsidian notes, they can be linked, tagged, and organized in folders like any other note.

## CSL-JSON Metadata

BibLib uses the **Citation Style Language JSON (CSL-JSON)** standard to structure the bibliographic metadata in the YAML frontmatter. CSL-JSON is an open format for citation data.

*   **Structure:** It defines standard field names for bibliographic data (e.g., `title`, `author`, `issued`, `DOI`).
*   **Data Types:** Fields have specific data types. For instance, `author` is an array of objects, with each object containing `family` and `given` name properties.

Using CSL-JSON ensures that the reference data is portable and can be used with other academic tools.

!!! warning "YAML Display in Obsidian"
    Obsidian's native Properties UI may not correctly display nested YAML structures like the `author` array in CSL-JSON. This is a display limitation and does not affect the validity of the data. The raw YAML can be viewed in Source Mode.

## Citekeys

A **citekey** is a unique identifier for each literature note. It is used for:

*   **Filenames:** As a variable in the filename template.
*   **Linking:** To create links between notes (e.g., `[[@Smith2023]]`).
*   **Citations:** In external tools like Pandoc (e.g., `[@Smith2023]`).

Citekeys are automatically generated based on a template that can be customized in the settings.

## Attachments

BibLib can manage file attachments (such as PDFs) for your literature notes.

*   **Importing:** You can import a file, and BibLib will copy it to a designated attachments folder in your vault.
*   **Linking:** You can link to a file that already exists within your vault.
*   **Zotero Connector:** The Zotero Connector integration can automatically import PDFs when available.

The path to the attachment is stored in the frontmatter of the literature note.