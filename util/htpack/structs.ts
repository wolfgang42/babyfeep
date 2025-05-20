export const LITTLE_ENDIAN = true
export const U8_MAX = (2**8)-1
export const U32_MAX = (2**32)-1

export interface Struct<T> {
	size: number
	new(buf: DataView, off: number): T
}

export class FileHeader {
	static readonly size = 4
	public readonly buf: DataView
	public readonly off: number
	
	constructor(buf: DataView, off: number) {
		this.buf = buf; this.off = off
	}
	
	get endOff(){return this.off+FileHeader.size}
	
	toBytes(){return new Uint8Array(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength)}
	
	get metadataLen() {
		return this.buf.getUint32(this.off+0, LITTLE_ENDIAN)
	}
	set metadataLen(value: number) {
		if (!Number.isInteger(value) || value < 0 || value > U32_MAX) throw new Error('bad value '+JSON.stringify(value))
		this.buf.setUint32(this.off+0, value, LITTLE_ENDIAN)
	}
}

export class ElementHeader {
	static readonly size = 17
	public readonly buf: DataView
	public readonly off: number
	
	constructor(buf: DataView, off: number) {
		this.buf = buf; this.off = off
	}
	
	get endOff(){return this.off+ElementHeader.size}
	
	toBytes(){return new Uint8Array(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength)}
	
	get name() {
		return this.buf.getUint8(this.off+0)
	}
	set name(value: number) {
		if (!Number.isInteger(value) || value < 0 || value > U8_MAX) throw new Error('bad value '+JSON.stringify(value))
		this.buf.setUint8(this.off+0, value)
	}
	
	get textLen() {
		return this.buf.getUint32(this.off+1, LITTLE_ENDIAN)
	}
	set textLen(value: number) {
		if (!Number.isInteger(value) || value < 0 || value > U32_MAX) throw new Error('bad value '+JSON.stringify(value))
		this.buf.setUint32(this.off+1, value, LITTLE_ENDIAN)
	}
	
	get textStart() {
		return this.buf.getUint32(this.off+5, LITTLE_ENDIAN)
	}
	set textStart(value: number) {
		if (!Number.isInteger(value) || value < 0 || value > U32_MAX) throw new Error('bad value '+JSON.stringify(value))
		this.buf.setUint32(this.off+5, value, LITTLE_ENDIAN)
	}
	
	get attrLen() {
		return this.buf.getUint32(this.off+9, LITTLE_ENDIAN)
	}
	set attrLen(value: number) {
		if (!Number.isInteger(value) || value < 0 || value > U32_MAX) throw new Error('bad value '+JSON.stringify(value))
		this.buf.setUint32(this.off+9, value, LITTLE_ENDIAN)
	}
	
	get childLen() {
		return this.buf.getUint32(this.off+13, LITTLE_ENDIAN)
	}
	set childLen(value: number) {
		if (!Number.isInteger(value) || value < 0 || value > U32_MAX) throw new Error('bad value '+JSON.stringify(value))
		this.buf.setUint32(this.off+13, value, LITTLE_ENDIAN)
	}
}

export class Attribute {
	static readonly size = 5
	public readonly buf: DataView
	public readonly off: number
	
	constructor(buf: DataView, off: number) {
		this.buf = buf; this.off = off
	}
	
	get endOff(){return this.off+Attribute.size}
	
	toBytes(){return new Uint8Array(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength)}
	
	get name() {
		return this.buf.getUint8(this.off+0)
	}
	set name(value: number) {
		if (!Number.isInteger(value) || value < 0 || value > U8_MAX) throw new Error('bad value '+JSON.stringify(value))
		this.buf.setUint8(this.off+0, value)
	}
	
	get size() {
		return this.buf.getUint32(this.off+1, LITTLE_ENDIAN)
	}
	set size(value: number) {
		if (!Number.isInteger(value) || value < 0 || value > U32_MAX) throw new Error('bad value '+JSON.stringify(value))
		this.buf.setUint32(this.off+1, value, LITTLE_ENDIAN)
	}
}

export class PageHeader {
	static readonly size = 12
	public readonly buf: DataView
	public readonly off: number
	
	constructor(buf: DataView, off: number) {
		this.buf = buf; this.off = off
	}
	
	get endOff(){return this.off+PageHeader.size}
	
	toBytes(){return new Uint8Array(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength)}
	
	get metadataLen() {
		return this.buf.getUint32(this.off+0, LITTLE_ENDIAN)
	}
	set metadataLen(value: number) {
		if (!Number.isInteger(value) || value < 0 || value > U32_MAX) throw new Error('bad value '+JSON.stringify(value))
		this.buf.setUint32(this.off+0, value, LITTLE_ENDIAN)
	}
	
	get packLen() {
		return this.buf.getUint32(this.off+4, LITTLE_ENDIAN)
	}
	set packLen(value: number) {
		if (!Number.isInteger(value) || value < 0 || value > U32_MAX) throw new Error('bad value '+JSON.stringify(value))
		this.buf.setUint32(this.off+4, value, LITTLE_ENDIAN)
	}
	
	get textLen() {
		return this.buf.getUint32(this.off+8, LITTLE_ENDIAN)
	}
	set textLen(value: number) {
		if (!Number.isInteger(value) || value < 0 || value > U32_MAX) throw new Error('bad value '+JSON.stringify(value))
		this.buf.setUint32(this.off+8, value, LITTLE_ENDIAN)
	}
}
