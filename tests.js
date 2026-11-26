// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// A Snello workspace's tests in the editor's Testing view: the tree of
// its packages, their test files and the tests, benchmarks and examples
// in them, from the language server's runnables, kept as files change,
// and a run button beside each test. A run is `snello test -json`, one
// process a package, the tests picked by -run; a subtest joins the tree
// under its test as it runs, a failed check is shown at its line, with
// a diff of what it got and wanted when it compared two values, and
// what a test printed is its output. The Debug profile debugs the
// chosen tests through debug.js; the continuous run runs a package's
// tests again when one of its files is saved. What is decided, with no
// editor in it, is tree.js's.

"use strict";

const path = require("path");
const vscode = require("vscode");
const client = require("./client");
const command = require("./command");
const processes = require("./processes");
const trust = require("./trust");
const tree = require("./tree");
const { reader, pattern, parentOf } = require("./events");

const controllerLabel = "Snello";
const refreshDelay = 300; // milliseconds after the last change before the tree is read again
const noTests = "^$";

let controller;
let refreshTimer;
let latest = 0; // the number of the last answer asked for, so that an older one that comes later is passed over
const changedFiles = new Set(); // the documents edited since the last refresh, read alone
const packages = new Map(); // by directory: { item, files: Map(uri → item), tests: Map(name → item), subtests: Map(name → item) }

// activate makes the controller, reads the tree when the server starts
// and as files change, and adds the Run, Debug and continuous profiles.
function activate(context) {
	controller = vscode.tests.createTestController(command.languageId, controllerLabel);
	controller.refreshHandler = () => refresh();
	controller.createRunProfile("Run", vscode.TestRunProfileKind.Run, (request, token) => runTests(request, token), true, undefined, true);
	controller.createRunProfile("Debug", vscode.TestRunProfileKind.Debug, (request) => debugTests(request), true);
	const watcher = vscode.workspace.createFileSystemWatcher("**/*.snello");
	context.subscriptions.push(
		controller,
		watcher,
		watcher.onDidCreate(() => scheduleRefresh()),
		watcher.onDidDelete(() => scheduleRefresh()),
		watcher.onDidChange((uri) => scheduleRefresh(uri)),
		vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.languageId === command.languageId) {
				scheduleRefresh(e.document.uri);
			}
		}),
		client.onStarted(() => refresh()),
	);
}

// scheduleRefresh reads the tree again once the changes stop: the files
// changed alone, or everything for a file made or removed.
function scheduleRefresh(uri) {
	if (uri === undefined) {
		changedFiles.clear();
		changedFiles.add(undefined);
	} else if (!changedFiles.has(undefined)) {
		changedFiles.add(uri.toString());
	}

	clearTimeout(refreshTimer);
	refreshTimer = setTimeout(() => {
		const files = [...changedFiles];
		changedFiles.clear();
		if (files.includes(undefined)) {
			refresh();
		} else {
			files.forEach((uri) => refreshFile(vscode.Uri.parse(uri)));
		}
	}, refreshDelay);
}

// refresh reads the workspace's tests again and makes the tree match: a
// package, a file and a test that are gone leave it, and a test that
// moved keeps its place in the tree. An answer the server could not
// give leaves the tree as it is.
async function refresh() {
	const asked = ++latest;
	const found = await client.runnables();
	if (found === undefined || asked !== latest) {
		return;
	}

	const tests = found.filter((r) => r.kind !== tree.KIND.main);
	const seen = new Map();
	for (const r of tests) {
		add(r);
		if (!seen.has(r.dir)) {
			seen.set(r.dir, { files: new Set(), tests: new Set() });
		}

		seen.get(r.dir).files.add(vscode.Uri.parse(r.location.uri).toString());
		seen.get(r.dir).tests.add(r.name);
	}

	for (const [dir, pkg] of packages) {
		const kept = seen.get(dir);
		if (kept === undefined) {
			controller.items.delete(pkg.item.id);
			packages.delete(dir);
			continue;
		}

		for (const name of tree.staleOf(pkg.tests, kept.tests)) {
			removeTest(pkg, name);
		}

		for (const [uri, file] of pkg.files) {
			if (!kept.files.has(uri)) {
				pkg.item.children.delete(file.id);
				pkg.files.delete(uri);
			}
		}
	}
}

