#!/usr/bin/env python3
"""
Sprint 1 端到端验收脚本。

流程：
  0. 注册一个新用户 / 直接登录已有用户
  1. POST /api/items        建一条 item（name=抽纸, qty=6）
  2. POST /api/items        建第二条（name=牙膏, qty=1）
  3. GET  /api/items        列表里能看到两条
  4. GET  /api/categories   拿分类字典
  5. PATCH /api/items/[id]  +1 → 7（adjust）
  6. PATCH /api/items/[id]  -2 → 5（consume）
  7. GET  /api/items/[id]/events  → 应该看到至少 3 条历史
  8. GET  /api/dashboard    → stats、recentEvents、categoryCounts
  9. PATCH /api/items/[id]/meta  → 改 brand = '心相印'
  10. DELETE /api/items/[id] → 软删除
  11. GET /api/items        → 看不到被删的
"""
import json, sys, urllib.request, urllib.error, os

BASE = os.environ.get("HIM_BASE", "http://localhost:3000")
EMAIL = os.environ.get("HIM_TEST_EMAIL", "sprint1-verify@him.local")
PASSWORD = os.environ.get("HIM_TEST_PASSWORD", "TestPass#2026")

# Direct supabase creds
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
ANON_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
if not SUPABASE_URL or not ANON_KEY:
    print("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY env vars")
    sys.exit(1)


def call_supabase_auth(path: str, body: dict):
    req = urllib.request.Request(
        f"{SUPABASE_URL}{path}",
        data=json.dumps(body).encode(),
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read()), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read()), dict(e.headers)


def cookie_header_from_session(j: dict, ref: str) -> str:
    """把 {access_token, refresh_token, expires_in, expires_at} 包成
    Supabase js 的 sb-{ref}-auth-token cookie 形态。"""
    blob = {
        "access_token": j["access_token"],
        "token_type": "bearer",
        "expires_in": j.get("expires_in", 3600),
        "expires_at": j.get("expires_at"),
        "refresh_token": j.get("refresh_token"),
        "user": j.get("user", {}),
    }
    import base64
    val = base64.b64encode(json.dumps(blob).encode()).decode()
    return f'sb-{ref}-auth-token={val}; sb-{ref}-auth-token-code-verifier=deleted'


def call_app(path: str, method="GET", body=None, cookie=None):
    headers = {}
    if cookie:
        headers["Cookie"] = cookie
    if body:
        body_bytes = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    else:
        body_bytes = None
    req = urllib.request.Request(
        f"{BASE}{path}", data=body_bytes, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}


def step(label):
    print(f"\n--- {label} ---")


def assert_ok(label, status, body, expect=200):
    ok = status == expect and not (isinstance(body, dict) and body.get("error"))
    mark = "✓" if ok else "✗"
    print(f"  {mark} {label} [{status}] {json.dumps(body, ensure_ascii=False)[:200]}")
    return ok


