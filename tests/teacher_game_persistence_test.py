"""Staff gate and game permanence regressions; sample writes never reach real records."""
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright


class TeacherGamePersistenceTest(unittest.TestCase):
    def test_student_denied_and_saved_pack_survives_new_browser(self):
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            catalog = {'materi': [], 'tugas': [], 'lkpd': [], 'quiz': [], 'pengumuman': [], 'updatedAt': 'initial'}
            writes = []

            def intercept(route):
                req = route.request
                if 'teacher-login=1' in req.url:
                    ok = req.post_data_json.get('password') == 'staff-test'
                    route.fulfill(status=200 if ok else 401, json={'ok': ok, 'error': 'Akun siswa tidak dapat masuk sebagai guru.'})
                elif 'teacher-session=1' in req.url:
                    ok = req.headers.get('x-guru-passphrase') == 'staff-test'
                    route.fulfill(status=200 if ok else 401, json={'ok': ok})
                elif 'catalog=1' in req.url:
                    if req.method == 'POST':
                        body = req.post_data_json
                        self.assertEqual(body['updatedAt'], catalog['updatedAt'])
                        writes.append(body)
                        catalog.update(body)
                        catalog['updatedAt'] = 'saved'
                    route.fulfill(json=catalog)
                else:
                    route.fulfill(json={'ok': True, 'ready': False, 'tugas': {}, 'lkpd': {}, 'quiz': {}, 'absensi': {}})

            def new_page():
                ctx = browser.new_context(viewport={'width': 1280, 'height': 1800})
                ctx.route('**/api/**', intercept)
                ctx.route('**/firebase-config.json', lambda r: r.fulfill(json={'apiKey': ''}))
                page = ctx.new_page()
                page.goto('http://localhost:8080/portal-belajar.html')
                return ctx, page

            ctx, page = new_page()
            page.evaluate("()=>{localStorage.setItem('userRole','siswa');localStorage.setItem('pb.murid.myClass',JSON.stringify('X-1'));}")
            page.goto('http://localhost:8080/dashboard-guru.html')
            page.wait_for_url('**/dashboard-murid.html')
            page.goto('http://localhost:8080/game-quiz.html?kelola=1')
            page.wait_for_url('**/dashboard-murid.html')
            page.goto('http://localhost:8080/portal-belajar.html')
            page.evaluate('openLogin()')
            page.locator('.rs[data-role="guru"]').click()
            page.locator('#loginPw').fill('student-test')
            page.locator('#loginOverlay').get_by_role('button', name='Masuk ke Portal', exact=False).click()
            page.locator('#loginMsg').get_by_text('Akun siswa tidak dapat masuk sebagai guru.').wait_for()
            self.assertEqual(page.evaluate("localStorage.getItem('userRole')"), 'siswa')
            Path('/tmp/browser/staff-games').mkdir(parents=True, exist_ok=True)
            page.locator('#loginOverlay .modal').screenshot(path='/tmp/browser/staff-games/student-denied.png')
            page.locator('#loginPw').fill('staff-test')
            page.locator('#loginOverlay').get_by_role('button', name='Masuk ke Portal', exact=False).click()
            page.wait_for_url('**/dashboard-guru.html')
            page.goto('http://localhost:8080/game-quiz.html?kelola=1')
            page.locator('#gj').fill('Paket Permanen Uji')
            page.locator('#gk').select_option('X-1')
            page.locator('#gs').fill('\n'.join(f'Soal {n} | Benar | Salah B | Salah C | Salah D | A' for n in range(1, 4)))
            page.get_by_role('button', name='Simpan & kirim ke siswa').click()
            page.wait_for_function("()=>document.querySelector('#gm')?.textContent.includes('tersimpan permanen')")
            self.assertEqual(len(writes), 1)
            self.assertEqual(len(catalog['quiz'][0]['soal']), 3)
            page.locator('#app').screenshot(path='/tmp/browser/staff-games/saved-pack.png')
            ctx.close()
            ctx, page = new_page()
            page.evaluate("()=>{localStorage.setItem('userRole','siswa');localStorage.setItem('pb.murid.myClass',JSON.stringify('X-1'));}")
            page.goto('http://localhost:8080/game-quiz.html')
            page.locator('#qs').wait_for()
            self.assertEqual(page.locator('#qs option').all_text_contents(), ['Paket Permanen Uji (3 soal)'])
            self.assertEqual(page.evaluate('QUIZZES[0].soal[0].q'), 'Soal 1')
            page.screenshot(path='/tmp/browser/staff-games/new-device.png')
            ctx.close()
            browser.close()


if __name__ == '__main__':
    unittest.main()