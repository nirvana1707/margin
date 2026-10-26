#!/usr/bin/env sh
# Build Margin. Requires only Go 1.21+ (https://go.dev/dl/ — BSD licensed).
#
#   ./build.sh          build for this computer  -> ./margin
#   ./build.sh all      cross-build Windows, Linux and macOS binaries into ./dist
set -e
cd "$(dirname "$0")"
FLAGS="-trimpath -ldflags=-s -ldflags=-w"
export CGO_ENABLED=0

if [ "$1" = "all" ]; then
  mkdir -p dist
  for target in windows/amd64 windows/arm64 linux/amd64 linux/arm64 darwin/amd64 darwin/arm64; do
    os=${target%/*}; arch=${target#*/}
    out="dist/margin-$os-$arch"; [ "$os" = "windows" ] && out="$out.exe"
    echo "building $out"
    GOOS=$os GOARCH=$arch go build $FLAGS -o "$out" .
  done
else
  go build $FLAGS -o margin .
  echo "built ./margin — run it with:  ./margin /path/to/your/notes"
fi
