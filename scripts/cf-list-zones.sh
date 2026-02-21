#!/bin/bash
set -e

# Cloudflare API keys
CF_TOKEN="VzhW2jgXcvt6sT3m5PGVjAFL1utBRz3B_TDiQ94A"

# GitHub Pages IPs
GH_IPS=("185.199.108.153" "185.199.109.153" "185.199.110.153" "185.199.111.153")

# Step 1: List all zones
echo "=== Listing Cloudflare Zones ==="
curl -s "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
if not d.get('success'):
    print('Error:', d)
    sys.exit(1)
for z in d['result']:
    print(f'{z[\"name\"]:30s} {z[\"id\"]}  status={z[\"status\"]}')
"
