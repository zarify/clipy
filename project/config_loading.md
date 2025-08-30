# Config loading in Clipy

This document explains the three supported ways the application can load configuration JSON, what the app does with the data, common failure modes (notably CORS), and quick debugging tips.

## Summary
Clipy supports loading configuration JSON by:

1. Loading a named config file from the app server (`/config/<name>`) and optionally discovering available configs from `/config/index.json`.
2. Loading a remote config by passing a full `http(s)://` URL to fetch and parse.
3. Uploading a local file via a file input and parsing the JSON client-side.
4. Passing a `config` query parameter to the app URL: `/?config=<URL-or-filename>` — the value may be a full `http(s)://` URL or a filename (same rules as the loading modal).

The loader validates and normalizes the JSON; invalid JSON or missing required fields will be rejected with an error.

## Where this code lives
Primary implementation: `src/js/config.js`.
Query-param handling (reading `?config=`) is implemented in `src/app.js` during startup and will attempt to load the provided value using `loadConfigFromStringOrUrl` before falling back to the default `loadConfig()` flow.
Key exported functions used by the app and tests:

- `fetchAvailableServerConfigs()` — fetches `/config/index.json` and returns an array of filenames (fallbacks to `sample.json`).
- `loadConfigFromStringOrUrl(input)` — given either a filename or a full URL, fetches and loads the config.
- `loadConfigFromFile(file)` — reads a `File` object (from `<input type="file">`) and parses it.
- `loadConfig()` — default startup load (fetches `configUrl` which defaults to `/config/sample.json`).
- `resetToLoadedConfig()` — force reload from the configured `configUrl` and reinitialize UI.

The loader normalizes and validates fields (id, version, runtime.url, etc.) using `validateAndNormalizeConfigInternal` and will throw for malformed data.

## 1) Loading named configs from the app server

Behavior
- If the input looks like a filename (does not start with `http://` or `https://`), the loader constructs `/config/<filename>` and calls `fetch()`.
- The app also attempts to fetch `/config/index.json` to present a discovery list (the index should be a JSON array of filenames).

When to use
- Use for configs you host alongside the app (recommended for production if you control the site).

Failure modes
- Missing file (404) → fetch will reject and app falls back to a default config.
- Invalid JSON → parse error; loader throws an explanatory message.

## 2) Loading a remote URL (full `http(s)://` URL)

Behavior
- If the input starts with `http://` or `https://`, the loader calls `fetch(url)` directly and expects JSON.
- On success the config is normalized and applied.

CORS and network considerations (important)
- Browsers enforce CORS for cross-origin `fetch()` calls. The remote host must supply the appropriate CORS response header. For simple GET JSON requests, the remote response must include at least:

  Access-Control-Allow-Origin: *

  or

  Access-Control-Allow-Origin: https://your-app-origin

- If the remote host does not include the header, the browser will block the response and fetch will fail with a network-style error (the loader converts `TypeError: Failed to fetch` into a hint mentioning CORS or network issues).
- Private resources (that require authentication) will not work from the browser unless you handle auth (see workarounds below).

Practical hosts that commonly work
- `raw.githubusercontent.com` (raw GitHub file URLs) or GitHub Pages — these commonly supply permissive CORS for public files.
- S3 buckets configured with a CORS policy that allows your origin.

Workarounds when CORS blocks you
- Host the JSON on a CORS-enabled endpoint (GitHub Pages, raw.githubusercontent.com, S3 with correct CORS headers).
- Configure the server that serves the JSON to add `Access-Control-Allow-Origin` for your app.
- Use a server-side proxy under your control that fetches the remote URL server-side and returns it to the client with appropriate CORS headers. This is the recommended approach for private or authenticated resources.

## 3) Uploading a local file

Behavior
- The UI can accept a `File` object (via an `<input type=file>`). `loadConfigFromFile(file)` reads the file text, parses JSON, validates, and applies it.
- This does not involve network requests and is not subject to CORS.

When to use
- Users want to load a local config file from their machine.
- Useful fallback if remote fetching fails due to CORS.

Failure modes
- File not a valid JSON — loader will throw a parse error.
- Missing required fields in the JSON — loader will throw a validation error.

## Validation and normalization
- The loader enforces a few required shapes (e.g. `runtime.url` must be a non-empty string, `id` must match `[A-Za-z0-9_-]+`).
- Execution and runtime fields are normalized to safe defaults (timeouts clamped, default runtime url `/vendor/micropython.wasm`).
- On startup the app calls `loadConfig()` which fetches the default `configUrl` (`/config/sample.json`) and falls back to an internal default if that fetch fails.

## Debugging tips and quick checks

1. Check headers with curl:

```bash
curl -I 'https://raw.githubusercontent.com/<owner>/<repo>/branch/path/config.json'
```
Look for an `Access-Control-Allow-Origin` header.

2. Quick in-browser check (open console on your app origin):

```js
fetch('https://raw.githubusercontent.com/.../config.json')
  .then(r => { console.log('response', r); return r.json() })
  .then(j => console.log('parsed', j))
  .catch(e => console.error('fetch failed', e));
```

If this logs a `TypeError: Failed to fetch` the likely cause is CORS or a network issue.

3. If the app shows an error mentioning CORS, try uploading the file locally via the "Upload file" path in the UI to verify the JSON is valid.

## Recommendations and best practices
- For public, stable configs: serve them from the same origin as the app (easiest) or from a CORS-enabled host (GitHub Pages, raw.githubusercontent.com). That avoids CORS surprises for end users.
- For private or authenticated configs: implement a server-side proxy that fetches the remote file and returns it to the client with safe CORS headers and any needed authentication.
- Surface clear error messages in the UI: when a remote fetch fails, show the loader's hint text about CORS/network issues and link to this document.

## Developer notes / references
- File: `src/js/config.js`
  - `configUrl` — default path used by `loadConfig()` (`/config/sample.json`).
  - `configIndexUrl` — default discovery URL (`/config/index.json`) used by `fetchAvailableServerConfigs()`.
  - `loadConfigFromStringOrUrl(input)` — accepts either a filename (loads `/config/<filename>`) or a full `http(s)://` URL.
  - `loadConfigFromFile(file)` — reads a `File` object and parses JSON.
  - Error messages for network failures are enhanced to hint at CORS problems.

- The app initializes by calling `loadConfig()` from `src/app.js` during startup. `resetToLoadedConfig()` forces a reload and UI reinitialization.

## Example: using a GitHub raw URL
- Public raw file example (likely to work):
  `https://raw.githubusercontent.com/<owner>/<repo>/main/config/sample.json`

If you'd like, I can:
- Add a short UI hint to show the exact error message returned from `loadConfigFromStringOrUrl()` when remote loading fails.
- Add a small cookbook example in the UI showing a working raw.githubusercontent URL pattern.
