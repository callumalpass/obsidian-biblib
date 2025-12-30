# Changelog

All notable changes to BibLib will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

See [unreleased.md](docs/releases/unreleased.md) for upcoming changes.

## [1.7.2] - 2025-07-02

### Fixed

- Fix author-links property formatting in edit literature note command

## [1.7.1] - 2025-06-07

### Changed

- Refactor settings tab to use tab navigation for improved UX

## [1.7.0] - 2025-05-30

### Added

- Support for proper CSL date field handling
- Modal field customization options
- Language configuration options
- UI field type auto-detection

### Changed

- Enhanced debug logging and field processing
- Refined modal UI updates
- Improved CSL field validation in settings

### Fixed

- Template regeneration options appearing incorrectly in modal

## [1.6.4] - 2025-05-25

### Fixed

- Improve robustness of date-parts validation in BibliographyBuilder ([#5](https://github.com/callumalpass/obsidian-biblib/issues/5))

### Changed

- Centralize constants and update UI messages across the plugin

## [1.6.3] - 2025-05-19

### Added

- Enhanced creator extraction logic for web and news items across Zotero connector and citation services

## [1.6.2] - 2025-05-18

### Fixed

- Handle empty date arrays in BibTeX export ([#5](https://github.com/callumalpass/obsidian-biblib/issues/5))

### Changed

- Enhance template engine formatters
- Refactor YAML array handling and template sample data

## [1.6.1] - 2025-05-17

### Added

- New templates and formatting options in template playground

### Changed

- Improve settings tab styling and layout
- Improve template examples and documentation

## [1.6.0] - 2025-05-17

### Added

- Template playground in settings for testing templates interactively
- Mode-specific sample data in template playground

### Changed

- Rename YAML mode to frontmatter for clarity
- Enhanced settings and template UI
- Improved documentation

### Removed

- Template preview component (replaced by template playground)

[Unreleased]: https://github.com/callumalpass/obsidian-biblib/compare/1.7.2...HEAD
[1.7.2]: https://github.com/callumalpass/obsidian-biblib/compare/1.7.1...1.7.2
[1.7.1]: https://github.com/callumalpass/obsidian-biblib/compare/1.7.0...1.7.1
[1.7.0]: https://github.com/callumalpass/obsidian-biblib/compare/1.6.4...1.7.0
[1.6.4]: https://github.com/callumalpass/obsidian-biblib/compare/1.6.3...1.6.4
[1.6.3]: https://github.com/callumalpass/obsidian-biblib/compare/1.6.2...1.6.3
[1.6.2]: https://github.com/callumalpass/obsidian-biblib/compare/1.6.1...1.6.2
[1.6.1]: https://github.com/callumalpass/obsidian-biblib/compare/1.6.0...1.6.1
[1.6.0]: https://github.com/callumalpass/obsidian-biblib/releases/tag/1.6.0
