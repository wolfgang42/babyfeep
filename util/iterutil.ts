import fs from 'node:fs'
import stream from 'node:stream'

// SplitLines: Quite fast splitter for newline-delimited files
//
// Notes:
//  - Only \n; this allows us to not pull in a regex engine or something for \r\n handling
//  - Output objects do *not* have trailing '\n' (already stripped)
//  - Works equally well when given buffers or strings; both seem to have equal performance
//    (on a workload where the lines are immediately passed to JSON.parse, at least).
//  - Keeps everything internally as buffers to handle case where chunk boundaries are in
//    the middle of a utf8 character.
//  - Handles last line not being terminated, and will emit it anyway.
//
// Usage:
//   `new SplitLines()` will give you a stream transform which can be used in the standard way.
//   For example, pipe a stream through it: `outStream = inStream.pipe(new SplitLines())`
//   Or use it in a for loop: `for await (const line of inStream.pipe(new SplitLines()))`
const EMPTY_BUFFER = Buffer.alloc(0)
export class SplitLines extends stream.Transform {
	rest = EMPTY_BUFFER
	
	constructor() {
		super({objectMode: true})
	}

	_transform(chunk, encoding, callback) {
		let prev = 0, next = 0
		while (true) {
			next = chunk.indexOf(0x0a, prev)
			if (next === -1) break
			this.push(Buffer.concat([this.rest, chunk.slice(prev, next)]).toString())
			prev = next+1
			this.rest = EMPTY_BUFFER
		}
		this.rest = Buffer.concat([this.rest, chunk.slice(prev)])
		callback()
	}
	
	_flush(callback) {
		if (this.rest.length !== 0) this.push(this.rest.toString())
		this.rest = EMPTY_BUFFER // release for GC
		callback()
	}
}

export async function* read_jsonl(input) {
	if (typeof input === 'string') {
		input = fs.createReadStream(input)
	}
	for await (const line of input.pipe(new SplitLines())) {
		yield JSON.parse(line)
	}
}
