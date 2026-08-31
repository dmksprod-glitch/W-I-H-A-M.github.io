// **********************************
// DOM Element References and Global State
// **********************************
const btnPlaceBackgroundUpload = document.getElementById("btnPlaceBackgroundUpload");
const inputPlaceBackgroundFile = document.getElementById("inputPlaceBackgroundFile");
const imgPlaceImagePreview = document.getElementById("imgPlaceImagePreview");
const btnPlaceAmbientUpload = document.getElementById("btnPlaceAmbientUpload");
const inputPlaceAmbientFile = document.getElementById("inputPlaceAmbientFile");
const btnPlaceAmbientRemove = document.getElementById("btnPlaceAmbientRemove");
const placeAmbientFileName = document.getElementById("placeAmbientFileName");
const placeAmbientPreviewPlayer = document.getElementById("placeAmbientPreviewPlayer");
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
 * Opens the file dialog for uploading a place ambient sound track.
 */
btnPlaceAmbientUpload.addEventListener("click", () => {
  inputPlaceAmbientFile.click();
});

/**
 * Reads the selected ambient sound file, converts it to base64,
 * and attaches it directly to the place being edited.
 */
inputPlaceAmbientFile.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file || !currentEditedPlace) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    currentEditedPlace.ambientSound = e.target.result;
    currentEditedPlace.ambientSoundName = file.name;
    showPlaceAmbientPreview(currentEditedPlace);
  };
  reader.readAsDataURL(file);
});

/**
 * Removes the ambient sound track from the place being edited.
 */
btnPlaceAmbientRemove.addEventListener("click", () => {
  if (!currentEditedPlace) return;
  currentEditedPlace.ambientSound = null;
  currentEditedPlace.ambientSoundName = null;
  showPlaceAmbientPreview(currentEditedPlace);
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
    ambientSound: null,
    ambientSoundName: null,
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
  showPlaceAmbientPreview(place);
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
  showPlaceAmbientPreview({ ambientSound: null });
  if (placeFogEnabled) {
    placeFogEnabled.checked = false;
  }
}

/**
 * Shows or hides the ambient sound preview player and filename
 * for the given place, based on whether an ambient track is set.
 */
function showPlaceAmbientPreview(place) {
  if (place && place.ambientSound) {
    placeAmbientFileName.textContent = place.ambientSoundName || "";
    placeAmbientPreviewPlayer.src = place.ambientSound;
    placeAmbientPreviewPlayer.style.display = "block";
    btnPlaceAmbientRemove.style.display = "inline-block";
  } else {
    placeAmbientFileName.textContent = "";
    placeAmbientPreviewPlayer.src = "";
    placeAmbientPreviewPlayer.style.display = "none";
    btnPlaceAmbientRemove.style.display = "none";
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
