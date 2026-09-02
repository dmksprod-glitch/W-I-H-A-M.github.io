/********************************************************************************
 * GM Cockpit: a read-only overview of the current time/place, a running log of
 * events triggered so far this session, and the events that are closest to
 * triggering next. Pulls entirely from the existing scenario data (npcs,
 * objects, places, timeline, events, meta) plus the location/time already
 * selected in the header - it does not introduce any parallel state.
 ********************************************************************************/

// Session-only log of events that have already fired (not persisted/exported)
let cockpitEventLog = [];
let cockpitLoggedEventIds = new Set();

// Session-only GM notes, keyed by timeline entry id (not persisted/exported)
let cockpitNotesByTime = {};

/**
 * Called from eventEditor.js whenever an event's conditions are found to be
 * met during a live context check. Records it once per session.
 */
function registerCockpitEvent(event) {
    if (cockpitLoggedEventIds.has(event.id)) return;
    cockpitLoggedEventIds.add(event.id);

    const place = places.find(p => p.id === locationSelect.value);
    const time = timeline[currentIndex];

    cockpitEventLog.push({
        eventId: event.id,
        name: event.name || "",
        description: event.description || "",
        placeName: place ? place.name : "",
        timeTitle: time ? time.title : ""
    });

    renderCockpitLog();
    if (typeof showEventAlert === "function") {
        showEventAlert(event);
    }
}

/********************************************************************************
 * Event Alert: a large, unmissable popup shown the moment an event's
 * conditions are met for the first time (see registerCockpitEvent above,
 * which only fires once per event). Sits above every other popup and works
 * regardless of which tab/view the GM currently has open. If several events
 * trigger at once, they queue up and are shown one at a time.
 ********************************************************************************/

let eventAlertQueue = [];
let eventAlertShowing = false;

function showEventAlert(event) {
    eventAlertQueue.push(event);
    if (eventAlertShowing) {
        updateEventAlertQueueHint();
    } else {
        displayNextEventAlert();
    }
}

function displayNextEventAlert() {
    const overlay = document.getElementById("eventAlertOverlay");
    if (!overlay) return;

    const event = eventAlertQueue.shift();
    if (!event) {
        eventAlertShowing = false;
        overlay.classList.add("hidden");
        return;
    }

    eventAlertShowing = true;
    const nameEl = document.getElementById("eventAlertName");
    const descEl = document.getElementById("eventAlertDesc");
    if (nameEl) nameEl.textContent = event.name || "";
    if (descEl) descEl.innerHTML = event.description || "";
    updateEventAlertQueueHint();
    overlay.classList.remove("hidden");
}

function updateEventAlertQueueHint() {
    const hint = document.getElementById("eventAlertQueueHint");
    if (!hint) return;
    hint.textContent = eventAlertQueue.length ? `+${eventAlertQueue.length} ${t("eventAlertQueued")}` : "";
}

function dismissEventAlert() {
    displayNextEventAlert();
}

document.getElementById("btnEventAlertNext")?.addEventListener("click", dismissEventAlert);
document.getElementById("eventAlertOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "eventAlertOverlay") dismissEventAlert();
});
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const overlay = document.getElementById("eventAlertOverlay");
    if (overlay && !overlay.classList.contains("hidden")) dismissEventAlert();
});

/**
 * Resolves a single event condition into a human-readable label.
 */
function cockpitConditionLabel(condition) {
    const { type, operator, value } = condition;
    let target = "?";
    if (type === "npc") target = npcs.find(n => n.id === value)?.name || "?";
    else if (type === "place") target = places.find(p => p.id === value)?.name || "?";
    else if (type === "object") target = objects.find(o => o.id === value)?.name || "?";
    else if (type === "time") target = timeline.find(tl => tl.id === value)?.title || "?";
    return `${type} ${operator} ${target}`;
}

/**
 * Groups an event's conditions the same way evaluateEventConditions (in
 * eventEditor.js) does - AND across groups, OR within a group - but returns
 * the per-condition pass/fail results instead of a single boolean.
 */
function cockpitGroupConditions(event, context) {
    const groups = [];
    let currentGroup = [];

    (event.conditions || []).forEach(condition => {
        if (!condition.isOr) {
            if (currentGroup.length > 0) groups.push(currentGroup);
            currentGroup = [condition];
        } else {
            currentGroup.push(condition);
        }
    });
    if (currentGroup.length > 0) groups.push(currentGroup);

    return groups.map(group => {
        const results = group.map(c => evaluateCondition(c, context));
        return { conditions: group, results, met: results.some(Boolean) };
    });
}

