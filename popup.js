// Storage helpers come from storage.js, createColorPicker from ui.js.

const highlightBtn = document.getElementById("highlightBtn");
const highlightList = document.getElementById("highlightList");
const viewAllBtn = document.getElementById("viewAllBtn");
const statusMessage = document.getElementById("statusMessage");
const colorChoice = document.getElementById("colorChoice");
const pageTitle = document.getElementById("pageTitle");

let selectedColor = DEFAULT_COLOR;

async function getCurrentTab(){

    const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true
    });

    return tabs[0];
}

function showStatus(text){

    statusMessage.textContent = text;
    statusMessage.hidden = !text;
}

// ----------------------COLOR CHOICE----------------------

async function setUpColorChoice(){

    selectedColor = await getSelectedColor();

    colorChoice.appendChild(
        createColorPicker(selectedColor, (color) =>{
            selectedColor = color;
            setSelectedColor(color); // remember it for next time
        }, "large")
    );
}

// ----------------------BUTTONS----------------------

highlightBtn.addEventListener("click", async () => { //Highlight selected text

    showStatus("");

    const tab = await getCurrentTab();

    let result;

    try{

        result = await browser.tabs.sendMessage(tab.id, {
            action: "highlight",
            color: selectedColor
        });

    }catch{

        // No content script here: a browser page like about:addons,
        // addons.mozilla.org, or a tab opened before the extension loaded
        showStatus("Highlights can't run on this page. If it was open before the extension loaded, reload the page and try again.");
        return;
    }

    if (result && !result.ok){
        showStatus(result.reason);
    }

    loadHighlights(); //Refresh saved highlight list
});

viewAllBtn.addEventListener("click", () => {

    browser.tabs.create({
        url: browser.runtime.getURL("all-highlights.html")
    });

});

// ----------------------SAVED HIGHLIGHTS FOR THIS PAGE----------------------

async function loadHighlights(){ //Load highlights for current page

    const tab = await getCurrentTab();

    const pageHighlights = await getHighlightsForUrl(tab.url);

    highlightList.innerHTML = "";

    if (pageHighlights.length === 0){
        pageTitle.hidden = true;
        highlightList.textContent = "No saved highlights.";
        return;
    }

    pageTitle.textContent = getDisplayTitle(
        pageHighlights.find(h => h.title)?.title || tab.title,
        tab.url
    );
    pageTitle.hidden = false;

    pageHighlights.forEach((highlight) =>{

        const container = document.createElement("div");
        container.className = "saved-highlight";
        container.dataset.color = highlight.color;

        const text = document.createElement("p");
        text.textContent = highlight.text;

        const actions = document.createElement("div");
        actions.className = "highlight-actions";

        // Recolor this highlight; open tabs update through storage.onChanged
        const picker = createColorPicker(highlight.color, async (color) =>{
            await updateHighlight(highlight.id, { color: color });
            loadHighlights();
        }, "small");

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-button";

        deleteButton.addEventListener("click", async () =>{

            // content.js notices the storage change and removes the mark itself
            await deleteHighlightById(highlight.id);

            loadHighlights(); //Refresh the popup list
        });

        actions.appendChild(picker);
        actions.appendChild(deleteButton);

        container.appendChild(text);
        container.appendChild(actions);

        highlightList.appendChild(container);
    });
}

setUpColorChoice();
loadHighlights(); //Load saved highlights when popup opens
