import { Readable } from 'stream';
import { App } from 'obsidian';
import { ConnectorServer } from '../connector-server';
import { DEFAULT_SETTINGS } from '../../types/settings';

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- driving private handlers */

type ReceivedEvent = { item: { title?: string }; files: string[] };

function fakeRequest(body: unknown): Readable {
    return Readable.from([Buffer.from(JSON.stringify(body))]);
}

function fakeResponse() {
    return { headersSent: false, setHeader: jest.fn(), writeHead: jest.fn(), end: jest.fn() };
}

describe('ConnectorServer session dispatch (issue #26)', () => {
    let server: ConnectorServer;
    let received: ReceivedEvent[];
    let internals: any;

    beforeEach(async () => {
        jest.useFakeTimers();
        (globalThis as any).window = {
            require: (id: string): unknown => jest.requireActual(id),
            setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
            clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
            setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
            clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id),
        };
        const doc = new EventTarget();
        (globalThis as any).activeDocument = doc;
        received = [];
        doc.addEventListener('zotero-item-received', (event) => {
            received.push((event as CustomEvent<ReceivedEvent>).detail);
        });

        server = new ConnectorServer(new App(), { ...DEFAULT_SETTINGS });
        internals = server as any;
        await internals.ensureNodeRuntime();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        delete (globalThis as any).window;
        delete (globalThis as any).activeDocument;
    });

    it('opens the modal straight away when the item has no attachments', async () => {
        await internals.handleSaveItems(
            fakeRequest({ sessionID: 's1', uri: 'https://example.org', items: [{ id: 'i1', title: 'No snapshot' }] }),
            fakeResponse()
        );

        expect(received).toHaveLength(1);
        expect(received[0].item.title).toBe('No snapshot');
    });

    it('opens the modal after a timeout when an announced attachment never arrives', async () => {
        await internals.handleSaveItems(
            fakeRequest({
                sessionID: 's2',
                uri: 'https://pmc.example.org',
                items: [{ id: 'i2', title: 'PMC article', attachments: [{ id: 'att-html', title: 'Snapshot', mimeType: 'text/html' }] }]
            }),
            fakeResponse()
        );
        expect(received).toHaveLength(0);

        jest.advanceTimersByTime(9000);
        expect(received).toHaveLength(0);

        jest.advanceTimersByTime(1000);
        expect(received).toHaveLength(1);
        expect(received[0].files).toEqual([]);
    });

    it('does not dispatch twice when the session completes before the timeout', async () => {
        await internals.handleSaveItems(
            fakeRequest({ sessionID: 's3', items: [{ id: 'i3', title: 'Complete', attachments: [{ id: 'att-pdf' }] }] }),
            fakeResponse()
        );

        internals.sessions.get('s3').attachmentStatus['att-pdf'] = { progress: 100, localPath: '/tmp/a.pdf' };
        internals.checkAndDispatchIfComplete('s3');
        jest.advanceTimersByTime(20000);

        expect(received).toHaveLength(1);
        expect(received[0].files).toEqual(['/tmp/a.pdf']);
    });
});
