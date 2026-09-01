/********************************************************************************
 * This file defines the scenario data structures (meta, npcs, objects, etc.), 
 * a function to generate unique IDs, a custom Quill blot for spoiler content, 
 * and utility methods to render item cards in the UI.
 ********************************************************************************/

// Global scenario data
let meta = {
  name: "Scenario",
  ruleset: "htbah"
};

let preDefinedColors = [
  "#587239", "#4939d1", "#4226c0", "#b49e3e", "#afbc87", "#25b0b3", "#64718f", "#745495",
  "#487354", "#419846", "#ac2fb8", "#ba58c9", "#be50b9", "#c96f53", "#cc4147", "#3caecd",
  "#8b693e", "#6a7151", "#c55093", "#724e64", "#a4a956", "#6387b1", "#a14ba0", "#bd52a1",
  "#6a7342", "#aa8548", "#6d70a8", "#a18d2b", "#50a98c", "#73415b", "#a65531", "#66cf46",
  "#b19b5d", "#7f5b58", "#994671", "#906846", "#7b3c9b", "#3b828f", "#bb27ab", "#5e8452",
  "#2d8cd3", "#8c66b9", "#be8265", "#817fc1", "#3dac5d", "#70399c", "#25be24", "#572fc2",
  "#302d8f", "#69bcb4", "#9937b1", "#4fc128", "#306bce", "#47628b", "#324272", "#cc4d9c",
  "#9bb62b", "#31bf92", "#507063", "#9544b1", "#5ba03b", "#9e5a29", "#9e625d", "#604770",
  "#6c4d69", "#558576", "#99be82", "#c370b8", "#339a8f", "#a68a2a", "#904356", "#7642b9",
  "#7f3c60", "#7aab79", "#ad5eb0", "#d15829", "#8958c0", "#b4328a", "#3b9685", "#9bba2f",
  "#5ec485", "#4b8a6b", "#5ab577", "#3d4ba7", "#61436a", "#6a8e53", "#3a7575", "#309f68",
  "#82864f", "#316e60", "#387c6c", "#86b73b", "#61878d", "#31abbd", "#2e9c61", "#364b7e",
  "#d42ac6", "#738e38", "#834c93", "#9bad49", "#aaa837", "#ba7f3f", "#944593", "#3ec8c8",
  "#ae5138", "#b879aa", "#6c7135", "#af602e", "#886c2c", "#47646a", "#b3c46a", "#70a8c6",
  "#ae5799", "#7d8231", "#c0505c", "#3a8d5d", "#cd7b3e", "#8c5fb3", "#b45fb1", "#b37880",
  "#7fa3bb", "#517769", "#6f92be", "#c6347e", "#377a81", "#4b5a33", "#3f8ba7", "#38cc2f"
];

let npcs = [];
let objects = [];
let places = [];
let timeline = [];
let events = [];
let playerCharacters = [];

/**
 * Generates a new unique ID by scanning all existing IDs across npcs, objects,
 * places (including their per-place ambient tracks and sound effects),
 * timeline, unsavedTimeline, and events. Returns the next available ID.
 */
function generateID() {
  const allIDs = [
    ...npcs.map(npc => parseInt(npc.id, 10)),
    ...objects.map(obj => parseInt(obj.id, 10)),
    ...places.map(place => parseInt(place.id, 10)),
    ...places.flatMap(place => (place.ambientTracks || []).map(track => parseInt(track.id, 10))),
    ...places.flatMap(place => (place.soundEffects || []).map(effect => parseInt(effect.id, 10))),
    ...timeline.map(tim => parseInt(tim.id, 10)),
    ...unsavedTimeline.map(utim => parseInt(utim.id, 10)),
    ...events.map(utim => parseInt(utim.id, 10)),
    ...playerCharacters.map(pc => parseInt(pc.id, 10))
  ].filter(id => !isNaN(id));

  const nextID = allIDs.length > 0 ? Math.max(...allIDs) + 1 : 1;
  return nextID.toString();
}

function getRandomColor() {
  return preDefinedColors[Math.floor(Math.random() * preDefinedColors.length)];
}

// Quill inline blot extension for "spoiler" text
const Inline = Quill.import("blots/inline");

