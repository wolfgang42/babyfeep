export function collapseWhitespace(window) {
	// TODO all this text visibility code is for compatibility with the old implementation,
	// and should probably be reconsidered.
	const walker = window.document.createTreeWalker(window.document, window.NodeFilter.SHOW_TEXT)
	while (walker.nextNode()) {
		const node = walker.currentNode
		if (node.textContent === null) continue
		node.textContent = node.textContent?.replace(/\s+/g, ' ')
	}
}
export function collapseWhitespace_parse5(node) {
	if (node.nodeName === '#text') {
		node.value = node.value.replace(/\s+/g, ' ')
	} else if ('childNodes' in node) {
		for (const child of node.childNodes) {
			collapseWhitespace_parse5(child)
		}
	}
}
