// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The Testing view's decisions, tested under Node's own runner.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { selectionsOf, enqueuedOf, staleOf, subtestsOf } = require("../tree");

// item makes an item of the tree, with children.
function item(id, snello, ...children) {
	return { id, snello, children: { forEach: (f) => children.forEach(f) } };
}

const area = item("p TestArea", { kind: "test", dir: "/p", name: "TestArea" });
const large = item("p TestLargest", { kind: "test", dir: "/p", name: "TestLargest" });
const describe = item("p ExampleDescribe", { kind: "example", dir: "/p", name: "ExampleDescribe" });
const bench = item("p BenchmarkArea", { kind: "benchmark", dir: "/p", name: "BenchmarkArea" });
const sub = item("p TestArea/round", { kind: "subtest", dir: "/p", name: "TestArea/round", test: area });
const file = item("file://p/p_test.snello", { kind: "file", dir: "/p" }, area, large, describe, bench);
const pkg = item("/p", { kind: "package", dir: "/p" }, file);
const other = item("/q", { kind: "package", dir: "/q" });

// plain writes a selection's sets as sorted lists.
function plain(selections) {
	const out = {};
	for (const [dir, s] of selections) {
		out[dir] = { all: s.all, tests: [...s.tests].sort(), benchmarks: [...s.benchmarks].sort() };
	}
	return out;
}

test("every package is run whole when the run names nothing", () => {
	assert.deepEqual(plain(selectionsOf([pkg, other])), {
		"/p": { all: true, tests: [], benchmarks: [] },
		"/q": { all: true, tests: [], benchmarks: [] },
	});
});

test("a file runs its tests and examples by name, not its benchmarks", () => {
	assert.deepEqual(plain(selectionsOf([pkg], [file])), { "/p": { all: false, tests: ["ExampleDescribe", "TestArea", "TestLargest"], benchmarks: [] } });
});

test("a benchmark runs when it is asked for by itself", () => {
	assert.deepEqual(plain(selectionsOf([pkg], [bench])), { "/p": { all: false, tests: [], benchmarks: ["BenchmarkArea"] } });
});

test("a subtest runs with its test", () => {
	assert.deepEqual(plain(selectionsOf([pkg], [sub])), { "/p": { all: false, tests: ["TestArea"], benchmarks: [] } });
});

test("a package with an exclusion runs the rest by name", () => {
	assert.deepEqual(plain(selectionsOf([pkg], [pkg], [large])), { "/p": { all: false, tests: ["ExampleDescribe", "TestArea"], benchmarks: [] } });
});

test("a run whole enqueues the tests and examples, a run by name those it names", () => {
	const tests = new Map([["TestArea", area], ["TestLargest", large], ["ExampleDescribe", describe], ["BenchmarkArea", bench]]);
	assert.deepEqual(enqueuedOf(tests, { all: true, tests: new Set(), benchmarks: new Set() }), [area, large, describe]);
	assert.deepEqual(enqueuedOf(tests, { all: false, tests: new Set(["TestLargest"]), benchmarks: new Set(["BenchmarkArea"]) }), [large, bench]);
});

test("what the server no longer finds is stale; a subtest goes with its test", () => {
	const tests = new Map([["TestArea", area], ["TestLargest", large]]);
	assert.deepEqual(staleOf(tests, new Set(["TestArea"])), ["TestLargest"]);
	const subtests = new Map([["TestArea/round", sub], ["TestArea/round/fast", sub], ["TestAreaBig/x", sub]]);
	assert.deepEqual(subtestsOf(subtests, "TestArea"), ["TestArea/round", "TestArea/round/fast"]);
});
