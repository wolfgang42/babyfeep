#!/usr/bin/env bash
set -eu -o pipefail
cd "$(realpath "$(dirname "$0")")"

for f in ./datasource/*/build.sh; do
	"$f"
done

./tantivy/build.sh
