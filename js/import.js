// Listens for a scenario import when user clicks the import button
document.getElementById("btnImportScenario").addEventListener("click", () => {
    document.getElementById("importFileInput").click();
});

/**
 * Opens the selected zip file and calls 'importScenario' to process its contents.
 */
document.getElementById("importFileInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (file) {
        const jszip = new JSZip();
        const content = await jszip.loadAsync(file);
        importScenario(content);
    }
});

/**
 * Imports various scenario files from the provided ZIP content.
 * Attempts to parse meta, NPCs, objects, places, timeline, and events data.
 * Handles images embedded in an 'images' folder and updates the UI.
 */
async function importScenario(zipContent) {
    try {
        // Import metadata
        try {
            const meatadata = await zipContent.file("meta.json").async("string");
            meta = JSON.parse(meatadata);
        } catch {
            showNotification({
                type: "warning",
                content: "<strong>Warning:</strong> Metadata could not be imported!",
                duration: 3000
            });
        }

        // Import NPCs
        try {
            const npcsData = await zipContent.file("npcs.json").async("string");
            npcs = JSON.parse(npcsData);
        } catch {
            showNotification({
                type: "warning",
                content: "<strong>Warning:</strong> NPCs could not be imported!",
                duration: 3000
            });
        }

        // Import objects
        try {
            const objectsData = await zipContent.file("objects.json").async("string");
            objects = JSON.parse(objectsData).map(obj => ({
                ...obj,
                position: obj.position
                    ? {
                        type: obj.position.type,
                        targetId: obj.position.targetId,
                        x: obj.position.type === "place" ? obj.position.x : undefined,
                        y: obj.position.type === "place" ? obj.position.y : undefined
                    }
                    : null
            }));
        } catch {
            showNotification({
                type: "warning",
                content: "<strong>Warning:</strong> Objects could not be imported!",
                duration: 3000
            });
        }

        // Import places
        try {
            const placesData = await zipContent.file("places.json").async("string");
            places = JSON.parse(placesData);
        } catch {
            showNotification({
                type: "warning",
                content: "<strong>Warning:</strong> Places could not be imported!",
                duration: 3000
            });
        }

        // Import timeline
        try {
            const timelineData = await zipContent.file("timeline.json").async("string");
            timeline = JSON.parse(timelineData);
        } catch {
            showNotification({
                type: "warning",
                content: "<strong>Warning:</strong> Timeline could not be imported!",
                duration: 3000
            });
        }

        // Import events
        try {
            const eventsData = await zipContent.file("events.json").async("string");
            events = JSON.parse(eventsData).map(ev => ({
                ...ev,
                conditions: ev.conditions || []
            }));
        } catch {
            showNotification({
                type: "warning",
                content: "<strong>Warning:</strong> Events could not be imported!",
                duration: 3000
            });
        }

        // Sound effects used to be one global list (soundeffects.json); they
        // now live per-place. If this ZIP predates that, keep the legacy
        // list around so it can be reattached to the default place once
        // places are loaded, instead of silently losing it.
        let legacyGlobalEffects = [];
        try {
            const soundEffectsData = await zipContent.file("soundeffects.json").async("string");
            legacyGlobalEffects = JSON.parse(soundEffectsData).map(effect => ({ ...effect, audio: null }));
        } catch {
            legacyGlobalEffects = [];
        }

        // Process images from the 'images' folder
        const imagesFolder = zipContent.folder("images");
        if (imagesFolder) {
            for (const filePath of Object.keys(zipContent.files)) {
                if (filePath.startsWith("images/")) {
                    const file = zipContent.file(filePath);
                    if (file) {
                        const base64Image = await file.async("base64");
                        const [type, idWithExtension] = filePath.split("/")[1].split("_");
                        const id = idWithExtension.split(".")[0];
                        const image = `data:image/png;base64,${base64Image}`;

                        // Attach image to NPC, object, or place based on filename
                        if (type === "npc") {
                            const npc = npcs.find(n => n.id === id);
                            if (npc) npc.image = image;
                        } else if (type === "object") {
                            const obj = objects.find(o => o.id === id);
                            if (obj) obj.image = image;
                        } else if (type === "place") {
                            const place = places.find(p => p.id === id);
                            if (place) place.background = image;
                        }
                    }
                }
            }
        }

        // Process ambient/effect audio from the 'sounds' folder:
        //   ambient_<placeId>_<trackId>.mp3  - one of a place's ambient tracks
        //   effect_<placeId>_<effectId>.mp3  - one of a place's soundboard effects
        // Two older, already-shipped formats are also recognized so nothing
        // gets silently lost on import:
        //   place_<placeId>.mp3  - a place's single legacy ambient track
        //                          (ensurePlaceAmbientMigrated upgrades it later)
        //   effect_<id>.mp3      - a legacy *global* effect (see legacyGlobalEffects
        //                          above); collected here and reattached to the
        //                          default place below.
        const legacyGlobalEffectAudio = {};
        const soundsFolder = zipContent.folder("sounds");
        if (soundsFolder) {
            for (const filePath of Object.keys(zipContent.files)) {
                if (filePath.startsWith("sounds/")) {
                    const file = zipContent.file(filePath);
                    if (file) {
                        const base64Audio = await file.async("base64");
                        const basename = filePath.split("/")[1].replace(/\.[^.]+$/, "");
                        const parts = basename.split("_");
                        const type = parts[0];
                        const audio = `data:audio/mpeg;base64,${base64Audio}`;

                        if (type === "ambient" && parts.length >= 3) {
                            const placeId = parts[1];
                            const trackId = parts.slice(2).join("_");
                            const place = places.find(p => p.id === placeId);
                            const track = place?.ambientTracks?.find(t => t.id === trackId);
                            if (track) track.audio = audio;
                        } else if (type === "effect" && parts.length >= 3) {
                            const placeId = parts[1];
                            const effectId = parts.slice(2).join("_");
                            const place = places.find(p => p.id === placeId);
                            const effect = place?.soundEffects?.find(e => e.id === effectId);
                            if (effect) effect.audio = audio;
                        } else if (type === "effect") {
                            legacyGlobalEffectAudio[parts[1]] = audio;
                        } else if (type === "place") {
                            const placeId = parts[1];
                            const place = places.find(p => p.id === placeId);
                            if (place) place.ambientSound = audio;
                        }
                    }
                }
            }
        }

        // Reattach any legacy global effects to the default place so they
        // survive the move to per-place soundboards.
        if (legacyGlobalEffects.length && places.length) {
            const defaultPlace = places.find(p => p.default === true) || places[0];
            if (typeof ensurePlaceAmbientMigrated === "function") {
                ensurePlaceAmbientMigrated(defaultPlace);
            } else if (!Array.isArray(defaultPlace.soundEffects)) {
                defaultPlace.soundEffects = [];
            }
            legacyGlobalEffects.forEach(effect => {
                defaultPlace.soundEffects.push({
                    ...effect,
                    audio: legacyGlobalEffectAudio[effect.id] || null
                });
            });
        }

        // Log result in console
        console.log("Import completed:", { npcs, objects, places, timeline });

        // Update every part of the UI with the newly imported data, and
        // immediately persist it so it becomes the new autosaved scenario.
        refreshAllScenarioUI();
        if (typeof saveScenarioToDB === "function") {
            saveScenarioToDB();
        }

        // Success notification
        showNotification({
            type: "success",
            content: "<strong>Import successful!</strong> Scenario has been imported!",
            duration: 3000
        });
    } catch (error) {
        console.error("Error during import:", error);
        showNotification({
            type: "error",
            content: "<strong>Error:</strong> An error occurred while importing. Check the ZIP file.",
            duration: 0
        });
    }
}
