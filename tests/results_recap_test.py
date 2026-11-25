"""Cross-role result regression; all sample API writes are intercepted."""
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright

class ResultsRecapTest(unittest.TestCase):
    def test_submission_admin_grade_export(self):
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            act={'tugas':{},'lkpd':{},'quiz':{},'absensi':{}}
            catalog={'updatedAt':'sample','tugas':[{'j':'Tugas uji','k':'X-1','s':'Aktif','d':'2099-01-01'}], 'lkpd':[], 'quiz':[{'j':'Quiz uji','k':'X-1','soal':[{'q':'Soal uji','o':['Benar','Salah'],'a':0}]}],'materi':[]}
            accounts=[{'nis':'001','nama':'Siswa Satu','kelas':'X-1'},{'nis':'002','nama':'Siswa Dua','kelas':'X-1'},{'nis':'003','nama':'Kelas Lain','kelas':'XI-2'}]
            def intercept(route):
                req=route.request
                if 'submit=1' in req.url:
                    data=req.post_data_json
                    self.assertIn('entry',data)
                    e=data['entry']; bucket=act[data['jenis']].setdefault(data['itemKey'],[])
                    bucket[:]=[s for s in bucket if s['userId']!=e['userId']]
                    bucket.append(e);route.fulfill(json=act)
                elif 'activity=1' in req.url:
                    if req.method=='POST':act.update(req.post_data_json)
                    route.fulfill(json=act)
                elif 'catalog=1' in req.url:route.fulfill(json=catalog)
                elif 'accounts=1' in req.url:route.fulfill(json={'accounts':accounts})
                else:route.fulfill(json={'ready':False,'ok':True})
            def page_for(account=None):
                context=browser.new_context(viewport={'width':1280,'height':1800},accept_downloads=True)
                context.route('**/api/**',intercept)
                page=context.new_page();page.on('dialog',lambda d:d.accept())
                page.goto('http://localhost:8080')
                if account:page.evaluate('a=>{localStorage.setItem("userRole","murid");localStorage.setItem("pb.murid.nis",a.nis);localStorage.setItem("pb.murid.nama",a.nama);localStorage.setItem("pb.murid.myClass",JSON.stringify(a.kelas));}',account)
                else:page.evaluate('()=>{localStorage.setItem("userRole","admin");sessionStorage.setItem("pb.admin.ok","1");localStorage.setItem("pb.guru.passphrase","isolated-test");}')
                return context,page
            for a in accounts[:2]:
                context,page=page_for(a);page.goto('http://localhost:8080/dashboard-murid.html')
                page.locator('[data-feature="tugas"]').click();page.get_by_role('button',name='Kerjakan',exact=True).click()
                page.locator('#sN').fill(a['nama']);page.locator('#sJ').fill('Jawaban tugas siswa untuk pengujian.')
                page.locator('#xS').click();page.wait_for_function('()=>JSON.parse(localStorage.getItem("pb.submissions.tugas"))["0"].length>0')
                context.close()
            self.assertEqual([e['userId'] for e in act['tugas']['0']],['001','002'])
            context,page=page_for(accounts[0]);page.goto('http://localhost:8080/game-quiz.html');page.locator('.mode').first.wait_for()
            page.evaluate('()=>{quiz=QUIZZES[0];localStorage.setItem("pb.game.answered","5");localStorage.setItem("pb.game.correct","4");finish("Gold Rush",40,"Uji","gold",.8);}')
            page.wait_for_function('()=>!localStorage.getItem("pb.game.pending")')
            self.assertEqual(act['lkpd']['game-progress'][0]['points'],40)
            self.assertEqual(act['lkpd']['game-progress'][0]['userId'],'001')
            context.close()
            act['quiz']['quiz-uji']=[{'userId':'001','nama':'Siswa Satu','kelas':'X-1','benar':20,'total':25}]
            context,page=page_for();page.goto('http://localhost:8080/dashboard-guru.html');page.locator('[data-feature="nilai"]').click()
            page.locator('#rTable tbody tr').first.wait_for()
            page.locator('#rClass').select_option('X-1');self.assertEqual(page.locator('#rTable tbody tr').count(),2)
            page.locator('[data-detail="1"]').click();page.get_by_label('Nilai 0',exact=True).fill('88')
            page.get_by_role('button',name='Simpan nilai',exact=True).click();page.locator('#rClass').wait_for()
            page.wait_for_function('()=>JSON.parse(localStorage.getItem("pb.submissions.tugas"))["0"][0].nilai===88')
            self.assertEqual(act['tugas']['0'][0]['nilai'],88)
            page.locator('#rClass').select_option('X-1')
            with page.expect_download() as dl:page.locator('#rExport').click()
            text=Path(dl.value.path()).read_text(encoding='utf-8-sig')
            self.assertIn('80.0',text);self.assertIn('88.0',text);self.assertIn('Siswa Dua',text);self.assertNotIn('Kelas Lain',text)
            page.locator('.fp-modal').screenshot(path='/tmp/browser/results/admin-recap.png')
            student_context,student_page=page_for(accounts[0])
            student_page.goto('http://localhost:8080/dashboard-murid.html')
            student_page.locator('[data-feature="nilai"]').click()
            student_page.locator('#fpB').get_by_text('88',exact=True).wait_for()
            student_context.close()
            context.close();browser.close()

if __name__=='__main__':unittest.main()
