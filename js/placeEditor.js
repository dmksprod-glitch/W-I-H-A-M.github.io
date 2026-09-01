// **********************************
// DOM Element References and Global State
// **********************************
const btnPlaceBackgroundUpload = document.getElementById("btnPlaceBackgroundUpload");
const inputPlaceBackgroundFile = document.getElementById("inputPlaceBackgroundFile");
const imgPlaceImagePreview = document.getElementById("imgPlaceImagePreview");
const btnPlaceAmbientTrackUpload = document.getElementById("btnPlaceAmbientTrackUpload");
const inputPlaceAmbientTrackFile = document.getElementById("inputPlaceAmbientTrackFile");
const placeAmbientTrackNameInput = document.getElementById("placeAmbientTrackName");
const placeAmbientTrackList = document.getElementById("placeAmbientTrackList");
const btnPlaceSfxUpload = document.getElementById("btnPlaceSfxUpload");
const inputPlaceSfxFile = document.getElementById("inputPlaceSfxFile");
const placeSfxNameInput = document.getElementById("placeSfxName");
const placeStopSfx = document.getElementById("placeStopSfx");
const btnPlaceSave = document.getElementById("btnPlaceSave");
const btnPlaceDelete = document.getElementById("btnPlaceDelete");
const btnNewPlace = document.getElementById("btnNewPlace");
const divplaceListRight = document.getElementById("divplaceListRight");
const colorPlace = document.getElementById("colorPlace");
const placeFogEnabled = document.getElementById("placeFogEnabled");


const placeDescriptionEditor = new Quill('#placeDescription', {
  theme: 'snow',
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'blockquote'],
      [{ 'spoiler': true }],
      ['itemLink']
    ]
  }
});

placeDescriptionEditor.getModule('toolbar').addHandler('itemLink', () => {
  openItemLinkModal(placeDescriptionEditor);
});

let currentPlace = null;
let currentEditedPlace = null;

// **********************************
// Event Listeners
// **********************************

/**
 * Opens the file dialog for uploading a place background image.
 */
btnPlaceBackgroundUpload.addEventListener("click", () => {
  inputPlaceBackgroundFile.click();
});

/**
 * Reads the selected background file, converts it to base64,
 * and updates the current place preview image.
 */
inputPlaceBackgroundFile.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const base64Data = e.target.result;
    currentEditedPlace.background = base64Data;
    imgPlaceImagePreview.src = base64Data;
    imgPlaceImagePreview.style.display = "block";
  };
  reader.readAsDataURL(file);
});

/**
 * Opens the file dialog for uploading an additional ambient sound track.
 */
btnPlaceAmbientTrackUpload.addEventListener("click", () => {
  inputPlaceAmbientTrackFile.click();
});

/**
 * Reads the selected ambient sound file, converts it to base64, and adds it
 * as a new track on the place being edited (becoming the active track if it
 * is the first one).
 */
inputPlaceAmbientTrackFile.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file || !currentEditedPlace) return;

  addAmbientTrackFromFile(currentEditedPlace, file, placeAmbientTrackNameInput.value);
  placeAmbientTrackNameInput.value = "";
  event.target.value = "";
});

/**
 * Opens the file dialog for uploading a new sound effect to this place's
 * soundboard.
 */
btnPlaceSfxUpload.addEventListener("click", () => {
  inputPlaceSfxFile.click();
});

/**
 * Reads the selected sound effect file and adds it to the place being
 * edited.
 */
inputPlaceSfxFile.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file || !currentEditedPlace) return;

  addSoundEffectFromFile(currentEditedPlace, file, placeSfxNameInput.value);
  placeSfxNameInput.value = "";
  event.target.value = "";
});

placeStopSfx.addEventListener("click", () => {
  stopAllSoundEffects();
});

/**
 * Creates a new place object with default values,
 * adds it to the places array, and loads it into the editor.
 */
btnNewPlace.addEventListener("click", () => {
  const newPlace = {
    id: generateID(),
    name: "N/N",
    description: "",
    background: "assets/default_place.png",
    ambientTracks: [],
    activeAmbientTrackId: null,
    soundEffects: [],
    gridSize: { rows: 10, cols: 10 },
    color: getRandomColor(),
    fogOfWar: {
      enabled: true,
      revealedCells: []
    }
  };
  places.push(newPlace);
  renderdivplaceListRight();
  populateLocationSelect();
  currentEditedPlace = newPlace;
  loadPlaceIntoEditor(currentEditedPlace);
});

if (placeFogEnabled) {
  placeFogEnabled.addEventListener("change", () => {
    if (!currentEditedPlace) {
      return;
    }
    if (!currentEditedPlace.fogOfWar) {
      currentEditedPlace.fogOfWar = {
        enabled: true,
        revealedCells: []
      };
    }
    currentEditedPlace.fogOfWar.enabled = placeFogEnabled.checked;
    if (typeof sendFogStateToPlayerView === "function") {
      sendFogStateToPlayerView(currentEditedPlace);
    }
    if (typeof locationSelect !== "undefined" && locationSelect.value === currentEditedPlace.id) {
      loadSelectedPlace(currentEditedPlace.id);
    }
  });
}

