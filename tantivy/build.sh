#!/usr/bin/env nix-shell
#!nix-shell ./shell.nix --pure -i bash
set -eu -o pipefail
cd "$(realpath "$(dirname "$0")")"

node() { # TODO this is not necessary in Node 23+
	command node --experimental-strip-types --disable-warning=ExperimentalWarning "$@"
}

tmpdir="$(mktemp -d data/XXXXXXXX.tmp)"

# Put all of the htpack files in one place so we can do our work without worrying about
# another process fiddling with the chunk list while we're processing it.
# (HTPack files are written atomically and never modified, so it's safe to share them with a hardlink.)
find ../datasource/devdocs/data/derive/ -name '*.htpack' | xargs -r sh -c 'cp --link "$@" '"$tmpdir"
find ../datasource/web/data/derive/htpack/ -name '*.htpack' | xargs -r sh -c 'cp --link "$@" '"$tmpdir"

# Come up with a unique stable identifer, by combining all of the hashes.
# This way if any of the htpack files change we will rebuild the index.
indexname="$(echo "$tmpdir"/*.htpack | sort | xargs getfattr --only-values -n user.feep.sha512 \
	| xxd -r -p | sha512sum | head -c16)"

rm -rf "data/index-$indexname.tmp" # In case we got interrupted in the middle of the build

if [ -e "data/index-$indexname" ]; then
	ln -fs "index-$indexname" data/index # Probably already right, but just in case we missed the link step
	rm -rf "$tmpdir"
	exit 0 # Already built
fi

cp -r index_template/ "data/index-$indexname.tmp/" # Create index
mkdir "data/index-$indexname.tmp/htpack/"

ls -1 "$tmpdir" | while read -r f; do
	echo "$(basename "$f")" >&2
	# Output data to index
	node ./dump_htpack.ts <"$tmpdir/$f"
	# Bundle a copy of the htpack file with the index for debugging
	# (and, in the future, for things like syntax highlighting)
	mv "$tmpdir/$f" "data/index-$indexname.tmp/htpack/"
done \
| tantivy index -i "data/index-$indexname.tmp/"

touch "data/index-$indexname.tmp/feep.lock" # Create lock file which will be used to prevent accidental GC

rmdir "$tmpdir"
mv "data/index-$indexname"{.tmp,}
ln -fs "index-$indexname" data/index

# Garbage collect old indexes
for i in data/index-*; do
	# Skip the current index
	[ "$i" = "data/index-$indexname" ] && continue
	# Take out an exclusive lock on the index before deleting it
	# so that we don't delete it out from under a running server;
	# see SearchIndex::new() for the other side of this.
	# Non-blocking so we just skip any indexes still in use.
	flock --exclusive --nonblock "$i/feep.lock" \
		rm -rf "$i" || true
done
