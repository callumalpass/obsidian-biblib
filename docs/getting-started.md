# Getting Started

## Installation

Install BibLib through the Community Plugins interface in Obsidian's settings. Search for "BibLib", install it, and enable it.

## Initial configuration

After installation, there are a few settings worth configuring before you start.

The **literature note tag** (default: `literature_note`) is how BibLib identifies reference notes in your vault. It is added to the frontmatter of every new literature note and is used when generating bibliography files. If you already use a tagging convention for references, you can change this to match.

Under **file organization**, you can set the folder where new literature notes are saved and the folder where imported attachments (typically PDFs) are stored. By default, notes are created at the vault root and attachments go into a `biblib` folder. Setting a dedicated folder for literature notes (e.g., `references/`) keeps them grouped together.

The **open note on create** setting controls whether new literature notes are opened automatically after creation.

## Creating your first reference

1. Open the command palette (`Ctrl/Cmd + P`).
2. Run **"BibLib: Create Literature Note"**.
3. In the modal, either fill in the bibliographic details manually or enter a DOI, ISBN, or URL in the "Auto-lookup" field and click **Lookup** to fetch the metadata automatically.
4. Review the populated fields and click **"Create Note"**.

This creates a Markdown file at the configured location with the bibliographic data in the YAML frontmatter. From here you can open the note and start annotating, or continue adding more references.
