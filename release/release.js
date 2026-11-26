// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// What the release workflow decides about a release, from package.json
// and CHANGELOG.md, so that nothing about a version is typed in the
// workflow and npm test tests every rule:
//
//   node release/release.js version      the version package.json says
//   node release/release.js snello       the oldest Snello the release needs
//   node release/release.js check [TAG]  fails unless the release may be cut, by TAG when given
//   node release/release.js kind         release, or pre-release for a version with a suffix
//   node release/release.js notes        the version's section of CHANGELOG.md
//
// A version is versioned as Snello is: MAJOR.MINOR.PATCH, with a
// pre-release suffix while the extension is built alongside an alpha of
// Snello, 0.1.0-alpha.1, 0.1.0-alpha.2, and none from 0.1.0 on. A version
// with a suffix is a pre-release. package.json's snello.minimum is the
// oldest Snello the release works with; while that is a pre-release of
// Snello, an alpha, the extension's release must be one too, and check
// refuses a release that is not. The Marketplace takes no suffix, so it
// is published to only from 0.1.0 on.

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const tagPrefix = "v";
const number = "(0|[1-9]\\d*)";
const versionPattern = new RegExp(`^${number}\\.${number}\\.${number}(-[0-9A-Za-z.-]+)?$`); // MAJOR.MINOR.PATCH and a pre-release suffix, as semver writes one
const headingPattern = /^## (\S+)(.*)$/; // a version's section
const endPattern = /^#{1,2} /; // any heading of a section's level or above ends it
const fencePattern = /^\s*```/;

// versionOf returns the version a package.json text says, refusing one
// that is not MAJOR.MINOR.PATCH with or without a pre-release suffix.
function versionOf(packageText) {
	const version = JSON.parse(packageText).version;
	if (typeof version !== "string" || !versionPattern.test(version)) {
		throw new Error(`package.json's version ${version} is not MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-PRERELEASE, such as 0.1.0-alpha.1`);
	}

	return version;
}

// snelloOf returns the oldest Snello a package.json text says the
// extension works with.
function snelloOf(packageText) {
	const snello = JSON.parse(packageText).snello;
	if (!snello || typeof snello.minimum !== "string" || !versionPattern.test(snello.minimum)) {
		throw new Error("package.json's snello.minimum must name the oldest Snello the extension works with, such as 0.1.0-alpha.2");
	}

	return snello.minimum;
}

// checkTag refuses a tag that does not name version.
function checkTag(tag, version) {
	if (tag !== tagPrefix + version) {
		throw new Error(`the tag ${tag} does not name package.json's version ${version}: raise the version in a pull request, merge it, and tag v${version}`);
	}
}

// checkKind refuses a release that is not a pre-release while the Snello
// it needs, snello, is one.
function checkKind(kind, snello) {
	if (kind === "release" && snello.includes("-")) {
		throw new Error(`a release needs a released Snello, and this one needs ${snello}: version it as a pre-release, such as 0.1.0-alpha.3, until it needs Snello 0.1.0 or later`);
	}
}

// kindOf is pre-release for a version with a suffix, and release for
// one without.
function kindOf(version) {
	return version.includes("-") ? "pre-release" : "release";
}

// notesOf returns the section of a CHANGELOG.md text headed by version,
// without its heading, refusing an empty one.
function notesOf(changelogText, version) {
	const notes = sectionOf(changelogText, version).lines.join("\n").trim();
	if (notes === "") {
		throw new Error(`CHANGELOG.md's section ## ${version} is empty: say what the release changes`);
	}

	return notes + "\n";
}

// sectionOf finds version's section in a CHANGELOG.md text, its lines
// up to the next heading of its level or above outside a code block. It
// refuses a version with no section, and a heading with more than the
// version.
function sectionOf(changelogText, version) {
	const lines = changelogText.replace(/\r\n/g, "\n").split("\n");
	let start = -1;
	let fenced = false;
	for (let i = 0; i < lines.length; i++) {
		if (fencePattern.test(lines[i])) {
			fenced = !fenced;
		}

		const m = !fenced && headingPattern.exec(lines[i]);
		if (m && m[1] === version) {
			if (m[2].trim() !== "") {
				throw new Error(`CHANGELOG.md's heading for ${version} ends "${m[2].trim()}": a heading is ## and the version alone`);
			}

			start = i;
			break;
		}
	}

	if (start < 0) {
		throw new Error(`CHANGELOG.md has no section ## ${version}: write what the release changes before tagging it`);
	}

	fenced = false;
	let end = lines.length;
	for (let i = start + 1; i < lines.length; i++) {
		if (fencePattern.test(lines[i])) {
			fenced = !fenced;
		}

		if (!fenced && endPattern.test(lines[i])) {
			end = i;
			break;
		}
	}

	return { lines: lines.slice(start + 1, end) };
}

// main answers a command of the workflow from the texts of package.json
// and CHANGELOG.md, read as asked.
function main(args, read) {
	const packageText = read("package.json");
	const version = versionOf(packageText);
	switch (args[0]) {
		case "version":
			return version + "\n";
		case "snello":
			return snelloOf(packageText) + "\n";
		case "check": {
			checkTag(args[1] === undefined ? tagPrefix + version : args[1], version);
			checkKind(kindOf(version), snelloOf(packageText));
			notesOf(read("CHANGELOG.md"), version);
			return "";
		}
		case "kind":
			return kindOf(version) + "\n";
		case "notes":
			return notesOf(read("CHANGELOG.md"), version);
		default:
			throw new Error("usage: node release/release.js version | snello | check [TAG] | kind | notes");
	}
}

if (require.main === module) {
	try {
		process.stdout.write(main(process.argv.slice(2), (name) => fs.readFileSync(path.join(root, name), "utf8")));
	} catch (err) {
		process.stderr.write(`release: ${err.message}\n`);
		process.exit(1);
	}
}

module.exports = { versionOf, snelloOf, checkTag, checkKind, kindOf, notesOf, main };
