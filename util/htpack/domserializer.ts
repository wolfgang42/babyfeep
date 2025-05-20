import {ExpandableBuffer} from "./expandable-buffer.ts"
import {ATTRIBUTES_BY_NAME, ATTRIBUTE_NAME_UNKNOWN, ELEMENTS_BY_NAME, ELEMENT_NAME_UNKNOWN} from "./htmldata.ts"
import {Attribute, ElementHeader} from "./structs.ts"

// NOTE: changes to this function should be paralleled in parse5-serializer.ts
export function serializeToHtpack(window: any) {
	// TODO reuse buffers?
	const packbuf = new ExpandableBuffer()
	const textbuf = new ExpandableBuffer()

	function walk(node: any) {
		if (node.nodeType === window.Node.DOCUMENT_NODE) {
			for (const child of node.childNodes) {
				walk(child)
			}
		} else if (node.nodeType === window.Node.DOCUMENT_TYPE_NODE) {
			// No-op
		} else if (node.nodeType === window.Node.ELEMENT_NODE) {
			const header = packbuf.add(ElementHeader)
			
			const namei = ELEMENTS_BY_NAME.get(node.tagName.toLowerCase())
			// TODO also record unknown names? (but there's nowhere obvious to put them)
			header.name = namei ?? ELEMENT_NAME_UNKNOWN

			header.textStart = textbuf.mark()

			for (const {name, value} of node.attributes) {
				const ki = ATTRIBUTES_BY_NAME.get(name)
				if (ki === undefined && name.includes('=')) throw new Error("can't happen: attr name contains equals")
				const attr = packbuf.add(Attribute)
				const size = packbuf.addRawStr((ki === undefined) ? `${name}=${value}` : value)
				attr.name = ki ?? ATTRIBUTE_NAME_UNKNOWN
				attr.size = size
			}
			header.attrLen = packbuf.diff(header.endOff)

			for (const child of node.childNodes) {
				walk(child)
			}

			header.textLen = textbuf.diff(header.textStart)
			if (header.textLen === 0) header.textStart = 0
			const childLen = packbuf.diff(header.endOff)-header.attrLen
			header.childLen = childLen
		} else if (node.nodeType === window.Node.TEXT_NODE) {
			textbuf.addRawStr(node.textContent ?? '')
		} else if (node.nodeType === window.Node.COMMENT_NODE) {
			// No-op
		} else {
			throw new Error(`not implemented for node type ${node.nodeType}`)
		}
	}
	walk(window.document)

	return {
		pack: packbuf.view(),
		text: textbuf.view(),
	}
}
