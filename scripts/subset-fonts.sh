#!/usr/bin/env bash
# Regenerates the self-hosted font subsets in src/assets/fonts (requires: pip install fonttools brotli).
#   mona-display-*  Mona Sans pinned to the semi-expanded width (wdth 112.5) at weight 600, for headlines
#   mona-sans-*     Mona Sans, normal width, variable weight, for text
#   martian-mono-*  Martian Mono, variable weight, for small technical labels
# Each family ships as a Latin file plus a tiny Romanian file (ă ș ț and capitals),
# so English visitors never download the Romanian glyphs.
set -euo pipefail
FS=node_modules/@fontsource-variable
OUT=src/assets/fonts
TMP=$(mktemp -d)
LATIN="U+0020-007E,U+00A0-00FF,U+2010-2027,U+2030-203A,U+2190-2193,U+2212,U+20AC,U+2122"
RO="U+0102-0103,U+0218-021B,U+015E-015F,U+0162-0163"
FEATURES="kern,liga,calt,case,tnum,ss01"
sub() { pyftsubset "$1" --unicodes="$2" --layout-features="$FEATURES" --flavor=woff2 --output-file="$3"; }
display() { fonttools varLib.instancer "$1" wdth=112.5 wght=600 -o "$2" -q; }

display $FS/mona-sans/files/mona-sans-latin-wdth-normal.woff2 $TMP/d-latin.ttf
display $FS/mona-sans/files/mona-sans-latin-ext-wdth-normal.woff2 $TMP/d-ext.ttf
sub $TMP/d-latin.ttf "$LATIN" $OUT/mona-display-latin.woff2
sub $TMP/d-ext.ttf "$RO" $OUT/mona-display-ro.woff2
sub $FS/mona-sans/files/mona-sans-latin-wght-normal.woff2 "$LATIN" $OUT/mona-sans-latin.woff2
sub $FS/mona-sans/files/mona-sans-latin-ext-wght-normal.woff2 "$RO" $OUT/mona-sans-ro.woff2
sub $FS/martian-mono/files/martian-mono-latin-wght-normal.woff2 "$LATIN" $OUT/martian-mono-latin.woff2
sub $FS/martian-mono/files/martian-mono-latin-ext-wght-normal.woff2 "$RO" $OUT/martian-mono-ro.woff2
rm -rf "$TMP"
ls -la $OUT
