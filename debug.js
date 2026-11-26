// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Debugging a Snello program, or a package's tests, through the Debug
// Adapter Protocol. Each session builds the program for a debugger into
// a directory of its own, `snello build -debug -o`, or `snello test -c
// -debug -o` for tests, and starts the platform's debugger on it through
// its adapter: lldb-dap on macOS and Windows, found through xcrun or the
// PATH, and gdb's own adapter, `gdb -i dap`, on Linux, unless the
// setting snello.debugAdapterPath names one. The debugger first runs the
// setup `snello debug -setup` prints, which loads Snello's script, so
// that values show as the program writes them, and maps the standard
// library's sources. The extension relays the protocol between the
// editor and the adapter (dap.js), so that a restart builds the program
// again, and removes the build when the session ends.

"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vscode = require("vscode");
const command = require("./command");
const dap = require("./dap");
const launch = require("./launch");
const processes = require("./processes");

const adapterSetting = "debugAdapterPath";
const lldbAdapter = "lldb-dap";
const gdb = "gdb";
const lldb = "lldb";
const buildDirPrefix = "snello-debug-";
const openSettings = "Open Settings";

let output; // the builds' errors, shown when a build for the debugger fails

// activate registers the adapter of the snello debug type.
function activate(context) {
	output = vscode.window.createOutputChannel("Snello Debug");
	context.subscriptions.push(output, vscode.debug.registerDebugAdapterDescriptorFactory(command.debugType, { createDebugAdapterDescriptor }));
}

// ready reports whether a session can start: the snello command and a
// debugger are there, each said when it is not.
async function ready() {
	if (command.executable() === undefined) {
		missing("snello was not found; set snello.serverPath to the snello command's absolute path.", command.serverPathSetting);
		return false;
	}

	if ((await findAdapter()) === undefined) {
		const named = setting();
		missing(
			named !== ""
				? `snello.debugAdapterPath must be the absolute path of lldb-dap or gdb, and ${named} is not one that can be run.`
				: process.platform === "linux"
					? "no debugger was found: install gdb 14 or later, or set snello.debugAdapterPath to lldb-dap or gdb."
					: "no debugger was found: install lldb-dap, which LLVM and Xcode's command line tools ship, or set snello.debugAdapterPath to it.",
			adapterSetting,
		);
		return false;
	}

	return true;
}

// createDebugAdapterDescriptor builds the session's program for the
// debugger and starts the relay to its adapter; a build that fails ends
// the session, its errors in the Snello Debug output.
async function createDebugAdapterDescriptor(session) {
	const config = session.configuration;
	const snello = command.executable();
	const adapter = await findAdapter();
	if (snello === undefined || adapter === undefined) { // gone since the session was resolved
		throw new Error("the snello command or the debugger is no longer where the settings say");
	}

	const dir = fs.mkdtempSync(path.join(os.tmpdir(), buildDirPrefix));
	const binary = path.join(dir, launch.binaryName(config, process.platform));
	const name = path.basename(config.program);
	const built = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Building ${name} for the debugger` }, () =>
		runCommand(snello, launch.buildArgs(config, binary, command.backendArgs(config)), dir),
	);
	if (built.code !== 0) {
		removeBuild(dir);
		output.clear();
		output.append(built.stderr || built.stdout);
		output.show(true);
		throw new Error(`${name} did not build for the debugger; the Snello Debug output says why.`);
	}

	const setup = await runCommand(snello, ["debug", "-setup", adapter.gdb ? gdb : lldb], dir);
	if (setup.code !== 0) { // the session goes on, with values as the debugger shows them
		output.append(`snello debug -setup did not run, so values show without Snello's formatting:\n${setup.stderr}`);
	}

	const lines = setup.code === 0 ? setup.stdout.split("\n").filter((line) => line !== "") : [];
	const relay = new Relay(launch.adapterCommand(adapter, lines), config.cwd, launch.launchArguments(adapter, config, binary, lines), () => removeBuild(dir));
	return new vscode.DebugAdapterInlineImplementation(relay);
}

// removeBuild removes a session's build; one the system still holds, a
// binary Windows has not let go of, is left to the system's own clearing
// of its temporary files.
function removeBuild(dir) {
	try {
		fs.rmSync(dir, { recursive: true, force: true });
	} catch {
		// still in use
	}
}

