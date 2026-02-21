#!/bin/bash
# Create all required Firestore composite indexes for MoltBot
PROJECT="seedgpt-planter"

echo "Creating composite indexes..."

# 1. transactions: participants (ARRAY_CONTAINS) + createdAt (DESC)
gcloud firestore indexes composite create \
  --project="$PROJECT" \
  --collection-group="transactions" \
  --field-config="field-path=participants,array-config=CONTAINS" \
  --field-config="field-path=createdAt,order=DESCENDING" \
  --async 2>&1 && echo "✅ transactions index created" || echo "⚠️ transactions index may already exist"

# 2. creditLines: grantorId (ASC) + createdAt (DESC)  
gcloud firestore indexes composite create \
  --project="$PROJECT" \
  --collection-group="creditLines" \
  --field-config="field-path=grantorId,order=ASCENDING" \
  --field-config="field-path=createdAt,order=DESCENDING" \
  --async 2>&1 && echo "✅ creditLines (grantor) index created" || echo "⚠️ creditLines (grantor) index may already exist"

# 3. creditLines: granteeId (ASC) + createdAt (DESC)
gcloud firestore indexes composite create \
  --project="$PROJECT" \
  --collection-group="creditLines" \
  --field-config="field-path=granteeId,order=ASCENDING" \
  --field-config="field-path=createdAt,order=DESCENDING" \
  --async 2>&1 && echo "✅ creditLines (grantee) index created" || echo "⚠️ creditLines (grantee) index may already exist"

# 4. emailAddresses: agentId (ASC) + createdAt (DESC)
gcloud firestore indexes composite create \
  --project="$PROJECT" \
  --collection-group="emailAddresses" \
  --field-config="field-path=agentId,order=ASCENDING" \
  --field-config="field-path=createdAt,order=DESCENDING" \
  --async 2>&1 && echo "✅ emailAddresses index created" || echo "⚠️ emailAddresses index may already exist"

# 5. emails: agentId (ASC) + direction (ASC) + createdAt (DESC)
gcloud firestore indexes composite create \
  --project="$PROJECT" \
  --collection-group="emails" \
  --field-config="field-path=agentId,order=ASCENDING" \
  --field-config="field-path=direction,order=ASCENDING" \
  --field-config="field-path=createdAt,order=DESCENDING" \
  --async 2>&1 && echo "✅ emails (agentId+direction) index created" || echo "⚠️ emails index may already exist"

# 6. calls: agentId (ASC) + createdAt (DESC)
gcloud firestore indexes composite create \
  --project="$PROJECT" \
  --collection-group="calls" \
  --field-config="field-path=agentId,order=ASCENDING" \
  --field-config="field-path=createdAt,order=DESCENDING" \
  --async 2>&1 && echo "✅ calls index created" || echo "⚠️ calls index may already exist"

# 7. creditTransactions: creditLineId (ASC) + createdAt (DESC)
gcloud firestore indexes composite create \
  --project="$PROJECT" \
  --collection-group="creditTransactions" \
  --field-config="field-path=creditLineId,order=ASCENDING" \
  --field-config="field-path=createdAt,order=DESCENDING" \
  --async 2>&1 && echo "✅ creditTransactions index created" || echo "⚠️ creditTransactions index may already exist"

# 8. tokenPurchases: agentId (ASC) + createdAt (DESC)
gcloud firestore indexes composite create \
  --project="$PROJECT" \
  --collection-group="tokenPurchases" \
  --field-config="field-path=agentId,order=ASCENDING" \
  --field-config="field-path=createdAt,order=DESCENDING" \
  --async 2>&1 && echo "✅ tokenPurchases index created" || echo "⚠️ tokenPurchases index may already exist"

# 9. callWebhooks: agentId (ASC) + active (ASC)
gcloud firestore indexes composite create \
  --project="$PROJECT" \
  --collection-group="callWebhooks" \
  --field-config="field-path=agentId,order=ASCENDING" \
  --field-config="field-path=active,order=ASCENDING" \
  --async 2>&1 && echo "✅ callWebhooks index created" || echo "⚠️ callWebhooks index may already exist"

# 10. emailWebhooks: agentId (ASC) + active (ASC)
gcloud firestore indexes composite create \
  --project="$PROJECT" \
  --collection-group="emailWebhooks" \
  --field-config="field-path=agentId,order=ASCENDING" \
  --field-config="field-path=active,order=ASCENDING" \
  --async 2>&1 && echo "✅ emailWebhooks index created" || echo "⚠️ emailWebhooks index may already exist"

# 11. escrows: creatorId (ASC) + createdAt (DESC)
gcloud firestore indexes composite create \
  --project="$PROJECT" \
  --collection-group="escrows" \
  --field-config="field-path=creatorId,order=ASCENDING" \
  --field-config="field-path=createdAt,order=DESCENDING" \
  --async 2>&1 && echo "✅ escrows (creator) index created" || echo "⚠️ escrows index may already exist"

# 12. escrows: counterpartyId (ASC) + createdAt (DESC)
gcloud firestore indexes composite create \
  --project="$PROJECT" \
  --collection-group="escrows" \
  --field-config="field-path=counterpartyId,order=ASCENDING" \
  --field-config="field-path=createdAt,order=DESCENDING" \
  --async 2>&1 && echo "✅ escrows (counterparty) index created" || echo "⚠️ escrows index may already exist"

# 13. emails: agentId + direction + status + createdAt (for inbox unread filter)
gcloud firestore indexes composite create \
  --project="$PROJECT" \
  --collection-group="emails" \
  --field-config="field-path=agentId,order=ASCENDING" \
  --field-config="field-path=direction,order=ASCENDING" \
  --field-config="field-path=status,order=ASCENDING" \
  --field-config="field-path=createdAt,order=DESCENDING" \
  --async 2>&1 && echo "✅ emails (inbox unread) index created" || echo "⚠️ emails (inbox unread) index may already exist"

echo ""
echo "Done! Indexes will take 1-5 minutes to build."
echo "Check status: gcloud firestore indexes composite list --project=$PROJECT"
