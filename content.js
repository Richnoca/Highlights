browser.runtime.onMessage.addListener(async (message) =>{ //Listen for messages from popup.js

    if (message.action === "highlight"){ //Add new highlight

        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0){
            return;
        }

        const selectedText = selection.toString().trim();

        if (selectedText === ""){
            return;
        }

        const range = selection.getRangeAt(0);

        const highlight = document.createElement("mark");
        highlight.className = "Highlights-highlight";

        try{

            range.surroundContents(highlight); //Highlight the selected text

            await saveHighlight(selectedText); //Save in FF storage

            selection.removeAllRanges(); //Remove the blue

            console.log("Highlights: Highlight created.");

        }catch (error){

            console.log(
                "Highlights: Could not highlight selection:",
                error
            );
        }
    }

    if (message.action === "removeHighlight"){ // Remove a highlight

        removeHighlightFromPage(message.text);

    }
});

// ----------------------SAVE HIGHLIGHT----------------

async function saveHighlight(text){

    const url = window.location.href;

    const result = await browser.storage.local.get("highlights");

    const highlights = result.highlights || [];

    highlights.push({
        url: url,
        text: text
    });

    await browser.storage.local.set({
        highlights: highlights
    });

    console.log("Highlights: Highlight saved:", text);
}


// -------------------RESTORE SAVED HIGHLIGHTS----------------------
async function restoreHighlights(){

    const url = window.location.href;

    const result = await browser.storage.local.get("highlights");

    const highlights = result.highlights || [];

    console.log(
        "Highlights: All saved highlights:",
        highlights
    );

    console.log(
        "Highlights: Current URL:",
        url
    );
  
    const pageHighlights = highlights.filter(  //Find highlights belonging to this exact page
        highlight => highlight.url === url
    );

    console.log(
        "Highlights: Highlights for this page:",
        pageHighlights
    );

    for (const highlight of pageHighlights){   //Restore each saved highlight

        highlightText(highlight.text);

    }
}

// ----------FIND SAVED TEXT AND HIGHLIGHT IT---------------

function highlightText(text){

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node){

                const parent = node.parentElement;

                if (!parent){
                    return NodeFilter.FILTER_REJECT;
                }

                //Ignore areas dont want to scan
                if (
                    parent.tagName === "SCRIPT" ||
                    parent.tagName === "STYLE" ||
                    parent.tagName === "NOSCRIPT" ||
                    parent.classList.contains("Highlights-highlight")
                ) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const nodes = [];
    let combinedText = "";
    let node;

    while ((node = walker.nextNode())){     //Build one continuous string from page's text

        nodes.push({
            node: node,
            start: combinedText.length,
            end: combinedText.length + node.nodeValue.length
        });

        combinedText += node.nodeValue;
    }

    const startIndex = combinedText.indexOf(text);

    if (startIndex === -1){
        console.log(
            "Highlights: Could not find saved text:",
            text
        );
        return;
    }

    const endIndex = startIndex + text.length;

    const matchingNodes = nodes.filter(item =>    //Find all text nodes that contain part of the saved selection
        item.end > startIndex &&
        item.start < endIndex
    );

    //Work backwards so changing the DOM does not
    //interfere with the remaining node positions
    matchingNodes.reverse().forEach(item =>{

        const currentNode = item.node;

        const localStart = Math.max(
            0,
            startIndex - item.start
        );

        const localEnd = Math.min(
            currentNode.nodeValue.length,
            endIndex - item.start
        );

        if (localStart >= localEnd){
            return;
        }

        const range = document.createRange();

        range.setStart(
            currentNode,
            localStart
        );

        range.setEnd(
            currentNode,
            localEnd
        );

        const mark = document.createElement("mark");
        mark.className = "Highlights-highlight";

        try{

            range.surroundContents(mark);

        } catch (error){

            console.log(
                "Highlights: Could not restore part of highlight:",
                error
            );
        }
    });
}

// ----------------REMOVE HIGHLIGHT---------------------

function removeHighlightFromPage(text){

    const highlights =
        document.querySelectorAll(
            "mark.Highlights-highlight"
        );

    highlights.forEach((highlight) =>{

        if (highlight.textContent === text){

            const parent = highlight.parentNode;

            parent.replaceChild( //Replace the yellow <mark> with normal text
                document.createTextNode(
                    highlight.textContent
                ),
                highlight
            );

            parent.normalize();  // Clean uptext nodes

            console.log(
                "Highlights: Removed highlight:",
                text
            );
        }
    });
}

// --------------RUN ON LOAD PAGE------------------

setTimeout(() =>{ //Give the webpage a moment to finish loading

    console.log(
        "Highlights: Attempting to restore highlights..."
    );

    restoreHighlights();

}, 500);