/**
 * Saves the current place being edited, updates the list and location selector,
 * and provides user feedback.
 */
btnPlaceSave.addEventListener("click", () => {
  try {
    if (!currentEditedPlace) {
      showNotification({
        type: "warning",
        content: "<strong>Warnung:</strong> Kein Ort ausgewählt!",
        duration: 3000
      });
      return;
    }
    savePlaceFromEditor();
    renderdivplaceListRight();
    populateLocationSelect();
    console.log("Ort gespeichert:", currentEditedPlace);
    showNotification({
      type: "success",
      content: "Successfully Saved",
      duration: 1000
    });
  } catch (error) {
    showNotification({
      type: "error",
      content: "<strong>Fehler:</strong> Could not Save.",
      duration: 0
    });
  }
});

/**
 * Deletes the current place if confirmed by the user,
 * clears the editor, and updates the UI.
 */
btnPlaceDelete.addEventListener("click", () => {
  if (!currentEditedPlace) {
    showNotification({
      type: "warning",
      content: "<strong>Warnung:</strong> Kein Ort ausgewählt!",
      duration: 3000
    });
    return;
  }
  const confirmed = confirm(`Möchtest du den Ort "${currentEditedPlace.name}" wirklich löschen?`);
  if (!confirmed) return;

  const index = places.indexOf(currentEditedPlace);
  if (index !== -1) {
    places.splice(index, 1);
    console.log(`Ort gelöscht: ${currentEditedPlace.name}`);
  }
  currentEditedPlace = null;
  clearPlaceEditorFields();
  renderdivplaceListRight();
  populateLocationSelect();
});

// **********************************
// Functions
// **********************************

/**
 * Loads a selected place into the editor fields.
 */
function loadPlaceIntoEditor(place) {
  document.getElementById("placeId").value = place.id || "";
  document.getElementById("placeName").value = place.name || "";
  document.getElementById("placeGridSizeRows").value = place.gridSize.rows || 10;
  document.getElementById("placeGridSizeCols").value = place.gridSize.cols || 10;
  document.getElementById("startPlace").checked = place.default;
  colorPlace.value = place.color || getRandomColor();
  
  placeDescriptionEditor.root.innerHTML = currentEditedPlace.description;
  if (!place.fogOfWar) {
    place.fogOfWar = {
      enabled: true,
      revealedCells: []
    };
  } else {
    if (typeof place.fogOfWar.enabled !== "boolean") {
      place.fogOfWar.enabled = true;
    }
    if (!Array.isArray(place.fogOfWar.revealedCells)) {
      place.fogOfWar.revealedCells = [];
    }
  }
  if (placeFogEnabled) {
    placeFogEnabled.checked = !!place.fogOfWar.enabled;
  }

  if (place.background) {
    imgPlaceImagePreview.src = place.background;
    imgPlaceImagePreview.style.display = "block";
  } else {
    imgPlaceImagePreview.src = "";
    imgPlaceImagePreview.style.display = "none";
  }
  renderPlaceAmbientTracks(place);
  if (typeof renderPlaceSoundboard === "function") {
    renderPlaceSoundboard(place);
  }
  if (typeof sendFogStateToPlayerView === "function") {
    sendFogStateToPlayerView(place);
  }
}

/**
 * Saves the editor form values into the current place object.
 * If 'default' is selected, all other places lose their default status.
 */
function savePlaceFromEditor() {
  currentEditedPlace.name = document.getElementById("placeName").value;
  currentEditedPlace.gridSize.rows = parseInt(document.getElementById("placeGridSizeRows").value, 10);
  currentEditedPlace.gridSize.cols = parseInt(document.getElementById("placeGridSizeCols").value, 10);
  currentEditedPlace.default = document.getElementById("startPlace").checked;
  currentEditedPlace.description = placeDescriptionEditor.root.innerHTML;
  currentEditedPlace.color = colorPlace.value;
  if (!currentEditedPlace.fogOfWar) {
    currentEditedPlace.fogOfWar = {
      enabled: true,
      revealedCells: []
    };
  }
  currentEditedPlace.fogOfWar.enabled = placeFogEnabled ? placeFogEnabled.checked : true;

  if (currentEditedPlace.default) {
    places.forEach(place => {
      if (place.id !== currentEditedPlace.id) {
        place.default = false;
      }
    });
  }

  const preview = document.getElementById("imgPlaceImagePreview");
  if (preview.src) {
    currentEditedPlace.background = preview.src;
  }
  if (typeof sendFogStateToPlayerView === "function") {
    sendFogStateToPlayerView(currentEditedPlace);
  }
}

/**
 * Renders a list of places, each represented as a card,
 * and attaches a click event to load the place into the editor.
 */
function renderdivplaceListRight() {
  divplaceListRight.innerHTML = "";
  places.forEach(place => {
    const card = renderItemCard(place, "place");
    card.addEventListener("click", () => {
      currentEditedPlace = place;
      loadPlaceIntoEditor(place);
      highlightSelectedItemCard(card);
    });
    divplaceListRight.appendChild(card);
  });
}

