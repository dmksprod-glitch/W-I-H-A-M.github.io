/********************************************************************************
 * Player Characters: lets the GM upload character sheets exported from
 * charakterbogen.html (the Character Creator) so they can always see what
 * skills/abilities the players have, without needing the players' own
 * browsers or sheets of paper at the table.
 *
 * Two ways a sheet gets here:
 *  1. Upload: the player exports a .json from the Character Creator and the
 *     GM uploads that file here (works across any devices).
 *  2. Same-browser handoff: every export from the Character Creator also
 *     drops a copy into localStorage under HTBAH_HANDOFF_KEY. If this page
 *     is opened in the same browser, a banner offers to pick those up
 *     directly - no file needed, but only works when both pages share a
 *     browser profile (e.g. building characters together before a session).
 *
 * The whole roster lives in a popup (not a dedicated page - too much extra
 * navigation for something that should be a quick glance). It opens from the
 * header button, from the Cockpit's character panel, or by clicking a single
 * character there - reusing the same overlay/nav/content shell as the Rules
 * popup (see js/htbahRules.js).
 ********************************************************************************/

const HTBAH_HANDOFF_KEY = "wiham_pc_handoff";
const CHARACTER_CATEGORY_KEYS = ["handeln", "wissen", "soziales"];
const CHARACTER_CATEGORY_LABELS = { handeln: "Handeln", wissen: "Wissen", soziales: "Soziales" };

let currentCharacterId = null;

const btnCharacterUpload = document.getElementById("btnCharacterUpload");
const inputCharacterUpload = document.getElementById("inputCharacterUpload");
const characterModalOverlay = document.getElementById("characterModalOverlay");
const characterModalNav = document.getElementById("characterModalNav");
const characterModalContent = document.getElementById("characterModalContent");
const btnCloseCharacterModal = document.getElementById("btnCloseCharacterModal");
const characterHandoffBanner = document.getElementById("characterHandoffBanner");
const characterHandoffText = document.getElementById("characterHandoffText");
const btnCharacterHandoffImport = document.getElementById("btnCharacterHandoffImport");
const btnCharacterHandoffDismiss = document.getElementById("btnCharacterHandoffDismiss");

btnCharacterUpload.addEventListener("click", () => {
    inputCharacterUpload.click();
});

inputCharacterUpload.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            importCharacterPayload(parsed);
        } catch (error) {
            showNotification({
                type: "error",
                content: `<strong>Fehler:</strong> Charakterdatei konnte nicht gelesen werden (${error.message}).`,
                duration: 0
            });
        }
    };
    reader.readAsText(file, "utf-8");
    inputCharacterUpload.value = "";
});

btnCharacterHandoffImport.addEventListener("click", () => {
    importHandoffCharacters();
});

btnCharacterHandoffDismiss.addEventListener("click", () => {
    localStorage.removeItem(HTBAH_HANDOFF_KEY);
    renderCharacterHandoffBanner();
});

document.getElementById("btnOpenCharacters")?.addEventListener("click", () => {
    openCharacterModal();
});

document.getElementById("btnCockpitOpenCharacters")?.addEventListener("click", () => {
    openCharacterModal();
});

btnCloseCharacterModal.addEventListener("click", closeCharacterModal);

characterModalOverlay.addEventListener("click", (e) => {
    if (e.target === characterModalOverlay) closeCharacterModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !characterModalOverlay.classList.contains("hidden")) {
        closeCharacterModal();
    }
});

/**
 * Opens the Player Characters popup, optionally jumping straight to one
 * character. Falls back to the currently selected (or first) character.
 */
function openCharacterModal(id) {
    if (id) currentCharacterId = id;
    renderCharacterHandoffBanner();
    renderCharacterModalNav();
    characterModalOverlay.classList.remove("hidden");
}

function closeCharacterModal() {
    characterModalOverlay.classList.add("hidden");
}

/**
 * Validates and extracts the character payload from an uploaded/handed-off
 * JSON object, mirroring the same shape the Character Creator exports.
 */
