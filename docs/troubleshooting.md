# Troubleshooting

This page provides solutions to common issues.

**Q: Why do I see "Invalid YAML" warnings in the Obsidian Properties panel?**

**A:** This is a display limitation in Obsidian's native metadata parser, which does not fully support the nested YAML structures used in the CSL-JSON format. The data is stored correctly and is usable by BibLib and external tools. To view the raw YAML, switch the note to Source Mode.

**Q: The Zotero Connector integration is not working.**

**A:** Check the following:
1.  The feature is only available on Obsidian Desktop.
2.  The "Enable Zotero Connector" setting must be on.
3.  The Zotero Desktop application must be completely closed.
4.  Ensure no other application is using the same port (default 23119).
5.  Check that your firewall is not blocking the connection.

**Q: My custom frontmatter template for an array is not creating a proper YAML list.**

**A:** To create a valid YAML list, the template must start with `[` and end with `]`, and items should be properly quoted and separated by commas.

**Q: Attachments are not being found during bulk import.**

**A:**
1.  If importing from Zotero, ensure you selected "Export Files" during the export process.
2.  The `.bib` file and the associated `files` folder must be located inside your Obsidian vault before starting the import.
3.  In the bulk import modal, set "Attachment handling" to `Import attachments to vault`.

**Q: The "Edit Literature Note" command is not available.**

**A:** This command is only available when a literature note is the active file. Ensure the note has the correct literature note tag in its frontmatter.

**Q: How do I edit complex CSL fields like authors?**

**A:** For complex fields, it is best to edit the YAML directly in Source Mode. The `author` field, for example, is an array of objects:
```yaml
author:
  - family: Smith
    given: Alice
  - family: Jones
    given: Bob
```