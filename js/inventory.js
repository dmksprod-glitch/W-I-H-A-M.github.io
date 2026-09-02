// *************************************
// DOM Element References & Global State
// *************************************
const divInventoryListRight = document.getElementById("divInventoryListRight");

/**
 * Renders the player's current inventory items (objects without a position)
 * inside the right-hand inventory panel.
 */
function renderdivInventoryListRight() {
    divInventoryListRight.innerHTML = "";

    // Create a section to hold the inventory title and items
    const inventorySection = document.createElement("div");
    inventorySection.classList.add("inventory-section");

    // Add a heading for the inventory section
    const inventoryTitle = document.createElement("h2");
    inventoryTitle.dataset.i18n = "inventory";
    inventorySection.appendChild(inventoryTitle);

    // Create a container for listing the items
    const inventoryContainer = document.createElement("div");
    inventoryContainer.classList.add("inventory-container");

    // Filter out objects that have no position (i.e., in the player's
    // inventory) or that were explicitly marked as collected on the map -
    // that object's original position is kept for reference, so it isn't
    // caught by the position === null check on its own.
    const playerObjects = objects.filter(obj => obj.position === null || obj.collected);

    // Render a card for each of these objects
    playerObjects.forEach(obj => {
        const card = renderItemCard(obj, "object");
        inventoryContainer.appendChild(card);
    });

    // Append the container with all items into the main inventory section
    divInventoryListRight.appendChild(inventoryContainer);
}
