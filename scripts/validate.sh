#!/usr/bin/env bash
set -euo pipefail
npm run check
npm test
npm run smoke
