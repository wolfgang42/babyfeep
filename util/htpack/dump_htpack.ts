import {pipeline} from 'node:stream/promises'
import {readStream} from './file-reader.ts'

async function main() {
    try {
        await pipeline(
            process.stdin,
            readStream,
            async function* (stream) {
                for await (const doc of stream) {
                    yield JSON.stringify({
                        metadata: doc.metadata,
                        html: doc.document.toHtml(),
                    })+'\n'
                }
            },
            process.stdout,
        )
    } catch (e: any) {
        if (e?.code === 'EPIPE' && e?.syscall === 'write') {
            // Ignore EPIPE errors - this just means the reader closed the pipe before we finished writing
        }
        throw e
    }
}

main()
