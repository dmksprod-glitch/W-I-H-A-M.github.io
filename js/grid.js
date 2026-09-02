// **************************************
// Variable Declarations & DOM References
// **************************************

const rows = 0;
const cols = 0;

const mapContainer = document.getElementById("mapContainer");
const mapGrid = document.getElementById("mapGrid");
const editMapGrid = document.getElementById("editMapGrid");
let resizeTimeout;
let playerViewWindow = null;
let playerViewPlaceId = null;

// **************************************
// Event Listeners
// **************************************

window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        loadSelectedPlace(locationSelect.value);
    }, 300);
});

window.addEventListener("message", (event) => {
    if (event.origin && event.origin !== window.location.origin) {
        return;
    }
    const data = event.data;
    if (!data || typeof data !== "object") {
        return;
    }
    if (data.type === "fogUpdate") {
        applyFogUpdateFromPlayerView(data);
    } else if (data.type === "fogRequest") {
        const place = places.find(p => p.id === data.placeId);
        if (place) {
            sendFogStateToPlayerView(place);
        }
    }
});

function ensureFogConfig(place) {
    if (!place) {
        return;
    }
    if (!place.fogOfWar) {
        place.fogOfWar = {
            enabled: true,
            revealedCells: []
        };
    }
    if (typeof place.fogOfWar.enabled !== "boolean") {
        place.fogOfWar.enabled = true;
    }
    if (!Array.isArray(place.fogOfWar.revealedCells)) {
        place.fogOfWar.revealedCells = [];
    }
    place.fogOfWar.revealedCells = normalizeFogCells(
        place.fogOfWar.revealedCells,
        place.gridSize?.rows,
        place.gridSize?.cols
    );
}

function normalizeFogCells(cells, maxRows, maxCols) {
    const normalized = [];
    const seen = new Set();
    if (!Array.isArray(cells)) {
        return normalized;
    }
    cells.forEach(cell => {
        const row = Number(cell?.row);
        const col = Number(cell?.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) {
            return;
        }
        if (Number.isInteger(maxRows) && (row < 0 || row >= maxRows)) {
            return;
        }
        if (Number.isInteger(maxCols) && (col < 0 || col >= maxCols)) {
            return;
        }
        const key = `${row},${col}`;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        normalized.push({ row, col });
    });
    return normalized;
}

function sendFogStateToPlayerView(place) {
    if (!playerViewWindow || playerViewWindow.closed) {
        playerViewWindow = null;
        playerViewPlaceId = null;
        return;
    }
    if (!place || playerViewPlaceId !== place.id) {
        return;
    }
    ensureFogConfig(place);
    const payload = {
        type: "fogState",
        placeId: place.id,
        fogEnabled: !!place.fogOfWar.enabled,
        revealedCells: place.fogOfWar.revealedCells.map(cell => ({
            row: cell.row,
            col: cell.col
        }))
    };
    const targetOrigin = window.location.origin === "null" ? "*" : window.location.origin;
    try {
        playerViewWindow.postMessage(payload, targetOrigin);
    } catch (error) {
        console.warn("Could not post fog state to player view:", error);
    }
}

function applyFogUpdateFromPlayerView(message) {
    const placeId = message.placeId;
    if (!placeId) {
        return;
    }
    const place = places.find(p => p.id === placeId);
    if (!place) {
        return;
    }
    ensureFogConfig(place);
    const maxRows = place.gridSize?.rows;
    const maxCols = place.gridSize?.cols;
    place.fogOfWar.revealedCells = normalizeFogCells(message.revealedCells, maxRows, maxCols);
    if (currentPlace === place.id) {
        renderPlace(place);
    }
    sendFogStateToPlayerView(place);
}

// **************************************
// Functions
// **************************************

/**
 * Renders the provided place on the map by setting the background
 * image and creating/resizing the grid.
 */
function renderPlace(place) {
    ensureFogConfig(place);
    if (!place || !place.background) {
        console.warn("No valid place or background image found:", place);
        mapContainer.style.backgroundImage = "";
        divEditScenario.style.backgroundImage = "";
        return;
    }
    mapContainer.style.backgroundImage = `url(${place.background})`;
    divEditScenario.style.backgroundImage = `url(${place.background})`;
    renderGrid(place.gridSize.rows, place.gridSize.cols);
    resizeGrid(place.gridSize.rows, place.gridSize.cols);
    sendFogStateToPlayerView(place);
}

/**
 * Creates grid cells for the map (or editable map), placing NPCs and objects
 * according to the current location, time, and scenario edit mode.
 */
