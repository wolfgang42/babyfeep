Nix is used partly as convenient way to install packages without using `apt` to get them globally, and partly to try to make sure that derived data is as reproducible as possible; if package upgrades cause weird problems being able to `git bisect` them is helpful.

I'm not at all sure I'm holding Nix correctly (my setup was hacked together from several tutorials I only sort of understand), but it seems to work and I'm slowly learning more and piecing together why.

To update:
```
# get branch and rev from https://status.nixos.org/
niv update nixpkgs --branch ... --rev ...
```
