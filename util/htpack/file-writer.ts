import {pipeline} from 'node:stream/promises'
import {createWriteStream} from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import {createHash} from 'node:crypto'
import * as fattr from './fattr.js'
import {serializeToHtpack} from './domserializer.ts'
import {serializeToHtpack as serializeP5} from './parse5-serializer.ts'
import {PageHeader, FileHeader, type Struct} from './structs.ts'

const textencoder = new TextEncoder()
function alloc<T>(struct: Struct<T>) {
	const buf = new ArrayBuffer(struct.size)
	return new struct(new DataView(buf), 0)
}

export type Page = {url: string, title: string, keywords: string[]} & ({window: unknown} | {p5doc: unknown} | {bufs: {pack: Uint8Array, text: Uint8Array}})

export function* page_to_htpack(page: Page) {
	for (const key of ['url', 'title', 'keywords'] as const) {
		if (!(key in page)) throw new Error(`missing ${key}`)
		if (page[key] === undefined) throw new Error(`undefined ${key}`)
		if (page[key] === null) throw new Error(`null ${key}`)
	}
	if (!('window' in page) && !('p5doc' in page) && !('bufs' in page)) throw new Error('missing window, p5doc, or bufs')

	const metadata = textencoder.encode(JSON.stringify({
		url: page.url,
		// TODO base (to handle <base> element; available from window.document.baseURI)
		title: page.title,
		keywords: page.keywords,
	}))
	const {text, pack} =
		('bufs' in page) ? page.bufs
		: (('window' in page) ? serializeToHtpack(page.window)
		: serializeP5(page.p5doc as any))

	const header = alloc(PageHeader)
	header.metadataLen = metadata.length
	header.packLen = pack.length
	header.textLen = text.length

	yield header.toBytes()
	yield metadata
	yield pack
	yield text
}

export async function* output_htpack(source: AsyncIterable<Page>) {
	yield 'Pak1'
	const filemetadata = textencoder.encode(JSON.stringify({}))
	const fileheader = alloc(FileHeader)
	fileheader.metadataLen = filemetadata.length
	yield fileheader.toBytes()
	yield filemetadata

	for await (const page of source) {
		try {
			yield* page_to_htpack(page)
		} catch (cause) {
			// TODO ignoring errors like this isn't great, but it gets us more pages in the web crawl.
			// This is, however, a significant hack for doing so.
			console.error(`Error while converting to htpack: ${page.url}`, {cause})
		}
	}
}

export async function write_htpack(filename: string, source: AsyncIterable<Page>, opts?: {
		additionalAttrs: Record<string, string>,
}) {
	const file = createWriteStream(filename)
	const hasher = createHash('sha512')
	await pipeline(
		source,
		output_htpack,
		async function*(data) {
			// tee output data into hash function...
			for await (const chunk of data) {
				hasher.update(chunk)
				// ...but also let it flow through to the output
				yield chunk
			}
		},
		file,
	)
	await new Promise<void>((resolve, reject) => {
		file.close(err => {
			if (err) reject(err)
			else resolve()
		})
	})

	// attach hash to file
	const hash = hasher.digest('hex')
	await fattr.setAttribute(filename, 'user.feep.sha512', hash)
	for (const [key, value] of Object.entries(opts?.additionalAttrs ?? {})) {
		await fattr.setAttribute(filename, key, value)
	}

	// make file readonly now that we've finished writing it
	await fsPromises.chmod(filename, 0o444)
}
