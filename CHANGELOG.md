# Changelog

## 0.1.0-alpha.2

- **File icons**: `.snello` files, `snello.mod` and `snello.lock` show Snello's icons in the Explorer and on the editor's tabs, under any file icon theme that has no icon of its own for them, such as the default, Seti; a theme with its own icon for them shows that one, and Minimal and None show none.
- **One download**: a release holds the extension once, as `snello.vsix`, with its `SHA256SUMS` and provenance; the copy under the version's name is gone, since VS Code reads the version from the file.

## 0.1.0-alpha.1

The extension's first download. It needs Snello 0.1.0-alpha.2 or later: an older `snello` still checks as you type, but has no tests, runs or debugging to offer.

- **Errors as you type, hover, go to definition, references, rename, symbols and completion**, from Snello's language server, `snello lsp`.
- **Tests in the Testing view**, from the server's runnables: a run button beside each test, subtests as they run, a failed check at its line as a diff of what it got and wanted, and a continuous run on save.
- **Run and Debug** above every `func main`, a `snello` launch configuration for F5 and Run Without Debugging, and debugging of a program or a test through `lldb-dap` on macOS and gdb on Linux.
- **Snello: Restart Language Server**, and the highlighting of `.snello` files, `snello.mod` and `snello.lock`.
