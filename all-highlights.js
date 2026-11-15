// The Highlights Library page.
// Storage helpers come from storage.js; color picker, note and tag
// editors from ui.js.
//
// Three views, kept in the address bar so they can be linked to:
//   all-highlights.html              every highlight, grouped by page
//   all-highlights.html?url=<page>   one page's highlights
//   all-highlights.html?tag=<tag>    highlights with one tag, from any page

const librarySidebar = document.getElementById("librarySidebar");
const libraryMain = document.getElementById("libraryMain");
const librarySummary = document.getElementById("librarySummary");

let view = readViewFromAddress();

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

function showView(newView){

    view = newView;

    const params = new URLSearchParams();

    if (view.type === "page"){
        params.set("url", view.url);
    }

    if (view.type === "tag"){
        params.set("tag", view.tag);
    }

    const query = params.toString();
    history.pushState(null, "", query ? "?" + query : window.location.pathname);

    loadLibrary();
    window.scrollTo(0, 0);
}

// Back and forward buttons
window.addEventListener("popstate", () =>{
    view = readViewFromAddress();
    loadLibrary();
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
    return count + " " + word + (count === 1 ? "" : "s");
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

    if (highlights.length === 0){

        const empty = document.createElement("div");
        empty.className = "empty-state";

        const heading = document.createElement("h2");
        heading.textContent = "No highlights yet";

        const hint = document.createElement("p");
        hint.textContent = "Select text on any webpage, open the Highlights button in the toolbar, and click Highlight Selected Text.";

        empty.appendChild(heading);
        empty.appendChild(hint);
        libraryMain.appendChild(empty);
        return;
    }

    if (view.type === "page"){
        drawPageView(pages.find(page => page.url === view.url));
        return;
    }

    if (view.type === "tag"){

        const tagged = pages
            .map(page => ({
                ...page,
                highlights: page.highlights.filter(h => hasTag(h, view.tag))
            }))
            .filter(page => page.highlights.length > 0);

        const count = tagged.reduce((sum, page) => sum + page.highlights.length, 0);

        libraryMain.appendChild(
            createViewHeader(
                "Tagged “" + view.tag + "”",
                count === 0
                    ? "No highlights have this tag anymore."
                    : plural(count, "highlight") + " from " + plural(tagged.length, "page"),
                true
            )
        );

        tagged.forEach(page => libraryMain.appendChild(createPageSection(page)));
        return;
    }

    libraryMain.appendChild(
        createViewHeader("All highlights", "Newest activity first", false)
    );

    pages.forEach(page => libraryMain.appendChild(createPageSection(page)));
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

// One page's highlights on its own
function drawPageView(page){

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

    detail.appendChild(document.createTextNode(plural(page.highlights.length, "highlight") + " · "));
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

    libraryMain.appendChild(header);

    const list = document.createElement("div");
    list.className = "card-list";

    page.highlights.forEach(highlight => list.appendChild(createHighlightCard(highlight)));

    libraryMain.appendChild(list);
}

// A page heading plus its highlights (used by the "all" and "tag" views)
function createPageSection(page){

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

    page.highlights.forEach(highlight => list.appendChild(createHighlightCard(highlight)));

    section.appendChild(list);

    return section;
}

// ----------------------ONE HIGHLIGHT----------------------

function createHighlightCard(highlight){

    const card = document.createElement("article");
    card.className = "highlight-card";
    card.dataset.color = highlight.color;
    card.dataset.highlightId = highlight.id;

    const quote = document.createElement("blockquote");
    quote.className = "highlight-text";

    const marked = document.createElement("span");
    marked.className = "highlight-text-mark";
    marked.textContent = highlight.text;

    quote.appendChild(marked);
    card.appendChild(quote);

    card.appendChild(createNoteEditor(highlight));

    card.appendChild(
        createTagEditor(highlight, tag => showView({ type: "tag", tag: tag }))
    );

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
