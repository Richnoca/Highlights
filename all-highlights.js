// The Highlights Library page.
// Storage helpers come from storage.js; color picker, note and tag
// editors from ui.js.
//
// Three views, kept in the address bar so they can be linked to:
//   all-highlights.html              every highlight, grouped by page
//   all-highlights.html?url=<page>   one page's highlights
//   all-highlights.html?tag=<tag>    highlights with one tag, from any page
// A search can be added to any of them with &q=<words>.
//
// Search, export and import helpers come from library-tools.js.

const librarySidebar = document.getElementById("librarySidebar");
const libraryMain = document.getElementById("libraryMain");
const librarySummary = document.getElementById("librarySummary");
const libraryStatus = document.getElementById("libraryStatus");
const searchInput = document.getElementById("searchInput");
const exportBtn = document.getElementById("exportBtn");
const exportPanel = document.getElementById("exportPanel");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");

let view = readViewFromAddress();
let searchQuery = readSearchFromAddress();

// What the Export menu offers, updated every time the library is drawn
let exportChoices = { view: null, all: [] };

searchInput.value = searchQuery;

// ----------------------VIEW STATE----------------------

function readViewFromAddress(){

    const params = new URLSearchParams(window.location.search);

    if (params.get("url")){
        return { type: "page", url: normalizeUrl(params.get("url")) };
    }

    if (params.get("tag")){
        return { type: "tag", tag: params.get("tag") };
    }

    return { type: "all" };
}

function readSearchFromAddress(){
    return new URLSearchParams(window.location.search).get("q") || "";
}

// The address for the current view and search
function addressForState(){

    const params = new URLSearchParams();

    if (view.type === "page"){
        params.set("url", view.url);
    }

    if (view.type === "tag"){
        params.set("tag", view.tag);
    }

    if (searchQuery.trim()){
        params.set("q", searchQuery.trim());
    }

    const query = params.toString();

    return query ? "?" + query : window.location.pathname;
}

// Switching view keeps the current search
function showView(newView){

    view = newView;

    history.pushState(null, "", addressForState());

    loadLibrary();
    window.scrollTo(0, 0);
}

// Back and forward buttons
window.addEventListener("popstate", () =>{
    view = readViewFromAddress();
    searchQuery = readSearchFromAddress();
    searchInput.value = searchQuery;
    loadLibrary();
});

// ----------------------SEARCH BOX----------------------

let searchTimer = null;

searchInput.addEventListener("input", () =>{

    clearTimeout(searchTimer);

    searchTimer = setTimeout(() =>{
        searchQuery = searchInput.value;
        history.replaceState(null, "", addressForState()); // typing shouldn't fill up Back
        loadLibrary();
    }, 150);
});

searchInput.addEventListener("keydown", (event) =>{

    if (event.key === "Escape" && searchInput.value){
        event.preventDefault();
        clearSearch();
    }
});

function clearSearch(){

    clearTimeout(searchTimer);
    searchInput.value = "";
    searchQuery = "";
    history.replaceState(null, "", addressForState());
    loadLibrary();
}

// Press / anywhere to jump to the search box
document.addEventListener("keydown", (event) =>{

    const target = event.target;
    const typingSomewhere =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

    if (event.key === "/" && !typingSomewhere && !event.ctrlKey && !event.metaKey && !event.altKey){
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
    }
});

// ----------------------GROUPING----------------------

// [{url, title, highlights, lastActivity}], most recently active page first
function groupByPage(highlights){

    const pages = {};

    highlights.forEach((highlight) =>{

        if (!pages[highlight.url]){
            pages[highlight.url] = { url: highlight.url, highlights: [] };
        }

        pages[highlight.url].highlights.push(highlight);
    });

    return Object.values(pages)
        .map(page => ({
            ...page,
            title: getLatestTitle(page.highlights),
            lastActivity: Math.max(
                ...page.highlights.map(h => h.updatedAt || h.createdAt || 0)
            )
        }))
        .sort((a, b) => b.lastActivity - a.lastActivity);
}

