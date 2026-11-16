// Search, export and import for the Highlights Library.
// Loaded by all-highlights.html after storage.js and ui.js.
// Everything here is plain functions with no page drawing, so it is
// easy to test on its own.

// ======================SEARCH======================

// Lowercase and drop accents, so "cafe" finds "Café"
function normalizeForSearch(text){

    return String(text)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
}

// 'night "small mammal"' -> ["night", "small mammal"]
// Words in quotes are searched for as one phrase.
function getSearchTerms(query){

    const terms = [];
    const pattern = /"([^"]+)"|(\S+)/g;
    let match;

    while ((match = pattern.exec(String(query))) !== null){

        const term = normalizeForSearch((match[1] || match[2]).trim());

        if (term && !terms.includes(term)){
            terms.push(term);
        }
    }

    return terms;
}

// True if every term appears somewhere in the highlight's
// text, page title, address, note or tags
function matchesSearch(highlight, terms){

    if (terms.length === 0){
        return true;
    }

    const searchable = normalizeForSearch([
        highlight.text,
        highlight.title,
        highlight.url,
        highlight.note,
        highlight.tags.join(" ")
    ].join("\n"));

    return terms.every(term => searchable.includes(term));
}

function textMatches(text, terms){

    const searchable = normalizeForSearch(text);

    return terms.some(term => searchable.includes(term));
}

// Splits text into pieces, marking the ones that match a search term:
// ("Cats see well", ["see"]) -> [{text:"Cats ", hit:false}, {text:"see", hit:true}, {text:" well", hit:false}]
function splitBySearchTerms(text, terms){

    if (terms.length === 0 || !text){
        return [{ text: text, hit: false }];
    }

    // Build the searchable version of the text, remembering which
    // original character each searchable character came from
    let searchable = "";
    const origin = [];

    for (let i = 0; i < text.length; i++){

        for (const char of normalizeForSearch(text[i])){
            searchable += char;
            origin.push(i);
        }
    }

    // Find every match, as ranges in the original text
    const ranges = [];

    terms.forEach((term) =>{

        let position = searchable.indexOf(term);

        while (position !== -1){

            ranges.push([
                origin[position],
                origin[position + term.length - 1] + 1
            ]);

            position = searchable.indexOf(term, position + 1);
        }
    });

    if (ranges.length === 0){
        return [{ text: text, hit: false }];
    }

    // Join overlapping ranges
    ranges.sort((a, b) => a[0] - b[0]);

    const merged = [ranges[0]];

    ranges.slice(1).forEach((range) =>{

        const last = merged[merged.length - 1];

        if (range[0] <= last[1]){
            last[1] = Math.max(last[1], range[1]);
        }else{
            merged.push(range);
        }
    });

    // Cut the text into pieces
    const pieces = [];
    let cursor = 0;

    merged.forEach(([start, end]) =>{

        if (start > cursor){
            pieces.push({ text: text.slice(cursor, start), hit: false });
        }

        pieces.push({ text: text.slice(start, end), hit: true });
        cursor = end;
    });

    if (cursor < text.length){
        pieces.push({ text: text.slice(cursor), hit: false });
    }

    return pieces;
}

// ======================EXPORT======================

// Every export goes through here so all three formats agree on order:
// highlights are passed in the order they appear on screen.

const BACKUP_FORMAT = "highlights-backup";
const BACKUP_VERSION = 1;

// ----------JSON (full backup, can be imported again)----------

function exportAsJson(highlights){

    return JSON.stringify({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        count: highlights.length,
        highlights: highlights
    }, null, 2);
}

// ----------CSV (opens in Excel, Google Sheets, Numbers)----------

const CSV_COLUMNS = ["Page title", "Page URL", "Highlight", "Note", "Tags", "Color", "Created"];

