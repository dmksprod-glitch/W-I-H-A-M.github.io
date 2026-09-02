/********************************************************************************
 * Audio engine: crossfades a looping ambient track per location (a place can
 * have several tracks, one of which is "active"), and plays one-shot sound
 * effects from that same location's soundboard. Both ambient tracks and
 * sound effects live on the place object (place.ambientTracks /
 * place.soundEffects) as base64 data URLs, exported/imported the same way
 * place background images already are. The header hosts both the ambient
 * controls and a soundboard popover for whichever place is currently
 * selected, so they're reachable from any tab - the Place-Editor is where a
 * location's tracks/effects are uploaded and managed. Volume/mute state is
 * session-only, like the page timer.
 ********************************************************************************/

const AMBIENT_FADE_MS = 1600;

const ambientSlots = [new Audio(), new Audio()];
ambientSlots.forEach(slot => {
    slot.loop = true;
    slot.preload = "auto";
});

let ambientActiveIndex = 0;
let ambientVolume = 0.6;
let ambientMuted = false;
let ambientPlaceId = undefined;
let ambientTrackId = undefined;

let sfxVolume = 0.9;
let sfxActiveInstances = [];

function clampVolume(volume) {
    return Math.min(1, Math.max(0, volume));
}

/**
 * Smoothly ramps an audio element's volume from its current value to
 * targetVolume over durationMs, then invokes onComplete.
 */
function fadeAudioElement(audioEl, targetVolume, durationMs, onComplete) {
    if (audioEl._fadeInterval) {
        clearInterval(audioEl._fadeInterval);
        audioEl._fadeInterval = null;
    }

    const startVolume = audioEl.volume;
    const target = clampVolume(targetVolume);
    const stepMs = 50;
    const steps = Math.max(1, Math.round(durationMs / stepMs));
    let step = 0;

    audioEl._fadeInterval = setInterval(() => {
        step++;
        const progress = Math.min(1, step / steps);
        audioEl.volume = clampVolume(startVolume + (target - startVolume) * progress);
        if (progress >= 1) {
            clearInterval(audioEl._fadeInterval);
            audioEl._fadeInterval = null;
            if (typeof onComplete === "function") onComplete();
        }
    }, stepMs);
}

function effectiveAmbientVolume() {
    return ambientMuted ? 0 : ambientVolume;
}

/**
 * Upgrades a place that still uses the old single-track ambient fields
 * (place.ambientSound / place.ambientSoundName) to the new ambientTracks
 * array, and guarantees place.soundEffects exists. Idempotent - safe to
 * call on every read.
 */
function ensurePlaceAmbientMigrated(place) {
    if (!place) return;

    if (!Array.isArray(place.ambientTracks)) {
        place.ambientTracks = [];
        if (place.ambientSound) {
            const track = {
                id: typeof generateID === "function" ? generateID() : String(Date.now()),
                name: place.ambientSoundName || "Ambiente",
                audio: place.ambientSound
            };
            place.ambientTracks.push(track);
            place.activeAmbientTrackId = track.id;
        } else {
            place.activeAmbientTrackId = place.activeAmbientTrackId || null;
        }
        delete place.ambientSound;
        delete place.ambientSoundName;
    }

    if (!Array.isArray(place.soundEffects)) {
        place.soundEffects = [];
    }
}

function getActiveAmbientTrack(place) {
    if (!place) return null;
    ensurePlaceAmbientMigrated(place);
    if (!place.ambientTracks.length) return null;
    return place.ambientTracks.find(t => t.id === place.activeAmbientTrackId) || place.ambientTracks[0];
}

// The currently active "situation" override (e.g. combat music), if any -
// see situationTracks in js/data.js. Not tied to any place; takes priority
// over whatever ambient track the current place would normally play. Not
// persisted - like mute/volume, it's live session state.
let situationOverrideId = null;

/**
 * Resolves what should actually be looping right now for the given place:
 * the active situation override if one is set, otherwise that place's own
 * active ambient track.
 */
