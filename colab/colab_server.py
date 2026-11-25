"""
Portal Belajar SMA NU Kaplongan — Backend & SQLite Database Server for Google Colab.
Persists all data (Materi, Tugas, LKPD, Quiz, Pengumuman, Submissions, Absensi, Akun, Video)
into SQLite (optionally on Google Drive) and exposes a CORS-enabled FastAPI REST API.
"""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

# Storage paths: prefer Google Drive if mounted, else local /content
DRIVE_DIR = Path("/content/drive/MyDrive/portalbelajar_db")
BASE_DIR = DRIVE_DIR if Path("/content/drive/MyDrive").exists() else Path("./portalbelajar_db")
FILES_DIR = BASE_DIR / "files"
DB_PATH = BASE_DIR / "portalbelajar.db"

BASE_DIR.mkdir(parents=True, exist_ok=True)
FILES_DIR.mkdir(parents=True, exist_ok=True)

GURU_PASSPHRASE = os.environ.get("GURU_UPLOAD_PASSPHRASE", "guru-kaplongan")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin-kaplongan")

app = FastAPI(title="Portal Belajar Colab Database API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS kv_store (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS accounts (
                nis TEXT PRIMARY KEY,
                nama TEXT NOT NULL,
                kelas TEXT NOT NULL,
                password_hash TEXT,
                terakhir_masuk INTEGER,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS submissions (
                id TEXT PRIMARY KEY,
                jenis TEXT NOT NULL,
                item_key TEXT NOT NULL,
                user_id TEXT NOT NULL,
                nama TEXT NOT NULL,
                kelas TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE (jenis, item_key, user_id)
            );
            CREATE TABLE IF NOT EXISTS attendance (
                key TEXT PRIMARY KEY,
                kelas TEXT NOT NULL,
                tanggal TEXT NOT NULL,
                data_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS catalog_topics (
                id TEXT PRIMARY KEY,
                jenjang TEXT NOT NULL,
                kelas TEXT NOT NULL,
                judul TEXT NOT NULL,
                deskripsi TEXT,
                video_url TEXT,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size INTEGER NOT NULL,
                kelas TEXT,
                path TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        # Seed default catalog if missing
        row = conn.execute("SELECT value FROM kv_store WHERE key = 'catalog'").fetchone()
        if not row:
            default_catalog = {
                "materi": [],
                "tugas": [],
                "lkpd": [],
                "quiz": [],
                "pengumuman": [],
                "updatedAt": now_iso(),
            }
            conn.execute(
                "INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)",
                ("catalog", json.dumps(default_catalog, ensure_ascii=False), default_catalog["updatedAt"]),
            )
        conn.commit()


def hash_pw(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"{salt}${dk.hex()}"


def verify_pw(password: str, stored_hash: Optional[str]) -> bool:
    if not stored_hash:
        return True  # Legacy/default seeded student without password yet
    if "$" not in stored_hash:
        return hmac.compare_digest(password, stored_hash)
    salt, expected = stored_hash.split("$", 1)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return hmac.compare_digest(dk.hex(), expected)


def has_staff_access(given: str) -> bool:
    if not given:
        return False
    return hmac.compare_digest(given, GURU_PASSPHRASE) or hmac.compare_digest(given, ADMIN_PASSWORD)


def require_staff(x_guru_passphrase: Optional[str]) -> None:
    if not has_staff_access(x_guru_passphrase or ""):
        raise HTTPException(status_code=401, detail="Passphrase guru / password admin salah.")


def clean_submission(jenis: str, entry: dict[str, Any]) -> dict[str, Any]:
    safe = dict(entry)
    for field in ("nilai", "catatan", "status", "dinilaiPada"):
        safe.pop(field, None)
    if not str(safe.get("userId") or "").strip():
        raise HTTPException(status_code=400, detail="Identitas siswa wajib diisi.")
    if jenis == "quiz":
        try:
            total = int(safe.get("total", 0))
            benar = int(safe.get("benar", -1))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Jumlah jawaban quiz tidak valid.")
        if total < 1 or benar < 0 or benar > total:
            raise HTTPException(status_code=400, detail="Jumlah jawaban quiz tidak valid.")
        safe["nilai"] = round(benar / total * 100)
        safe["status"] = "Selesai"
    return safe


def read_catalog_dict() -> dict[str, Any]:
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM kv_store WHERE key = 'catalog'").fetchone()
        if not row:
            return {"materi": [], "tugas": [], "lkpd": [], "quiz": [], "pengumuman": [], "updatedAt": now_iso()}
        return json.loads(row["value"])


def read_activity_dict() -> dict[str, Any]:
    out: dict[str, Any] = {"tugas": {}, "lkpd": {}, "quiz": {}, "absensi": {}}
    with get_conn() as conn:
        for r in conn.execute("SELECT jenis, item_key, payload_json FROM submissions"):
            bucket = out.setdefault(r["jenis"], {}).setdefault(r["item_key"], [])
            bucket.append(json.loads(r["payload_json"]))
        for r in conn.execute("SELECT key, data_json FROM attendance"):
            out["absensi"][r["key"]] = json.loads(r["data_json"])
    return out


init_db()


@app.get("/api/health")
def health():
    with get_conn() as conn:
        acc_count = conn.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
        sub_count = conn.execute("SELECT COUNT(*) FROM submissions").fetchone()[0]
        top_count = conn.execute("SELECT COUNT(*) FROM catalog_topics").fetchone()[0]
    cat = read_catalog_dict()
    return {
        "ok": True,
        "engine": "Google Colab SQLite",
        "dbPath": str(DB_PATH),
        "driveMounted": Path("/content/drive/MyDrive").exists(),
        "counts": {
            "materi": len(cat.get("materi", [])),
            "tugas": len(cat.get("tugas", [])),
            "lkpd": len(cat.get("lkpd", [])),
            "quiz": len(cat.get("quiz", [])),
            "accounts": acc_count,
            "submissions": sub_count,
            "topics": top_count,
        },
        "updatedAt": cat.get("updatedAt"),
    }


@app.post("/api/teacher-login")
async def teacher_login(request: Request):
    body = await request.json()
    pw = str(body.get("password") or "")
    if not has_staff_access(pw):
        return JSONResponse({"ok": False, "error": "Akun siswa tidak dapat masuk sebagai guru."}, status_code=401)
    return {"ok": True}


@app.post("/api/admin-login")
async def admin_login(request: Request):
    body = await request.json()
    pw = str(body.get("password") or "")
    if not hmac.compare_digest(pw, ADMIN_PASSWORD):
        return JSONResponse({"ok": False, "error": "Password admin salah."}, status_code=401)
    return {"ok": True}


@app.get("/api/teacher-session")
def teacher_session(x_guru_passphrase: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase)
    return {"ok": True}


@app.post("/api/login")
async def student_login(request: Request):
    body = await request.json()
    nis = str(body.get("nis") or "").strip()
    pw = str(body.get("password") or "")
    if not nis or not pw:
        raise HTTPException(status_code=400, detail="NIS dan password wajib diisi.")
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM accounts WHERE nis = ?", (nis,)).fetchone()
        if not row or not verify_pw(pw, row["password_hash"]):
            raise HTTPException(status_code=401, detail="NIS atau password salah.")
        ts = int(datetime.now(timezone.utc).timestamp() * 1000)
        conn.execute("UPDATE accounts SET terakhir_masuk = ?, updated_at = ? WHERE nis = ?", (ts, now_iso(), nis))
        conn.commit()
        return {
            "ok": True,
            "account": {"nis": row["nis"], "nama": row["nama"], "kelas": row["kelas"], "terakhirMasuk": ts},
        }


@app.get("/api/catalog")
def get_catalog():
    return read_catalog_dict()


@app.post("/api/catalog")
async def save_catalog(request: Request, x_guru_passphrase: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase)
    payload = await request.json()
    current = read_catalog_dict()
    expected_rev = payload.get("updatedAt")
    if expected_rev and current.get("updatedAt") and expected_rev != current.get("updatedAt"):
        # Allow forced merge only when explicit revision matches or fresh
        if not payload.get("force"):
            raise HTTPException(status_code=409, detail="Katalog sudah diperbarui. Muat ulang sebelum menyimpan.")
    next_cat = {
        "materi": payload.get("materi", current.get("materi", [])),
        "tugas": payload.get("tugas", current.get("tugas", [])),
        "lkpd": payload.get("lkpd", current.get("lkpd", [])),
        "quiz": payload.get("quiz", current.get("quiz", [])),
        "pengumuman": payload.get("pengumuman", current.get("pengumuman", [])),
        "updatedAt": now_iso(),
    }
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)",
            ("catalog", json.dumps(next_cat, ensure_ascii=False), next_cat["updatedAt"]),
        )
        conn.commit()
    return next_cat


@app.get("/api/activity")
def get_activity():
    return read_activity_dict()


@app.post("/api/activity")
async def save_activity(request: Request, x_guru_passphrase: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase)
    payload = await request.json()
    ts = now_iso()
    with get_conn() as conn:
        for jenis in ("tugas", "lkpd", "quiz"):
            bucket_map = payload.get(jenis) or {}
            if isinstance(bucket_map, dict):
                for item_key, entries in bucket_map.items():
                    for entry in entries or []:
                        if not isinstance(entry, dict):
                            continue
                        uid = str(entry.get("userId") or entry.get("nis") or entry.get("nama") or uuid.uuid4())
                        conn.execute(
                            """
                            INSERT INTO submissions (id, jenis, item_key, user_id, nama, kelas, payload_json, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(jenis, item_key, user_id) DO UPDATE SET
                                nama=excluded.nama,
                                kelas=excluded.kelas,
                                payload_json=excluded.payload_json,
                                updated_at=excluded.updated_at
                            """,
                            (
                                str(uuid.uuid4()),
                                jenis,
                                str(item_key),
                                uid,
                                str(entry.get("nama") or "Siswa"),
                                str(entry.get("kelas") or ""),
                                json.dumps(entry, ensure_ascii=False),
                                ts,
                            ),
                        )
        absensi_map = payload.get("absensi") or {}
        if isinstance(absensi_map, dict):
            for k, val in absensi_map.items():
                parts = str(k).split("|", 1)
                conn.execute(
                    "INSERT OR REPLACE INTO attendance (key, kelas, tanggal, data_json, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (str(k), parts[0], parts[1] if len(parts) > 1 else "", json.dumps(val, ensure_ascii=False), ts),
                )
        conn.commit()
    return read_activity_dict()


@app.post("/api/submit")
async def submit_work(request: Request):
    payload = await request.json()
    jenis = payload.get("jenis")
    if jenis not in ("tugas", "lkpd", "quiz"):
        raise HTTPException(status_code=400, detail="Jenis pengumpulan tidak dikenal.")
    item_key = str(payload.get("itemKey") or "")
    if not item_key:
        raise HTTPException(status_code=400, detail="Item tidak valid.")
    entry = payload.get("entry")
    if not isinstance(entry, dict):
        raise HTTPException(status_code=400, detail="Isi pengumpulan tidak valid.")
    safe = clean_submission(jenis, entry)
    uid = str(safe["userId"])
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO submissions (id, jenis, item_key, user_id, nama, kelas, payload_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(jenis, item_key, user_id) DO UPDATE SET
                nama=excluded.nama,
                kelas=excluded.kelas,
                payload_json=excluded.payload_json,
                updated_at=excluded.updated_at
            """,
            (
                str(uuid.uuid4()),
                jenis,
                item_key,
                uid,
                str(safe.get("nama") or "Siswa"),
                str(safe.get("kelas") or ""),
                json.dumps(safe, ensure_ascii=False),
                now_iso(),
            ),
        )
        conn.commit()
    return read_activity_dict()


@app.get("/api/accounts")
def list_accounts(x_guru_passphrase: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase)
    with get_conn() as conn:
        rows = conn.execute("SELECT nis, nama, kelas, terakhir_masuk FROM accounts ORDER BY kelas, nama").fetchall()
    return {
        "accounts": [
            {"nis": r["nis"], "nama": r["nama"], "kelas": r["kelas"], "terakhirMasuk": r["terakhir_masuk"]}
            for r in rows
        ]
    }


@app.post("/api/accounts")
async def mutate_accounts(request: Request, x_guru_passphrase: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase)
    body = await request.json()
    action = body.get("action")
    ts = now_iso()
    with get_conn() as conn:
        if action == "delete":
            nis = str(body.get("nis") or "").strip()
            conn.execute("DELETE FROM accounts WHERE nis = ?", (nis,))
        elif action == "bulk":
            for row in body.get("accounts") or []:
                nis = str(row.get("nis") or "").strip()
                if not nis:
                    continue
                pw = str(row.get("password") or "")
                pw_hash = hash_pw(pw) if pw else None
                conn.execute(
                    """
                    INSERT INTO accounts (nis, nama, kelas, password_hash, terakhir_masuk, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(nis) DO UPDATE SET
                        nama=excluded.nama,
                        kelas=excluded.kelas,
                        password_hash=COALESCE(excluded.password_hash, accounts.password_hash),
                        updated_at=excluded.updated_at
                    """,
                    (nis, str(row.get("nama") or "")[:80], str(row.get("kelas") or "")[:20], pw_hash, row.get("terakhirMasuk"), ts),
                )
        else:
            nis = str(body.get("nis") or "").strip()
            if not nis:
                raise HTTPException(status_code=400, detail="NIS wajib diisi.")
            pw = str(body.get("password") or "")
            pw_hash = hash_pw(pw) if pw else None
            conn.execute(
                """
                INSERT INTO accounts (nis, nama, kelas, password_hash, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(nis) DO UPDATE SET
                    nama=excluded.nama,
                    kelas=excluded.kelas,
                    password_hash=COALESCE(excluded.password_hash, accounts.password_hash),
                    updated_at=excluded.updated_at
                """,
                (nis, str(body.get("nama") or "")[:80], str(body.get("kelas") or "")[:20], pw_hash, ts),
            )
        conn.commit()
    return list_accounts(x_guru_passphrase)


@app.get("/api/topics")
def list_topics():
    with get_conn() as conn:
        rows = conn.execute("SELECT id, jenjang, kelas, judul, deskripsi, video_url, updated_at FROM catalog_topics").fetchall()
    return {"topics": [dict(r) for r in rows]}


@app.post("/api/topics")
async def upsert_topics(request: Request, x_guru_passphrase: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase)
    body = await request.json()
    items = body.get("topics") if isinstance(body.get("topics"), list) else [body]
    ts = now_iso()
    with get_conn() as conn:
        for t in items:
            tid = str(t.get("id") or "")
            if not tid:
                continue
            conn.execute(
                """
                INSERT OR REPLACE INTO catalog_topics (id, jenjang, kelas, judul, deskripsi, video_url, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tid,
                    str(t.get("jenjang") or "SMA"),
                    str(t.get("kelas") or "ALL"),
                    str(t.get("judul") or tid),
                    str(t.get("deskripsi") or ""),
                    t.get("video_url"),
                    ts,
                ),
            )
        conn.commit()
    return list_topics()


@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    kelas: str = Form(default="ALL"),
    x_guru_passphrase: Optional[str] = Header(default=""),
):
    require_staff(x_guru_passphrase)
    file_id = str(uuid.uuid4())
    safe_name = (file.filename or "materi").replace("/", "_").replace("\\", "_")
    dest = FILES_DIR / f"{file_id}_{safe_name}"
    raw = await file.read()
    dest.write_bytes(raw)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO files (id, name, mime_type, size, kelas, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (file_id, safe_name, file.content_type or "application/octet-stream", len(raw), kelas, str(dest), now_iso()),
        )
        conn.commit()
    return {
        "id": file_id,
        "name": safe_name,
        "mimeType": file.content_type or "application/octet-stream",
        "size": len(raw),
        "viewLink": f"/api/files/{file_id}",
        "previewLink": f"/api/files/{file_id}",
        "downloadLink": f"/api/files/{file_id}?download=1",
    }


@app.get("/api/files/{file_id}")
def get_file(file_id: str, download: Optional[int] = 0):
    with get_conn() as conn:
        row = conn.execute("SELECT name, mime_type, path FROM files WHERE id = ?", (file_id,)).fetchone()
    if not row or not Path(row["path"]).exists():
        raise HTTPException(status_code=404, detail="File tidak ditemukan.")
    disp = "attachment" if download else "inline"
    return FileResponse(
        row["path"],
        media_type=row["mime_type"],
        headers={"Content-Disposition": f'{disp}; filename="{row["name"]}"'},
    )


@app.post("/api/migrate")
async def migrate_from_browser(request: Request, x_guru_passphrase: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase)
    payload = await request.json()
    stats = {"catalog": 0, "accounts": 0, "submissions": 0, "topics": 0}
    ts = now_iso()

    # 1. Merge catalog
    if isinstance(payload.get("catalog"), dict):
        cur = read_catalog_dict()
        merged = {
            "materi": payload["catalog"].get("materi") or cur.get("materi", []),
            "tugas": payload["catalog"].get("tugas") or cur.get("tugas", []),
            "lkpd": payload["catalog"].get("lkpd") or cur.get("lkpd", []),
            "quiz": payload["catalog"].get("quiz") or cur.get("quiz", []),
            "pengumuman": payload["catalog"].get("pengumuman") or cur.get("pengumuman", []),
            "updatedAt": ts,
        }
        with get_conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)",
                ("catalog", json.dumps(merged, ensure_ascii=False), ts),
            )
            conn.commit()
        stats["catalog"] = sum(len(merged[k]) for k in ("materi", "tugas", "lkpd", "quiz", "pengumuman"))

    # 2. Accounts
    if isinstance(payload.get("accounts"), list):
        with get_conn() as conn:
            for row in payload["accounts"]:
                nis = str(row.get("nis") or "").strip()
                if not nis:
                    continue
                conn.execute(
                    """
                    INSERT INTO accounts (nis, nama, kelas, terakhir_masuk, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(nis) DO UPDATE SET
                        nama=excluded.nama,
                        kelas=excluded.kelas,
                        terakhir_masuk=COALESCE(excluded.terakhir_masuk, accounts.terakhir_masuk),
                        updated_at=excluded.updated_at
                    """,
                    (nis, str(row.get("nama") or "")[:80], str(row.get("kelas") or "")[:20], row.get("terakhirMasuk"), ts),
                )
                stats["accounts"] += 1
            conn.commit()

    # 3. Activity & submissions
    if isinstance(payload.get("activity"), dict):
        await save_activity_internal(payload["activity"], ts)
        stats["submissions"] = sum(
            len(v) for k in ("tugas", "lkpd", "quiz") for v in (payload["activity"].get(k) or {}).values()
        )

    # 4. Topics
    if isinstance(payload.get("topics"), list):
        with get_conn() as conn:
            for t in payload["topics"]:
                tid = str(t.get("id") or "")
                if not tid:
                    continue
                conn.execute(
                    "INSERT OR REPLACE INTO catalog_topics (id, jenjang, kelas, judul, deskripsi, video_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (tid, t.get("jenjang", "SMA"), t.get("kelas", "ALL"), t.get("judul", tid), t.get("deskripsi", ""), t.get("video_url"), ts),
                )
                stats["topics"] += 1
            conn.commit()

    return {"ok": True, "stats": stats, "updatedAt": ts}


async def save_activity_internal(payload: dict[str, Any], ts: str) -> None:
    with get_conn() as conn:
        for jenis in ("tugas", "lkpd", "quiz"):
            bucket_map = payload.get(jenis) or {}
            if isinstance(bucket_map, dict):
                for item_key, entries in bucket_map.items():
                    for entry in entries or []:
                        if not isinstance(entry, dict):
                            continue
                        uid = str(entry.get("userId") or entry.get("nis") or entry.get("nama") or uuid.uuid4())
                        conn.execute(
                            """
                            INSERT INTO submissions (id, jenis, item_key, user_id, nama, kelas, payload_json, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(jenis, item_key, user_id) DO UPDATE SET
                                nama=excluded.nama,
                                kelas=excluded.kelas,
                                payload_json=excluded.payload_json,
                                updated_at=excluded.updated_at
                            """,
                            (
                                str(uuid.uuid4()),
                                jenis,
                                str(item_key),
                                uid,
                                str(entry.get("nama") or "Siswa"),
                                str(entry.get("kelas") or ""),
                                json.dumps(entry, ensure_ascii=False),
                                ts,
                            ),
                        )
        absensi_map = payload.get("absensi") or {}
        if isinstance(absensi_map, dict):
            for k, val in absensi_map.items():
                parts = str(k).split("|", 1)
                conn.execute(
                    "INSERT OR REPLACE INTO attendance (key, kelas, tanggal, data_json, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (str(k), parts[0], parts[1] if len(parts) > 1 else "", json.dumps(val, ensure_ascii=False), ts),
                )
        conn.commit()


@app.post("/api/reset")
def reset_all(x_guru_passphrase: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase)
    with get_conn() as conn:
        conn.executescript(
            """
            DELETE FROM submissions;
            DELETE FROM attendance;
            DELETE FROM accounts;
            DELETE FROM catalog_topics;
            DELETE FROM files;
            DELETE FROM kv_store;
            """
        )
        conn.commit()
    init_db()
    return {"ok": True}