/**
 * Clears the place editor fields, resetting them to empty/default values.
 */
function clearPlaceEditorFields() {
  document.getElementById("placeId").value = "";
  document.getElementById("placeName").value = "";
  document.getElementById("placeGridSizeRows").value = "";
  document.getElementById("placeGridSizeCols").value = "";
  document.getElementById("startPlace").checked = false;
  document.getElementById("placeDescription").value = "";
  placeDescriptionEditor.root.innerHTML = ""

  if (imgPlaceImagePreview) {
    imgPlaceImagePreview.src = "";
    imgPlaceImagePreview.style.display = "none";
  }
  if (placeAmbientTrackList) {
    placeAmbientTrackList.innerHTML = "";
  }
  const placeSfxGridEl = document.getElementById("placeSfxGrid");
  if (placeSfxGridEl) {
    placeSfxGridEl.innerHTML = "";
  }
  if (placeFogEnabled) {
    placeFogEnabled.checked = false;
  }
}

/**
 * Renders the list of ambient tracks for the given place: one row per
 * track with a radio button to pick the active one, an inline player, and a
 * delete button.
 */
function renderPlaceAmbientTracks(place) {
  if (!placeAmbientTrackList) return;
  if (typeof ensurePlaceAmbientMigrated === "function") {
    ensurePlaceAmbientMigrated(place);
  } else if (!Array.isArray(place.ambientTracks)) {
    place.ambientTracks = [];
  }

  placeAmbientTrackList.innerHTML = "";

  if (!place.ambientTracks.length) {
    placeAmbientTrackList.innerHTML = `<p class="ambient-empty" data-i18n="ambientTracksEmpty">Noch keine Ambiente-Tracks hochgeladen.</p>`;
    return;
  }

  place.ambientTracks.forEach(track => {
    const row = document.createElement("div");
    row.className = "ambient-track-row";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "placeActiveAmbientTrack";
    radio.checked = track.id === place.activeAmbientTrackId;
    radio.title = "Als aktiven Track festlegen";
    radio.addEventListener("change", () => {
      if (typeof setActiveAmbientTrack === "function") {
        setActiveAmbientTrack(place.id, track.id);
      }
    });

    const name = document.createElement("span");
    name.className = "ambient-track-name";
    name.textContent = track.name;

    const player = document.createElement("audio");
    player.controls = true;
    player.src = track.audio;
    player.className = "ambient-track-player";

    const del = document.createElement("button");
    del.type = "button";
    del.className = "ambient-track-del";
    del.innerHTML = "&times;";
    del.title = "Track entfernen";
    del.addEventListener("click", () => {
      if (typeof deleteAmbientTrack === "function") {
        deleteAmbientTrack(place.id, track.id);
      }
    });

    row.appendChild(radio);
    row.appendChild(name);
    row.appendChild(player);
    row.appendChild(del);
    placeAmbientTrackList.appendChild(row);
  });
}

/**
 * Adds a newly uploaded ambient track to the given place, making it the
 * active track if the place had none yet.
 */
function addAmbientTrackFromFile(place, file, name) {
  if (!file || !place) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    if (typeof ensurePlaceAmbientMigrated === "function") {
      ensurePlaceAmbientMigrated(place);
    } else if (!Array.isArray(place.ambientTracks)) {
      place.ambientTracks = [];
    }

    const track = {
      id: generateID(),
      name: (name && name.trim()) ? name.trim() : file.name.replace(/\.[^/.]+$/, ""),
      audio: e.target.result
    };
    place.ambientTracks.push(track);

    if (!place.activeAmbientTrackId && typeof setActiveAmbientTrack === "function") {
      setActiveAmbientTrack(place.id, track.id);
    }

    renderPlaceAmbientTracks(place);
    if (typeof renderSoundUiSafe === "function") {
      renderSoundUiSafe();
    }
  };
  reader.readAsDataURL(file);
}

/**
 * Removes a single ambient track from a place. If it was the active track,
 * the next remaining track (if any) becomes active.
 */
function deleteAmbientTrack(placeId, trackId) {
  const place = places.find(p => p.id === placeId);
  if (!place) return;

  place.ambientTracks = place.ambientTracks.filter(t => t.id !== trackId);

  if (place.activeAmbientTrackId === trackId) {
    const nextTrack = place.ambientTracks[0] || null;
    if (typeof setActiveAmbientTrack === "function") {
      setActiveAmbientTrack(placeId, nextTrack ? nextTrack.id : null);
    } else {
      place.activeAmbientTrackId = nextTrack ? nextTrack.id : null;
    }
  }

  renderPlaceAmbientTracks(place);
  if (typeof renderSoundUiSafe === "function") {
    renderSoundUiSafe();
  }
}

/**
 * Highlights the selected place card in the interface.
 */
function highlightinEditorselectedPlace(selectedItemDiv) {
  const allItems = document.querySelectorAll(".placeItemRight");
  allItems.forEach((item) => {
    item.style.border = "1px solid #ccc";
  });
  selectedItemDiv.style.border = "2px solid red";
}
