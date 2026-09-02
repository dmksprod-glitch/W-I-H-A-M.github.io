// Menu button references
const btnScenario = document.getElementById("btnScenario");
const btnCockpit = document.getElementById("btnCockpit");
const btnNPCs = document.getElementById("btnNPCs");
const btnObjects = document.getElementById("btnObjects");
const btnWorld = document.getElementById("btnWorld");
const btnTimeline = document.getElementById("btnTimeline");
const btnEditScenario = document.getElementById("btnEditScenario");
const btnEvents = document.getElementById("btnEvents");

// Collect all container btns for toggling active
const allContainerBtn = [
    btnScenario,
    btnCockpit,
    btnNPCs,
    btnObjects,
    btnWorld,
    btnTimeline,
    btnEditScenario,
    btnEvents
];

// Main content containers
const divCockpit = document.getElementById("divCockpit");
const divNPCEditor = document.getElementById("divNPCEditor");
const divObjectEditor = document.getElementById("divObjectEditor");
const divPlaceEditor = document.getElementById("divPlaceEditor");
const divTimelineEditor = document.getElementById("divTimelineEditor");
const divEditScenario = document.getElementById("divEditScenario");
const divEventEditor = document.getElementById("divEventEditor");

// The map is a single shared element that gets physically moved between the
// Scenario view (its default slot, first child of #mainContent) and the
// Cockpit's central map panel - see btnScenario/btnCockpit below. It is
// deliberately NOT in allContainer: switchMenu hides it by default on every
// navigation, and whichever of the two handlers is active re-shows it after
// moving it into place.
const cockpitMapSlot = document.getElementById("cockpitMapSlot");
const mainContentEl = document.getElementById("mainContent");

// Map Zoom popup (Cockpit only): clicking the map (or its expand button)
// re-parents the same shared #mapContainer once more, into the popup's
// slot, so the GM can see it larger without leaving the Cockpit. Closing it
// puts the map back into #cockpitMapSlot.
const mapZoomOverlay = document.getElementById("mapZoomOverlay");
const mapZoomSlot = document.getElementById("mapZoomSlot");
const btnCloseMapZoom = document.getElementById("btnCloseMapZoom");
const btnCockpitMapZoom = document.getElementById("btnCockpitMapZoom");

function openMapZoom() {
    if (!mapZoomOverlay || !mapZoomSlot || !cockpitMapSlot.contains(mapContainer)) return;
    mapZoomSlot.appendChild(mapContainer);
    mapZoomOverlay.classList.remove("hidden");
    loadSelectedPlace(locationSelect.value);
}

function closeMapZoom() {
    if (!mapZoomOverlay || mapZoomOverlay.classList.contains("hidden")) return;
    mapZoomOverlay.classList.add("hidden");
    cockpitMapSlot.appendChild(mapContainer);
    mapContainer.style.display = "block";
    loadSelectedPlace(locationSelect.value);
}

cockpitMapSlot?.addEventListener("click", openMapZoom);
btnCockpitMapZoom?.addEventListener("click", (e) => {
    e.stopPropagation();
    openMapZoom();
});
btnCloseMapZoom?.addEventListener("click", closeMapZoom);
mapZoomOverlay?.addEventListener("click", (e) => {
    if (e.target === mapZoomOverlay) closeMapZoom();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMapZoom();
});

// Collect all containers for toggling visibility
const allContainer = [
    divCockpit,
    divNPCEditor,
    divObjectEditor,
    divPlaceEditor,
    divTimelineEditor,
    divEditScenario,
    divEventEditor
];

// Tab button references
const tabBtnNPCEditor = document.querySelector('.tab-button[data-tab="tabNPCEditor"]');
const tabBtnObjectEditor = document.querySelector('.tab-button[data-tab="tabObjectEditor"]');
const tabBtnPlaceEditor = document.querySelector('.tab-button[data-tab="tabPlaceEditor"]');
const tabBtnSelected = document.querySelector('.tab-button[data-tab="tabSelected"]');
const tabBtnNPCs = document.querySelector('.tab-button[data-tab="tabNPCs"]');
const tabBtnObjects = document.querySelector('.tab-button[data-tab="tabObjects"]');
const tabBtnAllNPC = document.querySelector('.tab-button[data-tab="tabAllNPC"]');
const tabBtnAllObjects = document.querySelector('.tab-button[data-tab="tabAllObjects"]');
const tabBtnEventEditor = document.querySelector('.tab-button[data-tab="tabEventEditor"]');
const tabBtnMatadata = document.querySelector('.tab-button[data-tab="tabMatadata"]');
const tabBtnInventory = document.querySelector('.tab-button[data-tab="tabInventory"]');
const tabBtnAllPlaces = document.querySelector('.tab-button[data-tab="tabAllPlaces"]');

