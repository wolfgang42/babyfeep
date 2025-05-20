import * as fs from 'node:fs/promises'
import * as fs_sync from 'node:fs'
import {bytereader} from './byte-reader.ts'
import { FileHeader, PageHeader } from './structs.ts'
import type { Struct } from './structs.ts'
import { HtmlDocument } from './hydrator.ts'

const textdecoder = new TextDecoder()
function utf8tostr(buf: Uint8Array) {
	return textdecoder.decode(buf)
}

export class FileReader {
	public readonly fh: fs.FileHandle
	private constructor(fh: fs.FileHandle) {
		this.fh = fh
	}
	private _metadata: unknown
	get metadata() {return this._metadata}
	private _start_position: number = 0
	get start_position() {return this._start_position}

	static async open(path: string) {
		const fh = await fs.open(path, 'r')
		const reader = new FileReader(fh)
		const head = await reader.read(0, 4)
		if (utf8tostr(head) !== 'Pak1') throw new Error('Unexpected header')
		const fileheader = await reader.readStruct(4, FileHeader)
		const metadata = JSON.parse(utf8tostr(await reader.read(4 + FileHeader.size, fileheader.metadataLen)))
		reader._metadata = metadata
		reader._start_position = 4 + FileHeader.size + fileheader.metadataLen
		return reader
	}

	async read(position: number, length: number) {
		const buffer = new Uint8Array(length)
		const {bytesRead} = await this.fh.read({buffer, position})
		if (length !== bytesRead) throw new Error(`short read: ${length} != ${bytesRead}`)
		return buffer
	}

	async readStruct<T>(position: number, struct: Struct<T>) {
		const data = await this.read(position, struct.size)
		return new struct(new DataView(data.buffer), 0)
	}

	async readDocument(position: number) {
		const header = await this.readStruct(position, PageHeader)
		const metaEnd = header.metadataLen
		const packEnd = header.metadataLen + header.packLen
		const textEnd = header.metadataLen + header.packLen + header.textLen

		const data = await this.read(position + PageHeader.size, textEnd)
		const metadata = JSON.parse(utf8tostr(data.subarray(0, metaEnd)))
		const pack = data.subarray(metaEnd, packEnd)
		const text = data.subarray(packEnd, textEnd)
		
		return {
			position,
			header,
			data,
			metadata,
			pack,
			text,
			document: new HtmlDocument(pack, text),
			next_position: position + PageHeader.size + textEnd,
		}
	}

	close() { // TODO declare [Symbol.asyncDispose]
		return this.fh.close()
	}
}

export async function* readStream(stream: string | AsyncIterable<Buffer>) {
	if (typeof stream === 'string') {
		stream = fs_sync.createReadStream(stream)
	}
	const reader = await bytereader(stream)
	try {
		const head = await reader.read(4)
		if (!head || utf8tostr(head) !== 'Pak1') throw new Error('Unexpected header')
		
		async function readStruct<T>(struct: Struct<T>) {
			const data = await reader.read(struct.size)
			if (data === null) return null
			return new struct(new DataView(data.buffer), 0)
		}
		const fileheader = await readStruct(FileHeader)
		if (!fileheader) throw new Error('failed to read header')
		const rawmetadata = await reader.read(fileheader.metadataLen)
		if (!rawmetadata) throw new Error('failed to read raw metadata')
		// const _metadata = JSON.parse(utf8tostr(rawmetadata))

		while(true) {
			const position = reader.position
			const header = await readStruct(PageHeader)
			if (header === null) break
			const metaEnd = header.metadataLen
			const packEnd = header.metadataLen + header.packLen
			const textEnd = header.metadataLen + header.packLen + header.textLen

			const data = await reader.read(textEnd)
			if (!data) throw new Error('failed to read data')
			const metadata = JSON.parse(utf8tostr(data.subarray(0, metaEnd)))
			const pack = data.subarray(metaEnd, packEnd)
			const text = data.subarray(packEnd, textEnd)
			
			yield {
				position,
				header,
				data,
				metadata,
				pack,
				text,
				document: new HtmlDocument(pack, text),
			}
		}
	} finally {
		await reader.close()
	}
}
