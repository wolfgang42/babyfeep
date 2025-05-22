#!/usr/bin/env nix-shell
#!nix-shell ./shell.nix --pure -i bash
set -eu -o pipefail
cd "$(realpath "$(dirname "$0")")"

node() { # TODO this is not necessary in Node 23+
	command node --experimental-strip-types --disable-warning=ExperimentalWarning "$@"
}

mkdir -p data/derive/htpack

for f in data/download/warc/*.warc.gz; do
	file="$(basename "$f" .warc.gz)"

	if [ ! -e "data/derive/htpack/$file.htpack" ]; then
		# TODO some htpack builds are failing; I don't feel like
		# investigating why right now, so this just ignores that problem.
		if node ./build_htpack.ts "$file"; then
			mv "data/derive/htpack/$file.htpack"{.tmp,}
		fi
	fi
done
