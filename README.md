# Highlights

Highlights is a Firefox extension that allows users to highlight important text on webpages and save those highlights locally. When the user returns to the same webpage later, Highlights restores the saved highlights automatically.

## Current Features

- Highlight selected text on webpages
- Save highlights using Firefox local storage
- Restore highlights when revisiting a page
- Keep highlights separated by webpage
- Delete saved highlights
- Choose from four highlight colors (yellow, green, blue, pink) and recolor saved highlights
- View all saved highlights in a separate Highlights Library, grouped by page title
- Open the original webpage from the library
- Support more complex webpages such as Wikipedia

## Project Files

- `manifest.json` - Defines the Firefox extension
- `popup.html` - Main extension popup
- `popup.js` - Controls popup functionality
- `storage.js` - Shared helpers for reading, saving, and deleting highlights
- `content.js` - Handles highlighting and restoring webpage text
- `highlight.css` - Colors highlights on webpages
- `ui.js` - Shared color buttons for the popup and library
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

Future features may include notes, tags, search, improved organization, and exporting saved highlights.