function getEffectiveAmbientTrack(placeId) {
    if (situationOverrideId) {
        const situationTrack = situationTracks.find(t => t.id === situationOverrideId);
        if (situationTrack) return situationTrack;
        situationOverrideId = null; // track was deleted - fall back to normal ambient
    }
    const place = places.find(p => p.id === placeId);
    return getActiveAmbientTrack(place);
}

/**
 * Crossfades the looping ambient track to whatever should currently be
 * playing for the given place (its own ambient track, or a situation
 * override - see getEffectiveAmbientTrack). Safe to call repeatedly - it is
 * a no-op if the resolved track hasn't actually changed since the last call,
 * so moving between places while a situation override is active doesn't
 * restart it.
 */
function crossfadeAmbientForPlace(placeId) {
    const track = getEffectiveAmbientTrack(placeId);
    const trackId = track ? track.id : null;
    ambientPlaceId = placeId;

    if (trackId === ambientTrackId) {
        renderSoundUiSafe();
        return;
    }
    ambientTrackId = trackId;

    const outgoing = ambientSlots[ambientActiveIndex];
    const incoming = ambientSlots[1 - ambientActiveIndex];

    if (!outgoing.paused) {
        fadeAudioElement(outgoing, 0, AMBIENT_FADE_MS, () => outgoing.pause());
    }

    if (!track) {
        renderSoundUiSafe();
        return;
    }

    incoming.src = track.audio;
    incoming.currentTime = 0;
    incoming.volume = 0;
    const playPromise = incoming.play();
    if (playPromise && typeof playPromise.catch === "function") {
        // Autoplay can be blocked before the first user gesture; it will
        // start once the GM interacts with the page (e.g. changes location).
        playPromise.catch(() => {});
    }
    fadeAudioElement(incoming, effectiveAmbientVolume(), AMBIENT_FADE_MS);

    ambientActiveIndex = 1 - ambientActiveIndex;
    renderSoundUiSafe();
}

/**
 * Marks a track as the active one for a place. If that place is the
 * currently selected location, crossfades to it immediately (unless a
 * situation override is active, in which case this just updates which
 * track will resume once the override is cleared).
 */
function setActiveAmbientTrack(placeId, trackId) {
    const place = places.find(p => p.id === placeId);
    if (!place) return;
    ensurePlaceAmbientMigrated(place);
    place.activeAmbientTrackId = trackId;

    if (typeof locationSelect !== "undefined" && locationSelect.value === placeId) {
        crossfadeAmbientForPlace(placeId);
    } else {
        renderSoundUiSafe();
    }
}

/**
 * Activates a global situation track (e.g. combat music) as an override,
 * crossfading to it from whatever is currently playing - regardless of
 * place. Stays active across location changes until cleared.
 */
function setSituationOverride(trackId) {
    situationOverrideId = trackId;
    if (typeof locationSelect !== "undefined") {
        crossfadeAmbientForPlace(locationSelect.value);
    }
}

/**
 * Clears the situation override and crossfades back to the current place's
 * own ambient track.
 */
function clearSituationOverride() {
    situationOverrideId = null;
    if (typeof locationSelect !== "undefined") {
        crossfadeAmbientForPlace(locationSelect.value);
    }
}

/**
 * Adds a newly uploaded situation track to the global (place-independent)
 * library.
 */
function addSituationTrackFromFile(file, name) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const track = {
            id: generateID(),
            name: (name && name.trim()) ? name.trim() : file.name.replace(/\.[^/.]+$/, ""),
            audio: e.target.result
        };
        situationTracks.push(track);
        if (typeof renderCockpitSituationMusic === "function") renderCockpitSituationMusic();
        if (typeof saveAudioAsset === "function") saveAudioAsset(track.id, track.audio);
        if (typeof saveScenarioToDB === "function") saveScenarioToDB();
    };
    reader.readAsDataURL(file);
}

