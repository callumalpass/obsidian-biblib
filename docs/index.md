
Welcome to the official documentation for BibLib, an Obsidian plugin designed to transform your vault into a powerful, integrated academic reference manager.

## Table of Contents

1.  [Introduction](#introduction)
    *   [What is BibLib?](#what-is-biblib)
    *   [Why CSL-JSON in Frontmatter?](#why-csl-json-in-frontmatter)
2.  [Installation](installation)
    *   [Manual Installation](installation#manual-installation)
    *   [Installation via BRAT](installation#installation-via-brat)
3.  [Core Concepts](core-concepts)
    *   [Literature Notes](core-concepts-#literature-notes)
    *   [CSL-JSON Metadata](core-concepts-#csl-json-metadata)
    *   [Citekeys](core-concepts-#citekeys)
    *   [Attachments](core-concepts-#attachments)
4.  [Key Features](key-features)
5.  [Usage Guide](usage-guide)
    *   [Creating a Literature Note](#creating-a-literature-note)
    *   [Using Metadata Lookup](#using-metadata-lookup)
    *   [Creating a Book Chapter Note](#creating-a-book-chapter-note)
    *   [Using the Zotero Connector (Desktop)](#using-the-zotero-connector-desktop)
    *   [Bulk Importing References](#bulk-importing-references)
    *   [Linking to References](#linking-to-references)
    *   [Generating Bibliography Files](#generating-bibliography-files)
    *   [Editing References](#editing-references)
    *   [Working with Attachments & PDF Annotations](#working-with-attachments--pdf-annotations)
6.  [Settings](settings)
    *   [General Settings](#general-settings)
    *   [File Path Settings](#file-path-settings)
    *   [Zotero Connector Settings](#zotero-connector-settings-desktop-only)
    *   [Bibliography Builder Settings](#bibliography-builder-settings)
    *   [Note Template Settings](#note-template-settings)
    *   [Citekey Generation Settings](#citekey-generation-settings)
    *   [Bulk Import Settings](#bulk-import-settings)
7.  [Templating System Guide](templating-system-guide)
    *   [Syntax Basics](#syntax-basics)
    *   [Available Variables](#available-variables)
    *   [Formatting Helpers](#formatting-helpers)
    *   [Conditionals](#conditionals)
    *   [Loops](#loops)
    *   [Examples](#examples)
8.  [Troubleshooting & FAQ](troubleshooting-faq)
9.  [License](license)

---

## Introduction

### What is BibLib?

BibLib is an Obsidian plugin that turns your vault into a robust academic reference manager. It stores each reference (paper, book, etc.) as a standard Markdown note. Bibliographic metadata is embedded within the note's YAML frontmatter using the Citation Style Language (CSL) JSON format.

By leveraging CSL – the same open standard used by tools like Pandoc – BibLib ensures your references are portable and ready for automated citation formatting. All your reference data lives in plain text (Markdown and YAML), making it future-proof, version-controllable, and easily searchable within Obsidian.

This approach keeps your reference library **inside Obsidian**, allowing you to link, manage, and connect sources just like any other notes. This is a significant advantage for academics, researchers, and students who desire an integrated knowledge management and writing workflow.

### Why CSL-JSON in Frontmatter?

Storing bibliographic data directly within your notes using the CSL-JSON standard offers several key benefits:

1.  **Open Standard & Interoperability:** CSL JSON is the lingua franca for citation data. Storing references in this format prevents vendor lock-in and ensures compatibility with external tools. You can directly use BibLib's generated bibliography files with citation processors like Pandoc/Citeproc to format citations and bibliographies in thousands of styles automatically.
2.  **Plain-Text Durability & Transparency:** Your entire reference library exists as human-readable Markdown and YAML. This makes it incredibly robust, easy to back up, and accessible even without Obsidian or BibLib. You can track changes using version control (like Git) and easily share references.
3.  **Unified Knowledge Base:** BibLib eliminates the need to constantly switch between a separate reference manager and your note-taking app. References become first-class citizens within your Obsidian vault. You can create links `[[YourReferenceNote]]` directly in your writing, use tags, view backlinks, and leverage Obsidian's powerful search and graph visualization capabilities to uncover connections between your ideas and your sources.
4.  **Pandoc-Ready Bibliography:** BibLib can generate a `bibliography.json` file containing the CSL-JSON data for all your literature notes. This file is directly consumable by Pandoc, allowing you to write manuscripts in Obsidian using simple citation keys (`[@citekey]`) and have Pandoc automatically generate perfectly formatted citations and a reference list in your desired style.
