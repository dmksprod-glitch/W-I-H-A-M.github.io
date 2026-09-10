/**
 * Header W100 roller: one tens-die (00, 10, ... 90) plus one ones-die
 * (0-9), combined into a percentile result from 1 to 100 - the standard
 * "How to be a Hero" skill check roll (see htbahRules.js, "Proben &
 * kritische Würfe"). 00 + 0 counts as 100, not 0.
 */
const headerDiceToggle = document.getElementById("headerDiceToggle");
const headerDicePanel = document.getElementById("headerDicePanel");
const btnCloseDicePanel = document.getElementById("btnCloseDicePanel");
const btnRollDice = document.getElementById("btnRollDice");
const diceTensDie = document.getElementById("diceTens");
const diceOnesDie = document.getElementById("diceOnes");
const diceTensValue = diceTensDie?.querySelector(".dice-die-value");
const diceOnesValue = diceOnesDie?.querySelector(".dice-die-value");
const diceResultValue = document.getElementById("diceResultValue");

let diceRolling = false;

headerDiceToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    headerDicePanel.classList.toggle("hidden");
});

btnCloseDicePanel?.addEventListener("click", () => {
    headerDicePanel.classList.add("hidden");
});

document.addEventListener("click", () => {
    if (headerDicePanel && !headerDicePanel.classList.contains("hidden")) {
        headerDicePanel.classList.add("hidden");
    }
});

headerDicePanel?.addEventListener("click", (e) => e.stopPropagation());

function rollHeaderDice() {
    if (diceRolling) return;
    diceRolling = true;
    btnRollDice.disabled = true;
    diceTensDie.classList.add("rolling");
    diceOnesDie.classList.add("rolling");
    diceResultValue.parentElement.classList.remove("dice-roller-result-pop");

    const finalTens = Math.floor(Math.random() * 10);
    const finalOnes = Math.floor(Math.random() * 10);

    let ticks = 0;
    const maxTicks = 12;
    const spin = setInterval(() => {
        diceTensValue.textContent = String(Math.floor(Math.random() * 10) * 10).padStart(2, "0");
        diceOnesValue.textContent = String(Math.floor(Math.random() * 10));
        ticks++;
        if (ticks >= maxTicks) {
            clearInterval(spin);
            diceTensValue.textContent = String(finalTens * 10).padStart(2, "0");
            diceOnesValue.textContent = String(finalOnes);
            diceTensDie.classList.remove("rolling");
            diceOnesDie.classList.remove("rolling");

            const result = finalTens * 10 + finalOnes || 100;
            diceResultValue.textContent = result;
            diceResultValue.parentElement.classList.add("dice-roller-result-pop");

            diceRolling = false;
            btnRollDice.disabled = false;
        }
    }, 60);
}

btnRollDice?.addEventListener("click", rollHeaderDice);
