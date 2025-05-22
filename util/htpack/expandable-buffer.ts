import {U32_MAX} from "./structs.ts"
import type {Struct} from "./structs.ts"

// NOTE: this class makes some assumptions about how its caller will be using it,
//       which may not be appropriate outside of the html parser it was designed for.
export class ExpandableBuffer {
	private length = 0
	private readonly buf = new ArrayBuffer(10 * 1024 * 1024, {maxByteLength: 1024 * 1024 * 1024}) // TODO make smaller when ArrayBuffer.resize() is available
	private readonly u8 = new Uint8Array(this.buf)
	private readonly dv = new DataView(this.buf)

	// add `len` more bytes to the size of the buffer.
	#expand(len: number) {
		if (!Number.isInteger(len) || len <= 0) throw new Error('invalid expansion')
		this.length += len
		if (this.length > U32_MAX) throw new Error('length overrun')
		// Expand if needed.
		let newLen = this.buf.byteLength
		while (newLen < this.length) {newLen *= 2}
		if (newLen != this.buf.byteLength) {
			this.buf.resize(newLen)
		}
	}

	view() {
		return new Uint8Array(this.buf, 0, this.length)
	}
	reset() {
		// Note that we truncate the visible length, but do not ever shorten the buffer:
		// the assumption is that, if we needed that much memory once, we'll probably
		// need it again in the future.
		// We also don't zero the memory; the user is expected to be overwriting every
		// byte anyway.
		this.length = 0
	}

	mark() {
		return this.length
	}
	diff(mark: number) {
		return this.length - mark
	}

	add<T>(struct: Struct<T>) {
		const mark = this.length
		this.#expand(struct.size)
		return new struct(this.dv, mark)
	}

	addRawStr(str: string) {
		if (str === '') return 0
		const mark = this.length
		const strBuf = Buffer.from(str)
		this.#expand(strBuf.length)
		this.u8.set(strBuf, mark)
		return strBuf.length
	}
}
