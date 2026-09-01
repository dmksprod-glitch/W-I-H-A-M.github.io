/********************************************************************************
 * How to be a Hero - quick rules reference.
 * Content is condensed from the official HTBAH Grundregelwerk (CC BY-NC-SA,
 * howtobeahero.de) so GMs can look up the relevant mechanics mid-session
 * without leaving the tool. Shared between index.html, charakterbogen.html
 * and cardcreator.html - any button with a `data-rules-topic` attribute (or
 * class `htbah-rules-trigger`) opens this same modal.
 ********************************************************************************/

const HTBAH_RULES_TOPICS = [
    {
        id: "begabungen",
        title: "Begabungen",
        html: `
            <h3>Begabungen</h3>
            <p>Drei Begabungen bilden die Grundlage jedes Charakters: <strong>Handeln</strong>, <strong>Wissen</strong> und <strong>Soziales</strong>. Sie geben an, wie fähig ein Charakter in einem ganzen Bereich ist.</p>
            <ul>
                <li><strong>Handeln</strong> &ndash; vor allem körperlich: Kraft, Feinmotorik, aktive Tätigkeiten (z.&nbsp;B. einen Baum fällen, eine Holzfigur schnitzen).</li>
                <li><strong>Wissen</strong> &ndash; analytisch, faktenbasiert: Sprachen, Politik, Mathematik, Natur.</li>
                <li><strong>Soziales</strong> &ndash; Interaktion mit NPCs: Lügen, Manipulieren, aber auch passiv Menschenkenntnis.</li>
            </ul>
            <div class="htbah-callout">Hat ein Charakter keine passende Fähigkeit gelernt, wird auf die zuständige Begabung gewürfelt. <strong>Würfe auf Begabungen können keine kritischen Erfolge erzielen.</strong></div>
        `
    },
    {
        id: "faehigkeiten",
        title: "Fähigkeiten & Formel",
        html: `
            <h3>Fähigkeiten &amp; Berechnung</h3>
            <p>Fähigkeiten sind explizit erlernte Tätigkeiten und gehören immer zu genau einer Begabung. Eine passende Fähigkeit einzusetzen ist immer besser, als auf die reine Begabung zu würfeln.</p>
            <h4>Formel</h4>
            <ul>
                <li>Jeder Charakter erhält zu Beginn <strong>400 Fähigkeitspunkte</strong> zum Verteilen.</li>
                <li><strong>Begabungswert</strong> = Summe aller Fähigkeitspunkte einer Begabung ÷ 10, kaufmännisch gerundet.</li>
                <li><strong>Fähigkeitswert</strong> = eingesetzte Fähigkeitspunkte + Begabungswert der zugehörigen Begabung (der Bonus wird addiert, außer ein Spieler verzichtet explizit darauf).</li>
                <li>Kein Fähigkeitswert darf über <strong>100</strong> liegen &ndash; überzählige Punkte anderweitig in derselben Begabung einsetzen.</li>
            </ul>
            <div class="htbah-callout">Tipp aus dem Regelwerk: Sehr niedrige Werte (1&ndash;5 Punkte) auf einzelne Fähigkeiten sind meist wenig sinnvoll.</div>
        `
    },
    {
        id: "geistesblitz",
        title: "Geistesblitzpunkte",
        html: `
            <h3>Geistesblitzpunkte</h3>
            <p>Geistesblitzpunkte (GBP) erlauben es, eine verpatzte Probe noch einmal zu würfeln &ndash; solange der erste Wurf <strong>kein kritischer Misserfolg</strong> war.</p>
            <ul>
                <li><strong>Formel:</strong> Begabungswert ÷ 10, kaufmännisch gerundet &ndash; getrennt für Handeln, Wissen und Soziales.</li>
                <li>Beispiel: Begabungswert 12 → 1 GBP. Begabungswert 15 → 2 GBP.</li>
                <li>GBP gelten nur für die jeweilige Begabung (Wissen-GBP können nicht für eine Handeln-Probe verwendet werden).</li>
                <li>Ein eingesetzter GBP ist für den Moment verbraucht.</li>
                <li>GBP sind einen Abend bzw. ein Abenteuer lang gültig und regenerieren sich erst danach vollständig &ndash; ungenutzte Punkte werden <strong>nicht</strong> übertragen.</li>
                <li>Zieht sich ein Abenteuer über mehrere Abende, regenerieren sich die GBP bis zum nächsten Abend.</li>
            </ul>
        `
    },
    {
        id: "lebenspunkte",
        title: "Lebenspunkte",
        html: `
            <h3>Lebenspunkte</h3>
            <ul>
                <li>Jeder Charakter hat standardmäßig <strong>100 Lebenspunkte</strong> (per Hausregel anpassbar).</li>
                <li>Unter <strong>10 LP</strong>: bewusstlos, benötigt medizinische Hilfe.</li>
                <li><strong>0 LP</strong>: der Charakter stirbt.</li>
                <li>Verliert ein Charakter durch einen einzelnen Angriff <strong>mehr als 60 LP auf einen Schlag</strong>, wird er ebenfalls bewusstlos (unabhängig vom Rest-LP-Stand) und kann nicht mehr parieren oder angreifen &ndash; auch er benötigt dann medizinische Versorgung.</li>
            </ul>
        `
    },
    {
        id: "vorNachteile",
        title: "Vor- & Nachteile",
        html: `
            <h3>Vor- &amp; Nachteile</h3>
            <p>Spieler können mit dem Spielleiter individuelle Vor- oder Nachteile aushandeln:</p>
            <ul>
                <li><strong>Nachteil</strong> → der Spieler erhält dafür Fähigkeitspunkte.</li>
                <li><strong>Vorteil</strong> → der Spieler bezahlt dafür Fähigkeitspunkte.</li>
                <li>Die Menge der Punkte richtet sich nach der Schwere des Vor-/Nachteils (eine absolute Spinnenphobie wiegt z.&nbsp;B. weniger schwer als landesweite Unbeliebtheit).</li>
            </ul>
            <h4>Beispiele</h4>
            <ul>
                <li><strong>Vorteile:</strong> Furchtlosigkeit, gute soziale Position, Stadtbekanntheit.</li>
                <li><strong>Nachteile:</strong> Phobien aller Art, Zwangsneurotik, Legasthenie.</li>
            </ul>
        `
    },
    {
        id: "chargen",
        title: "Charaktererstellung",
        html: `
            <h3>Charaktererstellung Schritt für Schritt</h3>
            <ol>
                <li>Charakterkonzept überlegen: Name, Geschlecht, Alter, Statur, Beruf, Eigenarten.</li>
                <li><strong>400 Fähigkeitspunkte</strong> auf selbst gewählte Fähigkeiten verteilen, aufgeteilt auf Handeln / Wissen / Soziales.</li>
                <li>Pro Begabung: eingesetzte Punkte summieren, durch 10 teilen (kaufmännisch runden) → <strong>Begabungswert</strong>.</li>
                <li>Begabungswert auf jede Fähigkeit der Gruppe addieren → <strong>Fähigkeitswert</strong>.</li>
                <li>Begabungswert nochmal durch 10 teilen (runden) → <strong>Geistesblitzpunkte</strong> dieser Begabung.</li>
                <li>Kein Fähigkeitswert über 100 &ndash; sonst Punkte umverteilen.</li>
            </ol>
            <h4>Beispiel (Howky, 400 Punkte)</h4>
            <table>
                <thead><tr><th>Handeln</th><th>Wissen</th><th>Soziales</th></tr></thead>
                <tbody>
                    <tr><td>Fußball spielen: 40</td><td>P&amp;P-Konzeption: 75</td><td>Schauspielern: 68</td></tr>
                    <tr><td>Beweglichkeit: 30</td><td>Hintergrundgeschichten: 40</td><td>Wikis illustrieren: 40</td></tr>
                    <tr><td></td><td>Medienmarketing: 55</td><td>Interaktion mit Bohnen: 52</td></tr>
                    <tr><td><strong>Summe 70 → Begabung 7 (GBP 1)</strong></td><td><strong>Summe 170 → Begabung 17 (GBP 2)</strong></td><td><strong>Summe 160 → Begabung 16 (GBP 2)</strong></td></tr>
                </tbody>
            </table>
            <p>Fähigkeitswert am Ende z.&nbsp;B. Fußball spielen: 40 + 7 = <strong>47</strong>.</p>
        `
    },
    {
        id: "proben",
        title: "Proben & kritische Würfe",
        html: `
            <h3>Proben &amp; kritische Würfe</h3>
            <ul>
                <li>Eine <strong>Probe</strong> ist ein Würfelwurf, der prüft, ob eine Aktion gelingt.</li>
                <li>Es wird auf die passende <strong>Fähigkeit</strong> gewürfelt, falls vorhanden &ndash; sonst auf die zugehörige <strong>Begabung</strong> (Begabungswürfe können nicht kritisch gelingen).</li>
                <li>Gewürfelt wird mit <strong>W10</strong> bzw. <strong>W100</strong>.</li>
            </ul>
            <h4>Kritischer Erfolg</h4>
            <p>Die obersten <strong>10&nbsp;%</strong> des Fähigkeits-/Begabungswerts zählen als kritischer Erfolg &ndash; bestmögliches Ergebnis.</p>
            <h4>Kritischer Misserfolg</h4>
            <p>Der Bereich zwischen <strong>(10&nbsp;% des Werts + 90)</strong> und 100 zählt als kritischer Misserfolg &ndash; schlechtestmögliches Ergebnis.</p>
        `
    },
    {
        id: "kampfablauf",
        title: "Kampfablauf",
        html: `
            <h3>Kampfablauf</h3>
            <p>Eine Kampfrunde verbraucht in der Spielwelt 3&ndash;8 Sekunden. Ein Kampf gliedert sich in vier Phasen:</p>
            <ol>
                <li><strong>Initiative</strong> &ndash; 1W10 + Begabungswert Handeln. Höherer Wert handelt zuerst. Haben mehrere NPCs denselben Handeln-Wert, kann der SL einen gemeinsamen Initiative-Wurf für alle würfeln.</li>
                <li><strong>Überraschungsrunde</strong> &ndash; wer seine Gegner zu Kampfbeginn nicht wahrgenommen hat, setzt die erste Runde aus (unabhängig von seiner Initiative). Ein vorheriger Wahrnehmungswurf kann das verhindern.</li>
                <li><strong>Kampf (rundenbasiert)</strong> &ndash; Charaktere handeln der Reihe nach nach Initiative; diese wird vor jedem neuen Kampf erneut ausgewürfelt.</li>
                <li><strong>Ende</strong> &ndash; wenn alle Charaktere einer Seite 0 LP haben, geflohen sind oder sich ergeben.</li>
            </ol>
        `
    },
    {
        id: "angriffVerteidigung",
        title: "Angriff & Verteidigung",
        html: `
            <h3>Angriff &amp; Verteidigung</h3>
            <h4>Angriff</h4>
            <p>Wurf auf die passende Fähigkeit des Charakters. Bei Erfolg trifft der Charakter und fügt Schaden zu.</p>
            <h4>Verteidigung / Parade</h4>
            <ul>
                <li>Einmal pro Runde kann ein Charakter einen Angriff parieren &ndash; Wurf auf <strong>Handeln</strong>.</li>
                <li>Schild oder besonders geeignete/ungeeignete Waffen können vom SL mit Boni/Mali belegt werden.</li>
                <li><strong>Kritische Angriffe können nicht pariert werden.</strong></li>
                <li>Wird ein Waffenangriff mit bloßen Fäusten pariert, nimmt der Charakter die <strong>Hälfte des Schadens</strong> (gerundet).</li>
                <li><strong>Schusswaffen können nicht pariert werden.</strong></li>
            </ul>
        `
    },
    {
        id: "schaden",
        title: "Schaden & Waffentabelle",
        html: `
            <h3>Schaden &amp; Waffentabelle</h3>
            <p>Der Schaden wird mit <strong>X × W10</strong> gewürfelt, wobei X von der Waffe abhängt. Ein <strong>kritischer Treffer verdoppelt</strong> den ausgewürfelten Schaden. Bei 0 Lebenspunkten stirbt der Charakter sofort.</p>
            <table>
                <thead><tr><th>Waffe</th><th>Schaden</th></tr></thead>
                <tbody>
                    <tr><td>Improvisierte Waffen / waffenloser Kampf</td><td>1W10</td></tr>
                    <tr><td>Stock</td><td>1W10 + 5</td></tr>
                    <tr><td>Messer / Dolch</td><td>2W10</td></tr>
                    <tr><td>Steinschleuder / Wurfwaffen</td><td>3W10</td></tr>
                    <tr><td>Axt / Streitkolben / Kriegshammer / Baseballschläger</td><td>4W10</td></tr>
                    <tr><td>Schwert / Machete</td><td>5W10</td></tr>
                    <tr><td>Bogen / Armbrust</td><td>6W10</td></tr>
                    <tr><td>Pistolen</td><td>7W10</td></tr>
                    <tr><td>Gewehre</td><td>8W10</td></tr>
                    <tr><td>Schrotflinte (Schaden sinkt mit Entfernung)</td><td>9W10</td></tr>
                    <tr><td>Bombe / Granate / Mine / Raketenwerfer</td><td>10W10</td></tr>
                </tbody>
            </table>
            <div class="htbah-callout">Diese Tabelle ist ein Richtwert. Der SL kann Waffen mit absoluten Boni versehen (z.&nbsp;B. das legendäre Schwert Excalibur: 5W10 + 10) oder waffenlosen Kampf für besonders starke Charaktere anpassen.</div>
        `
    }
];

