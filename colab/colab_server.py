"""
Portal Belajar SMA NU Kaplongan — Backend & SQLite Database Server for Google Colab.
Persists all data (Materi, Tugas, LKPD, Quiz, Pengumuman, Submissions, Absensi, Akun, Video)
into SQLite (optionally on Google Drive) and exposes a CORS-enabled FastAPI REST API.
"""
import base64
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
TOKEN_SECRET = os.environ.get(
    "PORTAL_TOKEN_SECRET",
    hashlib.sha256(f"{ADMIN_PASSWORD}:{GURU_PASSPHRASE}:pb-kaplongan".encode("utf-8")).hexdigest(),
)

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
            CREATE TABLE IF NOT EXISTS live_rooms (
                pin TEXT PRIMARY KEY,
                host_name TEXT NOT NULL,
                mode TEXT NOT NULL,
                kelas TEXT NOT NULL,
                quiz_json TEXT NOT NULL,
                status TEXT NOT NULL,
                players_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
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


def _b64u(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64u_dec(txt: str) -> bytes:
    pad = "=" * (-len(txt) % 4)
    return base64.urlsafe_b64decode(txt + pad)


def create_session_token(role: str, subject: str, ttl_seconds: int = 60 * 60 * 24 * 7) -> tuple[str, int]:
    now_ts = int(datetime.now(timezone.utc).timestamp())
    exp_ts = now_ts + ttl_seconds
    header = _b64u(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode("utf-8"))
    payload = _b64u(json.dumps({"role": role, "sub": subject, "iat": now_ts, "exp": exp_ts}, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header}.{payload}".encode("ascii")
    sig = _b64u(hmac.new(TOKEN_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}", exp_ts


def verify_session_token(token: str) -> Optional[dict[str, Any]]:
    if not token or token.count(".") != 2:
        return None
    try:
        header_b64, payload_b64, sig_b64 = token.split(".", 2)
        expected_sig = _b64u(hmac.new(TOKEN_SECRET.encode("utf-8"), f"{header_b64}.{payload_b64}".encode("ascii"), hashlib.sha256).digest())
        if not hmac.compare_digest(sig_b64, expected_sig):
            return None
        data = json.loads(_b64u_dec(payload_b64).decode("utf-8"))
        if int(data.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
            return None
        return data
    except Exception:
        return None


def extract_bearer(authorization: Optional[str]) -> str:
    raw = str(authorization or "").strip()
    if raw.lower().startswith("bearer "):
        return raw[7:].strip()
    return ""


def has_staff_access(given: str, authorization: Optional[str] = "") -> bool:
    if given and (hmac.compare_digest(given, GURU_PASSPHRASE) or hmac.compare_digest(given, ADMIN_PASSWORD)):
        return True
    tok = verify_session_token(extract_bearer(authorization))
    return bool(tok and tok.get("role") in ("guru", "admin"))


def require_staff(x_guru_passphrase: Optional[str], authorization: Optional[str] = "") -> None:
    if not has_staff_access(x_guru_passphrase or "", authorization):
        raise HTTPException(status_code=401, detail="Passphrase guru / password admin atau token sesi tidak valid.")


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
    role = "admin" if hmac.compare_digest(pw, ADMIN_PASSWORD) else "guru"
    token, exp = create_session_token(role, role)
    return {"ok": True, "role": role, "token": token, "expiresAt": exp}


@app.post("/api/admin-login")
async def admin_login(request: Request):
    body = await request.json()
    pw = str(body.get("password") or "")
    if not hmac.compare_digest(pw, ADMIN_PASSWORD):
        return JSONResponse({"ok": False, "error": "Password admin salah."}, status_code=401)
    token, exp = create_session_token("admin", "admin")
    return {"ok": True, "role": "admin", "token": token, "expiresAt": exp}


@app.get("/api/teacher-session")
def teacher_session(x_guru_passphrase: Optional[str] = Header(default=""), authorization: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase, authorization)
    return {"ok": True}


@app.get("/api/auth/verify")
def verify_auth_token(authorization: Optional[str] = Header(default="")):
    tok = verify_session_token(extract_bearer(authorization))
    if not tok:
        raise HTTPException(status_code=401, detail="Token sesi kedaluwarsa atau tidak valid.")
    return {"ok": True, "role": tok.get("role"), "sub": tok.get("sub"), "expiresAt": tok.get("exp")}


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
        token, exp = create_session_token("siswa", row["nis"])
        return {
            "ok": True,
            "role": "siswa",
            "token": token,
            "expiresAt": exp,
            "account": {"nis": row["nis"], "nama": row["nama"], "kelas": row["kelas"], "terakhirMasuk": ts},
        }


@app.get("/api/catalog")
def get_catalog():
    return read_catalog_dict()


@app.post("/api/catalog")
async def save_catalog(request: Request, x_guru_passphrase: Optional[str] = Header(default=""), authorization: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase, authorization)
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
async def save_activity(request: Request, x_guru_passphrase: Optional[str] = Header(default=""), authorization: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase, authorization)
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
def list_accounts(x_guru_passphrase: Optional[str] = Header(default=""), authorization: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase, authorization)
    with get_conn() as conn:
        rows = conn.execute("SELECT nis, nama, kelas, terakhir_masuk FROM accounts ORDER BY kelas, nama").fetchall()
    return {
        "accounts": [
            {"nis": r["nis"], "nama": r["nama"], "kelas": r["kelas"], "terakhirMasuk": r["terakhir_masuk"]}
            for r in rows
        ]
    }


@app.post("/api/accounts")
async def mutate_accounts(request: Request, x_guru_passphrase: Optional[str] = Header(default=""), authorization: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase, authorization)
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
async def upsert_topics(request: Request, x_guru_passphrase: Optional[str] = Header(default=""), authorization: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase, authorization)
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
    authorization: Optional[str] = Header(default=""),
):
    require_staff(x_guru_passphrase, authorization)
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


@app.get("/api/files")
def list_files(kelas: Optional[str] = None):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, mime_type, size, kelas, created_at FROM files ORDER BY created_at DESC LIMIT 200"
        ).fetchall()
    out = []
    kf = str(kelas or "").strip().upper()
    for r in rows:
        rk = str(r["kelas"] or "ALL").strip().upper()
        if kf and kf != "ALL" and rk != "ALL" and rk != kf:
            continue
        fid = r["id"]
        out.append(
            {
                "id": fid,
                "name": r["name"],
                "mimeType": r["mime_type"],
                "size": r["size"],
                "kelas": r["kelas"] or "ALL",
                "createdAt": r["created_at"],
                "viewLink": f"/api/files/{fid}",
                "previewLink": f"/api/files/{fid}",
                "downloadLink": f"/api/files/{fid}?download=1",
            }
        )
    return {"files": out}


@app.get("/api/leaderboard")
def get_leaderboard(kelas: Optional[str] = None):
    act = read_activity_dict()
    with get_conn() as conn:
        accs = conn.execute("SELECT nis, nama, kelas FROM accounts ORDER BY kelas, nama").fetchall()
    board: dict[str, dict[str, Any]] = {}
    for a in accs:
        board[a["nis"]] = {
            "nis": a["nis"],
            "nama": a["nama"],
            "kelas": a["kelas"],
            "xp": 0,
            "tugasDone": 0,
            "lkpdDone": 0,
            "quizDone": 0,
            "scores": [],
        }
    for jenis in ("tugas", "lkpd", "quiz"):
        for item_key, entries in (act.get(jenis) or {}).items():
            for e in entries or []:
                if not isinstance(e, dict):
                    continue
                uid = str(e.get("userId") or e.get("nis") or "").strip()
                if not uid or uid == "me":
                    continue
                rec = board.get(uid)
                if not rec:
                    rec = {
                        "nis": uid,
                        "nama": str(e.get("nama") or "Siswa"),
                        "kelas": str(e.get("kelas") or "-"),
                        "xp": 0,
                        "tugasDone": 0,
                        "lkpdDone": 0,
                        "quizDone": 0,
                        "scores": [],
                    }
                    board[uid] = rec
                if jenis == "lkpd" and item_key == "game-progress":
                    rec["xp"] = max(rec["xp"], int(e.get("xp") or 0))
                else:
                    if jenis == "tugas":
                        rec["tugasDone"] += 1
                    elif jenis == "lkpd":
                        rec["lkpdDone"] += 1
                    elif jenis == "quiz":
                        rec["quizDone"] += 1
                    if e.get("nilai") is not None:
                        try:
                            rec["scores"].append(float(e["nilai"]))
                        except (TypeError, ValueError):
                            pass
    kf = str(kelas or "").strip().upper()
    rows_out = []
    for rec in board.values():
        if kf and kf != "ALL" and str(rec["kelas"] or "").upper() != kf:
            continue
        done_total = rec["tugasDone"] + rec["lkpdDone"] + rec["quizDone"]
        avg = round(sum(rec["scores"]) / len(rec["scores"]), 1) if rec["scores"] else 0.0
        pts = rec["xp"] + done_total * 25 + round(avg)
        badges = []
        if rec["xp"] >= 100:
            badges.append("🎮 Master Game")
        if done_total >= 3:
            badges.append("🔥 Rajin Belajar")
        if avg >= 85 and rec["scores"]:
            badges.append("⭐ Nilai Tinggi")
        if rec["quizDone"] >= 1:
            badges.append("⚡ Penakluk Quiz")
        rows_out.append(
            {
                "nis": rec["nis"],
                "nama": rec["nama"],
                "kelas": rec["kelas"],
                "xp": rec["xp"],
                "doneCount": done_total,
                "avgScore": avg,
                "points": pts,
                "badges": badges,
            }
        )
    rows_out.sort(key=lambda x: (x["points"], x["xp"], x["avgScore"]), reverse=True)
    return {"leaderboard": rows_out, "updatedAt": now_iso()}


@app.post("/api/live/create")
async def live_create(
    request: Request,
    x_guru_passphrase: Optional[str] = Header(default=""),
    authorization: Optional[str] = Header(default=""),
):
    require_staff(x_guru_passphrase, authorization)
    body = await request.json()
    pin = str(100000 + secrets.randbelow(900000))
    ts = now_iso()
    mode = str(body.get("mode") or "gold")
    kelas = str(body.get("kelas") or "ALL")
    host_name = str(body.get("hostName") or "Guru")
    quiz = body.get("quiz") or {}
    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO live_rooms (pin, host_name, mode, kelas, quiz_json, status, players_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (pin, host_name, mode, kelas, json.dumps(quiz, ensure_ascii=False), "waiting", "{}", ts, ts),
        )
        conn.commit()
    return {"ok": True, "pin": pin, "mode": mode, "kelas": kelas, "status": "waiting", "players": [], "quiz": quiz, "updatedAt": ts}


@app.get("/api/live/{pin}")
def live_get(pin: str):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM live_rooms WHERE pin = ?", (str(pin).strip(),)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Room PIN tidak ditemukan atau sudah ditutup.")
    players_map = json.loads(row["players_json"] or "{}")
    players = sorted(players_map.values(), key=lambda p: (int(p.get("score") or 0), int(p.get("streak") or 0)), reverse=True)
    return {
        "ok": True,
        "pin": row["pin"],
        "hostName": row["host_name"],
        "mode": row["mode"],
        "kelas": row["kelas"],
        "status": row["status"],
        "quiz": json.loads(row["quiz_json"] or "{}"),
        "players": players,
        "updatedAt": row["updated_at"],
    }


@app.post("/api/live/join")
async def live_join(request: Request):
    body = await request.json()
    pin = str(body.get("pin") or "").strip()
    uid = str(body.get("userId") or body.get("nis") or body.get("nama") or "").strip()
    if not pin or not uid:
        raise HTTPException(status_code=400, detail="PIN dan identitas siswa wajib diisi.")
    ts = now_iso()
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM live_rooms WHERE pin = ?", (pin,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="PIN kelas tidak ditemukan.")
        players_map = json.loads(row["players_json"] or "{}")
        cur = players_map.get(uid) or {}
        players_map[uid] = {
            "userId": uid,
            "nama": str(body.get("nama") or cur.get("nama") or "Siswa")[:60],
            "kelas": str(body.get("kelas") or cur.get("kelas") or "")[:20],
            "ava": str(body.get("ava") or cur.get("ava") or "🦊")[:8],
            "score": int(cur.get("score") or 0),
            "streak": int(cur.get("streak") or 0),
            "answered": int(cur.get("answered") or 0),
            "finished": bool(cur.get("finished") or False),
            "joinedAt": cur.get("joinedAt") or ts,
        }
        conn.execute(
            "UPDATE live_rooms SET players_json = ?, updated_at = ? WHERE pin = ?",
            (json.dumps(players_map, ensure_ascii=False), ts, pin),
        )
        conn.commit()
    return live_get(pin)


@app.post("/api/live/score")
async def live_score(request: Request):
    body = await request.json()
    pin = str(body.get("pin") or "").strip()
    uid = str(body.get("userId") or body.get("nis") or body.get("nama") or "").strip()
    if not pin or not uid:
        raise HTTPException(status_code=400, detail="PIN dan userId wajib diisi.")
    ts = now_iso()
    with get_conn() as conn:
        row = conn.execute("SELECT players_json FROM live_rooms WHERE pin = ?", (pin,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="PIN kelas tidak ditemukan.")
        players_map = json.loads(row["players_json"] or "{}")
        cur = players_map.get(uid) or {"userId": uid, "nama": str(body.get("nama") or "Siswa"), "kelas": str(body.get("kelas") or ""), "ava": "🦊"}
        cur["score"] = max(0, int(body.get("score") or 0))
        cur["streak"] = max(0, int(body.get("streak") or 0))
        cur["answered"] = max(0, int(body.get("answered") or 0))
        cur["finished"] = bool(body.get("finished") or False)
        players_map[uid] = cur
        conn.execute(
            "UPDATE live_rooms SET players_json = ?, updated_at = ? WHERE pin = ?",
            (json.dumps(players_map, ensure_ascii=False), ts, pin),
        )
        conn.commit()
    return live_get(pin)


@app.post("/api/live/{pin}/state")
async def live_state(
    pin: str,
    request: Request,
    x_guru_passphrase: Optional[str] = Header(default=""),
    authorization: Optional[str] = Header(default=""),
):
    require_staff(x_guru_passphrase, authorization)
    body = await request.json()
    status = str(body.get("status") or "playing")
    if status not in ("waiting", "playing", "finished"):
        raise HTTPException(status_code=400, detail="Status room tidak valid.")
    ts = now_iso()
    with get_conn() as conn:
        cur = conn.execute("SELECT pin FROM live_rooms WHERE pin = ?", (str(pin).strip(),)).fetchone()
        if not cur:
            raise HTTPException(status_code=404, detail="Room PIN tidak ditemukan.")
        conn.execute("UPDATE live_rooms SET status = ?, updated_at = ? WHERE pin = ?", (status, ts, str(pin).strip()))
        conn.commit()
    return live_get(pin)


@app.post("/api/migrate")
async def migrate_from_browser(request: Request, x_guru_passphrase: Optional[str] = Header(default=""), authorization: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase, authorization)
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
def reset_all(x_guru_passphrase: Optional[str] = Header(default=""), authorization: Optional[str] = Header(default="")):
    require_staff(x_guru_passphrase, authorization)
    with get_conn() as conn:
        conn.executescript(
            """
            DELETE FROM submissions;
            DELETE FROM attendance;
            DELETE FROM accounts;
            DELETE FROM catalog_topics;
            DELETE FROM files;
            DELETE FROM live_rooms;
            DELETE FROM kv_store;
            """
        )
        conn.commit()
    init_db()
    return {"ok": True}
