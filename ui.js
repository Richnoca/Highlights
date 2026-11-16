// Shared page-building helpers for popup.js and all-highlights.js.
// (Not loaded on webpages.)

const COLOR_NAMES = {
    yellow: "Yellow",
    green: "Green",
    blue: "Blue",
    pink: "Pink"
};

// A row of round color buttons. Calls onPick(color) when one is clicked.
// size is "large" (popup color choice) or "small" (recolor a saved highlight).
function createColorPicker(selectedColor, onPick, size){

    const picker = document.createElement("div");
    picker.className = "color-picker color-picker-" + (size || "small");
    picker.setAttribute("role", "radiogroup");
    picker.setAttribute("aria-label", "Highlight color");

    HIGHLIGHT_COLORS.forEach((color) =>{

        const button = document.createElement("button");
        button.type = "button";
        button.className = "color-swatch";
        button.dataset.color = color;
        button.title = COLOR_NAMES[color];
        button.setAttribute("role", "radio");
        button.setAttribute("aria-label", COLOR_NAMES[color]);
        button.setAttribute("aria-checked", String(color === selectedColor));

        button.addEventListener("click", () =>{

            picker.querySelectorAll(".color-swatch").forEach((swatch) =>{
                swatch.setAttribute("aria-checked", String(swatch === button));
            });

            onPick(color);
        });

        picker.appendChild(button);
    });

    return picker;
}

// The saved title, or the domain if the page had no title
function getDisplayTitle(title, url){
    return title || getDomain(url);
}

// ----------------------NOTES----------------------

// A text box for a highlight's note. Saves by itself while typing
// (after a short pause), when the box loses focus, and when the page
// closes (the popup closes as soon as you click outside it).
function createNoteEditor(highlight){

    const wrapper = document.createElement("div");
    wrapper.className = "note-editor";

    const textarea = document.createElement("textarea");
    textarea.className = "note-input";
    textarea.placeholder = "Add a note…";
    textarea.rows = 1;
    textarea.value = highlight.note;
    textarea.setAttribute("aria-label", "Note");

    const status = document.createElement("span");
    status.className = "note-status";
    status.setAttribute("aria-live", "polite");

    let savedNote = highlight.note;
    let saveTimer = null;

    async function save(){

        clearTimeout(saveTimer);

        const note = textarea.value.trim();

        if (note === savedNote){
            return;
        }

        savedNote = note;
        await updateHighlight(highlight.id, { note: note });

        status.textContent = "Saved";
        setTimeout(() => { status.textContent = ""; }, 1500);
    }

    textarea.addEventListener("input", () =>{
        growToFit(textarea);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(save, 300);
    });

    textarea.addEventListener("blur", save);
    window.addEventListener("pagehide", save);

    wrapper.appendChild(textarea);
    wrapper.appendChild(status);

    // Size it once it is on the page
    requestAnimationFrame(() => growToFit(textarea));

    return wrapper;
}

function growToFit(textarea){
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
}

// ----------------------TAGS----------------------

// Tag chips plus a box for adding more. Type a tag and press Enter
// or a comma. Backspace in the empty box removes the last tag.
// onTagClick(tag) is optional; the library uses it to filter by tag.
function createTagEditor(highlight, onTagClick){

    let tags = [...highlight.tags];

    const wrapper = document.createElement("div");
    wrapper.className = "tag-editor";

    const chips = document.createElement("div");
    chips.className = "tag-chips";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "tag-input";
    input.placeholder = "Add tag";
    input.setAttribute("aria-label", "Add tag");
    input.setAttribute("list", "tag-suggestions");
    input.maxLength = MAX_TAG_LENGTH;

    async function setTags(newTags){
        tags = newTags;
        drawChips();
        await updateHighlight(highlight.id, { tags: tags });
    }

    function drawChips(){

        chips.innerHTML = "";

        tags.forEach((tag) =>{

            const chip = document.createElement("span");
            chip.className = "tag-chip";

            const label = document.createElement(onTagClick ? "button" : "span");
            label.className = "tag-label";
            label.textContent = tag;

            if (onTagClick){
                label.type = "button";
                label.title = "Show all highlights tagged " + tag;
                label.addEventListener("click", () => onTagClick(tag));
            }

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "tag-remove";
            remove.textContent = "×";
            remove.setAttribute("aria-label", "Remove tag " + tag);
            remove.addEventListener("click", () =>{
                setTags(tags.filter(t => t !== tag));
            });

            chip.appendChild(label);
            chip.appendChild(remove);
            chips.appendChild(chip);
        });
    }

    function addTyped(){

        const typed = input.value;
        input.value = "";

        const merged = mergeTags(tags, typed.split(","));

        if (merged.length !== tags.length){
            setTags(merged);
        }
    }

    input.addEventListener("keydown", (event) =>{

        if (event.key === "Enter" || event.key === ","){
            event.preventDefault();
            addTyped();
        }

        if (event.key === "Backspace" && input.value === "" && tags.length > 0){
            setTags(tags.slice(0, -1));
        }
    });

    // Picking a suggestion from the list, or pasting "a, b, c"
    input.addEventListener("change", addTyped);
    input.addEventListener("blur", addTyped);

    drawChips();

    wrapper.appendChild(chips);
    wrapper.appendChild(input);

    return wrapper;
}

// Fills the <datalist> that tag boxes suggest from
function setTagSuggestions(highlights){

    let list = document.getElementById("tag-suggestions");

    if (!list){
        list = document.createElement("datalist");
        list.id = "tag-suggestions";
        document.body.appendChild(list);
    }

    list.innerHTML = "";

    countTags(highlights).forEach(({ tag }) =>{
        const option = document.createElement("option");
        option.value = tag;
        list.appendChild(option);
    });
}

// ----------------------DATES----------------------

// A timestamp -> "Nov 15, 2026". Highlights from before dates
// were saved have 0, which shows as "".
function formatDate(timestamp){

    if (!timestamp){
        return "";
    }

    return new Date(timestamp).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

// ----------------------TOAST MESSAGES----------------------

// A short message at the bottom of the window, optionally with a
// button such as "Undo". Only one shows at a time.
let toastTimer = null;

function showToast(message, options){

    const { actionLabel, onAction, isError, duration } = options || {};

    let toast = document.getElementById("toast");

    if (!toast){
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        document.body.appendChild(toast);
    }

    toast.innerHTML = "";
    toast.classList.toggle("is-error", Boolean(isError));

    const text = document.createElement("span");
    text.className = "toast-text";
    text.textContent = message;
    toast.appendChild(text);

    if (actionLabel){

        const button = document.createElement("button");
        button.type = "button";
        button.className = "toast-action";
        button.textContent = actionLabel;

        button.addEventListener("click", () =>{
            hideToast();
            onAction();
        });

        toast.appendChild(button);
    }

    toast.hidden = false;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, duration || (isError ? 10000 : 6000));
}

function hideToast(){

    clearTimeout(toastTimer);

    const toast = document.getElementById("toast");

    if (toast){
        toast.hidden = true;
    }
}

// Deletes a highlight and offers to undo it
async function deleteWithUndo(highlight, afterUndo){

    const deleted = await deleteHighlightById(highlight.id);

    if (!deleted){
        return;
    }

    showToast("Highlight deleted.", {
        actionLabel: "Undo",
        onAction: async () =>{
            await restoreHighlight(deleted.highlight, deleted.index);

            if (afterUndo){
                afterUndo();
            }
        }
    });
}
