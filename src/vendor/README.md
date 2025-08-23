# Vendoring MicroPython runtime

The CDN package for `@micropython/micropython-webassembly-pyscript` may return HTML or incorrect MIME types depending on the CDN path. To avoid CORS/MIME issues when testing locally, vendor the runtime into `src/vendor/`.

Options:

1) Using npm (recommended for exact package):

```bash
npm pack @micropython/micropython-webassembly-pyscript
mkdir -p src/vendor
tar -xzf @micropython-micropython-webassembly-pyscript-*.tgz -C src/vendor
# Inspect the package to find the JS entry (dist/ or index.js) and copy the runtime JS/WASM files to src/vendor
```

2) Manual download (quick):

```bash
mkdir -p src/vendor
curl -L -o src/vendor/micropython.min.js "https://cdn.jsdelivr.net/npm/@micropython/micropython-webassembly-pyscript/dist/micropython.min.js"
# If the download returns HTML, inspect contents and try the package tarball via npm.
```

After vendoring, the default `sample.json` points to `./vendor/micropython.min.js` and the app will attempt to load it locally.
