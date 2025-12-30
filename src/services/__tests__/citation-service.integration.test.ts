/**
 * Integration tests for CitationService
 * Tests the complete Zotero-to-CSL mapping workflow
 */
import { CitationService } from '../citation-service';

describe('CitationService Integration', () => {
    let service: CitationService;

    beforeEach(() => {
        service = new CitationService({
            template: '{{author|lower}}{{year}}',
            useZoteroKeys: false,
            minLength: 4
        });
    });

    describe('parseZoteroItem - Journal Article', () => {
        it('should map a basic journal article from Zotero to CSL', () => {
            const zoteroItem = {
                key: 'ABC123',
                itemType: 'journalArticle',
                title: 'Machine Learning in Healthcare',
                creators: [
                    { creatorType: 'author', firstName: 'John', lastName: 'Smith' },
                    { creatorType: 'author', firstName: 'Jane', lastName: 'Doe' }
                ],
                date: '2023-06-15',
                publicationTitle: 'Journal of AI Research',
                volume: '42',
                issue: '3',
                pages: '123-145',
                DOI: '10.1234/example.doi',
                abstractNote: 'This paper explores ML applications in healthcare.',
                language: 'en'
            };

            const csl = service.parseZoteroItem(zoteroItem);

            expect(csl.type).toBe('article-journal');
            expect(csl.title).toBe('Machine Learning in Healthcare');
            expect(csl.author).toHaveLength(2);
            expect(csl.author[0]).toEqual({ family: 'Smith', given: 'John' });
            expect(csl.author[1]).toEqual({ family: 'Doe', given: 'Jane' });
            expect(csl['container-title']).toBe('Journal of AI Research');
            expect(csl.volume).toBe('42');
            expect(csl.issue).toBe('3');
            expect(csl.page).toBe('123-145');
            expect(csl.DOI).toBe('10.1234/example.doi');
            expect(csl.abstract).toBe('This paper explores ML applications in healthcare.');
            expect(csl.language).toBe('en');
            expect(csl.issued).toBeDefined();
            expect(csl.issued['date-parts']).toBeDefined();
        });

        it('should generate a citekey from the template', () => {
            const zoteroItem = {
                itemType: 'journalArticle',
                title: 'Test Article',
                creators: [{ creatorType: 'author', firstName: 'John', lastName: 'Smith' }],
                date: '2023'
            };

            const csl = service.parseZoteroItem(zoteroItem);

            expect(csl.id).toMatch(/smith2023/i);
        });
    });

    describe('parseZoteroItem - Book', () => {
        it('should map a book from Zotero to CSL', () => {
            const zoteroItem = {
                itemType: 'book',
                title: 'Introduction to Algorithms',
                creators: [
                    { creatorType: 'author', firstName: 'Thomas', lastName: 'Cormen' },
                    { creatorType: 'editor', firstName: 'Charles', lastName: 'Leiserson' }
                ],
                date: '2009',
                publisher: 'MIT Press',
                place: 'Cambridge, MA',
                edition: '3rd',
                ISBN: '978-0262033848',
                numPages: '1312'
            };

            const csl = service.parseZoteroItem(zoteroItem);

            expect(csl.type).toBe('book');
            expect(csl.title).toBe('Introduction to Algorithms');
            expect(csl.author).toHaveLength(1);
            expect(csl.editor).toHaveLength(1);
            expect(csl.publisher).toBe('MIT Press');
            expect(csl['publisher-place']).toBe('Cambridge, MA');
            expect(csl.edition).toBe('3rd');
            expect(csl.ISBN).toBe('978-0262033848');
            expect(csl['number-of-pages']).toBe('1312');
        });
    });

    describe('parseZoteroItem - Book Section', () => {
        it('should map a book chapter with container author', () => {
            const zoteroItem = {
                itemType: 'bookSection',
                title: 'Chapter on Machine Learning',
                creators: [
                    { creatorType: 'author', firstName: 'Alice', lastName: 'Johnson' },
                    { creatorType: 'bookAuthor', firstName: 'Bob', lastName: 'Wilson' }
                ],
                bookTitle: 'Handbook of AI',
                date: '2022',
                pages: '50-75',
                publisher: 'Academic Press'
            };

            const csl = service.parseZoteroItem(zoteroItem);

            expect(csl.type).toBe('chapter');
            expect(csl.title).toBe('Chapter on Machine Learning');
            expect(csl.author).toHaveLength(1);
            expect(csl.author[0].family).toBe('Johnson');
            expect(csl['container-author']).toHaveLength(1);
            expect(csl['container-author'][0].family).toBe('Wilson');
            expect(csl['container-title']).toBe('Handbook of AI');
            expect(csl.page).toBe('50-75');
        });
    });

    describe('parseZoteroItem - Webpage', () => {
        it('should map a webpage from Zotero to CSL', () => {
            const zoteroItem = {
                itemType: 'webpage',
                title: 'Getting Started with React',
                creators: [{ creatorType: 'author', name: 'React Team' }],
                websiteTitle: 'React Documentation',
                url: 'https://react.dev/learn',
                accessDate: '2024-01-15'
            };

            const csl = service.parseZoteroItem(zoteroItem);

            expect(csl.type).toBe('webpage');
            expect(csl.title).toBe('Getting Started with React');
            expect(csl['container-title']).toBe('React Documentation');
            expect(csl.URL).toBe('https://react.dev/learn');
            expect(csl.accessed).toBeDefined();
        });
    });

    describe('parseZoteroItem - Conference Paper', () => {
        it('should map a conference paper from Zotero to CSL', () => {
            const zoteroItem = {
                itemType: 'conferencePaper',
                title: 'Neural Networks for NLP',
                creators: [{ creatorType: 'author', firstName: 'Emily', lastName: 'Chen' }],
                proceedingsTitle: 'Proceedings of ACL 2023',
                conferenceName: 'Annual Meeting of the ACL',
                date: '2023-07',
                pages: '1234-1245',
                DOI: '10.18653/v1/2023.acl-1.123'
            };

            const csl = service.parseZoteroItem(zoteroItem);

            expect(csl.type).toBe('paper-conference');
            expect(csl['container-title']).toBe('Proceedings of ACL 2023');
            expect(csl['event-title']).toBe('Annual Meeting of the ACL');
            expect(csl.DOI).toBe('10.18653/v1/2023.acl-1.123');
        });
    });

    describe('parseZoteroItem - Thesis', () => {
        it('should map a thesis from Zotero to CSL', () => {
            const zoteroItem = {
                itemType: 'thesis',
                title: 'Deep Learning for Medical Imaging',
                creators: [{ creatorType: 'author', firstName: 'Sarah', lastName: 'Brown' }],
                thesisType: 'PhD Dissertation',
                university: 'Stanford University',
                date: '2022',
                numPages: '250'
            };

            const csl = service.parseZoteroItem(zoteroItem);

            expect(csl.type).toBe('thesis');
            expect(csl.genre).toBe('PhD Dissertation');
            expect(csl.publisher).toBe('Stanford University');
        });
    });

    describe('parseZoteroItem - Patent', () => {
        it('should map a patent from Zotero to CSL', () => {
            const zoteroItem = {
                itemType: 'patent',
                title: 'Method for Processing Data',
                creators: [{ creatorType: 'inventor', firstName: 'James', lastName: 'Watson' }],
                patentNumber: 'US10123456B2',
                issuingAuthority: 'United States Patent Office',
                issueDate: '2021-03-15',
                filingDate: '2019-06-01'
            };

            const csl = service.parseZoteroItem(zoteroItem);

            expect(csl.type).toBe('patent');
            expect(csl.number).toBe('US10123456B2');
            expect(csl.authority).toBe('United States Patent Office');
            expect(csl.author).toHaveLength(1);
            expect(csl.author[0].family).toBe('Watson');
        });
    });

    describe('parseZoteroItem - Edge Cases', () => {
        it('should handle institutional authors (literal names)', () => {
            const zoteroItem = {
                itemType: 'report',
                title: 'Annual Climate Report',
                creators: [{ creatorType: 'author', name: 'World Health Organization' }],
                date: '2023'
            };

            const csl = service.parseZoteroItem(zoteroItem);

            expect(csl.author).toHaveLength(1);
            expect(csl.author[0].literal).toBe('World Health Organization');
        });

        it('should handle tags and convert to keywords', () => {
            const zoteroItem = {
                itemType: 'journalArticle',
                title: 'Tagged Article',
                creators: [{ creatorType: 'author', firstName: 'Test', lastName: 'Author' }],
                tags: [{ tag: 'machine-learning' }, { tag: 'healthcare' }, { tag: 'AI' }]
            };

            const csl = service.parseZoteroItem(zoteroItem);

            expect(csl.keyword).toBe('machine-learning, healthcare, AI');
        });

        it('should handle missing creators gracefully', () => {
            const zoteroItem = {
                itemType: 'webpage',
                title: 'Page Without Author',
                url: 'https://example.com'
            };

            const csl = service.parseZoteroItem(zoteroItem);

            expect(csl.type).toBe('webpage');
            expect(csl.title).toBe('Page Without Author');
            expect(csl.id).toBeDefined(); // Should still generate a citekey
        });

        it('should preserve case for special fields (DOI, ISBN, URL)', () => {
            const zoteroItem = {
                itemType: 'book',
                title: 'Test Book',
                creators: [{ creatorType: 'author', firstName: 'Test', lastName: 'Author' }],
                DOI: '10.1234/test',
                ISBN: '978-1234567890',
                url: 'https://example.com'
            };

            const csl = service.parseZoteroItem(zoteroItem);

            expect(csl.DOI).toBe('10.1234/test');
            expect(csl.ISBN).toBe('978-1234567890');
            expect(csl.URL).toBe('https://example.com');
        });

        it('should handle various date formats', () => {
            const testCases = [
                { date: '2023', expected: [[2023]] },
                { date: '2023-06', expected: [[2023, 6]] },
                { date: '2023-06-15', expected: [[2023, 6, 15]] },
                { date: '2023/06/15', expected: [[2023, 6, 15]] }
            ];

            for (const { date, expected } of testCases) {
                const zoteroItem = {
                    itemType: 'journalArticle',
                    title: 'Date Test',
                    creators: [{ creatorType: 'author', firstName: 'Test', lastName: 'Author' }],
                    date
                };

                const csl = service.parseZoteroItem(zoteroItem);
                expect(csl.issued['date-parts']).toEqual(expected);
            }
        });
    });

    describe('parseZoteroItem - Type Mappings', () => {
        const typeMappings: Array<[string, string]> = [
            ['journalArticle', 'article-journal'],
            ['book', 'book'],
            ['bookSection', 'chapter'],
            ['conferencePaper', 'paper-conference'],
            ['thesis', 'thesis'],
            ['report', 'report'],
            ['webpage', 'webpage'],
            ['blogPost', 'post-weblog'],
            ['patent', 'patent'],
            ['film', 'motion_picture'],
            ['audioRecording', 'song'],
            ['videoRecording', 'motion_picture'],
            ['presentation', 'speech'],
            ['manuscript', 'manuscript'],
            ['map', 'map'],
            ['artwork', 'graphic'],
            ['interview', 'interview'],
            ['email', 'personal_communication'],
            ['letter', 'personal_communication'],
            ['bill', 'bill'],
            ['statute', 'legislation'],
            ['case', 'legal_case'],
            ['hearing', 'hearing'],
            ['document', 'document'],
            ['encyclopediaArticle', 'entry-encyclopedia'],
            ['dictionaryEntry', 'entry-dictionary'],
            ['forumPost', 'post'],
            ['computerProgram', 'software'],
            ['tvBroadcast', 'broadcast'],
            ['radioBroadcast', 'broadcast'],
            ['podcast', 'song'],
            ['magazineArticle', 'article-magazine'],
            ['newspaperArticle', 'article-newspaper']
        ];

        it.each(typeMappings)('should map Zotero type %s to CSL type %s', (zoteroType, cslType) => {
            const zoteroItem = {
                itemType: zoteroType,
                title: `Test ${zoteroType}`,
                creators: [{ creatorType: 'author', firstName: 'Test', lastName: 'Author' }]
            };

            const csl = service.parseZoteroItem(zoteroItem);

            expect(csl.type).toBe(cslType);
        });
    });
});
