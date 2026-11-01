import { App, Notice } from 'obsidian';
import { BibliographyPluginSettings } from '../types/settings';
import { SessionItem, ZoteroAttachment } from '../types/citation';
import { errorMessage, getString, isRecord, UnknownRecord } from '../utils/type-guards';
import { 
    DEFAULT_ZOTERO_PORT, 
    LOCALHOST,
    NOTICE_DURATION_SHORT,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES
} from '../constants';

// --- Constants ---
const CONNECTOR_SERVER_VERSION = '1.0.7';
const ZOTERO_APP_NAME = 'Obsidian BibLib';
const CONNECTOR_API_VERSION_SUPPORTED = 3;
const SESSION_CLEANUP_INTERVAL = 600000; // 10 minutes
const SESSION_MAX_AGE = 1800000; // 30 minutes (extended for slow attachments)
// Open the modal anyway if attachments stop arriving for this long. Zotero sometimes replaces
// an announced attachment (e.g. an HTML snapshot) with one under a new ID, so the announced
// ID never arrives. Anything that lands later is sent as an additional attachment.
const ATTACHMENT_WAIT_TIMEOUT = 10000; // 10 seconds

// --- Interfaces ---
interface AttachmentStatus {
    progress: number;
    error?: string;
    localPath?: string;
}
interface SessionData {
    uri: string;
    items: SessionItem[];
    startTime: number;
    attachmentStatus: { [attachmentId: string]: AttachmentStatus };
    initialRequestData?: UnknownRecord;
    expectedAttachmentIds: Set<string>;
    eventDispatched: boolean;
    processedSnapshots: Set<string>; // Track processed HTML snapshots
    processedAttachmentPaths: Set<string>; // Track processed attachment paths
    completionTimer?: number; // Fallback dispatch if expected attachments never arrive
}
interface AttachmentMetadata {
    id?: string;
    url?: string;
    contentType?: string;
    parentItemID?: string;
    title?: string;
}

interface StoredAttachment extends ZoteroAttachment {
    localPath?: string;
    mimeType?: string;
    charset?: string;
}

interface NodeError extends Error {
    code?: string;
}

interface NodeRuntime {
    http: typeof import('http');
    fs: typeof import('fs');
    path: typeof import('path');
    url: typeof import('url');
    crypto: typeof import('crypto');
    os: typeof import('os');
    pipeline: (source: unknown, destination: unknown) => Promise<void>;
}

type IncomingMessage = import('http').IncomingMessage;
type ServerResponse = import('http').ServerResponse;

function requireNodeModule<T>(moduleName: string): T {
    const requireFn = (window as unknown as { require?: (id: string) => unknown }).require;
    if (!requireFn) {
        throw new Error('Node.js require is unavailable in this Obsidian runtime.');
    }
    return requireFn(moduleName) as T;
}

/**
 * A server that intercepts Zotero Connector requests to integrate with Obsidian.
 */
export class ConnectorServer {
    private server: ReturnType<NodeRuntime['http']['createServer']> | null = null;
    private app: App;
    private settings: BibliographyPluginSettings;
    private tempDir: string = '';
    private runtime: NodeRuntime | null = null;
    private sessions: Map<string, SessionData> = new Map();
    private processedSnapshots: Set<string> = new Set(); // Track processed HTML snapshots by session ID
    private processedAttachmentPaths: Map<string, string> = new Map(); // Track attachment paths by session+filename
    private cleanupIntervalId: number | null = null;

    constructor(app: App, settings: BibliographyPluginSettings) {
        this.app = app;
        this.settings = settings;
    }

    private async ensureNodeRuntime(): Promise<NodeRuntime> {
        if (this.runtime) {
            return this.runtime;
        }

        const http = requireNodeModule<typeof import('http')>('http');
        const fs = requireNodeModule<typeof import('fs')>('fs');
        const path = requireNodeModule<typeof import('path')>('path');
        const stream = requireNodeModule<typeof import('stream')>('stream');
        const url = requireNodeModule<typeof import('url')>('url');
        const crypto = requireNodeModule<typeof import('crypto')>('crypto');
        const os = requireNodeModule<typeof import('os')>('os');
        const util = requireNodeModule<typeof import('util')>('util');

        this.runtime = {
            http,
            fs,
            path,
            url,
            crypto,
            os,
            pipeline: util.promisify(stream.pipeline),
        };

        return this.runtime;
    }

