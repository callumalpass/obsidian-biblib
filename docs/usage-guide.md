# Usage Guide

This guide provides instructions for using the main features of BibLib.

## Creating a Literature Note

1.  Open the Command Palette (`Ctrl/Cmd + P`).
2.  Run the command **"BibLib: Create Literature Note"**.
3.  In the modal, you can fill the fields manually or use the auto-fill options:
    *   **Identifier Lookup:** Enter a DOI, ISBN, PubMed ID, arXiv ID, or URL and click **Lookup**.
    *   **Paste BibTeX:** Paste a BibTeX entry and click **Parse BibTeX**.
4.  Select the reference **Type** (e.g., Journal Article, Book).
5.  Add contributors (authors, editors) and any other required fields.
6.  Optionally, add attachments or link to related notes.
7.  Review the generated **Citekey** and click **"Create Note"**.

## Editing a Literature Note

1.  Open the literature note you want to edit.
2.  Open the Command Palette and run **"BibLib: Edit Literature Note"**.
3.  The edit modal will appear, pre-filled with the note's current data.
4.  Make your changes and click **"Save"**.
5.  You can also choose to regenerate the citekey, update templated frontmatter, or regenerate the note body.

## Creating a Book Chapter Note

1.  Ensure a literature note for the parent book already exists.
2.  Run the command **"BibLib: Create book chapter entry"**.
3.  In the modal, select the parent book from the dropdown.
4.  Fill in the chapter-specific details (title, pages, authors).
5.  Click **"Create Chapter Note"**.

If the book's note is currently open, you can run **"BibLib: Create chapter from current book"** to pre-select the book.

## Using the Zotero Connector (Desktop Only)

1.  In BibLib's settings, enable the **"Zotero Connector"**.
2.  **Close the Zotero desktop application**, as it uses the same port.
3.  In your web browser, click the Zotero Connector button to save a reference.
4.  The "Create Literature Note" modal will open in Obsidian, pre-filled with the reference data.
5.  Review the information and click **"Create Note"**.

To disable the integration, toggle the setting off or run the command **"BibLib: Toggle Zotero Connector server"**.

## Bulk Importing References

1.  Export references from your reference manager in BibTeX (`.bib`) or CSL-JSON (`.json`) format.
    *   If exporting from Zotero with attachments, select **"Export Files"** and place both the `.bib` file and the `files` folder inside your Obsidian vault.
2.  Run the command **"BibLib: Bulk import references"**.
3.  In the modal, choose the file to import and configure the import options:
    *   **Attachment handling:** Choose whether to ignore or import attachments.
    *   **Citekey preference:** Use the keys from the import file or generate new ones.
    *   **Conflict resolution:** Skip or overwrite existing notes with the same citekey.
4.  Click **"Start Import"**.

## Generating Bibliography Files

To use your references with external tools, you can generate bibliography files.

*   **`BibLib: Build bibliography`**: This command creates a CSL-JSON file (`bibliography.json`) and a Markdown list of citekeys (`citekeylist.md`).
*   **`BibLib: Export bibliography as BibTeX`**: This command creates a BibTeX file (`bibliography.bib`).

The paths for these files can be configured in the settings.