// Shared storage helpers, loaded by content.js, popup.js and all-highlights.js.
//
// Each saved highlight looks like:
// {
//   id:        unique string, used for deleting and for matching <mark> tags on the page
//   url:       page URL without the #hash
//   title:     the page's title when the highlight was made ("" if unknown)
//   text:      the highlighted text
//   prefix:    up to 32 characters of page text just before the highlight
//   suffix:    up to 32 characters of page text just after the highlight
//   color:     one of HIGHLIGHT_COLORS
//   note:      the user's note ("" if none)
//   tags:      array of tag strings, e.g. ["exam", "research"]
//   createdAt: timestamp in milliseconds
//   updatedAt: timestamp of the last edit (missing if never edited)
// }
//
// prefix and suffix tell apart repeated phrases, so the right
// occurrence is restored when the same text appears more than once.

const HIGHLIGHTS_KEY = "highlights";
const SETTINGS_KEY = "settings";

// Order here is the order the color buttons appear in
const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"];
const DEFAULT_COLOR = "yellow";

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

// Older versions saved fewer fields. Fill in anything missing.
// Returns the upgraded list and whether anything changed.
function migrateHighlights(highlights){

    let changed = false;
    const seen = {}; // count repeats of the same url + text among entries without an id

    const migrated = highlights.map((highlight) =>{

        const url = normalizeUrl(highlight.url);

        const upToDate =
            highlight.id &&
            url === highlight.url &&
            typeof highlight.title === "string" &&
            HIGHLIGHT_COLORS.includes(highlight.color) &&
            typeof highlight.note === "string" &&
            Array.isArray(highlight.tags);

        if (upToDate){
            return highlight;
        }

        changed = true;

        let id = highlight.id;

        if (!id){
            const key = url + "\n" + highlight.text;
            seen[key] = (seen[key] || 0) + 1;
            id = "legacy-" + hashString(key + "\n" + seen[key]);
        }

        return {
            id: id,
            url: url,
            title: typeof highlight.title === "string" ? highlight.title : "",
            text: highlight.text,
            prefix: highlight.prefix || "",
            suffix: highlight.suffix || "",
            color: HIGHLIGHT_COLORS.includes(highlight.color) ? highlight.color : DEFAULT_COLOR,
            note: typeof highlight.note === "string" ? highlight.note : "",
            tags: Array.isArray(highlight.tags) ? highlight.tags : [],
            createdAt: highlight.createdAt || 0
        };
    });

    return { highlights: migrated, changed: changed };
}

// --------------------READ / WRITE--------------------

// Every change reads the whole list, edits it and writes it back.
// Two changes running at the same time (say, a note saving while a
// color is clicked) could each write over the other's edit, so changes
// made from this page wait their turn.
let writeQueue = Promise.resolve();

function queueWrite(change){

    const result = writeQueue.then(change);
    writeQueue = result.catch(() => {});

    return result;
}

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

function addHighlight(highlight){

    return queueWrite(async () =>{

        const highlights = await getAllHighlights();

        highlights.push(highlight);

        await browser.storage.local.set({ [HIGHLIGHTS_KEY]: highlights });
    });
}

function deleteHighlightById(id){

    return queueWrite(async () =>{

        const highlights = await getAllHighlights();

        await browser.storage.local.set({
            [HIGHLIGHTS_KEY]: highlights.filter(highlight => highlight.id !== id)
        });
    });
}

// Change some fields of one highlight, for example {color: "green"}
function updateHighlight(id, changes){

    return queueWrite(async () =>{

        const highlights = await getAllHighlights();

        await browser.storage.local.set({
            [HIGHLIGHTS_KEY]: highlights.map(highlight =>
                highlight.id === id
                    ? { ...highlight, ...changes, id: id, updatedAt: Date.now() }
                    : highlight
            )
        });
    });
}

// Adds highlights from a backup file. Skips any that are already
// saved: same id, or same page, text and surrounding text.
// Returns {added, skipped}.
function importHighlights(incoming){

    return queueWrite(async () =>{

        const highlights = await getAllHighlights();

        const contentKey = h =>
            [h.url, h.text, h.prefix, h.suffix].join("\n");

        const ids = new Set(highlights.map(h => h.id));
        const keys = new Set(highlights.map(contentKey));

        let added = 0;
        let skipped = 0;

        incoming.forEach((highlight) =>{

            if (ids.has(highlight.id) || keys.has(contentKey(highlight))){
                skipped++;
                return;
            }

            ids.add(highlight.id);
            keys.add(contentKey(highlight));
            highlights.push(highlight);
            added++;
        });

        if (added > 0){
            await browser.storage.local.set({ [HIGHLIGHTS_KEY]: highlights });
        }

        return { added: added, skipped: skipped };
    });
}

// Highlights saved before titles existed have title "".
// Fill them in the next time their page is opened.
function fillMissingTitles(url, title){

    return queueWrite(async () =>{

        const pageUrl = normalizeUrl(url);
        const highlights = await getAllHighlights();

        if (!title || !highlights.some(h => h.url === pageUrl && !h.title)){
            return;
        }

        await browser.storage.local.set({
            [HIGHLIGHTS_KEY]: highlights.map(highlight =>
                highlight.url === pageUrl && !highlight.title
                    ? { ...highlight, title: title }
                    : highlight
            )
        });
    });
}

// --------------------SETTINGS--------------------

// The color picked in the popup, remembered for next time
async function getSelectedColor(){

    const result = await browser.storage.local.get(SETTINGS_KEY);
    const color = (result[SETTINGS_KEY] || {}).color;

    return HIGHLIGHT_COLORS.includes(color) ? color : DEFAULT_COLOR;
}

async function setSelectedColor(color){

    const result = await browser.storage.local.get(SETTINGS_KEY);

    await browser.storage.local.set({
        [SETTINGS_KEY]: { ...(result[SETTINGS_KEY] || {}), color: color }
    });
}

// --------------------TAGS--------------------

const MAX_TAG_LENGTH = 40;

// "Exam, #research,  exam" -> ["Exam", "research"]
// Tags are compared without caring about capitals, and
// the first spelling typed is the one kept.
function parseTags(text){

    return mergeTags([], String(text).split(","));
}

// Adds new tags to a list, skipping blanks and duplicates
function mergeTags(existing, additions){

    const tags = [...existing];

    additions.forEach((raw) =>{

        const tag = String(raw)
            .replace(/\s+/g, " ")
            .trim()
            .replace(/^#+\s*/, "")
            .slice(0, MAX_TAG_LENGTH)
            .trim();

        if (tag && !tags.some(t => t.toLowerCase() === tag.toLowerCase())){
            tags.push(tag);
        }
    });

    return tags;
}

// Every tag in use, with how many highlights have it, most used first
function countTags(highlights){

    const counts = {};
    const spelling = {};

    highlights.forEach((highlight) =>{
        highlight.tags.forEach((tag) =>{
            const key = tag.toLowerCase();
            counts[key] = (counts[key] || 0) + 1;
            spelling[key] = spelling[key] || tag;
        });
    });

    return Object.keys(counts)
        .map(key => ({ tag: spelling[key], count: counts[key] }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

function hasTag(highlight, tag){
    return highlight.tags.some(t => t.toLowerCase() === tag.toLowerCase());
}

// --------------------DISPLAY HELPERS--------------------

// "https://en.wikipedia.org/wiki/Cat" -> "en.wikipedia.org"
function getDomain(url){

    try{
        return new URL(url).hostname || url;
    }catch{
        return url;
    }
}
