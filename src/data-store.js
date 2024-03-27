const Store = require('electron-store');

const store = new Store();

const SESSIONS_KEY = "sessions";

function storeSessionStr(pageName, sessionStr) {
    var sessions = store.get("sessions");

    if (sessions == null) {
        sessions = {};
    }

    sessions[pageName] = sessionStr;

    store.set(SESSIONS_KEY, sessions);
}

function getSessionStr(pageName) {
    var sessions = store.get(SESSIONS_KEY);

    if (sessions != null && pageName in sessions) {
        return sessions[pageName];
    }
    else {
        return null;
    }
}

function clearSessions() {
    store.delete(SESSIONS_KEY);
}

function deleteSession(pageName) {
    var sessions = store.get(SESSIONS_KEY);

    if (sessions !== null && pageName in sessions) {
        delete sessions[pageName];
    }
}

module.exports = { storeSessionStr, getSessionStr, clearSessions, deleteSession };
