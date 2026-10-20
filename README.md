# Highlights

Highlights is a Firefox extension that allows users to highlight important text on webpages and save those highlights locally. When the user returns to the same webpage later, StudyMark restores the saved highlights automatically.

## Current Features

- Highlight selected text on webpages
- Save highlights using Firefox local storage
- Restore highlights when revisiting a page
- Keep highlights separated by webpage
- Delete saved highlights
- View all saved highlights in a separate StudyMark Library
- Open the original webpage from the library
- Support more complex webpages such as Wikipedia

## Project Files

- `manifest.json` - Defines the Firefox extension
- `popup.html` - Main extension popup
- `popup.js` - Controls popup functionality
- `content.js` - Handles highlighting and restoring webpage text
- `styles.css` - Controls the appearance of the extension
- `all-highlights.html` - Displays the StudyMark Library
- `all-highlights.js` - Controls the saved highlight library

## Running the Extension

1. Open Firefox.
2. Enter `about:debugging` in the address bar.
3. Select **This Firefox**.
4. Click **Load Temporary Add-on**.
5. Select the `manifest.json` file from the StudyMark folder.
6. Open a webpage and begin using StudyMark.

## Future Improvements

Future features may include multiple highlight colors, notes, search functionality, tags, improved organization, and exporting saved highlights.