function extractCharacterPayload(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    if (data.type && data.type !== "howtohero-character") {
        throw new Error(`Unbekannter Dateityp: ${data.type}`);
    }
    const character = data.type === "howtohero-character" ? data.character : data;
    if (!character || typeof character !== "object" || !character.info || !character.categories) {
        return null;
    }
    return character;
}

/**
 * Re-renders every place that shows the player character roster, so an
 * import/delete/handoff is reflected everywhere immediately.
 */
function refreshAllCharacterViews() {
    renderCharacterModalNav();
    if (typeof renderCockpitCharacterList === "function") {
        renderCockpitCharacterList();
    }
}

/**
 * Adds an imported character to the roster. If a character with the same
 * name already exists, asks whether to replace it (e.g. an updated sheet).
 */
function importCharacterPayload(rawPayload) {
    const character = extractCharacterPayload(rawPayload);
    if (!character) {
        showNotification({
            type: "error",
            content: "<strong>Fehler:</strong> Datei hat nicht das erwartete Charakterbogen-Format.",
            duration: 0
        });
        return;
    }

    const name = (character.info?.name || "").trim();
    const existing = name ? playerCharacters.find(pc => (pc.info?.name || "").trim() === name) : null;

    if (existing) {
        const confirmed = confirm(`Es gibt bereits einen Charakter namens "${name}". Vorhandenen Stand ersetzen?`);
        if (!confirmed) return;
        existing.info = character.info;
        existing.description = character.description || "";
        existing.inventory = character.inventory || "";
        existing.notes = character.notes || "";
        existing.portrait = character.portrait || null;
        existing.categories = character.categories;
        existing.totalPoints = character.totalPoints;
        existing.bwMode = Boolean(character.bwMode);
        existing.importedAt = new Date().toISOString();
        currentCharacterId = existing.id;
    } else {
        const pc = {
            id: generateID(),
            importedAt: new Date().toISOString(),
            info: character.info,
            description: character.description || "",
            inventory: character.inventory || "",
            notes: character.notes || "",
            portrait: character.portrait || null,
            categories: character.categories,
            totalPoints: character.totalPoints,
            bwMode: Boolean(character.bwMode)
        };
        playerCharacters.push(pc);
        currentCharacterId = pc.id;
    }

    refreshAllCharacterViews();
    if (typeof saveScenarioToDB === "function") saveScenarioToDB();
    showNotification({ type: "success", content: "Charakter importiert.", duration: 1500 });
}

function deleteCharacter(id) {
    const pc = playerCharacters.find(p => p.id === id);
    if (!pc) return;
    const confirmed = confirm(`Charakter "${pc.info?.name || "(unbenannt)"}" wirklich entfernen?`);
    if (!confirmed) return;
    playerCharacters = playerCharacters.filter(p => p.id !== id);
    if (currentCharacterId === id) currentCharacterId = null;
    refreshAllCharacterViews();
    if (typeof saveScenarioToDB === "function") saveScenarioToDB();
}

/**
 * Renders the character switcher in the popup's nav column (mirrors the
 * Rules popup's topic nav) and keeps the content pane in sync with whichever
 * character is currently selected.
 */
function renderCharacterModalNav() {
    if (!characterModalNav) return;
    characterModalNav.innerHTML = "";

    if (!playerCharacters.length) {
        currentCharacterId = null;
        if (characterModalContent) {
            characterModalContent.innerHTML = `<p class="ambient-empty">${t("charactersEmpty")}</p>`;
        }
        return;
    }

    if (!currentCharacterId || !playerCharacters.some(pc => pc.id === currentCharacterId)) {
        currentCharacterId = playerCharacters[0].id;
    }

    playerCharacters.forEach(pc => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "htbah-rules-nav-btn";
        btn.dataset.characterId = pc.id;
        btn.textContent = pc.info?.name || "(unbenannt)";
        btn.addEventListener("click", () => selectCharacterInModal(pc.id));
        characterModalNav.appendChild(btn);
    });

    selectCharacterInModal(currentCharacterId);
}

/**
 * Shows one character's full read-out in the popup's content pane.
 */
