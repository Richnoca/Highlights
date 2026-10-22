// Storage helpers (getHighlightsForUrl, deleteHighlightById) come from storage.js.

const highlightBtn = document.getElementById("highlightBtn");
const highlightList = document.getElementById("highlightList");
const viewAllBtn = document.getElementById("viewAllBtn");
const statusMessage = document.getElementById("statusMessage");

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

highlightBtn.addEventListener("click", async () => { //Highlight selected text

    showStatus("");

    const tab = await getCurrentTab();

    let result;

    try{

        result = await browser.tabs.sendMessage(tab.id, {
            action: "highlight"
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

async function loadHighlights(){ //Load highlights for current page

    const tab = await getCurrentTab();

    const pageHighlights = await getHighlightsForUrl(tab.url);

    highlightList.innerHTML = "";

    if (pageHighlights.length === 0){
        highlightList.textContent = "No saved highlights.";
        return;
    }

    pageHighlights.forEach((highlight) =>{

        const container = document.createElement("div");
        container.className = "saved-highlight";

        const text = document.createElement("p");
        text.textContent = highlight.text;

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", async () =>{

            // content.js notices the storage change and removes the mark itself
            await deleteHighlightById(highlight.id);

            loadHighlights(); //Refresh the popup list
        });

        container.appendChild(text);
        container.appendChild(deleteButton);

        highlightList.appendChild(container);
    });
}

loadHighlights(); //Load saved highlights when popup opens
