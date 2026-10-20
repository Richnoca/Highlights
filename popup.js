const highlightBtn = document.getElementById("highlightBtn");
const highlightList = document.getElementById("highlightList");
const viewAllBtn = document.getElementById("viewAllBtn");

highlightBtn.addEventListener("click", async () => { //Highlight selected text

    const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true
    });

    const tab = tabs[0];

    await browser.tabs.sendMessage(tab.id, {
        action: "highlight"
    });

    loadHighlights(); //Refresh saved highlight list
});

viewAllBtn.addEventListener("click", () => {

    browser.tabs.create({
        url: browser.runtime.getURL("all-highlights.html")
    });

});

async function loadHighlights(){ //Load highlights for current page

    const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true
    });

    const tab = tabs[0];
    const currentUrl = tab.url;

    const result = await browser.storage.local.get("highlights");

    const highlights = result.highlights || [];

    const pageHighlights = highlights.filter(     //Only show highlights from current page
        highlight => highlight.url === currentUrl
    );

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
            await deleteHighlight(highlight);
        });

        container.appendChild(text);
        container.appendChild(deleteButton);

        highlightList.appendChild(container);
    });
}

async function deleteHighlight(highlightToDelete){ //Delete highlight

    const result = await browser.storage.local.get("highlights");
    let highlights = result.highlights || [];

    highlights = highlights.filter(
        highlight =>
            !(
                highlight.url === highlightToDelete.url &&
                highlight.text === highlightToDelete.text
            )
    );

    await browser.storage.local.set({     //Remove from FF storage
        highlights: highlights
    });

    const tabs = await browser.tabs.query({  //Get the current tab
        active: true,
        currentWindow: true
    });

    const tab = tabs[0];

    await browser.tabs.sendMessage(tab.id,{    //Tell content.js to remove visible highlight
        action: "removeHighlight",
        text: highlightToDelete.text
    });

    loadHighlights();    //Refresh the popup list
}

loadHighlights(); //Load saved highlights when popup opens
