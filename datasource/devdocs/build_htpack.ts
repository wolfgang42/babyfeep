import {write_htpack} from '../../util/htpack/file-writer.ts'
import fs from 'node:fs/promises'
import {JSDOM} from 'jsdom'
import {collapseWhitespace} from '../../util/domtf/index.js'

async function* generate(slug: string) {
	const db = JSON.parse(await fs.readFile(`${import.meta.dirname}/data/download/${slug}.db.json`, 'utf-8'))

	// NOTE: JSDOM causes a memory leak when called in a hot loop, because it makes a process.nextTick() call
	// which retains a reference to the window until the event loop gets around to processing it:
	// https://github.com/jsdom/jsdom/issues/1665
	// There seem to be two ways to work around this:
	// a) Let the event loop run with `await new Promise(resolve => setImmediate(resolve))` after each iteration
	// b) Reuse the JSDOM object, avoiding leaking a bunch of them by only having one.
	// We're going with B because it's also faster, but if it proves to be bug-prone we can switch to A.
	const {window} = new JSDOM('')

	for (const key in db) {
		const body_html = db[key]
		const html = `<!DOCTYPE html><html><body>${body_html}</body></html>`

		// NOTE: See above explanation of why we're reusing the window but replacing its contents
		window.document.open()
		window.document.write(html)
		window.document.close()

		const title = window.document.querySelector('h1')?.textContent ?? ''
		// TODO if (!title) throw new Error(`No title found for ${slug}/${key}`)

		const url = (window.document.querySelector('a._attribution-link') as HTMLAnchorElement)?.href ?? ''
		if (!url) throw new Error(`No URL found for ${slug}/${key}`)

		// TODO this is down here for compatibility with the old code, not for any good reason
		// (titles were not previously whitespace-collapsed, though they probably ought to be)
		collapseWhitespace(window)
		window.document.querySelectorAll('nav, [role="navigation"]').forEach(e => e.remove())

		const keywords = [
			// TODO removed for simplicity
		]

		yield {url, title, keywords, window}
	}
}

const slug = process.argv[2]
await write_htpack(`${import.meta.dirname}/data/derive/${slug}.htpack.tmp`, generate(slug))
