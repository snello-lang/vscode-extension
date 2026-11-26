// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The events of `snello test -json`, one JSON object a line, read as a
// run goes and turned into what a run of tests reports: a test begun,
// passed, failed with its failures, or skipped, the lines it printed,
// a benchmark's result, and a package that failed with no test to show
// it on. It knows nothing of the editor, so its tests run under Node.

"use strict";

const ACTION = {
	start: "start",
	run: "run",
	pass: "pass",
	fail: "fail",
	skip: "skip",
	output: "output",
	bench: "bench",
	failure: "failure",
};

// reader returns what is fed the output of one run of `snello test
// -json`, as it is written, and calls on the handlers what each event
// says:
//
//   started(test)                      a test, a subtest or an example began
//   passed(test, elapsed)              it passed, elapsed in milliseconds
//   failed(test, elapsed, failures)    it failed, with its failed checks
//   skipped(test)                      it was skipped
//   output(test, text)                 a line the run printed, test undefined for the package's
//   benchmarked(test, text)            a benchmark's result line
//   packageFailed(lines)               the package failed with no test failed, a build's error
//
// A failure is { file, line, message, got, want }, file and line
// undefined for one placed nowhere, got and want for one that compared
// no two values.
function reader(handlers) {
	let partial = "";
	const failures = new Map(); // by test, the failures read before its result
	let failedTests = 0;
	const packageLines = [];

	function event(ev) {
		const test = ev.Test;
		switch (ev.Action) {
			case ACTION.run:
				handlers.started(test);
				break;
			case ACTION.pass:
				if (test) {
					handlers.passed(test, milliseconds(ev.Elapsed));
				}
				break;
			case ACTION.skip:
				if (test) { // a package with no test is skipped as a whole: no test to show it on
					handlers.skipped(test);
				}
				break;
			case ACTION.failure:
				if (!failures.has(test)) {
					failures.set(test, []);
				}
				failures.get(test).push({
					file: ev.File,
					line: ev.Line,
					message: ev.Message || "",
					got: ev.Got,
					want: ev.Want,
				});
				break;
			case ACTION.fail:
				if (test) {
					failedTests++;
					handlers.failed(test, milliseconds(ev.Elapsed), failures.get(test) || []);
					failures.delete(test);
				} else if (failedTests === 0) {
					handlers.packageFailed(packageLines.slice());
				}
				break;
			case ACTION.output: {
				const text = ev.Output || "";
				if (!test) {
					packageLines.push(text.replace(/\n$/, ""));
				}
				handlers.output(test, text);
				break;
			}
			case ACTION.bench:
				handlers.benchmarked(test, ev.Output || "");
				break;
		}
	}

	function line(text) {
		if (text.trim() === "") {
			return;
		}

		let ev;
		try {
			ev = JSON.parse(text);
		} catch {
			ev = undefined;
		}

		if (ev === null || typeof ev !== "object" || typeof ev.Action !== "string") {
			handlers.output(undefined, text + "\n"); // a line that is no event, shown as it is
			return;
		}

		event(ev);
	}

	return {
		feed(chunk) {
			partial += chunk;
			let i;
			while ((i = partial.indexOf("\n")) >= 0) {
				line(partial.slice(0, i));
				partial = partial.slice(i + 1);
			}
		},
		end() {
			if (partial !== "") {
				line(partial);
				partial = "";
			}
		},
	};
}

// milliseconds is a time in seconds, as the events give it, in
// milliseconds, as an editor reports it; undefined for none.
function milliseconds(seconds) {
	return seconds === undefined ? undefined : Math.round(seconds * 1000);
}

// pattern is the value of -run that runs the tests named, each by its
// whole name: ^Name$ for one, ^(A|B)$ for several.
function pattern(names) {
	return names.length === 1 ? `^${names[0]}$` : `^(${names.join("|")})$`;
}

// parentOf is the test a subtest is of, TestFields of TestFields/runs,
// and undefined for a test that is no subtest.
function parentOf(name) {
	const i = name.lastIndexOf("/");
	return i < 0 ? undefined : name.slice(0, i);
}

module.exports = { reader, pattern, parentOf };
