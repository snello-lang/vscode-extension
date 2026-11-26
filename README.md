<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="images/logo-dark.png">
    <img alt="Snello" src="images/logo-light.png" width="220">
  </picture>
</p>

<p align="center">
  Language support for the <a href="https://github.com/snello-lang/snello">Snello programming language</a>:<br>
  Go's syntax, memory safety without a garbage collector.
</p>

---

## Features

| | |
|---|---|
| **Errors as you type** | Every error the compiler reports, the borrow checker's included, on the word it names, as you type, saved or not, from Snello's own checker through its language server, `snello lsp`. |
| **Hover** | On a name, its declaration as the checker types it, with its doc comment; on an expression, its type. |
| **Go to definition** | From a name to its declaration, in the module, a module it requires or the standard library. |
| **Find references and rename** | Every use of a name across the module, and a rename of all of them at once, refused when the program would no longer compile or would mean something else. |
| **Outline and symbols** | A file's declarations as a tree, and every declaration of the module found by a few of its letters. |
| **Tests** | The Testing view lists every package's tests, benchmarks and examples, as the language server finds them, and a run button sits beside each one. Run a test, a file, a package or everything; a subtest shows under its test as it runs. A failed check is shown at its line, and when it compared two values, as `expect.Equal` does, as a diff of what it got and what it wanted. A continuous run runs a package's tests again each time one of its files is saved. |
| **Completion** | After a dot, the members of what is before it; on a name, every name visible there; in an import, the packages. |
| **Syntax highlighting** | Keywords, declarations and calls; the predeclared types, traits and functions; numbers in every base; strings with their escapes and `fmt` verbs; raw strings and characters. |
| **Comments** | Toggle line comments with <kbd>Cmd</kbd>+<kbd>/</kbd> and block comments with <kbd>Shift</kbd>+<kbd>Option</kbd>+<kbd>A</kbd> (<kbd>Ctrl</kbd> and <kbd>Alt</kbd> elsewhere). |
| **Brackets** | Matching, auto-closing pairs and surrounding a selection with brackets or quotes. |
| **Indentation** | The next line indents after an opening bracket, and a closing one moves back out. |
| **Module files** | `snello.mod` is highlighted by its directives, `snello`, `require` and `link`, with its versions, names, directories, repository URLs and `//` comments; a word spelled wrong for its place is marked: an unknown directive, a malformed version, a name or library the compiler refuses, a URL without a scheme git fetches from, and a word past the last a directive takes. A missing word, and the rest of what the compiler checks of a URL, are the compiler's to report. `snello.lock` is highlighted by its four fields: the repository, the version, the commit and the hash. |

Every `.snello` file opens as Snello:

```snello
func (c mut Canvas) Add(s Shape) {
    c.shapes.Push(s)
}

func area(s Shape) f64 {
    return match s {
        Circle(radius) => 3.14 * radius * radius,
        Rect(w, h)     => w * h,
    }
}
```

## Installation

The extension starts Snello's language server, which is part of the `snello` command, so it needs Snello installed: the [Snello README](https://github.com/snello-lang/snello#quick-start) has the one-line install. The extension finds `snello` on the `PATH`; if it is elsewhere, set **Snello: Server Path** (`snello.serverPath`) to the command's absolute path, and the server starts again with it. **Snello: Restart Language Server** starts it again at any time, after a new `snello` is installed for instance. Without `snello`, the extension says so once and highlights as before. In Restricted Mode, the folder's own settings cannot choose the command; the server, which only reads files, runs as anywhere else.

The extension is not on the Marketplace yet. Build it from this repository:

```sh
git clone https://github.com/snello-lang/vscode-extension.git
cd vscode-extension
npm ci
npx @vscode/vsce package
code --install-extension snello-0.0.1.vsix
```

## Settings

| Setting | What it does |
|---|---|
| `snello.serverPath` | The absolute path of the `snello` command the server runs as, `snello lsp`, and that runs, tests and builds; empty, the first `snello` on the `PATH` |
| `snello.backend` | The backend tests are built through, `llvm` or `c`; empty, the command's default |

Tests run only in a trusted workspace; in Restricted Mode the extension highlights and checks as before, and runs nothing.

## Development

The extension needs VS Code 1.91 or later. Run `npm ci` once, then open this folder in VS Code and press <kbd>F5</kbd>: a second window opens with the extension loaded; open any `.snello` file or `snello.mod` in it, such as one from the Snello repository's `examples/`. After editing the grammar, reload that window with <kbd>Cmd</kbd>+<kbd>R</kbd> to see the change.

| Path | What it holds |
|---|---|
| `package.json` | The `snello` language and the `.snello` extension, the `snello.mod` and `snello.lock` languages and their file names, the grammar each uses, the settings, the command, what Restricted Mode allows, and the one dependency, `vscode-languageclient` |
| `extension.js` | Starts the parts below |
| `client.js` | The client: it starts `snello lsp` the first time a Snello file opens in a window, starts it again when `snello.serverPath` changes, and stops it when the window closes; every language feature is the server's, and it asks the server for the runnables, `snello/runnables` |
| `command.js` | Where the `snello` command is, and the backend flag a run is given |
| `tests.js` | The Testing view: the tree from the runnables, a run as `snello test -json`, the continuous profile |
| `events.js` | The events of `snello test -json` read as a run goes, with no editor in it, so `npm test` tests it |
| `tree.js` | What a run of tests asks of each package and enqueues, and which tests leave the tree |
| `processes.js` | The `snello` command started in a process group of its own, so that a stop ends it and all it started |
| `trust.js` | Nothing runs in Restricted Mode |
| `test/` | The tests of `events.js`, `tree.js` and `processes.js`, under Node's own runner: `npm test` |
| `language-configuration.json` | Comments, brackets, auto-closing pairs and indentation |
| `language-configuration.mod.json` | The line comment of `snello.mod` |
| `syntaxes/snello.tmLanguage.json` | The TextMate grammar behind the highlighting |
| `syntaxes/snello.mod.tmLanguage.json` | The grammar of `snello.mod` |
| `syntaxes/snello.lock.tmLanguage.json` | The grammar of `snello.lock` |

To see the scopes the grammar gives any token, run **Developer: Inspect Editor Tokens and Scopes** from the Command Palette.

## Roadmap

- Formatting, on save and on demand, through the server

## License

BSD 3-Clause, the same as Snello. See [LICENSE](LICENSE).
