/********************************************************************************
 * Local persistence: autosaves the current scenario into the browser's
 * IndexedDB so it survives a page reload without having to export/import a
 * ZIP every time. ZIP export/import keep working exactly as before - they
 * are just another way to move a scenario in or out, and importing one
 * immediately becomes the new autosaved state.
 ********************************************************************************/

const WIHAM_DB_NAME = "wiham_scenario_db";
const WIHAM_DB_VERSION = 2;
const WIHAM_STORE_NAME = "scenario";
const WIHAM_AUDIO_STORE_NAME = "audioAssets";
const WIHAM_RECORD_KEY = "current";
const AUTOSAVE_INTERVAL_MS = 4000;

function openScenarioDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(WIHAM_DB_NAME, WIHAM_DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(WIHAM_STORE_NAME)) {
                db.createObjectStore(WIHAM_STORE_NAME);
            }
            if (!db.objectStoreNames.contains(WIHAM_AUDIO_STORE_NAME)) {
                db.createObjectStore(WIHAM_AUDIO_STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dataUrlToBlob(dataUrl) {
    return fetch(dataUrl).then(res => res.blob());
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/**
 * Persists a single ambient track's / sound effect's audio into its own
 * IndexedDB store, as a Blob rather than a base64 string. Called once per
 * upload/import - never from the periodic autosave - so large audio files
 * don't get re-cloned into IndexedDB every few seconds.
 */
async function saveAudioAsset(id, dataUrl) {
    if (!dataUrl) return;
    const blob = await dataUrlToBlob(dataUrl);
    const db = await openScenarioDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(WIHAM_AUDIO_STORE_NAME, "readwrite");
        tx.objectStore(WIHAM_AUDIO_STORE_NAME).put(blob, id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

async function deleteAudioAsset(id) {
    const db = await openScenarioDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(WIHAM_AUDIO_STORE_NAME, "readwrite");
        tx.objectStore(WIHAM_AUDIO_STORE_NAME).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

async function loadAllAudioAssets() {
    const db = await openScenarioDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(WIHAM_AUDIO_STORE_NAME, "readonly");
        const store = tx.objectStore(WIHAM_AUDIO_STORE_NAME);
        const keysRequest = store.getAllKeys();
        const valuesRequest = store.getAll();
        tx.oncomplete = () => {
            const map = new Map();
            keysRequest.result.forEach((key, i) => map.set(key, valuesRequest.result[i]));
            resolve(map);
        };
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Writes every ambient track's / sound effect's audio (across all places)
 * into the audio asset store in one transaction. Used after a bulk change
 * that bypasses the per-upload save path, e.g. a ZIP import.
 */
async function persistAllAudioAssets(currentPlaces) {
    const items = [];
    (currentPlaces || []).forEach(place => {
        (place.ambientTracks || []).forEach(track => {
            if (track.audio) items.push([track.id, track.audio]);
        });
        (place.soundEffects || []).forEach(effect => {
            if (effect.audio) items.push([effect.id, effect.audio]);
        });
    });
    if (!items.length) return;

    const blobs = await Promise.all(items.map(([, audio]) => dataUrlToBlob(audio)));
    const db = await openScenarioDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(WIHAM_AUDIO_STORE_NAME, "readwrite");
        const store = tx.objectStore(WIHAM_AUDIO_STORE_NAME);
        items.forEach(([id], i) => store.put(blobs[i], id));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Re-attaches audio (as base64 data URLs, for compatibility with playback
 * and ZIP export) from the audio asset store onto the in-memory places,
 * whose ambientTracks/soundEffects were loaded without their `audio` field
 * (see stripAudioForAutosave). Runs once at startup.
 */
async function restoreAudioAssetsIntoPlaces(currentPlaces) {
    const assetMap = await loadAllAudioAssets();
    if (!assetMap.size) return;

    const conversions = [];
    (currentPlaces || []).forEach(place => {
        (place.ambientTracks || []).forEach(track => {
            const blob = assetMap.get(track.id);
            if (blob) conversions.push(blobToDataUrl(blob).then(url => { track.audio = url; }));
        });
        (place.soundEffects || []).forEach(effect => {
            const blob = assetMap.get(effect.id);
            if (blob) conversions.push(blobToDataUrl(blob).then(url => { effect.audio = url; }));
        });
    });
    await Promise.all(conversions);
}

/**
 * Returns a shallow copy of places with each ambient track's / sound
 * effect's `audio` field removed. The audio itself lives in the separate
 * audioAssets store (see saveAudioAsset) - keeping it out of this snapshot
 * is what keeps the periodic autosave clone cheap regardless of how much
 * audio is loaded.
 */
function stripAudioForAutosave(currentPlaces) {
    return (currentPlaces || []).map(place => {
        if (!place.ambientTracks && !place.soundEffects) return place;
        return {
            ...place,
            ambientTracks: (place.ambientTracks || []).map(({ audio, ...rest }) => rest),
            soundEffects: (place.soundEffects || []).map(({ audio, ...rest }) => rest)
        };
    });
}

/**
 * Writes the current in-memory scenario into IndexedDB, overwriting the
 * previous autosave. Ambient/effect audio is excluded from this snapshot -
 * it is persisted separately, only when it actually changes - so this stays
 * cheap to clone even with many large audio files loaded.
 */
async function saveScenarioToDB() {
    try {
        const db = await openScenarioDB();
        const snapshot = {
            meta, npcs, objects,
            places: stripAudioForAutosave(places),
            timeline, events, playerCharacters
        };
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
        const tx = db.transaction([WIHAM_STORE_NAME, WIHAM_AUDIO_STORE_NAME], "readwrite");
        tx.objectStore(WIHAM_STORE_NAME).delete(WIHAM_RECORD_KEY);
        tx.objectStore(WIHAM_AUDIO_STORE_NAME).clear();
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

            await restoreAudioAssetsIntoPlaces(places);
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
