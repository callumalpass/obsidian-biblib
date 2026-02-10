# Core Concepts

## Literature notes

A literature note is a Markdown file in your vault that represents a single bibliographic reference — a journal article, book, report, web page, or any other citable work. The file has two parts: YAML frontmatter containing the structured bibliographic metadata, and a Markdown body that you can use however you like (notes on the work, key quotes, links to related ideas).

Because literature notes are ordinary Obsidian notes, they participate in all the usual Obsidian features. You can link to them from other notes with `[[@smith2023]]`, tag them, search their contents, or organize them into folders. There is nothing special about them from Obsidian's perspective — BibLib identifies them by a configurable tag (default: `literature_note`) in the frontmatter.

Filenames are generated from a template, which defaults to `@{{citekey}}`. The `@` prefix is a convention borrowed from Pandoc citation syntax and makes literature notes easy to spot, but the template is configurable.

## CSL-JSON metadata

The frontmatter of each literature note is structured according to the CSL-JSON standard. CSL-JSON defines a vocabulary of field names and data types for bibliographic records. Rather than inventing its own schema, BibLib uses this existing standard directly.

This matters because CSL-JSON is the format that Pandoc and other citation processors already understand. The metadata in your notes is the same data that ends up in your bibliography files — it is not an intermediate representation that needs to be translated. When BibLib builds a `bibliography.json`, it collects the frontmatter from your literature notes and writes it out. The result is a valid CSL-JSON file, ready for Pandoc.

Some of the CSL-JSON data types are more complex than the flat key-value pairs that Obsidian's Properties panel is designed for. Author names, for instance, are arrays of objects with `family` and `given` fields, and optionally particles (`non-dropping-particle` for "de", `dropping-particle` for "van") and suffixes ("Jr.", "III"). Dates use a `date-parts` array that supports partial values — `[[2023]]` for a year, `[[2023, 6]]` for year and month, `[[2023, 6, 15]]` for a full date — and a `raw` field for values that do not fit into that structure, like "Spring 2023" or "circa 1850".

Obsidian's Properties panel may display warnings for these nested structures. This is a display limitation, not a data problem. The YAML is valid and can be viewed correctly in Source Mode.

## Citekeys

A citekey is a short, unique identifier for a reference. In BibLib it serves as the `id` field in the frontmatter, the basis for the filename, and the string you use when citing the reference in Pandoc (`[@smith2023]`) or linking to it in Obsidian (`[[@smith2023]]`).

Citekeys are generated from a template. The default template is `{{authors_family.0|lowercase}}{{year}}`, which produces keys like `smith2023`. The template can use any bibliographic field and apply formatters — for example, `{{authors_family.0|lowercase}}{{title|titleword}}{{year}}` would produce `smithexample2023` for a paper titled "An Example of Something" by Smith.

Generated citekeys follow Pandoc's syntax rules: they must start with a letter, digit, or underscore, and may contain alphanumerics and a set of punctuation characters (`:.#$%&-+?<>~/`). If a generated citekey is shorter than a configurable minimum length, a random numeric suffix is appended to reduce the chance of collisions.

## Attachments

Literature notes can have associated files, typically PDFs. BibLib supports two modes for attachments: importing a file (which copies it into a designated folder in your vault) and linking to a file that already exists in the vault. When using the Zotero Connector, PDFs are imported automatically when available.

The path to an attachment is stored in the note's frontmatter. An optional setting creates a subfolder per reference (named after the citekey) within the attachment folder, which keeps things organized when you have many references with associated files.

## Bibliography generation

BibLib can generate bibliography files from the literature notes in your vault. It scans for notes with the configured literature note tag, collects their frontmatter metadata, and writes the result as either a CSL-JSON file (`bibliography.json`) or a BibTeX file (`bibliography.bib`). Both paths are configurable.

The CSL-JSON output is the more direct of the two — it is essentially the collected frontmatter data written as a JSON array. The BibTeX output involves a conversion step (handled by the citation-js library), which is useful when working with LaTeX-based workflows.

These generated files are what you point Pandoc at when processing citations in your writing. Because BibLib regenerates them on command, they stay in sync with the current state of your vault.
