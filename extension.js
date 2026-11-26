// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The extension: a client of Snello's language server, which every
// language feature is (client.js), the workspace's tests in the Testing
// view (tests.js), running a program (run.js) and debugging one, or a
// package's tests (debug.js). Each starts the snello command command.js
// finds; what each decides with no editor in it is in events.js,
// tree.js, launch.js and dap.js, which npm test tests.

"use strict";

const client = require("./client");
const debug = require("./debug");
const processes = require("./processes");
const run = require("./run");
const tests = require("./tests");

function activate(context) {
	debug.activate(context);
	run.activate(context);
	tests.activate(context);
	return client.activate(context);
}

// deactivate stops the server, and every test run, build and debugger
// still running, which are in process groups of their own and would
// outlive the window.
function deactivate() {
	processes.stopAll();
	return client.deactivate();
}

module.exports = { activate, deactivate };
