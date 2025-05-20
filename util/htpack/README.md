Feep! uses a custom file format called “htpack” as an intermediate structure for parsed HTML files. This is less necessary for this toy version, but I included it anyway, both because it lets me reuse code and because it is quite helpful.

HTPack is a serialization of the DOM which has several advantages for our purposes:

* The HTML5 parsing algorithm is complicated and has a lot of edge cases, which makes it kind of slow. With HTPack we can do that work once and reuse it later.
* HTPack files are generally smaller than the source HTML text.
* HTPack files store the text and the HTML structure separately. This is mildly convenient for fulltext indexing (we don’t have to reconstruct the text by traversing the tree and concatenating), and also lets us do unusual things like jumping straight to the DOM for a specific offset in the text (not necessary for anything here, but Feep! will eventually get syntax highlighting directly in the search results, and this makes that much more efficient).

The general structure of an HTPack file is:

* A header, the string `Pak1` + a u32 length-prefixed JSON blob of metadata (which is currently unused, so in practice the header is always `"Pak1\x02\x00\x00\x00{}"`)
* A series of pages, which start with u32s for metadata, structure (“pack”), and text length, followed immediately by concatenated blobs of those lengths. Metadata is a JSON string, text is the utf8-encoded full text of the page.

The pack structure is a collection of Element structs. The data for an element struct is:
* elementName (u8): the tag for this element, as an index into a list of known tags (or `0` for unknown or custom tags)
* textLength (u32), textStart (u32): byte length and byte offset from the start of the page text, containing the text enclosed in this element and its children. (If there is no text, both are zero.) This is guaranteed to always be a valid utf8 string, not pointing into the middle of a multibyte codepoint.
* attrLen (u32): size in bytes of the attribute data for this element, which appears immediately after the element struct in the pack data. (Attribute data is also packed, see the code for details.)
* childLen (u32): size in bytes of the data for elements that are a child of this element; this data appears immediately after the end of the attribute data for this element.

This gives a lot of flexibility for how to access the data:

* Most obviously, as a tree, by starting with the first Element (whose `childLen` is guaranteed to contain the remaining elements) and traversing downward by reading `childLen` elements before going back to the parent.
* As a flat list, by ignoring `childLen` altogether and reading each Element in order. (This is useful for things like “extract every `<a href>` from the document”.)
* To find only the structure around a specific piece of text: traverse the tree, but skip over any elements where `textStart` is before the needle offset. (This is approximately equivalent to traversing a B-tree, though performance is dependent on document structure. This could be optimized to actually guarantee a certain amortized performance by inserting ersatz nodes into large element lists, though I haven’t bothered to do that.)