function renderGrid(rows, cols) {
    mapGrid.innerHTML = "";
    editMapGrid.innerHTML = "";

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement("div");
            cell.className = "mapCell";
            cell.dataset.col = c;
            cell.dataset.row = r;

            // NPCs present in this cell
            const npcsHere =
                npcs?.filter(npc =>
                    npc.schedule?.some(entry =>
                        entry.placeId === currentPlace &&
                        entry.row === r &&
                        entry.col === c &&
                        entry.timeStart === timeline[currentIndex]?.id
                    )
                ) || [];

            // Objects present in this cell (already-collected ones are left
            // off the map - they've been picked up, see the "eingesammelt"
            // tooltip button below and the Cockpit's found-items panel)
            const objectsHere =
                objects?.filter(obj =>
                    obj.position &&
                    obj.position.type === "place" &&
                    obj.position.targetId === currentPlace &&
                    obj.position.x === c &&
                    obj.position.y === r &&
                    !obj.collected
                ) || [];

            // Objects present in this cell
            const placesHere =
                places?.filter(pla =>
                    pla.link?.some(entry =>
                        entry.placeId === currentPlace &&
                        entry.row === r &&
                        entry.col === c
                    )
                ) || [];

            const symbolElement = document.createElement("span");
            symbolElement.className = "mapElement";

            const iconElement = document.createElement("span");
            iconElement.className = "mapIcon";
            
            const gridIcon = document.createElement("span");

            // Determine which icon to display
            if (npcsHere.length + objectsHere.length + placesHere.length > 1) {
                gridIcon.className = "mdi mdi-hexagon-multiple";
            } else if (npcsHere.length === 1) {
                if (npcsHere[0].image){
                    const gridIconImg = document.createElement("img");
                    gridIconImg.src = npcsHere[0].image;
                    gridIconImg.alt = npcsHere[0].name || "N/N";
                    gridIconImg.className = "gridIconImg";
                    gridIconImg.style.borderColor = npcsHere[0].color || "#FFF";
                    gridIcon.style.display = "grid";
                    gridIcon.style.placeItems = "center";
                    gridIcon.appendChild(gridIconImg);
                }
                else{
                    gridIcon.className = "mdi mdi-account";
                    gridIcon.style.color = npcsHere[0].color || '#000';
                }
                
            } else if (objectsHere.length === 1) {
                gridIcon.className = "mdi mdi-magnify";
                gridIcon.style.color = objectsHere[0].color || '#000';
            } else if (placesHere.length === 1) {
                gridIcon.className = "mdi mdi-map-marker";
                gridIcon.style.color = placesHere[0].color || '#000';
            }

            iconElement.appendChild(gridIcon);
            symbolElement.appendChild(iconElement);

            // Create hover overlay (tooltip) for NPCs or objects
            if (npcsHere.length > 0 || objectsHere.length > 0 || placesHere.length > 0) {
                const tooltip = document.createElement("div");
                tooltip.className = "hoverOverlay";

                // NPC entries
                npcsHere.forEach(npc => {
                    const npcItem = document.createElement("div");
                    npcItem.className = "hoverItem";

                    const btnNPCItem = document.createElement("div");
                    btnNPCItem.className = "hoverItem";

                    const img = document.createElement("img");
                    img.src = npc.image || "assets/default_npc.png";
                    img.alt = npc.name || "(Unnamed NPC)";
                    img.className = "hoverImage";

                    const name = document.createElement("span");
                    name.textContent = npc.name || "(Unnamed NPC)";

                    btnNPCItem.appendChild(img);
                    btnNPCItem.appendChild(name);
                    npcItem.appendChild(btnNPCItem);

                    // Remove this NPC if scenario editing is enabled
                    if (editScenarioEnabled) {
                        const deleteItem = document.createElement("span");
                        deleteItem.className = "tooltipBtnRemove";
                        deleteItem.textContent = "❌";
                        deleteItem.addEventListener("click", (e) => {
                            e.stopPropagation();
                            npc.schedule = npc.schedule.filter(entry =>
                                !(entry.placeId === currentPlace && entry.timeStart === timeline[currentIndex]?.id && entry.row === r && entry.col === c)
                            );
                            loadSelectedPlace(locationSelect.value);
                        });
                        npcItem.appendChild(deleteItem);
                    }
                    tooltip.appendChild(npcItem);

                    // Click event to show NPC details in the "Selected" tab
                    btnNPCItem.addEventListener("click", (e) => {
                        e.stopPropagation();
                        displaySelectedDetails(npc);
                    });
                });

                // Object entries
                objectsHere.forEach(obj => {
                    const objectItem = document.createElement("div");
                    objectItem.className = "hoverItem";

                    const btnObjectItem = document.createElement("div");
                    btnObjectItem.className = "hoverItem";

                    const img = document.createElement("img");
                    img.src = obj.image || "assets/default_object.png";
                    img.alt = obj.name || "(Unnamed Object)";
                    img.className = "hoverImage";

                    const name = document.createElement("span");
                    name.textContent = obj.name || "(Unnamed Object)";

                    btnObjectItem.appendChild(img);
                    btnObjectItem.appendChild(name);
                    objectItem.appendChild(btnObjectItem);

                    // Mark this object as collected - it disappears from the
                    // map and shows up in the Cockpit's found-items list.
                    // Available regardless of edit mode, since this is a
                    // during-play action, not a scenario-building one.
                    const collectItem = document.createElement("span");
                    collectItem.className = "tooltipBtnCollect";
                    collectItem.innerHTML = '<span class="mdi mdi-bag-personal-plus-outline"></span>';
                    collectItem.title = t("markCollected");
                    collectItem.addEventListener("click", (e) => {
                        e.stopPropagation();
                        obj.collected = true;
                        loadSelectedPlace(locationSelect.value);
                        if (typeof renderdivInventoryListRight === "function") renderdivInventoryListRight();
                        if (typeof renderCockpit === "function") renderCockpit();
                    });
                    objectItem.appendChild(collectItem);

                    // Remove object position if scenario editing is enabled
                    if (editScenarioEnabled) {
                        const deleteItem = document.createElement("span");
                        deleteItem.className = "tooltipBtnRemove";
                        deleteItem.textContent = "❌";
                        deleteItem.addEventListener("click", (e) => {
                            e.stopPropagation();
                            obj.position = null;
                            loadSelectedPlace(locationSelect.value);
                        });
                        objectItem.appendChild(deleteItem);
                    }
                    tooltip.appendChild(objectItem);

                    // Click event to show object details in the "Selected" tab
                    btnObjectItem.addEventListener("click", (e) => {
                        e.stopPropagation();
                        displaySelectedDetails(obj);
                    });
                });

                // Place entries
                placesHere.forEach(pla => {
                    const placeItem = document.createElement("div");
                    placeItem.className = "hoverItem";

                    const btnPlaceItem = document.createElement("div");
                    btnPlaceItem.className = "hoverItem";

                    const img = document.createElement("img");
                    img.src = pla.background || "assets/default_place.png";
                    img.alt = pla.name || "N/N";
                    img.className = "hoverImage";

                    const name = document.createElement("span");
                    name.textContent = pla.name || "N/N";

                    btnPlaceItem.appendChild(img);
                    btnPlaceItem.appendChild(name);
                    placeItem.appendChild(btnPlaceItem);

                    // Remove Place link if scenario editing is enabled
                    if (editScenarioEnabled) {
                        const deleteItem = document.createElement("span");
                        deleteItem.className = "tooltipBtnRemove";
                        deleteItem.textContent = "❌";
                        deleteItem.addEventListener("click", (e) => {
                            e.stopPropagation();
                            pla.link = pla.link.filter(entry =>
                                !(entry.placeId === currentPlace && entry.row === r && entry.col === c)
                            );
                            loadSelectedPlace(locationSelect.value);
                        });
                        placeItem.appendChild(deleteItem);
                    }
                    tooltip.appendChild(placeItem);

                    // Click event to show Place
                    btnPlaceItem.addEventListener("click", (e) => {
                        e.stopPropagation();
                        locationSelect.value = pla.id
                        locationChanged();
                    });
                });

                symbolElement.appendChild(tooltip);

                // Dynamic tooltip positioning
                symbolElement.addEventListener("mouseenter", () => {
                    const rect = symbolElement.getBoundingClientRect();
                    const mapRect = editScenarioEnabled
                        ? editMapGrid.getBoundingClientRect()
                        : mapGrid.getBoundingClientRect();

                    // Check top edge
                    if (rect.top - mapRect.top < 50) {
                        tooltip.style.top = "100%";
                        tooltip.style.bottom = "auto";
                    } else {
                        tooltip.style.top = "auto";
                        tooltip.style.bottom = "100%";
                    }

                    // Check left edge
                    if (rect.left - mapRect.left < 50) {
                        tooltip.style.left = "0";
                        tooltip.style.transform = "translateX(0)";
                    } else if (rect.right > mapRect.right - 50) {
                        tooltip.style.left = "auto";
                        tooltip.style.right = "0";
                        tooltip.style.transform = "translateX(0)";
                    } else {
                        tooltip.style.left = "50%";
                        tooltip.style.right = "auto";
                        tooltip.style.transform = "translateX(-50%)";
                    }
                });
            }

            cell.appendChild(symbolElement);

            if (editScenarioEnabled) {
                editMapGrid.appendChild(cell);
            } else {
                mapGrid.appendChild(cell);
            }
        }
    }
    if (editScenarioEnabled) {
        enableScenarioDrop();
    }
}

