// ********************************************
// Variable Declarations and Editor Setup
// ********************************************

// Button elements and relevant DOM elements
const btnNewEvent = document.getElementById("btnNewEvent");
const btnEventSave = document.getElementById("btnEventSave");
const btnEventDelete = document.getElementById("btnEventDelete");
const conditionsList = document.getElementById("conditionsList");
const btnAddCondition = document.getElementById("btnAddCondition");

// Quill text editor initialization for event descriptions
const eventDescriptionEditor = new Quill('#eventDescription', {
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

eventDescriptionEditor.getModule('toolbar').addHandler('itemLink', () => {
    openItemLinkModal(eventDescriptionEditor);
});

// ********************************************
// Functions
// ********************************************

/**
 * Renders the list of events (on the right side) and creates clickable cards.
 * Each card allows the user to load and edit an event.
 */
function renderdivEventListRight() {
    divEventListRight.innerHTML = "";
    events.forEach(event => {
        const card = renderItemCard(event, 'event');
        card.addEventListener('click', () => {
            currentEvent = event;
            loadEventIntoEditor(event);
            highlightSelectedItemCard(card);
        });
        divEventListRight.appendChild(card);
    });
}

/**
 * Loads the selected event's data into the editor.
 * Clears existing conditions and re-adds them for the current event.
 */
function loadEventIntoEditor(ev) {
    document.getElementById("eventId").value = ev.id || "";
    document.getElementById("eventName").value = ev.name || "";
    eventDescriptionEditor.root.innerHTML = ev.description || "";
    conditionsList.innerHTML = "";

    if (ev.conditions) {
        ev.conditions.forEach(cond => {
            addCondition(cond.isOr ? "or" : null);
            const lastCondition = conditionsList.lastChild;
            if (!lastCondition) return;

            const typeSelect = lastCondition.querySelector("select:nth-of-type(1)");
            const operatorSelect = lastCondition.querySelector("select:nth-of-type(2)");
            const valueSelect = lastCondition.querySelector("select:nth-of-type(3)");

            if (typeSelect) typeSelect.value = cond.type;
            if (operatorSelect) operatorSelect.value = cond.operator;
            if (valueSelect) {
                updateConditionValueDropdown(valueSelect, cond.type);
                valueSelect.value = cond.value;
            }
        });
    }

    if (conditionsList.children.length === 0) {
        btnAddCondition.style.display = "block";
    }
}

/**
 * Saves the current editor form fields back to the event object,
 * updates the event list, and logs the saved data.
 */
function saveEventFromEditor(ev) {
    ev.name = document.getElementById("eventName").value;
    ev.description = eventDescriptionEditor.root.innerHTML;

    ev.conditions = [];
    const conditionItems = conditionsList.querySelectorAll(".condition");
    conditionItems.forEach(item => {
        const type = item.querySelector("select:nth-of-type(1)").value;
        const operator = item.querySelector("select:nth-of-type(2)").value;
        const value = item.querySelector("select:nth-of-type(3)").value;
        const isOr = item.classList.contains("or");

        ev.conditions.push({ type, operator, value, isOr });
    });

    renderdivEventListRight();
}

/**
 * Clears the event form fields by resetting input values.
 */
function clearEventEditorFields() {
    document.getElementById("eventId").value = "";
    document.getElementById("eventName").value = "";
    document.getElementById("eventDescription").value = "";
    eventDescriptionEditor.root.innerHTML = "";
    conditionsList.innerHTML = "";
}

/**
 * Highlights the clicked event card in the interface
 * by updating its border styling.
 */
function highlightSelectedEvent(selectedItemDiv) {
    const allItems = document.querySelectorAll(".eventItemRight");
    allItems.forEach((item) => {
        item.style.border = "1px solid #ccc";
        selectedItemDiv.style.border = "2px solid red";
    });
}

/**
 * Adds a new condition block (li element) to the conditions list.
 * If 'previousOperator' is "or", displays an "OR" label. Also adds
 * buttons to add additional conditions or remove this one.
 */
function addCondition(previousOperator = null, insertAfterElement = null) {
    btnAddCondition.style.display = "none";
    const conditionItem = document.createElement("li");
    conditionItem.className = previousOperator ? "condition or" : "condition";

    if (previousOperator === "or") {
        const orLabel = document.createElement("span");
        orLabel.textContent = "OR";
        orLabel.style.marginRight = "10px";
        orLabel.style.fontWeight = "bold";
        conditionItem.appendChild(orLabel);
    }

    const conditionType = document.createElement("select");
    ["npc", "time", "object", "place"].forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        conditionType.appendChild(option);
    });

    conditionType.addEventListener("change", () => updateConditionValueDropdown(conditionValue, conditionType.value));

    const conditionOperator = document.createElement("select");
    ["=", "!=", ">", "<"].forEach(op => {
        const option = document.createElement("option");
        option.value = op;
        option.textContent = op;
        conditionOperator.appendChild(option);
    });

    const conditionValue = document.createElement("select");
    updateConditionValueDropdown(conditionValue, conditionType.value);

    const btnAnd = document.createElement("button");
    btnAnd.textContent = "AND";
    btnAnd.addEventListener("click", () => addCondition(null, conditionItem));

    const btnOr = document.createElement("button");
    btnOr.textContent = "OR";
    btnOr.addEventListener("click", () => addCondition("or", conditionItem));

    const btnRemove = document.createElement("button");
    btnRemove.textContent = "❌";
    btnRemove.addEventListener("click", () => {
        conditionItem.remove();
        if (conditionsList.children.length === 0) {
            btnAddCondition.style.display = "block";
        }
    });

    conditionItem.appendChild(conditionType);
    conditionItem.appendChild(conditionOperator);
    conditionItem.appendChild(conditionValue);
    if (!previousOperator) {
        conditionItem.appendChild(btnAnd);
        conditionItem.appendChild(btnOr);
    }
    conditionItem.appendChild(btnRemove);

    if (insertAfterElement) {
        insertAfterElement.after(conditionItem);
    } else {
        conditionsList.appendChild(conditionItem);
    }
}

