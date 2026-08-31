/********************************************************************************
 * Audio engine: crossfades a looping ambient track per location, and plays
 * one-shot sound effects on demand. Ambient tracks live on the place object
 * (place.ambientSound); sound effects live in the global soundEffects array.
 * Both are base64 data URLs, exported/imported the same way place background
 * images already are. Volume/mute state is session-only, like the page timer.
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
 * Crossfades the looping ambient track to the one configured on the given
 * place (or silence, if it has none). Safe to call repeatedly - it is a
 * no-op if the place hasn't actually changed since the last call.
 */
function crossfadeAmbientForPlace(placeId) {
    if (placeId === ambientPlaceId) return;
    ambientPlaceId = placeId;

    const place = places.find(p => p.id === placeId);
    const src = place?.ambientSound || null;

    const outgoing = ambientSlots[ambientActiveIndex];
    const incoming = ambientSlots[1 - ambientActiveIndex];

    if (!outgoing.paused) {
        fadeAudioElement(outgoing, 0, AMBIENT_FADE_MS, () => outgoing.pause());
    }

    if (!src) {
        renderCockpitSoundSafe();
        return;
    }

    incoming.src = src;
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
    renderCockpitSoundSafe();
}

function setAmbientVolume(volume) {
    ambientVolume = clampVolume(volume);
    if (!ambientMuted) {
        ambientSlots[ambientActiveIndex].volume = ambientVolume;
    }
}

function toggleAmbientMute() {
    ambientMuted = !ambientMuted;
    fadeAudioElement(ambientSlots[ambientActiveIndex], effectiveAmbientVolume(), 300);
    renderCockpitSoundSafe();
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

function addSoundEffectFromFile(file, name) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        soundEffects.push({
            id: generateID(),
            name: (name && name.trim()) ? name.trim() : file.name.replace(/\.[^/.]+$/, ""),
            audio: e.target.result
        });
        renderCockpitSoundSafe();
    };
    reader.readAsDataURL(file);
}

function deleteSoundEffect(id) {
    soundEffects = soundEffects.filter(effect => effect.id !== id);
    renderCockpitSoundSafe();
}

function renderCockpitSoundSafe() {
    if (typeof renderCockpitSound === "function") {
        renderCockpitSound();
    }
}

/**
 * Renders the ambient status line, mute/volume controls, and the sound
 * effect grid inside the Cockpit tab.
 */
function renderCockpitSound() {
    const statusEl = document.getElementById("cockpitAmbientStatus");
    if (statusEl) {
        const place = places.find(p => p.id === locationSelect.value);
        if (!place) {
            statusEl.textContent = t("cockpitNoPlace");
        } else if (place.ambientSound) {
            statusEl.textContent = `${t("cockpitAmbientPlaying")}: ${place.name || ""}`;
        } else {
            statusEl.textContent = t("cockpitAmbientNone");
        }
    }

    const muteBtn = document.getElementById("cockpitAmbientMuteBtn");
    if (muteBtn) {
        muteBtn.classList.toggle("muted", ambientMuted);
        muteBtn.innerHTML = `<span class="mdi mdi-volume-${ambientMuted ? "off" : "high"}"></span>`;
    }

    const volumeSlider = document.getElementById("cockpitAmbientVolume");
    if (volumeSlider && document.activeElement !== volumeSlider) {
        volumeSlider.value = Math.round(ambientVolume * 100);
    }

    const grid = document.getElementById("cockpitSfxGrid");
    if (grid) {
        grid.innerHTML = "";
        if (!soundEffects.length) {
            grid.innerHTML = `<p class="cockpit-empty">${t("cockpitSfxEmpty")}</p>`;
        } else {
            soundEffects.forEach(effect => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "cockpit-sfx-btn";

                const label = document.createElement("span");
                label.textContent = effect.name;

                const del = document.createElement("span");
                del.className = "cockpit-sfx-del";
                del.innerHTML = "&times;";
                del.title = t("delete");
                del.addEventListener("click", (e) => {
                    e.stopPropagation();
                    deleteSoundEffect(effect.id);
                });

                btn.appendChild(label);
                btn.appendChild(del);
                btn.addEventListener("click", () => playSoundEffect(effect));
                grid.appendChild(btn);
            });
        }
    }
}

document.getElementById("cockpitAmbientMuteBtn")?.addEventListener("click", toggleAmbientMute);

document.getElementById("cockpitAmbientVolume")?.addEventListener("input", (e) => {
    setAmbientVolume(e.target.value / 100);
});

document.getElementById("cockpitStopSfx")?.addEventListener("click", stopAllSoundEffects);

document.getElementById("btnCockpitSfxUpload")?.addEventListener("click", () => {
    document.getElementById("inputCockpitSfxFile").click();
});

document.getElementById("inputCockpitSfxFile")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    const nameInput = document.getElementById("cockpitSfxName");
    addSoundEffectFromFile(file, nameInput ? nameInput.value : "");
    if (nameInput) nameInput.value = "";
    e.target.value = "";
});
