#!/usr/bin/env bash
set -eu -o pipefail
cd "$(realpath "$(dirname "$0")")"

nix-shell --pure --run 'yarn' nix/yarn.shell.nix
