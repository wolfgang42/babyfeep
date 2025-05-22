mod lookup;

use maud::{html, PreEscaped};
use url::Url;
use tiny_http::{Server, Response, Method};

fn main() {
	let index_path = std::env::args().nth(1).unwrap_or_else(|| {
		panic!("Usage: {} <index_path>", std::env::args().next().unwrap());
	});
	// Resolve index symlink, so the index we're reading from doesn't change under us
	let index_path = std::fs::canonicalize(index_path).unwrap_or_else(|_| {
		panic!("Error: Could not resolve index path");
	});

	println!("Start: v{} {:?}", env!("CARGO_PKG_VERSION"), index_path);
	let index = lookup::SearchIndex::new(&index_path).unwrap();

	let server = Server::http("0.0.0.0:4000").unwrap();

	for request in server.incoming_requests() {
		let headers = request.headers();
		let useragent = headers.iter()
			.find(|h| h.field.equiv("User-Agent"))
			.map(|h| h.value.as_str())
			.unwrap_or("unknown");
		println!("Req: {} {} {} {}", request.remote_addr().unwrap(), request.method(), request.url(), useragent);
		if *request.method() != Method::Get {
			let response = Response::from_string("Method Not Allowed").with_status_code(405);
			request.respond(response).unwrap();
			continue;
		}
		let response = if request.url() == "/" {
			Response::from_string(html! {
				(maud::DOCTYPE)
				html {
					head {
						meta charset="utf-8";
						meta name="viewport" content="width=device-width, initial-scale=1";
						title { "Baby Feep!" }
					}
					body {
						h1 { "Baby Feep!" }
						form action="/search" method="GET" {
							input type="text" name="q" placeholder="Search..." required;
							input type="submit" value="Search";
						}
						p {
							"Searching " (comma_thousands(index.num_docs())) { " documents" }
						}
					}
				}
			}).with_header(
				tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html"[..]).unwrap()
			)
		} else if request.url().starts_with("/search?") {
			let url = Url::parse("http://example.com").unwrap().join(request.url()).unwrap();
			let q = url.query_pairs().find(|(k, _)| k == "q").map(|(_, v)| v).unwrap_or_default();
			let start = std::time::Instant::now();
			let (doc_count, results) = index.get_results(q.as_ref()).unwrap();
			let elapsed = start.elapsed();
			Response::from_string(html! {
				(maud::DOCTYPE)
				html {
					head {
						meta charset="utf-8";
						meta name="viewport" content="width=device-width, initial-scale=1";
						title { "Baby Feep!" }
					}
					body {
						h1 { "Baby Feep!" }
						form action="/search" method="GET" {
							input type="text" name="q" value=(q) placeholder="Search..." required;
							input type="submit" value="Search";
						}
						p {
							"Found " (comma_thousands(doc_count.try_into().unwrap())) { " results in " }
							(PreEscaped(elapsed.as_millis().to_string())) { " ms" }
						}
						div {
							@for result in results {
								p {
									a href=(result.url) { (result.title) }
									(PreEscaped(result.snippet.to_html()))
								}
							}
						}
					}
				}
			}).with_header(
				tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html"[..]).unwrap()
			)
		} else {
			Response::from_string("Not found").with_status_code(404)
		};
		request.respond(response).unwrap();
	}
}

fn comma_thousands(num: u64) -> String {
	let mut s = num.to_string();
	let mut i = s.len() as i64 - 3;
	while i > 0 {
		s.insert(i as usize, ',');
		i -= 3;
	}
	s
}
