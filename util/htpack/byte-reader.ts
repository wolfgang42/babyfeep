// Wrapper around ReadableStream (or any other AsyncIterable<Buffer>, I guess) which provides a helper
// method to read specific numbers of bytes at a time.
//
// TODO: this is probably broken if you don't `await` the return of read() before calling it again,
//       so don't do that.
// TODO extract this somewhere more general, since it's not really specific to htpack
export async function bytereader(stream: AsyncIterable<Buffer>) {
	// This is an unusual situation where we have to use the async iterator protocol directly,
	// rather than being able to use `for await()` or the like, since we're letting the caller
	// of our .read() function determine how much we need to advance.
	const iter = stream[Symbol.asyncIterator]()
	let {value, done} = await iter.next()
	// value_offset is the number of bytes into the current `value` that we've read
	let value_offset = 0
	// position is the number of bytes we've read in total
	let position = 0
	return {
		// .read(n) returns n bytes from the stream. It crashes if the stream turns out not to have
		// had that many bytes left, but returns null if the stream finished.
		// This requires the reader to know exactly how many bytes it might want; there's currently
		// no way to request "up to" N bytes.
		read: async (len: number) => {
			if (done) return null
			// buf is the Buffer we'll return, once we've got len bytes in it
			// off is how many bytes we've managed to get into buf so far
			let buf = Buffer.alloc(len), off = 0
			while (off !== len) { // Until buf is full
				// Copy from the current value into our buffer,
				// starting the output at off (where we left off from the last write),
				// and starting the input at value_offset (ditto for the last read).
				const copied = value.copy(buf, off, value_offset)
				// That will return how many bytes were copied (if either the input or the output
				// buffer was short, it will truncate `copied` accordingly), so now update our offsets
				// on both sides correspondingly.
				value_offset += copied
				off += copied
				// If we ran out of bytes in `value` (our input), get a new one so we can carry on reading.
				if (value_offset === value.length) {
					value_offset = 0
					;({value, done} = await iter.next())
					// If we don't have any more bytes, but didn't complete the current read,
					// throw an error since the stream must have ended unexpectedly.
					if (done && off !== len) throw new Error('short read')
				}
			}
			// Update the total number of bytes we've read so far; we do this now rather than during
			// the loop so that it always returns the position that the caller has seen up to.
			position += len
			// At this point all of our bytes have been copied into buf, so return it.
			return buf
		},
		get position() {
			return position
		},
		// .close() must be called when done using the reader, so that the iterator (and associated stream)
		// can be cleaned up as needed.
		close: async () => {
			done = true
			iter.return?.()
		},
	}
}
