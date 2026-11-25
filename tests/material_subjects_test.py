"""Material subject regressions; isolated sessions and intercepted API writes."""
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright


class MaterialSubjectsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runner = sync_playwright().start()
        cls.browser = cls.runner.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.runner.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1280, "height": 1800})
        self.page = self.context.new_page()
        self.materials = [
            {"j": "Materi KKA", "k": "X-1", "mapel": "KKA", "s": "Terbit", "l": "https://example.com/kka"},
            {"j": "Materi Informatika", "k": "X-1", "mapel": "Informatika", "s": "Terbit"},
            {"j": "Materi kelas lain", "k": "X-2", "mapel": "KKA", "s": "Terbit"},
            {"j": "Materi lama", "k": "X-1", "s": "Terbit"},
        ]

        def intercept(route):
            if "catalog=1" in route.request.url:
                if route.request.method == "POST":
                    self.materials = route.request.post_data_json["materi"]
                    route.fulfill(json={"ok": True})
                else:
                    route.fulfill(json={"updatedAt": "sample", "materi": self.materials})
            elif "activity=1" in route.request.url:
                route.fulfill(json={"tugas": {}, "lkpd": {}, "quiz": {}, "absensi": {}})
            elif "accounts=1" in route.request.url:
                route.fulfill(json={"accounts": []})
            else:
                route.fulfill(json={"ready": False, "ok": True})

        self.page.route("**/api/**", intercept)

    def tearDown(self):
        self.context.close()

    def open_materials(self, role, classroom="X-1"):
        path = "dashboard-murid.html" if role == "murid" else "dashboard-guru.html"
        self.page.goto("http://localhost:8080/portal-belajar.html")
        self.page.evaluate("""([role, classroom]) => {
            localStorage.setItem('userRole', role);
            localStorage.setItem('pb.murid.myClass', JSON.stringify(classroom));
            localStorage.setItem('pb.murid.nama', 'Siswa Uji');
            localStorage.setItem('pb.guru.passphrase', 'isolated-test');
        }""", [role, classroom])
        self.page.evaluate("materials => localStorage.setItem('pb.guru.materi', JSON.stringify(materials))", self.materials)
        self.page.goto("http://localhost:8080/" + path)
        self.page.locator('.nav-item').filter(has_text="Materi").first.click()
        self.page.locator('#mFilter').wait_for()

    def test_x_subjects_separated_and_other_class_excluded(self):
        self.open_materials("murid")
        self.page.locator('#mFilter').select_option("KKA")
        self.assertEqual(self.page.locator('#fpB .fp-item .t').all_text_contents(), ["Materi KKA"])
        self.page.locator('#mFilter').select_option("Informatika")
        self.assertEqual(self.page.locator('#fpB .fp-item .t').all_text_contents(), ["Materi Informatika"])
        self.page.locator('#mFilter').select_option("")
        self.assertEqual(self.page.locator('#fpB .fp-item .t').all_text_contents(), ["Materi lama"])

    def test_viii_has_kka_not_informatika(self):
        self.materials = [dict(m, k="VIII-A") for m in self.materials[:2]]
        self.open_materials("murid", "VIII-A")
        self.assertEqual(self.page.locator('#mFilter option').evaluate_all('(els) => els.map(e=>e.value)'), ["ALL", "", "KKA"])
        self.assertEqual(self.page.locator('#fpB .fp-item .t').all_text_contents(), ["Materi KKA"])

    def test_teacher_classifies_legacy_and_publishes_new_material(self):
        self.open_materials("guru")
        legacy = self.page.get_by_label("Mata pelajaran Materi lama", exact=True)
        legacy.select_option("KKA")
        self.page.wait_for_function("() => JSON.parse(localStorage.getItem('pb.guru.materi')).find(m=>m.j==='Materi lama').mapel==='KKA'")
        self.page.locator('#mj').fill("Materi baru KKA")
        self.page.locator('#mk').select_option("X-1")
        self.page.locator('#mm').select_option("KKA")
        self.page.locator('#ml').fill("https://example.com/new")
        with self.page.expect_response(lambda r: 'catalog=1' in r.url and r.request.method == 'POST'):
            self.page.locator('#mAdd').click()
        self.assertEqual(self.materials[-1]["mapel"], "KKA")
        self.assertEqual(self.materials[-1]["k"], "X-1")
        self.open_materials("murid")
        self.page.locator('#mFilter').select_option("KKA")
        self.assertIn("Materi baru KKA", self.page.locator('#fpB .fp-item .t').all_text_contents())
        Path('/tmp/browser/material-subjects').mkdir(parents=True, exist_ok=True)
        self.page.locator('.fp-modal').screenshot(path='/tmp/browser/material-subjects/student-kka.png')


if __name__ == '__main__':
    unittest.main()