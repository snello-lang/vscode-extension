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

The extension is not on the Marketplace yet. Build it from this repository:

```sh
git clone https://github.com/snello-lang/vscode-extension.git
cd vscode-extension
npx @vscode/vsce package
code --install-extension snello-0.0.1.vsix
```

## Development

Open this folder in VS Code and press <kbd>F5</kbd>. A second window opens with the extension loaded; open any `.snello` file or `snello.mod` in it, such as one from the Snello repository's `examples/`. After editing the grammar, reload that window with <kbd>Cmd</kbd>+<kbd>R</kbd> to see the change.

| Path | What it holds |
|---|---|
| `package.json` | The `snello` language and the `.snello` extension, the `snello.mod` and `snello.lock` languages and their file names, and the grammar each uses |
| `language-configuration.json` | Comments, brackets, auto-closing pairs and indentation |
| `language-configuration.mod.json` | The line comment of `snello.mod` |
| `syntaxes/snello.tmLanguage.json` | The TextMate grammar behind the highlighting |
| `syntaxes/snello.mod.tmLanguage.json` | The grammar of `snello.mod` |
| `syntaxes/snello.lock.tmLanguage.json` | The grammar of `snello.lock` |

To see the scopes the grammar gives any token, run **Developer: Inspect Editor Tokens and Scopes** from the Command Palette.

## Roadmap

- Errors as you type, from the Snello compiler's checker
- A language server, `snello lsp`, for hover, go to definition, find references and rename
- Completion

## License

BSD 3-Clause, the same as Snello. See [LICENSE](LICENSE).
