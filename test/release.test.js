// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The release workflow's decisions, tested under Node's own runner.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { versionOf, snelloOf, checkTag, checkKind, kindOf, notesOf, main } = require("../release/release");

const changelog = "# Changelog\n\n## 0.1.0-alpha.2\n\n- Fixed a thing.\n\n## 0.1.0-alpha.1\n\nThe first download.\n\n- Tests.\n";

test("a version is MAJOR.MINOR.PATCH, with or without a pre-release suffix, as Snello's are", () => {
	assert.equal(versionOf('{"version": "0.1.0"}'), "0.1.0");
	assert.equal(versionOf('{"version": "0.1.0-alpha.2"}'), "0.1.0-alpha.2");
	assert.equal(versionOf('{"version": "10.20.30-rc-1"}'), "10.20.30-rc-1");
	assert.throws(() => versionOf('{"version": "0.1"}'), /MAJOR.MINOR.PATCH/);
	assert.throws(() => versionOf('{"version": "01.0.0"}'), /MAJOR.MINOR.PATCH/);
	assert.throws(() => versionOf('{"version": "0.1.0-"}'), /MAJOR.MINOR.PATCH/);
});

test("a tag must name the version", () => {
	checkTag("v0.1.0-alpha.1", "0.1.0-alpha.1");
	assert.throws(() => checkTag("v0.1.0", "0.1.0-alpha.1"), /does not name/);
	assert.throws(() => checkTag("0.1.0-alpha.1", "0.1.0-alpha.1"), /does not name/);
});

test("a release waits for a released Snello: while the Snello it needs is an alpha, it is a pre-release", () => {
	assert.equal(snelloOf('{"snello": {"minimum": "0.1.0-alpha.2"}}'), "0.1.0-alpha.2");
	assert.equal(snelloOf('{"snello": {"minimum": "0.1.0-rc-1"}}'), "0.1.0-rc-1");
	assert.throws(() => snelloOf('{"version": "0.1.0"}'), /snello.minimum/);
	checkKind("pre-release", "0.1.0-alpha.2");
	assert.throws(() => checkKind("release", "0.1.0-alpha.2"), /needs a released Snello/);
	checkKind("release", "0.1.0");
});

test("a version with a suffix is a pre-release, one without a release", () => {
	assert.equal(kindOf("0.1.0-alpha.1"), "pre-release");
	assert.equal(kindOf("0.1.0"), "release");
	assert.equal(kindOf("0.2.3"), "release");
});

test("a version's notes are its section of the changelog, up to the next heading outside a code block", () => {
	assert.equal(notesOf(changelog, "0.1.0-alpha.2"), "- Fixed a thing.\n");
	assert.equal(notesOf(changelog, "0.1.0-alpha.1"), "The first download.\n\n- Tests.\n");
	assert.equal(notesOf("## 0.1.0\n\nx\n\n## 0.0.9 (beta)\n\nold\n", "0.1.0"), "x\n");
	assert.equal(notesOf("## 0.1.0\n\nx\n\n# Older\n\nold\n", "0.1.0"), "x\n");
	assert.equal(notesOf("## 0.1.0\n\nx\n\n```\n## not a heading\n```\n", "0.1.0"), "x\n\n```\n## not a heading\n```\n");
	assert.equal(notesOf("## 0.1.0\r\n\r\nx\r\n", "0.1.0"), "x\n");
});

test("a version without a section, with an empty one, or with more than the version in its heading, is refused", () => {
	assert.throws(() => notesOf(changelog, "0.1.0"), /no section/);
	assert.throws(() => notesOf("## 0.1.0\n\n## 0.0.9\n\nold\n", "0.1.0"), /is empty/);
	assert.throws(() => notesOf("## 0.1.0 (beta)\n\nx\n", "0.1.0"), /the version alone/);
});

test("the commands answer as the workflow calls them", () => {
	const files = { "package.json": '{"version": "0.1.0-alpha.1", "snello": {"minimum": "0.1.0-alpha.2"}}', "CHANGELOG.md": changelog };
	const read = (name) => files[name];
	assert.equal(main(["version"], read), "0.1.0-alpha.1\n");
	assert.equal(main(["snello"], read), "0.1.0-alpha.2\n");
	assert.equal(main(["kind"], read), "pre-release\n");
	assert.equal(main(["notes"], read), "The first download.\n\n- Tests.\n");
	assert.equal(main(["check", "v0.1.0-alpha.1"], read), "");
	assert.equal(main(["check"], read), "", "with no tag, the release's own");
	assert.throws(() => main(["check", "v0.1.0"], read), /does not name/);
	assert.throws(() => main(["what"], read), /usage/);

	files["package.json"] = '{"version": "0.1.0", "snello": {"minimum": "0.1.0-alpha.2"}}';
	files["CHANGELOG.md"] = "## 0.1.0\n\nA release.\n";
	assert.throws(() => main(["check"], read), /needs a released Snello/);
	files["package.json"] = '{"version": "0.1.0", "snello": {"minimum": "0.1.0"}}';
	assert.equal(main(["check", "v0.1.0"], read), "", "a release once it needs a released Snello");
});
