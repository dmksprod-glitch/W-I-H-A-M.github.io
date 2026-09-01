// ***************************************
// DOM Element References and Global State
// ***************************************

const txtNPCId = document.getElementById("txtNPCId");
const txtNPCName = document.getElementById("txtNPCName");
const txtNPCDescription = document.getElementById("txtNPCDescription");
const btnNPCImageUpload = document.getElementById("btnNPCImageUpload");
const inputNPCImageFile = document.getElementById("inputNPCImageFile");
const imgNPCImagePreview = document.getElementById("imgNPCImagePreview");
const npcScheduleTableBody = document.querySelector("#npcScheduleTable tbody");
const txtNPCProfession = document.getElementById("txtNPCProfession");
const numNPCMaxHP = document.getElementById("numNPCMaxHP");
const numNPCCurrentHP = document.getElementById("numNPCCurrentHP");
const numNPCMentalMaxHP = document.getElementById("numNPCMentalMaxHP");
const numNPCMentalCurrentHP = document.getElementById("numNPCMentalCurrentHP");
const txtNPCAppearance = document.getElementById("txtNPCAppearance");
const colorNPC = document.getElementById("colorNPC");

const btnNPCScheduleAdd = document.getElementById("btnNPCScheduleAdd");
const btnNPCSave = document.getElementById("btnNPCSave");
const btnNewNPC = document.getElementById("btnNewNPC");
const btnNPCDelete = document.getElementById("btnNPCDelete");
const btnAddEntry = document.querySelectorAll(".btnAddEntry");

let inEditorselectedNPC = null;

const npcDescriptionEditor = new Quill("#txtNPCDescription", {
    theme: "snow",
    modules: {
        toolbar: [
            ["bold", "italic", "underline"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["link", "blockquote"],
            [{ spoiler: true }],
            ['itemLink']
        ],
    },
});

npcDescriptionEditor.getModule('toolbar').addHandler('itemLink', () => {
    openItemLinkPopup();
});

const npcAppearanceEditor = new Quill("#txtNPCAppearance", {
    theme: "snow",
    modules: {
        toolbar: [
            ["bold", "italic", "underline"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["link", "blockquote"],
            [{ spoiler: true }],
            ['itemLink']
        ],
    },
});

npcDescriptionEditor.getModule('toolbar').addHandler('itemLink', () => {
    openItemLinkModal(npcDescriptionEditor);
});

npcAppearanceEditor.getModule('toolbar').addHandler('itemLink', () => {
    openItemLinkModal(npcAppearanceEditor);
});

// ***************************************
// Event Listeners
// ***************************************

/**
 * Adds a new attribute row in the specified category (Physical, Knowledge, Social).
 */
btnAddEntry.forEach((button) => {
    button.addEventListener("click", () => {
        const category = button.dataset.category;
        addEntryRow(category);
    });
});

/**
 * Creates a new NPC, adds it to the global list, and immediately loads it
 * into the editor for further editing.
 */
btnNewNPC.addEventListener("click", () => {
    const newNpc = {
        id: generateID(),
        name: "N/N",
        profession: "",
        image: "",
        appearance: "",
        description: "",
        schedule: [],
        color: getRandomColor()
    };
    npcs.push(newNpc);
    renderNPCListRight();
    inEditorselectedNPC = newNpc;
    loadNPCIntoEditor(inEditorselectedNPC);
    console.log("New NPC added:", newNpc);
});

/**
 * Deletes the currently selected NPC after user confirmation.
 */
btnNPCDelete.addEventListener("click", () => {
    deleteNPC(inEditorselectedNPC);
});

/**
 * Saves the currently loaded NPC data from the editor back into the global list.
 * If no NPC is in the editor, creates a new one instead.
 */
btnNPCSave.addEventListener("click", () => {
    try {
        if (!inEditorselectedNPC) {
            inEditorselectedNPC = {
                id: generateID(),
                schedule: [],
            };
            npcs.push(inEditorselectedNPC);
        }
        saveNPCFromEditor(inEditorselectedNPC);
        console.log("NPC saved:", inEditorselectedNPC);
        renderNPCListRight();
        showNotification({
            type: "success",
            content: "Successfully Saved",
            duration: 1000,
        });
    } catch (error) {
        showNotification({
            type: "error",
            content: "<strong>Error:</strong> Could not save.",
            duration: 0,
        });
    }
});

/**
 * Opens a file dialog for uploading the NPC's image.
 */
btnNPCImageUpload.addEventListener("click", () => {
    inputNPCImageFile.click();
});

/**
 * Reads the selected NPC image file as base64 data, updates the preview image,
 * and sets the NPC's image property.
 */
inputNPCImageFile.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const base64Data = e.target.result;
        if (inEditorselectedNPC) {
            inEditorselectedNPC.image = base64Data;
        }
        imgNPCImagePreview.src = base64Data;
        imgNPCImagePreview.style.display = "inline-block";
    };
    reader.readAsDataURL(file);
});