// Most recent non-empty title among a page's highlights
// (pages sometimes change their title over time)
function getLatestTitle(pageHighlights){

    const withTitle = pageHighlights
        .filter(highlight => highlight.title)
        .sort((a, b) => b.createdAt - a.createdAt);

    return withTitle.length > 0 ? withTitle[0].title : "";
}

function plural(count, word){

    if (count === 1){
        return count + " " + word;
    }

    if (/[^aeiou]y$/.test(word)){
        return count + " " + word.slice(0, -1) + "ies"; // entry -> entries
    }

    return count + " " + word + (/(ch|sh|s|x)$/.test(word) ? "es" : "s");
}

// ----------------------DRAW THE PAGE----------------------

async function loadLibrary(){

    const highlights = await getAllHighlights(); //From storage.js
    const pages = groupByPage(highlights);
    const tags = countTags(highlights);

    // A page or tag that no longer exists (all its highlights deleted)
    if (view.type === "page" && !pages.some(page => page.url === view.url)){
        view = { type: "all" };
        history.replaceState(null, "", window.location.pathname);
    }

    librarySummary.textContent = highlights.length === 0
        ? ""
        : plural(highlights.length, "highlight") + " · " + plural(pages.length, "page");

    setTagSuggestions(highlights);
    drawSidebar(highlights, pages, tags);
    drawMain(highlights, pages);
}

// ----------------------SIDEBAR----------------------

function drawSidebar(highlights, pages, tags){

    librarySidebar.innerHTML = "";

    if (highlights.length === 0){
        return;
    }

    const allButton = createSidebarButton(
        "All highlights",
        String(highlights.length),
        view.type === "all",
        () => showView({ type: "all" })
    );

    librarySidebar.appendChild(allButton);


    // Pages
    const pagesHeading = document.createElement("h2");
    pagesHeading.className = "sidebar-heading";
    pagesHeading.textContent = "Pages";
    librarySidebar.appendChild(pagesHeading);

    const pageList = document.createElement("ul");
    pageList.className = "sidebar-list";

    pages.forEach((page) =>{

        const item = document.createElement("li");

        const details = [getDomain(page.url)];

        if (page.lastActivity){
            details.push(formatDate(page.lastActivity));
        }

        item.appendChild(
            createSidebarButton(
                getDisplayTitle(page.title, page.url),
                String(page.highlights.length),
                view.type === "page" && view.url === page.url,
                () => showView({ type: "page", url: page.url }),
                details.join(" · ")
            )
        );

        pageList.appendChild(item);
    });

    librarySidebar.appendChild(pageList);


    // Tags
    const tagsHeading = document.createElement("h2");
    tagsHeading.className = "sidebar-heading";
    tagsHeading.textContent = "Tags";
    librarySidebar.appendChild(tagsHeading);

    if (tags.length === 0){

        const hint = document.createElement("p");
        hint.className = "sidebar-hint";
        hint.textContent = "No tags yet. Add tags like \"exam\" or \"research\" to a highlight to group them here.";
        librarySidebar.appendChild(hint);
        return;
    }

    const tagList = document.createElement("div");
    tagList.className = "sidebar-tags";

    tags.forEach(({ tag, count }) =>{

        const button = document.createElement("button");
        button.type = "button";
        button.className = "sidebar-tag";
        button.setAttribute(
            "aria-pressed",
            String(view.type === "tag" && view.tag.toLowerCase() === tag.toLowerCase())
        );

        const name = document.createElement("span");
        name.textContent = tag;

        const number = document.createElement("span");
        number.className = "sidebar-tag-count";
        number.textContent = count;

        button.appendChild(name);
        button.appendChild(number);
        button.addEventListener("click", () => showView({ type: "tag", tag: tag }));

        tagList.appendChild(button);
    });

    librarySidebar.appendChild(tagList);
}

