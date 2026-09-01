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

/**
 * Crossfades the looping ambient track to the active one configured on the
 * given place (or silence, if it has none). Safe to call repeatedly - it is
 * a no-op if neither the place nor its active track changed since the last
 * call.
 */
function crossfadeAmbientForPlace(placeId) {
    const place = places.find(p => p.id === placeId);
    const track = getActiveAmbientTrack(place);
    const trackId = track ? track.id : null;

    if (placeId === ambientPlaceId && trackId === ambientTrackId) return;
    ambientPlaceId = placeId;
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
 * currently selected location, crossfades to it immediately.
 */
function setActiveAmbientTrack(placeId, trackId) {
    const place = places.find(p => p.id === placeId);
    if (!place) return;
    ensurePlaceAmbientMigrated(place);
    place.activeAmbientTrackId = trackId;

    if (typeof locationSelect !== "undefined" && locationSelect.value === placeId) {
        ambientPlaceId = undefined; // force crossfadeAmbientForPlace to re-evaluate
        crossfadeAmbientForPlace(placeId);
    } else {
        renderSoundUiSafe();
    }
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
        place.soundEffects.push({
            id: generateID(),
            name: (name && name.trim()) ? name.trim() : file.name.replace(/\.[^/.]+$/, ""),
            audio: e.target.result
        });
        renderSoundUiSafe();
        if (typeof renderPlaceSoundboard === "function") {
            renderPlaceSoundboard(place);
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
}

function renderSoundUiSafe() {
    renderHeaderAmbientControls();
    renderHeaderSoundboard();
    renderCockpitAmbientStatus();
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
    const effects = place ? (ensurePlaceAmbientMigrated(place), place.soundEffects) : [];

    if (!effects.length) {
        grid.innerHTML = `<p class="cockpit-empty">${t("cockpitSfxEmpty")}</p>`;
        return;
    }

    effects.forEach(effect => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cockpit-sfx-btn";

        const label = document.createElement("span");
        label.textContent = effect.name;
        btn.appendChild(label);

        if (place) {
            const del = document.createElement("span");
            del.className = "cockpit-sfx-del";
            del.innerHTML = "&times;";
            del.title = t("delete");
            del.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteSoundEffect(place, effect.id);
            });
            btn.appendChild(del);
        }

        btn.addEventListener("click", () => playSoundEffect(effect));
        grid.appendChild(btn);
    });
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
