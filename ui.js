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