/**
 * Adds a new empty row to the schedule for the currently edited NPC.
 */
btnNPCScheduleAdd.addEventListener("click", () => {
    addScheduleRow();
});

// ***************************************
// Functions
// ***************************************

/**
 * Adds a new attribute row inside the given category container
 * and sets up event listeners for points and deletion.
 */
function addEntryRow(category) {
    const container = document.querySelector(`#category${category} .entries`);
    const row = document.createElement("div");
    row.className = "entry-row";

    row.innerHTML = `
    <input type="text" placeholder="Entry Name">
    <input type="number" class="points" min="0" value="0">
    <input type="number" class="bonus" value="0" disabled>
    <input type="number" class="total" value="0" disabled>
    <button class="btnDeleteEntry">❌</button>
  `;

    row.querySelector(".points").addEventListener("input", () => {
        updateCategoryTotals(category);
    });

    row.querySelector(".btnDeleteEntry").addEventListener("click", () => {
        row.remove();
        updateCategoryTotals(category);
    });

    container.appendChild(row);
}

/**
 * Updates the bonus and total points for a specific attribute category
 * whenever points change or entries are added/removed.
 */
function updateCategoryTotals(category) {
    const container = document.querySelector(`#category${category}`);
    const pointsInputs = container.querySelectorAll(".points");
    const bonusInputs = container.querySelectorAll(".bonus");
    const totalInputs = container.querySelectorAll(".total");
    const powerPointsDisplay = document.getElementById(`powerPoints${category}`);
    const bonusPointsDisplay = document.getElementById(`bonusPoints${category}`);

    // Calculate bonus points for the category
    const bonusPoints = calculateBonusPoints(category);
    const powerBonusPoints = Math.round(bonusPoints / 10);

    if (bonusPointsDisplay) {
        bonusPointsDisplay.textContent = `+ ${bonusPoints}`;
    }
    powerPointsDisplay.textContent = `⚡ ${powerBonusPoints}`;

    pointsInputs.forEach((input, index) => {
        const points = parseInt(input.value, 10) || 0;
        bonusInputs[index].value = bonusPoints;
        totalInputs[index].value = points + bonusPoints;
    });
}

/**
 * Loads the given NPC data into all relevant editor fields,
 * including attributes, schedule, image preview, etc.
 */
function loadNPCIntoEditor(npc) {
    txtNPCId.value = npc.id || "";
    txtNPCName.value = npc.name || "";
    npcDescriptionEditor.root.innerHTML = npc.description || "";
    txtNPCProfession.value = npc.profession || "";
    npcAppearanceEditor.root.innerHTML = npc.appearance || "";
    numNPCMaxHP.value = npc.maxHP || "";
    numNPCCurrentHP.value = npc.currentHP || "";
    numNPCMentalMaxHP.value = npc.maxMentalHP || "";
    numNPCMentalCurrentHP.value = npc.currentMentalHP || "";
    colorNPC.value = npc.color || getRandomColor();

    loadCategoryAttributes("Physical", npc.attributes?.Physical.entries || []);
    updateCategoryTotals("Physical");

    loadCategoryAttributes("Knowledge", npc.attributes?.Knowledge.entries || []);
    updateCategoryTotals("Knowledge");

    loadCategoryAttributes("Social", npc.attributes?.Social.entries || []);
    updateCategoryTotals("Social");

    npcScheduleTableBody.innerHTML = "";
    if (npc.schedule && npc.schedule.length > 0) {
        npc.schedule.forEach((entry) => {
            addScheduleRow(entry);
        });
    }

    if (npc.image) {
        imgNPCImagePreview.src = npc.image;
        imgNPCImagePreview.style.display = "inline-block";
    } else {
        imgNPCImagePreview.src = "";
        imgNPCImagePreview.style.display = "none";
    }
}

