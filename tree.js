// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The decisions of the Testing view, over plain objects and with no
// editor in them, so that npm test tests them: what a run asks of each
// package, which tests a run enqueues, and how the tree's tests follow
// what the language server finds. An item is { id, snello, children },
// snello saying what it is: { kind, dir, name } for a test, a benchmark
// and an example, { kind: "subtest", dir, name, test } for a subtest, its
// test the item it is under, and { kind: "package", dir } for a package;
// children has forEach.

"use strict";

const KIND = {
	main: "main",
	file: "file",
	package: "package",
	test: "test",
	benchmark: "benchmark",
	example: "example",
	subtest: "subtest",
};

// selectionsOf returns, by package directory, what a run of the items
// include asks, or of roots when include is undefined, leaving out the
// items exclude names by id: { all, tests, benchmarks }, all for a
// package run whole, tests the names of the tests and examples to pick
// by -run, and benchmarks those to pick by -bench. A benchmark runs only
// when it is asked for by itself, as snello test runs one only under
// -bench; a subtest runs with its test, which -run picks.
function selectionsOf(roots, include, exclude) {
	const excluded = new Set((exclude || []).map((item) => item.id));
	const byDir = new Map();
	const selection = (dir) => {
		if (!byDir.has(dir)) {
			byDir.set(dir, { all: false, tests: new Set(), benchmarks: new Set() });
		}

		return byDir.get(dir);
	};

	const visit = (item, chosen) => {
		if (excluded.has(item.id)) {
			return;
		}

		const s = item.snello;
		switch (s && s.kind) {
			case KIND.package:
				if (!hasExcluded(item, excluded)) {
					selection(s.dir).all = true;
					return;
				}
				break;
			case KIND.test:
			case KIND.example:
				selection(s.dir).tests.add(s.name);
				return;
			case KIND.benchmark:
				if (chosen) {
					selection(s.dir).benchmarks.add(s.name);
				}
				return;
			case KIND.subtest:
				selection(s.dir).tests.add(s.test.snello.name);
				return;
		}

		item.children.forEach((child) => visit(child, false));
	};

	for (const item of include || roots) {
		visit(item, true);
	}

	return byDir;
}

// hasExcluded reports whether an item under item is excluded, so that
// the package is not run whole.
function hasExcluded(item, excluded) {
	let found = false;
	item.children.forEach((child) => {
		found = found || excluded.has(child.id) || hasExcluded(child, excluded);
	});
	return found;
}

// enqueuedOf returns the tests of a package, a map of name to item, that
// a run with selection s runs: every test and example for a package run
// whole, and those it names otherwise.
function enqueuedOf(tests, s) {
	const out = [];
	for (const [name, test] of tests) {
		const kind = test.snello.kind;
		if (s.all ? kind === KIND.test || kind === KIND.example : s.tests.has(name) || s.benchmarks.has(name)) {
			out.push(test);
		}
	}

	return out;
}

// staleOf returns the names of a package's tests, a map of name to item
// holding tests, benchmarks and examples but no subtest, that what the
// server now finds, the set kept, no longer has.
function staleOf(tests, kept) {
	const out = [];
	for (const name of tests.keys()) {
		if (!kept.has(name)) {
			out.push(name);
		}
	}

	return out;
}

// subtestsOf returns the names of the subtests, keys of the map
// subtests, that are under the test named name, at any depth.
function subtestsOf(subtests, name) {
	const prefix = name + "/";
	return [...subtests.keys()].filter((key) => key.startsWith(prefix));
}

module.exports = { KIND, selectionsOf, enqueuedOf, staleOf, subtestsOf };
