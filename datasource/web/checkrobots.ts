import fs from 'node:fs/promises'
import fs_raw from 'node:fs'
import {pipeline} from 'node:stream/promises'
import robotsParser from 'robots-parser'
import {SplitLines} from '../../util/iterutil.ts'

const USERAGENT = 'Baby-FeepBot (+https://search.feep.dev/about/feepbot)'

const origin = process.argv[2]

var robots = robotsParser(
	`${origin}/robots.txt`,
	await fs.readFile(`${import.meta.dirname}/data/download/robots/${encodeURIComponent(origin)}.txt`, 'utf8')
)

// TODO robots.getPreferredHost(); // example.com
// TODO robots.getCrawlDelay('Sams-Bot/1.0'); // 1
// TODO robots.getSitemaps(); // ['http://example.com/sitemap.xml']

await pipeline(
	async function*() {
		const stream = fs_raw.createReadStream(`${import.meta.dirname}/data/derive/want/${encodeURIComponent(origin)}`)
		for await (const url of stream.pipe(new SplitLines())) {
			if (robots.isAllowed(url, USERAGENT)) {
				yield url+'\n'
			} else {
				console.error(url)
			}
			if (robots.isAllowed(url, USERAGENT) === robots.isDisallowed(url, USERAGENT)) {
				console.error('ERROR: isAllowed and isDisallowed are the same for', url)
			}
		}
	}(),
	process.stdout,
)
