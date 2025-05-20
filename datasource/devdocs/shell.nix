{ sources ? import ../../nix/sources.nix }:
let
  # default nixpkgs
  pkgs = import sources.nixpkgs { };
in
pkgs.mkShell {
  buildInputs = builtins.attrValues {
    inherit (pkgs)
      attr
      cacert
      curl
      jq
      wget
      ;
  };
  # TODO workaround for $TMPDIR being incorrectly set to /var/run/$uid/:
  # https://github.com/NixOS/nix/issues/395
  shellHook = "unset TMPDIR";
}
