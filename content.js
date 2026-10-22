// Runs on every webpage. Draws, restores and removes highlights.
// Storage helpers (getHighlightsForUrl, addHighlight, ...) come from storage.js.

const MARK_CLASS = "Highlights-highlight";
const CONTEXT_LENGTH = 32;        // characters of prefix/suffix to save
const RETRY_DURATION_MS = 20000;  // keep looking for late-loading text this long

// Text inside these elements is never highlighted
const SKIPPED_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "SELECT", "OPTION"
]);

// ----------------------MESSAGES FROM popup.js----------------------

browser.runtime.onMessage.addListener((message) =>{

    if (message.action === "highlight"){
        return createHighlightFromSelection(); // popup receives the result
    }
});

// ----------------------PAGE TEXT INDEX----------------------

// Joins every visible text node into one string and remembers
// where each node starts and ends inside that string.
function buildTextIndex(){

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node){

                const parent = node.parentElement;

                if (!parent || SKIPPED_TAGS.has(parent.tagName)){
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const nodes = [];
    let text = "";
    let node;

    while ((node = walker.nextNode())){

        nodes.push({
            node: node,
            start: text.length,
            end: text.length + node.nodeValue.length
        });

        text += node.nodeValue;
    }

    return { nodes: nodes, text: text };
}

// ----------------------CREATE A HIGHLIGHT----------------------

async function createHighlightFromSelection(){

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed){
        return { ok: false, reason: "Select some text on the page first." };
    }

    const range = selection.getRangeAt(0);
    const index = buildTextIndex();

    // Turn the selection into start/end positions in the page text.
    // Works even when the selection crosses links, bold text or paragraphs.
    let start = -1;
    let end = -1;

    for (const item of index.nodes){

        if (!range.intersectsNode(item.node)){
            continue;
        }

        const localStart =
            item.node === range.startContainer ? range.startOffset : 0;

        const localEnd =
            item.node === range.endContainer ? range.endOffset : item.node.nodeValue.length;

        if (localStart >= localEnd){
            continue;
        }

        if (start === -1){
            start = item.start + localStart;
        }

        end = item.start + localEnd;
    }

    // Drop spaces and line breaks at either edge of the selection
    while (start !== -1 && start < end && /\s/.test(index.text[start])){
        start++;
    }

    while (start !== -1 && end > start && /\s/.test(index.text[end - 1])){
        end--;
    }

    if (start === -1 || start >= end){
        return { ok: false, reason: "That selection can't be highlighted." };
    }

    const highlight = {
        id: createHighlightId(),
        url: normalizeUrl(window.location.href),
        text: index.text.slice(start, end),
        prefix: index.text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
        suffix: index.text.slice(end, end + CONTEXT_LENGTH),
        createdAt: Date.now()
    };

    wrapTextRange(index, start, end, highlight.id);

    selection.removeAllRanges(); //Remove the blue

    try{
        await addHighlight(highlight);
    }catch (error){
        removeHighlightMarks(highlight.id);
        console.log("Highlights: Could not save highlight:", error);
        return { ok: false, reason: "The highlight couldn't be saved." };
    }

    console.log("Highlights: Highlight saved:", highlight.text);

    return { ok: true };
}

// ----------------------DRAW <mark> TAGS----------------------

// Wraps page text between start and end (positions in index.text)
// in <mark> tags, one per text node the range touches.
function wrapTextRange(index, start, end, id){

    const matchingNodes = index.nodes.filter(item =>
        item.end > start &&
        item.start < end
    );

    //Work backwards so changing the DOM does not
    //interfere with the remaining node positions
    matchingNodes.reverse().forEach(item =>{

        const currentNode = item.node;

        const localStart = Math.max(0, start - item.start);
        const localEnd = Math.min(currentNode.nodeValue.length, end - item.start);

        if (localStart >= localEnd){
            return;
        }

        // Skip pure whitespace between elements (for example between list
        // items or table cells), where a <mark> would break the layout
        if (/^\s*$/.test(currentNode.nodeValue.slice(localStart, localEnd))){
            return;
        }

        const range = document.createRange();
        range.setStart(currentNode, localStart);
        range.setEnd(currentNode, localEnd);

        const mark = document.createElement("mark");
        mark.className = MARK_CLASS;
        mark.dataset.highlightId = id;

        try{
            range.surroundContents(mark);
        }catch (error){
            console.log("Highlights: Could not draw part of highlight:", error);
        }
    });
}

function getMarks(id){

    return Array.from(document.querySelectorAll("mark." + MARK_CLASS))
        .filter(mark => mark.dataset.highlightId === id);
}

function isDrawn(id){
    return getMarks(id).length > 0;
}

// ----------------------FIND SAVED TEXT----------------------

// Collapses every run of whitespace to one space and keeps a map
// from each position in the collapsed text back to the original.
function collapseWhitespace(text){

    let collapsed = "";
    const map = [];
    let inSpace = false;

    for (let i = 0; i < text.length; i++){

        if (/\s/.test(text[i])){

            if (!inSpace){
                collapsed += " ";
                map.push(i);
            }

            inSpace = true;

        }else{

            collapsed += text[i];
            map.push(i);
            inSpace = false;
        }
    }

    return { text: collapsed, map: map };
}

// How many characters at the end of a match the end of b
function commonSuffixLength(a, b){

    let length = 0;

    while (
        length < a.length &&
        length < b.length &&
        a[a.length - 1 - length] === b[b.length - 1 - length]
    ){
        length++;
    }

    return length;
}

