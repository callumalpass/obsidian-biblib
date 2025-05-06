import { Notice } from 'obsidian';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';
import * as url from 'url';
import * as crypto from 'crypto';
import * as os from 'os';
import { promisify } from 'util';
import { BibliographyPluginSettings } from '../types/settings';

const pipeline = promisify(stream.pipeline);

// --- Constants ---
const CONNECTOR_SERVER_VERSION = '1.0.7'; // Incremented version
// ... other constants ...
const ZOTERO_APP_NAME = 'Obsidian Bibliography Plugin';
const CONNECTOR_API_VERSION_SUPPORTED = 3;
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000;
const SESSION_MAX_AGE = 10 * 60 * 1000;

// --- Interfaces ---
interface AttachmentStatus {
    progress: number;
    error?: string;
    localPath?: string;
}
interface SessionData {
    uri: string;
    items: any[];
    startTime: number;
    attachmentStatus: { [attachmentId: string]: AttachmentStatus };
    initialRequestData?: any;
    // --- NEW: Store expected attachment IDs ---
    expectedAttachmentIds: Set<string>;
    // --- ----------------------------------- ---
    eventDispatched: boolean;
}
interface AttachmentMetadata {
    id?: string;
    url?: string;
    contentType?: string;
    parentItemID?: string;
    title?: string;
}

/**
 * A server that intercepts Zotero Connector requests to integrate with Obsidian.
 */
export class ConnectorServer {
    // ... (Properties) ...
    private server: http.Server | null = null;
    private settings: BibliographyPluginSettings;
    private tempDir: string;
    private sessions: Map<string, SessionData> = new Map();
    private processedItemKeys: Set<string> = new Set();
    private cleanupIntervalId: NodeJS.Timeout | null = null;


    constructor(settings: BibliographyPluginSettings) {
       // ... (Constructor) ...
        this.settings = settings;
        this.tempDir = settings.tempPdfPath || path.join(os.tmpdir(), 'obsidian-bibliography');

        if (!fs.existsSync(this.tempDir)) {
            try {
                fs.mkdirSync(this.tempDir, { recursive: true });
                console.log(`Created temp directory: ${this.tempDir}`);
            } catch (err) {
                console.error(`Failed to create temp directory ${this.tempDir}:`, err);
                new Notice(`Error: Could not create temp directory for Zotero Connector: ${this.tempDir}`);
            }
        }
    }

    // --- Server Start/Stop/Request Handling/Routing (no changes) ---
    public async start(): Promise<void> {
        if (this.server) {
            console.log('Connector server already running.');
            return;
        }

        const port = this.settings.zoteroConnectorPort || 23119;

        this.server = http.createServer(this.handleRequest.bind(this));

        return new Promise((resolve, reject) => {
            this.server?.listen(port, '127.0.0.1', () => {
                console.log(`Zotero Connector server started on http://127.0.0.1:${port}`);
                new Notice(`Zotero Connector server listening on port ${port}`);
                this.cleanupIntervalId = setInterval(() => this.cleanupOldSessions(), SESSION_CLEANUP_INTERVAL);
                resolve();
            });

            this.server?.on('error', (err: NodeJS.ErrnoException) => {
                console.error('Failed to start Zotero Connector server:', err);
                let message = `Failed to start Zotero Connector server: ${err.message}`;
                if (err.code === 'EADDRINUSE') {
                    message = `Failed to start Zotero Connector server: Port ${port} is already in use. Is Zotero or another application running?`;
                } else if (err.code === 'EACCES') {
                     message = `Failed to start Zotero Connector server: Permission denied for port ${port}. Try a port number above 1024.`;
                }
                new Notice(message);
                this.server = null;
                reject(err);
            });
        });
    }

