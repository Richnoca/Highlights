# Highlights

Highlights is a Firefox extension for highlighting text on any webpage. Highlights are saved on your computer and come back automatically when you return to the page. You can color-code them, add notes and tags, browse everything in one library, search it, and export it.

## Features

**On webpages**
- Highlight selected text in yellow, green, blue or pink
- Highlights reappear automatically when you revisit the page, including on complex pages like Wikipedia
- Selections can cross links, bold text, paragraphs and list items
- Hover over a highlight to see its note
- Highlights also restore on pages that load their text after opening

**In the popup**
- Pick a color (it's remembered) and highlight the selected text
- See this page's highlights, and add notes, tags and colors, or delete them
- Jump straight to this page in the library

**In the Highlights Library**
- A sidebar listing every page (by title) and every tag, with counts
- View all highlights, one page, or every highlight with a tag
- Edit notes, tags and colors, or delete highlights
- Search by highlighted text, page title, website, note or tag
- Export what's on screen, or everything, as Markdown, CSV or a JSON backup
- Import a JSON backup to restore highlights

## Privacy

Everything is stored locally in Firefox (`browser.storage.local`). Highlights makes no network requests and sends no data anywhere. The extension only needs two permissions: `storage` and `activeTab`.

## Installing

1. Download the code: either `git clone https://github.com/Richnoca/Highlights.git`, or download the ZIP from GitHub and unzip it.
2. In Firefox, go to `about:debugging`.
3. Click **This Firefox**, then **Load Temporary Add-on**.
4. Choose `manifest.json` in the Highlights folder.

Firefox removes temporary add-ons when it restarts, so repeat steps 2–4 after restarting. To get the latest version, run `git pull` in the folder, then click **Reload** under Highlights in `about:debugging`.

## How to use it

### Highlighting
1. Select text on a webpage.
2. Click the Highlights button in the toolbar.
3. Pick a color, then click **Highlight Selected Text**.

If the extension was loaded after a tab was already open, reload that tab first.

### Notes and tags
- **Notes:** type in the **Add a note…** box under any highlight, in the popup or the library. Notes save automatically.
- **Tags:** type a tag such as `exam` or `research` and press **Enter** or a comma. Tags ignore capitals and a leading `#`. Remove a tag with **×**, or press **Backspace** in an empty tag box.
- **Filter by tag:** click a tag, in the library sidebar or on any highlight, to see every highlight with that tag.

### Searching
Type in the search box at the top of the library, or press **/** to jump to it.
- Every word has to match. Put words in quotes, like `"night vision"`, to search for an exact phrase.
- Search ignores capitals and accents, so `cafe` finds "Café".
- It searches within the current view, so you can search inside one page or one tag.
- Press **Escape** to clear the search.

### Exporting and importing
Click **Export** in the library:
- **This view** exports exactly what's on screen, including any search.
- **Export all** exports your whole library.

| Format | Good for |
| --- | --- |
| Markdown | Reading or pasting into notes apps such as Obsidian or Notion. Grouped by page, with notes and tags. |
| CSV | Opening in Excel, Google Sheets or Numbers. One row per highlight. |
| JSON backup | A complete copy that can be imported again. |

Click **Import** and choose a JSON backup to restore it. Highlights you already have are skipped, so importing the same file twice is safe.

**Back up regularly.** Highlights only live in this Firefox profile. A JSON backup is how you move them to another computer or recover them after reinstalling.

## Limitations

- Firefox doesn't allow extensions on its own pages (`about:` pages, addons.mozilla.org).
- A highlight can't be restored if the page's text changes, for example when an article is edited. It stays in the library and can be deleted there.
- Highlights are matched to the page address without the `#section` part, so `page#History` and `page` share highlights.

## How it works

- **Saving:** when you highlight, `content.js` saves the selected text, about 32 characters of text on either side, the page title, and your color.
- **Restoring:** on each visit, it searches the page's text for every saved highlight. It uses the surrounding text to pick the right one when a phrase appears more than once, then wraps the matching text in `<mark>` tags.
- **Staying in sync:** every part of the extension watches storage for changes, so edits in the popup or library update open tabs right away.

Each saved highlight looks like this:

```json
{
  "id": "…",
  "url": "https://en.wikipedia.org/wiki/Cat",
  "title": "Cat - Wikipedia",
  "text": "Cats have excellent night vision",
  "prefix": "…text before…",
  "suffix": "…text after…",
  "color": "blue",
  "note": "Likely on the final",
  "tags": ["exam", "biology"],
  "createdAt": 1763250000000,
  "updatedAt": 1763260000000
}
```

Highlights saved by older versions are upgraded automatically.

## Project files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension settings, permissions and add-on ID |
| `content.js` | Runs on webpages: creates, restores, recolors and removes highlights |
| `highlight.css` | Colors highlights on webpages |
| `storage.js` | Shared code for saving, updating, deleting, importing and upgrading highlights |
| `ui.js` | Shared color buttons, note box and tag editor |
| `popup.html` / `popup.js` | The toolbar popup |
| `all-highlights.html` / `all-highlights.js` | The Highlights Library |
| `library-tools.js` | Search, export and import |
| `styles.css` | Styles for the popup and library |

## Ideas for the future

- A keyboard shortcut for highlighting
- A right-click menu option to highlight selected text
- Publishing on addons.mozilla.org, so it stays installed after Firefox restarts