function commonPrefixLength(a, b){

    let length = 0;

    while (length < a.length && length < b.length && a[length] === b[length]){
        length++;
    }

    return length;
}

// Finds every place `needle` appears in `haystack` and returns the one
// whose surrounding text best matches the saved prefix and suffix.
function bestOccurrence(haystack, needle, prefix, suffix){

    if (!needle){
        return -1;
    }

    let best = -1;
    let bestScore = -1;
    let position = haystack.indexOf(needle);

    while (position !== -1){

        const before = haystack.slice(Math.max(0, position - prefix.length), position);
        const after = haystack.slice(position + needle.length, position + needle.length + suffix.length);

        const score =
            commonSuffixLength(before, prefix) +
            commonPrefixLength(after, suffix);

        if (score > bestScore){
            best = position;
            bestScore = score;
        }

        position = haystack.indexOf(needle, position + 1);
    }

    return best;
}

// Returns {start, end} positions in index.text, or null if not found.
function findHighlight(index, highlight){

    const prefix = highlight.prefix || "";
    const suffix = highlight.suffix || "";

    // 1. Exact text
    const exact = bestOccurrence(index.text, highlight.text, prefix, suffix);

    if (exact !== -1){
        return { start: exact, end: exact + highlight.text.length };
    }

    // 2. Same text, but spaces and line breaks may differ
    //    (common for highlights saved by older versions)
    const page = collapseWhitespace(index.text);
    const needle = collapseWhitespace(highlight.text.trim()).text;

    const loose = bestOccurrence(
        page.text,
        needle,
        collapseWhitespace(prefix).text,
        collapseWhitespace(suffix).text
    );

    if (loose !== -1){
        return {
            start: page.map[loose],
            end: page.map[loose + needle.length - 1] + 1
        };
    }

    return null;
}

// Draws one saved highlight. Returns true if it is now on the page.
function drawHighlight(highlight){

    if (isDrawn(highlight.id)){
        return true;
    }

    const index = buildTextIndex();
    const match = findHighlight(index, highlight);

    if (!match){
        return false;
    }

    wrapTextRange(index, match.start, match.end, highlight.id);

    return isDrawn(highlight.id);
}

// ----------------------REMOVE A HIGHLIGHT----------------------

function removeHighlightMarks(id){

    getMarks(id).forEach((mark) =>{

        const parent = mark.parentNode;

        mark.replaceWith(...mark.childNodes); //Replace the <mark> with its plain text
        parent.normalize(); //Join the split text nodes back together
    });
}

// ----------------------RESTORE ON PAGE LOAD----------------------

let pendingHighlights = []; // saved highlights whose text isn't on the page yet
let retryObserver = null;
let retryTimer = null;

async function restoreHighlights(){

    const highlights = await getHighlightsForUrl(window.location.href);

    pendingHighlights = highlights.filter(highlight => !drawHighlight(highlight));

    if (pendingHighlights.length > 0){
        watchForLateContent();
    }
}

// Some pages add their text after loading (comments, "read more",
// single-page apps). Keep retrying for a while as the page changes.
function watchForLateContent(){

    if (retryObserver){
        return;
    }

    let debounce = null;

    retryObserver = new MutationObserver(() =>{

        clearTimeout(debounce);

        debounce = setTimeout(() =>{

            pendingHighlights = pendingHighlights.filter(
                highlight => !drawHighlight(highlight)
            );

            retryObserver.takeRecords(); // ignore changes made by our own <mark> tags

            if (pendingHighlights.length === 0){
                stopWatching();
            }

        }, 400);
    });

    retryObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    retryTimer = setTimeout(() =>{

        if (pendingHighlights.length > 0){
            console.log(
                "Highlights: Could not find saved text:",
                pendingHighlights.map(highlight => highlight.text)
            );
        }

        stopWatching();

    }, RETRY_DURATION_MS);
}

function stopWatching(){

    if (retryObserver){
        retryObserver.disconnect();
        retryObserver = null;
    }

    clearTimeout(retryTimer);
}

// ----------------------STAY IN SYNC WITH STORAGE----------------------

// Runs whenever highlights change anywhere: deleted from the popup or
// library, or added in another tab showing the same page.
browser.storage.onChanged.addListener((changes, areaName) =>{

    if (areaName !== "local" || !changes[HIGHLIGHTS_KEY]){
        return;
    }

    const pageUrl = normalizeUrl(window.location.href);

    const pageHighlights =
        migrateHighlights(changes[HIGHLIGHTS_KEY].newValue || []).highlights
            .filter(highlight => highlight.url === pageUrl);

    const savedIds = new Set(pageHighlights.map(highlight => highlight.id));

    // Remove marks for deleted highlights
    const drawnIds = new Set(
        Array.from(document.querySelectorAll("mark." + MARK_CLASS))
            .map(mark => mark.dataset.highlightId)
    );

    drawnIds.forEach((id) =>{
        if (!savedIds.has(id)){
            removeHighlightMarks(id);
        }
    });

    pendingHighlights = pendingHighlights.filter(highlight => savedIds.has(highlight.id));

    // Draw highlights added elsewhere
    pageHighlights.forEach((highlight) =>{

        if (!drawHighlight(highlight) &&
            !pendingHighlights.some(pending => pending.id === highlight.id)){

            pendingHighlights.push(highlight);
            watchForLateContent();
        }
    });
});

// --------------RUN ON LOAD PAGE------------------

// Content scripts run once the page has loaded, so no delay is needed.
restoreHighlights();
