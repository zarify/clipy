# Authoring Interface — Spec

Date: 2025-08-31
Author: (spec created by Copilot)

## Goal
Provide a dedicated authoring page where authors can create and edit Clipy configuration files in a user-friendly, error-resistant editor. The authoring UI does not run student code — it composes, validates, and stores configs so authors can switch to the main app (which will read from `localStorage['author_config']`) and test configurations there.

## Scope / Non-goals
- Scope:
  - Visual editor for config JSON with structured fields (title/version/feedback/tests/files/runtime/starter/etc.)
  - Tabbed file editor for additional text files included in `files` (editable text files) and upload support for binary/artifacts (stored encoded)
  - Persistent storage: Authoring workspace persisted to `localStorage['author_config']`, optional indexedDB store for multiple saved drafts, and import/export to file
  - Validation and normalization using existing config validator
  - UI flows to save/load/share configs
  - Export config JSON and associated binary files
- Non-goals:
  - Running MicroPython code or tests in the authoring UI
  - Full WYSIWYG for rich binary content — binaries stored as base64 and treated as assets

## High-level user stories
- As an author I can create a new configuration and persist it in localStorage so I can switch to the main app to test it.
- As an author I can edit the config metadata (title, id, version, description).
- As an author I can configure feedback entries and the order of tests/feedback evaluation.
- As an author I can add, edit and delete workspace files (text files) using a tabbed editor like the main app.
- As an author I can upload files (text or binary). Text files should be editable, binaries stored base64 and downloadable.
- As an author I can save named drafts to an IndexedDB store and load them later.
- As an author I can import a config from a local JSON file and export the current author config to a JSON file.
- As an author I can validate the current config and see inline helpful errors before saving.
- As an author I can clear the authoring workspace or reset it to an initial template.

## Acceptance criteria (concrete)
- Authoring page exists as a standalone page at `src/author/index.html` and is reachable from the app header.
- When authoring page loads, the editor initializes from `localStorage['author_config']` if present, otherwise a blank/new template.
- Any change in the structured editor updates a live normalized preview and writes to `localStorage['author_config']` (debounced, e.g. 500ms).
- Authors can add/edit/delete text files via tabs; changes persist to `author_config`.
-- Authors can upload binary files; they are added to the `files` map with base64 bodies and a `binary: true` marker. Binary uploads are limited to 200KB (204800 bytes) to avoid bloating localStorage.
-- UI exposes a Save Draft / Load Draft list that uses IndexedDB (object store: `author_configs`, key is `id`/auto-id). Drafts list shows title + last-updated. If IndexedDB is unavailable the UI falls back to named localStorage keys for drafts.
- Authors can export current config to a JSON `.json` file (files that are binary keep base64 bodies) and import such a JSON file to populate the editor.
- Validation errors show inline with helpful messages (line/file or structured field hints) and prevent export/save to indexedDB unless user acknowledges (opt-in override allowed).
- On click of a prominent "Use in app" button, the app writes the normalized config to `localStorage['author_config']` (already maintained) and opens the main app page (`/`), where the existing logic loads from `author_config` and applies it.
- Tests: Playwright smoke test verifies that setting `localStorage['author_config']` then loading `/` causes the config to appear in config modal as a loadable author config (this flow already exists); author UI has its own unit/UI tests.

## Data contract (config shape)
- Use the existing project's normalized config shape and validation. Minimal shape example:

```json
{
  "id": "string",
  "title": "string",
  "version": "string",
  "description": "string",
  "starter": "string",
  "files": {
    "path/to/file.py": "text content or base64 wrapper",
    "assets/image.png": { "content": "<base64>", "binary": true, "mime": "image/png" }
  },
  "tests": [ /* test definitions */ ],
  "feedback": [ /* feedback entries */ ],
  "runtime": { /* runtime override */ }
}
```

-- For binary files prefer an object wrapper to avoid ambiguity:
  - files['assets/img.png'] = { content: '<base64 string>', binary: true, mime: 'image/png' }
  - Text file values remain strings.
  - Binary files exceeding 200KB should be rejected by the UI with a clear warning and guidance to host the asset externally.

## UI Layout & components
- Top-level: Author header (Back to App, New, Save Draft, Load Draft, Import, Export, Use in app)
- Left column: Structured form (metadata, feedback entries, test order, runtime overrides)
- Right column: Tabbed file editor (list of files, add file button, upload file button). Each open tab shows a text editor (CodeMirror like main app). For binary files show metadata + download button + preview (if image supported).
- Bottom: Normalized JSON preview with validation feedback (collapsible panel).
- Modals: Confirm overwrite, Import errors, Save Draft prompt, Export success.

