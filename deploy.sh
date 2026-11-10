#!/bin/sh
# Builds the site and publishes it to GitHub Pages (the gh-pages branch),
# served at https://katesimread.github.io/Burton/
#
# public/assets is gitignored (the models are too big for normal commits),
# so the built site is pushed on its own to gh-pages, with:
#   - the meshopt-compressed models from web-assets/ in place of the
#     originals (the original building model is over GitHub's 100MB limit)
#   - only the audio files the hotspots actually use
#
# If you change a model in public/assets, re-compress it into web-assets/:
#   npx @gltf-transform/cli meshopt public/assets/NAME.glb web-assets/NAME.glb
#
# Usage: sh deploy.sh
set -e
cd "$(dirname "$0")"

REMOTE=$(git remote get-url origin)

npm run build

# Replace the copied public/assets with just what the site uses.
rm -rf dist/assets/*.glb dist/assets/*.bak dist/assets/Audio dist/models dist/audio
mkdir -p dist/assets/Audio
cp web-assets/*.glb dist/assets/
for f in $(grep -o 'Audio/[^"]*' hotspots.json); do
  cp "public/assets/$f" "dist/assets/$f"
done
touch dist/.nojekyll

cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy site"
git push -f "$REMOTE" gh-pages
rm -rf .git

echo "Published: https://katesimread.github.io/Burton/"