/**
 * Resizes the grid cells so that they fit in the container, maintaining
 * a square layout and accounting for the header space.
 */
function resizeGrid(rows, cols) {
    const containerWidth = editScenarioEnabled ? editMapGrid.clientWidth : mapGrid.clientWidth;
    const containerHeight = Math.min(
        editScenarioEnabled ? editMapGrid.clientHeight : mapGrid.clientHeight,
        window.innerHeight - document.querySelector("header").offsetHeight
    );
    const cellSize = Math.min(containerWidth / cols, containerHeight / rows);
    const finalCellSize = cellSize;

    const targetGrid = editScenarioEnabled ? editMapGrid : mapGrid;
    targetGrid.style.gridTemplateColumns = `repeat(${cols}, ${finalCellSize}px)`;
    targetGrid.style.gridTemplateRows = `repeat(${rows}, ${finalCellSize}px)`;

    // Scale the symbols to match cell size
    const symbols = targetGrid.querySelectorAll(".mapElement");
    symbols.forEach((symbol) => {
        symbol.style.fontSize = `${finalCellSize * 0.7}px`;
        symbol.style.lineHeight = `${finalCellSize}px`;
    });

    // Tooltips do not scale
    const tooltips = targetGrid.querySelectorAll(".hoverOverlay");
    tooltips.forEach((tooltip) => {
        tooltip.style.fontSize = "";
    });
}

