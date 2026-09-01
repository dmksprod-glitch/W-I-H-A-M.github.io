/********************************************************************************
 * Local persistence: autosaves the current scenario into the browser's
 * IndexedDB so it survives a page reload without having to export/import a
 * ZIP every time. ZIP export/import keep working exactly as before - they
 * are just another way to move a scenario in or out, and importing one
 * immediately becomes the new autosaved state.
 ********************************************************************************/

const WIHAM_DB_NAME = "wiham_scenario_db";
const WIHAM_DB_VERSION = 1;
const WIHAM_STORE_NAME = "scenario";
const WIHAM_RECORD_KEY = "current";
const AUTOSAVE_INTERVAL_MS = 4000;

function openScenarioDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(WIHAM_DB_NAME, WIHAM_DB_VERSION);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(WIHAM_STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Writes the current in-memory scenario into IndexedDB, overwriting the
 * previous autosave.
 */
async function saveScenarioToDB() {
    try {
        const db = await openScenarioDB();
        const snapshot = { meta, npcs, objects, places, timeline, events, playerCharacters };
        await new Promise((resolve, reject) => {
            const tx = db.transaction(WIHAM_STORE_NAME, "readwrite");
            tx.objectStore(WIHAM_STORE_NAME).put(snapshot, WIHAM_RECORD_KEY);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        lastSavedAt = new Date();
        renderDbStatus();
    } catch (error) {
        console.error("Autosave failed:", error);
    }
}

/**
 * Reads the autosaved scenario, if any.
 */
async function loadScenarioFromDB() {
    const db = await openScenarioDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(WIHAM_STORE_NAME, "readonly");
        const request = tx.objectStore(WIHAM_STORE_NAME).get(WIHAM_RECORD_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Deletes the autosaved scenario.
 */
async function clearScenarioDB() {
    const db = await openScenarioDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(WIHAM_STORE_NAME, "readwrite");
        tx.objectStore(WIHAM_STORE_NAME).delete(WIHAM_RECORD_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

let lastSavedAt = null;

/**
 * Renders the sidebar's save-status line from the current translations and
 * the last known save time. Called after every save, and again whenever the
 * active language changes so it never gets stuck showing a raw i18n key.
 */
function renderDbStatus() {
    const el = document.getElementById("dbStatusText");
    if (!el) return;
    el.textContent = lastSavedAt
        ? `${t("dbStatusSaved")} · ${lastSavedAt.toLocaleTimeString()}`
        : t("dbStatusLoading");
}

/**
 * Re-renders every part of the UI from the current in-memory scenario state.
 * Shared by the DB restore on startup and by ZIP import, so both paths stay
 * in sync.
 */
function refreshAllScenarioUI() {
    loadMetadata();
    renderNPCListRight();
    renderdivObjectListRight();
    renderdivplaceListRight();
    unsavedTimeline = [...timeline];
    renderTimeline();
    renderdivEventListRight();
    populateLocationSelect();
    updateTimeDisplay(currentIndex);

    if (places.length > 0) {
        const defaultPlace = places.find(place => place.default === true) || places[0];
        locationSelect.value = defaultPlace.id;
        locationChanged();
    }

    renderdivInventoryListRight();
    enableDragAndDropTabs();
    if (typeof renderCockpit === "function") {
        renderCockpit();
    }
    if (typeof renderCharacterModalNav === "function") {
        renderCharacterModalNav();
    }
    if (typeof renderCharacterHandoffBanner === "function") {
        renderCharacterHandoffBanner();
    }
    if (typeof renderCockpitCharacterList === "function") {
        renderCockpitCharacterList();
    }
}

let autosaveInterval = null;

function startAutosaveLoop() {
    if (autosaveInterval) return;
    autosaveInterval = setInterval(saveScenarioToDB, AUTOSAVE_INTERVAL_MS);
}

/**
 * Restores the last autosaved scenario (if any), refreshes the UI, and
 * starts the background autosave loop. Runs once on startup.
 */
async function initScenarioFromDB() {
    renderDbStatus();
    try {
        const saved = await loadScenarioFromDB();
        if (saved) {
            meta = saved.meta || meta;
            npcs = saved.npcs || [];
            objects = saved.objects || [];
            places = saved.places || [];
            timeline = saved.timeline || [];
            events = saved.events || [];
            playerCharacters = saved.playerCharacters || [];

            // Sound effects used to be one global list, saved separately.
            // Reattach any leftovers from an older autosave to the default
            // place instead of losing them.
            if (saved.soundEffects && saved.soundEffects.length && places.length) {
                const defaultPlace = places.find(p => p.default === true) || places[0];
                if (typeof ensurePlaceAmbientMigrated === "function") {
                    ensurePlaceAmbientMigrated(defaultPlace);
                } else if (!Array.isArray(defaultPlace.soundEffects)) {
                    defaultPlace.soundEffects = [];
                }
                defaultPlace.soundEffects.push(...saved.soundEffects);
            }
        }
    } catch (error) {
        console.error("Could not load autosaved scenario:", error);
    }

    refreshAllScenarioUI();
    lastSavedAt = new Date();
    renderDbStatus();
    startAutosaveLoop();
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        saveScenarioToDB();
    }
});

window.addEventListener("beforeunload", () => {
    saveScenarioToDB();
});

document.getElementById("btnNewScenario").addEventListener("click", async () => {
    const confirmed = confirm(
        "Möchtest du wirklich ein neues Szenario beginnen? Die lokal gespeicherten Daten werden dabei gelöscht. Exportiere vorher, falls du sie behalten willst."
    );
    if (!confirmed) return;

    // Stop autosaving and clear in-memory state too, so a beforeunload save
    // triggered by the reload below can't resurrect the old scenario.
    if (autosaveInterval) {
        clearInterval(autosaveInterval);
        autosaveInterval = null;
    }
    meta = { name: "Scenario", ruleset: "htbah" };
    npcs = [];
    objects = [];
    places = [];
    timeline = [];
    events = [];
    playerCharacters = [];
    currentCharacterId = null;

    await clearScenarioDB();
    location.reload();
});

initScenarioFromDB();