/**
 * Builds the same evaluation context updateAndCheckEvents uses, based on the
 * currently selected location and timeline position.
 */
function buildCockpitContext() {
    const placeId = locationSelect.value;
    const time = timeline[currentIndex];
    return {
        npcs: npcs.filter(npc =>
            npc.schedule.some(entry => entry.placeId === placeId && entry.timeStart === time?.id)
        ),
        timeOrder: time?.order,
        objects: objects.filter(obj => obj.position === null || obj.collected),
        place: placeId
    };
}

/**
 * Re-renders every Cockpit panel from the current scenario state.
 */
function renderCockpit() {
    if (!document.getElementById("divCockpit")) return;
    renderCockpitTimeline();
    renderCockpitPlaceChips();
    if (typeof renderCockpitCharacterList === "function") {
        renderCockpitCharacterList();
    }
    renderCockpitNow();
    renderCockpitLog();
    renderCockpitUpcoming();
    renderCockpitFoundItems();
    renderCockpitWhereis();
    renderCockpitPlot();
    renderCockpitNotes();
    if (typeof renderSoundUiSafe === "function") {
        renderSoundUiSafe();
    }
}

/**
 * Renders the horizontal story-progress strip and wires up click-to-jump.
 */
function renderCockpitTimeline() {
    const track = document.getElementById("cockpitTimelineTrack");
    if (!track) return;
    track.innerHTML = "";

    timeline.forEach((entry, index) => {
        const point = document.createElement("button");
        point.type = "button";
        point.className = "cockpit-tl-point";
        if (index === currentIndex) point.classList.add("current");
        else if (index < currentIndex) point.classList.add("done");
        point.title = entry.description || "";

        const ring = document.createElement("span");
        ring.className = "cockpit-tl-ring";
        ring.textContent = index < currentIndex ? "✓" : String(index + 1);

        const label = document.createElement("span");
        label.className = "cockpit-tl-label";
        label.textContent = entry.title || "";

        point.appendChild(ring);
        point.appendChild(label);

        point.addEventListener("click", () => {
            currentIndex = index;
            updateTimeDisplay(currentIndex);
            updateDynamicLists();
        });

        track.appendChild(point);
    });
}

/**
 * Renders a row of location chips - one per place - so the GM can jump
 * straight to any location without leaving the Cockpit. The active place
 * (the one currently selected in the header) is highlighted. Chips can be
 * dragged to reorder places - see enableCockpitPlaceChipDrag below - since
 * that order also drives the header's location dropdown.
 */
function renderCockpitPlaceChips() {
    const container = document.getElementById("cockpitPlaceChips");
    if (!container) return;
    container.innerHTML = "";

    places.forEach(place => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "cockpit-place-chip draggable";
        chip.draggable = true;
        chip.dataset.placeId = place.id;
        chip.title = t("cockpitPlaceChipsHint");
        if (place.id === locationSelect.value) chip.classList.add("active");
        chip.textContent = place.name || "(Unbenannt)";
        chip.addEventListener("click", () => {
            if (locationSelect.value === place.id) return;
            locationSelect.value = place.id;
            locationChanged();
        });
        container.appendChild(chip);
    });

    enableCockpitPlaceChipDrag(container);
}

/**
 * Lets the GM drag place chips into a new order. Reorders the shared
 * `places` array directly (splice out, splice back in), so the change also
 * reorders the header's location dropdown - there is no separate "cockpit
 * order" to keep in sync.
 */
