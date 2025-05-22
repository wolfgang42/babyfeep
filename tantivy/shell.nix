{ sources ? import ../nix/sources.nix }:
let
  # default nixpkgs
  pkgs = import sources.nixpkgs { };
in
pkgs.mkShell {
  buildInputs = builtins.attrValues {
    inherit (pkgs)
      attr
      flock
      nodejs_22
      xxd
      ;
    tantivy_cli = pkgs.rustPlatform.buildRustPackage rec {
      pname = "tantivy-cli";
      version = "0.24";

      buildInputs = with pkgs; [];

      nativeBuildInputs = with pkgs; [ pkg-config ];

      src = pkgs.fetchFromGitHub {
        owner = "quickwit-oss";
        repo = pname;
        rev = version;
        hash = "sha256-bcuwC53p6K2UA7juMY3+uQ+czlbVCvMh3XL9p8Ycam8=";
      };

      cargoHash = "sha256-Q+B5DpbBYDEDuUCYk1PzwnBKr8QaF0psnnZDHe86XH8=";
    };
  };
  # TODO workaround for $TMPDIR being incorrectly set to /var/run/$uid/:
  # https://github.com/NixOS/nix/issues/395
  shellHook = "unset TMPDIR";
}
