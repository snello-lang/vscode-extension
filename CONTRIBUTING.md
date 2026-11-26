# Contributing to the Snello extension for VS Code

Thank you for helping. This page says how to find work, how to set up, how to test a change, and what a pull request needs.

## Finding work

The work is planned in the [Snello repository](https://github.com/snello-lang/snello): its pinned [Roadmap](https://github.com/snello-lang/snello/issues/122) lists every open issue in order, and the extension's are in the [Language server milestone](https://github.com/snello-lang/snello/milestones). An issue is one task, the size of one pull request, with its acceptance criteria and its verification steps. Comment on an issue before starting it, so two people do not build the same thing; a bug, or a feature that is not planned, starts as a new issue there.

## Setting up

You need Node 22 or later, VS Code 1.91 or later, and Snello installed, since every feature runs the `snello` command: its [README](https://github.com/snello-lang/snello#quick-start) has the install.

```sh
git clone https://github.com/snello-lang/vscode-extension.git
cd vscode-extension
npm ci
```

Open the folder in VS Code and press <kbd>F5</kbd>: a second window opens with the extension loaded. Open a Snello module in it, such as `examples/packaged/` of the Snello repository, to try the language features, the Testing view, Run and Debug. After a change, reload that window with <kbd>Cmd</kbd>+<kbd>R</kbd> (<kbd>Ctrl</kbd>+<kbd>R</kbd> elsewhere).

## Testing a change

```sh
for f in *.js release/*.js test/*.js; do node --check "$f"; done
npm test
npm run package
code --install-extension bin/snello.vsix
```

`npm test` runs the tests of the parts that need no editor, such as the reading of `snello test -json`, under Node's own test runner, so they add no dependency. `npm run package` writes the extension to `bin/snello.vsix`; `bin/` is never committed. What needs the editor, the Testing view, a run, the debugger, the highlighting, is tried by hand from the `.vsix` the change builds, on a module with tests, with a failing one among them, and a program; CI builds the `.vsix` of every pull request and attaches it to the run.

## A pull request

- **One issue, one pull request.** Keep it to the issue's scope, and check off its acceptance criteria as you meet them.
- **The command does the work.** The extension finds what to run through the language server and runs it through `snello`; it never reads Snello source itself. A feature the command does not offer starts as a change to the command, in the Snello repository.
- **Nothing runs in Restricted Mode.** A feature that runs code goes through `trust.js`.
- **One dependency.** The extension depends on `vscode-languageclient` alone; adding another is a decision for the maintainers.
- **The style.** Every `.js` file starts with the license header the others show; a comment says what the code does and why, in full sentences. JSON and Markdown go without the header, and Markdown is not hard-wrapped.
- **Conventional Commits.** Commit messages and the pull request's title are `type(scope)!: subject`: the type one of `feat`, `fix`, `docs`, `test`, `ci`, `chore`, `refactor`, `perf` or `revert`, the subject in lower case with no period, body lines at most 100 characters. CI checks both, and a squash merge makes the title the commit on `main`.
- **You are the author.** You must be able to explain and defend every line in review. Contributors working with AI tools also follow [AGENTS.md](AGENTS.md), which forbids crediting a tool as an author.

## Releasing

The maintainers decide what is released and when; nothing is released by a push, a pull request or a schedule. A release is prepared in a pull request, which raises `version` in `package.json` and writes the version's section in `CHANGELOG.md`, and is cut by the tag a maintainer pushes on its merge, `v` and the version:

```sh
git tag v0.1.0-alpha.2
git push origin v0.1.0-alpha.2
```

`.github/workflows/release.yml` then checks that the tag names `package.json`'s version, runs the checks and the tests, packages the extension, and publishes a GitHub release with the extension as `snello.vsix`, a name the same in every release, its `SHA256SUMS`, its build provenance, and the version's section of `CHANGELOG.md` as its notes. Run by hand from the Actions page, the workflow is a dry run: it builds and checks as a tag does, and publishes nothing.

A version is written as Snello's are. While the extension is built alongside an alpha of Snello, it carries a pre-release suffix of its own, `0.1.0-alpha.1`, `0.1.0-alpha.2`, and each is published as a pre-release; from `0.1.0`, which comes with Snello's 0.1.0, it carries none, and is a release. Each release has its section in `CHANGELOG.md`, `## 0.1.0-alpha.2` and what it changes, which is the release's notes and the extension's Changelog tab; the workflow refuses a version whose section is missing or empty, and CI runs the same check on every pull request.

`package.json`'s `snello.minimum` names the oldest Snello the release works with, which the README says too. While that Snello is a pre-release, the extension's release must be one: the workflow refuses a version without a suffix. That Snello must be released before the extension's tag is pushed, which the workflow checks too. Raise `snello.minimum` when a release needs a newer Snello, and the README's line with it. The Marketplace takes no version with a suffix, so once it is published to, it gets the releases from 0.1.0 on.

## Conduct

Everyone taking part follows [the code of conduct](CODE_OF_CONDUCT.md).