/**
 * Reads data from the editor fields and assigns it to the given NPC object.
 * This includes basic info, attributes, and schedule rows.
 */
function saveNPCFromEditor(npc) {
    npc.id = txtNPCId.value;
    npc.name = txtNPCName.value;
    npc.description = npcDescriptionEditor.root.innerHTML;
    npc.profession = txtNPCProfession.value;
    npc.appearance = npcAppearanceEditor.root.innerHTML;
    npc.maxHP = numNPCMaxHP.value;
    npc.currentHP = numNPCCurrentHP.value;
    npc.maxMentalHP = numNPCMentalMaxHP.value;
    npc.currentMentalHP = numNPCMentalCurrentHP.value;
    npc.color = colorNPC.value

    npc.attributes = {
        Physical: {
            entries: getCategoryAttributes("Physical"),
            powerPoints: getPowerPoints("Physical"),
            bonusPoints: calculateBonusPoints("Physical"),
        },
        Knowledge: {
            entries: getCategoryAttributes("Knowledge"),
            powerPoints: getPowerPoints("Knowledge"),
            bonusPoints: calculateBonusPoints("Knowledge"),
        },
        Social: {
            entries: getCategoryAttributes("Social"),
            powerPoints: getPowerPoints("Social"),
            bonusPoints: calculateBonusPoints("Social"),
        },
    };

    npc.schedule = [];
    const rows = npcScheduleTableBody.querySelectorAll("tr");
    rows.forEach((row) => {
        const startVal = row.querySelector(".schedStart").value;
        const placeVal = row.querySelector(".schedPlace").value;
        const xVal = row.querySelector(".schedX").value;
        const yVal = row.querySelector(".schedY").value;

        npc.schedule.push({
            timeStart: startVal,
            placeId: placeVal,
            row: parseInt(yVal, 10) || 0,
            col: parseInt(xVal, 10) || 0,
        });
    });
    console.log("NPC saved:", npc);
}

/**
 * Calculates the Begabungswert (bonus points) for a category: the sum of all
 * invested skill points in that category, divided by 10 and rounded to the
 * nearest whole number (kaufmaennische Rundung), per the HTBAH rulebook.
 */
function calculateBonusPoints(category) {
    const pointsInputs = document.querySelectorAll(`#category${category} .points`);
    let totalPoints = 0;
    pointsInputs.forEach((input) => {
        totalPoints += parseInt(input.value, 10) || 0;
    });
    return Math.round(totalPoints / 10);
}

/**
 * Updates the displayed power points for the specified category.
 */
function updatePowerPointsDisplay(category, powerPoints) {
    const powerPointsDisplay = document.getElementById(`powerPoints${category}`);
    powerPointsDisplay.textContent = `⚡ ${powerPoints}`;
}

/**
 * Extracts and returns the current power points value from the category UI.
 */
function getPowerPoints(category) {
    const powerPointsDisplay = document.getElementById(`powerPoints${category}`);
    return parseInt(powerPointsDisplay.textContent.replace("⚡ ", ""), 10) || 0;
}

/**
 * Loads an array of attribute entries for the specified category
 * and populates the related editor fields.
 */
function loadCategoryAttributes(category, attributes) {
    const container = document.querySelector(`#category${category} .entries`);
    container.innerHTML = "";
    attributes.forEach((attr) => {
        const row = document.createElement("div");
        row.className = "entry-row";
        row.innerHTML = `
      <input type="text" value="${attr.name}">
      <input type="number" class="points" value="${attr.points}">
      <input type="number" class="bonus" value="${attr.bonus}" disabled>
      <input type="number" class="total" value="${attr.total}" disabled>
      <button class="btnDeleteEntry">❌</button>
    `;

        row.querySelector(".points").addEventListener("input", () => {
            updateCategoryTotals(category);
        });
        row.querySelector(".btnDeleteEntry").addEventListener("click", () => {
            row.remove();
            updateCategoryTotals(category);
        });
        container.appendChild(row);
    });
    updateCategoryTotals(category);
}

