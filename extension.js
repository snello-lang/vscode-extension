// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The extension: a client of Snello's language server, which every
// language feature is (client.js), and the workspace's tests in the
// Testing view (tests.js). Each starts the snello command command.js
// finds; what each decides with no editor in it is in events.js and
// tree.js, which npm test tests.

"use strict";

const client = require("./client");
const processes = require("./processes");
const tests = require("./tests");

function activate(context) {
	tests.activate(context);
	return client.activate(context);
}

// deactivate stops the server, and every test run still running, which are in process groups of their own and would
// outlive the window.
function deactivate() {
	processes.stopAll();
	return client.deactivate();
}

module.exports = { activate, deactivate };
