#!/usr/bin/env nix-shell
#!nix-shell ./shell.nix --pure -i bash
set -eu -o pipefail
cd "$(realpath "$(dirname "$0")")"

node() { # TODO this is not necessary in Node 23+
	command node --experimental-strip-types --disable-warning=ExperimentalWarning "$@"
}

mkdir -p data/download/robots data/derive/lists

cat wantorigins.txt | while read -r origin; do
	originurl="$(echo "$origin" | jq -Rr @uri)"
	### Read robots.txt ###
	if [ ! -e "data/download/robots/$originurl.txt" ]; then
		echo "$origin/robots.txt"
		if curl -s --location "$origin/robots.txt" > "data/download/robots/$originurl.txt.tmp"; then
			mv "data/download/robots/$originurl.txt"{.tmp,}
		fi
	fi

	if [ ! -e "data/download/robots/$originurl.txt" ]; then
		echo "No robots.txt found for $origin"
		continue
	fi

	if [ -e "data/download/warc/$originurl/" ]; then
		# TODO it would be nice to be able to get future updates; unfortunately
		#      wget's CDX files don't record the original URL, so for redirects
		#      we would instead hammer the server with the same URL over and over.
		echo "Already downloaded $origin"
		continue
	fi

	### Determine list of URLs to crawl ###
	# TODO the below `cut` is needed because canonical URLs have fragments, which seems like it ought to be fixed upstream.
	node ./checkrobots.ts "$origin" |
		cut -d'#' -f1 |\
		LC_ALL=C sort --unique \
		> "data/derive/lists/$originurl.txt.tmp"
	mv "data/derive/lists/$originurl.txt"{.tmp,}

	### Download the URLs ###
	mkdir -p "data/download/warc/$originurl/"
	# NOTE: we don't write to a tempfile here; if this falls over halfway through we'll still
	#       have gotten some results, and we'll pick up where we left off next time.
	# TODO I don't want to follow redirects here because (a) they ought to be handled by canonicalization instead,
	#      and (b) I don't want to download the same URL twice. However, wget doesn't record suppressed
	#      redirects in the CDX, so without following them we will keep trying to hit the same URLs again on every run.
	# TODO Also, wget has the unfortunate property of not being very good about stopping on errors,
	#      which will cause us to impolitely continue hitting the server even if it's unhappy.
	#      I think I really need to take control of this and just build my own tool.
	<"data/derive/lists/$originurl.txt" ../../util/warc/wget-warc-ifnew \
		"data/download/warc/$originurl" \
		--max-redirect=1 \
		--header='User-Agent: Baby-FeepBot (+https://search.feep.dev/about/feepbot)' \
		|| true
done
