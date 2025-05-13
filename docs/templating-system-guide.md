# Templating System Guide

BibLib uses a unified template engine based on Handlebars/Mustache syntax for customizing citekeys, filenames, note headers, and custom frontmatter fields. This provides powerful control over how your reference data is formatted and stored.

## Where Templates Are Used

BibLib uses templates in four major areas:

1.   **Header templates:** Configured in Settings → "Header template"
    * The template for the first header in a literature note, appearing above the YAML frontmatter
    * Example: `# {{title}} ({{year}})`
2. **Filename templates:** Configured in Settings → "Filename template"
    * The template for generating literature note filenames, independent from citekeys
    * Example: `@{{citekey}}` or `{{year}}-{{citekey}}` or `{{type}}/{{citekey}}`
    * Forward slashes (`/`) in the template will create subfolders automatically
    * Missing variables in path segments are gracefully handled by omitting that segment
    * Example hierarchies: `{{type}}/{{year}}/{{citekey}}` or `References/{{authors_family.0}}/{{year}}/{{citekey}}`
3. **Custom frontmatter fields:** Configured in Settings → "Custom frontmatter fields"
    * Each field in the frontmatter section uses a template for its value
    * Example: `aliases` field with template: `["{{title|sentence}}", "{{citekey}}"]`
4. **Citekey templates:** Configured in Settings → "Citekey template"
    * The template for generating unique citation keys
    * Example: `{{authors_family.0|lowercase}}{{year}}` → "smith2023"

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
*   **Attachments:**
    *   `{{pdflink}}`: An array of vault paths to all linked/imported attachments. Empty array if no attachments.
    *   `{{attachments}}`: An array of pre-formatted Obsidian wikilinks to all attachments (e.g., `[[path/to/file.pdf|PDF]]`, `[[path/to/file.epub|EPUB]]`). Empty array if no attachments.
    *   `{{quoted_attachments}}`: The `{{attachments}}` array items wrapped in double quotes (`"[[...]]"`), useful for placing links inside YAML arrays.
    *   For backward compatibility:
        *   `{{attachment}}`: Pre-formatted wikilink to the first attachment only. Empty string if no attachments.
        *   `{{raw_pdflink}}`: Path to the first attachment only. Empty string if no attachments.
        *   `{{quoted_attachment}}`: The first attachment wikilink wrapped in quotes.
*   **Related Notes:** (Available if notes were linked in the creation modal)
    *   `{{links}}`: An array of pre-formatted Obsidian wikilinks to the related notes (e.g., `["[[Note A]]", "[[Folder/Note B]]"]`).
    *   `{{linkPaths}}`: An array of the raw file paths for the related notes (e.g., `["Note A.md", "Folder/Note B.md"]`).
    *   `{{links_string}}`: A single string containing all wikilinks, separated by ", " (e.g., `"[[Note A]], [[Folder/Note B]]"`).
*   **Current Date & Time:** 
    *   `{{currentDate}}` (Today's date in YYYY-MM-DD format)
    *   `{{currentTime}}` (Current time in ISO format, HH:MM:SS)
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

```yaml
Authors:
{{#authors_raw}}
- {{given}} {{family}} ({{@number}})
{{/authors_raw}}
```

*   **Comma-Separated List:**

```yaml
Keywords: {{#keyword}}{{.}}{{^@last}}, {{/@last}}{{/keyword}}
```

*   **Conditional Formatting in Loops:**

```yaml
{{#authors_raw}}
  {{family}}{{#given}}, {{given}}{{/given}}{{#@last}} (Last Author){{/@last}}{{^@last}}; {{/@last}}
{{/authors_raw}}
```


## Examples

**Header Template:**

*   `# {{title}} ({{year}})` -> "# Quantum Computing Basics (2023)"
*   `## {{#pdflink}}[[{{.}}|FILE]] - {{/pdflink}}{{title}}` -> "## [[path/file.pdf|FILE]] - Quantum Computing Basics" (if file exists) OR "## Quantum Computing Basics" (if no files)
*   `# {{title}} | {{#attachments}}{{.}} {{/attachments}}` -> "# Quantum Computing Basics | [[path/file.pdf|PDF]] [[path/file.epub|EPUB]]" (lists all attachments)
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
*   **Field Name:** `attachments_list`
    *   **Template:** `[{{#attachments}}{{^@first}},{{/@first}}"{{.}}"{{/attachments}}]`
    *   **Output YAML:** `attachments_list: ["[[path/to/paper.pdf|PDF]]", "[[path/to/supplement.xlsx|XLSX]]"]`

**Citekey Template:**

*   `{{author|lowercase}}{{year}}` -> `smith2023`
*   `{{authors_family.0|abbr3}}{{year}}` -> `smi2023`
*   `{{authors_family.0|lower}}{{year}}{{title|titleword}}` -> `smith2023quantum`
*   `Auth{{authors_family.0|abbr1}}{{authors_family.1|abbr1}}{{year}}` -> `AuthSJ2023` (For Smith and Jones)
*   `{{citekey|upper}}` -> `SMITH2023QUANTUMCOMPUTING` (Uses the *already generated* citekey and uppercases it - less common use case)

**Filename Template:**

*   `@{{citekey}}` -> `@smith2023.md`
*   `{{year}}-{{citekey}}` -> `2023-smith2023.md`
*   `{{type}}/{{citekey}}` -> `article/smith2023.md` (Creates a subfolder for the reference type)
*   `{{type}}/{{year}}/{{citekey}}` -> `article/2023/smith2023.md` (Creates nested folders by type and year)
*   `{{citekey}} - {{title|capitalize}}` -> `smith2023 - Quantum Computing Basics.md`
*   `Lit/{{authors_family.0|lowercase}}_{{year}}{{^volume}}{{/volume}}{{#volume}}_v{{volume}}{{/volume}}` -> `Lit/smith_2023_v42.md`
*   `References/{{citekey}}{{#DOI}}_doi{{/DOI}}` -> `References/smith2023_doi.md` (Only adds "_doi" if a DOI exists)
*   `Library/{{#container-title}}{{container-title|lowercase}}/{{/container-title}}{{citekey}}` -> `Library/journal of physics/smith2023.md` (Organizes by journal)
*   `Papers/{{year}}/{{authors_family.0|lowercase}}/{{citekey}}` -> `Papers/2023/smith/smith2023.md` (Creates year/author hierarchies)