function enableCockpitPlaceChipDrag(container) {
    let draggingId = null;

    container.querySelectorAll(".cockpit-place-chip").forEach(chip => {
        chip.addEventListener("dragstart", (e) => {
            draggingId = chip.dataset.placeId;
            e.dataTransfer.setData("text/plain", draggingId);
            e.dataTransfer.effectAllowed = "move";
            chip.classList.add("dragging");
        });

        chip.addEventListener("dragend", () => {
            chip.classList.remove("dragging");
            container.querySelectorAll(".cockpit-place-chip").forEach(c =>
                c.classList.remove("drag-over-before", "drag-over-after")
            );
            draggingId = null;
        });

        chip.addEventListener("dragover", (e) => {
            if (!draggingId || draggingId === chip.dataset.placeId) return;
            e.preventDefault();
            const rect = chip.getBoundingClientRect();
            const before = e.clientX < rect.left + rect.width / 2;
            chip.classList.toggle("drag-over-before", before);
            chip.classList.toggle("drag-over-after", !before);
        });

        chip.addEventListener("dragleave", () => {
            chip.classList.remove("drag-over-before", "drag-over-after");
        });

        chip.addEventListener("drop", (e) => {
            e.preventDefault();
            const targetId = chip.dataset.placeId;
            chip.classList.remove("drag-over-before", "drag-over-after");
            if (!draggingId || draggingId === targetId) return;

            const fromIndex = places.findIndex(p => p.id === draggingId);
            if (fromIndex === -1) return;

            const rect = chip.getBoundingClientRect();
            const insertBefore = e.clientX < rect.left + rect.width / 2;

            const [movedPlace] = places.splice(fromIndex, 1);
            let targetIndex = places.findIndex(p => p.id === targetId);
            if (!insertBefore) targetIndex++;
            places.splice(targetIndex, 0, movedPlace);

            renderCockpitPlaceChips();
            if (typeof refreshLocationSelectOrder === "function") refreshLocationSelectOrder();
            if (typeof saveScenarioToDB === "function") saveScenarioToDB();
        });
    });
}

/**
 * Renders "Jetzt am Tisch": current place plus present NPCs and objects.
 */
function renderCockpitNow() {
    const placeId = locationSelect.value;
    const place = places.find(p => p.id === placeId);
    const time = timeline[currentIndex];

    const timeChip = document.getElementById("cockpitNowTimeChip");
    if (timeChip) timeChip.textContent = time ? `#${time.order} · ${time.title}` : "—";

    const nameEl = document.getElementById("cockpitNowPlaceName");
    if (nameEl) nameEl.textContent = place ? (place.name || "(Unbenannt)") : t("cockpitNoPlace");

    const descEl = document.getElementById("cockpitNowPlaceDesc");
    if (descEl) descEl.innerHTML = place?.description || "";

    const npcListEl = document.getElementById("cockpitNpcList");
    if (npcListEl) {
        npcListEl.innerHTML = "";
        const presentNpcs = (place && time)
            ? npcs.filter(npc => npc.schedule.some(entry => entry.placeId === place.id && entry.timeStart === time.id))
            : [];
        if (!presentNpcs.length) {
            npcListEl.innerHTML = `<p class="cockpit-empty">${t("cockpitNoNpcsHere")}</p>`;
        } else {
            presentNpcs.forEach(npc => npcListEl.appendChild(renderItemCard(npc, "npc")));
        }
    }

    const objListEl = document.getElementById("cockpitObjList");
    if (objListEl) {
        objListEl.innerHTML = "";
        const presentObjs = place
            ? objects.filter(obj => obj.position && obj.position.type === "place" && obj.position.targetId === place.id && !obj.collected)
            : [];
        if (!presentObjs.length) {
            objListEl.innerHTML = `<p class="cockpit-empty">${t("cockpitNoObjectsHere")}</p>`;
        } else {
            presentObjs.forEach(obj => objListEl.appendChild(renderItemCard(obj, "object")));
        }
    }
}

/**
 * Renders the flat, global list of objects the GM has marked as collected
 * on the map (obj.collected), with a way to put one back if that was a
 * mistake. Independent of the currently selected place/time.
 */
function renderCockpitFoundItems() {
    const list = document.getElementById("cockpitFoundItemsList");
    const countEl = document.getElementById("cockpitFoundItemsCount");
    if (!list) return;

    const found = objects.filter(obj => obj.collected);
    if (countEl) countEl.textContent = String(found.length);

    list.innerHTML = "";
    if (!found.length) {
        list.innerHTML = `<p class="cockpit-empty">${t("cockpitFoundItemsEmpty")}</p>`;
        return;
    }

    found.forEach(obj => {
        const row = document.createElement("div");
        row.className = "cockpit-found-item-row";

        const img = document.createElement("img");
        img.src = obj.image || "assets/default_object.png";
        img.alt = obj.name || "";
        row.appendChild(img);

        const name = document.createElement("span");
        name.className = "cockpit-found-item-name";
        name.textContent = obj.name || "(unbenannt)";
        row.appendChild(name);

        const undoBtn = document.createElement("button");
        undoBtn.type = "button";
        undoBtn.className = "cockpit-icon-btn";
        undoBtn.title = t("unmarkCollected");
        undoBtn.innerHTML = '<span class="mdi mdi-undo-variant"></span>';
        undoBtn.addEventListener("click", () => {
            obj.collected = false;
            renderCockpitFoundItems();
            renderCockpitNow();
            if (typeof loadSelectedPlace === "function" && typeof locationSelect !== "undefined") {
                loadSelectedPlace(locationSelect.value);
            }
            if (typeof renderdivInventoryListRight === "function") renderdivInventoryListRight();
        });
        row.appendChild(undoBtn);

        list.appendChild(row);
    });
}

