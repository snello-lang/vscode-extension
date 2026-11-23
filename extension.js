// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The extension is a client of Snello's language server, `snello lsp`:
// it starts the server once for the window, the first time a Snello
// file opens, and stops it when the window closes. Every feature is the
// server's; the client only carries the editor's requests to it.

"use strict";

const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const { LanguageClient } = require("vscode-languageclient/node");

const section = "snello";
const serverPathSetting = "serverPath";
const command = process.platform === "win32" ? "snello.exe" : "snello";
const serverArgs = ["lsp"];
const languageId = "snello";
const clientName = "Snello";
const openSettings = "Open Settings";

let client; // the running client, set once its start has succeeded
let output; // the server's log, one for every start in the window
let reportedFor; // the setting's value the last report was about
let queue = Promise.resolve(); // every start and stop, one after another

// activate starts the server, and starts it again with a new command
// when the setting that names it changes.
function activate(context) {
	output = vscode.window.createOutputChannel(clientName);
	context.subscriptions.push(
		output,
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration(`${section}.${serverPathSetting}`)) {
				enqueue(async () => {
					await stop();
					await start();
				});
			}
		}),
	);

	return enqueue(start);
}

function deactivate() {
	return enqueue(stop);
}

// enqueue runs step after every step before it, so that a stop never
// meets a client still starting, and a failure ends only its own step.
function enqueue(step) {
	queue = queue.then(step).catch(() => {});
	return queue;
}

// start starts the server from the command the setting names, or from
// snello on the PATH; a command not found is reported once for each
// value of the setting.
async function start() {
	const setting = serverSetting();
	const executable = setting === "" ? onPath() : setting;
	if (executable === undefined || !path.isAbsolute(executable) || !isExecutable(executable)) {
		report(setting);
		return;
	}

	const serverOptions = { command: executable, args: serverArgs };
	const clientOptions = {
		documentSelector: [{ scheme: "file", language: languageId }],
		outputChannel: output,
	};
	const created = new LanguageClient(languageId, clientName, serverOptions, clientOptions);
	await created.start(); // a failure is the client's to report, with the server's own words in its output
	client = created;
	reportedFor = undefined; // a command lost again is reported again
}

async function stop() {
	if (client === undefined) {
		return;
	}

	const running = client;
	client = undefined;
	await running.stop();
}

function serverSetting() {
	return vscode.workspace.getConfiguration(section).get(serverPathSetting, "").trim();
}

// onPath returns the first snello on the PATH that may be run, in a
// directory the PATH names by its absolute path.
function onPath() {
	for (const entry of (process.env.PATH || "").split(path.delimiter)) {
		const dir = entry.replace(/^"(.*)"$/, "$1");
		if (!path.isAbsolute(dir)) {
			continue;
		}

		const candidate = path.join(dir, command);
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

// report says that the server was not found, once for each value of
// the setting, and offers the setting that names it.
async function report(setting) {
	if (reportedFor === setting) {
		return;
	}

	reportedFor = setting;
	const message =
		setting === ""
			? "Snello: snello was not found on the PATH. Install Snello, or set snello.serverPath to the snello command's absolute path."
			: `Snello: snello.serverPath must be the absolute path of the snello command, and ${setting} is not one that can be run.`;
	const choice = await vscode.window.showErrorMessage(message, openSettings);
	if (choice === openSettings) {
		vscode.commands.executeCommand("workbench.action.openSettings", `${section}.${serverPathSetting}`);
	}
}

module.exports = { activate, deactivate };
