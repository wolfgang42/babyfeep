import {pipeline} from 'node:stream/promises'
import {readStream} from '../util/htpack/file-reader.ts'

const textdecoder = new TextDecoder()
function utf8tostr(buf: Uint8Array) {
	return textdecoder.decode(buf)
}

await pipeline(
	process.stdin,
	readStream,
	async function* (stream) {
		for await (const doc of stream) {
			yield JSON.stringify({
				title: doc.metadata.title,
				url: doc.metadata.url,
				body: utf8tostr(doc.text),
			})+'\n'
		}
	},
	process.stdout,
)
