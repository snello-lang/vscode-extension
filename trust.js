// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// What runs a folder's code, a program, its tests or a debugger, runs
// only in a trusted workspace: in Restricted Mode the folder could hold
// anything, and running it is what the mode is there to prevent.

"use strict";

const vscode = require("vscode");

const manageTrust = "Manage Workspace Trust";

let told = false; // the refusal is said once a session

// allowed reports whether the workspace is trusted, and says once why
// nothing runs when it is not.
function allowed() {
	if (vscode.workspace.isTrusted) {
		return true;
	}

	if (!told) {
		told = true;
		vscode.window.showWarningMessage("Snello: programs and tests run only in a trusted workspace.", manageTrust).then((choice) => {
			if (choice === manageTrust) {
				vscode.commands.executeCommand("workbench.trust.manage");
			}
		});
	}

	return false;
}

module.exports = { allowed };
