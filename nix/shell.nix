{ sources ? import ./sources.nix }:
let
  # default nixpkgs
  pkgs = import sources.nixpkgs { };
in
pkgs.mkShell {
  buildInputs = builtins.attrValues {
    inherit (pkgs) niv;
  };
}