/**
 * Lazily creates the rules modal DOM (once) and appends it to <body>.
 */
function ensureHtbahRulesModal() {
    if (document.getElementById("htbahRulesOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "htbahRulesOverlay";
    overlay.className = "htbah-rules-overlay hidden";
    overlay.innerHTML = `
        <div class="htbah-rules-modal" role="dialog" aria-modal="true" aria-labelledby="htbahRulesTitle">
            <div class="htbah-rules-head">
                <h2 id="htbahRulesTitle">How to be a Hero &ndash; Regel-Schnellzugriff</h2>
                <button type="button" class="htbah-rules-close" aria-label="Schließen">&times;</button>
            </div>
            <div class="htbah-rules-body">
                <nav class="htbah-rules-nav" id="htbahRulesNav"></nav>
                <div class="htbah-rules-content" id="htbahRulesContent"></div>
            </div>
            <div class="htbah-rules-foot">
                Quelle: offizielles <a href="https://howtobeahero.de/images/4/47/Regelwerk.pdf" target="_blank" rel="noopener">HTBAH-Grundregelwerk</a>
                (CC BY-NC-SA) &middot; <a href="https://howtobeahero.de" target="_blank" rel="noopener">howtobeahero.de</a>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector(".htbah-rules-close").addEventListener("click", closeHtbahRules);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeHtbahRules();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !overlay.classList.contains("hidden")) closeHtbahRules();
    });

    const nav = overlay.querySelector("#htbahRulesNav");
    HTBAH_RULES_TOPICS.forEach(topic => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "htbah-rules-nav-btn";
        btn.dataset.topic = topic.id;
        btn.textContent = topic.title;
        btn.addEventListener("click", () => selectHtbahRulesTopic(topic.id));
        nav.appendChild(btn);
    });
}

function selectHtbahRulesTopic(topicId) {
    const topic = HTBAH_RULES_TOPICS.find(t => t.id === topicId) || HTBAH_RULES_TOPICS[0];

    document.querySelectorAll(".htbah-rules-nav-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.topic === topic.id);
    });

    const content = document.getElementById("htbahRulesContent");
    if (content) {
        content.innerHTML = topic.html;
        content.scrollTop = 0;
    }
}

/**
 * Opens the rules modal, optionally jumping straight to a given topic id.
 * Falls back to the first topic if none is given or found.
 */
function openHtbahRules(topicId) {
    ensureHtbahRulesModal();
    document.getElementById("htbahRulesOverlay").classList.remove("hidden");
    selectHtbahRulesTopic(topicId);
}

function closeHtbahRules() {
    const overlay = document.getElementById("htbahRulesOverlay");
    if (overlay) overlay.classList.add("hidden");
}

// Any element with a `data-rules-topic` attribute or the `htbah-rules-trigger`
// class opens the modal - no per-button wiring needed elsewhere.
document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-rules-topic], .htbah-rules-trigger");
    if (trigger) {
        openHtbahRules(trigger.dataset.rulesTopic || null);
    }
});
