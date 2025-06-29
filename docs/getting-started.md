# Getting Started

This guide provides the basic steps to start using BibLib.

## Installation

1.  Install the plugin through the Obsidian Community Plugins interface.
2.  Enable the plugin in the "Community Plugins" section of Obsidian's settings.

## Initial Configuration

After installation, a few settings can be configured to suit your workflow.

1.  **Literature Note Tag:** Set a specific tag for your literature notes (default: `literature_note`). This tag is used by the plugin to identify reference notes in your vault.
2.  **File Paths:**
    *   **Literature note location:** Specify the folder where new literature notes will be saved.
    *   **Attachment folder path:** Designate a folder for storing imported attachments like PDFs.
3.  **Open note on create:** Choose whether to automatically open a new literature note after it's created.

## Creating Your First Reference

1.  Open the command palette (`Ctrl/Cmd + P`).
2.  Run the command **"BibLib: Create Literature Note"**.
3.  In the modal that appears, you can either manually fill in the bibliographic details or use the metadata lookup feature.
    *   **Metadata Lookup:** Enter a DOI, ISBN, or URL in the "Auto-lookup" field and click "Lookup" to automatically populate the form.
4.  Once the fields are filled, click **"Create Note"**.

This will create a new Markdown file in the location you specified, with the bibliographic data stored in the YAML frontmatter.
