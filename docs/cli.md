# Command-Line Interface

[biblib-cli](https://github.com/callumalpass/biblib-cli) is a companion command-line tool for creating and managing literature notes outside of Obsidian. It fetches bibliographic metadata from identifiers (DOI, ISBN, PMID, arXiv ID) or URLs and writes CSL-JSON data into the YAML frontmatter of Markdown files — the same format used by the Obsidian plugin.

This means literature notes created from the command line are immediately usable by BibLib in Obsidian, and vice versa. The two tools share no code, but they operate on the same file format.

## How it works

biblib-cli uses a [Zotero Translation Server](https://github.com/zotero/translation-server) to resolve identifiers and URLs into structured metadata. The Translation Server runs locally and uses Zotero's translators — the same extraction logic that powers the Zotero browser connector — to pull metadata from publisher websites, library catalogs, and databases.

When you run a command like `biblib write 10.1234/example`, the CLI sends the DOI to the Translation Server, receives the metadata, converts it to CSL-JSON, generates a citekey, and writes a Markdown file with the metadata in the frontmatter. If you point it at an existing file, it merges the new metadata with what is already there.

## Installation

biblib-cli requires Node.js 20 or later. Install it from the repository:

```bash
git clone https://github.com/callumalpass/biblib-cli.git
cd biblib-cli
npm install
npm run build
npm link
```

The Translation Server needs to be installed separately:

```bash
git clone --recurse-submodules https://github.com/zotero/translation-server.git
cd translation-server
npm install
```

biblib-cli can manage the Translation Server process for you (starting and stopping it automatically) if you configure the `serverManagement.sourcePath` setting to point at your translation-server checkout.

## Configuration

Configuration is stored in `~/.config/biblib/config.yaml`. Run `biblib init-config` to create a default config file, then edit it to match your setup.

The most important settings are `rootFolderPath`, which should point at your Obsidian vault (or wherever you keep your literature notes), and `translationServerUrl`, which defaults to `http://127.0.0.1:1969`.

```yaml
rootFolderPath: /home/user/vault
translationServerUrl: http://127.0.0.1:1969
literatureNoteTag: literature_note
literatureNotePath: "."
filenameTemplate: "@{{citekey}}"

attachments:
  enabled: false
  pdfOnly: true
  createSubfolderByCitekey: true

citekey:
  template: "{{author_family}}{{year}}"
  minLength: 6

write:
  mergeStrategy: shallow
  preserveFields:
    - tags

customFrontmatterFields:
  - name: year
    template: "{{year}}"
    enabled: true

serverManagement:
  enabled: true
  autoStart: true
  sourcePath: /home/user/projects/translation-server
```

Run `biblib show-config` to see the effective configuration with all defaults filled in.

### Citekey and filename templates

The `citekey.template` and `filenameTemplate` settings use the same Handlebars-style syntax as the Obsidian plugin. Variables like `{{author_family}}`, `{{year}}`, and `{{title}}` are available, along with formatters (`{{title|lowercase}}`, `{{author_family|titleword}}`). If a generated citekey is shorter than `citekey.minLength`, random digits are appended.

### Custom frontmatter fields

The `customFrontmatterFields` array works the same way as in the Obsidian plugin. Each entry has a `name`, a `template`, and an `enabled` flag. For example, to extract the year into a top-level field:

```yaml
customFrontmatterFields:
  - name: year
    template: "{{year}}"
    enabled: true
```

### Attachments

When `attachments.enabled` is `true`, the CLI downloads available files (typically PDFs) from the Translation Server and stores them in `attachmentFolderPath`, optionally in per-citekey subfolders. The `pdfOnly` option restricts downloads to PDF files, and `maxFiles` caps the number of attachments per reference.

### Frontmatter merge behaviour

By default (`mergeStrategy: shallow`), writing metadata to an existing file merges new fields with existing frontmatter. Fields listed in `preserveFields` (default: `tags`) are not overwritten. The `--replace` flag switches to full replacement, discarding existing frontmatter entirely.

## Commands

### `biblib fetch <query>`

Fetches metadata for an identifier or URL and prints it to stdout. The output format is controlled by `--format`:

```bash
biblib fetch 10.1038/s41586-020-2649-2                  # JSON (default)
biblib fetch 10.1038/s41586-020-2649-2 --format yaml     # YAML
biblib fetch 10.1038/s41586-020-2649-2 --format frontmatter  # YAML wrapped in ---
```

Use `--output <path>` to write to a file instead of stdout. The `--ensure-server` flag starts the Translation Server automatically if it is not already running.

### `biblib write <query> [markdown-file]`

Fetches metadata and writes it into a Markdown file's frontmatter. If the file does not exist, it is created. If no file path is given, the filename is generated from the `filenameTemplate` config setting.

```bash
biblib write 10.1038/s41586-020-2649-2                   # auto-named file
biblib write 10.1038/s41586-020-2649-2 refs/harris2020.md # specific file
biblib write 10.1038/s41586-020-2649-2 --dry-run          # preview without writing
biblib write 10.1038/s41586-020-2649-2 --replace           # replace existing frontmatter
biblib write 10.1038/s41586-020-2649-2 --attachments       # download PDFs
```

Relative file paths are resolved against `rootFolderPath`.

### `biblib from-json <json-file> <markdown-file>`

Reads CSL-JSON from a file and writes it into a Markdown file's frontmatter. This is useful when you already have metadata in JSON format and want to turn it into a literature note.

```bash
biblib from-json reference.json refs/smith2023.md
biblib from-json reference.json refs/smith2023.md --replace
biblib from-json reference.json refs/smith2023.md --dry-run
```

### `biblib server start|stop|status`

Manages a local Translation Server process. The `start` command spawns the server as a detached process (it continues running after the CLI exits). The `stop` command shuts it down. The `status` command shows whether the server is reachable and whether a managed process is running.

```bash
biblib server start
biblib server status
biblib server stop
```

These commands require `serverManagement.sourcePath` to be set in the config.

### `biblib init-config`

Creates a default configuration file at `~/.config/biblib/config.yaml`. Use `--force` to overwrite an existing file.

### `biblib show-config`

Prints the effective configuration as YAML, with all defaults filled in. Useful for verifying that your config file is being loaded correctly.
