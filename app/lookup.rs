use std::os::fd::AsRawFd;
use anyhow::Result;
use tantivy::IndexReader;
use tantivy::TantivyDocument;
use tantivy::schema::Value;

pub struct SearchIndex {
	pub index: tantivy::Index,
	pub reader: IndexReader,
}

pub struct SearchResult {
	pub url: String,
	pub title: String,
	pub snippet: tantivy::snippet::Snippet,
}

impl SearchIndex {
	pub fn new(index_path: &std::path::PathBuf) -> Result<SearchIndex, anyhow::Error> {
		// Lock the index
		let index_lock = std::fs::File::open(index_path.join("feep.lock")).unwrap_or_else(|_| {
			panic!("Error: Could not open index lock file");
		});
		// Acquire a flock(2)-based lock on the index. Shared, so multiple readers can
		// access it at once; non-blocking, because if someone has an exclusive lock on it,
		// it's the GC in tantivy/build.sh which will be in the process of deleting the index!
		// In the unlikely event we hit that race condition, the best thing to do is to
		// exit and be restarted, at which point we'll see the new index and all will be well.
		// (There's a more complicated scheme to avoid this, where we take a separate lock
		// while resolving the symlink, but it doesn't seem worth it.)
		// NOTE: Rust has File.lock_shared() as an experimental feature, but it doesn't provide
		// particularly helpful guarantees, so for the moment we use libc directly.
		// SAFETY: this is a straightforward function which fortunately doesn't have much to go wrong.
		if unsafe{libc::flock(index_lock.as_raw_fd(), libc::LOCK_SH|libc::LOCK_NB)} != 0 {
			panic!("Error: Could not lock index");
		}
		// We leak the file descriptor and associated lock, but that's fine because
		// we want it to stay locked until the process exits anyway, at which point
		// the OS will clean it up for us.
		// (TODO implement Drop for SearchIndex instead.)
		std::mem::forget(index_lock);

		// Open the index
		let indexdir = tantivy::directory::MmapDirectory::open(index_path)?;
		let index = tantivy::Index::open(indexdir)?;
		let reader = index.reader()?;
		Ok(SearchIndex { index, reader })
	}
	pub fn num_docs(&self) -> u64 {
		self.reader.searcher().num_docs()
	}
	pub fn get_results(&self, query: &str) -> Result<(usize, Vec<SearchResult>), anyhow::Error> {
		let searcher = self.reader.searcher();
		// TODO depending on field offsets seems awkward
		let field_url = tantivy::schema::Field::from_field_id(0);
		let field_title = tantivy::schema::Field::from_field_id(1);
		let field_body = tantivy::schema::Field::from_field_id(2);
		let query_parser = tantivy::query::QueryParser::for_index(&self.index, vec![
			field_title, field_body,
		]);
		let query = query_parser.parse_query(query)?;
		let snippeter = tantivy::snippet::SnippetGenerator::create(&searcher, &query, field_body)?;
		let (doc_count, top_docs) = searcher.search(&query, &(
			tantivy::collector::Count,
			tantivy::collector::TopDocs::with_limit(10),
		))?;
		let results = top_docs.iter().map(|(_score, doc_address)| {
			let retrieved_doc: TantivyDocument = searcher.doc(*doc_address).unwrap();
			let url = retrieved_doc.get_first(field_url).unwrap().as_str().unwrap();
			let title = retrieved_doc.get_first(field_title).unwrap().as_str().unwrap();
			let snippet = snippeter.snippet_from_doc(&retrieved_doc);
			SearchResult {
				url: url.to_string(),
				title: title.to_string(),
				snippet,
			}
		}).collect::<Vec<_>>();
		Ok((doc_count, results))
	}
}