/**
 * Updates the dropdown list values based on the selected condition type.
 */
function updateConditionValueDropdown(dropdown, type) {
    dropdown.innerHTML = "";
    let options = [];

    if (type === "npc") {
        options = npcs.map(npc => ({ value: npc.id, label: npc.name }));
    } else if (type === "place") {
        options = places.map(place => ({ value: place.id, label: place.name }));
    } else if (type === "object") {
        options = objects.map(obj => ({ value: obj.id, label: obj.name }));
    } else if (type === "time") {
        options = timeline.map(entry => ({ value: entry.id, label: entry.title }));
    }

    options.forEach(option => {
        const opt = document.createElement("option");
        opt.value = option.value;
        opt.textContent = option.label;
        dropdown.appendChild(opt);
    });
}

/**
 * Evaluates a single condition against the current context
 * (e.g., which NPCs or objects are present, which time it is, etc.).
 */
function evaluateCondition(condition, context) {
    const { type, operator, value } = condition;

    switch (type) {
        case "npc":
            const npcOnGrid = context.npcs.some(npc => npc.id === value);
            return operator === "=" ? npcOnGrid : !npcOnGrid;
        case "time":
            const currentOrder = context.timeOrder;
            const targetOrder = timeline.find(entry => entry.id === value)?.order;
            if (targetOrder === undefined) return false;

            if (operator === "=") return currentOrder === targetOrder;
            if (operator === "!=") return currentOrder !== targetOrder;
            if (operator === ">") return currentOrder > targetOrder;
            if (operator === "<") return currentOrder < targetOrder;
            break;
        case "object":
            const objectExists = context.objects.some(obj => obj.id === value);
            return operator === "=" ? objectExists : !objectExists;
        case "place":
            const currentPlace = context.place;
            return operator === "=" ? currentPlace === value : currentPlace !== value;
        default:
            return false;
    }
}

