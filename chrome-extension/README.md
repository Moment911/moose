# KotoIQ SEO Intelligence — Chrome Extension

Analyze any page for SEO issues, extract competitor topical maps, and run KotoIQ audits directly from your browser.

## Features

- **Run On-Page Audit** — Full on-page SEO analysis of the current page
- **Extract Topical Map** — Reverse-engineer a competitor's content strategy
- **Score AEO Eligibility** — Measure the page's fitness for AI Overviews and answer engines
- **Check Plagiarism** — Cross-check the page content for duplication
- **Extract Triples (Schema)** — Generate a structured-data schema block from page content

## Installation

1. Open `chrome://extensions/` in Google Chrome
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked**
4. Select this `chrome-extension/` folder
5. Pin the KotoIQ icon to your toolbar (click the puzzle-piece, then the pin icon)

## Configuration

Before first use, click the extension icon then click **Settings** at the bottom.

| Setting | What it is | Default |
|---|---|---|
| **API Endpoint** | Full URL to the KotoIQ API. | `https://hellokoto.com/api/kotoiq` |
| **API Key** | Bearer token used for authenticated requests. | _(required)_ |
| **Agency ID** | UUID of your agency. Used to fetch your client list. | _(required)_ |
| **Default Client** | Client the audits should be scoped to. | _(optional)_ |

The API endpoint and API key are stored in `chrome.storage.local` on your machine. They are never shared.

## Usage

1. Navigate to any web page (your site, a competitor's page, a client's landing page, etc.)
2. Click the KotoIQ icon in your toolbar
3. Optionally pick a client from the dropdown in the header
4. Click any of the 5 action buttons
5. Results render inline in the popup — scroll down to see them

## Icons

Place properly sized PNG files at:

- `icons/icon-16.png` (16×16)
- `icons/icon-48.png` (48×48)
- `icons/icon-128.png` (128×128)

The existing files are text placeholders — Chrome will show a fallback icon until you replace them.

## Files

```
chrome-extension/
├── manifest.json              — Manifest V3 manifest
├── README.md                  — this file
├── popup/
│   ├── popup.html             — popup UI
│   ├── popup.css              — KotoIQ brand styles
│   ├── popup.js               — popup action logic
│   ├── settings.html          — settings page
│   └── settings.js            — settings logic
├── content/
│   ├── content.js             — DOM extraction (runs on every page)
│   └── content.css            — injected element styles
├── background/
│   └── background.js          — Manifest V3 service worker (API proxy)
└── icons/
    ├── icon-16.png            — 16×16 toolbar icon
    ├── icon-48.png            — 48×48 extensions page icon
    └── icon-128.png           — 128×128 web-store icon
```

## How it works

1. Popup loads and reads settings from `chrome.storage.local`.
2. When you click an action, the popup sends a `kotoiq_extract` message to the content script, which extracts structured data from the page DOM (title, meta, headings, schema, full HTML, clean text, link counts).
3. The popup sends the combined payload to the background service worker, which in turn POSTs to the configured KotoIQ API endpoint with your Bearer token.
4. Results come back and the popup renders them inline.

The background worker acts as a proxy so the API key stays out of the page context and CORS restrictions are avoided.

## Supported API actions

- `list_clients_for_extension` — loads your agency's clients
- `analyze_on_page` — full on-page SEO audit
- `extract_competitor_topical_map` — topical map extraction
- `score_multi_engine_aeo` — AEO scoring across engines
- `check_plagiarism` — plagiarism cross-check
- `generate_triples` — RDF triple + schema extraction

Each action hits the main `/api/kotoiq` endpoint with the appropriate `action` body field. All KotoIQ actions are routed through a single POST endpoint.

## Troubleshooting

- **"No API key"** — Open Settings and paste your Bearer token.
- **"Set agency ID first"** — Open Settings and paste your agency UUID.
- **Client dropdown is empty** — Click **Refresh Clients** in Settings.
- **All actions return HTTP 401** — Bearer token is missing or wrong.
- **Actions hang on "Running…"** — Check the extension's service worker logs at `chrome://extensions/` → Details → Inspect views: service worker.