function createSidebarButton(label, count, isCurrent, onClick, details){

    const button = document.createElement("button");
    button.type = "button";
    button.className = "sidebar-item";

    if (isCurrent){
        button.setAttribute("aria-current", "page");
    }

    const text = document.createElement("span");
    text.className = "sidebar-item-text";

    const title = document.createElement("span");
    title.className = "sidebar-item-title";
    title.textContent = label;
    text.appendChild(title);

    if (details){
        const sub = document.createElement("span");
        sub.className = "sidebar-item-details";
        sub.textContent = details;
        text.appendChild(sub);
    }

    const number = document.createElement("span");
    number.className = "sidebar-item-count";
    number.textContent = count;

    button.appendChild(text);
    button.appendChild(number);
    button.addEventListener("click", onClick);

    return button;
}

// ----------------------MAIN AREA----------------------

function drawMain(highlights, pages){

    libraryMain.innerHTML = "";

    exportChoices = {
        view: null,
        all: pages.flatMap(page => page.highlights)
    };

    if (highlights.length === 0){

        const empty = document.createElement("div");
        empty.className = "empty-state";

        const heading = document.createElement("h2");
        heading.textContent = "No highlights yet";

        const hint = document.createElement("p");
        hint.textContent = "Select text on any webpage, open the Highlights button in the toolbar, and click Highlight Selected Text. Or use Import to load a backup.";

        empty.appendChild(heading);
        empty.appendChild(hint);
        libraryMain.appendChild(empty);
        return;
    }

    const terms = getSearchTerms(searchQuery);
    const searching = terms.length > 0;

    // 1. The pages in this view
    let viewPages = pages;
    let title = "All highlights";

    if (view.type === "page"){
        viewPages = pages.filter(page => page.url === view.url);
        title = getDisplayTitle(viewPages[0].title, view.url);
    }

    if (view.type === "tag"){

        viewPages = pages
            .map(page => ({
                ...page,
                highlights: page.highlights.filter(h => hasTag(h, view.tag))
            }))
            .filter(page => page.highlights.length > 0);

        title = "Tagged \u201c" + view.tag + "\u201d";
    }

    const viewCount = countHighlights(viewPages);

    // 2. Narrowed down by the search
    const shownPages = !searching ? viewPages : viewPages
        .map(page => ({
            ...page,
            highlights: page.highlights.filter(h => matchesSearch(h, terms))
        }))
        .filter(page => page.highlights.length > 0);

    const shownCount = countHighlights(shownPages);

    // The Export menu's "This view" choice, unless it would be everything
    if (view.type !== "all" || searching){
        exportChoices.view = {
            label: searching ? title + " \u00b7 \u201c" + searchQuery.trim() + "\u201d" : title,
            highlights: shownPages.flatMap(page => page.highlights)
        };
    }

    // 3. Header
    if (view.type === "page"){
        libraryMain.appendChild(createPageHeader(viewPages[0], shownCount, searching));
    }else{

        let detail;

        if (searching){
            detail = plural(shownCount, "match") + " for \u201c" + searchQuery.trim() + "\u201d" +
                (shownCount > 0 ? " on " + plural(shownPages.length, "page") : "");
        }else if (view.type === "tag"){
            detail = viewCount === 0
                ? "No highlights have this tag anymore."
                : plural(viewCount, "highlight") + " from " + plural(viewPages.length, "page");
        }else{
            detail = "Newest activity first";
        }

        libraryMain.appendChild(createViewHeader(title, detail, view.type === "tag"));
    }

    // 4. Highlights
    if (searching && shownCount === 0){
        libraryMain.appendChild(createNoMatches(view.type !== "all"));
        return;
    }

    if (view.type === "page"){

        const list = document.createElement("div");
        list.className = "card-list";

        shownPages[0].highlights.forEach(h => list.appendChild(createHighlightCard(h, terms)));

        libraryMain.appendChild(list);
        return;
    }

    shownPages.forEach(page => libraryMain.appendChild(createPageSection(page, terms)));
}

function countHighlights(pages){
    return pages.reduce((sum, page) => sum + page.highlights.length, 0);
}