function deleteSituationTrack(trackId) {
    if (situationOverrideId === trackId) {
        clearSituationOverride();
    }
    situationTracks = situationTracks.filter(t => t.id !== trackId);
    if (typeof renderCockpitSituationMusic === "function") renderCockpitSituationMusic();
    if (typeof deleteAudioAsset === "function") deleteAudioAsset(trackId);
    if (typeof saveScenarioToDB === "function") saveScenarioToDB();
}

function setAmbientVolume(volume) {
    ambientVolume = clampVolume(volume);
    if (!ambientMuted) {
        ambientSlots[ambientActiveIndex].volume = ambientVolume;
    }
    renderSoundUiSafe();
}

function toggleAmbientMute() {
    ambientMuted = !ambientMuted;
    fadeAudioElement(ambientSlots[ambientActiveIndex], effectiveAmbientVolume(), 300);
    renderSoundUiSafe();
}

/**
 * Silences the background ambient loop and stops any playing sound effects
 * without losing the ambient track's playback position - used while the
 * Place Editor is open, so previewing an uploaded track/effect there never
 * overlaps with whatever is already playing for the live session.
 */
function pauseAmbientForEditor() {
    ambientSlots.forEach(slot => {
        if (!slot.paused) slot.pause();
    });
    stopAllSoundEffects();
}

/**
 * Resumes the ambient loop from wherever pauseAmbientForEditor left it, once
 * the GM leaves the Place Editor for any other view. Safe to call even if
 * nothing was paused (e.g. no ambient track configured yet).
 */
function resumeAmbientForEditor() {
    const activeSlot = ambientSlots[ambientActiveIndex];
    if (!activeSlot.src || !activeSlot.paused) return;
    const playPromise = activeSlot.play();
    if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
    }
}

/**
 * Plays a sound effect as a fresh, independent instance so overlapping or
 * repeated triggers don't cut each other off.
 */
function playSoundEffect(effect) {
    if (!effect || !effect.audio) return;
    const instance = new Audio(effect.audio);
    instance.volume = sfxVolume;
    sfxActiveInstances.push(instance);
    instance.addEventListener("ended", () => {
        sfxActiveInstances = sfxActiveInstances.filter(a => a !== instance);
    });
    const playPromise = instance.play();
    if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
    }
}

function stopAllSoundEffects() {
    sfxActiveInstances.forEach(instance => {
        instance.pause();
        instance.currentTime = 0;
    });
    sfxActiveInstances = [];
}

/**
 * Adds a newly uploaded sound effect to a place's soundboard.
 */
function addSoundEffectFromFile(place, file, name) {
    if (!file || !place) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        ensurePlaceAmbientMigrated(place);
        const effect = {
            id: generateID(),
            name: (name && name.trim()) ? name.trim() : file.name.replace(/\.[^/.]+$/, ""),
            audio: e.target.result
        };
        place.soundEffects.push(effect);
        renderSoundUiSafe();
        if (typeof renderPlaceSoundboard === "function") {
            renderPlaceSoundboard(place);
        }
        if (typeof saveAudioAsset === "function") {
            saveAudioAsset(effect.id, effect.audio);
        }
    };
    reader.readAsDataURL(file);
}

function deleteSoundEffect(place, effectId) {
    if (!place) return;
    place.soundEffects = (place.soundEffects || []).filter(effect => effect.id !== effectId);
    renderSoundUiSafe();
    if (typeof renderPlaceSoundboard === "function") {
        renderPlaceSoundboard(place);
    }
    if (typeof deleteAudioAsset === "function") {
        deleteAudioAsset(effectId);
    }
}

function renderSoundUiSafe() {
    renderHeaderAmbientControls();
    renderHeaderSoundboard();
    renderCockpitAmbientStatus();
    renderCockpitSoundboard();
    if (typeof renderCockpitSituationMusic === "function") {
        renderCockpitSituationMusic();
    }
}

/**
 * Renders the ambient mute/volume/track controls in the app header.
 */
