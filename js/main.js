// Toggle button and sidebar references
const toggleSidebarButton = document.getElementById("toggleSidebar");
const sidebar = document.getElementById("sidebar");
const toggleAllSidebarMenuBtnTxt = document.querySelectorAll("#sidebarMenuBtnTxt");
const infoSidebar = document.getElementById("infoSidebar");
const btnToggleInfoSidebar = document.getElementById("btnToggleInfoSidebar");
const INFO_SIDEBAR_HIDDEN_KEY = "wiham_info_sidebar_hidden";

// Real-time and page-timer elements
const realTimeElement = document.getElementById("realTime");
const pageTimerElement = document.getElementById("pageTimer");
const pageStartTime = Date.now();

// Dropdowns and other controls
const locationSelect = document.getElementById("locationSelect");
const btnShowLocationDetails = document.getElementById("btnShowLocationDetails");
// timeSlider is declared in the original code, but not currently used
// const timeSlider = document.getElementById("timeSlider");

// Event listener to toggle sidebar visibility
toggleSidebarButton.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    toggleAllSidebarMenuBtnTxt.forEach((txt) => {
        txt.classList.toggle("collapsed");
    });
    loadSelectedPlace(locationSelect.value);
});

/**
 * Shows/hides the right-hand info sidebar (Ausgewählt/NPCs/Objekte/
 * Inventar). Hiding it lets #mainContent (the Cockpit, the map, ...) use
 * the freed-up width instead. Remembered across reloads.
 */
function setInfoSidebarHidden(hide) {
    infoSidebar.classList.toggle("hidden", hide);
    btnToggleInfoSidebar.classList.toggle("muted", hide);
    localStorage.setItem(INFO_SIDEBAR_HIDDEN_KEY, hide ? "1" : "0");
    loadSelectedPlace(locationSelect.value);
}

btnToggleInfoSidebar.addEventListener("click", () => {
    setInfoSidebarHidden(!infoSidebar.classList.contains("hidden"));
});

// Restore the remembered state on load. No place is loaded yet at this
// point, so this only sets the visual state - unlike setInfoSidebarHidden,
// it skips resizing the map (loadSelectedPlace runs once real places do).
const infoSidebarStartsHidden = localStorage.getItem(INFO_SIDEBAR_HIDDEN_KEY) === "1";
infoSidebar.classList.toggle("hidden", infoSidebarStartsHidden);
btnToggleInfoSidebar.classList.toggle("muted", infoSidebarStartsHidden);

// Spoiler text toggle
document.addEventListener("click", (event) => {
    if (event.target.classList.contains("spoiler")) {
        const isHidden = event.target.style.color === "black";
        event.target.style.color = isHidden ? "white" : "black";
    }
});

// Update selected location
locationSelect.addEventListener("change", () => {
    locationChanged();
});

if (btnShowLocationDetails) {
    btnShowLocationDetails.addEventListener("click", () => {
        const selectedPlaceId = locationSelect.value;
        if (!selectedPlaceId) {
            return;
        }
        const selectedPlace = places.find(place => place.id === selectedPlaceId);
        if (selectedPlace) {
            displaySelectedDetails(selectedPlace);
            const selectedTabButton = document.querySelector('.tab-button[data-tab="tabSelected"]');
            if (selectedTabButton) {
                selectedTabButton.click();
            }
        }
    });
}

/**
 * Updates the clock display every second.
 */
function updateRealTime() {
    const now = new Date();
    realTimeElement.textContent = now.toLocaleTimeString();
}

/**
 * Calculates and displays the elapsed time since page load (hours/minutes/seconds).
 */
