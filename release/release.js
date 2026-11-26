// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// What the release workflow decides about a release, from package.json
// and CHANGELOG.md, so that nothing about a version is typed in the
// workflow and npm test tests every rule:
//
//   node release/release.js version      the version package.json says
//   node release/release.js check TAG     fails unless TAG is v and that version, and the
//                                         release is a pre-release while its Snello is one
//   node release/release.js kind          release, or pre-release as the changelog says
//   node release/release.js notes         the version's section of CHANGELOG.md
//
// A version is MAJOR.MINOR.PATCH and nothing more, since VS Code takes
// no suffix. Whether a release is a pre-release is said where its notes
// are written, its heading in CHANGELOG.md, "## 0.1.0 (pre-release)",
// so that the release's pull request shows it and no rule over the
// number decides it. package.json's snello.minimum is the oldest Snello
// the release works with; while that is a pre-release of Snello, an
// alpha, the extension's release must be one too, and check refuses a
// release that is not.

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const versionPattern = /^(\d+)\.(\d+)\.(\d+)$/;
const tagPrefix = "v";
const snelloPattern = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/;
const sectionPattern = /^## (\S+)( \(pre-release\))?\s*$/;

// versionOf returns the version a package.json text says, refusing one
// that is not MAJOR.MINOR.PATCH.
function versionOf(packageText) {
	const version = JSON.parse(packageText).version;
	if (!versionPattern.test(version)) {
		throw new Error(`package.json's version ${version} is not MAJOR.MINOR.PATCH, which VS Code requires`);
	}

	return version;
}

// checkTag refuses a tag that does not name version.
function checkTag(tag, version) {
	if (tag !== tagPrefix + version) {
		throw new Error(`the tag ${tag} does not name package.json's version ${version}: raise the version in a pull request, merge it, and tag v${version}`);
	}
}

// snelloOf returns the oldest Snello a package.json text says the
// extension works with.
function snelloOf(packageText) {
	const snello = JSON.parse(packageText).snello;
	if (!snello || typeof snello.minimum !== "string" || !snelloPattern.test(snello.minimum)) {
		throw new Error("package.json's snello.minimum must name the oldest Snello the extension works with, such as 0.1.0-alpha.2");
	}

	return snello.minimum;
}

// checkKind refuses a release that is not a pre-release while the Snello
// it needs, snello, is one.
function checkKind(kind, snello) {
	if (kind === "release" && snello.includes("-")) {
		throw new Error(`a release needs a released Snello, and this one needs ${snello}: mark its changelog heading (pre-release) until it needs Snello 0.1.0 or later`);
	}
}

// kindOf is pre-release when version's heading in a CHANGELOG.md text
// says so, and release otherwise.
function kindOf(changelogText, version) {
	const lines = changelogText.split("\n");
	return sectionPattern.exec(lines[sectionOf(lines, version)])[2] ? "pre-release" : "release";
}

// notesOf returns the section of a CHANGELOG.md text headed by version,
// "## 0.1.0" and its lines up to the next such heading, without the
// heading.
function notesOf(changelogText, version) {
	const lines = changelogText.split("\n");
	const start = sectionOf(lines, version);

	let end = lines.findIndex((line, i) => i > start && sectionPattern.test(line));
	if (end < 0) {
		end = lines.length;
	}

	return lines.slice(start + 1, end).join("\n").trim() + "\n";
}

// sectionOf returns the line of version's heading, refusing a version
// with none.
function sectionOf(lines, version) {
	const at = lines.findIndex((line) => (sectionPattern.exec(line) || [])[1] === version);
	if (at < 0) {
		throw new Error(`CHANGELOG.md has no section ## ${version}: write what the release changes before tagging it`);
	}

	return at;
}

function main(args) {
	const packageText = fs.readFileSync(path.join(root, "package.json"), "utf8");
	const version = versionOf(packageText);
	const changelog = () => fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
	switch (args[0]) {
		case "version":
			return version + "\n";
		case "check":
			checkTag(args[1], version);
			checkKind(kindOf(changelog(), version), snelloOf(packageText));
			return "";
		case "kind":
			return kindOf(changelog(), version) + "\n";
		case "notes":
			return notesOf(changelog(), version);
		default:
			throw new Error("usage: node release/release.js version | check TAG | kind | notes");
	}
}

if (require.main === module) {
	try {
		process.stdout.write(main(process.argv.slice(2)));
	} catch (err) {
		process.stderr.write(`release: ${err.message}\n`);
		process.exit(1);
	}
}

module.exports = { versionOf, checkTag, snelloOf, checkKind, kindOf, notesOf };
