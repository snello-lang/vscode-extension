// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The relay's framing and rewrites, tested under Node's own runner.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const dap = require("../dap");

test("messages framed and read back whole, from pieces of any size", () => {
	const messages = [{ seq: 1, type: "request", command: "initialize" }, { seq: 2, type: "event", event: "output", body: { output: "é\n" } }];
	const stream = Buffer.concat(messages.map(dap.framed));
	for (const size of [1, 3, stream.length]) {
		const got = [];
		const r = dap.reader((m) => got.push(m));
		for (let i = 0; i < stream.length; i += size) {
			r.feed(stream.slice(i, i + size));
		}
		assert.deepEqual(got, messages, `pieces of ${size}`);
	}
});

test("the launch gets the adapter's arguments, other requests pass as they are", () => {
	const args = { program: "/t/p" };
	assert.deepEqual(dap.toAdapter({ seq: 3, type: "request", command: "launch", arguments: { program: "/w/p", type: "snello" } }, args).arguments, args);
	const next = { seq: 4, type: "request", command: "next", arguments: { threadId: 1 } };
	assert.equal(dap.toAdapter(next, args), next);
});

test("the adapter cannot restart a session itself, so the editor starts one that builds again", () => {
	const answer = { type: "response", command: "initialize", body: { supportsRestartRequest: true, supportsConfigurationDoneRequest: true } };
	assert.deepEqual(dap.toEditor(answer).body, { supportsRestartRequest: false, supportsConfigurationDoneRequest: true });
	const other = { type: "response", command: "threads", body: {} };
	assert.equal(dap.toEditor(other), other);
});

test("a body that is no message is passed over, and the messages after it read", () => {
	const got = [];
	const r = dap.reader((m) => got.push(m));
	r.feed(Buffer.concat([Buffer.from("Content-Length: 3\r\n\r\n{x}", "ascii"), dap.framed({ seq: 1, type: "event", event: "initialized" })]));
	assert.deepEqual(got, [{ seq: 1, type: "event", event: "initialized" }]);
});