function selectCharacterInModal(id) {
    const pc = playerCharacters.find(p => p.id === id);
    if (!pc) return;
    currentCharacterId = id;

    characterModalNav.querySelectorAll(".htbah-rules-nav-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.characterId === id);
    });

    if (!characterModalContent) return;
    characterModalContent.innerHTML = "";
    characterModalContent.appendChild(buildCharacterDetailBlock(pc));
    characterModalContent.scrollTop = 0;
}

function calculateCharacterDerivedCategory(abilities) {
    const baseSum = (abilities || []).reduce((sum, a) => sum + (Number(a.base) || 0), 0);
    const begabung = Math.round(baseSum / 10);
    const geistesblitz = Math.round(begabung / 10);
    return { baseSum, begabung, geistesblitz };
}

/**
 * Builds the full read-out for one character: info, HP, and every skill
 * with its Begabungswert/Geistesblitz/Fähigkeitswert - computed the same
 * way the Character Creator itself does.
 */
function buildCharacterDetailBlock(pc) {
    const block = document.createElement("div");
    block.className = "character-detail-block";
    block.id = `character-block-${pc.id}`;

    const head = document.createElement("div");
    head.className = "character-detail-head";

    const img = document.createElement("img");
    img.className = "character-detail-portrait";
    img.src = pc.portrait || "assets/default_npc.png";
    img.alt = pc.info?.name || "";
    head.appendChild(img);

    const headInfo = document.createElement("div");
    headInfo.className = "character-detail-info";

    const nameEl = document.createElement("h3");
    nameEl.textContent = pc.info?.name || "(Unbenannt)";
    headInfo.appendChild(nameEl);

    const metaBits = [pc.info?.profession, pc.info?.age ? `${pc.info.age} Jahre` : "", pc.info?.gender].filter(Boolean);
    if (metaBits.length) {
        const metaLine = document.createElement("p");
        metaLine.className = "character-meta-line";
        metaLine.textContent = metaBits.join(" · ");
        headInfo.appendChild(metaLine);
    }

    const hpBits = [`${t("currhp")}${pc.info?.hp || "?"}`];
    if (pc.info?.mentalEnabled) hpBits.push(`${t("currentmentalhp")}${pc.info.mentalHP || "?"}`);
    const hpLine = document.createElement("p");
    hpLine.className = "character-meta-line";
    hpLine.textContent = hpBits.join(" · ");
    headInfo.appendChild(hpLine);

    head.appendChild(headInfo);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "character-delete-btn";
    delBtn.textContent = t("delete");
    delBtn.addEventListener("click", () => deleteCharacter(pc.id));
    head.appendChild(delBtn);

    block.appendChild(head);

    const skillsGrid = document.createElement("div");
    skillsGrid.className = "character-skills-grid";

    CHARACTER_CATEGORY_KEYS.forEach(key => {
        const abilities = (pc.categories && pc.categories[key]) || [];
        const derived = calculateCharacterDerivedCategory(abilities);

        const col = document.createElement("div");
        col.className = "character-skill-col";

        const colHead = document.createElement("div");
        colHead.className = "character-skill-col-head";
        const colLabel = document.createElement("strong");
        colLabel.textContent = CHARACTER_CATEGORY_LABELS[key];
        const colChip = document.createElement("span");
        colChip.className = "cockpit-chip";
        colChip.textContent = `+${derived.begabung} · ⚡${derived.geistesblitz}`;
        colHead.appendChild(colLabel);
        colHead.appendChild(colChip);
        col.appendChild(colHead);

        if (!abilities.length) {
            const empty = document.createElement("p");
            empty.className = "cockpit-empty";
            empty.textContent = "—";
            col.appendChild(empty);
        } else {
            const table = document.createElement("table");
            table.className = "character-skill-table";
            abilities.forEach(ability => {
                const row = document.createElement("tr");

                const nameCell = document.createElement("td");
                nameCell.textContent = ability.name || "";

                const baseCell = document.createElement("td");
                baseCell.textContent = Number(ability.base) || 0;

                const totalCell = document.createElement("td");
                totalCell.className = "character-skill-total";
                totalCell.textContent = (Number(ability.base) || 0) + derived.begabung;

                row.appendChild(nameCell);
                row.appendChild(baseCell);
                row.appendChild(totalCell);
                table.appendChild(row);
            });
            col.appendChild(table);
        }

        skillsGrid.appendChild(col);
    });

    block.appendChild(skillsGrid);

    [["description", pc.description], ["inventory", pc.inventory]].forEach(([key, value]) => {
        if (!value || !value.trim()) return;
        const section = document.createElement("div");
        section.className = "character-extra-section";
        const label = document.createElement("div");
        label.className = "cockpit-group-label";
        label.textContent = t(key);
        const text = document.createElement("p");
        text.className = "character-extra-text";
        text.textContent = value;
        section.appendChild(label);
        section.appendChild(text);
        block.appendChild(section);
    });

    return block;
}

