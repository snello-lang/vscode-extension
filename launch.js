// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The decisions of a launch, with no editor in them, so that npm test
// tests them: where a snello launch configuration's program and working
// directory are, the snello command that runs it, the one that builds it
// for the debugger, and what the debugger's adapter is started with and
// launched with. A configuration is { program, args, env, cwd, mode },
// mode "test" for the tests of the package in program.

"use strict";

const path = require("path");

const sourceExt = ".snello";
const testMode = "test";

// isTest reports whether the configuration runs a package's tests.
function isTest(config) {
	return config.mode === testMode;
}

// resolved returns the configuration with its program and its working
// directory absolute, a relative one taken from base, the workspace
// folder: the working directory the program's own when none is given,
// its directory, or the directory a program of one file is in.
function resolved(config, base) {
	const program = path.resolve(base, config.program);
	const cwd = config.cwd ? path.resolve(base, config.cwd) : program.endsWith(sourceExt) ? path.dirname(program) : program;
	return { ...config, program, cwd };
}

// runArgs are the arguments of the snello command that runs the
// configuration with no debugger: snello run, the program's own
// arguments after it, or snello test, its flags before the package.
function runArgs(config, backend) {
	const args = config.args || [];
	return isTest(config) ? ["test", ...backend, ...args, config.program] : ["run", ...backend, config.program, ...args];
}

// buildArgs are the arguments of the snello command that builds the
// configuration's program, or its tests, for the debugger, at binary.
function buildArgs(config, binary, backend) {
	return isTest(config)
		? ["test", "-c", "-debug", "-o", binary, ...backend, config.program]
		: ["build", "-debug", "-o", binary, ...backend, config.program];
}

// binaryName is the name of the binary buildArgs writes, for the
// system platform names.
function binaryName(config, platform) {
	const base = path.basename(config.program, sourceExt) + (isTest(config) ? ".test" : "");
	return platform === "win32" ? base + ".exe" : base;
}

// programArgs are what the built binary is run with: the
// configuration's arguments, after -v for a test program, so that its
// tests' results show.
function programArgs(config) {
	const args = config.args || [];
	return isTest(config) ? ["-v", ...args] : args;
}

// adapterCommand is the adapter to start, { command, args }: lldb-dap as
// it is, which reads the setup from the launch, or gdb's adapter with
// the setup run before it reads the protocol.
function adapterCommand(adapter, setup) {
	if (adapter.gdb) {
		return { command: adapter.path, args: ["-i", "dap", ...setup.flatMap((line) => ["-ex", line])] };
	}

	return { command: adapter.path, args: [] };
}

// launchArguments are the arguments of the adapter's launch request for
// the binary built from config: the environment as each adapter takes
// it, an object for gdb and a list of NAME=VALUE for lldb-dap, which
// also takes the setup as its init commands.
function launchArguments(adapter, config, binary, setup) {
	const env = config.env || {};
	const out = { program: binary, args: programArgs(config), cwd: config.cwd };
	if (adapter.gdb) {
		return { ...out, env };
	}

	return { ...out, env: Object.entries(env).map(([k, v]) => `${k}=${v}`), initCommands: setup };
}

module.exports = { resolved, runArgs, buildArgs, binaryName, adapterCommand, launchArguments };
