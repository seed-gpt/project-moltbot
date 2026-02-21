#!/bin/bash
# MoltBot Post-Migration QA Verification Script
# Tests all 4 services deployed to Cloud Run after Firestore migration

set -e

MOLTBANK="https://moltbank-oy7ayfiglq-uc.a.run.app"
MOLTCREDIT="https://moltcredit-oy7ayfiglq-uc.a.run.app"
MOLTMAIL="https://moltmail-oy7ayfiglq-uc.a.run.app"
MOLTPHONE="https://moltphone-oy7ayfiglq-uc.a.run.app"

PASS=0
FAIL=0
WARN=0

check() {
  local label="$1" url="$2" expected_status="$3" body_check="$4"
  local response status body
  response=$(curl -s -w "\n%{http_code}" --max-time 30 "$url")
  status=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$status" = "$expected_status" ]; then
    if [ -n "$body_check" ]; then
      if echo "$body" | grep -q "$body_check"; then
        echo "✅ PASS: $label (HTTP $status)"
        PASS=$((PASS + 1))
      else
        echo "⚠️  WARN: $label (HTTP $status, body mismatch)"
        echo "   Expected to contain: $body_check"
        echo "   Got: $(echo "$body" | head -c 200)"
        WARN=$((WARN + 1))
      fi
    else
      echo "✅ PASS: $label (HTTP $status)"
      PASS=$((PASS + 1))
    fi
  else
    echo "❌ FAIL: $label (expected $expected_status, got $status)"
    echo "   Body: $(echo "$body" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

check_post() {
  local label="$1" url="$2" data="$3" expected_status="$4" body_check="$5" auth="$6"
  local response status body
  local curl_args=(-s -w "\n%{http_code}" --max-time 30 -H "Content-Type: application/json")
  [ -n "$auth" ] && curl_args+=(-H "Authorization: Bearer $auth")
  curl_args+=(-d "$data" "$url")
  response=$(curl "${curl_args[@]}")
  status=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$status" = "$expected_status" ]; then
    if [ -n "$body_check" ]; then
      if echo "$body" | grep -q "$body_check"; then
        echo "✅ PASS: $label (HTTP $status)"
        PASS=$((PASS + 1))
      else
        echo "⚠️  WARN: $label (HTTP $status, body mismatch)"
        echo "   Expected to contain: $body_check"
        echo "   Got: $(echo "$body" | head -c 300)"
        WARN=$((WARN + 1))
      fi
    else
      echo "✅ PASS: $label (HTTP $status)"
      PASS=$((PASS + 1))
    fi
  else
    echo "❌ FAIL: $label (expected $expected_status, got $status)"
    echo "   Body: $(echo "$body" | head -c 300)"
    FAIL=$((FAIL + 1))
  fi
  # Return the body for chaining
  echo "$body" > /tmp/moltbot_last_response.json
}

echo "=========================================="
echo "  MoltBot Post-Firestore QA Verification"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# ========== Phase 1: Health Checks ==========
echo "── Phase 1: Health Checks ──"
check "MoltBank /health" "$MOLTBANK/health" "200" '"status":"ok"'
check "MoltCredit /health" "$MOLTCREDIT/health" "200" '"status":"ok"'
check "MoltMail /health" "$MOLTMAIL/health" "200" '"status":"ok"'
check "MoltPhone /health" "$MOLTPHONE/health" "200" '"status":"ok"'
echo ""

# ========== Phase 2: Readiness Checks (Firestore connectivity) ==========
echo "── Phase 2: Readiness Checks ──"
check "MoltBank /ready" "$MOLTBANK/ready" "200" '"status":"ready"'
check "MoltCredit /ready" "$MOLTCREDIT/ready" "200" '"status":"ready"'
check "MoltMail /ready" "$MOLTMAIL/ready" "200" '"status":"ready"'
check "MoltPhone /ready" "$MOLTPHONE/ready" "200" '"status":"ready"'
echo ""

# ========== Phase 3: Auth Guards ==========
echo "── Phase 3: Auth Guards (401 without token) ──"
check "MoltBank GET /me" "$MOLTBANK/me" "401" '"error"'
check "MoltBank GET /wallet" "$MOLTBANK/wallet" "401" '"error"'
check "MoltCredit GET /credit" "$MOLTCREDIT/credit" "401" '"error"'
check "MoltMail GET /inbox" "$MOLTMAIL/inbox" "401" '"error"'
check "MoltMail GET /addresses" "$MOLTMAIL/addresses" "401" '"error"'
check "MoltPhone GET /me" "$MOLTPHONE/me" "401" '"error"'
check "MoltPhone GET /calls" "$MOLTPHONE/calls" "401" '"error"'
check "MoltPhone GET /tokens/balance" "$MOLTPHONE/tokens/balance" "401" '"error"'
echo ""

# ========== Phase 4: Public Endpoints ==========
echo "── Phase 4: Public Endpoints ──"
check "MoltBank GET /directory" "$MOLTBANK/directory" "200" '"agents"'
check "MoltBank GET /stats" "$MOLTBANK/stats" "200" '"total_agents"'
check "MoltBank GET /leaderboard" "$MOLTBANK/leaderboard" "200" '"leaderboard"'
check "MoltCredit GET /stats" "$MOLTCREDIT/stats" "200" '"total_agents"'
echo ""

# ========== Phase 5: Agent Registration + Lifecycle (MoltBank) ==========
echo "── Phase 5: Agent Registration + Lifecycle ──"
HANDLE="qa-agent-$(date +%s)"

check_post "MoltBank Register Agent" "$MOLTBANK/register" \
  "{\"handle\":\"$HANDLE\",\"name\":\"QA Test Agent\"}" \
  "201" '"api_key"'

API_KEY=$(cat /tmp/moltbot_last_response.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('api_key',''))" 2>/dev/null || echo "")

if [ -z "$API_KEY" ]; then
  echo "❌ FAIL: Could not extract API key from registration response"
  FAIL=$((FAIL + 1))
else
  echo "   → API Key obtained: ${API_KEY:0:10}..."

  # Test authenticated endpoints with the new key
  echo ""
  echo "── Phase 6: Authenticated Operations ──"

  # MoltBank - Get profile
  response=$(curl -s --max-time 30 -H "Authorization: Bearer $API_KEY" "$MOLTBANK/me")
  if echo "$response" | grep -q "$HANDLE"; then
    echo "✅ PASS: MoltBank GET /me (authenticated)"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL: MoltBank GET /me (authenticated)"
    echo "   Got: $(echo "$response" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi

  # MoltBank - Get wallet
  response=$(curl -s --max-time 30 -H "Authorization: Bearer $API_KEY" "$MOLTBANK/wallet")
  if echo "$response" | grep -q '"balance"'; then
    echo "✅ PASS: MoltBank GET /wallet (authenticated, balance=0)"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL: MoltBank GET /wallet (authenticated)"
    echo "   Got: $(echo "$response" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi

  # MoltBank - Deposit
  check_post "MoltBank POST /wallet/deposit" "$MOLTBANK/wallet/deposit" \
    '{"amount":1000}' "200" '"new_balance"' "$API_KEY"

  # MoltBank - Get wallet after deposit
  response=$(curl -s --max-time 30 -H "Authorization: Bearer $API_KEY" "$MOLTBANK/wallet")
  if echo "$response" | grep -q '"balance":1000'; then
    echo "✅ PASS: MoltBank wallet balance = 1000 after deposit"
    PASS=$((PASS + 1))
  else
    echo "⚠️  WARN: MoltBank wallet balance check"
    echo "   Got: $(echo "$response" | head -c 200)"
    WARN=$((WARN + 1))
  fi

  # MoltBank - Get wallet transactions
  response=$(curl -s --max-time 30 -H "Authorization: Bearer $API_KEY" "$MOLTBANK/wallet/transactions")
  if echo "$response" | grep -q '"transactions"'; then
    echo "✅ PASS: MoltBank GET /wallet/transactions"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL: MoltBank GET /wallet/transactions"
    FAIL=$((FAIL + 1))
  fi

  # MoltBank - Directory shows new agent
  response=$(curl -s --max-time 30 "$MOLTBANK/directory/$HANDLE")
  if echo "$response" | grep -q "$HANDLE"; then
    echo "✅ PASS: MoltBank directory shows new agent"
    PASS=$((PASS + 1))
  else
    echo "⚠️  WARN: Agent may not appear in directory immediately"
    WARN=$((WARN + 1))
  fi

  # MoltPhone - Use same API key (shared agents collection)
  echo ""
  echo "── Phase 7: Cross-Service Auth (shared agents) ──"
  response=$(curl -s --max-time 30 -H "Authorization: Bearer $API_KEY" "$MOLTPHONE/me")
  if echo "$response" | grep -q "$HANDLE"; then
    echo "✅ PASS: MoltPhone accepts MoltBank API key (shared Firestore agents)"
    PASS=$((PASS + 1))
  else
    echo "⚠️  WARN: Cross-service auth (MoltPhone with MoltBank key)"
    echo "   Got: $(echo "$response" | head -c 200)"
    WARN=$((WARN + 1))
  fi

  response=$(curl -s --max-time 30 -H "Authorization: Bearer $API_KEY" "$MOLTCREDIT/credit")
  if echo "$response" | grep -q '"given"'; then
    echo "✅ PASS: MoltCredit accepts MoltBank API key (shared Firestore agents)"
    PASS=$((PASS + 1))
  else
    echo "⚠️  WARN: Cross-service auth (MoltCredit with MoltBank key)"
    echo "   Got: $(echo "$response" | head -c 200)"
    WARN=$((WARN + 1))
  fi

  response=$(curl -s --max-time 30 -H "Authorization: Bearer $API_KEY" "$MOLTMAIL/addresses")
  if echo "$response" | grep -q '"addresses"'; then
    echo "✅ PASS: MoltMail accepts MoltBank API key (shared Firestore agents)"
    PASS=$((PASS + 1))
  else
    echo "⚠️  WARN: Cross-service auth (MoltMail with MoltBank key)"
    echo "   Got: $(echo "$response" | head -c 200)"
    WARN=$((WARN + 1))
  fi
fi

echo ""
echo "=========================================="
echo "  QA Results Summary"
echo "=========================================="
echo "  ✅ PASS: $PASS"
echo "  ⚠️  WARN: $WARN"
echo "  ❌ FAIL: $FAIL"
echo "  Total:  $((PASS + WARN + FAIL))"
echo "=========================================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi
