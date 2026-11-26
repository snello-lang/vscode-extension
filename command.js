// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Where the snello command is: the absolute path the setting
// snello.serverPath names, or the first snello on the PATH. The language
// server, the runs, the tests and the debugger all start it from here.

"use strict";

const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

const section = "snello";
const serverPathSetting = "serverPath";
const backendSetting = "backend";
const languageId = "snello"; // the language of .snello files
const debugType = "snello"; // the launch configurations' type
const command = process.platform === "win32" ? "snello.exe" : "snello";

// setting is the value of snello.serverPath, trimmed.
function setting() {
	return vscode.workspace.getConfiguration(section).get(serverPathSetting, "").trim();
}

// executable returns the snello command to run, or undefined when the
// setting names none that can be run, or the PATH holds none.
function executable() {
	const named = setting();
	const found = named === "" ? onPath(command) : named;
	if (found === undefined || !path.isAbsolute(found) || !isExecutable(found)) {
		return undefined;
	}

	return found;
}

// onPath returns the first file named name on the PATH that may be run,
// in a directory the PATH names by its absolute path.
function onPath(name) {
	for (const entry of (process.env.PATH || "").split(path.delimiter)) {
		const dir = entry.replace(/^"(.*)"$/, "$1");
		if (!path.isAbsolute(dir)) {
			continue;
		}

		const candidate = path.join(dir, name);
		if (isExecutable(candidate)) {
			return candidate;
		}
	}

	return undefined;
}

// isExecutable reports whether name is a file this process may run.
function isExecutable(name) {
	try {
		if (!fs.statSync(name).isFile()) {
			return false;
		}

		if (process.platform !== "win32") {
			fs.accessSync(name, fs.constants.X_OK);
		}

		return true;
	} catch {
		return false;
	}
}

// backendArgs is the -backend flag a run, a test or a build is given:
// the configuration's backend, or the setting snello.backend's, or none
// for the command's own default.
function backendArgs(config) {
	const backend = (config && config.backend) || vscode.workspace.getConfiguration(section).get(backendSetting, "");
	return backend ? ["-backend", backend] : [];
}

module.exports = { section, serverPathSetting, languageId, debugType, setting, executable, onPath, isExecutable, backendArgs };