def main():
    # 0. 注册 / 登录
    step("0. 注册 / 登录")
    code, j, _ = call_supabase_auth("/auth/v1/signup", {"email": EMAIL, "password": PASSWORD})
    if code in (200, 422) and (j.get("access_token") or "already registered" in str(j)):
        if j.get("access_token"):
            print(f"  ✓ 注册成功，user_id={j['user']['id']}")
        else:
            code, j, _ = call_supabase_auth("/auth/v1/token?grant_type=password", {"email": EMAIL, "password": PASSWORD})
            if code != 200:
                print(f"  ✗ 登录失败：{code} {j}")
                sys.exit(1)
            print(f"  ✓ 登录成功（已注册），user_id={j['user']['id']}")
    else:
        print(f"  ✗ 注册/登录失败：{code} {j}")
        sys.exit(1)

    # 构造 cookie 给 server app 用
    ref = SUPABASE_URL.split("//")[1].split(".")[0]
    cookie = cookie_header_from_session(j, ref)
    print(f"     cookie sb-{ref}-auth-token 已构造 ({len(cookie)} chars)")

    # bootstrap household if not done
    step("bootstrap /api/bootstrap/household")
    code, j = call_app("/api/bootstrap/household", "POST", {}, cookie=cookie)
    print(f"  → {code} {json.dumps(j, ensure_ascii=False)[:200]}")

    # 1. 建抽纸
    step("1. POST /api/items (抽纸, 6 包)")
    code, j = call_app("/api/items", "POST", {
        "canonical_name": "抽纸",
        "quantity": 6,
        "unit": "包",
        "brand": "维达",
    }, cookie=cookie)
    if not assert_ok("创建抽纸", code, j, 200): sys.exit(1)
    item1 = j["item"]["item_id"]
    print(f"     item_id = {item1}")

    # 2. 建牙膏
    step("2. POST /api/items (牙膏, 1 支)")
    code, j = call_app("/api/items", "POST", {
        "canonical_name": "牙膏",
        "quantity": 1,
        "unit": "支",
    }, cookie=cookie)
    if not assert_ok("创建牙膏", code, j, 200): sys.exit(1)
    item2 = j["item"]["item_id"]
    print(f"     item_id = {item2}")

    # 3. 列表
    step("3. GET /api/items")
    code, j = call_app("/api/items", cookie=cookie)
    if not assert_ok("获取列表", code, j, 200): sys.exit(1)
    items = j["items"]
    print(f"     共 {len(items)} 条；前 3 条: {[i.get('canonical_name') for i in items[:3]]}")
    if not any(i["item_id"] == item1 for i in items):
        print("  ✗ 抽纸 不在列表里！")
        sys.exit(1)
    print("  ✓ 抽纸已落到列表")

    # 4. 分类
    step("4. GET /api/categories")
    code, j = call_app("/api/categories", cookie=cookie)
    if not assert_ok("分类字典", code, j, 200): sys.exit(1)
    cats = j["categories"]
    print(f"     顶层分类 {len(cats)} 个：{[c['name'] for c in cats]}")
    if len(cats) < 7:
        print("  ✗ 顶层分类少于 7 个")
        sys.exit(1)

    # 5. +1 调整
    step("5. PATCH /api/items/[id] +1 (adjust)")
    code, j = call_app(f"/api/items/{item1}", "PATCH", {"delta": 1}, cookie=cookie)
    if not assert_ok("+1", code, j, 200): sys.exit(1)
    print(f"     新的 quantity = {j.get('quantity')}")
    if j.get("quantity") != 7:
        print("  ✗ 期望 quantity=7")
        sys.exit(1)

    # 6. -2 consume
    step("6. PATCH /api/items/[id] -2 (consume)")
    code, j = call_app(f"/api/items/{item1}", "PATCH", {"delta": -2, "event_type": "consume"}, cookie=cookie)
    if not assert_ok("-2", code, j, 200): sys.exit(1)
    print(f"     新的 quantity = {j.get('quantity')}")
    if j.get("quantity") != 5:
        print("  ✗ 期望 quantity=5")
        sys.exit(1)

    # 7. 历史
    step("7. GET /api/items/[id]/events")
    code, j = call_app(f"/api/items/{item1}/events", cookie=cookie)
    if not assert_ok("events", code, j, 200): sys.exit(1)
    events = j["events"]
    print(f"     共 {len(events)} 条历史：")
    for e in events:
        print(f"        {e['event_type']:18s} {e['previous_quantity']:>5} → {e['new_quantity']:<5} (Δ {e['quantity_change']:+})")
    if len(events) < 3:
        print("  ✗ 历史应该 ≥ 3 条（创建 + 调整 + 消耗）")
        sys.exit(1)

    # 8. dashboard
    step("8. GET /api/dashboard")
    code, j = call_app("/api/dashboard", cookie=cookie)
    if not assert_ok("dashboard", code, j, 200): sys.exit(1)
    print(f"     householdName = {j['householdName']}")
    print(f"     itemCount     = {j['itemCount']}")
    print(f"     lowStockCount = {j['lowStockCount']}")
    print(f"     recentEvents  = {len(j['recentEvents'])} 条")

    # 9. PATCH meta
    step("9. PATCH /api/items/[id]/meta")
    code, j = call_app(f"/api/items/{item1}/meta", "PATCH", {"brand": "心相印"}, cookie=cookie)
    if not assert_ok("meta patch", code, j, 200): sys.exit(1)

    # 10. DELETE 软删
    step("10. DELETE /api/items/[id]")
    code, j = call_app(f"/api/items/{item1}", "DELETE", cookie=cookie)
    if not assert_ok("delete", code, j, 200): sys.exit(1)

    # 11. 列表里看不到
    step("11. GET /api/items (确认软删生效)")
    code, j = call_app("/api/items", cookie=cookie)
    if not assert_ok("列表", code, j, 200): sys.exit(1)
    items_after = [i["item_id"] for i in j["items"]]
    if item1 in items_after:
        print(f"  ✗ {item1} 仍在列表里！")
        sys.exit(1)
    if item2 not in items_after:
        print(f"  ✗ {item2} 不该被删，但被删了")
        sys.exit(1)
    print(f"  ✓ 抽纸已不在；牙膏仍在")

    print("\n=== ✅ Sprint 1 端到端全部通过 ===\n")


if __name__ == "__main__":
    main()
