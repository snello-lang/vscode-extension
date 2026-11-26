# Changelog

Each release's section is its notes on the Releases page, and the release workflow refuses a version without one. A heading marked `(pre-release)` publishes the release as a pre-release, as the extension's releases are while Snello is in alpha.

## 0.1.0 (pre-release)

The extension's first download. It needs Snello 0.1.0-alpha.2 or later: an older `snello` still checks as you type, but has no tests, runs or debugging to offer.

- **Errors as you type, hover, go to definition, references, rename, symbols and completion**, from Snello's language server, `snello lsp`.
- **Tests in the Testing view**, from the server's runnables: a run button beside each test, subtests as they run, a failed check at its line as a diff of what it got and wanted, and a continuous run on save.
- **Run and Debug** above every `func main`, a `snello` launch configuration for F5 and Run Without Debugging, and debugging of a program or a test through `lldb-dap` on macOS and gdb on Linux.
- **Snello: Restart Language Server**, and the highlighting of `.snello` files, `snello.mod` and `snello.lock`.
