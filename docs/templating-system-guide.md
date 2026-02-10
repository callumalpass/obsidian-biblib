# Templating

BibLib uses a template engine with Handlebars/Mustache-style syntax. Templates are used to generate citekeys, filenames, note content, and custom frontmatter field values.

## Template syntax

**Variables** are written as `{{variableName}}` — for example, `{{title}}` or `{{DOI}}`. Nested data is accessed with dot notation: `{{issued.date-parts.0.0}}` gives the publication year from a CSL date.

**Formatters** transform a variable's value and are appended with a pipe: `{{variableName|formatterName}}`. Some formatters take a parameter, written with a colon: `{{title|truncate:50}}`. Formatters can be chained: `{{title|lowercase|truncate:30}}`.

**Conditionals** render content only when a variable exists: `{{#variableName}}...{{/variableName}}`. The inverted form `{{^variableName}}...{{/variableName}}` renders when the variable does not exist.

**Loops** iterate over arrays: `{{#arrayName}}...{{/arrayName}}`. Inside a loop, `{{.}}` refers to the current item.

## Available variables

All fields from the CSL-JSON data are available directly — `{{title}}`, `{{DOI}}`, `{{URL}}`, `{{container-title}}`, and so on. In addition, BibLib provides several derived variables for convenience.

The **citekey** is available as `{{citekey}}`. **Date parts** are available as `{{year}}`, `{{month}}`, and `{{day}}`, extracted from the CSL `issued` field.

**Contributor variables** provide different representations of author data. `{{authors}}` is a formatted string of the primary authors. `{{authors_raw}}` is the array of raw author objects. `{{authors_family}}` and `{{authors_given}}` are arrays of family names and given names respectively. The same pattern applies to other contributor roles: `{{editors}}`, `{{editors_family}}`, `{{translators}}`, and so on.

**Attachment variables** include `{{pdflink}}` (an array of vault paths to attachments) and `{{attachments}}` (an array of formatted Obsidian wikilinks). **Related note variables** include `{{links}}` (wikilinks to related notes) and `{{linkPaths}}` (raw file paths).

`{{currentDate}}` and `{{currentTime}}` give the current date (YYYY-MM-DD) and time (HH:MM:SS) at the moment of note creation.

## Formatters

**Text case**: `|uppercase`, `|lowercase`, `|capitalize` (first letter of each word), `|sentence` (first letter of the string).

**Length**: `|truncate:N` (cut to N characters), `|ellipsis:N` (cut to N characters with trailing ellipsis).

**Manipulation**: `|trim` (strip whitespace), `|prefix:TEXT`, `|suffix:TEXT`, `|replace:find:replace`.

**Date**: `|date:iso`, `|date:short`, `|date:long`, `|date:year`.

**Abbreviation**: `|abbrN` takes the first N characters — `|abbr3` applied to "Smith" gives "Smi".

**Special**: `|titleword` extracts the first significant word from a title (skipping articles like "the", "a", "an"). `|shorttitle` extracts the first three significant words.

## Examples

A header template for note content:

```
# {{title}} ({{year}})
```

A custom frontmatter field for Obsidian aliases:

```
["{{title|sentence}}", "{{citekey}}"]
```

A citekey template using the first author's last name and the year:

```
{{authors_family.0|lowercase}}{{year}}
```

A filename template that organizes references into folders by type and year:

```
{{type}}/{{year}}/{{citekey}}
```

This produces a file structure like `article-journal/2023/smith2023.md`.