function renderHeaderAmbientControls() {
    const muteBtn = document.getElementById("headerAmbientMuteBtn");
    if (muteBtn) {
        muteBtn.classList.toggle("muted", ambientMuted);
        muteBtn.innerHTML = `<span class="mdi mdi-volume-${ambientMuted ? "off" : "high"}"></span>`;
    }

    const volumeSlider = document.getElementById("headerAmbientVolume");
    if (volumeSlider && document.activeElement !== volumeSlider) {
        volumeSlider.value = Math.round(ambientVolume * 100);
    }

    const trackSelect = document.getElementById("headerAmbientTrackSelect");
    if (!trackSelect || typeof locationSelect === "undefined") return;

    const place = places.find(p => p.id === locationSelect.value);
    trackSelect.innerHTML = "";

    if (!place) {
        trackSelect.disabled = true;
        return;
    }

    ensurePlaceAmbientMigrated(place);

    if (!place.ambientTracks.length) {
        trackSelect.disabled = true;
        const opt = document.createElement("option");
        opt.textContent = t("headerAmbientNone");
        trackSelect.appendChild(opt);
        return;
    }

    trackSelect.disabled = false;
    place.ambientTracks.forEach(track => {
        const opt = document.createElement("option");
        opt.value = track.id;
        opt.textContent = track.name;
        opt.selected = track.id === place.activeAmbientTrackId;
        trackSelect.appendChild(opt);
    });
}

/**
 * Renders the read-only "Ambiente: <track>" status line inside the Cockpit.
 */
function renderCockpitAmbientStatus() {
    const statusEl = document.getElementById("cockpitAmbientStatus");
    if (!statusEl || typeof locationSelect === "undefined") return;

    const place = places.find(p => p.id === locationSelect.value);
    if (!place) {
        statusEl.textContent = t("cockpitNoPlace");
        return;
    }

    const track = getActiveAmbientTrack(place);
    statusEl.textContent = track
        ? `${t("cockpitAmbientPlaying")}: ${track.name}`
        : t("cockpitAmbientNone");
}

/**
 * Renders one soundboard grid (a set of clickable effect buttons with a
 * delete "x") from a given place's soundEffects list.
 */
function renderSoundboardGridForPlace(gridId, place) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.innerHTML = "";
    const placeEffects = place ? (ensurePlaceAmbientMigrated(place), place.soundEffects) : [];
    // Global effects are shown on every location's soundboard, ahead of that
    // place's own effects, so the same commonly-used sounds (dice roll,
    // applause, ...) don't need to be re-uploaded per place.
    const effects = [
        ...globalSoundEffects.map(effect => ({ effect, global: true })),
        ...placeEffects.map(effect => ({ effect, global: false }))
    ];

    if (!effects.length) {
        grid.innerHTML = `<p class="cockpit-empty">${t("cockpitSfxEmpty")}</p>`;
        return;
    }

    effects.forEach(({ effect, global }) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cockpit-sfx-btn";
        if (global) {
            btn.classList.add("cockpit-sfx-btn-global");
            btn.title = t("cockpitSfxGlobalHint");
        }

        const label = document.createElement("span");
        label.textContent = effect.name;
        btn.appendChild(label);

        if (global || place) {
            const del = document.createElement("span");
            del.className = "cockpit-sfx-del";
            del.innerHTML = "&times;";
            del.title = t("delete");
            del.addEventListener("click", (e) => {
                e.stopPropagation();
                if (global) {
                    deleteGlobalSoundEffect(effect.id);
                } else {
                    deleteSoundEffect(place, effect.id);
                }
            });
            btn.appendChild(del);
        }

        btn.addEventListener("click", () => playSoundEffect(effect));
        grid.appendChild(btn);
    });
}

/**
 * Adds a newly uploaded sound effect to the global (place-independent)
 * soundboard - it will show up on every location's soundboard grid.
 */