function createNoMatches(canSearchEverything){

    const box = document.createElement("div");
    box.className = "empty-state";

    const text = document.createElement("p");
    text.textContent = canSearchEverything
        ? "Nothing in this view matches your search."
        : "No highlights match your search.";

    box.appendChild(text);

    const actions = document.createElement("div");
    actions.className = "empty-state-actions";

    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "secondary-button";
    clear.textContent = "Clear search";
    clear.addEventListener("click", clearSearch);
    actions.appendChild(clear);

    if (canSearchEverything){

        const everywhere = document.createElement("button");
        everywhere.type = "button";
        everywhere.className = "secondary-button";
        everywhere.textContent = "Search all highlights";
        everywhere.addEventListener("click", () => showView({ type: "all" }));
        actions.appendChild(everywhere);
    }

    box.appendChild(actions);

    return box;
}

function createViewHeader(titleText, detailText, showClear){

    const header = document.createElement("div");
    header.className = "view-header";

    const text = document.createElement("div");

    const title = document.createElement("h2");
    title.textContent = titleText;

    const detail = document.createElement("p");
    detail.className = "view-detail";
    detail.textContent = detailText;

    text.appendChild(title);
    text.appendChild(detail);
    header.appendChild(text);

    if (showClear){

        const clear = document.createElement("button");
        clear.type = "button";
        clear.className = "secondary-button";
        clear.textContent = "Show all highlights";
        clear.addEventListener("click", () => showView({ type: "all" }));

        header.appendChild(clear);
    }

    return header;
}

// Header for one page's view: title, address and an Open page button
function createPageHeader(page, shownCount, searching){

    const header = document.createElement("div");
    header.className = "view-header";

    const text = document.createElement("div");

    const title = document.createElement("h2");
    title.textContent = getDisplayTitle(page.title, page.url);

    const detail = document.createElement("p");
    detail.className = "view-detail";

    const link = document.createElement("a");
    link.href = page.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = page.url;

    const count = searching
        ? shownCount + " of " + plural(page.highlights.length, "highlight") + " match"
        : plural(page.highlights.length, "highlight");

    detail.appendChild(document.createTextNode(count + " \u00b7 "));
    detail.appendChild(link);

    text.appendChild(title);
    text.appendChild(detail);

    const open = document.createElement("a");
    open.className = "secondary-button";
    open.href = page.url;
    open.target = "_blank";
    open.rel = "noopener";
    open.textContent = "Open page";

    header.appendChild(text);
    header.appendChild(open);

    return header;
}

// A page heading plus its highlights (used by the "all" and "tag" views)
function createPageSection(page, terms){

    const section = document.createElement("section");
    section.className = "page-section";

    const header = document.createElement("div");
    header.className = "page-section-header";

    const titleButton = document.createElement("button");
    titleButton.type = "button";
    titleButton.className = "page-section-title";
    titleButton.textContent = getDisplayTitle(page.title, page.url);
    titleButton.title = "Show only this page";
    titleButton.addEventListener("click", () => showView({ type: "page", url: page.url }));

    const domain = document.createElement("a");
    domain.className = "page-section-domain";
    domain.href = page.url;
    domain.target = "_blank";
    domain.rel = "noopener";
    // The heading already shows the domain when the page has no title
    domain.textContent = page.title ? getDomain(page.url) : "Open page";

    header.appendChild(titleButton);
    header.appendChild(domain);
    section.appendChild(header);

    const list = document.createElement("div");
    list.className = "card-list";

    page.highlights.forEach(highlight => list.appendChild(createHighlightCard(highlight, terms)));

    section.appendChild(list);

    return section;
}

// ----------------------ONE HIGHLIGHT----------------------