class SpoilerBlot extends Inline {
  static create() {
    const node = super.create();
    node.setAttribute("class", "spoiler");
    node.setAttribute(
      "style",
      "background-color: black; color: black; cursor: pointer;"
    );
    node.setAttribute("title", "Spoiler: Klicken zum Anzeigen");
    return node;
  }

  static formats(node) {
    return node.getAttribute("class") === "spoiler";
  }
}

SpoilerBlot.blotName = "spoiler";
SpoilerBlot.tagName = "span";

Quill.register(SpoilerBlot);

class ItemLinkBlot extends Inline {
  static create(value) {
    const node = super.create();
    node.setAttribute('data-type', value.type);
    node.setAttribute('data-id', value.id);

    // Nur Farbe/Style setzen, aber NICHT node.textContent
    node.style.cursor = 'pointer';
    node.style.textDecoration = 'underline';

    node.classList.add('item-link');
    return node;
  }

  static formats(node) {
    return {
      type: node.getAttribute('data-type'),
      id: node.getAttribute('data-id')
    };
  }

  format(name, value) {
    if (name === 'itemLink' && value) {
      this.domNode.setAttribute('data-type', value.type);
      this.domNode.setAttribute('data-id', value.id);
    } else {
      super.format(name, value);
    }
  }
}
ItemLinkBlot.blotName = 'itemLink';
ItemLinkBlot.tagName = 'span';
Quill.register(ItemLinkBlot);

/**
 * Creates a small "card" element to visually represent various data types 
 * (NPC, object, place, or event) in the UI.
 */
function renderItemCard(data, type) {
  const card = document.createElement("div");
  card.classList.add("itemCard", "card");
  card.style.position = "relative";

  if (type !== "event") {
    const img = document.createElement("img");

    if (data.image || type !== "place") {
      img.src = data.image || `assets/default_${type}.png`;
    } else {
      img.src = data.background || `assets/default_${type}.png`;
    }

    img.alt = data.name || "Unbenannt";
    img.style.width = "50px";
    img.style.height = "50px";
    img.style.objectFit = "cover";
    card.appendChild(img);
  }

  const nameEl = document.createElement("div");
  nameEl.textContent = data.name || "(Unbenannt)";
  nameEl.classList.add("itemName");
  card.appendChild(nameEl);

  const adjustFontSize = () => {
    const cardWidth = card.offsetWidth;
    const maxWidth = cardWidth - 10; // Polsterung berücksichtigen
    const maxHeight = card.offsetHeight;
    let fontSize = 16; // Maximale Schriftgröße

    // Schriftgröße anpassen, falls Text zu groß ist
    nameEl.style.fontSize = `${fontSize}px`;
    while ((nameEl.scrollWidth > maxWidth || nameEl.scrollHeight > maxHeight) && fontSize > 8) {
      fontSize -= 1;
      nameEl.style.fontSize = `${fontSize}px`;
    }
  };

  // IntersectionObserver zur Schriftgrößenanpassung bei Sichtbarkeit
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          adjustFontSize();
          observer.unobserve(card); // Beobachtung beenden, nachdem es einmal angepasst wurde
        }
      });
    },
    { threshold: 0.1 } // Element ist sichtbar, wenn mindestens 10% angezeigt werden
  );

  observer.observe(card);

  const infoButton = document.createElement("button");
  infoButton.innerHTML = "🛈";
  infoButton.classList.add("infoButton");
  infoButton.style.position = "absolute";
  infoButton.style.top = "5px";
  infoButton.style.right = "5px";
  infoButton.style.padding = "0px 4px 2px 4px";

  infoButton.addEventListener("click", (e) => {
    e.stopPropagation();
    displaySelectedDetails(data);
    document.querySelector('.tab-button[data-tab="tabSelected"]').click();
  });

  card.appendChild(infoButton);
  return card;
}

/**
 * Applies a visual highlight (outline) to the selected item card,
 * removing any highlight from previously selected cards.
 */
function highlightSelectedItemCard(selectedItemDiv) {
  const allItems = document.querySelectorAll(".card");
  allItems.forEach((item) => {
    item.style.outline = "none";
  });
  selectedItemDiv.style.outline = "var(--accent-color) 4px solid";
}
