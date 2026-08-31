// Generates a formatted timestamp used for naming the exported ZIP file
function getFormattedTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

// Returns an array of NPC objects, adjusting image paths for export
function generateNPCsJSON() {
    return npcs.map(npc => ({
        ...npc,
        image: npc.image ? `images/npc_${npc.id}.png` : null
    }));
}

// Returns an array of timeline entries for export
function generateTimelineJSON() {
    return timeline.map(entry => ({
        id: entry.id,
        title: entry.title,
        description: entry.description,
        order: entry.order
    }));
}

// Returns an array of object definitions, adjusting image paths for export
function generateObjectsJSON() {
    return objects.map(obj => ({
        id: obj.id,
        name: obj.name,
        description: obj.description,
        image: (obj.image && !obj.image.includes("assets/default_object.png"))
            ? `images/object_${obj.id}.png`
            : null,
        position: obj.position ? {
            type: obj.position.type,
            targetId: obj.position.targetId,
            x: obj.position.type === "place" ? obj.position.x : undefined,
            y: obj.position.type === "place" ? obj.position.y : undefined
        } : null
    }));
}

// Returns an array of place definitions, adjusting background image and ambient sound paths for export
function generatePlacesJSON() {
    const placesReturn = places.map(place => ({
        ...place,
        background: place.background ? `images/place_${place.id}.png` : null,
        ambientSound: place.ambientSound ? `sounds/place_${place.id}.mp3` : null
    }));
    return placesReturn;
}

// Returns an array of sound effect definitions (audio itself goes into the sounds/ folder)
function generateSoundEffectsJSON() {
    return soundEffects.map(effect => ({
        id: effect.id,
        name: effect.name
    }));
}

// Creates a ZIP archive containing all scenario data and triggers the download
function exportScenario() {
    const zip = new JSZip();

    const npcsData = generateNPCsJSON();
    zip.file("npcs.json", JSON.stringify(npcsData, null, 2));

    const objectsData = generateObjectsJSON();
    zip.file("objects.json", JSON.stringify(objectsData, null, 2));

    const placesData = generatePlacesJSON();
    zip.file("places.json", JSON.stringify(placesData, null, 2));

    const timelineData = generateTimelineJSON();
    zip.file("timeline.json", JSON.stringify(timelineData, null, 2));

    zip.file("events.json", JSON.stringify(events, null, 2));

    const soundEffectsData = generateSoundEffectsJSON();
    zip.file("soundeffects.json", JSON.stringify(soundEffectsData, null, 2));

    const metaObj = { ...meta };
    zip.file("meta.json", JSON.stringify(metaObj, null, 2));

    const imagesFolder = zip.folder("images");

    npcs.forEach(npc => {
        if (npc.image && !npc.image.includes("assets/default_object.png")) {
            const base64Data = npc.image.split(",")[1];
            imagesFolder.file(`npc_${npc.id}.png`, base64Data, { base64: true });
        }
    });

    objects.forEach(obj => {
        if (obj.image && !obj.image.includes("assets/default_object.png")) {
            const base64Data = obj.image.split(",")[1];
            imagesFolder.file(`object_${obj.id}.png`, base64Data, { base64: true });
        }
    });

    places.forEach(place => {
        if (place.background && !place.background.includes("assets/default_object.png")) {
            const base64Data = place.background.split(",")[1];
            imagesFolder.file(`place_${place.id}.png`, base64Data, { base64: true });
        }
    });

    const soundsFolder = zip.folder("sounds");

    places.forEach(place => {
        if (place.ambientSound) {
            const base64Data = place.ambientSound.split(",")[1];
            soundsFolder.file(`place_${place.id}.mp3`, base64Data, { base64: true });
        }
    });

    soundEffects.forEach(effect => {
        if (effect.audio) {
            const base64Data = effect.audio.split(",")[1];
            soundsFolder.file(`effect_${effect.id}.mp3`, base64Data, { base64: true });
        }
    });

    zip.generateAsync({ type: "blob" }).then(content => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(content);
        a.download = `${meta.name}_${getFormattedTimestamp()}.zip`;
        a.click();
    });
}

// Triggers the scenario export process when clicking the respective button
document.getElementById("btnExportScenario").addEventListener("click", () => {
    exportScenario();
    console.log("Starting scenario export");
});
