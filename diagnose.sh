#!/usr/bin/env bash
# diagnose.sh
for r in routes/*.js; do
  echo "=== $r ==="
  # What does the route file require?
  required=$(node -pe "
    const src = require('fs').readFileSync('$r','utf8');
    const m   = src.match(/require\\(['\"](.*?)['\"]\\)/);
    m ? m[1] : '???'
  ")
  echo "  requires: $required"

  # What does the controller actually export?
  controller="${required#./}"          # strip leading ./
  controller="${controller%.js}.js"    # ensure .js
  if [[ -f "$controller" ]]; then
    exports=$(node -pe "
      const m = require('./$controller');
      JSON.stringify(Object.keys(m || {}))
    " 2>/dev/null || echo "[FAILED]")
    echo "  exports : $exports"
  else
    echo "  exports : [FILE NOT FOUND]"
  fi
done