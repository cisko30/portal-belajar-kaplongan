"""Browser regression tests: isolated sample data; no remote writes."""
import json
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright


class GameRulesTest(unittest.TestCase):
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
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        questions = [{"q": f"Soal contoh {i}", "o": [f"Jawaban {i}", f"Salah A {i}", f"Salah B {i}", f"Salah C {i}"], "a": 0} for i in range(5)]
        def intercept(route):
            if route.request.method != "GET":
                route.fulfill(json={"ok": True})
            elif "catalog=1" in route.request.url:
                route.fulfill(json={"quiz": [{"j": "Paket contoh uji", "k": "X-1", "soal": questions}]})
            else:
                route.continue_()
        self.page.route("**/api/**", intercept)
        self.page.goto("http://localhost:8080/game-quiz.html")
        self.page.evaluate("""() => {
            localStorage.setItem('userRole', JSON.stringify('murid'));
            localStorage.setItem('pb.murid.nama', JSON.stringify('Siswa Uji'));
            localStorage.setItem('pb.murid.myClass', JSON.stringify('X-1'));
            localStorage.setItem('pb.game.mute', '1');
        }""")
        self.page.reload()
        self.page.locator('.mode').first.wait_for()
        self.page.clock.install()

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.context.close()

    def score(self):
        return int(self.page.locator('.chip').first.inner_text().split()[-1])

    def difficulty(self, mode):
        return self.page.evaluate("k => DL(k)", mode)

    def answer(self, mode, correct=True):
        if mode == 'cocok':
            left = self.page.locator('.tile[data-s="L"]:not(.done)').first
            key = left.get_attribute('data-k')
            left.dispatch_event('click')
            match = f'[data-k="{key}"]' if correct else f':not([data-k="{key}"])'
            selector = '.tile[data-s="R"]:not(.done)' + match
            self.page.locator(selector).first.dispatch_event('click')
        else:
            self.page.evaluate(r"""({mode, correct}) => {
                const text = document.querySelector('.q').textContent;
                const number = text.match(/\d+/)[0];
                const expected = text.startsWith('🔄') ? 'Soal contoh '+number : 'Jawaban '+number;
                const selector = mode === 'balon' ? '.balloon' : '.mole.up';
                const target = [...document.querySelectorAll(selector)].find(e =>
                    correct ? e.textContent.replace('🐹 ', '') === expected : e.textContent.replace('🐹 ', '') !== expected);
                if (!target) throw new Error('No answer target');
                target.click();
            }""", {"mode": mode, "correct": correct})

    def play_to_three(self, mode):
        for lv in (1, 2):
            self.page.locator(f'[data-m="{mode}"]').click()
            self.answer(mode)
            self.assertEqual(self.score(), 10 + lv)
            self.answer(mode, False)
            self.assertEqual(self.score(), (10 + lv) - (4 + lv * 2))
            for _ in range(4):
                self.answer(mode)
                if mode == 'cocok':
                    self.page.clock.run_for(710)
            if mode != 'cocok':
                self.page.clock.run_for(60000)
            self.assertEqual(self.difficulty(mode), lv + 1)  # 5/6 >= 80%
            self.assertEqual(int(self.page.get_by_role('heading', level=2).inner_text().split()[0]), 5 * (10 + lv) - (4 + lv * 2))
            Path('/tmp/browser/three-games').mkdir(parents=True, exist_ok=True)
            self.page.screenshot(path=f'/tmp/browser/three-games/{mode}-level-{lv + 1}.png')
            self.page.get_by_role('button', name='Ganti mode').click()
        self.page.locator(f'[data-m="{mode}"]').click()
        self.answer(mode)
        self.answer(mode, False)
        self.assertEqual(self.score(), 3)  # Level 3: +13, -10.
        self.page.get_by_role('button', name='Keluar', exact=True).click()
        self.page.clock.run_for(180000)
        self.assertEqual(self.difficulty(mode), 3)  # Quitting cannot finish again.
        print(f'{mode}: levels 1→2→3; penalties 6/8/10; score updates verified')

    def test_balloons_to_level_three(self):
        self.play_to_three('balon')

    def test_moles_to_level_three(self):
        self.play_to_three('tikus')

    def test_pairs_to_level_three(self):
        self.play_to_three('cocok')

    def test_pairs_timeout_and_no_negative_points(self):
        self.page.evaluate("setDL('cocok', 3)")
        self.page.locator('[data-m="cocok"]').click()
        self.answer('cocok', False)
        self.assertEqual(self.score(), 0)
        self.page.clock.run_for(120000)
        self.assertEqual(self.page.get_by_role('button', name='Main lagi', exact=True).count(), 1)
        self.assertEqual(self.difficulty('cocok'), 2)
        answered = self.page.evaluate('ans()')
        self.page.clock.run_for(120000)
        self.assertEqual(self.page.evaluate('ans()'), answered)

    def test_difficulty_thresholds_and_level_cap(self):
        self.page.evaluate('quiz=QUIZZES[0]')
        for accuracy, expected in [(0.8, 3), (0.4, 2), (0.39, 1)]:
            self.page.evaluate("setDL('balon', 2)")
            self.page.evaluate("acc => finish('Balon Pecah', 0, '', 'balon', acc)", accuracy)
            self.assertEqual(self.difficulty('balon'), expected)
        self.page.evaluate("setDL('balon',10);finish('Balon Pecah',0,'','balon',1)")
        self.page.clock.run_for(1000)
        self.assertEqual(self.difficulty('balon'), 10)
        self.assertNotIn('→ 11', self.page.locator('body').inner_text())


if __name__ == '__main__':
    unittest.main(verbosity=2)