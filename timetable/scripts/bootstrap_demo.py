import json
import os
import sys
import time
import urllib.error
import urllib.request


PORTAL_LOGIN_URL = os.getenv("PORTAL_LOGIN_URL", "http://host.docker.internal:8000/api/auth/admin-login")
TIMETABLE_SOURCE_TERMS_URL = os.getenv(
    "TIMETABLE_SOURCE_TERMS_URL",
    "http://backend:8001/admin/import/source-terms",
)
TIMETABLE_SEED_URL = os.getenv(
    "TIMETABLE_SEED_URL",
    "http://backend:8001/admin/import/seed-from-core",
)


def request_json(url: str, *, method: str = "GET", token: str | None = None, payload: dict | None = None) -> dict:
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def wait_for_seed(token: str, max_attempts: int = 12) -> dict:
    last_error: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            terms_payload = request_json(TIMETABLE_SOURCE_TERMS_URL, token=token)
            term_code = terms_payload.get("latest_term_code") or "HK2_2025_2026"
            return request_json(
                TIMETABLE_SEED_URL,
                method="POST",
                token=token,
                payload={
                    "term_code": term_code,
                    "student_ids": ["23630781", "23630761"],
                    "create_sample_timetable": True,
                    "create_sample_attendance": True,
                },
            )
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code not in {401, 502} or attempt == max_attempts:
                raise
        except urllib.error.URLError as exc:
            last_error = exc
            if attempt == max_attempts:
                raise
        time.sleep(5)

    if last_error:
        raise last_error
    raise RuntimeError("Bootstrap failed without a concrete error")


def main() -> int:
    print("Bootstrapping Timetable demo data...")
    login_payload = request_json(
        PORTAL_LOGIN_URL,
        method="POST",
        payload={"username": "admin", "password": "admin"},
    )
    token = str(login_payload.get("access_token") or "").strip()
    if not token:
        print("Cannot get admin access token from Student Portal.", file=sys.stderr)
        return 1

    seed_payload = wait_for_seed(token)
    print(json.dumps(seed_payload, ensure_ascii=True))
    print("Bootstrap completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
