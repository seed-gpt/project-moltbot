#!/bin/bash
set -e

CF_TOKEN="VzhW2jgXcvt6sT3m5PGVjAFL1utBRz3B_TDiQ94A"
GH_IPS=("185.199.108.153" "185.199.109.153" "185.199.110.153" "185.199.111.153")
GH_PAGES_CNAME="levi-law.github.io"

# Zone IDs
declare -A ZONES
ZONES[molt-bank.com]="6e59c0b9315e8ab55ea244cc839a6ce0"
ZONES[moltcredit.xyz]="959131f7583fb6bd9813bba0bab88713"
ZONES[moltmail.xyz]="c24c15aa8c9cc97e3d5570bc0b9df373"
ZONES[moltphone.xyz]="563093f6aa5e88f471ff9c9810df2c7d"

cf_api() {
  curl -s "https://api.cloudflare.com/client/v4$1" \
    -H "Authorization: Bearer $CF_TOKEN" \
    -H "Content-Type: application/json" \
    "${@:2}"
}

list_records() {
  local ZONE_ID="$1"
  cf_api "/zones/$ZONE_ID/dns_records?per_page=100" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('result',[]):
    proxy = '🟠' if r.get('proxied') else '⚪'
    print(f'  {proxy} {r[\"type\"]:6s} {r[\"name\"]:35s} → {r[\"content\"]:40s} id={r[\"id\"]}')
"
}

delete_record() {
  local ZONE_ID="$1" RECORD_ID="$2"
  cf_api "/zones/$ZONE_ID/dns_records/$RECORD_ID" -X DELETE > /dev/null
}

create_a_record() {
  local ZONE_ID="$1" NAME="$2" IP="$3"
  cf_api "/zones/$ZONE_ID/dns_records" -X POST \
    -d "{\"type\":\"A\",\"name\":\"$NAME\",\"content\":\"$IP\",\"ttl\":1,\"proxied\":false}" > /dev/null
}

create_cname_record() {
  local ZONE_ID="$1" NAME="$2" TARGET="$3"
  cf_api "/zones/$ZONE_ID/dns_records" -X POST \
    -d "{\"type\":\"CNAME\",\"name\":\"$NAME\",\"content\":\"$TARGET\",\"ttl\":1,\"proxied\":false}" > /dev/null
}

# Step 1: Show current state
echo "============================================"
echo "Current DNS Records"
echo "============================================"
for DOMAIN in "${!ZONES[@]}"; do
  echo ""
  echo "--- $DOMAIN (${ZONES[$DOMAIN]}) ---"
  list_records "${ZONES[$DOMAIN]}"
done

echo ""
echo "============================================"
echo "Fixing DNS Records"
echo "============================================"

for DOMAIN in "${!ZONES[@]}"; do
  ZONE_ID="${ZONES[$DOMAIN]}"
  echo ""
  echo "--- Fixing $DOMAIN ---"

  # Get existing A/AAAA/CNAME records for root domain
  ROOT_RECORDS=$(cf_api "/zones/$ZONE_ID/dns_records?type=A&name=$DOMAIN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('result',[]): print(r['id'])
")

  AAAA_RECORDS=$(cf_api "/zones/$ZONE_ID/dns_records?type=AAAA&name=$DOMAIN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('result',[]): print(r['id'])
")

  # Delete existing root A records
  for RID in $ROOT_RECORDS; do
    echo "  Deleting old A record: $RID"
    delete_record "$ZONE_ID" "$RID"
  done

  # Delete existing root AAAA records
  for RID in $AAAA_RECORDS; do
    echo "  Deleting old AAAA record: $RID"
    delete_record "$ZONE_ID" "$RID"
  done

  # Create 4 GitHub Pages A records (DNS-only, no proxy)
  for IP in "${GH_IPS[@]}"; do
    echo "  Creating A record: $DOMAIN → $IP (DNS-only)"
    create_a_record "$ZONE_ID" "$DOMAIN" "$IP"
  done

  # Handle www → CNAME to GitHub Pages
  WWW_RECORDS=$(cf_api "/zones/$ZONE_ID/dns_records?name=www.$DOMAIN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('result',[]): print(r['id'])
")

  for RID in $WWW_RECORDS; do
    echo "  Deleting old www record: $RID"
    delete_record "$ZONE_ID" "$RID"
  done

  echo "  Creating CNAME: www.$DOMAIN → $GH_PAGES_CNAME (DNS-only)"
  create_cname_record "$ZONE_ID" "www" "$GH_PAGES_CNAME"

  echo "  ✅ $DOMAIN fixed"
done

# Handle subdomains (app.molt-bank.com, app.moltphone.xyz)
echo ""
echo "--- Fixing app.molt-bank.com ---"
APP_RECS=$(cf_api "/zones/${ZONES[molt-bank.com]}/dns_records?name=app.molt-bank.com" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('result',[]): print(r['id'])
")
for RID in $APP_RECS; do
  echo "  Deleting old app record: $RID"
  delete_record "${ZONES[molt-bank.com]}" "$RID"
done
echo "  Creating CNAME: app.molt-bank.com → $GH_PAGES_CNAME (DNS-only)"
create_cname_record "${ZONES[molt-bank.com]}" "app" "$GH_PAGES_CNAME"
echo "  ✅ app.molt-bank.com fixed"

echo ""
echo "--- Fixing app.moltphone.xyz ---"
APP_RECS=$(cf_api "/zones/${ZONES[moltphone.xyz]}/dns_records?name=app.moltphone.xyz" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('result',[]): print(r['id'])
")
for RID in $APP_RECS; do
  echo "  Deleting old app record: $RID"
  delete_record "${ZONES[moltphone.xyz]}" "$RID"
done
echo "  Creating CNAME: app.moltphone.xyz → $GH_PAGES_CNAME (DNS-only)"
create_cname_record "${ZONES[moltphone.xyz]}" "app" "$GH_PAGES_CNAME"
echo "  ✅ app.moltphone.xyz fixed"

# Also handle api.* subdomains if they exist
for DOMAIN in molt-bank.com moltcredit.xyz moltmail.xyz moltphone.xyz; do
  ZONE_ID="${ZONES[$DOMAIN]}"
  API_RECS=$(cf_api "/zones/$ZONE_ID/dns_records?name=api.$DOMAIN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('result',[]): print(r['id'], r['content'])
" 2>/dev/null)
  if [ -n "$API_RECS" ]; then
    echo ""
    echo "  Found api.$DOMAIN records: $API_RECS"
  fi
done

echo ""
echo "============================================"
echo "Final DNS Records"
echo "============================================"
for DOMAIN in "${!ZONES[@]}"; do
  echo ""
  echo "--- $DOMAIN ---"
  list_records "${ZONES[$DOMAIN]}"
done

echo ""
echo "✅ All DNS records updated! SSL certs should provision within 15 min."
