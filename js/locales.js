/**
 * Holds loaded language data.
 */
let languages = {};

/**
 * Stores the currently active language code.
 */
let currentLanguage = 'de';

/**
 * Holds the translation strings for the active language.
 */
let translations = {};

/**
 * Loads available languages from the 'locales.json' file,
 * sets the default language based on the browser's preference or fallback,
 * populates the language dropdown, and attaches a listener for language changes.
 */
async function loadLanguages() {
    try {
        const response = await fetch('locales.json');
        if (!response.ok) {
            throw new Error(`HTTP-Error: ${response.status}`);
        }
        languages = await response.json();

        const browserLang = getBrowserLanguage();
        currentLanguage = languages[browserLang] ? browserLang : 'en';

        populateLanguageSelector(languages);
        loadLanguage(currentLanguage, languages);

        document.getElementById('languageSelector').addEventListener('change', (e) => {
            const selectedLanguage = e.target.value;
            if (!languages[selectedLanguage]) {
                console.error(`Invalid language chosen: '${selectedLanguage}'`);
                return;
            }
            currentLanguage = selectedLanguage;
            loadLanguage(currentLanguage, languages);
        });
    } catch (error) {
        console.error("Error loading language data:", error);
    }
}

/**
 * Populates the language dropdown with available languages,
 * setting the default or first language as the selected option.
 */
function populateLanguageSelector(languages) {
    const languageSelector = document.getElementById('languageSelector');
    languageSelector.innerHTML = "";

    for (const langCode in languages) {
        const option = document.createElement('option');
        option.value = langCode;
        option.textContent = languages[langCode].languageTitel || langCode;
        languageSelector.appendChild(option);
    }

    if (languages[currentLanguage]) {
        languageSelector.value = currentLanguage;
    } else {
        const firstLanguage = Object.keys(languages)[0];
        currentLanguage = firstLanguage;
        languageSelector.value = firstLanguage;
    }
}

/**
 * Loads the translations for the given language code
 * and updates all translatable text on the page.
 */
function loadLanguage(langCode, languages) {
    if (!languages[langCode]) {
        console.error(`Language '${langCode}' not found!`);
        return;
    }
    translations = languages[langCode];
    updateTexts();
    if (typeof renderCockpit === "function") {
        renderCockpit();
    }
    if (typeof renderDbStatus === "function") {
        renderDbStatus();
    }
}

/**
 * Retrieves a translation by key. If none is found, returns the key itself.
 */
function t(key) {
    return translations[key] || key;
}

/**
 * Updates the text content of all elements with a 'data-i18n' attribute
 * based on the currently active translations.
 */
function updateTexts() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
}

/**
 * Determines the browser's default language by reading 'navigator.language'
 * (or 'navigator.languages' as a fallback), returning only the base code.
 */
function getBrowserLanguage() {
    const userLang = navigator.language || navigator.languages[0] || 'en';
    const langCode = userLang.split('-')[0];
    return langCode;
}

/**
 * Initializes language loading after DOM is ready.
 */
document.addEventListener('DOMContentLoaded', () => {
    loadLanguages();
});
