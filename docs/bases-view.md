# Bases View for Literature Notes

Obsidian's [Bases](https://help.obsidian.md/Bases/Introduction+to+Bases) feature (available in Obsidian 1.10+) allows you to create queryable table views of your notes. This page provides a Bases configuration for browsing your BibLib literature notes.

## Quick Start

1. Create a new file in your vault with the `.base` extension (e.g., `Literature Notes.base`)
2. Copy the configuration below into the file
3. Open the file to see your literature library as an interactive table

## Features

The provided Bases configuration includes:

- **Multiple views**: All References, By Type, By Year, By Author, By Venue, and more
- **Filtered views**: Journal Articles, Books & Chapters, Conference Papers, Theses, Web Sources
- **Attachment tracking**: Views for notes with/without attachments
- **Reading workflow**: Track reading status with grouped views
- **Computed fields**: Author formatting, publication type labels, citation display

## Configuration

Copy this configuration into a `.base` file:

```yaml
# BibLib Literature Notes
# A Bases view for managing your academic reference library
# Assumes literature notes are tagged with #literature_note (configurable in BibLib settings)

filters:
  and:
    - file.hasTag("literature_note")

formulas:
  # === AUTHOR FORMATTING ===
  # First author's family name (for sorting and display)
  firstAuthor: 'if(author && list(author).length > 0, list(author)[0].family, "Unknown")'

  # Author count for display
  authorCount: 'if(author, list(author).length, 0)'

  # Formatted author string: "Smith" or "Smith et al." or "Unknown"
  authorsShort: 'if(!author || list(author).length == 0, "Unknown", if(list(author).length == 1, list(author)[0].family, list(author)[0].family + " et al."))'

  # Two authors: "Smith & Jones"
  authorsTwoOrLess: 'if(!author || list(author).length == 0, "Unknown", if(list(author).length == 1, list(author)[0].family, if(list(author).length == 2, list(author)[0].family + " & " + list(author)[1].family, list(author)[0].family + " et al.")))'

  # === PUBLICATION TYPE ===
  # Human-readable type labels
  typeLabel: 'if(type == "article-journal", "Journal Article", if(type == "book", "Book", if(type == "chapter", "Book Chapter", if(type == "thesis", "Thesis", if(type == "paper-conference", "Conference Paper", if(type == "report", "Report", if(type == "webpage", "Web Page", if(type == "article-magazine", "Magazine", if(type == "article-newspaper", "Newspaper", if(type == "dataset", "Dataset", if(type == "software", "Software", type)))))))))))'

  # Type category for grouping (broader categories)
  typeCategory: 'if(type == "article-journal" || type == "article-magazine" || type == "article-newspaper", "Articles", if(type == "book" || type == "chapter", "Books & Chapters", if(type == "thesis" || type == "dissertation", "Theses", if(type == "paper-conference" || type == "speech", "Conference", if(type == "webpage" || type == "post-weblog", "Web", if(type == "dataset" || type == "software", "Data & Software", "Other"))))))'

  # Type icon (emoji indicators)
  typeIcon: 'if(type == "article-journal", "📄", if(type == "book", "📚", if(type == "chapter", "📖", if(type == "thesis", "🎓", if(type == "paper-conference", "🎤", if(type == "webpage", "🌐", if(type == "dataset", "📊", if(type == "software", "💻", "📝"))))))))'

  # === DATE HANDLING ===
  # Publication year (handles both 'year' field and 'issued' CSL date)
  pubYear: 'if(year, year, if(issued && issued["date-parts"] && list(issued["date-parts"]).length > 0, list(issued["date-parts"])[0][0], "n.d."))'

  # Decade for grouping
  decade: 'if(year, (number(year) / 10).floor() * 10 + "s", if(issued && issued["date-parts"], (number(list(issued["date-parts"])[0][0]) / 10).floor() * 10 + "s", "Unknown"))'

  # Age of reference (years since publication)
  yearsOld: 'if(year, (number(today().format("YYYY")) - number(year)), null)'

  # Recency category
  recency: 'if(!year, "Unknown", if(number(today().format("YYYY")) - number(year) <= 2, "Recent (0-2 years)", if(number(today().format("YYYY")) - number(year) <= 5, "Fairly Recent (3-5 years)", if(number(today().format("YYYY")) - number(year) <= 10, "Moderate (6-10 years)", "Older (10+ years)"))))'

  # === VENUE / SOURCE ===
  # Where it was published (journal, book, publisher)
  venue: 'if(container-title, container-title, if(publisher, publisher, ""))'

  # === ATTACHMENTS ===
  # Has attachment?
  hasAttachment: 'attachment && !attachment.isEmpty()'

  # Attachment count
  attachmentCount: 'if(attachment, list(attachment).length, 0)'

  # === IDENTIFIERS ===
  # Has DOI?
  hasDOI: 'DOI && DOI != ""'

  # Has URL?
  hasURL: 'URL && URL != ""'

  # Has ISBN?
  hasISBN: 'ISBN && ISBN != ""'

  # Has any identifier
  hasIdentifier: 'formula.hasDOI || formula.hasURL || formula.hasISBN'

  # === CONTENT INDICATORS ===
  # Has abstract?
  hasAbstract: 'abstract && abstract != ""'

  # === READING STATUS ===
  # Common reading workflow statuses (assumes optional 'status' field in frontmatter)
  # Users can add 'status: unread/reading/read/cited' to their literature notes
  readingStatus: 'if(status, status, "unread")'

  # Reading status category
  readingCategory: 'if(status == "cited", "Cited", if(status == "read", "Read", if(status == "reading", "In Progress", "To Read")))'

  # === SORTING ===
  # Sort by year descending (newer first), nulls last
  yearSort: 'if(year, 10000 - number(year), 0)'

  # Sort by author then year
  authorYearSort: 'formula.firstAuthor + "-" + formula.pubYear'

  # === DISPLAY HELPERS ===
  # Citation-like display: "Smith (2024)"
  citationShort: 'formula.authorsShort + " (" + formula.pubYear + ")"'

  # With type icon
  citationWithIcon: 'formula.typeIcon + " " + formula.citationShort'

  # === JOURNAL ARTICLE SPECIFIC ===
  # Volume/issue/pages combined
  volumeIssuePage: 'if(volume, volume + if(number, "(" + number + ")", "") + if(page, ": " + page, ""), if(page, page, "—"))'

  # === AGE CATEGORIES ===
  # When was note created (for tracking reading backlog)
  addedRecently: 'if(((number(now()) - number(file.ctime)) / 86400000) < 7, "This week", if(((number(now()) - number(file.ctime)) / 86400000) < 30, "This month", if(((number(now()) - number(file.ctime)) / 86400000) < 90, "Last 3 months", "Older")))'

  # Days since added
  daysSinceAdded: '((number(now()) - number(file.ctime)) / 86400000).floor()'

views:
  # === ALL REFERENCES (Default Table) ===
  - type: table
    name: "All References"
    order:
      - formula.authorsShort
      - formula.pubYear
      - title
      - formula.typeLabel
      - formula.venue
      - attachment
      - DOI
      - file.tags
    sort:
      - property: formula.yearSort
        direction: DESC
      - property: formula.firstAuthor
        direction: ASC

  # === COMPACT VIEW ===
  - type: table
    name: "Compact"
    order:
      - formula.citationWithIcon
      - title
      - attachment
    sort:
      - property: formula.yearSort
        direction: DESC

  # === BY TYPE (Grouped Table) ===
  - type: table
    name: "By Type"
    order:
      - formula.authorsShort
      - formula.pubYear
      - title
      - formula.venue
      - attachment
    groupBy:
      property: formula.typeCategory
      direction: ASC
    sort:
      - property: formula.yearSort
        direction: DESC

  # === BY YEAR (Grouped Table) ===
  - type: table
    name: "By Year"
    order:
      - formula.authorsShort
      - title
      - formula.typeLabel
      - formula.venue
      - attachment
    groupBy:
      property: formula.pubYear
      direction: DESC
    sort:
      - property: formula.firstAuthor
        direction: ASC

  # === BY DECADE (Grouped) ===
  - type: table
    name: "By Decade"
    order:
      - formula.authorsShort
      - formula.pubYear
      - title
      - formula.typeLabel
      - attachment
    groupBy:
      property: formula.decade
      direction: DESC
    sort:
      - property: formula.yearSort
        direction: DESC

  # === BY FIRST AUTHOR ===
  - type: table
    name: "By Author"
    order:
      - formula.pubYear
      - title
      - formula.typeLabel
      - formula.venue
      - attachment
    groupBy:
      property: formula.firstAuthor
      direction: ASC
    sort:
      - property: formula.yearSort
        direction: DESC

  # === BY JOURNAL/VENUE ===
  - type: table
    name: "By Venue"
    order:
      - formula.authorsShort
      - formula.pubYear
      - title
      - formula.typeLabel
      - attachment
    groupBy:
      property: formula.venue
      direction: ASC
    sort:
      - property: formula.yearSort
        direction: DESC

  # === BY RECENCY ===
  - type: table
    name: "By Recency"
    order:
      - formula.authorsShort
      - formula.pubYear
      - title
      - formula.typeLabel
      - attachment
    groupBy:
      property: formula.recency
      direction: ASC
    sort:
      - property: formula.yearSort
        direction: DESC

  # === RECENT ADDITIONS ===
  - type: table
    name: "Recently Added"
    order:
      - formula.citationShort
      - title
      - formula.typeLabel
      - attachment
      - file.ctime
    sort:
      - property: file.ctime
        direction: DESC
    limit: 50

  # === READING LIST (by status) ===
  - type: table
    name: "Reading List"
    order:
      - formula.citationShort
      - title
      - formula.typeLabel
      - attachment
      - formula.readingStatus
    groupBy:
      property: formula.readingCategory
      direction: ASC
    sort:
      - property: formula.yearSort
        direction: DESC

  # === WITH ATTACHMENTS ONLY ===
  - type: table
    name: "With Attachments"
    filters:
      and:
        - formula.hasAttachment
    order:
      - formula.authorsShort
      - formula.pubYear
      - title
      - formula.typeLabel
      - attachment
    sort:
      - property: formula.yearSort
        direction: DESC

  # === MISSING ATTACHMENTS ===
  - type: table
    name: "Missing Attachments"
    filters:
      and:
        - '!formula.hasAttachment'
    order:
      - formula.authorsShort
      - formula.pubYear
      - title
      - formula.typeLabel
      - DOI
      - URL
    sort:
      - property: formula.yearSort
        direction: DESC

  # === JOURNAL ARTICLES ONLY ===
  - type: table
    name: "Journal Articles"
    filters:
      and:
        - type == "article-journal"
    order:
      - formula.authorsShort
      - formula.pubYear
      - title
      - container-title
      - formula.volumeIssuePage
      - attachment
      - DOI
    sort:
      - property: formula.yearSort
        direction: DESC

  # === BOOKS & CHAPTERS ===
  - type: table
    name: "Books & Chapters"
    filters:
      or:
        - type == "book"
        - type == "chapter"
    order:
      - formula.authorsShort
      - formula.pubYear
      - title
      - publisher
      - edition
      - attachment
      - ISBN
    sort:
      - property: formula.yearSort
        direction: DESC

  # === CONFERENCE PAPERS ===
  - type: table
    name: "Conference Papers"
    filters:
      and:
        - type == "paper-conference"
    order:
      - formula.authorsShort
      - formula.pubYear
      - title
      - container-title
      - publisher-place
      - attachment
    sort:
      - property: formula.yearSort
        direction: DESC

  # === THESES ===
  - type: table
    name: "Theses"
    filters:
      or:
        - type == "thesis"
        - type == "dissertation"
    order:
      - formula.authorsShort
      - formula.pubYear
      - title
      - publisher
      - attachment
    sort:
      - property: formula.yearSort
        direction: DESC

  # === WEB SOURCES ===
  - type: table
    name: "Web Sources"
    filters:
      or:
        - type == "webpage"
        - type == "post-weblog"
    order:
      - formula.authorsShort
      - formula.pubYear
      - title
      - URL
      - attachment
    sort:
      - property: formula.yearSort
        direction: DESC

  # === WITH ABSTRACTS ===
  - type: table
    name: "With Abstracts"
    filters:
      and:
        - formula.hasAbstract
    order:
      - formula.citationShort
      - title
      - abstract
      - attachment
    sort:
      - property: formula.yearSort
        direction: DESC

  # === BY TAGS ===
  - type: table
    name: "By Tags"
    order:
      - formula.authorsShort
      - formula.pubYear
      - title
      - attachment
    groupBy:
      property: file.tags
      direction: ASC
    sort:
      - property: formula.yearSort
        direction: DESC

  # === LIST VIEW ===
  - type: list
    name: "Simple List"
    order:
      - formula.citationShort
      - title
      - attachment
    sort:
      - property: formula.firstAuthor
        direction: ASC
      - property: formula.yearSort
        direction: DESC
```