/**
 * Retrieves all attribute rows for the specified category, assembling
 * them into an array of objects (name, points, bonus, total).
 */
function getCategoryAttributes(category) {
    const container = document.querySelector(`#category${category} .entries`);
    const rows = container.querySelectorAll(".entry-row");
    return Array.from(rows).map((row) => {
        return {
            name: row.querySelector('input[type="text"]').value,
            points: parseInt(row.querySelector(".points").value, 10) || 0,
            bonus: parseInt(row.querySelector(".bonus").value, 10) || 0,
            total: parseInt(row.querySelector(".total").value, 10) || 0,
        };
    });
}

/**
 * Adds a new schedule row (time, place, x, y) to the NPC schedule table.
 * Prefills data if an entry object is provided.
 */
function addScheduleRow(entry = {}) {
    const tr = document.createElement("tr");

    const tdStart = document.createElement("td");
    const selectStart = document.createElement("select");
    selectStart.className = "schedStart";
    timeline.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.title;
        if (item.id === entry.timeStart) {
            option.selected = true;
        }
        selectStart.appendChild(option);
    });
    tdStart.appendChild(selectStart);
    tr.appendChild(tdStart);

    const tdPlace = document.createElement("td");
    const selectPlace = document.createElement("select");
    selectPlace.className = "schedPlace";
    places.forEach((place) => {
        const option = document.createElement("option");
        option.value = place.id;
        option.textContent = place.name;
        if (place.id === entry.placeId) {
            option.selected = true;
        }
        selectPlace.appendChild(option);
    });
    tdPlace.appendChild(selectPlace);
    tr.appendChild(tdPlace);

    const tdX = document.createElement("td");
    const inputX = document.createElement("input");
    inputX.type = "number";
    inputX.className = "schedX";
    inputX.value = entry.col ?? 0;
    tdX.appendChild(inputX);
    tr.appendChild(tdX);

    const tdY = document.createElement("td");
    const inputY = document.createElement("input");
    inputY.type = "number";
    inputY.className = "schedY";
    inputY.value = entry.row ?? 0;
    tdY.appendChild(inputY);
    tr.appendChild(tdY);

    const tdRemove = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "❌";
    removeBtn.addEventListener("click", () => {
        tr.remove();
    });
    tdRemove.appendChild(removeBtn);
    tr.appendChild(tdRemove);

    npcScheduleTableBody.appendChild(tr);
}

/**
 * Renders a list of NPCs in the right panel, creating clickable cards
 * that allow switching between NPCs in the editor.
 */
function renderNPCListRight() {
    const container = document.getElementById("npcListRight");
    container.innerHTML = "";
    npcs.forEach((npc) => {
        const card = renderItemCard(npc, "npc");
        card.addEventListener("click", () => {
            inEditorselectedNPC = npc;
            loadNPCIntoEditor(npc);
            highlightSelectedItemCard(card);
        });
        container.appendChild(card);
    });
}

/**
 * Deletes the specified NPC from the global list after user confirmation
 * and clears the editor if the deleted NPC was currently selected.
 */
function deleteNPC(npc) {
    if (!npc) return;
    const confirmed = window.confirm(`Do you really want to delete "${npc.name || "this NPC"}"?`);
    if (!confirmed) {
        console.log("Deletion canceled.");
        return;
    }

    const index = npcs.indexOf(npc);
    if (index !== -1) {
        npcs.splice(index, 1);
    }
    console.log("NPC deleted:", npc.name);
    renderNPCListRight();
    clearNPCEditorFields();
}

/**
 * Clears all NPC-related fields in the editor.
 */
function clearNPCEditorFields() {
    txtNPCId.value = "";
    txtNPCName.value = "";
    txtNPCDescription.value = "";
    imgNPCImagePreview.src = "";
    imgNPCImagePreview.style.display = "none";
    npcScheduleTableBody.innerHTML = "";
}