function createHighlightCard(highlight, terms){

    const card = document.createElement("article");
    card.className = "highlight-card";
    card.dataset.color = highlight.color;
    card.dataset.highlightId = highlight.id;

    const quote = document.createElement("blockquote");
    quote.className = "highlight-text";

    const marked = document.createElement("span");
    marked.className = "highlight-text-mark";
    // Show search matches inside the highlighted text
    splitBySearchTerms(highlight.text, terms).forEach((piece) =>{

        if (piece.hit){
            const hit = document.createElement("mark");
            hit.className = "search-hit";
            hit.textContent = piece.text;
            marked.appendChild(hit);
        }else{
            marked.appendChild(document.createTextNode(piece.text));
        }
    });

    quote.appendChild(marked);
    card.appendChild(quote);

    const noteEditor = createNoteEditor(highlight);

    // A textarea can't highlight words, so outline a matching note instead
    if (terms.length > 0 && textMatches(highlight.note, terms)){
        noteEditor.classList.add("search-match");
    }

    card.appendChild(noteEditor);

    const tagEditor = createTagEditor(highlight, tag => showView({ type: "tag", tag: tag }));

    if (terms.length > 0){
        tagEditor.querySelectorAll(".tag-chip").forEach((chip) =>{
            if (textMatches(chip.querySelector(".tag-label").textContent, terms)){
                chip.classList.add("search-match");
            }
        });
    }

    card.appendChild(tagEditor);

    const footer = document.createElement("div");
    footer.className = "card-footer";

    footer.appendChild(
        createColorPicker(highlight.color, async (color) =>{
            await updateHighlight(highlight.id, { color: color });
        }, "small")
    );

    const date = document.createElement("span");
    date.className = "card-date";
    date.textContent = formatDate(highlight.createdAt);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete";

    // Open tabs showing this page remove the mark themselves (content.js),
    // and the storage listener below redraws the library
    deleteButton.addEventListener("click", () => deleteHighlightById(highlight.id));

    const right = document.createElement("div");
    right.className = "card-footer-right";
    right.appendChild(date);
    right.appendChild(deleteButton);

    footer.appendChild(right);
    card.appendChild(footer);

    return card;
}

// ----------------------EXPORT MENU----------------------

const EXPORT_FORMATS = [
    { label: "Markdown", extension: "md", mimeType: "text/markdown",
      build: (highlights, heading) => exportAsMarkdown(highlights, heading) },
    { label: "CSV", extension: "csv", mimeType: "text/csv",
      build: highlights => exportAsCsv(highlights) },
    { label: "JSON backup", extension: "json", mimeType: "application/json",
      build: highlights => exportAsJson(highlights) }
];

function openExportMenu(){

    exportPanel.innerHTML = "";

    if (exportChoices.all.length === 0){

        const empty = document.createElement("p");
        empty.className = "export-empty";
        empty.textContent = "There's nothing to export yet.";
        exportPanel.appendChild(empty);

    }else{

        if (exportChoices.view){

            exportPanel.appendChild(
                createExportGroup(
                    "This view",
                    exportChoices.view.label,
                    exportChoices.view.highlights,
                    exportChoices.view.label
                )
            );
        }

        exportPanel.appendChild(
            createExportGroup(
                exportChoices.view ? "Export all" : "All highlights",
                "Everything in your library",
                exportChoices.all,
                null
            )
        );
    }

    exportPanel.hidden = false;
    exportBtn.setAttribute("aria-expanded", "true");

    const first = exportPanel.querySelector("button");

    if (first){
        first.focus();
    }
}

function closeExportMenu(returnFocus){

    if (exportPanel.hidden){
        return;
    }

    exportPanel.hidden = true;
    exportBtn.setAttribute("aria-expanded", "false");

    if (returnFocus){
        exportBtn.focus();
    }
}

// A heading ("This view · 3 highlights") and one button per format.
// viewLabel names the file and Markdown title; null means everything.
function createExportGroup(heading, scope, highlights, viewLabel){

    const group = document.createElement("div");
    group.className = "export-group";

    const title = document.createElement("p");
    title.className = "export-group-title";
    title.textContent = heading + " \u00b7 " + plural(highlights.length, "highlight");

    const detail = document.createElement("p");
    detail.className = "export-group-detail";
    detail.textContent = scope;

    const buttons = document.createElement("div");
    buttons.className = "export-buttons";

    EXPORT_FORMATS.forEach((format) =>{

        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary-button";
        button.textContent = format.label;
        button.disabled = highlights.length === 0;

        button.addEventListener("click", () =>{

            const heading = viewLabel ? "Highlights: " + viewLabel : "Highlights";

            downloadText(
                format.build(highlights, heading),
                exportFilename(viewLabel || "all", format.extension),
                format.mimeType
            );

            closeExportMenu(true);
            showStatus("Exported " + plural(highlights.length, "highlight") + " as " + format.label + ".");
        });

        buttons.appendChild(button);
    });

    group.appendChild(title);
    group.appendChild(detail);
    group.appendChild(buttons);

    return group;
}