/**
 * Renders the global "situation music" library (e.g. combat music) and
 * which one, if any, is currently overriding the place's own ambience.
 * Place-independent - the same tracks are offered from any location.
 */
function renderCockpitSituationMusic() {
    const statusEl = document.getElementById("cockpitSituationStatus");
    const listEl = document.getElementById("cockpitSituationList");
    if (!listEl) return;

    const activeTrack = situationOverrideId ? situationTracks.find(t => t.id === situationOverrideId) : null;
    if (statusEl) {
        statusEl.textContent = activeTrack
            ? `${t("cockpitSituationActive")}: ${activeTrack.name}`
            : t("cockpitSituationNone");
    }

    listEl.innerHTML = "";
    if (!situationTracks.length) {
        listEl.innerHTML = `<p class="cockpit-empty">${t("cockpitSituationEmpty")}</p>`;
        return;
    }

    situationTracks.forEach(track => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cockpit-sfx-btn cockpit-situation-btn";
        if (track.id === situationOverrideId) btn.classList.add("active");
        btn.title = track.id === situationOverrideId ? t("cockpitSituationStop") : t("cockpitSituationPlay");

        const icon = document.createElement("span");
        icon.className = "mdi " + (track.id === situationOverrideId ? "mdi-stop-circle-outline" : "mdi-play-circle-outline");
        btn.appendChild(icon);

        const label = document.createElement("span");
        label.textContent = track.name;
        btn.appendChild(label);

        const del = document.createElement("span");
        del.className = "cockpit-sfx-del";
        del.innerHTML = "&times;";
        del.title = t("delete");
        del.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteSituationTrack(track.id);
        });
        btn.appendChild(del);

        btn.addEventListener("click", () => {
            if (track.id === situationOverrideId) {
                clearSituationOverride();
            } else {
                setSituationOverride(track.id);
            }
        });

        listEl.appendChild(btn);
    });
}

/**
 * Renders the cumulative log of events triggered so far this session.
 */
function renderCockpitLog() {
    const list = document.getElementById("cockpitLogList");
    const countEl = document.getElementById("cockpitLogCount");
    if (!list) return;

    if (countEl) countEl.textContent = `${cockpitEventLog.length} ${t("cockpitLogEntries")}`;

    list.innerHTML = "";
    if (!cockpitEventLog.length) {
        list.innerHTML = `<li class="cockpit-empty">${t("cockpitLogEmpty")}</li>`;
        return;
    }

    cockpitEventLog.slice().reverse().forEach(entry => {
        const li = document.createElement("li");
        li.className = "cockpit-log-item";

        const dot = document.createElement("span");
        dot.className = "cockpit-log-dot";

        const body = document.createElement("div");
        const meta = document.createElement("div");
        meta.className = "cockpit-log-meta";
        meta.textContent = entry.placeName ? `${entry.timeTitle} · ${entry.placeName}` : entry.timeTitle;

        const title = document.createElement("div");
        title.className = "cockpit-log-title";
        title.textContent = entry.name;

        const desc = document.createElement("div");
        desc.className = "cockpit-log-desc";
        desc.innerHTML = entry.description;

        body.appendChild(meta);
        body.appendChild(title);
        body.appendChild(desc);

        li.appendChild(dot);
        li.appendChild(body);
        list.appendChild(li);
    });
}

/**
 * Renders events that haven't triggered yet, ranked by how many of their
 * AND-groups are already satisfied.
 */
