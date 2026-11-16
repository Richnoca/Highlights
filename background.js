// Background script: the keyboard shortcut and the right-click menu.
// Both ask the page's content script (content.js) to highlight the
// current selection, the same way the popup's button does.
// Storage helpers (getSelectedColor, HIGHLIGHT_COLORS) come from storage.js.

const COLOR_LABELS = {
    yellow: "Yellow",
    green: "Green",
    blue: "Blue",
    pink: "Pink"
};

const LIBRARY_MENU_ID = "open-library";

// ----------------------RIGHT-CLICK MENU----------------------

// Firefox remembers menu items, so they are only created when the
// extension is installed or updated. Because there is more than one,
// Firefox groups them under a "Highlights" submenu.
browser.runtime.onInstalled.addListener(async () =>{

    await browser.menus.removeAll();

    HIGHLIGHT_COLORS.forEach((color) =>{

        browser.menus.create({
            id: "highlight-" + color,
            title: "Highlight in " + COLOR_LABELS[color],
            contexts: ["selection"],
            icons: { 16: "icons/dot-" + color + ".svg" }
        });
    });

    browser.menus.create({
        id: "separator",
        type: "separator",
        contexts: ["selection"]
    });

    browser.menus.create({
        id: LIBRARY_MENU_ID,
        title: "Open Highlights Library",
        contexts: ["selection"]
    });
});

browser.menus.onClicked.addListener((info, tab) =>{

    if (info.menuItemId === LIBRARY_MENU_ID){
        browser.tabs.create({ url: browser.runtime.getURL("all-highlights.html") });
        return;
    }

    const color = String(info.menuItemId).replace("highlight-", "");

    if (HIGHLIGHT_COLORS.includes(color)){
        highlightInTab(tab, color);
    }
});

// ----------------------KEYBOARD SHORTCUT----------------------

// Alt+Shift+H by default. People can change it in about:addons →
// gear menu → Manage Extension Shortcuts.
browser.commands.onCommand.addListener(async (command, tab) =>{

    if (command !== "highlight-selection"){
        return;
    }

    if (!tab){
        [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    }

    highlightInTab(tab, await getSelectedColor());
});

// ----------------------HIGHLIGHT----------------------

async function highlightInTab(tab, color){

    if (!tab){
        return;
    }

    try{

        await browser.tabs.sendMessage(
            tab.id,
            { action: "highlight", color: color, showProblems: true },
            { frameId: 0 }
        );

    }catch{

        // No content script on this tab: a Firefox page, or a tab opened
        // before the extension was installed. Flag it on the toolbar button.
        showTabProblem(tab.id, "Highlights can't run on this page. If it was open before Highlights was installed, reload it.");
    }
}

async function showTabProblem(tabId, message){

    try{

        await browser.action.setBadgeBackgroundColor({ color: "#b42318", tabId: tabId });
        await browser.action.setBadgeText({ text: "!", tabId: tabId });
        await browser.action.setTitle({ title: message, tabId: tabId });

        setTimeout(() =>{
            browser.action.setBadgeText({ text: "", tabId: tabId }).catch(() => {});
            browser.action.setTitle({ title: null, tabId: tabId }).catch(() => {});
        }, 5000);

    }catch{
        // The tab was closed
    }
}