// A Relay carries the protocol between the editor and the debugger's
// adapter, a process it starts in the program's directory, so that the
// program inherits it whether the adapter's launch takes one or not, and
// calls done once when the session is over. What the adapter writes to
// its standard error before it answers initialize, the words of one that
// cannot start, goes to the editor's debug console; after, to the Snello
// Debug output.
class Relay {
	constructor(adapter, cwd, launchArgs, done) {
		this.sent = new vscode.EventEmitter();
		this.onDidSendMessage = this.sent.event;
		this.launchArgs = launchArgs;
		this.finish = once(done);
		this.started = false;
		this.child = processes.spawn(adapter.command, adapter.args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
		const from = dap.reader((message) => {
			this.started = this.started || (message.type === "response" && message.command === "initialize");
			this.send(dap.toEditor(message));
		});
		this.child.stdout.on("data", (chunk) => from.feed(chunk));
		this.child.stderr.on("data", (chunk) => {
			if (this.started) {
				output.append(chunk.toString());
			} else {
				this.send({ seq: 0, type: "event", event: "output", body: { category: "stderr", output: chunk.toString() } });
			}
		});
		this.child.stdin.on("error", () => this.end()); // the adapter closed its input or ended: the session is over
		this.child.on("error", (err) => this.end(err.message));
		this.child.on("close", () => this.end()); // its output read to the end, its last messages sent before the session's end
	}

	handleMessage(message) {
		if (!this.ended && this.child.stdin.writable) {
			this.child.stdin.write(dap.framed(dap.toAdapter(message, this.launchArgs)));
		}
	}

	// send gives the editor a message, while the session is not over.
	send(message) {
		if (!this.disposed) {
			this.sent.fire(message);
		}
	}

	// end tells the editor, once, that the session is over, with why
	// when the adapter could not start.
	end(why) {
		if (this.ended) {
			return;
		}

		this.ended = true;
		if (why) {
			this.send({ seq: 0, type: "event", event: "output", body: { category: "stderr", output: `${why}\n` } });
		}

		this.send({ seq: 0, type: "event", event: "terminated" });
		if (this.child.closed) {
			this.finish();
		} else {
			this.child.once("close", this.finish);
		}
	}

	dispose() {
		this.disposed = true;
		this.ended = true;
		processes.stop(this.child);
		if (this.child.closed) {
			this.finish();
		} else {
			this.child.once("close", this.finish); // once the adapter and what it started have let go of the build
		}

		this.sent.dispose();
	}
}

// once returns f, called at most once.
function once(f) {
	let called = false;
	return () => {
		if (!called) {
			called = true;
			f();
		}
	};
}

// findAdapter returns the debugger's adapter to start, { path, gdb },
// or undefined when none is found: the setting's, an absolute path, else
// gdb on Linux and lldb-dap on macOS and Windows, each found as the
// platform finds it.
async function findAdapter() {
	const named = setting();
	if (named !== "") {
		return path.isAbsolute(named) && command.isExecutable(named) ? { path: named, gdb: path.basename(named).startsWith(gdb) } : undefined;
	}

	if (process.platform === "linux") {
		const found = command.onPath(gdb);
		if (found !== undefined) {
			return { path: found, gdb: true };
		}
	}

	if (process.platform === "darwin") {
		const xcrun = await runCommand("xcrun", ["-f", lldbAdapter], os.tmpdir());
		const found = xcrun.stdout.trim();
		if (xcrun.code === 0 && command.isExecutable(found)) {
			return { path: found, gdb: false };
		}
	}

	const found = command.onPath(process.platform === "win32" ? lldbAdapter + ".exe" : lldbAdapter);
	return found === undefined ? undefined : { path: found, gdb: false };
}

function setting() {
	return vscode.workspace.getConfiguration(command.section).get(adapterSetting, "").trim();
}

// missing says what a debug session needs and offers the setting that
// names it.
async function missing(text, settingName) {
	const choice = await vscode.window.showErrorMessage(`Snello: ${text}`, openSettings);
	if (choice === openSettings) {
		vscode.commands.executeCommand("workbench.action.openSettings", `${command.section}.${settingName}`);
	}
}

// runCommand runs name with args in cwd and resolves with its exit code
// and what it printed.
function runCommand(name, args, cwd) {
	return new Promise((resolve) => {
		childProcess.execFile(name, args, { cwd, maxBuffer: 16 << 20 }, (err, stdout, stderr) => {
			resolve({ code: err ? (typeof err.code === "number" ? err.code : 1) : 0, stdout: String(stdout), stderr: String(stderr || (err && !stdout ? err.message : "")) });
		});
	});
}

module.exports = { activate, ready };