function addGlobalSoundEffectFromFile(file, name) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const effect = {
            id: generateID(),
            name: (name && name.trim()) ? name.trim() : file.name.replace(/\.[^/.]+$/, ""),
            audio: e.target.result
        };
        globalSoundEffects.push(effect);
        renderSoundUiSafe();
        if (typeof renderPlaceSoundboard === "function" && typeof currentEditedPlace !== "undefined" && currentEditedPlace) {
            renderPlaceSoundboard(currentEditedPlace);
        }
        if (typeof saveAudioAsset === "function") saveAudioAsset(effect.id, effect.audio);
        if (typeof saveScenarioToDB === "function") saveScenarioToDB();
    };
    reader.readAsDataURL(file);
}

function deleteGlobalSoundEffect(effectId) {
    globalSoundEffects = globalSoundEffects.filter(effect => effect.id !== effectId);
    renderSoundUiSafe();
    if (typeof renderPlaceSoundboard === "function" && typeof currentEditedPlace !== "undefined" && currentEditedPlace) {
        renderPlaceSoundboard(currentEditedPlace);
    }
    if (typeof deleteAudioAsset === "function") deleteAudioAsset(effectId);
    if (typeof saveScenarioToDB === "function") saveScenarioToDB();
}

/**
 * Renders the header's soundboard popover for the currently selected place.
 */
function renderHeaderSoundboard() {
    if (typeof locationSelect === "undefined") return;
    const place = places.find(p => p.id === locationSelect.value);

    const nameEl = document.getElementById("headerSfxPlaceName");
    if (nameEl) {
        nameEl.textContent = place ? (place.name || "") : t("cockpitNoPlace");
    }

    renderSoundboardGridForPlace("headerSfxGrid", place);
}

/**
 * Renders the Place-Editor's soundboard grid for the place being edited.
 */
function renderPlaceSoundboard(place) {
    renderSoundboardGridForPlace("placeSfxGrid", place);
}

/**
 * Renders the Cockpit's own soundboard grid for the currently selected
 * place, so the GM can trigger effects without opening the header popover.
 */
function renderCockpitSoundboard() {
    if (typeof locationSelect === "undefined") return;
    const place = places.find(p => p.id === locationSelect.value);
    renderSoundboardGridForPlace("cockpitSfxGrid", place);
}

document.getElementById("headerAmbientMuteBtn")?.addEventListener("click", toggleAmbientMute);

document.getElementById("headerAmbientVolume")?.addEventListener("input", (e) => {
    setAmbientVolume(e.target.value / 100);
});

document.getElementById("headerAmbientTrackSelect")?.addEventListener("change", (e) => {
    if (typeof locationSelect === "undefined") return;
    const place = places.find(p => p.id === locationSelect.value);
    if (place) setActiveAmbientTrack(place.id, e.target.value);
});

document.getElementById("headerStopSfx")?.addEventListener("click", stopAllSoundEffects);
document.getElementById("cockpitStopSfx")?.addEventListener("click", stopAllSoundEffects);

const headerSfxToggle = document.getElementById("headerSfxToggle");
const headerSfxPanel = document.getElementById("headerSfxPanel");

headerSfxToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    headerSfxPanel.classList.toggle("hidden");
});

document.addEventListener("click", () => {
    if (headerSfxPanel && !headerSfxPanel.classList.contains("hidden")) {
        headerSfxPanel.classList.add("hidden");
    }
});

headerSfxPanel?.addEventListener("click", (e) => e.stopPropagation());

document.getElementById("btnSituationTrackUpload")?.addEventListener("click", () => {
    document.getElementById("inputSituationTrackFile")?.click();
});

document.getElementById("inputSituationTrackFile")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const nameInput = document.getElementById("situationTrackName");
    addSituationTrackFromFile(file, nameInput ? nameInput.value : "");
    if (nameInput) nameInput.value = "";
    e.target.value = "";
});

document.getElementById("btnGlobalSfxUpload")?.addEventListener("click", () => {
    document.getElementById("inputGlobalSfxFile")?.click();
});

document.getElementById("inputGlobalSfxFile")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const nameInput = document.getElementById("globalSfxName");
    addGlobalSoundEffectFromFile(file, nameInput ? nameInput.value : "");
    if (nameInput) nameInput.value = "";
    e.target.value = "";
});
