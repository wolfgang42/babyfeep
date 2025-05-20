#!/usr/bin/env nix-shell
#!nix-shell ./shell.nix --pure -i bash
set -eu -o pipefail
cd "$(realpath "$(dirname "$0")")"

node() { # TODO this is not necessary in Node 23+
	command node --experimental-strip-types --disable-warning=ExperimentalWarning "$@"
}

for f in $(ls -1 data/download/*.db.json); do
	slug="$(basename "$f" .db.json)"
	db_mtime="$(getfattr -n user.feep.datasource.devdocs.mtime --only-values "data/download/$slug.db.json")"
	if [ -e "data/derive/$slug.htpack" ]; then
		htpack_mtime="$(getfattr -n user.feep.datasource.devdocs.mtime --only-values "data/derive/$slug.htpack")"
		if [ "$db_mtime" != "$htpack_mtime" ]; then
			rm -f "data/derive/$slug.htpack" # Out of date
		fi
	fi

	if [ ! -e "data/derive/$slug.htpack" ]; then
		echo "devdocs: derive $slug.htpack" >&2
		node ./build_htpack.ts "$slug"
		setfattr -n user.feep.datasource.devdocs.mtime -v "$db_mtime" "data/derive/$slug.htpack.tmp"
		mv "data/derive/$slug.htpack"{.tmp,}
	fi
done
