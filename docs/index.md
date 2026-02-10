# Introduction

## What is BibLib?

BibLib is an Obsidian plugin for managing bibliographic references. Each reference is stored as a Markdown note with its metadata written in YAML frontmatter, structured according to the [CSL-JSON](https://citeproc-js.readthedocs.io/en/latest/csl-json/markup.html) format.

Looking for a command-line workflow? See [biblib-cli](https://github.com/callumalpass/biblib-cli).

## Why plain-text references?

Most reference managers store bibliographic data in a database. This works until you want to do something the software didn't anticipate: query your references with a different tool, version-control your library, or read the data without launching a specific application. Migration can be difficult when the software is discontinued or changes direction.

In BibLib, each reference is a plain Markdown file in your Obsidian vault, with bibliographic metadata stored as YAML in the frontmatter. There is no database. The files are human-readable, editable with any text editor, and work naturally with Git. Because they are ordinary Obsidian notes, references can be linked to other notes, tagged, searched, and organized in folders alongside the rest of your knowledge base.

The reference library is not a separate silo. It is part of your vault, subject to the same workflows you use for everything else.

## Why CSL-JSON?

The metadata in each note's frontmatter follows the [Citation Style Language JSON](https://citeproc-js.readthedocs.io/en/latest/csl-json/markup.html) (CSL-JSON) standard. CSL-JSON is the data format understood by citation processors like Pandoc/Citeproc, and is used natively by Zotero and other reference tools.

This choice has practical consequences. When BibLib generates a `bibliography.json` file from your notes, that file can be passed directly to Pandoc without conversion. The same data can be exported as BibTeX for use with LaTeX. If you stop using BibLib, the metadata in your notes is already in a standard format that other tools can consume.

CSL-JSON also handles the complexities of bibliographic data well. Author names are structured objects that distinguish family names from given names and support particles like "van" or "de". Dates can be partial (year-only or year-month) and accommodate non-standard values like "Spring 2023". These are not edge cases in academic work — they come up routinely, and CSL-JSON was designed with them in mind.

## What a reference looks like

A literature note is a regular Markdown file. The frontmatter contains the bibliographic metadata, and the body of the note is free for summaries, annotations, or anything else:

```yaml
---
id: smith2023
type: article-journal
title: Example Article Title
author:
  - family: Smith
    given: Alice
  - family: Jones
    given: Bob
container-title: Journal of Examples
issued:
  date-parts:
    - [2023, 6, 15]
DOI: 10.1234/example
tags:
  - literature_note
---
```

The `id` field is the citekey, used for filenames, Pandoc citations (`[@smith2023]`), and Obsidian links. The `type` field follows the CSL type vocabulary (article-journal, book, chapter, thesis, and so on). The remaining fields are standard CSL-JSON properties.

!!! warning "YAML Display in Obsidian"
    Obsidian's Properties panel may show warnings for nested YAML structures like the `author` array. This is a display limitation in Obsidian's metadata parser — the data is stored correctly and works with external tools. You can view the raw YAML in Source Mode.

## How it fits into a writing workflow

BibLib sits between your reading and your writing. When you encounter a paper, book, or web page worth citing, you create a literature note — either by entering a DOI/ISBN/URL for automatic metadata lookup, by pasting a BibTeX entry, or by saving directly from the browser via the Zotero Connector. The note becomes part of your vault, where you can annotate it and link it to your other notes.

When you are ready to write, BibLib generates bibliography files (CSL-JSON or BibTeX) from your literature notes. These files are used by Pandoc to handle citation formatting, so you can write in Markdown with `[@citekey]` references and produce properly formatted output in any citation style.
