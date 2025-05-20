import { ATTRIBUTES_BY_ID, ATTRIBUTE_NAME_UNKNOWN, ELEMENTS_BY_ID } from "./htmldata.ts"
import { Attribute, ElementHeader } from "./structs.ts"

const textdecoder = new TextDecoder()
function utf8tohtmltext(buf: Uint8Array) {
	return htmlescape(textdecoder.decode(buf))
}

function htmlescape(text: string) {
	return text.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\"/g, '&quot;')
}

export class HtmlDocument {
	readonly dv: DataView
	readonly packbuf: Uint8Array
	readonly textbuf: Uint8Array

	constructor(
		packbuf: Uint8Array,
		textbuf: Uint8Array,
	) {
		this.dv = new DataView(packbuf.buffer, packbuf.byteOffset, packbuf.byteLength)
		this.packbuf = packbuf
		this.textbuf = textbuf
	}

	*children() {
		let off = 0
		while (off < this.packbuf.byteLength) {
			const element = new HtmlElement(this, off)
			yield element
			off += element.size
		}
	}

	*all_elements() {
		let off = 0
		while (off < this.packbuf.byteLength) {
			const element = new HtmlElement(this, off)
			yield element
			// Because of the way elements are packed, we can ignore the recursive
			// structure when we don't care about it: the data following an
			// element header will be a child, a sibling, or a descendant of an ancestor,
			// but since we don't care which it is we can just do a linear scan.
			off += ElementHeader.size + element.attrLen
		}
	}

	toJSON() {
		return Array.from(this.children())
	}

	toHtml() {
		let ret = ''
		for (const element of this.children()) {
			ret += element.toHtml()
		}
		return ret
	}
}

export class HtmlElement {
	readonly doc: HtmlDocument
	readonly off: number
	readonly attrLen: number
	readonly childLen: number
	readonly header: ElementHeader

	constructor(
		doc: HtmlDocument,
		off: number,
	) {
		this.doc = doc
		this.off = off
		this.header = new ElementHeader(doc.dv, off)
		this.attrLen = this.header.attrLen
		this.childLen = this.header.childLen
	}

	get size() {
		return ElementHeader.size + this.attrLen + this.childLen
	}
	namei() {
		return this.header.name
	}
	name() {
		const namei = this.namei()
		if (namei === 0) {
			return 'unknown'
		} else {
			const ret = ELEMENTS_BY_ID[namei]
			if (!ret) throw new Error('invalid element name')
			return ret
		}
	}

	get textStart() {
		return this.header.textStart
	}
	get textLen() {
		return this.header.textLen
	}
	get textEnd() {
		return this.header.textStart + this.header.textLen
	}

	*#scan_attributes() {
		let off = 0
		while (off < this.attrLen) {
			const attr: Attribute = new Attribute(this.doc.dv, this.header.endOff+off)
			yield attr
			off += Attribute.size + attr.size
		}
	}
	#attribute_rawvalue(attr: Attribute) {
		return Buffer.from(this.doc.packbuf.buffer, this.doc.packbuf.byteOffset+attr.endOff, attr.size).toString('utf-8')
	}
	*attributes(): Generator<[string, string]> {
		for (const attr of this.#scan_attributes()) {
			const attrv = this.#attribute_rawvalue(attr)
			let attrname: string, attrval: string
			if (attr.name === ATTRIBUTE_NAME_UNKNOWN) {
				const eqi = attrv.indexOf('=')
				if (eqi === -1) throw new Error('Missing equals in unknown attr')
				attrname = attrv.substring(0, eqi)
				attrval = attrv.substring(eqi+1)
			} else {
				let attrnamei = ATTRIBUTES_BY_ID[attr.name]
				if (!attrnamei) throw new Error('unknown attribute id '+attr.name)
				attrname = attrnamei
				attrval = attrv
			}
			yield [attrname, attrval]
		}
	}
	getAttrs<T extends string[]>(...names: T): Partial<Record<T[number], string>> {
		const ret: Partial<Record<T[number], string>> = {}
		for (const [name, value] of this.attributes()) {
			if (names.includes(name as T[number])) {
				ret[name as T[number]] = value
			}
		}
		return ret
	}
	*children() {
		let off = 0
		while (off < this.childLen) {
			const element = new HtmlElement(this.doc, this.header.endOff+this.attrLen+off)
			yield element
			off += element.size
		}
	}

	toJSON() {
		return {
			name: this.name(),
			attributes: Array.from(this.attributes()),
			children: Array.from(this.children()),
		}
	}

	toHtml() {
		let ret = `<${this.name()}`
		for (const [name, value] of this.attributes()) {
			ret += ` ${name}="${htmlescape(value)}"`
		}
		ret += '>'
		let t = this.textStart
		for (const child of this.children()) {
			if (child.textStart > t) {
				ret += utf8tohtmltext(this.doc.textbuf.subarray(t, child.textStart))
			}
			ret += child.toHtml()
			if (child.textEnd !== 0) {
				t = child.textEnd
			}
		}
		if (this.textEnd > t) {
			ret += utf8tohtmltext(this.doc.textbuf.subarray(t, this.textEnd))
		}
		ret += `</${this.name()}>`
		return ret
	}
}
