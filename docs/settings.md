 # Settings Deep Dive

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

*   **Usage Instructions:** The settings tab includes a brief guide on how to use the Zotero Connector feature. Key points: Zotero Desktop must be closed, enable the server in BibLib, use the browser extension as normal.

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
