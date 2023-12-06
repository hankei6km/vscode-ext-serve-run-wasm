#!/bin/bash
set -e

# exmaple:
# scripts/ver-tag.sh patch
# scripts/ver-tag.sh prelease pre

command -v cargo-bump >/dev/null 2>&1 || {
    echo >&2 "cargo-bump is required, but not installed.  Aborting."
    echo >&2 "Install it with: cargo install cargo-bump"
    exit 1
}

npm version --no-git-tag-version --preid "${2}" "${1}"
VERSION="$(jq < package.json -r .version)"
cargo bump "${VERSION}"
cargo update --offline --workspace

git add .
git commit --allow-empty -m "${VERSION}"
git tag "v${VERSION}" -am "${VERSION}"

echo "Operations for release:"
echo "- git push --follow-tags origin"
echo "- Create a release in any desired way"
echo "  (i.e. gh release create v${VERSION} -t ${VERSION} --target "'"$(git rev-parse --abbrev-ref HEAD)"'")"