/**
 * Evaluates all conditions of a given event by grouping them under
 * AND/OR logic, returning true if all conditions are met.
 */
function evaluateEventConditions(event, context) {
    const groups = [];
    let currentGroup = [];

    event.conditions.forEach((condition) => {
        if (!condition.isOr) {
            if (currentGroup.length > 0) {
                groups.push(currentGroup);
            }
            currentGroup = [condition];
        } else {
            currentGroup.push(condition);
        }
    });

    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }

    const groupResults = groups.map((group) => {
        return group.some((condition) => evaluateCondition(condition, context));
    });

    return groupResults.every((result) => result);
}

/**
 * Checks each event against the current context and shows a notification
 * if the event's conditions are satisfied.
 */
function checkAndNotifyEvents(events, context) {

    events.forEach(event => {
        if (evaluateEventConditions(event, context)) {
            addNotification(`${event.name}<br>${event.description?.replace(/\n/g, "<br>")}`)
            if (typeof registerCockpitEvent === "function") {
                registerCockpitEvent(event);
            }
        }
    });
}

/**
 * Collects data about the current environment (time index, place, NPCs, etc.)
 * and evaluates events to see if they should trigger notifications.
 */
function updateAndCheckEvents() {
    resetNotification();
    if (!editScenarioEnabled) {
        const context = {
            npcs: npcs.filter(npc =>
                npc.schedule.some(entry =>
                    entry.placeId === currentPlace &&
                    entry.timeStart === timeline[currentIndex]?.id
                )
            ),
            timeOrder: timeline[currentIndex]?.order,
            objects: objects.filter(obj => obj.position === null || obj.collected),
            place: currentPlace
        };

        checkAndNotifyEvents(events, context);
    }

    if (typeof renderCockpit === "function") {
        renderCockpit();
    }
}

// ********************************************
// Event Listeners
// ********************************************

/**
 * Creates a new event, adds it to the array, and refreshes the event list.
 */
btnNewEvent.addEventListener("click", () => {
    const newEvent = {
        id: generateID(),
        name: "N/N",
        description: ""
    };
    events.push(newEvent);
    renderdivEventListRight();
    currentEvent = newEvent;
    loadEventIntoEditor(currentEvent);
});

/**
 * Adds a new condition to the current event configuration.
 */
btnAddCondition.addEventListener("click", () => {
    addCondition();
});

/**
 * Saves the current event form data. If no event is selected, shows a warning.
 */
btnEventSave.addEventListener("click", () => {
    try {
        if (!currentEvent) {
            showNotification({
                type: "warning",
                content: "<strong>Warning:</strong> No event selected!",
                duration: 3000
            });
            return;
        }
        saveEventFromEditor(currentEvent);
        console.log("Event saved:", currentEvent);
        showNotification({
            type: "success",
            content: "Successfully Saved",
            duration: 1000
        });
    } catch (error) {
        showNotification({
            type: "error",
            content: "<strong>Error:</strong> Could not save.",
            duration: 0
        });
    }
});

/**
 * Deletes the currently selected event if confirmed by the user.
 */
btnEventDelete.addEventListener("click", () => {
    if (!currentEvent) {
        showNotification({
            type: "warning",
            content: "<strong>Warning:</strong> No event selected!",
            duration: 3000
        });
        return;
    }

    const confirmed = confirm(`Do you really want to delete the event "${currentEvent.name}"?`);
    if (!confirmed) return;

    const index = events.indexOf(currentEvent);
    if (index !== -1) {
        events.splice(index, 1);
        console.log(`Event deleted: ${currentEvent.name}`);
    }
    currentEvent = null;
    clearEventEditorFields();
    renderdivEventListRight();
});
