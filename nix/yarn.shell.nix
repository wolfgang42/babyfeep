{ sources ? import ./sources.nix }:
let
  # default nixpkgs
  pkgs = import sources.nixpkgs {
    overlays = [
      # We need to use an overlay here because we also need to override what 'pkgs.yarn' uses
      (final: prev: {nodejs = prev.nodejs_22;})
    ];
  };
in
pkgs.mkShell {
  buildInputs = builtins.attrValues {
    inherit (pkgs)
      yarn
      git
      nodejs
      cacert
      cargo
      ;
  };
}