/**
 * Locates the place by its ID and calls renderPlace if found.
 */
function loadSelectedPlace(placeId) {
    const place = places.find(p => p.id === placeId);
    if (place) {
        renderPlace(place);
    } else {
        console.log("Place not found:", placeId);
    }
}

/**
 * Escapes special characters for safe HTML attribute usage.
 */
function escapeHtmlAttribute(value) {
    return (value ?? "")
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeHtml(value) {
    return (value ?? "")
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Opens (or reuses) the dedicated player-view window and displays the provided image.
 */
function showEntityInPlayerView(item) {
    const imageSource = item.image || item.background || (item.schedule ? "assets/default_npc.png" : "assets/default_object.png");
    const isPlace = Boolean(item.gridSize);
    if (isPlace) {
        ensureFogConfig(item);
    }

    const existingWindow = playerViewWindow && !playerViewWindow.closed ? playerViewWindow : null;
    const playerWindow = existingWindow || window.open("", "WIHAM_PlayerView", "width=900,height=700");

    if (!playerWindow) {
        console.warn("Player view window could not be opened by the browser.");
        return;
    }

    playerViewWindow = playerWindow;
    playerViewWindow.focus();

    const translate = typeof t === "function" ? t : (key) => key;
    const localeCode = typeof currentLanguage === "string" ? currentLanguage : "de";
    const strings = {
        title: translate("playerViewTitle"),
        reveal: translate("fogToolReveal"),
        hide: translate("fogToolHide"),
        reset: translate("fogToolReset"),
        showAll: translate("fogToolShowAll"),
        brush: translate("fogBrushSize"),
        instructions: translate("fogToolInstructions"),
        fogDisabled: translate("fogDisabledNotice")
    };

    const fogConfig = isPlace ? item.fogOfWar : null;
    const data = {
        isPlace,
        placeId: isPlace ? item.id : null,
        placeName: item.name || "N/N",
        fogEnabled: isPlace ? fogConfig?.enabled !== false : false,
        rows: item.gridSize?.rows || 1,
        cols: item.gridSize?.cols || 1,
        revealedCells: isPlace
            ? (fogConfig?.revealedCells || []).map(cell => ({ row: cell.row, col: cell.col }))
            : [],
        imageSource,
        alt: item.name || "N/N",
        locale: localeCode,
        strings
    };

    const dataJson = JSON.stringify(data).replace(/</g, "\\u003C");
    const safeLang = escapeHtmlAttribute(localeCode || "de");
    const titleText = escapeHtml(strings.title || "Player View");
    const placeNameText = escapeHtml(item.name || "N/N");

    const html = `<!DOCTYPE html>
<html lang="${safeLang}">
<head>
  <meta charset="UTF-8" />
  <title>${titleText}${placeNameText ? " - " + placeNameText : ""}</title>
  <style>
    :root {
      color-scheme: dark;
    }
    body {
      margin: 0;
      background: #000;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: system-ui, sans-serif;
      color: #fff;
    }
    #playerViewRoot {
      width: 100%;
      max-width: 1200px;
      padding: 12px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
    }
    #playerToolbar {
      width: 100%;
      display: none;
      flex-direction: column;
      gap: 8px;
      background: rgba(20, 20, 20, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 12px;
      box-sizing: border-box;
      backdrop-filter: blur(4px);
    }
    #placeTitle {
      font-size: 16px;
      font-weight: 600;
    }
    #toolbarButtons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    #playerToolbar button {
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s ease, color 0.2s ease, transform 0.1s ease;
    }
    #playerToolbar button:hover {
      background: rgba(255, 255, 255, 0.25);
    }
    #playerToolbar button:active {
      transform: scale(0.97);
    }
    #playerToolbar button.active {
      background: #fff;
      color: #000;
    }
    #playerToolbar label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: #fff;
    }
    #brushSize {
      accent-color: #fff;
    }
    #playerCanvas {
      max-width: 100%;
      max-height: calc(100vh - 200px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      background: #111;
      touch-action: none;
      cursor: crosshair;
      display: none;
    }
    #playerImage {
      max-width: 100%;
      max-height: calc(100vh - 100px);
      object-fit: contain;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .notice {
      width: 100%;
      padding: 10px 12px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
  </style>
</head>
<body>
  <div id="playerViewRoot">
    <div id="playerToolbar">
      <div id="placeTitle"></div>
      <div id="toolbarButtons">
        <button type="button" id="btnReveal"></button>
        <button type="button" id="btnHide"></button>
        <button type="button" id="btnReset"></button>
        <button type="button" id="btnShowAll"></button>
        <label id="brushLabel">
          <span id="brushText"></span>
          <input type="range" id="brushSize" min="1" max="5" value="2" />
          <span id="brushValue">2</span>
        </label>
      </div>
      <div id="instructions"></div>
    </div>
    <div id="fogNotice" class="notice" hidden></div>
    <canvas id="playerCanvas" width="1" height="1"></canvas>
    <img id="playerImage" alt="" draggable="false" />
  </div>
  <script>
    (function () {
      const data = ${dataJson};
      document.documentElement.lang = data.locale || 'de';
      const strings = data.strings || {};
      const origin = window.location.origin === 'null' ? '*' : window.location.origin;
      const placeTitle = document.getElementById('placeTitle');
      const toolbar = document.getElementById('playerToolbar');
      const btnReveal = document.getElementById('btnReveal');
      const btnHide = document.getElementById('btnHide');
      const btnReset = document.getElementById('btnReset');
      const btnShowAll = document.getElementById('btnShowAll');
      const brushSizeInput = document.getElementById('brushSize');
      const brushText = document.getElementById('brushText');
      const brushValue = document.getElementById('brushValue');
      const instructions = document.getElementById('instructions');
      const notice = document.getElementById('fogNotice');
      const canvas = document.getElementById('playerCanvas');
      const imgEl = document.getElementById('playerImage');
      const ctx = canvas.getContext ? canvas.getContext('2d') : null;

      const initialCells = Array.isArray(data.revealedCells) ? data.revealedCells : [];
      const revealed = new Set();
      initialCells.forEach(cell => {
        const row = Number(cell?.row);
        const col = Number(cell?.col);
        if (Number.isInteger(row) && Number.isInteger(col)) {
          revealed.add(row + ',' + col);
        }
      });

      const state = {
        isPlace: !!data.isPlace,
        fogEnabled: !!data.fogEnabled,
        rows: data.rows || 1,
        cols: data.cols || 1,
        mode: 'reveal',
        isDrawing: false,
        brushSize: parseInt(brushSizeInput?.value ?? '2', 10) || 2,
        revealed
      };

      const title = strings.title || 'Player View';
      const placeName = data.placeName || data.alt || '';
      document.title = placeName ? title + ' - ' + placeName : title;
      if (placeTitle) {
        placeTitle.textContent = placeName;
      }
      if (btnReveal) btnReveal.textContent = strings.reveal || 'Reveal';
      if (btnHide) btnHide.textContent = strings.hide || 'Cover';
      if (btnReset) btnReset.textContent = strings.reset || 'Cover all';
      if (btnShowAll) btnShowAll.textContent = strings.showAll || 'Reveal all';
      if (brushText) brushText.textContent = strings.brush || 'Brush size';
      if (brushValue) brushValue.textContent = String(state.brushSize);
      if (instructions) instructions.textContent = strings.instructions || '';

      function setMode(mode) {
        state.mode = mode;
        if (btnReveal) btnReveal.classList.toggle('active', mode === 'reveal');
        if (btnHide) btnHide.classList.toggle('active', mode === 'hide');
      }
      setMode('reveal');

      if (btnReveal) {
        btnReveal.addEventListener('click', () => setMode('reveal'));
      }
      if (btnHide) {
        btnHide.addEventListener('click', () => setMode('hide'));
      }

      if (brushSizeInput) {
        brushSizeInput.addEventListener('input', () => {
          state.brushSize = Math.max(1, parseInt(brushSizeInput.value, 10) || 1);
          if (brushValue) {
            brushValue.textContent = String(state.brushSize);
          }
        });
      }

      function coverAll() {
        state.revealed.clear();
        renderScene();
        scheduleSync();
      }

      function revealAll() {
        state.revealed.clear();
        for (let r = 0; r < state.rows; r++) {
          for (let c = 0; c < state.cols; c++) {
            state.revealed.add(r + ',' + c);
          }
        }
        renderScene();
        scheduleSync();
      }

      if (btnReset) {
        btnReset.addEventListener('click', coverAll);
      }
      if (btnShowAll) {
        btnShowAll.addEventListener('click', revealAll);
      }

      if (!state.isPlace || !ctx) {
        if (toolbar) toolbar.style.display = 'none';
        canvas.style.display = 'none';
        imgEl.style.display = 'block';
        imgEl.src = data.imageSource;
        imgEl.alt = data.alt || '';
        return;
      }

      imgEl.style.display = 'none';
      canvas.style.display = 'block';
      canvas.style.touchAction = 'none';
      if (toolbar) {
        toolbar.style.display = 'flex';
      }

      function updateNotice() {
        if (!notice) return;
        if (!state.fogEnabled) {
          notice.textContent = strings.fogDisabled || '';
          notice.hidden = false;
        } else {
          notice.hidden = true;
        }
      }
      updateNotice();

      const baseImage = new Image();
      baseImage.onload = () => {
        canvas.width = baseImage.width;
        canvas.height = baseImage.height;
        renderScene();
      };
      baseImage.onerror = () => {
        canvas.style.display = 'none';
        imgEl.style.display = 'block';
        imgEl.src = data.imageSource;
        imgEl.alt = data.alt || '';
      };
      baseImage.src = data.imageSource;

      function getCellFromEvent(evt) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (evt.clientX - rect.left) * scaleX;
        const y = (evt.clientY - rect.top) * scaleY;
        const col = Math.floor((x / canvas.width) * state.cols);
        const row = Math.floor((y / canvas.height) * state.rows);
        if (row < 0 || col < 0 || row >= state.rows || col >= state.cols) {
          return null;
        }
        return { row, col };
      }

      function applyBrush(row, col) {
        const radius = Math.max(0, state.brushSize - 1);
        for (let r = row - radius; r <= row + radius; r++) {
          for (let c = col - radius; c <= col + radius; c++) {
            if (r < 0 || c < 0 || r >= state.rows || c >= state.cols) {
              continue;
            }
            const distance = Math.sqrt((r - row) ** 2 + (c - col) ** 2);
            if (distance > radius + 0.01) {
              continue;
            }
            const key = r + ',' + c;
            if (state.mode === 'reveal') {
              state.revealed.add(key);
            } else {
              state.revealed.delete(key);
            }
          }
        }
      }

      function renderScene() {
        if (!ctx || !baseImage.complete) {
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
        if (state.fogEnabled) {
          const cellWidth = canvas.width / state.cols;
          const cellHeight = canvas.height / state.rows;
          ctx.fillStyle = "rgba(0, 0, 0, 0.92)";
          for (let r = 0; r < state.rows; r++) {
            for (let c = 0; c < state.cols; c++) {
              if (!state.revealed.has(r + ',' + c)) {
                ctx.fillRect(c * cellWidth, r * cellHeight, cellWidth, cellHeight);
              }
            }
          }
        }
        drawGrid();
      }

      function drawGrid() {
        const cellWidth = canvas.width / state.cols;
        const cellHeight = canvas.height / state.rows;
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let r = 0; r <= state.rows; r++) {
          const y = r * cellHeight;
          ctx.moveTo(0, Math.round(y) + 0.5);
          ctx.lineTo(canvas.width, Math.round(y) + 0.5);
        }
        for (let c = 0; c <= state.cols; c++) {
          const x = c * cellWidth;
          ctx.moveTo(Math.round(x) + 0.5, 0);
          ctx.lineTo(Math.round(x) + 0.5, canvas.height);
        }
        ctx.stroke();
      }

      let syncTimeout = null;
      function scheduleSync() {
        if (!data.placeId || !window.opener || window.opener.closed) {
          return;
        }
        if (syncTimeout) {
          clearTimeout(syncTimeout);
        }
        syncTimeout = setTimeout(() => {
          syncTimeout = null;
          const revealedCells = Array.from(state.revealed).map(key => {
            const [row, col] = key.split(',').map(Number);
            return { row, col };
          });
          window.opener.postMessage({
            type: "fogUpdate",
            placeId: data.placeId,
            revealedCells
          }, origin);
        }, 120);
      }

      function handlePointer(evt) {
        if (!state.fogEnabled) {
          return;
        }
        const cell = getCellFromEvent(evt);
        if (!cell) {
          return;
        }
        applyBrush(cell.row, cell.col);
        renderScene();
        scheduleSync();
      }

      canvas.addEventListener('pointerdown', (evt) => {
        if (evt.button !== 0) {
          return;
        }
        evt.preventDefault();
        state.isDrawing = true;
        canvas.setPointerCapture(evt.pointerId);
        handlePointer(evt);
      });

      canvas.addEventListener('pointermove', (evt) => {
        if (!state.isDrawing) {
          return;
        }
        handlePointer(evt);
      });

      function endDrawing(evt) {
        if (state.isDrawing) {
          state.isDrawing = false;
          if (evt) {
            try {
              canvas.releasePointerCapture(evt.pointerId);
            } catch (error) {
              // ignore
            }
          }
        }
      }

      canvas.addEventListener('pointerup', endDrawing);
      canvas.addEventListener('pointercancel', endDrawing);
      canvas.addEventListener('contextmenu', (evt) => evt.preventDefault());

      window.addEventListener('message', (event) => {
        if (event.origin && event.origin !== window.location.origin) {
          return;
        }
        const payload = event.data;
        if (!payload || typeof payload !== 'object') {
          return;
        }
        if (payload.type === 'fogState' && payload.placeId === data.placeId) {
          state.fogEnabled = !!payload.fogEnabled;
          state.revealed = new Set((payload.revealedCells || []).map(cell => cell.row + ',' + cell.col));
          updateNotice();
          renderScene();
        }
      });

      if (window.opener && !window.opener.closed && data.placeId) {
        window.opener.postMessage({ type: 'fogRequest', placeId: data.placeId }, origin);
      }
    })();
  </script>
</body>
</html>`;

    playerViewWindow.document.open();
    playerViewWindow.document.write(html);
    playerViewWindow.document.close();

    if (isPlace) {
        playerViewPlaceId = item.id;
    } else {
        playerViewPlaceId = null;
    }

    playerViewWindow.onbeforeunload = () => {
        playerViewWindow = null;
        playerViewPlaceId = null;
    };
    try {
        playerViewWindow.focus();
    } catch (error) {
        // ignore focus errors
    }
}

/**
 * Displays detailed info about the selected item (NPC or object)
 * in the "Selected" tab, including images, attributes, HP, and inventory.
 */
function displaySelectedDetails(item) {
    const selectedTab = document.getElementById("tabSelected");
    selectedTab.innerHTML = "";

    const charSheet = document.createElement("div");
    charSheet.classList.add("character-sheet");

    const img = document.createElement("img");
    img.src = item.image || item.background || (item.schedule ? "assets/default_npc.png" : "assets/default_object.png");
    img.alt = item.name || "Unnamed";
    img.classList.add("character-image");
    charSheet.appendChild(img);

    const showPlayerButton = document.createElement("button");
    showPlayerButton.classList.add("player-view-button");
    showPlayerButton.dataset.i18n = "showToPlayer";
    showPlayerButton.addEventListener("click", (e) => {
        e.stopPropagation();
        showEntityInPlayerView(item);
    });
    charSheet.appendChild(showPlayerButton);

    const name = document.createElement("h1");
    name.textContent = item.name || "(Unnamed)";
    name.classList.add("character-name");
    charSheet.appendChild(name);

    // If the item has a schedule, treat it as an NPC
    if (item.schedule) {
        const baseAttributes = document.createElement("div");
        baseAttributes.classList.add("base-attributes");

        const fields = [
            { label: "name", value: item.name, i18n: "name" },
            { label: "profession", value: item.profession || "N/N", i18n: "profession" },
            {
                label: "appearance",
                value: item.appearance?.replace(/\n/g, "<br>") || "N/N",
                i18n: "appearance"
            },
            {
                label: "description",
                value: item.description?.replace(/\n/g, "<br>") || "N/N",
                i18n: "description"
            }
        ];

        fields.forEach(field => {
            const fieldDiv = document.createElement("div");
            fieldDiv.classList.add("base-attribute-field");

            const fieldLabel = document.createElement("strong");
            fieldLabel.dataset.i18n = field.i18n;

            const fieldValue = document.createElement("span");
            fieldValue.innerHTML = field.value;

            fieldDiv.appendChild(fieldLabel);
            fieldDiv.appendChild(fieldValue);
            baseAttributes.appendChild(fieldDiv);
        });

        // HP fields
        const hpFields = [
            { label: "currhp", current: "currentHP", max: "maxHP", i18n: "currhp" },
            {
                label: "currentmentalhp",
                current: "currentMentalHP",
                max: "maxMentalHP",
                i18n: "currentmentalhp"
            }
        ];

        hpFields.forEach(hp => {
            const hpDiv = document.createElement("div");
            hpDiv.classList.add("hp-field");

            const hpLabel = document.createElement("strong");
            hpLabel.dataset.i18n = hp.i18n;

            const currentInput = document.createElement("input");
            currentInput.type = "number";
            currentInput.value = item[hp.current] || 0;
            currentInput.classList.add("hp-input");
            currentInput.addEventListener("input", () => {
                item[hp.current] = parseInt(currentInput.value, 10) || 0;
                console.log(`${hp.current} updated:`, item[hp.current]);
            });

            const maxSpan = document.createElement("span");
            maxSpan.textContent = ` / ${item[hp.max] || 0}`;

            hpDiv.appendChild(hpLabel);
            hpDiv.appendChild(currentInput);
            hpDiv.appendChild(maxSpan);
            baseAttributes.appendChild(hpDiv);
        });

        charSheet.appendChild(baseAttributes);

        const attributesSection = document.createElement("div");
        attributesSection.classList.add("attributes-section");

        const attributesTitle = document.createElement("h2");
        attributesTitle.dataset.i18n = "attributes";
        attributesSection.appendChild(attributesTitle);

        const attributesGrid = document.createElement("div");
        attributesGrid.classList.add("attributes-grid");

        const categories = ["Physical", "Knowledge", "Social"];
        categories.forEach(category => {
            const categoryContainer = document.createElement("div");
            categoryContainer.classList.add("attribute-category");

            const powerPoints = item.attributes?.[category]?.powerPoints || 0;
            const bonusPoints = item.attributes?.[category]?.bonusPoints || 0;

            const categoryHeader = document.createElement("h3");
            categoryHeader.innerHTML = `
        <span data-i18n="${category.toLowerCase()}">${category}</span>
        <span class="bonus-points">+ ${bonusPoints}</span>
        <span class="power-points">⚡ ${powerPoints}</span>
      `;
            categoryContainer.appendChild(categoryHeader);

            const attributesList = document.createElement("ul");
            attributesList.classList.add("attributes-list");

            const entries = item.attributes?.[category]?.entries || [];
            entries.forEach(entry => {
                const total = entry.points + bonusPoints;
                const listItem = document.createElement("li");
                listItem.textContent = `${entry.name}: ${total}`;
                attributesList.appendChild(listItem);
            });

            if (entries.length === 0) {
                const noAttributesMessage = document.createElement("li");
                noAttributesMessage.textContent = "No attributes available.";
                attributesList.appendChild(noAttributesMessage);
            }

            categoryContainer.appendChild(attributesList);
            attributesGrid.appendChild(categoryContainer);
        });

        attributesSection.appendChild(attributesGrid);
        charSheet.appendChild(attributesSection);
    }

    // If it's not an NPC, treat it as an object
    if (!item.schedule) {
        const objectDetails = document.createElement("div");
        objectDetails.classList.add("object-details");

        const description = document.createElement("p");
        description.innerHTML = item.description?.replace(/\n/g, "<br>") || "No description available.";
        description.classList.add("object-description");
        objectDetails.appendChild(description);

        if (item.position) {
            const ownerDiv = document.createElement("div");
            ownerDiv.classList.add("owner-details");

            const collectBtn = document.createElement("button"); 
            collectBtn.dataset.i18n = "collect";

            collectBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const obj = objects.find(o => o.id === item.id);
                obj.position = null;
                renderdivInventoryListRight();
                updateObjectList(locationSelect.value);
                displaySelectedDetails(item);
              });
              ownerDiv.appendChild(collectBtn);

            if (item.position.type === "npc") {
                const owner = npcs.find(npc => npc.id === item.position.targetId);
                if (owner) {
                    const positionTitle = document.createElement("p");
                    positionTitle.dataset.i18n = "located_with";
                    const card = renderItemCard(owner, "npc");
                    ownerDiv.appendChild(positionTitle);
                    ownerDiv.appendChild(card);
                }
            } else if (item.position.type === "place") {
                const place = places.find(p => p.id === item.position.targetId);
                if (place) {
                    const positionTitle = document.createElement("p");
                    positionTitle.dataset.i18n = "located_with";
                    const card = renderItemCard(place, "place");
                    ownerDiv.appendChild(positionTitle);
                    ownerDiv.appendChild(card);
                }
            }
            objectDetails.appendChild(ownerDiv);
            
        }
        
        charSheet.appendChild(objectDetails);
    }

    // Inventory for NPCs
    if (item.schedule) {
        const inventorySection = document.createElement("div");
        inventorySection.classList.add("inventory-section");

        const inventoryTitle = document.createElement("h2");
        inventoryTitle.dataset.i18n = "inventory";
        inventorySection.appendChild(inventoryTitle);

        const inventoryContainer = document.createElement("div");
        inventoryContainer.classList.add("inventory-container");

        const npcObjects = objects.filter(
            obj => obj.position?.type === "npc" && obj.position.targetId === item.id
        );

        npcObjects.forEach(obj => {
            const card = renderItemCard(obj, "object");
            inventoryContainer.appendChild(card);
        });

        if (npcObjects.length === 0) {
            const noItemsMessage = document.createElement("div");
            noItemsMessage.dataset.i18n = "no_objects";
            inventoryContainer.appendChild(noItemsMessage);
        }

        inventorySection.appendChild(inventoryContainer);
        charSheet.appendChild(inventorySection);
    }

    selectedTab.appendChild(charSheet);

    // Refresh translations for displayed text
    loadLanguage(currentLanguage, languages);

    // Switch to the "Selected" tab
    document.querySelector('.tab-button[data-tab="tabSelected"]').click();
}
