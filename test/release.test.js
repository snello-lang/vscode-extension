// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The release workflow's decisions, tested under Node's own runner.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { versionOf, checkTag, snelloOf, checkKind, kindOf, notesOf } = require("../release/release");

test("a version is MAJOR.MINOR.PATCH and nothing more", () => {
	assert.equal(versionOf('{"version": "0.1.0"}'), "0.1.0");
	assert.throws(() => versionOf('{"version": "0.1.0-alpha.2"}'), /MAJOR.MINOR.PATCH/);
	assert.throws(() => versionOf('{"version": "0.1"}'), /MAJOR.MINOR.PATCH/);
});

test("a tag must name the version", () => {
	checkTag("v0.1.0", "0.1.0");
	assert.throws(() => checkTag("v0.1.1", "0.1.0"), /does not name/);
	assert.throws(() => checkTag("0.1.0", "0.1.0"), /does not name/);
});

const changelog = "# Changelog\n\n## 0.1.1\n\n- Fixed a thing.\n\n## 0.1.0 (pre-release)\n\nThe first download.\n\n- Tests.\n";

test("a release waits for a released Snello: while the Snello it needs is an alpha, it is a pre-release", () => {
	assert.equal(snelloOf('{"snello": {"minimum": "0.1.0-alpha.2"}}'), "0.1.0-alpha.2");
	assert.throws(() => snelloOf('{"version": "0.1.0"}'), /snello.minimum/);
	checkKind("pre-release", "0.1.0-alpha.2");
	assert.throws(() => checkKind("release", "0.1.0-alpha.2"), /needs a released Snello/);
	checkKind("release", "0.1.0");
});

test("a release is a pre-release when its changelog heading says so", () => {
	assert.equal(kindOf(changelog, "0.1.0"), "pre-release");
	assert.equal(kindOf(changelog, "0.1.1"), "release");
	assert.throws(() => kindOf(changelog, "0.1.2"), /no section/);
});

test("a version's notes are its section of the changelog, and one without a section is refused", () => {
	assert.equal(notesOf(changelog, "0.1.1"), "- Fixed a thing.\n");
	assert.equal(notesOf(changelog, "0.1.0"), "The first download.\n\n- Tests.\n");
	assert.throws(() => notesOf(changelog, "0.2.0"), /no section/);
});