/**
 * Renders the compact roster panel in the Cockpit: one row per character
 * with their three Begabungswerte at a glance. Clicking a row opens that
 * character in the popup.
 */
function renderCockpitCharacterList() {
    const container = document.getElementById("cockpitCharacterList");
    if (!container) return;
    container.innerHTML = "";

    if (!playerCharacters.length) {
        container.innerHTML = `<p class="cockpit-empty">${t("charactersEmpty")}</p>`;
        return;
    }

    playerCharacters.forEach(pc => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "cockpit-character-row";

        const img = document.createElement("img");
        img.src = pc.portrait || "assets/default_npc.png";
        img.alt = pc.info?.name || "";
        row.appendChild(img);

        const info = document.createElement("div");
        info.className = "cockpit-character-row-info";
        const name = document.createElement("span");
        name.className = "cockpit-character-row-name";
        name.textContent = pc.info?.name || "(unbenannt)";
        info.appendChild(name);
        if (pc.info?.profession) {
            const prof = document.createElement("span");
            prof.className = "cockpit-character-row-profession";
            prof.textContent = pc.info.profession;
            info.appendChild(prof);
        }
        row.appendChild(info);

        const badges = document.createElement("div");
        badges.className = "cockpit-character-row-badges";
        CHARACTER_CATEGORY_KEYS.forEach(key => {
            const derived = calculateCharacterDerivedCategory(pc.categories?.[key]);
            const badge = document.createElement("span");
            badge.className = "cockpit-character-badge";
            badge.title = CHARACTER_CATEGORY_LABELS[key];
            badge.textContent = `${CHARACTER_CATEGORY_LABELS[key][0]} ${derived.begabung}`;
            badges.appendChild(badge);
        });
        row.appendChild(badges);

        row.addEventListener("click", () => openCharacterModal(pc.id));
        container.appendChild(row);
    });
}

/**
 * Checks localStorage for character sheets dropped off by the Character
 * Creator running in the same browser, and shows a banner to pick them up.
 */
function renderCharacterHandoffBanner() {
    if (!characterHandoffBanner) return;
    let pending = [];
    try {
        pending = JSON.parse(localStorage.getItem(HTBAH_HANDOFF_KEY) || "[]");
    } catch {
        pending = [];
    }

    if (!Array.isArray(pending) || !pending.length) {
        characterHandoffBanner.classList.add("hidden");
        return;
    }

    characterHandoffText.textContent = pending.length === 1
        ? t("charactersHandoffOne")
        : `${pending.length} ${t("charactersHandoffMany")}`;
    characterHandoffBanner.classList.remove("hidden");
}

function importHandoffCharacters() {
    let pending = [];
    try {
        pending = JSON.parse(localStorage.getItem(HTBAH_HANDOFF_KEY) || "[]");
    } catch {
        pending = [];
    }

    pending.forEach(entry => {
        try {
            importCharacterPayload(entry.payload || entry);
        } catch (error) {
            console.error("Handoff-Import fehlgeschlagen:", error);
        }
    });

    localStorage.removeItem(HTBAH_HANDOFF_KEY);
    renderCharacterHandoffBanner();
}

renderCharacterHandoffBanner();

// Re-check whenever this tab regains focus - the Character Creator might
// have just run in another tab of the same browser.
window.addEventListener("focus", renderCharacterHandoffBanner);
