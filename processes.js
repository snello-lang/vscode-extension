// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Starting the snello command so that it can be stopped whole: on Linux
// and macOS in a process group of its own, which a stop asks to end with
// a termination and, after a grace period, ends with a kill whether or
// not the command itself has ended by then, since a Snello program
// treats a termination as a cancellation, which a loop that never waits
// does not see; on Windows by taskkill over the tree. A stop then ends
// what the command started too: the compiler and the linker of a build,
// and the program it runs. Every process started here is kept until its
// output closes, so that the extension's end stops what is still
// running.

"use strict";

const childProcess = require("child_process");
const path = require("path");

const graceMilliseconds = 3000; // how long a termination has before the kill
const live = new Set(); // the processes started whose output has not closed

// spawn starts name with args as childProcess.spawn does, in a process
// group of its own where the system has them, and keeps it until its
// output closes.
function spawn(name, args, options) {
	const child = childProcess.spawn(name, args, { ...options, detached: process.platform !== "win32" });
	live.add(child);
	child.once("close", () => {
		child.closed = true;
		live.delete(child);
	});
	child.once("error", () => live.delete(child));
	return child;
}

// stop ends child and every process it started: a termination to its
// group, then a kill to the group once the grace period is over, which
// reaches a process the command started even when the command has
// ended; on Windows, taskkill over its tree at once. A child whose
// output has closed is stopped already.
function stop(child) {
	if (child.closed || child.pid === undefined) {
		return;
	}

	if (process.platform === "win32") {
		const taskkill = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe");
		childProcess.execFile(taskkill, ["/T", "/F", "/PID", String(child.pid)], () => {});
		return;
	}

	signalGroup(child.pid, "SIGTERM");
	setTimeout(() => signalGroup(child.pid, "SIGKILL"), graceMilliseconds).unref();
}

// stopAll stops every process still running, as the extension ends.
function stopAll() {
	for (const child of live) {
		stop(child);
	}
}

// signalGroup sends signal to the process group whose leader is pid, as
// a negative pid names it.
function signalGroup(pid, signal) {
	try {
		process.kill(-pid, signal);
	} catch {
		// the group has ended already
	}
}

module.exports = { spawn, stop, stopAll };
