#!/usr/bin/env nix-shell
#!nix-shell ./shell.nix --pure -i bash
set -eu -o pipefail
cd "$(realpath "$(dirname "$0")")"

curl -s --location 'https://devdocs.io/docs.json' > "data/download/docs.json.tmp"
mv -f data/download/docs.json{.tmp,}

cat wantdocs.txt | while read -r slug; do
	# NOTE: there's a race condition between the `mtime` we get from `docs.json` and
	# the actual state of the file. This script has been carefully designed to ameliorate this:
	# since we get `docs.json` first, it should always be older than the file we download;
	# so, if the docs are being updated simultaneously with our download,
	# we'll possibly update it again needlessly next time, but should never wind up with
	# a stale download that we can't tell is out of date.
	
	mtime="$(jq -r '.[] | select(.slug == "'"$slug"'") | .mtime' data/download/docs.json)"
	if [ -e "data/download/$slug.db.json" ]; then
		old_mtime="$(getfattr -n user.feep.datasource.devdocs.mtime --only-values "data/download/$slug.db.json")"
		if [ "$old_mtime" != "$mtime" ]; then
			rm -f "data/download/$slug.db.json" # Out of date
		fi
	fi

	if [ ! -e "data/download/$slug.db.json" ]; then
		echo "devdocs: download $slug.db.json" >&2
		wget --quiet -O "data/download/$slug.db.json.tmp" "https://documents.devdocs.io/$slug/db.json"
		setfattr -n user.feep.datasource.devdocs.mtime -v "$mtime" "data/download/$slug.db.json.tmp"
		mv -f "data/download/$slug.db.json"{.tmp,}
	fi
done
