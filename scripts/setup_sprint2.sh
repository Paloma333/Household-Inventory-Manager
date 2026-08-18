#!/usr/bin/env bash
# scripts/setup_sprint2.sh — Sprint 2 一次性部署
#
# 完成：
#   1. 推送 migration 0004_usage_log.sql（创建 usage_log 表 + v_usage_daily/monthly 视图 + RLS）
#   2. 创建 Supabase Storage bucket `recognition-images`（private, 10MB cap, 30天 lifecycle）
#
# 依赖：
#   - SUPABASE_PROJECT_REF   e.g. cgkwjpamcwffalfagddj
#   - SUPABASE_ACCESS_TOKEN  从 https://supabase.com/dashboard/account/tokens 拿
#
# 用法：
#   SUPABASE_PROJECT_REF=xxx SUPABASE_ACCESS_TOKEN=sbp_... \
#     bash scripts/setup_sprint2.sh

set -euo pipefail

if [ -z "${SUPABASE_PROJECT_REF:-}" ] || [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "需要 SUPABASE_PROJECT_REF 和 SUPABASE_ACCESS_TOKEN 两个环境变量"
  echo "TOKEN 在这里拿：https://supabase.com/dashboard/account/tokens"
  exit 1
fi

PROJECT_REF="$SUPABASE_PROJECT_REF"
TOKEN="$SUPABASE_ACCESS_TOKEN"
API="https://api.supabase.com/v1/projects/$PROJECT_REF"

echo "── 1) 推送 0004_usage_log.sql ──"
python3 "$(dirname "$0")/run_sql.py" "$(dirname "$0")/../supabase/migrations/0004_usage_log.sql"

echo "── 2) 创建 Storage bucket: recognition-images ──"
# 用 Supabase Storage REST API（management API 没有 bucket 端点）
PROJECT_URL=$(curl -sS -H "Authorization: Bearer $TOKEN" "$API" | python3 -c "
import json, sys
try:
    print(json.load(sys.stdin).get('endpoint') or '')
except:
    print('')
")

if [ -z "$PROJECT_URL" ]; then
  PROJECT_URL="https://$PROJECT_REF.supabase.co"
fi

# 检查 bucket 是否已存在
EXISTING=$(curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API/storage/buckets" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    names = [b.get('name') for b in data]
    print('yes' if 'recognition-images' in names else 'no')
except:
    print('no')
")

if [ "$EXISTING" = "yes" ]; then
  echo "  ✓ bucket 已存在，跳过创建"
else
  # service_role 直接调 Storage REST API 创建桶
  SR_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
  if [ -z "$SR_KEY" ]; then
    SR_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$(dirname "$0")/../.env.local" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
  fi

  if [ -z "$SR_KEY" ]; then
    echo "  ⚠ 需要 SUPABASE_SERVICE_ROLE_KEY 创建 bucket（management API 没有 bucket 端点）"
    echo "    手动方法：在 Supabase Dashboard → Storage → New bucket 创建 'recognition-images'"
  else
    HTTP=$(curl -sS -X POST \
      -H "Authorization: Bearer $SR_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "recognition-images",
        "public": false,
        "file_size_limit": 10485760,
        "allowed_mime_types": ["image/jpeg","image/png","image/webp","image/heic"]
      }' \
      "$PROJECT_URL/storage/v1/bucket" \
      -w "\n__HTTP__%{http_code}")
    BODY=$(echo "$HTTP" | head -n -1)
    CODE=$(echo "$HTTP" | tail -n 1 | sed 's/__HTTP__//')
    if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
      echo "  ✓ 已创建 (HTTP $CODE): $BODY"
    else
      echo "  ✗ HTTP $CODE: $BODY"
      echo "    手动 fallback：在 Dashboard → Storage → New bucket 创建 'recognition-images'"
    fi
  fi
fi

echo ""
echo "── 3) 验证 ──"
curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"SELECT table_name FROM information_schema.tables WHERE table_schema='\''public'\'' AND table_name='\''usage_log'\'';"}' \
  "$API/database/query" | python3 -m json.tool

echo "✓ Sprint 2 基础设施部署完成"
