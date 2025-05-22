import * as fs from 'node:fs'
import {WARCParser} from 'warcio'
import {write_htpack} from '../../util/htpack/file-writer.ts'
import {JSDOM} from 'jsdom'
import * as domtf from '../../util/domtf/index.js'

const textdecoder = new TextDecoder()
function utf8totext(buf: Uint8Array) {
	return textdecoder.decode(buf)
}

const INNAME = process.argv[2]
const warcfile = `${import.meta.dirname}/data/download/warc/${INNAME}.warc.gz`
const htpackfile = `${import.meta.dirname}/data/derive/htpack/${INNAME}.htpack`

async function* generate() {
	// NOTE: JSDOM causes a memory leak when called in a hot loop, because it makes a process.nextTick() call
	// which retains a reference to the window until the event loop gets around to processing it:
	// https://github.com/jsdom/jsdom/issues/1665
	// There seem to be two ways to work around this:
	// a) Let the event loop run with `await new Promise(resolve => setImmediate(resolve))` after each iteration
	// b) Reuse the JSDOM object, avoiding leaking a bunch of them by only having one.
	// We're going with B because it's also faster, but if it proves to be bug-prone we can switch to A.
	const {window} = new JSDOM('')

	for await (const record of new WARCParser(fs.createReadStream(warcfile))) {
		if (record.warcType !== 'response') continue
		
		const url = record.warcTargetURI
		if (!url) throw new Error('no warcTargetURI')
		try {
			const status = record.httpHeaders!.statusCode
			if (status !== 200) {
				continue // TODO throw new Error(`unexpected status ${status}`)
			}
			const contentType = record.httpHeaders!.headers.get('Content-Type')
			if (!contentType || !contentType.startsWith('text/html')) {
				// TODO proper MIME-type parser
				continue // TODO throw new Error(`unexpected content type ${contentType}`)
			}

			const html = utf8totext(await record.readFully(true))
			// NOTE: See above explanation of why we're reusing the window but replacing its contents
			window.document.open()
			window.document.write(html)
			window.document.close()

			// TODO use readability.js to parse the HTML and get the main content
			window.document.querySelectorAll('script,style,nav,[role="navigation"]').forEach(e => e.remove())
			domtf.collapseWhitespace(window)
			
			yield {
				url,
				title: window.document.title,
				keywords: [], // don't bother
				window,
			}
		} catch (cause) {
			throw new Error(`failed to process ${url}`, {cause})
		}
	}
}

await write_htpack(`${htpackfile}.tmp`, generate())
