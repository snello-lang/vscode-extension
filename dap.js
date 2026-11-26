// Copyright 2026 The Snello Programming Language. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The Debug Adapter Protocol as the extension's adapter relays it, with
// no editor in it, so that npm test tests it: each message framed by a
// Content-Length header, read from a stream as it comes and written so,
// and the two messages the relay changes. The editor's launch request is
// given the arguments the debugger's adapter takes, for the binary built
// for it; and the adapter's answer to initialize says it cannot restart
// a session itself, so that the editor restarts one by ending it and
// starting another, which builds the program again from its source as
// it now is.

"use strict";

const header = "Content-Length: ";
const separator = "\r\n\r\n";

// framed writes message as the protocol frames it.
function framed(message) {
	const body = Buffer.from(JSON.stringify(message), "utf8");
	return Buffer.concat([Buffer.from(`${header}${body.length}${separator}`, "ascii"), body]);
}

// reader returns what is fed a stream of framed messages, as it comes,
// and calls onMessage with each message whole.
function reader(onMessage) {
	let buffered = Buffer.alloc(0);
	return {
		feed(chunk) {
			buffered = Buffer.concat([buffered, chunk]);
			for (;;) {
				const end = buffered.indexOf(separator);
				if (end < 0) {
					return;
				}

				const match = /Content-Length: *(\d+)/i.exec(buffered.subarray(0, end).toString("ascii"));
				if (match === null) { // a header with no length: what is before the separator is passed over
					buffered = buffered.subarray(end + separator.length);
					continue;
				}

				const start = end + separator.length;
				const length = Number(match[1]);
				if (buffered.length < start + length) {
					return;
				}

				const body = buffered.subarray(start, start + length).toString("utf8");
				buffered = buffered.subarray(start + length);
				let message;
				try {
					message = JSON.parse(body);
				} catch {
					continue; // a body that is no message is passed over
				}

				onMessage(message);
			}
		},
	};
}

// toAdapter returns the editor's message as the adapter is to have it: a
// launch request with the arguments given, the rest as they are.
function toAdapter(message, launch) {
	if (message.type === "request" && message.command === "launch") {
		return { ...message, arguments: launch };
	}

	return message;
}

// toEditor returns the adapter's message as the editor is to have it:
// the answer to initialize saying the adapter cannot restart a session
// itself, the rest as they are.
function toEditor(message) {
	if (message.type === "response" && message.command === "initialize" && message.body) {
		return { ...message, body: { ...message.body, supportsRestartRequest: false } };
	}

	return message;
}

module.exports = { framed, reader, toAdapter, toEditor };