function updatePageTimer() {
    const elapsedMilliseconds = Date.now() - pageStartTime;
    const totalSeconds = Math.max(0, Math.floor(elapsedMilliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    pageTimerElement.textContent = `${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Triggered when the user selects a different location in the dropdown.
 * Sets the current place, updates the map, NPCs, and objects.
 */
function locationChanged() {
    const selectedPlaceId = locationSelect.value;
    const currentTimeId = timeline[currentIndex]?.id;
    currentPlace = selectedPlaceId;
    loadSelectedPlace(selectedPlaceId);
    updateDynamicLists();
    updateAndCheckEvents();
    myPlace = places.find(p => p.id === selectedPlaceId);
    displaySelectedDetails(myPlace);
    if (typeof crossfadeAmbientForPlace === "function") {
        crossfadeAmbientForPlace(selectedPlaceId);
    }
}

/**
 * Populates the location dropdown with all places. Keeps the previously
 * selected place if it still exists; otherwise falls back to the place
 * marked as start location ("Abenteuer hier starten"), or the first place.
 */
function populateLocationSelect() {
    const previousValue = locationSelect.value;
    locationSelect.innerHTML = "";
    places.forEach((place) => {
        const option = document.createElement("option");
        option.value = place.id;
        option.textContent = place.name || "(Unnamed Place)";
        locationSelect.appendChild(option);
    });
    if (places.length > 0) {
        const stillExists = places.some(place => place.id === previousValue);
        const defaultPlace = places.find(place => place.default === true) || places[0];
        const targetId = stillExists ? previousValue : defaultPlace.id;
        locationSelect.value = targetId;
        loadSelectedPlace(targetId);
        if (typeof crossfadeAmbientForPlace === "function") {
            crossfadeAmbientForPlace(targetId);
        }
    }
}

/**
 * Rebuilds the location dropdown's options to match the current order of
 * `places`, without touching which place is currently selected. Used after
 * reordering places (e.g. by dragging Cockpit chips) - unlike
 * populateLocationSelect, which always jumps to the first place.
 */
function refreshLocationSelectOrder() {
    const currentValue = locationSelect.value;
    locationSelect.innerHTML = "";
    places.forEach((place) => {
        const option = document.createElement("option");
        option.value = place.id;
        option.textContent = place.name || "(Unnamed Place)";
        locationSelect.appendChild(option);
    });
    if (places.some(p => p.id === currentValue)) {
        locationSelect.value = currentValue;
    } else if (places.length > 0) {
        locationSelect.value = places[0].id;
    }
}

/**
 * Updates NPC and object lists when the location or timeline index changes.
 */
function updateDynamicLists() {
    const selectedPlaceId = locationSelect.value;
    const currentTimeId = timeline[currentIndex]?.id;
    updateNPCList(selectedPlaceId, currentTimeId);
    updateObjectList(selectedPlaceId);
}

/**
 * Displays NPCs for the selected place and current time.
 */
function updateNPCList(placeId, currentTimeId) {
    const npcListHere = document.getElementById("npcListHere");
    npcListHere.innerHTML = "";
    const filteredNPCs = npcs.filter(npc =>
        npc.schedule.some(entry => entry.placeId === placeId && entry.timeStart === currentTimeId)
    );
    filteredNPCs.forEach(npc => {
        const card = renderItemCard(npc, "npc");
        npcListHere.appendChild(card);
    });
}

/**
 * Displays objects for the selected place if they are placed there.
 */
function updateObjectList(placeId) {
    const objectListHere = document.getElementById("objectListHere");
    objectListHere.innerHTML = "";
    const filteredObjects = objects.filter(obj =>
        obj.position && obj.position.type === "place" && obj.position.targetId === placeId
    );
    filteredObjects.forEach(obj => {
        const card = renderItemCard(obj, "object");
        objectListHere.appendChild(card);
    });
}

// Initial actions on page load
// Note: populateLocationSelect() is triggered by db.js after it has tried to
// restore an autosaved scenario, so the dropdown reflects the right data
// from the very first render instead of a brief empty flash.
loadLanguages();
setInterval(updateRealTime, 1000);
setInterval(updatePageTimer, 1000);

let currentQuillEditor = null;

function openItemLinkModal(quillEditor) {
  currentQuillEditor = quillEditor;
  
  // Modal sichtbar machen
  const modal = document.getElementById('itemLinkModal');
  modal.classList.remove('hidden');

  // Standard-Auswahl: "npc"
  const selectType = document.getElementById('selectItemType');
  selectType.value = 'npc';
  fillItemDropdown('npc'); // initial befüllen

  // Achtung: fillItemDropdown(...) definieren wir gleich
}

// Wenn man Typ ändert: #selectItemId neu befüllen
document.getElementById('selectItemType').addEventListener('change', (ev) => {
  fillItemDropdown(ev.target.value);
});

/**
 * Füllt #selectItemId mit den Items des Typs (npcs, objects, places, events).
 */
function fillItemDropdown(type) {
  const selectId = document.getElementById('selectItemId');
  selectId.innerHTML = ''; // alles leeren

  let dataArray = [];
  switch (type) {
    case 'npc': dataArray = npcs; break;
    case 'object': dataArray = objects; break;
    case 'place': dataArray = places; break;
    case 'event': dataArray = events; break;
  }

  dataArray.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.name || `(${item.id})`;
    selectId.appendChild(opt);
  });
}

document.getElementById('btnInsertLink').addEventListener('click', () => {
    // 1) Ausgewählten Typ + Item-Id + Name lesen
    const type = document.getElementById('selectItemType').value;
    const id = document.getElementById('selectItemId').value;
  
    // Das "sichtbare" Label (Name) holen wir direkt aus dem <option> Text
    const sel = document.getElementById('selectItemId');
    const option = sel.options[sel.selectedIndex];
    const itemName = option ? option.textContent : 'Unbenannt';
  
    if (!type || !id) return;
  
    // 2) In den aktuell offenen Quill-Editor einfügen
    if (!currentQuillEditor) return;
  
    let range = currentQuillEditor.getSelection(true);
    if (!range) {
      range = { index: currentQuillEditor.getLength(), length: 0 };
    }
  
    currentQuillEditor.insertText(range.index, itemName, 'itemLink', {
      type: type,
      id: id,
      name: itemName
    }, Quill.sources.USER);
    currentQuillEditor.setSelection(range.index + itemName.length, 0);
  
    // 3) Modal ausblenden
    closeItemLinkModal();
  });
  
  document.getElementById('btnCloseModal').addEventListener('click', () => {
    closeItemLinkModal();
  });
  
  function closeItemLinkModal() {
    const modal = document.getElementById('itemLinkModal');
    modal.classList.add('hidden');
    currentQuillEditor = null;
  }

document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('item-link')) {
      const dataType = e.target.getAttribute('data-type');
      const dataId = e.target.getAttribute('data-id');
      let item = null;
      switch (dataType) {
        case 'npc':
          item = npcs.find(n => n.id === dataId);
          break;
        case 'object':
          item = objects.find(o => o.id === dataId);
          break;
        case 'place':
          item = places.find(p => p.id === dataId);
          break;
        case 'event':
          item = events.find(ev => ev.id === dataId);
          break;
        default:
          console.warn('Unbekannter Typ:', dataType);
      }
      if (item) {
        displaySelectedDetails(item);
      }
    }
  });

/**
 * Registers a service worker if available, logging success or failure.
 */
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/service-worker.js")
            .then(registration => {
                console.log("Service Worker registered with scope:", registration.scope);
            })
            .catch(error => {
                console.log("Service Worker registration failed:", error);
            });
    });
}
