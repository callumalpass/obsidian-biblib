import { Setting, TextAreaComponent } from 'obsidian';
import BibliographyPlugin from '../../../main';
import { SettingsUIHelpers } from './settings-ui-helpers';
import { TemplatePlaygroundComponent } from '../components/template-playground';

/**
 * Renders templates section
 */
export function renderTemplatesSection(
    containerEl: HTMLElement,
    plugin: BibliographyPlugin,
    helpers: SettingsUIHelpers,
    refreshDisplay: () => void
): void {
    new Setting(containerEl).setName('Templates').setHeading();

    // Introduction to template system
    const templateIntro = containerEl.createEl('div', { cls: 'setting-item-description' });
    templateIntro.createEl('p', {
        text: 'BibLib uses a powerful template system across all content. Templates use a Mustache-like syntax for literature notes, filenames, and frontmatter fields.'
    });

    // Add template guide FIRST
    const templateGuideContainer = containerEl.createDiv({
        cls: 'template-guide-container',
        attr: { style: 'margin-top: 16px; margin-bottom: 24px;' }
    });

    new Setting(templateGuideContainer)
        .setName('Template System Guide')
        .setHeading();

    // Make the guide a collapsible details element (collapsed by default)
    const detailsEl = templateGuideContainer.createEl('details');
    detailsEl.createEl('summary', { text: 'Template system guide (Click to expand)' });
    const guideDiv = detailsEl.createEl('div', { cls: 'template-variables-list' });

    guideDiv.createEl('p', { text: 'The template system supports variable replacement, formatting options, conditionals, and loops.' });

    new Setting(guideDiv).setName('Basic variables').setHeading();
    const basicVarsUl = guideDiv.createEl('ul');
    helpers.createListItem(basicVarsUl, '{{title}}', 'Title of the work');
    helpers.createListItem(basicVarsUl, '{{citekey}}', 'Citation key');
    helpers.createListItem(basicVarsUl, '{{year}}, {{month}}, {{day}}', 'Publication date parts');
    helpers.createListItem(basicVarsUl, '{{container-title}}', 'Journal or book title containing the work');
    helpers.createListItem(basicVarsUl, '{{authors}}', 'List of authors (formatted as "J. Smith et al." for 3+ authors, full names in arrays)');
    helpers.createListItem(basicVarsUl, '{{authors_family}}', 'Array of author family names (["Smith", "Jones", ...])');
    helpers.createListItem(basicVarsUl, '{{authors_given}}', 'Array of author given names (["John", "Maria", ...])');
    helpers.createListItem(basicVarsUl, '{{pdflink}}', 'Array of attachment file paths');
    helpers.createListItem(basicVarsUl, '{{attachments}}', 'Array of formatted attachment links (e.g., [[file.pdf|PDF]])');
    helpers.createListItem(basicVarsUl, '{{DOI}}, {{URL}}', 'Digital identifiers');
    helpers.createListItem(basicVarsUl, '{{currentDate}}', "Today's date (YYYY-MM-DD)");

    new Setting(guideDiv).setName('Special array variables').setHeading();
    guideDiv.createEl('p', { text: 'These variables are arrays that can be used with loop syntax:' });
    const arrayVarsUl = guideDiv.createEl('ul');
    helpers.createListItem(arrayVarsUl, '{{authors}}, {{authors_family}}, {{authors_given}}', 'Author information arrays');
    helpers.createListItem(arrayVarsUl, '{{editors}}, {{translators}}, etc.', 'Other contributor role arrays (when present)');
    helpers.createListItem(arrayVarsUl, '{{pdflink}}, {{attachments}}', 'Attachment path and link arrays');
    helpers.createListItem(arrayVarsUl, '{{links}}', 'Array of links to related notes');

    new Setting(guideDiv).setName('Creating arrays in frontmatter').setHeading();
    guideDiv.createEl('p', { text: 'To create YAML arrays in frontmatter templates, use JSON array syntax with square brackets:' });
    const arrayExamplesUl = guideDiv.createEl('ul');
    helpers.createListItem(arrayExamplesUl, '[{{#authors}}"[[Author/{{.}}]]",{{/authors}}]', 'Creates array like ["[[Author/John Smith]]", "[[Author/Maria Jones]]"]');
    helpers.createListItem(arrayExamplesUl, '[{{#authors_family}}{{^@first}},{{/@first}}"{{.}}"{{/authors_family}}]', 'Array with commas between items (no trailing comma)');
    helpers.createListItem(arrayExamplesUl, '["{{title}}", {{#DOI}}"{{DOI}}",{{/DOI}} "{{year}}"]', 'Fixed array with conditional elements');

    guideDiv.createEl('p', {
        text: 'Important: Arrays must be valid JSON to be processed correctly. Common issues to avoid:'
    });

    const arrayIssuesUl = guideDiv.createEl('ul');
    helpers.createListItem(arrayIssuesUl, 'Trailing commas', 'Example: ["item1", "item2",] - the last comma breaks the array');
    helpers.createListItem(arrayIssuesUl, 'Missing quotes', 'All text items must be quoted: ["ok"] not [ok]');
    helpers.createListItem(arrayIssuesUl, 'Unbalanced brackets', 'Ensure opening [ has a matching closing ]');
    helpers.createListItem(arrayIssuesUl, 'Use {{^@first}}, {{/@first}} to add commas only between items, not after the last item', '');

    guideDiv.createEl('p', {
        text: 'Use the Template Playground in YAML mode to test your array templates.'
    });

    new Setting(guideDiv).setName('Formatting options').setHeading();
    guideDiv.createEl('p', { text: 'You can format any variable using pipe syntax:' });
    const formatOptsUl = guideDiv.createEl('ul');
    helpers.createListItem(formatOptsUl, '{{variable|uppercase}}', 'ALL UPPERCASE');
    helpers.createListItem(formatOptsUl, '{{variable|lowercase}}', 'all lowercase');
    helpers.createListItem(formatOptsUl, '{{variable|capitalize}}', 'Capitalize First Letter Of Each Word');
    helpers.createListItem(formatOptsUl, '{{title|titleword}}', 'Extract first significant word from title');

    new Setting(guideDiv).setName('Conditionals and loops').setHeading();
    const conditionalsUl = guideDiv.createEl('ul');
    helpers.createListItem(conditionalsUl, '{{#variable}}Content shown if variable exists{{/variable}}', 'Positive conditional');
    helpers.createListItem(conditionalsUl, '{{^variable}}Content shown if variable is empty{{/variable}}', 'Negative conditional');
    helpers.createListItem(conditionalsUl, '{{#array}}{{.}} is the current item{{/array}}', 'Loop through arrays ({{.}} refers to current item)');
    helpers.createListItem(conditionalsUl, '{{#array}}{{^@first}}, {{/@first}}{{.}}{{/array}}', 'Using array position metadata (@first, @last, etc.)');

    new Setting(guideDiv).setName('Loop position metadata').setHeading();
    guideDiv.createEl('p', { text: 'When iterating through arrays, you can use these special variables to control formatting:' });
    const loopMetadataUl = guideDiv.createEl('ul');
    helpers.createListItem(loopMetadataUl, '{{@index}}', 'Zero-based index (0, 1, 2, ...)');
    helpers.createListItem(loopMetadataUl, '{{@number}}', 'One-based index (1, 2, 3, ...)');
    helpers.createListItem(loopMetadataUl, '{{@first}}', 'Boolean - true if first item');
    helpers.createListItem(loopMetadataUl, '{{@last}}', 'Boolean - true if last item');
    helpers.createListItem(loopMetadataUl, '{{@odd}}', 'Boolean - true for odd-indexed items (1, 3, 5, ...)');
    helpers.createListItem(loopMetadataUl, '{{@even}}', 'Boolean - true for even-indexed items (0, 2, 4, ...)');
    helpers.createListItem(loopMetadataUl, '{{@length}}', 'Total length of the array being iterated');

    guideDiv.createEl('p', { text: 'Example using position metadata:' });
    guideDiv.createEl('pre', {}, pre => {
        pre.createEl('code', {
            text: '{{#authors}}\n  {{@number}}. {{.}}{{^@last}},{{/@last}}{{#@last}}.{{/@last}}\n{{/authors}}'
        });
    });
    guideDiv.createEl('p', { text: 'Would produce: "1. John Smith, 2. Maria Rodriguez, 3. Wei Zhang."' });

    new Setting(guideDiv).setName('Accessing nested data').setHeading();
    guideDiv.createEl('p', { text: 'Use dot notation to access nested properties and array items:' });
    const nestedUl = guideDiv.createEl('ul');
    helpers.createListItem(nestedUl, '{{authors_family.0}}', 'First author family name');
    helpers.createListItem(nestedUl, '{{issued.date-parts.0.0}}', 'Year from nested CSL date structure');
    helpers.createListItem(nestedUl, '{{#authors}}{{#@first}}First author: {{.}}{{/@first}}{{/authors}}', 'Conditional within a loop');

    guideDiv.createEl('p', {}, (p) => {
        p.appendText('See the ');
        p.createEl('a', {
            text: 'full documentation',
            href: "https://callumalpass.github.io/obsidian-biblib"
        });
        p.appendText(' for more details on the template system.');
    });

    // Now add the template playground AFTER the guide
    const playgroundContainer = containerEl.createDiv({ cls: 'template-playground-wrapper' });

    new Setting(playgroundContainer)
        .setName('Template Playground')
        .setHeading();

    playgroundContainer.createEl('p', {
        text: 'Try out different templates and see the results instantly with sample data.',
        cls: 'setting-item-description'
    });

    // Add the template playground component
    new TemplatePlaygroundComponent(playgroundContainer);

    // Note Templates Section
    const templateSettingsContainer = containerEl.createDiv({ cls: 'template-settings-container' });

    new Setting(templateSettingsContainer)
        .setName('Note templates')
        .setHeading();

    templateSettingsContainer.createEl('p', {
        text: 'Configure templates used to generate literature notes.',
        cls: 'setting-item-description'
    });

    // Header template
    const headerTemplateContainer = templateSettingsContainer.createDiv();
    let headerTemplateField: TextAreaComponent | null = null;

    const templateSetting = new Setting(headerTemplateContainer)
        .setName('Note content template')
        .setDesc('Template for the entire note body content. Define the complete structure of your literature notes here including headings, sections, and references. Frontmatter is configured separately.');

    templateSetting.addExtraButton(button => button
        .setIcon('reset')
        .setTooltip('Reset to default')
        .onClick(async () => {
            plugin.settings.headerTemplate = '# {{#title}}{{title}}{{/title}}{{^title}}{{citekey}}{{/title}}';
            await plugin.saveSettings();
            refreshDisplay();
        })
    );

    const textareaContainer = headerTemplateContainer.createDiv({
        cls: 'template-textarea-container'
    });

    headerTemplateField = new TextAreaComponent(textareaContainer);
    headerTemplateField
        .setPlaceholder('# {{title}}\n\n## Summary\n\n## Key points\n\n## References\n{{#pdflink}}[[{{pdflink}}]]{{/pdflink}}')
        .setValue(plugin.settings.headerTemplate)
        .onChange(async (value) => {
            plugin.settings.headerTemplate = value;
            await plugin.saveSettings();
        });

    // Add examples section
    const headerExamplesContainer = headerTemplateContainer.createDiv({
        cls: 'template-examples-container'
    });

    headerExamplesContainer.createEl('details', {
        cls: 'template-examples-details'
    }, details => {
        details.createEl('summary', { text: 'Note template examples' });
        const examplesContainer = details.createDiv({
            cls: 'note-template-examples-container'
        });

        helpers.createTemplateExample(
            examplesContainer,
            "Simple title only",
            "# {{title}}",
            "A minimal example that just displays the work's title as a top-level heading."
        );

        helpers.createTemplateExample(
            examplesContainer,
            "Title with year and authors",
            "# {{title}} ({{year}})\n\n*{{authors}}*",
            "Adds the publication year in parentheses and the authors in italics below the title."
        );

        helpers.createTemplateExample(
            examplesContainer,
            "Title with abstract section",
            "# {{title}}\n\n## Abstract\n\n{{abstract}}",
            "Includes the abstract in its own section for academic references."
        );

        helpers.createTemplateExample(
            examplesContainer,
            "Comprehensive note structure",
            "# {{title}}\n\n## Metadata\n- **Authors**: {{authors}}\n- **Year**: {{year}}\n- **Journal**: {{container-title}}\n\n## Notes\n\n## Key points\n\n## References\n{{#DOI}}DOI: {{DOI}}{{/DOI}}",
            "A full note structure with metadata section and placeholder headings for notes and key points."
        );

        helpers.createTemplateExample(
            examplesContainer,
            "Research note with quotes section",
            "# {{title}}\n\n## Summary\n\n## Quotes\n\n## Thoughts\n\n## References\n{{#pdflink}}📄 [[{{pdflink}}]]{{/pdflink}}\n{{#URL}}🔗 [Source]({{URL}}){{/URL}}",
            "Organized for research with sections for quotes, personal thoughts, and reference links."
        );

        helpers.createTemplateExample(
            examplesContainer,
            "Note with drawing canvas",
            "# {{citekey}}: {{title}}\n\n![[{{citekey}}.excalidraw]]\n\n## Notes\n\n## References\n{{#attachments}}{{.}}\n{{/attachments}}",
            "Includes an excalidraw canvas for visual note-taking, named after the citekey."
        );

        helpers.createTemplateExample(
            examplesContainer,
            "Zettelkasten-style note",
            "# {{citekey}} - {{title|capitalize}}\n\n## Summary\n\n## Concepts\n\n## Fleeting Notes\n\n## Permanent Notes\n- \n\n## Links\n- Related: \n{{#keywords}}{{#.}}- #{{.}}\n{{/.}}{{/keywords}}\n\n## References\n{{#DOI}}DOI: {{DOI}}{{/DOI}}\n{{#URL}}URL: {{URL}}{{/URL}}\n{{#authors}}{{#@first}}{{.}} {{year}}{{/@first}}{{/authors}}",
            "Structured for Zettelkasten method with sections for fleeting and permanent notes, and concept linking."
        );

        helpers.createTemplateExample(
            examplesContainer,
            "Literature review format",
            "# {{title}}\n\n**Authors:** {{authors}}\n**Year:** {{year}}\n**Journal:** {{container-title}}\n**Keywords:** {{#keywords}}{{.}}{{^@last}}, {{/@last}}{{/keywords}}\n\n## Problem Statement\n\n## Methodology\n\n## Key Findings\n\n## Limitations\n\n## Future Research\n\n## Relevance to My Research\n\n## Citation\n```\n{{authors_family.0}} et al. ({{year}}). {{title}}. {{container-title}}. {{#DOI}}https://doi.org/{{DOI}}{{/DOI}}\n```",
            "Comprehensive template for academic literature reviews with structured analysis sections."
        );

        helpers.createTemplateExample(
            examplesContainer,
            "Cornell notes method",
            "# {{title}} ({{year}})\n\n> [!cue] Cues\n> - Key concepts\n> - Main questions\n> - Terminology\n\n## Notes\n\n\n\n> [!summary] Summary\n> \n\n## Metadata\n- **Authors**: {{authors}}\n- **Publication**: {{container-title}}\n- **Link**: {{#DOI}}https://doi.org/{{DOI}}{{/DOI}}{{^DOI}}{{#URL}}{{URL}}{{/URL}}{{/DOI}}",
            "Based on the Cornell note-taking method with cues on the left and summary at the bottom."
        );

        helpers.createTemplateExample(
            examplesContainer,
            "Callout-based template",
            "# {{title}}\n\n> [!info] Metadata\n> - **Authors**: {{authors}}\n> - **Year**: {{year}}\n> - **Journal**: {{container-title}}\n> - **DOI**: {{#DOI}}{{DOI}}{{/DOI}}\n\n> [!abstract] Abstract\n> {{abstract}}\n\n> [!quote] Key Quotes\n> \n\n> [!note] Notes\n> \n\n> [!example] Examples\n> \n\n> [!success] Strengths\n> \n\n> [!failure] Weaknesses\n> \n\n> [!question] Questions\n> \n\n> [!tip] Applications\n> ",
            "Uses Obsidian callouts to organize different aspects of literature notes with visual distinction."
        );
    });
}
