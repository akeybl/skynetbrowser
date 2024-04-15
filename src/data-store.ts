import Store = require('electron-store');
const store = new Store();

const SESSIONS_KEY = "sessions";

interface Sessions {
    [key: string]: any;
}

export function storeSessionStr(pageName: string, sessionStr: string) {
    var sessions = store.get(SESSIONS_KEY) as Sessions | undefined;

    if (!sessions) {
        sessions = {};
    }

    sessions[pageName] = sessionStr;

    store.set(SESSIONS_KEY, sessions);
}

export function getSessionStr(pageName: string): string | null {
    var sessions = store.get(SESSIONS_KEY) as Sessions | undefined;

    if (!sessions) {
        sessions = {};
    }

    if (sessions != null && pageName in sessions) {
        return sessions[pageName];
    } else {
        return null;
    }
}

export function clearSessions() {
    store.delete(SESSIONS_KEY);
}

export function deleteSession(pageName: string) {
    var sessions = store.get(SESSIONS_KEY) as Sessions | undefined;

    if (!sessions) {
        return;
    }

    if (sessions !== null && pageName in sessions) {
        delete sessions[pageName];
    }
}