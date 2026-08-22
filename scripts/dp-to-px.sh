#!/bin/bash
# One-shot: rename Ndp -> Npx in all user-facing docs prose.
cd "$(dirname "$0")/.." || exit 1
files=$(grep -rEl '[0-9]dp\b' apps/docs/src/content/docs apps/docs/src/pages apps/storybook/src main-llm.md packages/core/src/components apps/showcase-caduceus apps/showcase-cairn apps/showcase-copperplate apps/showcase-fieldstone apps/showcase-hearthwise apps/showcase-lumen apps/showcase-merrow apps/showcase-pulseboard apps/showcase-relaymesh apps/showcase-tessellate starters 2>/dev/null | grep -vE 'node_modules|/dist/|\.next|\.svelte-kit|\.nuxt|/build/')
[ -n "$files" ] && perl -pi -e 's/(\d)dp\b/${1}px/g' $files
echo "remaining:"
grep -rEn '[0-9]dp\b' apps/docs/src/content/docs apps/docs/src/pages apps/storybook/src main-llm.md packages/core/src/components apps/showcase-* starters 2>/dev/null | grep -vE 'node_modules|/dist/|\.next|\.svelte-kit|\.nuxt|/build/' | wc -l
