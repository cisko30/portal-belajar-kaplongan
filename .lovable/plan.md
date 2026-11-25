## Tujuan
Sinkronisasi penuh data Admin ↔ Guru ↔ Siswa lewat backend Lovable Cloud. Semua perubahan (kelas, materi, tugas, LKPD, quiz, absensi, nilai, submission, video katalog) langsung muncul di semua perangkat/user secara real-time.

## Arsitektur

```text
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Admin     │    │    Guru     │    │   Siswa     │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       └──────────────────┼──────────────────┘
                          ▼
              Lovable Cloud (Supabase)
        Auth · Database · Storage · Realtime
```

Karena aplikasi saat ini masih HTML statis di `public/`, saya panggil Supabase langsung dari browser lewat `@supabase/supabase-js` (CDN), dengan RLS ketat sebagai lapisan keamanan.

## Skema Database

| Tabel | Isi utama |
|---|---|
| `profiles` | id (=auth.users.id), nama, role tampilan, kelas_id (untuk siswa) |
| `user_roles` | user_id, role (`admin`/`guru`/`siswa`) — terpisah, anti-privilege-escalation |
| `classes` | id, kode (VIII-A, X-1, dst), nama, mapel, tingkat |
| `materials` | id, judul, kelas_id (nullable=semua kelas), deskripsi, link, file_url, status (draft/terbit), created_by |
| `assignments` | id, judul, kelas_id, deskripsi, deadline, created_by |
| `lkpd` | id, judul, kelas_id, deskripsi, created_by |
| `quizzes` | id, judul, kelas_id, created_by |
| `quiz_questions` | id, quiz_id, pertanyaan, opsi[], jawaban_benar |
| `submissions` | id, kind (tugas/lkpd/quiz), item_id, siswa_id, jawaban_teks, file_url, skor, status (menunggu/dinilai/revisi), catatan_guru |
| `attendance` | id, kelas_id, siswa_id, tanggal, status (H/I/S/A), diinput_oleh |
| `catalog_topics` | id, jenjang (SMP/SMA), kelas, judul, deskripsi, video_url, sumber_url — untuk portal landing |
| `audit_log` | akses ditolak / manipulasi (dari Guard) |

Storage bucket: `materials` (file materi guru) dan `submissions` (upload siswa).

## Keamanan (RLS)

- `materials/assignments/lkpd/quizzes`: guru boleh CRUD miliknya; siswa hanya SELECT baris yang `kelas_id = profil.kelas_id` **atau** `kelas_id IS NULL`.
- `submissions`: siswa hanya lihat/insert miliknya sendiri; guru lihat semua yang terkait item ciptaannya; hanya guru boleh update `skor/status/catatan_guru`.
- `attendance`: guru CRUD; siswa hanya SELECT barisnya.
- `catalog_topics`: SELECT terbuka (`anon`); UPDATE hanya `admin`/`guru`.
- `user_roles`: dibaca via fungsi `has_role()` SECURITY DEFINER.

## Auth

- Email/password + Google OAuth (default Lovable Cloud).
- Halaman login baru menggantikan `doLogin()` di `portal-belajar.html`.
- Setelah signup, siswa tetap wajib pilih kelas (dari whitelist Pak Cisko) — disimpan ke `profiles.kelas_id`.

## Migrasi Data Lokal

Saat user pertama kali login pasca-upgrade, script `migrate.js` mendeteksi key `localStorage` lama (`pb.materials`, `pb.assignments`, dst) dan meng-upload ke tabel sesuai role. Setelah sukses → flag `pb.migrated=1` supaya tidak dobel.

## Perubahan Kode

1. Aktifkan Lovable Cloud (`supabase--enable`).
2. Migration SQL: buat semua tabel + enum + `has_role()` + RLS + GRANT + bucket storage.
3. Tambah `public/supabase-client.js`: init client dari CDN, ekspor helper `db.materials.list()`, `db.submissions.grade()`, dll.
4. Tulis ulang `public/feature-panels.js`: setiap panel fetch dari Supabase, subscribe `postgres_changes` untuk realtime, `Guard` divalidasi ulang oleh RLS (tetap sebagai UX layer).
5. Tambah `public/auth.html` (login/signup) + tombol logout di dashboard.
6. Update `portal-belajar.html`: editor video simpan ke `catalog_topics`, bukan localStorage.
7. `public/migrate.js`: one-shot uploader dari localStorage → Supabase.

## Yang Tidak Berubah
- Struktur visual dashboard-guru / dashboard-murid / portal-belajar tetap.
- `Guard`, class-gate deep-link, filter UI tetap ada sebagai lapisan pertama.
- Fitur AI Assistant tetap mock (bisa di-upgrade ke Lovable AI Gateway di iterasi berikutnya).

## Estimasi Ukuran
Besar — sekitar 1 migration panjang + ±800 baris JS baru + refactor `feature-panels.js`. Saya kerjakan dalam satu batch, dan verifikasi build + smoke test login-materi-submission.