function renderCockpitUpcoming() {
    const list = document.getElementById("cockpitUpcomingList");
    if (!list) return;
    list.innerHTML = "";

    const pending = events.filter(ev => !cockpitLoggedEventIds.has(ev.id) && ev.conditions && ev.conditions.length);
    if (!pending.length) {
        list.innerHTML = `<p class="cockpit-empty">${t("cockpitUpcomingEmpty")}</p>`;
        return;
    }

    const context = buildCockpitContext();
    const scored = pending.map(ev => {
        const groups = cockpitGroupConditions(ev, context);
        const met = groups.filter(g => g.met).length;
        return { ev, groups, met, total: groups.length };
    }).sort((a, b) => (b.total ? b.met / b.total : 0) - (a.total ? a.met / a.total : 0));

    scored.forEach(({ ev, groups, met, total }) => {
        const ready = total > 0 && met === total;

        const item = document.createElement("div");
        item.className = "cockpit-upcoming-item" + (ready ? " ready" : "");

        const top = document.createElement("div");
        top.className = "cockpit-upcoming-top";
        const title = document.createElement("span");
        title.className = "cockpit-upcoming-title";
        title.textContent = ev.name || "";
        const frac = document.createElement("span");
        frac.className = "cockpit-upcoming-frac";
        frac.textContent = ready ? t("cockpitUpcomingReady") : `${met} / ${total} ${t("cockpitUpcomingMet")}`;
        top.appendChild(title);
        top.appendChild(frac);

        const track = document.createElement("div");
        track.className = "cockpit-progress-track";
        const fill = document.createElement("div");
        fill.className = "cockpit-progress-fill";
        fill.style.width = `${total ? (met / total * 100) : 0}%`;
        track.appendChild(fill);

        const condList = document.createElement("div");
        condList.className = "cockpit-cond-list";
        groups.forEach(group => {
            group.conditions.forEach((condition, i) => {
                const pill = document.createElement("span");
                pill.className = "cockpit-cond-pill" + (group.results[i] ? " met" : "");
                pill.textContent = cockpitConditionLabel(condition);
                condList.appendChild(pill);
            });
        });

        item.appendChild(top);
        item.appendChild(track);
        item.appendChild(condList);
        list.appendChild(item);
    });
}

/**
 * Renders a global "who is where" list across all places for the current
 * timeline position.
 */
function renderCockpitWhereis() {
    const container = document.getElementById("cockpitWhereisList");
    if (!container) return;
    container.innerHTML = "";

    const time = timeline[currentIndex];
    if (!time) {
        container.innerHTML = `<p class="cockpit-empty">${t("cockpitWhereisEmpty")}</p>`;
        return;
    }

    const grouped = places
        .map(place => ({
            place,
            npcsHere: npcs.filter(npc => npc.schedule.some(entry => entry.placeId === place.id && entry.timeStart === time.id))
        }))
        .filter(group => group.npcsHere.length > 0);

    if (!grouped.length) {
        container.innerHTML = `<p class="cockpit-empty">${t("cockpitWhereisEmpty")}</p>`;
        return;
    }

    grouped.forEach(({ place, npcsHere }) => {
        const row = document.createElement("div");
        row.className = "cockpit-whereis-row";

        const placeLabel = document.createElement("span");
        placeLabel.className = "cockpit-whereis-place";
        placeLabel.textContent = place.name || "";

        const names = document.createElement("span");
        names.className = "cockpit-whereis-names";
        names.innerHTML = npcsHere.map(n => `<strong>${escapeHtml(n.name || "")}</strong>`).join(", ");

        row.appendChild(placeLabel);
        row.appendChild(names);
        container.appendChild(row);
    });
}

/**
 * Renders the pinned plot/background summary from the scenario metadata.
 */
function renderCockpitPlot() {
    const el = document.getElementById("cockpitPlotText");
    if (!el) return;
    const plot = (meta.plot || "").trim();
    el.innerHTML = plot ? plot : `<p class="cockpit-empty">${t("cockpitPlotEmpty")}</p>`;
}

/**
 * Loads/saves free-form GM notes for the current timeline position.
 */
function renderCockpitNotes() {
    const textarea = document.getElementById("cockpitNotes");
    if (!textarea) return;
    const time = timeline[currentIndex];
    const key = time ? time.id : "_global";
    textarea.value = cockpitNotesByTime[key] || "";
    textarea.oninput = () => {
        cockpitNotesByTime[key] = textarea.value;
    };
}