// Collect all tab buttons and tab contents
const allTabButtons = document.querySelectorAll("#infoTabs .tab-button");
const tabContents = document.querySelectorAll("#tabContents .tab-content");



/**
 * Navigates to the GM Cockpit (session overview dashboard).
 */
btnCockpit.addEventListener("click", () => {
    const exeptBtns = [tabBtnSelected, tabBtnNPCs, tabBtnObjects, tabBtnInventory];
    editScenarioEnabled = false;
    closeMapZoom();
    switchMenu(divCockpit, btnCockpit, exeptBtns);
    cockpitMapSlot.appendChild(mapContainer);
    mapContainer.style.display = "block";
    loadSelectedPlace(locationSelect.value);
    renderdivInventoryListRight();
    if (typeof renderCockpit === "function") {
        renderCockpit();
    }
    if (typeof renderCockpitCharacterList === "function") {
        renderCockpitCharacterList();
    }
});

/**
 * Navigates to the Timeline Editor and re-renders the timeline.
 */
btnTimeline.addEventListener("click", () => {
    const exeptBtns = [tabBtnSelected];
    switchMenu(divTimelineEditor, btnTimeline, exeptBtns);
    unsavedTimeline = [...timeline];
    renderTimeline();
});

/**
 * Navigates to the Place Editor.
 */
btnWorld.addEventListener("click", () => {
    const exeptBtns = [tabBtnPlaceEditor];
    switchMenu(divPlaceEditor, btnWorld, exeptBtns);
});

/**
 * Navigates to the NPC Editor.
 */
btnNPCs.addEventListener("click", () => {
    const exeptBtns = [tabBtnNPCEditor];
    switchMenu(divNPCEditor, btnNPCs, exeptBtns);
});

/**
 * Navigates to the Object Editor.
 */
btnObjects.addEventListener("click", () => {
    const exeptBtns = [tabBtnObjectEditor];
    switchMenu(divObjectEditor, btnObjects, exeptBtns);
});

/**
 * Navigates to the Event Editor.
 */
btnEvents.addEventListener("click", () => {
    const exeptBtns = [tabBtnEventEditor];
    switchMenu(divEventEditor, btnEvents, exeptBtns);
    renderdivEventListRight();
});

/**
 * Navigates to the scenario editing mode.
 */
btnEditScenario.addEventListener("click", () => {
    const exeptBtns = [tabBtnAllNPC, tabBtnAllObjects, tabBtnMatadata, tabBtnAllPlaces];
    editScenarioEnabled = true;
    switchMenu(divEditScenario, btnEditScenario, exeptBtns);
    loadSelectedPlace(locationSelect.value);
    enableDragAndDropTabs();
});

/**
 * Navigates back to the main map display (scenario view).
 */
btnScenario.addEventListener("click", () => {
    const exeptBtns = [tabBtnSelected, tabBtnNPCs, tabBtnObjects, tabBtnInventory];
    editScenarioEnabled = false;
    closeMapZoom();
    mainContentEl.prepend(mapContainer);
    switchMenu(mapContainer, btnScenario, exeptBtns);
    loadSelectedPlace(locationSelect.value);
    renderdivInventoryListRight();
});

/**
 * Sets up the tab buttons to hide/show the correct tab content.
 */
allTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
        allTabButtons.forEach((btn) => btn.classList.remove("active"));
        tabContents.forEach((content) => (content.style.display = "none"));
        button.classList.add("active");

        const targetId = button.getAttribute("data-tab");
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
            targetContent.style.display = "block";
        }
    });
});

/**
 * Shows the specified container and toggles tab button visibility.
 * This function also hides other containers and tab buttons not in use.
 * @param {HTMLElement} Container - The main container to display.
 * @param {HTMLElement[]} exeptBtns - The list of tab buttons to show.
 */
function switchMenu(Container, ContainerBtn, exeptBtns) {
    allContainer.forEach((con) => {
        con.style.display = "none";
    });
    mapContainer.style.display = "none";
    Container.style.display = "block";

    // The Place Editor lets the GM preview ambient tracks/sound effects
    // directly - silence the live ambient loop there so it doesn't overlap
    // with the preview, and bring it back everywhere else.
    if (Container === divPlaceEditor) {
        if (typeof pauseAmbientForEditor === "function") pauseAmbientForEditor();
    } else if (typeof resumeAmbientForEditor === "function") {
        resumeAmbientForEditor();
    }

    allContainerBtn.forEach((btn) => {
        btn.classList = "";
    });
    ContainerBtn.classList = "active";

    allTabButtons.forEach((btn) => {
        btn.style.display = "none";
    });
    exeptBtns.forEach((btn) => {
        btn.style.display = "inline-block";
    });
    exeptBtns[0].click();
}