## UX details and behaviors
- Live validation: run validateAndNormalizeConfig on changes and populate error list. Block dangerous actions (indexedDB save/export) when schema errors are present unless user confirms.
- Debounced autosave: write normalized config to `localStorage['author_config']` after 500ms of idle typing in form/editor.
-- File uploads:
  - Text files: detect MIME or allow user choose, store as plain text in `files` map and create an editable tab.
  - Binary files: read as ArrayBuffer, convert to base64, store as object { content, binary: true, mime } in `files`.
  - For large files, warn user and recommend external hosting (config size may be large). The UI will enforce a hard limit of 200KB for binary uploads and present a clear error if exceeded.
- IndexedDB drafts:
  - DB name: `clipy-authoring`, store name: `author_configs`.
  - Draft record: { id: uuid, name, normalizedConfig, createdAt, updatedAt }
  - Provide rename/delete operations for drafts.
- Import/Export:
  - Export: dump normalizedConfig JSON, include binary items as base64 wrappers; prompt file download.
  - Import: accept JSON file, validate, and populate editor. Show errors in validation panel.

## APIs and functions to implement (suggested)
- storage/author-storage.js
  - getAuthorConfigFromLocalStorage(): returns normalized or null
  - saveAuthorConfigToLocalStorage(obj)
  - clearAuthorConfigInLocalStorage()
- storage/indexeddb-author.js
  - listDrafts()
  - saveDraft({ id?, name, normalizedConfig })
  - loadDraft(id)
  - deleteDraft(id)
- ui/author-page.js
  - initAuthorPage(): wire editors/forms, set up autosave & validation
  - applyImportedConfig(raw)
  - exportCurrentConfig()
- ui/file-uploader.js
  - handleTextUpload(file)
  - handleBinaryUpload(file)

## Error modes & edge cases
- Malformed JSON in imported files -> show friendly parse error, refuse to import until fixed.
- IndexedDB unavailable (private-mode) -> fall back to localStorage-based named drafts (prefix `author_draft:<id>`), surface warning.
- Very large binary files -> warn and optionally reject or force external hosting.
- Name collision for files -> prompt to overwrite or rename.
- Conflicting edits in multiple tabs/browsers -> last-write-wins; show a small "Updated elsewhere" indicator if localStorage receives storage events.

## Accessibility
- Keyboard navigable tab list and editor actions.
- All modals and file pickers accessible.
- Provide clear ARIA roles for editor tabs and the normalized preview panel.

## Testing
- Unit tests: validator reuse, file upload helpers, base64 conversion.
- Playwright scenarios (suggested):
  - Author page opens and loads `author_config` from localStorage
  - Add a text file, edit, ensure localStorage reflects change and main app sees it when using "Use in app"
  - Upload a binary image, ensure base64 present in export
  - Save draft to IndexedDB and load it back
  - Import/export roundtrip preserves structure

## Implementation plan (phases)
1. Scaffolding
  - Add standalone page at `src/author/index.html` and `src/js/author-page.js` module with basic layout and a header link back to the main app
2. Core persistence
   - Implement localStorage autosave and retrieval to/from `author_config`
   - Implement validator integration and preview panel
3. Files + editor
   - Add tabbed file editor (reuse main app's tab manager & CodeMirror integration where possible)
   - Implement text/binary upload conversion
4. Drafts (IndexedDB)
   - Add small wrapper using idb or plain IndexedDB API
5. Import/export + polish
   - Add import/export flows and UX polish
6. Tests & docs
   - Add Playwright e2e and README in `project/` describing authoring workflow

## Rollout & migration notes
- Keep `author_config` key stable for the main-app loader to pick up authored configs.
- Consider adding a migration helper if you later change the key format (preserve backwards compatibility).

## Open questions (clarifying questions for you)
1. Do you want the author page to be a single standalone HTML file under `src/` or a route within the SPA (e.g., `/author` served by the same index and routed client-side)?
- The author page should be a standalone HTML file: `src/author/index.html`
2. Do you prefer a single explicit localStorage key name other than `author_config`? (current spec uses `author_config` as requested)
- No, just use `author_config`
3. For binary files, do you want to limit allowed mime types or size? If so, please give thresholds (e.g., max 2MB).
- Yes, since they could be potentially cluttering up localStorage, make it quite small, so around 200KB.
4. Should drafts in IndexedDB be private to the browser only, or should we add a future feature to export/import draft packages for sharing?
- Since the draft package can be loaded into the editor and the editor's current config can be saved to a file, that method will be sufficient.
5. Visual style: reuse main app's CSS and CodeMirror theme? Any specific UI/UX preferences for layout (split-pane vs stacked)?
- Having a tabbed panel in preference for each section that needs authoring, so: metadata, instructions, files, feedback, tests

## Next steps I will take after your answers
- Implement the `src/author/index.html` scaffold and wire the localStorage autosave stub, plus a minimal tabbed editor using existing CodeMirror wiring.
- Add basic import/export and a placeholder IndexedDB wrapper.
- Add Playwright smoke tests for the author->main app handoff.

---

If you want, I can now scaffold `src/author/index.html` + `src/js/author-page.js` and wire the autosave/localStorage behavior. Which option for Q1 (standalone page vs SPA route) do you prefer? Also please answer Q3 (binary size limits) if you have a preference.