function exportAsCsv(highlights){

    const rows = [CSV_COLUMNS];

    highlights.forEach((highlight) =>{

        rows.push([
            highlight.title,
            highlight.url,
            highlight.text,
            highlight.note,
            highlight.tags.join("; "),
            highlight.color,
            formatDateTimeForFile(highlight.createdAt)
        ]);
    });

    // The invisible mark at the start (a "byte order mark") tells Excel
    // the file is UTF-8, so accents and emoji show correctly
    return "﻿" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function csvCell(value){

    let text = String(value ?? "");

    // Spreadsheets run cells starting with these characters as formulas.
    // Highlighted text from a webpage could be made to look like one,
    // so start such cells with ' to keep them plain text.
    if (/^[=+\-@\t\r]/.test(text)){
        text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
}

// ----------Markdown (readable notes, grouped by page)----------

function exportAsMarkdown(highlights, heading){

    const lines = [];

    lines.push("# " + escapeMarkdownLine(heading));
    lines.push("");

    const pageCount = new Set(highlights.map(h => h.url)).size;

    lines.push(
        "_Exported " + formatDate(Date.now()) + " · " +
        countWord(highlights.length, "highlight") + " from " +
        countWord(pageCount, "page") + "_"
    );

    // Group by page, keeping the order pages first appear in
    const pages = [];
    const byUrl = {};

    highlights.forEach((highlight) =>{

        if (!byUrl[highlight.url]){
            byUrl[highlight.url] = { url: highlight.url, title: "", highlights: [] };
            pages.push(byUrl[highlight.url]);
        }

        byUrl[highlight.url].highlights.push(highlight);

        if (highlight.title){
            byUrl[highlight.url].title = highlight.title;
        }
    });

    pages.forEach((page) =>{

        lines.push("");
        lines.push(
            "## [" + escapeLinkText(page.title || getDomain(page.url)) + "](" +
            markdownUrl(page.url) + ")"
        );

        page.highlights.forEach((highlight) =>{

            lines.push("");

            highlight.text.split(/\r?\n/).forEach((line) =>{
                lines.push("> " + escapeMarkdownLine(line));
            });

            if (highlight.note){
                lines.push("");
                lines.push("**Note:** " + highlight.note.split(/\r?\n/).join("  \n"));
            }

            if (highlight.tags.length > 0){
                lines.push("");
                lines.push("**Tags:** " + highlight.tags.join(", "));
            }
        });
    });

    return lines.join("\n") + "\n";
}

// Stop a highlight starting with "#", "-", "1." etc. from turning
// into a heading or list inside the quote
function escapeMarkdownLine(line){
    return line.replace(/^(\s*)([#>*+-]|\d+\.)/, "$1\\$2");
}

function escapeLinkText(text){
    return text.replace(/([\\[\]])/g, "\\$1");
}

// Addresses with spaces or brackets need <...> around them
function markdownUrl(url){
    return /[\s()<>]/.test(url) ? "<" + url.replace(/[<>]/g, encodeURIComponent) + ">" : url;
}

function countWord(count, word){
    return count + " " + word + (count === 1 ? "" : "s");
}

// ----------Files----------

// "Cat - Wikipedia" -> "highlights-cat-wikipedia-2026-11-15.md"
function exportFilename(scope, extension){

    const slug = normalizeForSearch(scope)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) || "export";

    const date = formatDateTimeForFile(Date.now()).slice(0, 10);

    return "highlights-" + slug + "-" + date + "." + extension;
}

// Timestamp -> "2026-11-15 18:40" in local time ("" if unknown)
function formatDateTimeForFile(timestamp){

    if (!timestamp){
        return "";
    }

    const date = new Date(timestamp);
    const two = n => String(n).padStart(2, "0");

    return date.getFullYear() + "-" + two(date.getMonth() + 1) + "-" + two(date.getDate()) +
        " " + two(date.getHours()) + ":" + two(date.getMinutes());
}

// Saves text as a file through the browser's normal download
function downloadText(content, filename, mimeType){

    const blob = new Blob([content], { type: mimeType + ";charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ======================IMPORT======================

const MAX_IMPORT_TEXT = 20000;

// Reads a backup file's text. Returns {highlights, rejected}, where
// rejected counts entries that were missing their text or address.
// Throws an Error with a readable message if the file can't be used.
function parseBackup(fileText){

    let data;

    try{
        data = JSON.parse(fileText);
    }catch{
        throw new Error("That file isn't a Highlights backup (it isn't valid JSON).");
    }

    const list = Array.isArray(data) ? data : data && data.highlights;

    if (!Array.isArray(list)){
        throw new Error("That file isn't a Highlights backup. Export one from the library with Export → JSON.");
    }

    const highlights = [];
    let rejected = 0;

    list.forEach((item) =>{

        const clean = cleanImportedHighlight(item);

        if (clean){
            highlights.push(clean);
        }else{
            rejected++;
        }
    });

    return {
        highlights: migrateHighlights(highlights).highlights, // fills in missing ids
        rejected: rejected
    };
}

// Keeps only known fields with sensible values. Returns null if the
// entry has no text or no usable web address.
function cleanImportedHighlight(item){

    if (!item || typeof item !== "object"){
        return null;
    }

    const text = typeof item.text === "string" ? item.text.slice(0, MAX_IMPORT_TEXT) : "";

    if (!text.trim() || typeof item.url !== "string"){
        return null;
    }

    // Only real page addresses: a backup file could otherwise contain
    // something like a javascript: link that runs when clicked
    let url;

    try{
        const parsed = new URL(item.url);

        if (!["http:", "https:", "file:"].includes(parsed.protocol)){
            return null;
        }

        url = normalizeUrl(parsed.href);
    }catch{
        return null;
    }

    const asText = (value, limit) =>
        typeof value === "string" ? value.slice(0, limit) : "";

    const asTime = value =>
        Number.isFinite(value) && value > 0 ? value : 0;

    const clean = {
        url: url,
        title: asText(item.title, 1000),
        text: text,
        prefix: asText(item.prefix, 200),
        suffix: asText(item.suffix, 200),
        color: HIGHLIGHT_COLORS.includes(item.color) ? item.color : DEFAULT_COLOR,
        note: asText(item.note, MAX_IMPORT_TEXT),
        tags: Array.isArray(item.tags)
            ? mergeTags([], item.tags.filter(tag => typeof tag === "string")).slice(0, 50)
            : [],
        createdAt: asTime(item.createdAt)
    };

    if (typeof item.id === "string" && item.id && item.id.length <= 100){
        clean.id = item.id;
    }

    if (asTime(item.updatedAt)){
        clean.updatedAt = asTime(item.updatedAt);
    }

    return clean;
}
