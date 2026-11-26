// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Running a Snello program from the editor: a Run and a Debug lens above
// each func main, from the language server's runnables; the debug
// configuration type snello, which launch.json, F5 and Run Without
// Debugging use; and the command Snello: Run Program. A program runs in
// the integrated terminal as `snello run`, so that it reads the
// terminal's input and Ctrl-C stops it, and a configuration of a
// package's tests as `snello test`. Debugging is debug.js's.

"use strict";

const path = require("path");
const vscode = require("vscode");
const client = require("./client");
const command = require("./command");
const debug = require("./debug");
const launch = require("./launch");
const tree = require("./tree");
const trust = require("./trust");

const taskSource = "snello";
const runCommand = "snello.runProgram";
const runAtCommand = "snello.runAt";
const debugAtCommand = "snello.debugAt";
const programName = "Launch program";

// activate registers the lens, the commands and the debug type's
// configurations: one provider resolves them, and another offers one
// for the open program in the Run and Debug view's list, since every
// provider of a type resolves each configuration in turn.
function activate(context) {
	const lenses = new Lenses();
	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider({ language: command.languageId, scheme: "file" }, lenses),
		client.onStarted(() => lenses.refresh()),
		vscode.workspace.onDidSaveTextDocument(() => lenses.refresh()),
		vscode.commands.registerCommand(runCommand, runOpenProgram),
		vscode.commands.registerCommand(runAtCommand, (program) => runProgram({ name: `Run ${path.basename(program)}`, program })),
		vscode.commands.registerCommand(debugAtCommand, (program) => debugProgram(program)),
		vscode.debug.registerDebugConfigurationProvider(command.debugType, new Configurations()),
		vscode.debug.registerDebugConfigurationProvider(command.debugType, { provideDebugConfigurations }, vscode.DebugConfigurationProviderTriggerKind.Dynamic),
	);
}

// A Lenses puts a Run and a Debug lens above each func main the
// language server finds in a document.
class Lenses {
	constructor() {
		this.changed = new vscode.EventEmitter();
		this.onDidChangeCodeLenses = this.changed.event;
	}

	refresh() {
		this.changed.fire();
	}

	async provideCodeLenses(document) {
		const lenses = [];
		for (const r of (await client.runnables(document.uri)) || []) {
			if (r.kind !== tree.KIND.main) {
				continue;
			}

			const program = r.args[r.args.length - 1];
			const at = new vscode.Range(r.selectionRange.start.line, 0, r.selectionRange.start.line, 0);
			lenses.push(
				new vscode.CodeLens(at, { title: "$(play) Run", command: runAtCommand, arguments: [program] }),
				new vscode.CodeLens(at, { title: "$(debug-alt) Debug", command: debugAtCommand, arguments: [program] }),
			);
		}

		return lenses;
	}
}

// provideDebugConfigurations offers a configuration of the open program,
// for a new launch.json and for the Run and Debug view's list.
async function provideDebugConfigurations(folder) {
	const program = await openProgram();
	return [launchOf(program === undefined ? "${fileDirname}" : relativeTo(folder, program), programName)];
}

// A Configurations fills the configuration an F5 with no launch.json
// starts, and runs or debugs the one resolved.
class Configurations {
	provideDebugConfigurations(folder) {
		return provideDebugConfigurations(folder);
	}

	async resolveDebugConfiguration(folder, config) {
		if (!config.type && !config.request && !config.name) { // F5 with no launch.json: the open program
			const program = await openProgram();
			if (program === undefined) {
				vscode.window.showInformationMessage("Snello: open a file of the program to run, or add a snello configuration to launch.json.");
				return undefined;
			}

			return { ...launchOf(program, programName), noDebug: config.noDebug }; // Run Without Debugging stays a run
		}

		if (!config.program) {
			config.program = "${fileDirname}";
		}

		return config;
	}

	async resolveDebugConfigurationWithSubstitutedVariables(folder, config) {
		if (!trust.allowed()) {
			return undefined;
		}

		const base = baseOf(folder);
		if (base === undefined && !path.isAbsolute(config.program)) {
			vscode.window.showErrorMessage(`Snello: the program ${config.program} is relative, and no folder or file is open to take it from.`);
			return undefined;
		}

		const resolved = launch.resolved(config, base || "/");
		if (config.noDebug) {
			await runProgram(resolved);
			return undefined; // run in the terminal, as Run does: no session of a debugger
		}

		return (await debug.ready()) ? resolved : undefined;
	}
}

// baseOf is the directory a relative program is taken from: the
// workspace folder's, else the open file's; undefined for neither.
function baseOf(folder) {
	if (folder) {
		return folder.uri.fsPath;
	}

	const editor = vscode.window.activeTextEditor;
	return editor && editor.document.uri.scheme === "file" ? path.dirname(editor.document.uri.fsPath) : undefined;
}

// launchOf is a snello launch configuration of the program.
function launchOf(program, name) {
	return { type: command.debugType, request: "launch", name, program };
}

// relativeTo writes program under the folder's variable when it is in
// the folder, for a launch.json that moves with it.
function relativeTo(folder, program) {
	if (folder === undefined) {
		return program;
	}

	const rel = path.relative(folder.uri.fsPath, program);
	return rel.startsWith("..") || path.isAbsolute(rel) ? program : path.join("${workspaceFolder}", rel);
}

// openProgram is the program of the file open in the editor, as the
// language server says it runs, its directory or, in a directory of
// programs of one file each, the file; the file's directory for a file
// with no main of its own; undefined for none.
async function openProgram() {
	const editor = vscode.window.activeTextEditor;
	if (editor === undefined || editor.document.languageId !== command.languageId) {
		return undefined;
	}

	const main = ((await client.runnables(editor.document.uri)) || []).find((r) => r.kind === tree.KIND.main);
	return main !== undefined ? main.args[main.args.length - 1] : path.dirname(editor.document.uri.fsPath);
}

// runOpenProgram runs the program of the open file.
async function runOpenProgram() {
	const program = await openProgram();
	if (program === undefined) {
		vscode.window.showInformationMessage("Snello: open a file of the program to run.");
		return;
	}

	await runProgram({ name: `Run ${path.basename(program)}`, program });
}

// runProgram runs what config names in the integrated terminal: the
// program, with its arguments, environment, working directory and
// backend, or for a configuration of tests the package's tests.
async function runProgram(config) {
	if (!trust.allowed()) {
		return;
	}

	const snello = command.executable();
	if (snello === undefined) {
		vscode.window.showErrorMessage("Snello: snello was not found; set snello.serverPath to the snello command's absolute path.");
		return;
	}

	const resolved = launch.resolved(config, baseOf(vscode.workspace.getWorkspaceFolder(vscode.Uri.file(config.program))) || path.dirname(config.program));
	const execution = new vscode.ProcessExecution(snello, launch.runArgs(resolved, command.backendArgs(resolved)), { cwd: resolved.cwd, env: resolved.env });
	const task = new vscode.Task({ type: taskSource, program: resolved.program }, vscode.TaskScope.Workspace, config.name || `Run ${path.basename(resolved.program)}`, taskSource, execution);
	task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, focus: true, panel: vscode.TaskPanelKind.Dedicated, clear: true };
	await vscode.tasks.executeTask(task);
}

// debugProgram debugs the program, as F5 on its launch configuration.
function debugProgram(program) {
	const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(program));
	return vscode.debug.startDebugging(folder, launchOf(program, `Debug ${path.basename(program)}`));
}

module.exports = { activate };
