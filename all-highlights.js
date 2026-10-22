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

        const pageSection =
            document.createElement("div");

        pageSection.className = "library-section";


        const pageTitle = //Website heading
            document.createElement("h2");

        pageTitle.textContent = getPageName(url);


        const pageLink = //Link to original page
            document.createElement("a");

        pageLink.href = url;
        pageLink.textContent = url;
        pageLink.target = "_blank";


        pageSection.appendChild(pageTitle);
        pageSection.appendChild(pageLink);


        groupedHighlights[url].forEach( //Display highlights from page
            (highlight) =>{

                const highlightBox =
                    document.createElement("div");

                highlightBox.className =
                    "library-highlight";


                const text =
                    document.createElement("p");

                text.textContent =
                    highlight.text;


                const deleteButton =
                    document.createElement("button");

                deleteButton.textContent =
                    "Delete";


                deleteButton.addEventListener(
                    "click",
                    async () => {

                        await deleteHighlight(
                            highlight
                        );

                    }
                );


                highlightBox.appendChild(text);
                highlightBox.appendChild(
                    deleteButton
                );

                pageSection.appendChild(
                    highlightBox
                );
            }
        );


        allHighlightsContainer.appendChild(
            pageSection
        );
    }
}


function getPageName(url){ //Make the URL easier to read

    try{

        const parsedUrl =
            new URL(url);

        return parsedUrl.hostname;

    }catch{

        return url;

    }
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
