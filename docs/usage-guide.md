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
2.  Switch to **Source Mode**.
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

!!! info "Remember"
    Obsidian's Properties view might show warnings for nested CSL fields. Rely on Source Mode for accurate editing of complex fields like `author` or `issued`.

