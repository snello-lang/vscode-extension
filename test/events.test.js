// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The reading of `snello test -json`'s events, tested under Node's own
// runner: node --test.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { reader, pattern, parentOf } = require("../events");

// record feeds stream to a reader, in pieces of size bytes when size is
// given, and returns what it reported, one entry a call.
function record(stream, size) {
	const calls = [];
	const handlers = {};
	for (const name of ["started", "passed", "failed", "skipped", "output", "benchmarked", "packageFailed"]) {
		handlers[name] = (...args) => calls.push([name, ...args]);
	}

	const r = reader(handlers);
	if (size === undefined) {
		r.feed(stream);
	} else {
		for (let i = 0; i < stream.length; i += size) {
			r.feed(stream.slice(i, i + size));
		}
	}

	r.end();
	return calls.filter((c) => c[0] !== "output");
}

// events writes each event as a line of the stream.
function events(...list) {
	return list.map((ev) => JSON.stringify({ Package: "p", ...ev })).join("\n") + "\n";
}

test("a pass and a subtest, in milliseconds", () => {
	const stream = events(
		{ Action: "start" },
		{ Action: "run", Test: "TestPass" },
		{ Action: "run", Test: "TestPass/one" },
		{ Action: "pass", Test: "TestPass/one" },
		{ Action: "pass", Test: "TestPass", Elapsed: 0.012 },
		{ Action: "pass", Elapsed: 0.02 },
	);
	assert.deepEqual(record(stream), [
		["started", "TestPass"],
		["started", "TestPass/one"],
		["passed", "TestPass/one", undefined],
		["passed", "TestPass", 12],
	]);
});

test("a failure is given with its test's result, with its place and values", () => {
	const stream = events(
		{ Action: "run", Test: "TestArea" },
		{ Action: "failure", Test: "TestArea", File: "/m/p/p_test.snello", Line: 29, Message: "expect.Equal(ref Area(), ref 7.0)", Got: "6", Want: "7" },
		{ Action: "fail", Test: "TestArea" },
		{ Action: "fail" },
	);
	assert.deepEqual(record(stream), [
		["started", "TestArea"],
		["failed", "TestArea", undefined, [{ file: "/m/p/p_test.snello", line: 29, message: "expect.Equal(ref Area(), ref 7.0)", got: "6", want: "7" }]],
	]);
});

test("a skip and a benchmark", () => {
	const stream = events(
		{ Action: "run", Test: "TestSkip" },
		{ Action: "skip", Test: "TestSkip" },
		{ Action: "bench", Test: "BenchmarkTwo", Output: "BenchmarkTwo  100  10 ns/op\n" },
	);
	assert.deepEqual(record(stream), [
		["started", "TestSkip"],
		["skipped", "TestSkip"],
		["benchmarked", "BenchmarkTwo", "BenchmarkTwo  100  10 ns/op\n"],
	]);
});

test("a package that does not build fails with its lines", () => {
	const stream = events(
		{ Action: "start" },
		{ Action: "output", Output: "p/p.snello:3:25: cannot use a value of type string as int in return\n" },
		{ Action: "fail", Elapsed: 0.01 },
	);
	assert.deepEqual(record(stream), [["packageFailed", ["p/p.snello:3:25: cannot use a value of type string as int in return"]]]);
});

test("a package whose test failed is not failed again on its own", () => {
	const stream = events({ Action: "run", Test: "TestA" }, { Action: "fail", Test: "TestA" }, { Action: "fail" });
	assert.deepEqual(record(stream), [
		["started", "TestA"],
		["failed", "TestA", undefined, []],
	]);
});

test("a stream read a few bytes at a time", () => {
	const stream = events({ Action: "run", Test: "TestA" }, { Action: "pass", Test: "TestA", Elapsed: 0.5 });
	assert.deepEqual(record(stream, 3), record(stream));
});

test("the pattern of one test and of several, and a subtest's parent", () => {
	assert.equal(pattern(["TestArea"]), "^TestArea$");
	assert.equal(pattern(["TestA", "TestB"]), "^(TestA|TestB)$");
	assert.equal(parentOf("TestFields/runs"), "TestFields");
	assert.equal(parentOf("TestFields/runs/fast"), "TestFields/runs");
	assert.equal(parentOf("TestFields"), undefined);
});

test("a line that is no event, null among them, is output", () => {
	const calls = [];
	const r = reader({ output: (t, text) => calls.push([t, text]), started() {}, passed() {}, failed() {}, skipped() {}, benchmarked() {}, packageFailed() {} });
	r.feed('null\n{"Action":"output","Package":"p"}\nnot json\n');
	r.end();
	assert.deepEqual(calls, [[undefined, "null\n"], [undefined, ""], [undefined, "not json\n"]]);
});

test("a package skipped as a whole skips no test", () => {
	assert.deepEqual(record(events({ Action: "start" }, { Action: "skip" })), []);
});