// refreshFile reads the tests of one file again and makes its part of
// the tree match.
async function refreshFile(uri) {
	const asked = ++latest; // an answer for the workspace asked before this one is older than it
	const found = await client.runnables(uri);
	if (found === undefined || asked !== latest) {
		return;
	}

	const names = new Set();
	for (const r of found.filter((r) => r.kind !== tree.KIND.main)) {
		add(r);
		names.add(r.name);
	}

	for (const [dir, pkg] of packages) {
		const file = pkg.files.get(uri.toString());
		if (file === undefined) {
			continue;
		}

		for (const [name, test] of pkg.tests) {
			if (test.parent === file && !names.has(name)) {
				removeTest(pkg, name);
			}
		}

		if (file.children.size === 0) { // a file left with no test leaves the tree, and a package left with no file
			pkg.item.children.delete(file.id);
			pkg.files.delete(uri.toString());
		}

		if (pkg.files.size === 0 && pkg.tests.size === 0) {
			controller.items.delete(pkg.item.id);
			packages.delete(dir);
		}
	}
}

// add puts the runnable r in the tree, or moves its item to where it is
// now.
function add(r) {
	const pkg = packageItem(r.dir, r.package);
	const uri = vscode.Uri.parse(r.location.uri);
	let file = pkg.files.get(uri.toString());
	if (file === undefined) {
		file = controller.createTestItem(uri.toString(), path.basename(uri.fsPath), uri);
		file.snello = { kind: tree.KIND.file, dir: r.dir };
		pkg.files.set(uri.toString(), file);
		pkg.item.children.add(file);
	}

	let test = pkg.tests.get(r.name);
	if (test !== undefined && test.parent !== file) { // moved to another file: the old item goes, with its subtests
		removeTest(pkg, r.name);
		test = undefined;
	}

	if (test === undefined) {
		test = controller.createTestItem(testId(r.name), r.name, uri);
		pkg.tests.set(r.name, test);
		file.children.add(test);
	}

	test.range = rangeOf(r.location.range);
	test.description = r.kind === tree.KIND.test ? undefined : r.kind;
	test.snello = { kind: r.kind, dir: r.dir, name: r.name };
}

// removeTest takes the test named name out of the tree, with its
// subtests.
function removeTest(pkg, name) {
	const test = pkg.tests.get(name);
	(test.parent ? test.parent.children : pkg.item.children).delete(test.id);
	pkg.tests.delete(name);
	for (const sub of tree.subtestsOf(pkg.subtests, name)) {
		pkg.subtests.delete(sub);
	}
}

// packageItem returns the tree's item of the package in dir, made the
// first time, labelled by its name and its directory in the workspace.
function packageItem(dir, name) {
	let pkg = packages.get(dir);
	if (pkg === undefined) {
		const uri = vscode.Uri.file(dir);
		const item = controller.createTestItem(dir, name, uri);
		item.description = vscode.workspace.asRelativePath(uri, true);
		item.snello = { kind: tree.KIND.package, dir };
		pkg = { item, files: new Map(), tests: new Map(), subtests: new Map() };
		packages.set(dir, pkg);
		controller.items.add(item);
	}

	return pkg;
}

// testId is the ID of the test named name: the name itself, which the
// editor requires to be unique only among the item's siblings, the
// tests of one file, or of one test for a subtest, whose name holds its
// test's.
function testId(name) {
	return name;
}

function rangeOf(r) {
	return new vscode.Range(r.start.line, r.start.character, r.end.line, r.end.character);
}

// roots is every package item of the tree.
function roots() {
	const out = [];
	controller.items.forEach((item) => out.push(item));
	return out;
}

