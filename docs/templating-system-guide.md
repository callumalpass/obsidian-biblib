# Templating

BibLib uses a template engine with Handlebars/Mustache-style syntax to customize citekeys, filenames, and the content of literature notes.

## Template Syntax

*   **Variables:** `{{variableName}}` (e.g., `{{title}}`). Use dot notation for nested data: `{{issued.date-parts.0.0}}` for the year.
*   **Formatters:** `{{variableName|formatterName}}` or `{{variableName|formatter:parameter}}` (e.g., `{{title|lowercase}}`).
*   **Conditionals:** `{{#variableName}}...{{/variableName}}` (if variable exists) and `{{^variableName}}...{{/variableName}}` (if variable does not exist).
*   **Loops:** `{{#arrayName}}...{{/arrayName}}`. Inside a loop, `{{.}}` refers to the current item.

## Available Variables

The following variables are available in the templates:

*   **CSL Fields:** All fields from the CSL-JSON data (e.g., `{{title}}`, `{{DOI}}`, `{{URL}}`, `{{container-title}}`).
*   **Citekey:** `{{citekey}}`.
*   **Date Parts:** `{{year}}`, `{{month}}`, `{{day}}`.
*   **Contributors:**
    *   `{{authors}}`: A formatted string of primary authors.
    *   `{{authors_raw}}`: An array of raw author objects.
    *   `{{authors_family}}`: An array of author last names.
    *   `{{authors_given}}`: An array of author first names.
    *   Similar variables are available for other roles (e.g., `{{editors}}`, `{{translators}}`).
*   **Attachments:**
    *   `{{pdflink}}`: An array of vault paths to attachments.
    *   `{{attachments}}`: An array of formatted Obsidian wikilinks to attachments.
*   **Related Notes:**
    *   `{{links}}`: An array of formatted Obsidian wikilinks to related notes.
    *   `{{linkPaths}}`: An array of the raw file paths for related notes.
*   **Current Date/Time:** `{{currentDate}}` (YYYY-MM-DD) and `{{currentTime}}` (HH:MM:SS).

## Formatters

A variety of formatters are available for text case, length, manipulation, numbers, dates, and more.

*   **Text Case:** `|uppercase`, `|lowercase`, `|capitalize`, `|sentence`.
*   **Length:** `|truncate:N`, `|ellipsis:N`.
*   **Manipulation:** `|trim`, `|prefix:TEXT`, `|suffix:TEXT`, `|replace:find:replace`.
*   **Date:** `|date:iso`, `|date:short`, `|date:long`, `|date:year`.
*   **Abbreviation:** `|abbrN` (e.g., `|abbr3` for the first 3 letters).
*   **Special:** `|titleword` (extracts the first significant word of a title), `|shorttitle` (first 3 significant words).

## Examples

**Header Template:**
`# {{title}} ({{year}})`

**Custom Frontmatter Field (aliases):**
`["{{title|sentence}}", "{{citekey}}"]`

**Citekey Template:**
`{{authors_family.0|lowercase}}{{year}}`

**Filename Template:**
`{{type}}/{{year}}/{{citekey}}`
This will create a file structure like `article/2023/smith2023.md`.