    private get node(): NodeRuntime {
        if (!this.runtime) {
            throw new Error('Connector server runtime has not been initialized.');
        }
        return this.runtime;
    }

    private async ensureTempDir(): Promise<void> {
        const { fs, path, os } = await this.ensureNodeRuntime();
        this.tempDir = this.settings.tempPdfPath || path.join(os.tmpdir(), 'obsidian-bibliography');
        if (!fs.existsSync(this.tempDir)) {
            try {
                fs.mkdirSync(this.tempDir, { recursive: true });
            } catch (err) {
                console.error(`Failed to create temp directory ${this.tempDir}:`, err);
                new Notice(`Error: Could not create temp directory for Zotero Connector: ${this.tempDir}`);
            }
        }
    }

    public async start(): Promise<void> {
        if (this.server) {
            return;
        }

        await this.ensureTempDir();
        const { http } = this.node;
        const port = this.settings.zoteroConnectorPort || DEFAULT_ZOTERO_PORT;

        this.server = http.createServer((req, res) => {
            void this.handleRequest(req, res);
        });

        return new Promise((resolve, reject) => {
            this.server?.listen(port, LOCALHOST, () => {
                new Notice(`${SUCCESS_MESSAGES.ZOTERO_SERVER_STARTED} ${port}`);
                this.cleanupIntervalId = window.setInterval(() => this.cleanupOldSessions(), SESSION_CLEANUP_INTERVAL);
                resolve();
            });

            this.server?.on('error', (err: NodeError) => {
                console.error('Failed to start Zotero Connector server:', err);
                let message = `Failed to start Zotero Connector server: ${err.message}`;
                if (err.code === 'EADDRINUSE') {
                    message = `Failed to start Zotero Connector server: Port ${port} ${ERROR_MESSAGES.ZOTERO_PORT_IN_USE}`;
                } else if (err.code === 'EACCES') {
                     message = `Failed to start Zotero Connector server: ${ERROR_MESSAGES.ZOTERO_PORT_ACCESS_DENIED.replace('port', `port ${port}`)}`;
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
                window.clearInterval(this.cleanupIntervalId);
                this.cleanupIntervalId = null;
            }
            if (this.server) {
                this.server.close(() => {
                    new Notice('Zotero connector server stopped', NOTICE_DURATION_SHORT);
                    this.server = null;
                    for (const session of this.sessions.values()) {
                        if (session.completionTimer !== undefined) {
                            window.clearTimeout(session.completionTimer);
                        }
                    }
                    this.sessions.clear();
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Zotero-Version, X-Zotero-Connector-API-Version, X-Metadata, Authorization');
        res.setHeader('Access-Control-Expose-Headers', 'X-Zotero-Version');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const parsedUrl = this.node.url.parse(req.url || '', true);
        const pathname = parsedUrl.pathname || '';
        const method = req.method || 'GET';

        res.setHeader('X-Zotero-Version', ZOTERO_APP_NAME + ' ' + CONNECTOR_SERVER_VERSION);


        try {
            if (pathname.startsWith('/connector/')) {
                const endpoint = pathname.substring('/connector/'.length);
                await this.routeConnectorApi(endpoint, req, res);
            } else if (pathname === '/') {
                 this.sendResponse(res, 200, { message: 'Obsidian Bibliography Connector Server Running', version: CONNECTOR_SERVER_VERSION });
            }
             else {
                this.sendResponse(res, 404, { error: 'Not Found' });
            }
        } catch (error: unknown) {
            console.error(`Connector Server: Error handling ${method} ${pathname}:`, error);
            this.sendResponse(res, 500, { error: 'Internal Server Error', details: errorMessage(error) });
        }
    }

    private async routeConnectorApi(endpoint: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
        const method = req.method || 'GET';


        switch (endpoint) {
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
                 this.sendResponse(res, 200, []);
                 break;
            // Other Endpoints
            case 'delaySync':
            case 'updateSession':
                 this.sendResponse(res, 200, { status: 'acknowledged' });
                 break;
            case 'installStyle':
            case 'import':
            case 'getClientHostnames':
            case 'proxies':
                this.handleNotImplemented(res, `Endpoint '${endpoint}' likely not needed for Obsidian`);
                break;
            default:
                this.sendResponse(res, 404, { error: `Connector endpoint '/connector/${endpoint}' not found` });
        }
    }

    // --- Endpoint Handlers ---

    private async handlePing(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const clientApiVersion = parseInt(req.headers['x-zotero-connector-api-version']?.toString() || '0', 10);


        if (req.method === 'POST') {
             await this.readRequestBody(req);
        }

        if (clientApiVersion > CONNECTOR_API_VERSION_SUPPORTED) {
             this.sendResponse(res, 412, { error: 'Connector API version mismatch' });
            return;
        }

        const prefs = {
            downloadAssociatedFiles: true,
            automaticSnapshots: true,
            reportActiveURL: false,
            googleDocsAddNoteEnabled: false,
            googleDocsCitationExplorerEnabled: false,
            supportsAttachmentUpload: true,
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

    private async handleSaveItems(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const body = await this.readRequestBody(req);
        let data: unknown;
        try { data = JSON.parse(body) as unknown; } catch { this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }
        if (!isRecord(data) || !Array.isArray(data.items) || data.items.length === 0) { this.sendResponse(res, 400, { error: 'No items provided' }); return; }

        const sessionID = getString(data, 'sessionID') || this.node.crypto.randomUUID();
        const uri = getString(data, 'uri') || 'Unknown URI';
        const primaryItem = data.items[0] as SessionItem;

        // Calculate expected attachment IDs
        const expectedAttachmentIds = new Set<string>();
        (primaryItem.attachments || []).forEach((att: ZoteroAttachment) => {
            if (att.linkMode !== 'linked_url' && att.id) {
                expectedAttachmentIds.add(att.id);
            }
        });

        this.sessions.set(sessionID, {
            uri: uri,
            items: [primaryItem],
            startTime: Date.now(),
            attachmentStatus: {},
            initialRequestData: data,
            expectedAttachmentIds: expectedAttachmentIds,
            eventDispatched: false,
            processedSnapshots: new Set<string>(),
            processedAttachmentPaths: new Set<string>()
        });


        this.sendResponse(res, 200, { sessionID: sessionID });
        new Notice('Receiving item from Zotero.');

        // With no attachments to wait for (e.g. "Save without snapshot"), open the modal now
        this.checkAndDispatchIfComplete(sessionID);
    }

    private async handleSaveSnapshot(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const body = await this.readRequestBody(req);
        let data: unknown;
        try { data = JSON.parse(body) as unknown; } catch { this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }
        if (!isRecord(data)) { this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }

        const sessionID = getString(data, 'sessionID') || this.node.crypto.randomUUID();
        const uri = getString(data, 'url') || 'Unknown URI';
        const title = getString(data, 'title') || 'Web page snapshot';
        
        // Check if this session already exists
        const existingSession = this.sessions.get(sessionID);
        if (existingSession) {
            this.sendResponse(res, 200, { sessionID: sessionID });
            return;
        }

        const author = getString(data, 'author');
        const byline = getString(data, 'byline');
        const creators = Array.isArray(data.creators)
            ? data.creators
            : (author ? [{ creatorType: 'author', name: author }] :
              (byline ? [{ creatorType: 'author', name: byline }] : []));

        const item: SessionItem = { 
            itemType: 'webpage',
            title: title,
            url: uri,
            accessDate: new Date().toISOString(),
            attachments: [],
            tags: [],
            // Add creators array if available in the data or from URL metadata
            creators: creators as SessionItem['creators'],
            id: getString(data, 'id') || `webpage-${this.node.crypto.createHash('sha1').update(uri).digest('hex').substring(0, 10)}`
        };

        // Create a temporary ID for the expected HTML snapshot
        const tempSnapshotId = `html-snapshot-${this.node.crypto.randomUUID().substring(0, 8)}`;
        const expectedAttachmentIds = new Set<string>([tempSnapshotId]);

        this.sessions.set(sessionID, {
            uri: uri,
            items: [item],
            startTime: Date.now(),
            attachmentStatus: {
                [tempSnapshotId]: { progress: 0 }
            },
            initialRequestData: data,
            expectedAttachmentIds: expectedAttachmentIds,
            eventDispatched: false,
            processedSnapshots: new Set<string>(),
            processedAttachmentPaths: new Set<string>()
        });

        this.sendResponse(res, 200, { sessionID: sessionID });
        new Notice(`Receiving snapshot for ${title}.`);

        this.checkAndDispatchIfComplete(sessionID);
    }

    private async handleSaveAttachment(req: IncomingMessage, res: ServerResponse, isStandalone: boolean): Promise<void> {
        const parsedUrl = this.node.url.parse(req.url || '', true);
        const sessionID = parsedUrl.query.sessionID as string;

        if (!sessionID) { this.sendResponse(res, 400, { error: 'sessionID query parameter is required' }); return; }
        
        const session = this.sessions.get(sessionID);
        if (!session) { this.sendResponse(res, 404, { error: 'Session not found or expired' }); return; }

        const metadataHeaderValue = req.headers['x-metadata'];
        const metadataHeader = typeof metadataHeaderValue === 'string' ? metadataHeaderValue : undefined;
        const contentTypeHeader = req.headers['content-type'];
        const contentType = typeof contentTypeHeader === 'string' ? contentTypeHeader : 'application/octet-stream';
        
        if (!metadataHeader) { this.sendResponse(res, 400, { error: 'X-Metadata header is required' }); return; }
        
        let metadataPayload: unknown;
        try { metadataPayload = JSON.parse(metadataHeader) as unknown; } catch { this.sendResponse(res, 400, { error: 'Invalid X-Metadata header' }); return; }
        if (!isRecord(metadataPayload)) { this.sendResponse(res, 400, { error: 'Invalid X-Metadata header' }); return; }
        const metadata: AttachmentMetadata = {
            id: getString(metadataPayload, 'id'),
            url: getString(metadataPayload, 'url'),
            contentType: getString(metadataPayload, 'contentType'),
            parentItemID: getString(metadataPayload, 'parentItemID'),
            title: getString(metadataPayload, 'title'),
        };
        
        const attachmentId = metadata.id || this.node.crypto.randomUUID();
        const title = metadata.title || 'Attachment';
        const sourceUrlForFilename = metadata.url || session.uri;
        
        // Generate filename and path
        const filename = this.generateFilename(title, contentType, sourceUrlForFilename);
        const filePath = this.node.path.join(this.tempDir, filename);
        
        // IMPROVED: Multiple checks for duplicate attachments
        
        // 1. Check if this attachment ID has already been processed
        if (session.attachmentStatus[attachmentId]?.progress === 100 && session.attachmentStatus[attachmentId]?.localPath) {
            
            // Acknowledge with success
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'success', 
                filename: this.node.path.basename(session.attachmentStatus[attachmentId].localPath),
                canRecognize: contentType === 'application/pdf' && isStandalone 
            }));
            return;
        }
        
        // 2. Check for duplicate by path (if processedAttachmentPaths exists)
        if (session.processedAttachmentPaths && session.processedAttachmentPaths.has(filePath)) {
            
            // Find the attachment with this path
            const existingAttachment = Object.entries(session.attachmentStatus)
                .find(([id, status]) => status.localPath === filePath);
                
            if (existingAttachment) {
                // Link the new ID to the existing status
                session.attachmentStatus[attachmentId] = session.attachmentStatus[existingAttachment[0]];
                session.expectedAttachmentIds.add(attachmentId);
                
                // Acknowledge with success
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'success', 
                    filename: filename,
                    canRecognize: contentType === 'application/pdf' && isStandalone 
                }));
                return;
            }
        }
        
        // 3. Check for duplicate by content (title + URL + mime type)
        const parentItem = session.items[0];
        if (parentItem && parentItem.attachments) {
            const existingAttachment = (parentItem.attachments as StoredAttachment[]).find((att) => 
                att.title === title && 
                att.url === metadata.url && 
                att.mimeType === contentType &&
                // Make sure it has a valid status entry
                att.id && 
                session.attachmentStatus[att.id]?.progress === 100 &&
                session.attachmentStatus[att.id]?.localPath);
                
            if (existingAttachment && existingAttachment.id) {
                
                // Link the new ID to the existing attachment's status
                session.attachmentStatus[attachmentId] = { ...session.attachmentStatus[existingAttachment.id] };
                session.expectedAttachmentIds.add(attachmentId);
                
                // Acknowledge with success
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'success', 
                    filename: filename,
                    canRecognize: contentType === 'application/pdf' && isStandalone 
                }));
                return;
            }
        }

        
        // Add to expected attachment IDs if not already present
        if (!session.expectedAttachmentIds.has(attachmentId)) {
            session.expectedAttachmentIds.add(attachmentId);
        }
        
        // Initialize attachment status
        session.attachmentStatus[attachmentId] = { progress: 0 };
        this.armCompletionTimeout(sessionID);

        try {
            await this.node.pipeline(req, this.node.fs.createWriteStream(filePath));
            
            // Mark this attachment path as processed
            session.processedAttachmentPaths.add(filePath);
            
            session.attachmentStatus[attachmentId].progress = 100;
            session.attachmentStatus[attachmentId].localPath = filePath;

            // Update item data
            const parentItem = session.items[0];
            if (parentItem) {
                if (!parentItem.attachments) parentItem.attachments = [];
                
                // Create attachment info
                const attachmentInfo: StoredAttachment = { 
                    id: attachmentId, 
                    title: title, 
                    url: metadata.url, 
                    localPath: filePath, 
                    mimeType: contentType, 
                    parentItem: metadata.parentItemID || parentItem.id, 
                    itemType: 'attachment', 
                    linkMode: 'imported_file' 
                };
                
                // Check for existing attachment with same ID
                const existingIndex = parentItem.attachments.findIndex((att) => att.id === attachmentId);
                
                if (existingIndex > -1) {
                    // Update existing entry
                    parentItem.attachments[existingIndex] = { ...parentItem.attachments[existingIndex], ...attachmentInfo };
                } else {
                    // Add new entry
                    parentItem.attachments.push(attachmentInfo);
                }
            }

            this.sessions.set(sessionID, session);

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'success', 
                filename: filename, 
                canRecognize: contentType === 'application/pdf' && isStandalone 
            }));

            this.checkAndDispatchIfComplete(sessionID);
        } catch (error: unknown) {
            console.error(`Error saving attachment ${filename}:`, error);
            session.attachmentStatus[attachmentId].progress = -1;
            session.attachmentStatus[attachmentId].error = errorMessage(error);
            this.sessions.set(sessionID, session);
            this.node.fs.unlink(filePath, () => undefined);
            this.sendResponse(res, 500, { error: 'Failed to save attachment' });
            this.checkAndDispatchIfComplete(sessionID);
        }
    }

    private async handleSaveSingleFile(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const body = await this.readRequestBody(req);
        let data: unknown;
        try { data = JSON.parse(body) as unknown; } catch { this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }
        if (!isRecord(data)) { this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }

        const sessionID = getString(data, 'sessionID');
        if (!sessionID) { this.sendResponse(res, 400, { error: 'sessionID is required' }); return; }
        
        const session = this.sessions.get(sessionID);
        if (!session) { this.sendResponse(res, 404, { error: 'Session not found or expired' }); return; }

        const snapshotContent = data.snapshotContent;
        if (typeof snapshotContent !== 'string') { this.sendResponse(res, 400, { error: 'Invalid snapshot content' }); return; }

        const requestUrl = getString(data, 'url') || session.uri;
        const title = getString(data, 'title') || session.items[0]?.title || 'Snapshot';
        
        // IMPROVED: Check if we've already processed an HTML snapshot for this session
        // This is the key fix for preventing duplicate snapshots
        if (session.processedSnapshots && session.processedSnapshots.size > 0) {
            
            // Still acknowledge the request to keep Zotero happy
            res.writeHead(204);
            res.end();
            return;
        }
        
        // Extra fallback check for older sessions that might not have the processedSnapshots field
        const existingSnapshotAttachment = session.items[0]?.attachments?.find((attachment) => attachment.mimeType === 'text/html');
        if (existingSnapshotAttachment?.id && session.attachmentStatus[existingSnapshotAttachment.id]?.progress === 100) {
            
            // Still acknowledge the request to keep Zotero happy
            res.writeHead(204);
            res.end();
            return;
        }
        
        // Determine a stable ID for the snapshot
        const snapshotIdBase = this.node.crypto.createHash('md5').update(requestUrl).digest('hex').substring(0, 10);
        const attachmentId = getString(data, 'id') || `html-${snapshotIdBase}`;
        
        // Generate filename and path
        const filename = this.generateFilename(title, 'text/html', requestUrl);
        const filePath = this.node.path.join(this.tempDir, filename);

        
        // Find any temporary placeholder ID
        let tempSnapshotId: string | undefined;
        for (const id of session.expectedAttachmentIds) {
            if (id.startsWith('html-snapshot-')) {
                tempSnapshotId = id;
                break;
            }
        }
        
        // Replace placeholder ID with real ID
        if (tempSnapshotId && tempSnapshotId !== attachmentId) {
            session.expectedAttachmentIds.delete(tempSnapshotId);
            delete session.attachmentStatus[tempSnapshotId];
            session.expectedAttachmentIds.add(attachmentId);
        } else if (!session.expectedAttachmentIds.has(attachmentId)) {
            session.expectedAttachmentIds.add(attachmentId);
        }
        
        // Initialize attachment status
        session.attachmentStatus[attachmentId] = { progress: 0 };
        this.armCompletionTimeout(sessionID);
        
        try {
            await this.node.fs.promises.writeFile(filePath, snapshotContent, 'utf-8');
            
            // Mark this snapshot as processed
            session.processedSnapshots.add(attachmentId);
            
            session.attachmentStatus[attachmentId].progress = 100;
            session.attachmentStatus[attachmentId].localPath = filePath;

            // Update item data
            const parentItem = session.items[0];
            if (parentItem) {
                if (!parentItem.attachments) parentItem.attachments = [];
                
                const attachmentInfo: StoredAttachment = { 
                    id: attachmentId, 
                    title: title, 
                    url: requestUrl, 
                    localPath: filePath, 
                    mimeType: 'text/html', 
                    itemType: 'attachment', 
                    linkMode: 'imported_file', 
                    charset: 'utf-8' 
                };
                
                // Remove any existing HTML snapshots
                const existingIndex = parentItem.attachments.findIndex((att) => 
                    att.mimeType === 'text/html' || att.id === attachmentId);
                    
                if (existingIndex > -1) {
                    parentItem.attachments[existingIndex] = attachmentInfo;
                } else {
                    parentItem.attachments.push(attachmentInfo);
                }
            }

            this.sessions.set(sessionID, session);

            res.writeHead(204);
            res.end();

            this.checkAndDispatchIfComplete(sessionID);
        } catch (error: unknown) {
            console.error(`Error saving snapshot ${filename}:`, error);
            session.attachmentStatus[attachmentId].progress = -1;
            session.attachmentStatus[attachmentId].error = errorMessage(error);
            this.sessions.set(sessionID, session);
            this.node.fs.unlink(filePath, () => undefined);
            this.sendResponse(res, 500, { error: 'Failed to save snapshot' });
            this.checkAndDispatchIfComplete(sessionID);
        }
    }

    private handleGetSelectedCollection(req: IncomingMessage, res: ServerResponse): void {
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

    private async handleSessionProgress(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const body = await this.readRequestBody(req);
        let data: unknown;
        try { data = JSON.parse(body) as unknown; } catch { this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }
        if (!isRecord(data)) { this.sendResponse(res, 400, { error: 'Invalid JSON data' }); return; }

        const sessionID = getString(data, 'sessionID');
        if (!sessionID || !this.sessions.has(sessionID)) { this.sendResponse(res, 404, { error: 'Session not found' }); return; }

        const session = this.sessions.get(sessionID)!;
        
        // Wait briefly to allow any in-progress attachments to be processed
        await new Promise(resolve => window.setTimeout(resolve, 500));
        
        // Check if session is complete
        const isDone = this.isSessionComplete(session);

        // Build progress items for response
        const progressItems = session.items.map(item => {
            const attachmentProgressList: unknown[] = [];
            
            for (const expectedId of session.expectedAttachmentIds) {
                const status = session.attachmentStatus[expectedId];
                const initialAttachment = (item.attachments || []).find((att) => att.id === expectedId);
                attachmentProgressList.push({
                    id: expectedId,
                    progress: status?.progress ?? 0,
                    error: status?.error,
                    title: initialAttachment?.title
                });
            }
            
            return { 
                id: item.id || 'unknown-item', 
                progress: 100, 
                attachments: attachmentProgressList 
            };
        });

        // Send response to Zotero
        this.sendResponse(res, 200, { items: progressItems, done: isDone });

        // If session is complete and event not yet dispatched, trigger dispatch
        if (isDone && !session.eventDispatched) {
            this.checkAndDispatchIfComplete(sessionID);
        }
    }

    private handleHasAttachmentResolvers(req: IncomingMessage, res: ServerResponse): void {
        this.sendResponse(res, 200, false);
    }

    private handleSaveAttachmentFromResolver(req: IncomingMessage, res: ServerResponse): void {
        this.sendResponse(res, 501, { error: 'Attachment resolving not implemented' });
    }

    // --- Utility Methods ---

    private sendResponse(res: ServerResponse, statusCode: number, body: unknown): void {
        if (res.headersSent) {
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(statusCode);
        res.end(JSON.stringify(body));
    }

    private sendMethodNotAllowed(res: ServerResponse, _endpoint: string): void {
        this.sendResponse(res, 405, { error: 'Method Not Allowed' });
    }

    private handleNotImplemented(res: ServerResponse, reason: string = 'Not implemented'): void {
        this.sendResponse(res, 501, { error: 'Not Implemented', reason: reason });
    }

    private async readRequestBody(req: IncomingMessage): Promise<string> {
        const chunks: Uint8Array[] = [];
        for await (const chunk of req) {
            if (typeof chunk === 'string' || chunk instanceof Uint8Array) {
                chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
            }
        }
        const totalLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
        const body = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            body.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return new TextDecoder('utf-8').decode(body);
    }

    private generateFilename(title: string, mimeType: string, sourceUrl?: string): string {
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
            // Create a deterministic hash from the source URL or title to help with duplicate detection
            // This ensures the same source always gets the same filename, helping deduplication
            const sourceData = sourceUrl || title || this.node.crypto.randomUUID();
            const hash = this.node.crypto.createHash('sha1').update(sourceData).digest('hex').substring(0, 10);
            baseName = `attachment_${hash}`;
        }
        return `${baseName}.${extension}`;
    }

    private checkAndDispatchIfComplete(sessionID: string): void {
        const session = this.sessions.get(sessionID);
        if (!session) return;
        
        if (session.eventDispatched) return;

        // Check if session is complete
        if (this.isSessionComplete(session)) {
            this.dispatchSession(sessionID);
        } else {
            this.armCompletionTimeout(sessionID);
        }
    }

    /**
     * (Re)start the fallback timer that dispatches a session whose expected
     * attachments stop arriving.
     */
    private armCompletionTimeout(sessionID: string): void {
        const session = this.sessions.get(sessionID);
        if (!session || session.eventDispatched) return;

        if (session.completionTimer !== undefined) {
            window.clearTimeout(session.completionTimer);
        }
        session.completionTimer = window.setTimeout(() => {
            session.completionTimer = undefined;
            this.dispatchSession(sessionID);
        }, ATTACHMENT_WAIT_TIMEOUT);
    }

    private dispatchSession(sessionID: string): void {
        const session = this.sessions.get(sessionID);
        if (!session || session.eventDispatched) return;

        if (session.completionTimer !== undefined) {
            window.clearTimeout(session.completionTimer);
            session.completionTimer = undefined;
        }

        // Get successfully processed files
        const savedFiles = Object.values(session.attachmentStatus)
            .filter(status => status.progress === 100 && status.localPath)
            .map(status => status.localPath!);
        
        // Dispatch event
        this.dispatchZoteroItemEvent(session.items[0], savedFiles, sessionID);
        
        // Mark as dispatched but keep the session alive
        // This is a key change - we don't delete the session here
        session.eventDispatched = true;
        this.sessions.set(sessionID, session);
        
        // Set up monitoring for additional attachments
        this.monitorForAdditionalAttachments(sessionID, savedFiles.length);
    }

    /**
     * Monitor for additional attachments that might arrive late
     */
    private monitorForAdditionalAttachments(sessionID: string, alreadyDispatchedCount: number): void {
        let checkCount = 0;
        let lastFileCount = alreadyDispatchedCount;
        
        
        const monitor = window.setInterval(() => {
            checkCount++;
            const session = this.sessions.get(sessionID);
            
            if (!session) {
                window.clearInterval(monitor);
                return;
            }
            
            // Get currently completed files
            const currentFiles = Object.values(session.attachmentStatus)
                .filter(status => status.progress === 100 && status.localPath)
                .map(status => status.localPath!);
            
            // Check if we have new completed files since last check
            if (currentFiles.length > lastFileCount) {
                
                // Dispatch additional files event
                this.dispatchAdditionalAttachments(session.items[0]?.id || 'unknown-item',
                    currentFiles.slice(lastFileCount), sessionID);
                
                lastFileCount = currentFiles.length;
            }
            
            // Monitor for up to 5 minutes (300 checks at 1 second each)
            if (checkCount >= 300) {
                window.clearInterval(monitor);
            }
        }, 1000); // Check every second
    }
    
    /**
     * Dispatch event for additional attachments
     */
    private dispatchAdditionalAttachments(itemId: string, newFiles: string[], sessionID: string): void {
        if (typeof activeDocument === 'undefined') return;
        
        
        const event = new CustomEvent('zotero-additional-attachments', {
            detail: {
                itemId: itemId,
                files: newFiles,
                sessionID: sessionID
            }
        });
        activeDocument.dispatchEvent(event);
    }

    /**
     * Dispatches the main event with item data
     */
    private dispatchZoteroItemEvent(item: SessionItem, newFiles: string[], sessionID: string): void {
        if (typeof activeDocument === 'undefined') return;

        const session = this.sessions.get(sessionID);
        if (!session) return;

        const currentItemState = session.items.find(i => i.id === item.id);
        if (!currentItemState) return;


        const event = new CustomEvent('zotero-item-received', {
            detail: {
                item: JSON.parse(JSON.stringify(currentItemState)) as unknown, // Deep copy
                files: newFiles,
                sessionID: sessionID
            }
        });
        activeDocument.dispatchEvent(event);
    }

    /**
     * Checks if all expected attachments have reported a final status
     */
    private isSessionComplete(session: SessionData): boolean {
        if (!session || !session.items || session.items.length === 0) return true;
        if (!session.expectedAttachmentIds || session.expectedAttachmentIds.size === 0) return true;

        let processedCount = 0;

        for (const expectedId of session.expectedAttachmentIds) {
            const status = session.attachmentStatus[expectedId];
            if (status && (status.progress === 100 || status.progress === -1)) {
                processedCount++;
            }
        }

        return processedCount >= session.expectedAttachmentIds.size;
    }

    private cleanupOldSessions(): void {
        const now = Date.now();
        let deletedCount = 0;
        
        for (const [sessionId, sessionData] of this.sessions.entries()) {
            // Only clean up sessions that have been dispatched
            if (sessionData.eventDispatched && now - sessionData.startTime > SESSION_MAX_AGE) {
                this.sessions.delete(sessionId);
                deletedCount++;
            }
        }
        
        void deletedCount;
    }
} // End of ConnectorServer class