// runTests runs what the request asks, a package at a time, and reports
// each test's result on the run; the run ends whatever happens.
async function runTests(request, token) {
	const run = controller.createTestRun(request);
	try {
		if (!trust.allowed()) {
			run.appendOutput("Snello runs tests only in a trusted workspace.\r\n");
			return;
		}

		const snello = command.executable();
		if (snello === undefined) {
			run.appendOutput("snello was not found; set snello.serverPath to the snello command's absolute path.\r\n");
			return;
		}

		if (request.continuous) {
			watch(request, token);
		}

		const cancelled = () => token.isCancellationRequested || (run.token !== undefined && run.token.isCancellationRequested);
		for (const [dir, s] of tree.selectionsOf(roots(), request.include, request.exclude)) {
			if (cancelled()) {
				break;
			}

			const pkg = packages.get(dir);
			const enqueued = pkg ? tree.enqueuedOf(pkg.tests, s) : [];
			enqueued.forEach((test) => run.enqueued(test));
			const queued = new Set(enqueued);
			if (s.all || s.tests.size > 0) {
				await runPackage(snello, dir, s.all ? [] : ["-run", pattern([...s.tests])], run, token, queued);
			}

			if (s.benchmarks.size > 0 && !cancelled()) {
				await runPackage(snello, dir, ["-run", noTests, "-bench", pattern([...s.benchmarks])], run, token, queued);
			}
		}
	} finally {
		run.end();
	}
}

// runPackage runs `snello test -json` on the package in dir with flags,
// and reports what its events say, until the process ends or the run is
// cancelled, which stops it and every process it started; a package that
// does not build errs the tests queued, those the run asked for.
function runPackage(snello, dir, flags, run, token, queued) {
	return new Promise((resolve) => {
		const args = ["test", "-json", ...command.backendArgs(), ...flags, dir];
		const child = processes.spawn(snello, args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] }); // no input: a test that reads it reads its end
		const stops = [token.onCancellationRequested(() => processes.stop(child))];
		if (run.token) {
			stops.push(run.token.onCancellationRequested(() => processes.stop(child)));
		}

		const started = new Set();
		const ended = new Set(); // the tests whose result came
		const r = reader({
			started(name) {
				const item = itemOf(dir, name);
				started.add(item);
				run.started(item);
			},
			passed(name, ms) {
				const item = itemOf(dir, name);
				ended.add(item);
				run.passed(item, ms);
			},
			skipped(name) {
				const item = itemOf(dir, name);
				ended.add(item);
				run.skipped(item);
			},
			failed(name, ms, failures) {
				const item = itemOf(dir, name);
				ended.add(item);
				run.failed(item, failures.length > 0 ? failures.map((f) => messageOf(f, item)) : [new vscode.TestMessage(`${name} failed`)], ms);
			},
			output(name, text) {
				run.appendOutput(text.replace(/\r?\n/g, "\r\n"), undefined, name ? itemOf(dir, name) : undefined);
			},
			benchmarked(name, text) {
				const item = itemOf(dir, name);
				ended.add(item);
				run.appendOutput(text.replace(/\r?\n/g, "\r\n"), undefined, item);
				run.passed(item);
			},
			packageFailed(lines) {
				const message = new vscode.TestMessage(lines.join("\n") || "the package's tests did not run");
				for (const test of queued) {
					if (!started.has(test)) {
						run.errored(test, message);
					}
				}
			},
		});

		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (chunk) => r.feed(chunk));
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (chunk) => run.appendOutput(chunk.replace(/\r?\n/g, "\r\n")));
		child.on("error", (err) => run.appendOutput(`${err.message}\r\n`));
		child.on("close", () => {
			r.end();
			stops.forEach((s) => s.dispose());
			const stopped = token.isCancellationRequested || (run.token !== undefined && run.token.isCancellationRequested);
			for (const test of started) { // begun and never ended: a crash ended it, unless the run was stopped, which leaves it unfinished
				if (!ended.has(test) && !stopped) {
					run.errored(test, new vscode.TestMessage(`${test.label} did not finish: the test program ended first`));
				}
			}

			resolve();
		});
	});
}

