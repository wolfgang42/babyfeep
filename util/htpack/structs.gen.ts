import * as fs from 'node:fs'

type DataType = 'u8' | 'u32'

const SIZEOF: {[k in DataType]: number} = {
	u8: 1,
	u32: 4,
}

function* genStruct(name: string, fields: {[k: string]: DataType}) {
	yield `export class ${name} {`
	yield `\tstatic readonly size = ${Object.entries(fields).reduce((s, [_, v]) => s+SIZEOF[v], 0)}`
	yield `\tpublic readonly buf: DataView`
	yield `\tpublic readonly off: number`
	yield '\t'
	yield `\tconstructor(buf: DataView, off: number) {`
	yield `\t\tthis.buf = buf; this.off = off`
	yield `\t}`
	yield `\t`
	yield `\tget endOff(){return this.off+${name}.size}`
	yield `\t`
	yield `\ttoBytes(){return new Uint8Array(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength)}`
	let off = 0
	for (const [k, t] of Object.entries(fields)) {
		yield `\t`
		yield `\tget ${k}() {`
		if (t === 'u8') {
			yield `\t\treturn this.buf.getUint8(this.off+${off})`
		} else if (t === 'u32') {
			yield `\t\treturn this.buf.getUint32(this.off+${off}, LITTLE_ENDIAN)`
		} else {
			throw new Error('unknown type')
		}
		yield `\t}`
		yield `\tset ${k}(value: number) {`
		// TODO validate value
		yield `\t\tif (!Number.isInteger(value) || value < 0 || value > ${t.toUpperCase()}_MAX) throw new Error('bad value '+JSON.stringify(value))`
		if (t === 'u8') {
			yield `\t\tthis.buf.setUint8(this.off+${off}, value)`
		} else if (t === 'u32') {
			yield `\t\tthis.buf.setUint32(this.off+${off}, value, LITTLE_ENDIAN)`
		} else {
			throw new Error('unknown type')
		}
		yield `\t}`
		off += SIZEOF[t]
	}
	yield '}'
	yield ''
}

const gen: string[] = []
gen.push('export const LITTLE_ENDIAN = true')
gen.push('export const U8_MAX = (2**8)-1')
gen.push('export const U32_MAX = (2**32)-1')
gen.push('')

gen.push('export interface Struct<T> {')
gen.push('\tsize: number')
gen.push('	new(buf: DataView, off: number): T')
gen.push('}')
gen.push('')

gen.push(...Array.from(genStruct('FileHeader', {
	metadataLen: 'u32',
})))

gen.push(...Array.from(genStruct('ElementHeader', {
	name: 'u8', // ElementName
	textLen: 'u32',
	textStart: 'u32',
	attrLen: 'u32',
	childLen: 'u32',
})))

gen.push(...Array.from(genStruct('Attribute', {
	name: 'u8', // AttributeName
	size: 'u32',
})))

gen.push(...Array.from(genStruct('PageHeader', {
	metadataLen: 'u32',
	packLen: 'u32',
	textLen: 'u32',
})))

fs.writeFileSync('structs.ts', gen.join('\n'))