    public stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.cleanupIntervalId) {
                clearInterval(this.cleanupIntervalId);
                this.cleanupIntervalId = null;
            }
            if (this.server) {
                this.server.close(() => {
                    console.log('Zotero Connector server stopped.');
                    new Notice('Zotero Connector server stopped');
                    this.server = null;
                    this.sessions.clear();
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

        private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Zotero-Version, X-Zotero-Connector-API-Version, X-Metadata, Authorization');
        res.setHeader('Access-Control-Expose-Headers', 'X-Zotero-Version');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const parsedUrl = url.parse(req.url || '', true);
        const pathname = parsedUrl.pathname || '';
        const method = req.method || 'GET';

        res.setHeader('X-Zotero-Version', ZOTERO_APP_NAME + ' ' + CONNECTOR_SERVER_VERSION);

        console.log(`Connector Server: Request - ${method} ${pathname}${parsedUrl.search || ''}`);

        try {
            if (pathname.startsWith('/connector/')) {
                const endpoint = pathname.substring('/connector/'.length);
                await this.routeConnectorApi(endpoint, req, res);
            } else if (pathname === '/') {
                 this.sendResponse(res, 200, { message: 'Obsidian Bibliography Connector Server Running', version: CONNECTOR_SERVER_VERSION });
            }
             else {
                console.log(`Connector Server: Not Found - ${method} ${pathname}`);
                this.sendResponse(res, 404, { error: 'Not Found' });
            }
        } catch (error) {
            console.error(`Connector Server: Error handling ${method} ${pathname}:`, error);
            this.sendResponse(res, 500, { error: 'Internal Server Error', details: error.message });
        }
    }

     private async routeConnectorApi(endpoint: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const method = req.method || 'GET';

        console.log(`Connector Server: Routing endpoint - ${endpoint}, Method: ${method}`);

        switch (endpoint) {
            // ... other cases ...
            case 'ping':
                if (method === 'POST' || method === 'GET') await this.handlePing(req, res);
                else this.sendMethodNotAllowed(res, endpoint);
                break;
            case 'saveItems':
                if (method === 'POST') await this.handleSaveItems(req, res);
                else this.sendMethodNotAllowed(res, endpoint);
                break;
            case 'saveSnapshot':
                 if (method === 'POST') await this.handleSaveSnapshot(req, res);
                 else this.sendMethodNotAllowed(res, endpoint);
                 break;
            case 'saveAttachment':
            case 'saveStandaloneAttachment':
                 if (method === 'POST') await this.handleSaveAttachment(req, res, endpoint === 'saveStandaloneAttachment');
                 else this.sendMethodNotAllowed(res, endpoint);
                 break;
            case 'saveSingleFile':
                 if (method === 'POST') await this.handleSaveSingleFile(req, res);
                 else this.sendMethodNotAllowed(res, endpoint);
                 break;
            case 'getSelectedCollection':
                if (method === 'GET' || method === 'POST') this.handleGetSelectedCollection(req, res);
                else this.sendMethodNotAllowed(res, endpoint);
                break;
            case 'sessionProgress':
                 if (method === 'POST') await this.handleSessionProgress(req, res);
                 else this.sendMethodNotAllowed(res, endpoint);
                 break;
             case 'hasAttachmentResolvers':
                 if (method === 'POST') this.handleHasAttachmentResolvers(req, res);
                 else this.sendMethodNotAllowed(res, endpoint);
                 break;
             case 'saveAttachmentFromResolver':
                 if (method === 'POST') this.handleSaveAttachmentFromResolver(req, res);
                 else this.sendMethodNotAllowed(res, endpoint);
                 break;
            // Translator Endpoint Handling
            case 'getTranslatorCode':
            case 'getTranslators':
                 console.log(`Connector Server: Responding empty list for ${endpoint}`);
                 this.sendResponse(res, 200, []);
                 break;
            // Other Endpoints
            case 'delaySync':
            case 'updateSession':
                 console.log(`Connector Server: Acknowledging (No-Op) - ${endpoint}`);
                 this.sendResponse(res, 200, { status: 'acknowledged' });
                 break;
            case 'installStyle':
            case 'import':
            case 'getClientHostnames':
            case 'proxies':
                this.handleNotImplemented(res, `Endpoint '${endpoint}' likely not needed for Obsidian`);
                break;
            default:
                console.log(`Connector Server: Endpoint Not Found - ${endpoint}`);
                this.sendResponse(res, 404, { error: `Connector endpoint '/connector/${endpoint}' not found` });
        }
    }

    // --- Endpoint Handlers ---

    private async handlePing(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
       // ... (no changes needed) ...
        const clientVersion = req.headers['x-zotero-version'] || 'Unknown';
        const clientApiVersion = parseInt(req.headers['x-zotero-connector-api-version']?.toString() || '0', 10);

        console.log(`Connector Ping from v${clientVersion}, API v${clientApiVersion}`);

        let body = '';
        if (req.method === 'POST') {
             body = await this.readRequestBody(req);
             try {
                 const payload = JSON.parse(body);
                 if (payload.activeURL) {
                     console.log(`Connector reported active URL: ${payload.activeURL}`);
                 }
             } catch (e) { /* ignore */ }
        }

        if (clientApiVersion > CONNECTOR_API_VERSION_SUPPORTED) {
            console.warn(`Connector API version ${clientApiVersion} is newer than supported ${CONNECTOR_API_VERSION_SUPPORTED}`);
             this.sendResponse(res, 412, { error: 'Connector API version mismatch' });
            return;
        }

        const prefs = {
            downloadAssociatedFiles: true,
            automaticSnapshots: true,
            reportActiveURL: false,
            googleDocsAddNoteEnabled: false,
            googleDocsCitationExplorerEnabled: false,
            supportsAttachmentUpload: true, // CRUCIAL
            translatorsHash: "obsidian-plugin-static-hash-" + CONNECTOR_SERVER_VERSION,
            sortedTranslatorHash: "obsidian-plugin-static-hash-sorted-" + CONNECTOR_SERVER_VERSION
        };

        this.sendResponse(res, 200, {
            authenticated: false,
            loggedIn: false,
            storage: [1, 0, 0],
            prefs: prefs,
            version: ZOTERO_APP_NAME + ' ' + CONNECTOR_SERVER_VERSION
        });
    }

    private async handleSaveItems(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const body = await this.readRequestBody(req);
        let data;
        try { data = JSON.parse(body); } catch (e) { this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) { this.sendResponse(res, 400, { error: 'No items provided' }); return; }

        const sessionID = data.sessionID || crypto.randomUUID();
        const uri = data.uri || 'Unknown URI';
        const primaryItem = data.items[0];
        const receivedItemCount = data.items.length;

        // --- NEW: Calculate expected IDs ---
        const expectedAttachmentIds = new Set<string>();
        (primaryItem.attachments || []).forEach((att: any) => {
            if (att.linkMode !== 'linked_url' && att.id) {
                expectedAttachmentIds.add(att.id);
            }
        });
        // --- --------------------------- ---

        this.sessions.set(sessionID, {
            uri: uri,
            items: [primaryItem],
            startTime: Date.now(),
            attachmentStatus: {},
            initialRequestData: data,
            expectedAttachmentIds: expectedAttachmentIds, // Store the set
            eventDispatched: false
        });

        console.log(`Connector Server: Started session ${sessionID} for 1 item (received ${receivedItemCount}, initially expects ${expectedAttachmentIds.size} attachments) from ${uri}`);

        this.sendResponse(res, 200, { sessionID: sessionID });

        new Notice(`Receiving item from Zotero. Session: ${sessionID.substring(0, 8)}...`);
        // Don't dispatch or check completion here
    }

     private async handleSaveSnapshot(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
         const body = await this.readRequestBody(req);
         let data;
         try { data = JSON.parse(body); } catch (e) { this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }

         const sessionID = data.sessionID || crypto.randomUUID();
         const uri = data.url || 'Unknown URI';
         const title = data.title || 'Web Page Snapshot';

         const item = { /* ... create item ... */
              itemType: 'webpage',
              title: title,
              url: uri,
              accessDate: new Date().toISOString(),
              attachments: [], // Snapshot expected later
              tags: [],
              id: data.id || `webpage-${crypto.createHash('sha1').update(uri).digest('hex').substring(0, 10)}`
         };

         // --- NEW: Expect 1 attachment (the snapshot itself) ---
         // We don't know its ID yet, will add in saveSingleFile
         const expectedAttachmentIds = new Set<string>();
         // --- ---------------------------------------------- ---

         this.sessions.set(sessionID, {
              uri: uri,
              items: [item],
              startTime: Date.now(),
              attachmentStatus: {},
              initialRequestData: data,
              expectedAttachmentIds: expectedAttachmentIds, // Store empty set for now
              eventDispatched: false
         });

         console.log(`Connector Server: Started snapshot session ${sessionID} for ${uri}, expecting snapshot`);

         this.sendResponse(res, 200, { sessionID: sessionID });

         new Notice(`Receiving snapshot info for ${title}. Session: ${sessionID.substring(0, 8)}...`);
         // Don't dispatch or check completion here
     }

    private async handleSaveAttachment(req: http.IncomingMessage, res: http.ServerResponse, isStandalone: boolean): Promise<void> {
        const parsedUrl = url.parse(req.url || '', true);
        const sessionID = parsedUrl.query.sessionID as string;

        console.log(`Connector Server: handleSaveAttachment called for session ${sessionID}`);

        if (!sessionID) { /* ... */ this.sendResponse(res, 400, { error: 'sessionID query parameter is required' }); return; }
        const session = this.sessions.get(sessionID);
        if (!session) { /* ... */ this.sendResponse(res, 404, { error: 'Session not found or expired' }); return; }

        const metadataHeader = req.headers['x-metadata'] as string;
        const contentType = req.headers['content-type'] || 'application/octet-stream';
        let metadata: AttachmentMetadata = {};

        if (!metadataHeader) { /* ... */ this.sendResponse(res, 400, { error: 'X-Metadata header is required' }); return; }
        try { metadata = JSON.parse(metadataHeader); } catch (e) { /* ... */ this.sendResponse(res, 400, { error: 'Invalid X-Metadata header' }); return; }
        // console.log(`SaveAttachment: Parsed Metadata for session ${sessionID}:`, metadata);

        const attachmentId = metadata.id || crypto.randomUUID();
        const title = metadata.title || 'Attachment';
        const sourceUrlForFilename = metadata.url || session.uri;
        const filename = this.generateFilename(title, contentType, sourceUrlForFilename);
        const filePath = path.join(this.tempDir, filename);

        console.log(`Connector Server: Receiving attachment: ${title} (-> ${filePath}) for session ${sessionID}`);

        // --- NEW: Add this attachment ID to expected set if not present ---
        if (attachmentId && !session.expectedAttachmentIds.has(attachmentId)) {
             console.log(`SaveAttachment: Adding dynamically received attachment ${attachmentId} to expected set for session ${sessionID}`);
             session.expectedAttachmentIds.add(attachmentId);
        }
        // --- ---------------------------------------------------------- ---
        session.attachmentStatus[attachmentId] = { progress: 0, localPath: undefined, error: undefined };


        try {
            await pipeline(req, fs.createWriteStream(filePath));

            console.log(`Connector Server: Attachment saved locally: ${filePath} for session ${sessionID}`);
            session.attachmentStatus[attachmentId].progress = 100;
            session.attachmentStatus[attachmentId].localPath = filePath;

            // Update Item Data in Session
            const parentItemId = metadata.parentItemID || session.items[0]?.id;
            const parentItemIndex = session.items.findIndex(item => item.id === parentItemId);
            if (parentItemIndex > -1) {
                 const parentItem = session.items[parentItemIndex];
                 if (!parentItem.attachments) parentItem.attachments = [];
                 // Ensure the attachment has an ID before adding/updating
                 const currentAttachmentId = attachmentId; // Use the determined ID
                 const attachmentInfo = { id: currentAttachmentId, title: title, url: metadata.url, localPath: filePath, mimeType: contentType, parentItem: parentItemId, itemType: 'attachment', linkMode: 'imported_file' };
                 const existingIndex = parentItem.attachments.findIndex((att: any) => att.id === currentAttachmentId);
                 if (existingIndex > -1) parentItem.attachments[existingIndex] = { ...parentItem.attachments[existingIndex], ...attachmentInfo };
                 else parentItem.attachments.push(attachmentInfo);

                 // --- Ensure this attachment ID is in the expected set ---
                 if (!session.expectedAttachmentIds.has(currentAttachmentId)) {
                      session.expectedAttachmentIds.add(currentAttachmentId);
                      console.log(`SaveAttachment: Added ID ${currentAttachmentId} to expected set post-find.`);
                 }
                 // ------------------------------------------------------
            } else {
                 console.warn(`SaveAttachment: Could not find parent item ${parentItemId} in session ${sessionID}.`);
             }

            this.sessions.set(sessionID, session); // Update session map

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', filename: filename, canRecognize: contentType === 'application/pdf' && isStandalone }));

            this.checkAndDispatchIfComplete(sessionID); // Check AFTER responding

        } catch (error) {
            console.error(`Error saving attachment ${filename} for session ${sessionID}:`, error);
            session.attachmentStatus[attachmentId].progress = -1;
            session.attachmentStatus[attachmentId].error = error.message;
            this.sessions.set(sessionID, session);
            fs.unlink(filePath, () => {});
            this.sendResponse(res, 500, { error: 'Failed to save attachment' });

            this.checkAndDispatchIfComplete(sessionID); // Check even on error
        }
    }

    private async handleSaveSingleFile(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const body = await this.readRequestBody(req);
        let data;
        try { data = JSON.parse(body); } catch (e) { /* ... */ this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }

        const sessionID = data.sessionID;
        if (!sessionID) { /* ... */ this.sendResponse(res, 400, { error: 'sessionID is required' }); return; }
        const session = this.sessions.get(sessionID);
        if (!session) { /* ... */ this.sendResponse(res, 404, { error: 'Session not found or expired' }); return;}

        const snapshotContent = data.snapshotContent;
        if (typeof snapshotContent !== 'string') { /* ... */ this.sendResponse(res, 400, { error: 'Invalid snapshot content' }); return; }

        const title = data.title || session.items[0]?.title || 'Snapshot';
        // --- Determine ID more carefully ---
        const providedId = data.id;
        const existingSnapshotAttachment = session.items[0]?.attachments?.find((a: any) => a.mimeType === 'text/html');
        const attachmentId = providedId || existingSnapshotAttachment?.id || crypto.randomUUID();
        // --- ----------------------------- ---
        const filename = this.generateFilename(title, 'text/html', data.url || session.uri);
        const filePath = path.join(this.tempDir, filename);

        console.log(`Connector Server: Receiving snapshot: ${title} (-> ${filePath}) for session ${sessionID}`);

        // --- NEW: Add this snapshot ID to expected set ---
        if (attachmentId && !session.expectedAttachmentIds.has(attachmentId)) {
             console.log(`SaveSingleFile: Adding snapshot attachment ${attachmentId} to expected set for session ${sessionID}`);
             session.expectedAttachmentIds.add(attachmentId);
        }
        // --- ------------------------------------------- ---
        session.attachmentStatus[attachmentId] = { progress: 0, localPath: undefined, error: undefined };


        try {
            await fs.promises.writeFile(filePath, snapshotContent, 'utf-8');

            console.log(`Connector Server: Snapshot saved locally: ${filePath} for session ${sessionID}`);
            session.attachmentStatus[attachmentId].progress = 100;
            session.attachmentStatus[attachmentId].localPath = filePath;

             // Update Item Data in Session
             const parentItemIndex = 0;
             if (session.items.length > 0) {
                 const parentItem = session.items[parentItemIndex];
                 if (!parentItem.attachments) parentItem.attachments = [];
                 const attachmentInfo = { id: attachmentId, title: title, url: data.url || session.uri, localPath: filePath, mimeType: 'text/html', itemType: 'attachment', linkMode: 'imported_file', charset: 'utf-8' };
                 const existingIndex = parentItem.attachments.findIndex((att: any) => att.id === attachmentId || att.mimeType === 'text/html');
                 if (existingIndex > -1) parentItem.attachments[existingIndex] = { ...parentItem.attachments[existingIndex], ...attachmentInfo };
                 else parentItem.attachments.push(attachmentInfo);
             }

            this.sessions.set(sessionID, session); // Update session map

            res.writeHead(204); // Acknowledge
            res.end();

            this.checkAndDispatchIfComplete(sessionID); // Check AFTER responding

        } catch (error) {
            console.error(`Error saving snapshot ${filename} for session ${sessionID}:`, error);
             session.attachmentStatus[attachmentId].progress = -1;
             session.attachmentStatus[attachmentId].error = error.message;
             this.sessions.set(sessionID, session);
            fs.unlink(filePath, () => {});
            this.sendResponse(res, 500, { error: 'Failed to save snapshot' });

            this.checkAndDispatchIfComplete(sessionID); // Check even on error
        }
    }

    private handleGetSelectedCollection(req: http.IncomingMessage, res: http.ServerResponse): void {
       // ... (no changes needed) ...
        console.log("Connector Server: Handling getSelectedCollection");
        this.sendResponse(res, 200, {
            id: "obsidian",
            name: "Obsidian Vault",
            libraryID: 1,
            libraryEditable: true,
            filesEditable: true,
            targets: [
                 { id: "obsidian", name: "Obsidian Vault", type: "library", libraryID: 1, level: 0, filesEditable: true }
            ]
        });
    }

    private async handleSessionProgress(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const body = await this.readRequestBody(req);
        let data;
        try { data = JSON.parse(body); } catch (e) { this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }

        const sessionID = data.sessionID;
        if (!sessionID || !this.sessions.has(sessionID)) { this.sendResponse(res, 404, { error: 'Session not found' }); return; }

        const session = this.sessions.get(sessionID)!;
        console.log(`Connector Server: Handling sessionProgress for ${sessionID}`);

        // Wait a moment to ensure any in-progress attachments are processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Re-get session to ensure we have latest data
        const updatedSession = this.sessions.get(sessionID);
        if (!updatedSession) {
            // Session was deleted while we were waiting
            this.sendResponse(res, 404, { error: 'Session not found or expired' });
            return;
        }
        
        // Check if session is complete
        const isDone = this.isSessionComplete(updatedSession);

        // Build progress items for response
        const progressItems = (updatedSession.items || []).map(item => {
            const itemAttachments = Array.isArray(item.attachments) ? item.attachments : [];
            const attachmentProgressList: any[] = [];
            
            // Report status for all expected attachments
            for (const expectedId of updatedSession.expectedAttachmentIds) {
                const status = updatedSession.attachmentStatus[expectedId];
                const initialAttachment = itemAttachments.find((att:any) => att.id === expectedId);
                attachmentProgressList.push({
                    id: expectedId,
                    progress: status?.progress ?? 0, // Default to 0 if no status yet
                    error: status?.error,
                    // Include title if available from initial data
                    title: initialAttachment?.title
                });
            }
            
            return { 
                id: item.id || 'unknown-item', 
                progress: 100, 
                attachments: attachmentProgressList 
            };
        });

        // Log progress status
        console.log(`SessionProgress: Session ${sessionID} reporting isDone=${isDone}, with ${updatedSession.expectedAttachmentIds.size} expected attachments and ${progressItems[0]?.attachments?.length} reported attachments`);
        
        // Send response to Zotero
        this.sendResponse(res, 200, { items: progressItems, done: isDone });

        // If session is complete and event not yet dispatched, trigger the check
        if (isDone && !updatedSession.eventDispatched) {
            console.log(`SessionProgress: Session ${sessionID} determined complete, attempting dispatch.`);
            this.checkAndDispatchIfComplete(sessionID);
        }
        
        // Conditional cleanup after responding
        if (isDone) {
            setTimeout(() => {
                if (this.sessions.has(sessionID)) {
                    const currentSession = this.sessions.get(sessionID)!;
                    if (this.isSessionComplete(currentSession)) {
                        console.log(`Connector Server: Cleaning up completed session ${sessionID} after progress check.`);
                        this.sessions.delete(sessionID);
                    } else {
                        console.log(`Connector Server: Session ${sessionID} completion check failed before cleanup.`);
                    }
                }
            }, 5000);
        }
    }


    private handleHasAttachmentResolvers(req: http.IncomingMessage, res: http.ServerResponse): void {
       // ... (no changes needed) ...
        this.sendResponse(res, 200, false);
    }

    private handleSaveAttachmentFromResolver(req: http.IncomingMessage, res: http.ServerResponse): void {
       // ... (no changes needed) ...
        this.sendResponse(res, 501, { error: 'Attachment resolving not implemented' });
    }

    // --- Utility Methods ---

    private sendResponse(res: http.ServerResponse, statusCode: number, body: any): void {
       // ... (no changes needed) ...
         if (res.headersSent) {
            console.warn(`Connector Server: Attempted to send response for ${res.req.method} ${res.req.url} after headers were sent.`);
            return;
        }
        console.log(`Connector Server: Sending Response - ${statusCode} ${JSON.stringify(body).substring(0, 100)}...`);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(statusCode);
        res.end(JSON.stringify(body));
    }

    private sendMethodNotAllowed(res: http.ServerResponse, endpoint: string): void {
       // ... (no changes needed) ...
         console.warn(`Connector Server: Method Not Allowed - ${res.req.method} for /connector/${endpoint}`);
         this.sendResponse(res, 405, { error: 'Method Not Allowed' });
     }

     private handleNotImplemented(res: http.ServerResponse, reason: string = 'Not implemented'): void {
       // ... (no changes needed) ...
         console.warn(`Connector Server: Not Implemented - ${res.req.method} ${res.req.url} (${reason})`);
         this.sendResponse(res, 501, { error: 'Not Implemented', reason: reason });
     }

    private async readRequestBody(req: http.IncomingMessage): Promise<string> {
       // ... (no changes needed) ...
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks).toString('utf-8');
    }

    private generateFilename(title: string, mimeType: string, sourceUrl?: string): string {
       // ... (no changes needed) ...
        const extension = mimeType.split('/')[1]?.split('+')[0] ||
                           (mimeType === 'application/pdf' ? 'pdf' :
                           (mimeType === 'text/html' ? 'html' :
                           'bin'));
        const sanitizedTitle = (title || 'Untitled')
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\.+/g, '.')
            .replace(/[ _-]+$/, '')
            .replace(/^[ _.-]+/, '')
            .substring(0, 100);

         let baseName = sanitizedTitle;
         if (!baseName || baseName === '_' || title === 'Attachment' || title === 'Snapshot' || title === 'Untitled') {
              const hash = crypto.createHash('sha1').update(sourceUrl || crypto.randomUUID()).digest('hex').substring(0, 10);
              baseName = `attachment_${hash}`;
         }
        return `${baseName}.${extension}`;
    }

    /**
     * Dispatches the event *only if* the session is complete and the event hasn't been dispatched yet.
     * Adds a delay to handle cases where multiple attachments are being sent in quick succession.
     */
    private checkAndDispatchIfComplete(sessionID: string): void {
        const session = this.sessions.get(sessionID);
        if (!session) {
            console.warn(`checkAndDispatchIfComplete: Session ${sessionID} not found.`);
            return;
        }
        
        if (session.eventDispatched) {
            console.log(`checkAndDispatchIfComplete: Event for session ${sessionID} already dispatched.`);
            return;
        }

        // Check if session is complete
        if (this.isSessionComplete(session)) {
            console.log(`Session ${sessionID} appears complete and event not yet dispatched.`);
            
            // Add a small delay before dispatching to ensure all attachments are fully processed
            // This helps when multiple requests are coming in rapid succession
            setTimeout(() => {
                // Re-check session state after delay to be certain before dispatching
                const currentSession = this.sessions.get(sessionID);
                if (!currentSession || currentSession.eventDispatched) {
                    return; // Session was deleted or event already dispatched
                }
                
                // Double-check completeness
                if (this.isSessionComplete(currentSession) && currentSession.items.length > 0) {
                    // Get all successfully processed files
                    const savedFiles = Object.values(currentSession.attachmentStatus)
                        .filter(status => status.progress === 100 && status.localPath)
                        .map(status => status.localPath!);
                    
                    console.log(`After delay, dispatching event for session ${sessionID} with ${savedFiles.length} files`);
                    this.dispatchZoteroItemEvent(currentSession.items[0], savedFiles, sessionID);
                    
                    // Mark as dispatched to prevent duplicate events
                    currentSession.eventDispatched = true;
                    this.sessions.set(sessionID, currentSession);
                } else {
                    console.log(`After delay, session ${sessionID} is not ready for dispatch yet`);
                }
            }, 500); // 500ms delay before dispatching event
        } else {
            console.log(`checkAndDispatchIfComplete: Session ${sessionID} not complete yet.`);
        }
    }


    /**
     * Dispatches the custom event for the Obsidian plugin.
     * Sends a deep copy of the current state of the item from the session.
     */
    private dispatchZoteroItemEvent(item: any, newFiles: string[], sessionID: string): void {
        // ... (logic remains the same) ...
        if (typeof document === 'undefined') {
            console.warn("Connector Server: Cannot dispatch event, 'document' not available.");
            return;
        }

        const session = this.sessions.get(sessionID);
        if (!session) {
            console.error(`Cannot dispatch event: Session ${sessionID} not found.`);
            return;
        }

        const currentItemState = session.items.find(i => i.id === item.id);
        if (!currentItemState) {
             console.error(`Cannot dispatch event: Item ${item.id} not found in session ${sessionID}.`);
             return;
        }

        console.log(`Connector Server: Dispatching zotero-item-received for item ${currentItemState.id}, session ${sessionID}`);
        console.log(`Dispatching attachments:`, JSON.stringify(currentItemState.attachments || [], null, 2));

        const event = new CustomEvent('zotero-item-received', {
            detail: {
                item: JSON.parse(JSON.stringify(currentItemState)), // Deep copy
                files: newFiles,
                sessionID: sessionID
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Checks if all *expected* attachments have reported a final status (100 or -1).
     */
    private isSessionComplete(session: SessionData): boolean {
        if (!session || !session.items || session.items.length === 0) {
             console.log("isSessionComplete check: Session invalid or has no items.");
             return true; // No items/expectations = complete
         }
        if (!session.expectedAttachmentIds) {
             console.warn(`isSessionComplete check: Session ${session.items[0]?.id} missing expectedAttachmentIds set.`);
             return false; // Cannot determine completion without expectations
         }

         // --- NEW: Check against expectedAttachmentIds Set ---
         let processedCount = 0;
         let erroredCount = 0;
         let missingStatusCount = 0;

         for (const expectedId of session.expectedAttachmentIds) {
             const status = session.attachmentStatus[expectedId];
             if (status) {
                 if (status.progress === 100) {
                      processedCount++;
                 } else if (status.progress === -1) {
                      processedCount++; // Count errors as processed
                      erroredCount++;
                 }
                 // else status.progress < 100, means not complete yet
             } else {
                 // Status for an expected ID is missing, session is not complete
                 missingStatusCount++;
                 // console.log(`isSessionComplete check: Status missing for expected attachment ${expectedId}`);
             }
         }

         const isComplete = missingStatusCount === 0 && processedCount >= session.expectedAttachmentIds.size;
         // --- END NEW ---

         console.log(`isSessionComplete check for item ${session.items[0]?.id}: ` +
                     `Expected IDs Count=${session.expectedAttachmentIds.size}, ` +
                     `Processed (Done/Error)=${processedCount} (Errors: ${erroredCount}), ` +
                     `Missing Status Count=${missingStatusCount}. ` +
                     `Result=${isComplete}`);

         return isComplete;
    }


    private cleanupOldSessions(): void {
       // ... (no changes needed) ...
        const now = Date.now();
        console.log(`Connector Server: Running session cleanup (Current time: ${now}, Max age: ${SESSION_MAX_AGE}ms)`);
        let deletedCount = 0;
        for (const [sessionId, sessionData] of this.sessions.entries()) {
            if (now - sessionData.startTime > SESSION_MAX_AGE) {
                console.log(`Connector Server: Cleaning up expired session ${sessionId} (Started: ${sessionData.startTime})`);
                this.sessions.delete(sessionId);
                deletedCount++;
            }
        }
        if (deletedCount > 0) {
             console.log(`Connector Server: Cleaned up ${deletedCount} expired sessions.`);
         }
    }

} // End of ConnectorServer class