## Customization

### Changing the Literature Note Tag

If you've configured BibLib to use a different tag (not `#literature_note`), update the filter at the top:

```yaml
filters:
  and:
    - file.hasTag("your_custom_tag")
```

### Adding a Reading Status Field

The "Reading List" view uses an optional `status` field. To use this feature, add a `status` field to your literature notes' frontmatter:

```yaml
---
status: unread  # or: reading, read, cited
---
```

You can add this as a custom frontmatter field in BibLib's settings.

### Adding Custom Views

You can add your own views by following the pattern in the configuration. For example, to create a view filtered by a specific tag:

```yaml
  - type: table
    name: "My Project"
    filters:
      and:
        - file.hasTag("my-project")
    order:
      - formula.citationShort
      - title
      - attachment
    sort:
      - property: formula.yearSort
        direction: DESC
```

## Available Formulas

The configuration includes these computed properties you can use in your views:

| Formula | Description | Example Output |
|---------|-------------|----------------|
| `formula.authorsShort` | First author with "et al." | "Smith et al." |
| `formula.firstAuthor` | First author's family name | "Smith" |
| `formula.pubYear` | Publication year | "2024" |
| `formula.typeLabel` | Human-readable type | "Journal Article" |
| `formula.typeIcon` | Emoji for type | "📄" |
| `formula.venue` | Journal or publisher | "Nature" |
| `formula.citationShort` | Short citation | "Smith et al. (2024)" |
| `formula.decade` | Publication decade | "2020s" |
| `formula.recency` | Age category | "Recent (0-2 years)" |

## Requirements

- Obsidian 1.10 or later (Bases feature)
- Literature notes created with BibLib (CSL-JSON frontmatter)

## Related

- [Obsidian Bases Documentation](https://help.obsidian.md/Bases/Introduction+to+Bases)
- [Bases Syntax Reference](https://help.obsidian.md/Bases/Bases+syntax)
- [Bases Functions](https://help.obsidian.md/Bases/Functions)
