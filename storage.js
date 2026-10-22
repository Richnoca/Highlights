// Shared storage helpers, loaded by content.js, popup.js and all-highlights.js.
//
// Each saved highlight looks like:
// {
//   id:        unique string, used for deleting and for matching <mark> tags on the page
//   url:       page URL without the #hash
//   text:      the highlighted text
//   prefix:    up to 32 characters of page text just before the highlight
//   suffix:    up to 32 characters of page text just after the highlight
//   createdAt: timestamp in milliseconds
// }
//
// prefix and suffix tell apart repeated phrases, so the right
// occurrence is restored when the same text appears more than once.

const HIGHLIGHTS_KEY = "highlights";

// --------------------URL NORMALIZING--------------------

// "page#History" and "page" are the same page, so drop the hash.
function normalizeUrl(url){

    try{
        const parsed = new URL(url);
        parsed.hash = "";
        return parsed.href;
    }catch{
        return url;
    }
}

// --------------------IDS--------------------

function createHighlightId(){

    if (typeof crypto !== "undefined" && crypto.randomUUID){
        return crypto.randomUUID();
    }

    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Small string hash (FNV-1a). Used to give old highlights
// an id that is the same no matter which tab migrates them,
// so two tabs migrating at once agree on the result.
function hashString(text){

    let hash = 0x811c9dc5;

    for (let i = 0; i < text.length; i++){
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }

    return hash.toString(16);
}

// --------------------MIGRATION--------------------

// Older versions saved only {url, text}. Fill in the missing fields.
// Returns the upgraded list and whether anything changed.
function migrateHighlights(highlights){

    let changed = false;
    const seen = {}; // count repeats of the same url + text

    const migrated = highlights.map((highlight) =>{

        const url = normalizeUrl(highlight.url);

        if (highlight.id && url === highlight.url){
            return highlight;
        }

        changed = true;

        const key = url + "\n" + highlight.text;
        seen[key] = (seen[key] || 0) + 1;

        return {
            id: highlight.id || "legacy-" + hashString(key + "\n" + seen[key]),
            url: url,
            text: highlight.text,
            prefix: highlight.prefix || "",
            suffix: highlight.suffix || "",
            createdAt: highlight.createdAt || 0
        };
    });

    return { highlights: migrated, changed: changed };
}

// --------------------READ / WRITE--------------------

async function getAllHighlights(){

    const result = await browser.storage.local.get(HIGHLIGHTS_KEY);

    const { highlights, changed } =
        migrateHighlights(result[HIGHLIGHTS_KEY] || []);

    if (changed){
        await browser.storage.local.set({ [HIGHLIGHTS_KEY]: highlights });
    }

    return highlights;
}

async function getHighlightsForUrl(url){

    const pageUrl = normalizeUrl(url);
    const highlights = await getAllHighlights();

    return highlights.filter(highlight => highlight.url === pageUrl);
}

async function addHighlight(highlight){

    const highlights = await getAllHighlights();

    highlights.push(highlight);

    await browser.storage.local.set({ [HIGHLIGHTS_KEY]: highlights });
}

async function deleteHighlightById(id){

    const highlights = await getAllHighlights();

    await browser.storage.local.set({
        [HIGHLIGHTS_KEY]: highlights.filter(highlight => highlight.id !== id)
    });
}
