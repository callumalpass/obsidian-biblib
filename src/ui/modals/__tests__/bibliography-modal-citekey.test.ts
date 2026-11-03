import { App } from 'obsidian';
import { BibliographyModal } from '../bibliography-modal';
import { CitationService } from '../../../services/citation-service';
import { CitoidService } from '../../../services/api/citoid';
import { NoteCreationService } from '../../../services';
import { BibliographyPluginSettings } from '../../../types/settings';
import { Citation, Contributor } from '../../../types/citation';

// The suggest modals extend classes the Obsidian mock doesn't provide, and aren't used here
jest.mock('../note-suggest-modal', () => ({ NoteSuggestModal: class {} }));
jest.mock('../../components/file-suggest-modal', () => ({ FileSuggestModal: class {} }));

// What Citoid returns for a page with no author metadata: the label is built without one
const CITOID_BIBTEX_NO_AUTHOR =
    '@misc{noauthor_report_2026, title={A Report}, year={2026}, url={https://example.org/report}}';

interface ModalInternals {
    idInput: { value: string };
    dateInput: { value: string };
    contributors: Contributor[];
    isInitialized: boolean;
    addContributorField(role: string, family?: string, given?: string, literal?: string): void;
    addAdditionalField(): void;
    getFormValues(): Citation;
    populateFormWithGeneratedCitekey(cslData: unknown): void;
    populateFormFromCitoid(cslData: unknown): void;
}

const fakeInput = () => ({ value: '' });

async function openModal(useZoteroKeys: boolean, lookup = true) {
    const citekeyOptions = {
        citekeyTemplate: '{{authors_family.0|lowercase}}{{year}}',
        useZoteroKeys,
        minCitekeyLength: 6
    };
    const citationService = new CitationService(citekeyOptions);
    const modal = new BibliographyModal(
        new App() as never,
        { citekeyOptions, defaultModalFields: [] } as unknown as BibliographyPluginSettings,
        {} as CitoidService,
        citationService,
        {} as NoteCreationService
    ) as unknown as ModalInternals;

    Object.assign(modal, {
        isInitialized: true,
        typeDropdown: { value: 'webpage', querySelector: () => ({}) },
        languageDropdown: { value: '', querySelector: () => ({}) },
        contributorsListContainer: { empty: () => {} },
        additionalFieldsContainer: { empty: () => {} },
        addAdditionalField: () => {},
        addContributorField: (role: string, family?: string, given?: string, literal?: string) => {
            modal.contributors.push({ role, family, given, literal });
        }
    });
    for (const field of [
        'idInput', 'titleInput', 'titleShortInput', 'pageInput', 'urlInput', 'containerTitleInput',
        'dateInput', 'publisherInput', 'publisherPlaceInput', 'editionInput', 'volumeInput',
        'numberInput', 'doiInput', 'abstractInput'
    ]) {
        Object.assign(modal, { [field]: fakeInput() });
    }

    if (lookup) {
        modal.populateFormWithGeneratedCitekey(await citationService.fetchNormalized('https://example.org/report'));
    }
    return modal;
}

describe('BibliographyModal citekey after manual edits (#50)', () => {
    beforeEach(() => {
        jest.spyOn(CitoidService.prototype, 'fetchBibTeX').mockResolvedValue(CITOID_BIBTEX_NO_AUTHOR);
    });
    afterEach(() => jest.restoreAllMocks());

    it('uses an author entered after a lookup that found none', async () => {
        const modal = await openModal(false);
        expect(modal.idInput.value).toMatch(/^2026\d{3}$/);

        modal.contributors[0].family = 'Doe';

        expect(modal.getFormValues().id).toBe('doe2026');
    });

    it('uses a year edited after a lookup', async () => {
        const modal = await openModal(false);
        modal.contributors[0].family = 'Doe';
        modal.dateInput.value = '2019';

        expect(modal.getFormValues().id).toBe('doe2019');
    });

    it('keeps the key shown in the form if nothing was edited', async () => {
        const modal = await openModal(false);

        expect(modal.getFormValues().id).toBe(modal.idInput.value);
    });

    it('keeps a key the user typed', async () => {
        const modal = await openModal(false);
        modal.idInput.value = 'mykey';
        modal.contributors[0].family = 'Doe';

        expect(modal.getFormValues().id).toBe('mykey');
    });

    it('keeps the lookup key when "Use Zotero keys" is on', async () => {
        const modal = await openModal(true);
        modal.contributors[0].family = 'Doe';

        expect(modal.getFormValues().id).toBe('noauthor_report_2026');
    });

    it('keeps a citekey from pasted BibTeX', async () => {
        const modal = await openModal(false, false);
        modal.populateFormFromCitoid({ id: 'pasted2020', title: 'Pasted', issued: { 'date-parts': [[2020]] } });
        modal.dateInput.value = '2021';

        expect(modal.getFormValues().id).toBe('pasted2020');
    });

    it('generates from the form when no lookup was used', async () => {
        const modal = await openModal(false, false);
        modal.contributors.push({ role: 'author', family: 'Doe' });
        modal.dateInput.value = '2026';

        expect(modal.getFormValues().id).toBe('doe2026');
    });
});
