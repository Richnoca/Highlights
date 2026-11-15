# Highlights

Highlights is a Firefox extension that allows users to highlight important text on webpages and save those highlights locally. When the user returns to the same webpage later, Highlights restores the saved highlights automatically.

## Current Features

- Highlight selected text on webpages
- Save highlights using Firefox local storage
- Restore highlights when revisiting a page
- Keep highlights separated by webpage
- Delete saved highlights
- Choose from four highlight colors (yellow, green, blue, pink) and recolor saved highlights
- Add notes to highlights; notes appear when hovering over the highlighted text
- Tag highlights (for example "exam" or "research") and view every highlight with a tag
- Browse all highlights in the Highlights Library, with a sidebar of pages and tags
- Jump from the popup to the current page's highlights in the library
- Open the original webpage from the library
- Support more complex webpages such as Wikipedia

## Project Files

- `manifest.json` - Defines the Firefox extension
- `popup.html` - Main extension popup
- `popup.js` - Controls popup functionality
- `storage.js` - Shared helpers for reading, saving, and deleting highlights
- `content.js` - Handles highlighting and restoring webpage text
- `highlight.css` - Colors highlights on webpages
- `ui.js` - Shared color buttons, note box and tag editor for the popup and library
- `styles.css` - Controls the appearance of the extension
- `all-highlights.html` - Displays the Highlights Library
- `all-highlights.js` - Controls the saved highlight library

## Running the Extension

1. Open Firefox.
2. Enter `about:debugging` in the address bar.
3. Select **This Firefox**.
4. Click **Load Temporary Add-on**.
5. Select the `manifest.json` file from the Highlights folder.
6. Open a webpage and begin using Highlights.

## Future Improvements

Future features may include search and exporting saved highlights.
