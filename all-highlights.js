// Storage helpers come from storage.js, createColorPicker from ui.js.

const allHighlightsContainer =
    document.getElementById("allHighlights");

async function loadAllHighlights(){ //Load all saved highlights

    const highlights =
        await getAllHighlights(); //From storage.js

    allHighlightsContainer.innerHTML = "";


    if (highlights.length === 0){     //No highlights saved

        allHighlightsContainer.textContent =
            "No highlights have been saved yet.";

        return;
    }


    const groupedHighlights = {}; //Group highlights by URL

    highlights.forEach((highlight) =>{

        if (!groupedHighlights[highlight.url]){

            groupedHighlights[highlight.url] = [];

        }

        groupedHighlights[highlight.url].push(
            highlight
        );
    });


    for (const url in groupedHighlights){ //Display each webpage

        const pageHighlights =
            groupedHighlights[url];

        const pageSection =
            document.createElement("div");

        pageSection.className = "library-section";


        const pageTitle = //Page title, or the domain if there is none
            document.createElement("h2");

        pageTitle.textContent = getDisplayTitle(
            getLatestTitle(pageHighlights),
            url
        );


        const pageInfo = //Domain and link to original page
            document.createElement("p");

        pageInfo.className = "page-info";

        const domain =
            document.createElement("span");

        domain.className = "page-domain";
        domain.textContent = getDomain(url);

        const pageLink =
            document.createElement("a");

        pageLink.href = url;
        pageLink.textContent = url;
        pageLink.target = "_blank";

        if (getLatestTitle(pageHighlights)){ //Heading is already the domain otherwise
            pageInfo.appendChild(domain);
        }

        pageInfo.appendChild(pageLink);


        pageSection.appendChild(pageTitle);
        pageSection.appendChild(pageInfo);


        pageHighlights.forEach( //Display highlights from page
            (highlight) =>{

                pageSection.appendChild(
                    createHighlightBox(highlight)
                );
            }
        );


        allHighlightsContainer.appendChild(
            pageSection
        );
    }
}


function createHighlightBox(highlight){ //One saved highlight

    const highlightBox =
        document.createElement("div");

    highlightBox.className =
        "library-highlight";

    highlightBox.dataset.color =
        highlight.color;


    const text =
        document.createElement("p");

    text.textContent =
        highlight.text;


    const actions =
        document.createElement("div");

    actions.className =
        "highlight-actions";


    const picker = createColorPicker( //Change this highlight's color
        highlight.color,
        async (color) =>{

            await updateHighlight(
                highlight.id,
                { color: color }
            );
        },
        "small"
    );


    const deleteButton =
        document.createElement("button");

    deleteButton.textContent =
        "Delete";

    deleteButton.className =
        "delete-button";


    deleteButton.addEventListener(
        "click",
        async () => {

            await deleteHighlight(
                highlight
            );

        }
    );


    actions.appendChild(picker);
    actions.appendChild(deleteButton);

    highlightBox.appendChild(text);
    highlightBox.appendChild(actions);

    return highlightBox;
}


// Most recent non-empty title among a page's highlights
// (pages sometimes change their title over time)
function getLatestTitle(pageHighlights){

    const withTitle = pageHighlights
        .filter(highlight => highlight.title)
        .sort((a, b) => b.createdAt - a.createdAt);

    return withTitle.length > 0 ? withTitle[0].title : "";
}


async function deleteHighlight( //Delete a highlight from storage
    highlightToDelete
){

    // Open tabs showing this page remove the mark themselves (content.js),
    // and the storage listener below reloads the library
    await deleteHighlightById(
        highlightToDelete.id
    );
}

loadAllHighlights(); //Load everything when the page opens

// Automatically refresh the library
// whenever saved highlights change
browser.storage.onChanged.addListener((changes, areaName) =>{

    if (
        areaName === "local" &&
        changes.highlights
    ) {
        loadAllHighlights();
    }

});
