// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The client of Snello's language server, `snello lsp`: it starts the
// server once for the window, the first time a Snello file opens or the
// workspace holds one, stops it when the window closes, and starts it
// again with a new command when the setting that names it changes.
// Every feature of the editor's is the server's; the client carries the
// editor's requests to it, and asks it for what can be run.

"use strict";

const vscode = require("vscode");
const { LanguageClient } = require("vscode-languageclient/node");
const command = require("./command");

const serverArgs = ["lsp"];
const clientName = "Snello";
const openSettings = "Open Settings";
const runnablesMethod = "snello/runnables";
const restartCommand = "snello.restartServer";

let client; // the running client, set once its start has succeeded
let output; // the server's log, one for every start in the window: a log channel, whose level the client follows
let reportedFor; // the setting's value the last report was about
let queue = Promise.resolve(); // every start and stop, one after another
const started = new vscode.EventEmitter(); // fires once a start has succeeded

// activate starts the server, and starts it again with a new command
// when the setting that names it changes.
function activate(context) {
	output = vscode.window.createOutputChannel(clientName, { log: true });
	context.subscriptions.push(
		output,
		started,
		vscode.commands.registerCommand(restartCommand, () =>
			enqueue(async () => {
				await stop();
				await start();
			}),
		),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration(`${command.section}.${command.serverPathSetting}`)) {
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
	const executable = command.executable();
	if (executable === undefined) {
		report(command.setting());
		return;
	}

	const serverOptions = { command: executable, args: serverArgs };
	const clientOptions = {
		documentSelector: [{ scheme: "file", language: command.languageId }],
		outputChannel: output,
	};
	const created = new LanguageClient(command.languageId, clientName, serverOptions, clientOptions);
	await created.start(); // a failure is the client's to report, with the server's own words in its output
	client = created;
	reportedFor = undefined; // a command lost again is reported again
	started.fire();
}

async function stop() {
	if (client === undefined) {
		return;
	}

	const running = client;
	client = undefined;
	await running.stop();
}

// runnables asks the server for the programs and tests of the document
// uri, or of the whole workspace when uri is undefined; undefined when
// the server is not running or could not answer, which is not an answer
// of none.
async function runnables(uri) {
	if (client === undefined) {
		return undefined;
	}

	const params = uri === undefined ? {} : { textDocument: { uri: uri.toString() } };
	try {
		return (await client.sendRequest(runnablesMethod, params)) || [];
	} catch {
		return undefined;
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
		vscode.commands.executeCommand("workbench.action.openSettings", `${command.section}.${command.serverPathSetting}`);
	}
}

module.exports = { activate, deactivate, runnables, onStarted: started.event };
