# Instructions for AI agents

This file is read by coding agents working in this repository. It says what the extension is, how work is done here, and what must not change without a human decision.

## What this is

The VS Code extension for the [Snello programming language](https://github.com/snello-lang/snello). It is a client: every language feature is Snello's language server, `snello lsp`, which it starts; the tests it shows and the programs it runs, it finds through the server's `snello/runnables` request; and it runs, tests, builds and debugs through the `snello` command. Its own code is the editor's side of each of these and nothing more.

## Read first, in this order

1. `README.md`: what the extension does, its settings, and the file that does each part.
2. In the Snello repository, `_docs/design/15-language-server.md`: the server, its capabilities, the runnables request (section 9a) and what the extension runs and how (section 13).
3. In the Snello repository, `_docs/book/16-testing.md`, "The run as events": what `snello test -json` prints, which `events.js` reads; and `_docs/book/30-debugging-and-profiling.md`: the build for a debugger, `snello debug -setup`, and a test under the debugger.
4. The issue of the current task in the Snello repository, with its acceptance criteria; see `CONTRIBUTING.md`, "Finding work".

## How work is done

- **One slice at a time.** Land one small, working, tested piece, explain what it does and why it is shaped that way, and stop so the owner can read it.
- **The command does the work.** A feature that needs to know something about a program asks the server or the command; the extension never searches Snello source of its own. What the command does not offer is changed in the Snello repository first.
- **Tests with every slice.** A part that needs no editor is a module of its own with a test under `test/`, run by `npm test` on Node's own runner; what needs the editor is tried by hand from the built `.vsix`.
- **Do not commit or push.** The owner commits. Leave the working tree clean of temporary files.
- **Conventional Commits.** A commit message and a pull request's title are `type(scope)!: subject`, the type one of `feat`, `fix`, `docs`, `test`, `ci`, `chore`, `refactor`, `perf` or `revert`, the subject in lower case with no period, the body after a blank line saying what changed and why. `.github/workflows/commitlint.yml` checks every commit and `pr-title-checker.yml` every title.
- **No AI authorship.** Do not credit an AI tool, model, or bot as an author anywhere in a contribution. This includes `Co-Authored-By` commit trailers (e.g. `Co-Authored-By: Claude ...`), "Generated with ..." footers in PR descriptions, and any other attribution to an AI tool in commits, PR descriptions, issues, code, or comments. If your tooling adds such lines by default, remove them before committing and before opening the PR. The human who submits the PR is its sole author and must be able to explain and defend every line of it in review. PRs that credit an AI tool as an author will not be reviewed until the attribution is removed.

### Definition of done, for every task

- Every module parses, `node --check` on `*.js`, `release/*.js` and `test/*.js`, and `npm test` passes.
- Every new `.js` file carries the license header.
- `npm run package` builds `bin/snello.vsix`, and the issue's verification steps have been run from it; `bin/` is never committed.
- `README.md` says what the change adds, in its features, its settings and its table of files.

## Constraints that need a human to change

- **One dependency**, `vscode-languageclient`. The tests use Node's own `node:test` and `node:assert`.
- **Nothing runs in Restricted Mode**: no program, test, build or debugger, and the folder's settings cannot choose the command or the debugger.
- **Every feature comes from the command or its server**, so that another editor gets the same by starting the same command.
- **Releases are cut by a tag a maintainer pushes**, from a pull request that raised the version and wrote its changelog section; never by a push, a pull request or a schedule, and never by an agent. A release stays a pre-release while the Snello it needs, `snello.minimum`, is one.
