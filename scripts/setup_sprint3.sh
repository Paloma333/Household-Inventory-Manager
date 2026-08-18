#!/usr/bin/env bash
# Sprint 3 deployment — push 0005_restock_tables.sql
# 用法：
#   bash scripts/setup_sprint3.sh
#
# 前置：
#   - SUPABASE_ACCESS_TOKEN 已 export 到环境（来自 .env.local 或命令行 export）
#   - 用 Sprint 2 已创好的 Supabase 项目（同一 PROJECT_REF）
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  if [[ -f .env.local ]]; then
    echo "→ 从 .env.local 读 SUPABASE_ACCESS_TOKEN"
    set +u
    # shellcheck disable=SC1091
    source .env.local
    set -u
    export SUPABASE_ACCESS_TOKEN
  fi
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "✗ SUPABASE_ACCESS_TOKEN 未设。请先在 .env.local 里加，或者 export 进来。" >&2
  exit 1
fi

echo "═══════════════════════════════"
echo "  Sprint 3 deployment · 补货清单"
echo "═══════════════════════════════"
echo

# 1. 推迁移
echo "→ 推 0005_restock_tables.sql"
/Users/liuyushan/.workbuddy/binaries/python/versions/3.13.12/bin/python3 scripts/run_sql.py supabase/migrations/0005_restock_tables.sql

echo
echo "═══════════════════════════════"
echo "  ✓ Sprint 3 migration 部署完成"
echo "═══════════════════════════════"
