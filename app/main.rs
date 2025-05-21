mod lookup;

use maud::html;
use url::Url;
use tiny_http::{Server, Response, Method};

fn main() {
	let index = lookup::SearchIndex::new().unwrap();

	let server = Server::http("0.0.0.0:4000").unwrap();

	for request in server.incoming_requests() {
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
						div {
							@let results = index.get_results(q.as_ref()).unwrap();
							@for result in results {
								p { a href=(result.url) { (result.title) } }
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
