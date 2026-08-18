#!/usr/bin/env python3
"""Run a SQL file via Supabase Management API using curl."""
import json
import os
import subprocess
import sys

PROJECT_REF = "cgkwjpamcwffalfagddj"
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN")
if not TOKEN:
    sys.exit("SUPABASE_ACCESS_TOKEN env var required")


def run_sql(sql: str) -> dict:
    # Use stdin via heredoc-style temp file to avoid arg-length limits and escaping
    body = json.dumps({"query": sql}).encode("utf-8")
    p = subprocess.run(
        [
            "curl", "-sS", "-X", "POST",
            "-H", f"Authorization: Bearer {TOKEN}",
            "-H", "Content-Type: application/json",
            "--data-binary", "@-",
            "-w", "\n__HTTP__%{http_code}",
            f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        ],
        input=body,
        capture_output=True,
        timeout=120,
    )
    out = p.stdout.decode("utf-8", errors="replace")
    parts = out.rsplit("\n__HTTP__", 1)
    payload = parts[0]
    code = int(parts[1]) if len(parts) == 2 else -1
    if code >= 400:
        raise RuntimeError(f"HTTP {code}: {payload[:1000]}")
    if not payload.strip():
        return None
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return {"raw": payload}


def main():
    sql_path = sys.argv[1]
    with open(sql_path, "r", encoding="utf-8") as f:
        sql = f.read()
    label = os.path.basename(sql_path)
    print(f"→ {label}  ({len(sql):,} chars, {sql.count(chr(10)) + 1} lines)")
    try:
        out = run_sql(sql)
        if out is None:
            print(f"  ✓ ok (no rows returned)")
        elif isinstance(out, dict) and "raw" in out:
            print(f"  ✓ ok — {out['raw'][:300]}")
        else:
            preview = json.dumps(out, ensure_ascii=False)
            print(f"  ✓ ok — {preview[:300]}{'...' if len(preview) > 300 else ''}")
    except Exception as e:
        print(f"  ✗ {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
