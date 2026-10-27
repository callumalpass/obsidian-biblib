import { App, Platform, Plugin } from 'obsidian';
import type { ConnectorServer } from '../connector-server';
import { StatusBarService } from '../status-bar-service';

jest.mock('obsidian', () => ({ Platform: { isMobile: false } }));

// Model the Obsidian element helpers without requiring a browser DOM.
function createStatusItem() {
    return {
        show: jest.fn(),
        hide: jest.fn(),
        empty: jest.fn(),
        addClass: jest.fn(),
        removeClass: jest.fn(),
        createSpan: jest.fn(() => ({ textContent: '' })),
        remove: jest.fn(),
        onclick: undefined as undefined | (() => Promise<void>),
        title: '',
    };
}

describe('Zotero status bar', () => {
    beforeEach(() => { Platform.isMobile = false; });

    function setup(server: ConnectorServer | null = null) {
        const item = createStatusItem();
        const addStatusBarItem = jest.fn(() => item);
        const plugin = { addStatusBarItem } as unknown as Plugin;
        const service = new StatusBarService({} as App, server);
        return { item, addStatusBarItem, plugin, service };
    }

    it('hides the entire item when the connector is disabled at startup', () => {
        const { service, plugin, item } = setup();
        service.addZoteroStatusBarItem(plugin);
        expect(item.hide).toHaveBeenCalledTimes(1);
        expect(item.show).not.toHaveBeenCalled();
        expect(item.createSpan).not.toHaveBeenCalled();
    });

    it('shows an already-running connector at startup', () => {
        const { service, plugin, item } = setup({} as ConnectorServer);
        service.addZoteroStatusBarItem(plugin);
        expect(item.show).toHaveBeenCalledTimes(1);
        expect(item.createSpan.mock.results[1].value.textContent).toBe('Zotero connector active');
    });

    it('shows and hides the same item across repeated start/stop cycles', () => {
        const { service, plugin, item, addStatusBarItem } = setup();
        service.addZoteroStatusBarItem(plugin);
        for (let i = 0; i < 3; i++) {
            service.setConnectorServer({} as ConnectorServer);
            service.setConnectorServer(null);
        }
        service.addZoteroStatusBarItem(plugin);
        expect(addStatusBarItem).toHaveBeenCalledTimes(1);
        expect(item.show).toHaveBeenCalledTimes(3);
        expect(item.hide).toHaveBeenCalledTimes(4);
    });

    it('preserves the click-to-toggle action when active', async () => {
        const { service, plugin, item } = setup({} as ConnectorServer);
        const toggle = jest.fn(async () => { service.setConnectorServer(null); });
        service.addZoteroStatusBarItem(plugin, toggle);
        await item.onclick?.();
        expect(toggle).toHaveBeenCalledTimes(1);
        expect(item.hide).toHaveBeenCalledTimes(1);
    });

    it('does not create a status item on mobile', () => {
        Platform.isMobile = true;
        const { service, plugin, addStatusBarItem } = setup();
        service.addZoteroStatusBarItem(plugin);
        expect(addStatusBarItem).not.toHaveBeenCalled();
    });
});
