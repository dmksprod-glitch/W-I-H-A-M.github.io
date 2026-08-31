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

// Collect all containers for toggling visibility
const allContainer = [
    divCockpit,
    divNPCEditor,
    divObjectEditor,
    divPlaceEditor,
    mapContainer,
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
    const exeptBtns = [tabBtnSelected];
    editScenarioEnabled = false;
    switchMenu(divCockpit, btnCockpit, exeptBtns);
    if (typeof renderCockpit === "function") {
        renderCockpit();
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
    Container.style.display = "block";

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
