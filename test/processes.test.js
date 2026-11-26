// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Stopping a process tree, tested under Node's own runner where the
// system has process groups.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const processes = require("../processes");

// alive reports whether the process pid is still running.
function alive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

test("a stop ends a child that ignores the termination, after its parent has ended", { skip: process.platform === "win32" }, async () => {
	// The parent starts a child that ignores a termination, prints its
	// pid and ends at the termination itself, as snello does while the
	// program it runs goes on.
	const parent = processes.spawn("sh", ["-c", "sh -c 'trap \"\" TERM; while :; do sleep 0.1; done' & echo $!; trap 'exit 0' TERM; wait"], { stdio: ["ignore", "pipe", "ignore"] });
	const pid = await new Promise((resolve) => parent.stdout.once("data", (d) => resolve(Number(String(d).trim()))));
	assert.ok(alive(pid));
	processes.stop(parent);
	await new Promise((resolve) => setTimeout(resolve, 4000)); // past the grace period before the kill
	assert.equal(alive(pid), false, "the child outlived the stop");
});
