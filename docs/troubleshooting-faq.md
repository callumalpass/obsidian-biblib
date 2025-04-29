# Troubleshooting & FAQ

**Q: Why do I see "Invalid YAML" warnings in the Obsidian Properties panel for my literature notes?**

**A:** This is expected behavior due to limitations in Obsidian's current native metadata parser. It struggles to display or query deeply nested YAML structures, which are common and necessary in the CSL-JSON format used by BibLib (e.g., the `author` array of objects, or the `issued` date object).

**Your data is safe and correctly formatted according to YAML and CSL-JSON standards.** BibLib and external tools like Pandoc can read and use this data perfectly. The warning is purely a display issue within Obsidian's Properties UI. To view or edit the complex fields accurately, switch the note to **Source Mode**.

**Q: The Zotero Connector integration isn't working.**

**A:** Check the following:
1.  **Desktop Only:** This feature only works on Obsidian Desktop (Windows, macOS, Linux) because it requires Node.js APIs to run the local server. It will not work on mobile.
2.  **Server Enabled:** Go to BibLib settings and ensure "Enable Zotero Connector" is toggled ON.
3.  **Zotero Desktop Closed:** The Zotero Desktop application **must be completely closed** (not just minimized). BibLib needs to use the same network port (default 23119) that Zotero normally listens on. Once BibLib starts its server, Zotero can be reopened, but BibLib will receive data from the Connector.
4.  **Port Conflict:** Is another application using port 23119? Try changing the "Connector port" in BibLib settings to something different (e.g., 23120) and *also configure the Zotero browser connector* to use that same new port (this usually requires advanced configuration in the connector or browser, consult Zotero documentation). Sticking to the default 23119 and ensuring Zotero is closed is usually easier.
5.  **Browser Extension:** Ensure you have the official Zotero Connector browser extension installed and enabled in your browser.
6.  **Firewall:** Check if a firewall on your computer is blocking connections to the port BibLib is listening on (default 23119).


**Q: My custom frontmatter template for an array isn't creating a proper YAML list.**

**A:** To create a true YAML list (which Dataview and other tools can parse correctly), ensure your template:
1.  **Starts with `[` and ends with `]`**.
2.  **Properly quotes items** that contain spaces or special characters (like wikilinks). Use double quotes: `"[[Link Here]]"`.
3.  **Uses commas correctly between items**, especially within loops. Use `{{^@first}},{{/@first}}` *before* the item inside a loop to add commas except before the very first item.
    *   *Correct Example:* `[{{#authors_family}}{{^@first}},{{/@first}}"[[Authors/{{.}}]]"{{/authors_family}}]`
    *   *Incorrect Example (Missing quotes/commas):* `[[[Authors/{{.}}]] ]`

**Q: Attachments aren't being found during Bulk Import.**

**A:**
1.  **Zotero Export:** If importing from a Zotero BibTeX export, ensure you selected **"Export Files"** when exporting from Zotero.
2.  **File Location:** The `.bib` file *and* the associated `files` folder (created by Zotero during export) **must both be located inside your Obsidian vault** *before* you start the bulk import. BibLib looks for attachments relative to the `.bib` file's location using the paths stored within it (e.g., `files/12345/document.pdf`).
3.  **Attachment Handling Setting:** Ensure "Attachment handling" is set to `Import attachments to vault` in the Bulk Import modal (or in the plugin settings for the default).
4.  **File Paths in Source:** Check the `file` field within your `.bib` or `.json` file. Does the path accurately reflect where the file *will be* relative to the import file *within your vault*? Absolute paths from your computer's filesystem (e.g., `C:\Users\...`) will not work unless that exact path is somehow accessible *from within* the Obsidian environment (highly unlikely).

**Q: My citekeys look strange or aren't following my template.**

**A:**
1.  **Template vs. Legacy:** Check the "Citekey template" setting. If it has *any* text in it, BibLib uses the template engine. If it's *completely empty*, BibLib uses the "Legacy citekey generation" options below it. Make sure you are configuring the correct section based on whether the template field is empty or not.
2.  **Template Syntax:** If using the template, double-check your syntax. Are variable names correct (`{{author}}`, `{{year}}`, `{{title}}` etc.)? Are formatters spelled correctly (`|lowercase`, `|abbr3`, `|titleword`)?
3.  **Available Data:** The citekey generation depends on the data available *at the time of creation*. If you generate a citekey before filling in the author or year, the template might produce unexpected results. Use the regenerate button (🔄) in the modal after filling fields.
4.  **Sanitization:** Remember that template output for citekeys is automatically sanitized to include only letters and numbers (`a-zA-Z0-9`). Hyphens or other characters will be removed.

**Q: How do I edit complex CSL fields like authors?**

**A:** Open the literature note in **Source Mode** (`Ctrl/Cmd + E` toggles). Edit the YAML directly. For authors, it's an array of objects:
```yaml
author:
  - family: Smith
    given: Alice
  - family: Jones
    given: Bob P. # Added middle initial
```

For dates, use the `issued` field with `date-parts`

```yaml
issued:
  date-parts:
    - [2024, 5, 13] 
```
