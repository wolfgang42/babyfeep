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
}

impl SearchIndex {
	pub fn new() -> Result<SearchIndex, anyhow::Error> {
		let indexdir = tantivy::directory::MmapDirectory::open("../tantivy/data/index")?;
		let index = tantivy::Index::open(indexdir)?;
		let reader = index.reader()?;
		Ok(SearchIndex { index, reader })
	}
	pub fn get_results(&self, query: &str) -> Result<Vec<SearchResult>, anyhow::Error> {
		let searcher = self.reader.searcher();
		// TODO depending on field offsets seems awkward
		let field_url = tantivy::schema::Field::from_field_id(0);
		let field_title = tantivy::schema::Field::from_field_id(1);
		let field_body = tantivy::schema::Field::from_field_id(2);
		let query_parser = tantivy::query::QueryParser::for_index(&self.index, vec![
			field_title, field_body,
		]);
		let query = query_parser.parse_query(query)?;
		let top_docs = searcher.search(&query, &tantivy::collector::TopDocs::with_limit(10))?;
		let results = top_docs.iter().map(|(_score, doc_address)| {
			let retrieved_doc: TantivyDocument = searcher.doc(*doc_address).unwrap();
			let url = retrieved_doc.get_first(field_url).unwrap().as_str().unwrap();
			let title = retrieved_doc.get_first(field_title).unwrap().as_str().unwrap();
			SearchResult {
				url: url.to_string(),
				title: title.to_string(),
			}
		}).collect::<Vec<_>>();
		Ok(results)
	}
}