exportBtn.addEventListener("click", () =>{

    if (exportPanel.hidden){
        openExportMenu();
    }else{
        closeExportMenu(false);
    }
});

// Close the menu when clicking elsewhere or pressing Escape
document.addEventListener("click", (event) =>{

    if (!exportPanel.hidden && !event.target.closest(".export-menu")){
        closeExportMenu(false);
    }
});

document.addEventListener("keydown", (event) =>{

    if (event.key === "Escape" && !exportPanel.hidden){
        closeExportMenu(true);
    }
});

// ----------------------IMPORT----------------------

importBtn.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async () =>{

    const file = importFile.files[0];
    importFile.value = ""; // so choosing the same file again still works

    if (!file){
        return;
    }

    try{

        const { highlights, rejected } = parseBackup(await file.text());

        if (highlights.length === 0){
            showStatus("That backup doesn't contain any highlights.", true);
            return;
        }

        const { added, skipped } = await importHighlights(highlights);

        const parts = [
            added === 0
                ? "No new highlights to import."
                : "Imported " + plural(added, "highlight") + "."
        ];

        if (skipped > 0){
            parts.push(
                skipped === 1
                    ? "1 was already in your library."
                    : skipped + " were already in your library."
            );
        }

        if (rejected > 0){
            parts.push(plural(rejected, "entry") + " couldn't be read and " + (rejected === 1 ? "was" : "were") + " skipped.");
        }

        showStatus(parts.join(" "));

    }catch (error){
        showStatus(error.message, true);
    }
});

// ----------------------STATUS MESSAGE----------------------

let statusTimer = null;

function showStatus(message, isError){

    clearTimeout(statusTimer);

    libraryStatus.textContent = message;
    libraryStatus.classList.toggle("is-error", Boolean(isError));
    libraryStatus.hidden = false;

    statusTimer = setTimeout(() =>{ libraryStatus.hidden = true; }, isError ? 10000 : 6000);
}

// ----------------------STAY UP TO DATE----------------------

// Redrawing the highlight cards while someone is typing a note or tag
// would throw away their cursor, so only the sidebar updates then, and
// the cards are redrawn once they leave the box. The redraw also waits
// for a mouse click to finish, so clicking a button right after typing
// isn't lost when the button is replaced.
let redrawWaiting = false;
let pointerIsDown = false;

function isTyping(){

    const active = document.activeElement;

    return active &&
        libraryMain.contains(active) &&
        (active.tagName === "TEXTAREA" || active.tagName === "INPUT");
}

function redrawIfReady(){

    setTimeout(() =>{

        if (redrawWaiting && !isTyping() && !pointerIsDown){
            redrawWaiting = false;
            loadLibrary();
        }

    }, 0);
}

browser.storage.onChanged.addListener(async (changes, areaName) =>{

    if (areaName !== "local" || !changes[HIGHLIGHTS_KEY]){
        return;
    }

    if (isTyping() || pointerIsDown){

        redrawWaiting = true;

        const highlights = await getAllHighlights();
        const pages = groupByPage(highlights);

        librarySummary.textContent =
            plural(highlights.length, "highlight") + " · " + plural(pages.length, "page");

        setTagSuggestions(highlights);
        drawSidebar(highlights, pages, countTags(highlights));

        redrawIfReady();
        return;
    }

    loadLibrary();
});

document.addEventListener("focusout", redrawIfReady);

document.addEventListener("pointerdown", () =>{ pointerIsDown = true; }, true);

function pointerReleased(){
    pointerIsDown = false;
    redrawIfReady(); // runs after the click event
}

document.addEventListener("pointerup", pointerReleased, true);
document.addEventListener("pointercancel", pointerReleased, true);
window.addEventListener("blur", pointerReleased);

loadLibrary(); //Load everything when the page opens
