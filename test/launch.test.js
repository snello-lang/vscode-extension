// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// A launch's decisions, tested under Node's own runner.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const launch = require("../launch");

const base = path.resolve("/work");

test("a relative program and directory are the folder's", () => {
	assert.deepEqual(launch.resolved({ program: "shapes" }, base), { program: path.join(base, "shapes"), cwd: path.join(base, "shapes") });
	assert.deepEqual(launch.resolved({ program: "tree/tree-arena.snello", cwd: "data" }, base), { program: path.join(base, "tree/tree-arena.snello"), cwd: path.join(base, "data") });
	assert.equal(launch.resolved({ program: "tree/tree-arena.snello" }, base).cwd, path.join(base, "tree"));
});

test("a program runs by snello run, its arguments after it; tests by snello test, flags before", () => {
	assert.deepEqual(launch.runArgs({ program: "/w/p", args: ["-v", "x"] }, ["-backend", "c"]), ["run", "-backend", "c", "/w/p", "-v", "x"]);
	assert.deepEqual(launch.runArgs({ program: "/w/p", mode: "test", args: ["-run", "^TestA$"] }, []), ["test", "-run", "^TestA$", "/w/p"]);
});

test("a build for the debugger, and the binary's name", () => {
	assert.deepEqual(launch.buildArgs({ program: "/w/p" }, "/t/p", []), ["build", "-debug", "-o", "/t/p", "/w/p"]);
	assert.deepEqual(launch.buildArgs({ program: "/w/p", mode: "test" }, "/t/p.test", ["-backend", "c"]), ["test", "-c", "-debug", "-o", "/t/p.test", "-backend", "c", "/w/p"]);
	assert.equal(launch.binaryName({ program: "/w/tree-arena.snello" }, "darwin"), "tree-arena");
	assert.equal(launch.binaryName({ program: "/w/p", mode: "test" }, "win32"), "p.test.exe");
});

test("each adapter is started and launched as it takes it", () => {
	const setup = ["command one", "command two"];
	assert.deepEqual(launch.adapterCommand({ path: "/usr/bin/gdb", gdb: true }, setup), { command: "/usr/bin/gdb", args: ["-i", "dap", "-ex", "command one", "-ex", "command two"] });
	assert.deepEqual(launch.adapterCommand({ path: "/x/lldb-dap", gdb: false }, setup), { command: "/x/lldb-dap", args: [] });
	const config = { program: "/w/p", mode: "test", args: ["-run", "^TestA$"], env: { A: "1" }, cwd: "/w/p" };
	assert.deepEqual(launch.launchArguments({ gdb: true }, config, "/t/p.test", setup), { program: "/t/p.test", args: ["-v", "-run", "^TestA$"], cwd: "/w/p", env: { A: "1" } });
	assert.deepEqual(launch.launchArguments({ gdb: false }, config, "/t/p.test", setup), { program: "/t/p.test", args: ["-v", "-run", "^TestA$"], cwd: "/w/p", env: ["A=1"], initCommands: setup });
});
