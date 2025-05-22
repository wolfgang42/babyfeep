# Baby Feep!
**Baby Feep!** is a tiny search engine,
derived from the source code of its slightly bigger brother
[Feep! Search](https://search.feep.dev/).

## Architecture

### General philosophy
Feep! is built with traditional UNIX philosophy in mind,
leaning heavily on shell scripts and ordinary files for orchestration.

#### Data directories
Data is split generally into two categories: `download` and `derive`.
To be polite, we want to download only when necessary, so the download scripts are kept as simple as possible,
to avoid re-downloading data a bunch of times while debugging something that’s gone wrong.
By contrast, rebuilding derived data is our own problem and nobody else’s.

See also the section on Testing for another way this is useful.

### Crawler
#### Data from devdocs.io
To get started quickly, I took the shortcut of using data from [devdocs.io](https://devdocs.io), which conveniently has
[its own crawler](https://github.com/freeCodeCamp/devdocs?tab=readme-ov-file#scraper)
and so makes it trivial to get pages and start indexing them.
See `datasource/devdocs` for how this data is processed.

#### Live crawl
Since devdocs doesn’t have all of the origins that Kagi requested, I also added a “live web” crawl.

I took a shortcut here, resulting in some work not shown:
the list of URLs to download was derived from Feep!’s dataset,
where I already have a database of links and pagerank information about them,
so I simply queried for the top 1k links from each origin.
(See the `datasource/web` README for a full explanation of where this data came from.)

Another option would have been to use `wget --recursive` (or one of many similar tools):
this is straightforward to start with, but my experience has been that
the “direct recursion” approach has too many edge cases and not enough flexibility.
It’s useful for a web crawler to focus on popular documents first
and be able to adjust crawl frequency on a per-page basis,
and also important to be able to stop and restart crawls on demand.
None of this is possible if the recursion logic is directly tied to page crawling.

Instead, Feep! takes a batch crawling approach: starting from the current data set,
we determine which missing pages are the most interesting or important, and retrieve them.
This data then gets fed into the next batch, ensuring that we don’t spend too much time looking at content that turns out to be unimportant.
(Indeed, this approach largely eliminates “crawler traps” without any special handling:
even if a few such links make it into the dataset, they will tend to lose PageRank quickly since nobody links to them,
so the crawler gets bored and stops looking at them.)

Crawling is surprisingly complicated, and there are
[a lot of ways](https://memex.marginalia.nu/log/32-bot-apologetics.gmi)
[it can go wrong](https://utcc.utoronto.ca/~cks/space/blog/web/BingbotFrontPageBlock).
For this demonstration,
`wget` and WARC are used for the reasons I explain in [this blog post](https://search.feep.dev/blog/post/2022-08-10-crawling-roadmap).
(In particular, WARC has the convenient property that it’s both standard and easy to do streaming processing on;
the latter is very important for performance on spinning rust hard drives.
Splitting the data by origin is both convenient for debugging and also makes it more likely to gzip well,
since pages on the same site likely have a similar structure.)
However, experience has shown that `wget` has some behaviors that are undesirable for general crawling
(see `datasource/web/download.sh` for some commentary on this),
so at some point I intend to investigate other options. I suspect that the requirements
are specialized enough that it makes sense to build my own on top of something like `libcurl`.

##### Proxy use
The take-home assignment I extracted this code for has the following note which I don’t entirely understand;
I assume this is not just asking to explain the conventional `HTTP_PROXY` env var or how to set up SOCKS4:

> Proxy use is not needed (but describe how would you employ such strategy).

Interpreting it as “describe how to crawl from more than one IP address”:
generally you would want to do this to avoid rate limits,
or because the crawl is so big one single machine can’t handle the network bandwidth in a reasonable amount of time.
In either case, I would shard the URL lists and distribute them amongst multiple crawl servers;
`snakemake` (discussed more below) is likely a useful tool for coordinating this process.

### Preprocessing
After crawling, it is necessary to convert the raw HTML to plain text, plus additional metadata like titles.
Feep!—and therefore this miniature version of it—uses a custom intermediate format called “HTPack”
to store a serialized representation of the DOM in an unusual format optimized for the search engine use case.
Documentation on the internals of this format can be found in the `util/htpack/` README.
This is less necessary for our small-scale setup, but it provides some useful optimizations
like reducing the amount of time spent reparsing the HTML during reindexing.

While doing this processing, some modifications are made to the structure of the HTML;
see the section on relevance below for a brief discussion about this.

### Index
Indexing is performed with Tantivy, using a small script which extracts the HTPack files and inserts them
into the index. For simplicity, this version recreates the entire index from scratch whenever anything changes.
Ideally it would instead cache index segments separately, and then merge them into the final index,
but that seems to require a lot of rummaging in the internals of Tantivy to implement
and the current version is fast enough.
(It would also be even faster if I wrote an HTPack reader in Rust instead of piping JSON out of Node.)

#### Considerations for library selection
After skimming the documentation for both Tantivy and Vespa, I decided to use Tantivy due to its simplicity.
Vespa appears to do more out of the box, but that alluring capability may hide a danger.
As [Joel Spolsky wrote](https://www.joelonsoftware.com/2001/10/14/in-defense-of-not-invented-here-syndrome/):

> **If it’s a core business function — do it yourself, no matter what.**

Tantivy appears to be designed as a straightforward collection of libraries which can be combined and modified as needed;
this should mean that it’s much easier to understand and modify as the need arises.
Since the search engine *is the core product,* not a feature of something else we’re building,
this ability is critical to ensure we can iterate quickly and build on a good foundation.

By contrast, the Vespa quick start involves setting up Docker images
and writing XML files to configure “container clusters” which provide configuration for application lifecycle management.
This makes sense for a “set and forget” setup,
but the additional layers of indirection seem likely to make it more difficult to dig in and customize
when we need to investigate a ranking problem or add an unusual feature.

Additionally, the internals of Feep! are structured around CLI scripts that receive and output ordinary files.
Tantivy fits well into this structure; ElasticSearch’s separate server and cluster management
(which Vespa appears to share) have been a source of friction throughout Feep!’s development.

## Ranking
This is by far the most complicated part of building a search engine (crawling notwithstanding);
[entire academic conferences](https://trec.nist.gov/) exist about it and it’s still not a solved problem.
For this demonstration, I did not bother to do very much about it; there are a lot of options
that could be implemented at various stages in the pipeline
(for example, I looked briefly into Tantivy’s `TopDocs.tweak_score()` / `TopDocs.custom_score()` API),
but correctly evaluating ranking designs is very tricky:
there are a lot of methodologies to do it, and it’s very easy to accidentally over-optimize
a specific test case and make other rankings worse in the process.
Some of the below have been implemented in Feep! (such as HTML cleanup);
most have not and were culled from my notes for future investigation.

* **Preprocessing**
  * URL canonicalization and normalization
  * Clean up the HTML (I'm doing a very rudimentary version of this by removing oft-irrelevant `<nav>` elements) to make the data less noisy, for example with Readability.js
  * Otherwise improve semantics extraction from HTML, for example by looking at ARIA tags (though I hear these are often incorrect)
  * Detect ad infestations, which likely correlate with less desirable pages
* **Indexing**
  * Remove duplicate URLs - this is a huge and obvious one: at the moment, if we index a page with multiple redirects to it, the page appears multiple times in the index. I mainly didn’t implement deduplication because `tantivy-cli` doesn’t have a way to specify documents should be replaced and I didn’t feel like reimplementing the bits I needed in Rust.
  * Detect multiple versions of the same page - by using some kind of textual perceptual hash to detect similar content. Tuning this threshold is somewhat tricky, though.
  * For very long pages (like a lot of Python documentation, for example), index the sections as separate documents so that the keywords in one section appear more relevant instead of getting drowned out by all the other things on the page.
  * Adding PageRank or Personalized PageRank, or other improvements to pagerank like weighted pagerank.
* **Ranking**
  * Investigate ranking evaluation (MBT-17)
  * Fiddling with BM25 and TF-IDF, for example to adjust the minimum ranking.
  * Adding vector search.
  * Rank keywords higher when the font size is bigger, or the text is near the top of the page.
  * Diversify search results by detecting similar results near each other and allowing less-related content to bubble up in between them, to make it more likely that a user will find what they’re looking for by scrolling down a bit.
  * Synonym support
  * Feed “Was this result useful?” and clickstream data back upstream
  * Option to boost recently updated documents
  * Allow users to directly control up/downranking; “lenses”
* **Frontend display**
  * Quickresults (what DDG calls “instant answers”) for searches we can provide direct answers to
  * Collapsing many results from the same origin and showing “More from example.com »”, to avoid flooding the results
  * Search operators, to allow users to more directly specify their needs
  * For programming resources specifically, a common source of near-duplicates is multiple versions of a piece of software.
    I have some thoughts on heuristics that might be able to detect this situation and collapse these documents
    into one result with a version selector.
  * Topic modeling and latent semantic analysis of results, to help users specify “when I said ‘Apache Arrow’ I meant the open source project, not the indigenous knapped flint”
  * Page info bar, StackOverflow embed, and other rich results

### Frontend
The frontend is a hastily thrown together Rust server;
it uses `tiny_http` and `maud` and is single-threaded
(other than the threads that Tantivy sets up internally)
because that was the simplest thing that worked.

I didn't bother to style (or even properly format) the results;
look at [search.feep.dev](https://search.feep.dev) if you want to see
the stylesheet I would have copy-pasted.

## Installation and deployment
Feep! uses [Nix](https://nixos.org/) to manage dependencies,
partly as convenient way to install packages without using `apt` to get them globally,
and partly to try to make sure that derived data is as reproducible as possible:
if package upgrades cause weird problems being able to `git bisect` is helpful.

Other than Nix, and a suitably POSIX-y environment, there should not be any other system dependencies,
since Nix takes care of managing the remainder of the dependencies and keeping them isolated.

### Setup
To set things up from a fresh checkout:
1. Create a `.data` directory in the repository root.
   This can be either `mkdir .data`, or a symlink to a directory somewhere else.
   
   This indirection exists for two main reasons:
   * For size reasons, the data is stored on a spinning-rust hard drive,
     and `.data` is a symlink to that separate filesystem:
     Feep! is carefully optimized in various ways to keep this performant
     (though many things will still be faster if you have enough free RAM
     for the kernel to keep a nicely-sized disk read cache).
   * Data can be shared between prod and dev instances by way of of hardlinks,
     for which having a single root data directory that can be copied is helpful.
     (Build scripts are careful to never modify files once written.
     In hindsight it would be slightly simpler to require a filesystem with snapshot support,
     but frankly this hasn’t proven to be a major limitation anyway).
1. Run `./setup.sh`, which will install npm packages (these are in a weird half-nixified state at present).
1. Run `./download-all.sh`, which will do the downloading and crawling for all the datasources.
1. Run `./build-all.sh`, which will do a lot of computation and eventually produce the index files.
1. Run `./app/serve.sh`, which will start the server.

### Testing
Feep! does not have unit or integration tests,
because the code and architecture is still very much in flux
and regressions haven’t happened often enough to make it worth it.
So far experience has shown that almost all of the changes can be split into two categories:
* Changes so major that tests would have to be replaced anyway.
* Refactors where the result should be identical:
  in this case, we can use [`cmp`](https://www.gnu.org/software/diffutils/manual/html_node/Invoking-cmp.html)
  to check the result against the production version and make sure nothing changed.
  (In theory there could be latent bugs that don’t show up in the current dataset,
  but in practice this doesn’t seem to happen:
  the dataset is broad enough that it should contain most edge cases,
  and if a bug falls in a forest and nobody sees it, does it really exist?)
  
  The main Feep! codebase has a `diff-to-prod` utility to assist with verifying and debugging this situation.
  This is also a major reason for the data to be split into `download` and `derive`:
  when making major refactors or updating dependencies, we can delete the `derive` folder,
  recompute everything from scratch, and then compare to make sure that no changes occurred.

### Production deployment
#### Crawl and build servers
Feep! is currently written without much parallelism, since my (very old) server only has two CPU cores anyway
so this wouldn’t make a significant difference for most tasks.
To change this, I would consider migrating the shell scripts to [`snakemake`](https://snakemake.github.io/),
which can not only manage parallel tasks but also supports farming out jobs to multiple servers,
useful if we want to horizontally scale the indexing process.

#### Web servers
A production web server needs only:
* A readonly view on `.data/tantivy/index`
* The `app/` release binary
* A place to write logs

This means that horizontally scaling for read load is trivial: spin up a new server,
`rsync` the index data and frontend binary over, and start the service.

(Vertically scaling for index size would be rather more complicated:
you’d have to shard the index and then teach the frontend servers how to talk to each other.
This is left as an exercise for the writer.)