// itemOf returns the item of the test named name in the package in dir:
// a test the tree has, or a subtest, added under its test as it runs and
// kept apart from the tests the server finds, so that a refresh, which
// finds none, leaves it.
function itemOf(dir, name) {
	const pkg = packageItem(dir, path.basename(dir));
	const known = pkg.tests.get(name) || pkg.subtests.get(name);
	if (known !== undefined) {
		return known;
	}

	const parentName = parentOf(name);
	const parent = parentName === undefined ? undefined : itemOf(dir, parentName);
	const item = controller.createTestItem(testId(name), name.slice(parentName === undefined ? 0 : parentName.length + 1), parent && parent.uri);
	if (parent === undefined) { // a test the server did not list, under the package
		item.snello = { kind: tree.KIND.test, dir, name };
		pkg.tests.set(name, item);
		pkg.item.children.add(item);
		return item;
	}

	const test = parent.snello.kind === tree.KIND.subtest ? parent.snello.test : parent;
	item.snello = { kind: tree.KIND.subtest, dir, name, test };
	pkg.subtests.set(name, item);
	parent.children.add(item);
	return item;
}

// messageOf is a failure as the editor shows it: at the failed check's
// line, or at the test's own, with a diff of what it got and wanted
// when it compared two values.
function messageOf(f, item) {
	const message =
		f.got !== undefined && f.want !== undefined
			? vscode.TestMessage.diff(f.message || "the values differ", f.want, f.got)
			: new vscode.TestMessage(f.message || "failed");
	if (f.file && Number.isInteger(f.line)) {
		message.location = new vscode.Location(vscode.Uri.file(f.file), new vscode.Position(Math.max(f.line - 1, 0), 0));
	} else if (item.uri && item.range) {
		message.location = new vscode.Location(item.uri, item.range.start);
	}

	return message;
}

// watch runs the request's packages again when one of their files is
// saved, until the continuous run ends: each save's run stops the one
// before it, and stops with the continuous run or by its own button.
function watch(request, token) {
	const dirs = new Set([...tree.selectionsOf(roots(), request.include, request.exclude).keys()].map((dir) => vscode.Uri.file(dir).toString()));
	let last;
	const saved = vscode.workspace.onDidSaveTextDocument((document) => {
		if (!dirs.has(vscode.Uri.file(path.dirname(document.uri.fsPath)).toString())) {
			return;
		}

		if (last) {
			last.cancel();
			last.dispose();
		}

		last = new vscode.CancellationTokenSource();
		const own = last;
		const linked = token.onCancellationRequested(() => own.cancel());
		runTests(new vscode.TestRunRequest(request.include, request.exclude, request.profile, false), own.token).finally(() => linked.dispose());
	});
	const ended = token.onCancellationRequested(() => {
		saved.dispose();
		ended.dispose();
		if (last) {
			last.cancel();
			last.dispose();
		}
	});
}

// debugTests debugs the tests the request names, in the first package
// it names: the tests picked by -run, or the benchmarks by -bench, in a
// test program built for the debugger.
async function debugTests(request) {
	if (!trust.allowed()) {
		return;
	}

	const [dir, s] = [...tree.selectionsOf(roots(), request.include, request.exclude)][0] || [];
	if (dir === undefined) {
		return;
	}

	const names = [...s.tests];
	const args = s.all ? [] : names.length > 0 ? ["-run", pattern(names)] : ["-run", noTests, "-bench", pattern([...s.benchmarks])];
	const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(dir));
	await vscode.debug.startDebugging(folder, {
		type: command.debugType,
		request: "launch",
		name: `Debug ${names.length === 1 ? names[0] : path.basename(dir)}`,
		mode: "test",
		program: dir,
		args,
		cwd: dir,
	});
}

module.exports = { activate };
