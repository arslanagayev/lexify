#!/bin/bash
set -e
echo "→ Commit + push..."
git add -A && git commit -m "${1:-update}" && git push
echo "→ VPS deploy..."
ssh -i ~/.ssh/lexify_vps root@72.61.120.58 'cd /var/www/lexify && git stash && git clean -fd backend/ && git pull && cd frontend && pnpm install && pnpm run build && systemctl restart $(systemctl list-units --type=service --no-legend | grep -i lexify | head -1 | awk "{print \$1}")'
echo "✓ Deploy tamam — https://lexifyvocab.tech"
