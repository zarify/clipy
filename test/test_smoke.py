import unittest
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class SmokeTests(unittest.TestCase):
    def test_index_html_exists_and_contains_ui_ids(self):
        p = ROOT / 'src' / 'index.html'
        self.assertTrue(p.exists(), f"Missing {p}")
        txt = p.read_text(encoding='utf-8')
        self.assertIn('id="instructions-content"', txt)
        self.assertIn('textarea id="code"', txt)
        self.assertIn('id="run"', txt)
        self.assertIn('id="terminal-output"', txt)

    def test_sample_json_valid_and_has_runtime(self):
        p = ROOT / 'src' / 'config' / 'sample.json'
        self.assertTrue(p.exists(), f"Missing {p}")
        data = json.loads(p.read_text(encoding='utf-8'))
        self.assertIn('runtime', data)
        self.assertIn('recommended', data['runtime'])
        self.assertTrue('cdn.jsdelivr.net' in data['runtime']['recommended'] or data['runtime']['recommended'].strip() != '', 'recommended runtime URL seems empty')
        self.assertIn('feedback', data)
        self.assertIn('regex', data['feedback'])

    def test_main_js_contains_runtime_adapter(self):
        p = ROOT / 'src' / 'main.js'
        self.assertTrue(p.exists(), f"Missing {p}")
        txt = p.read_text(encoding='utf-8')
        self.assertIn('runtimeAdapter', txt)
        self.assertTrue('probeRuntime' in txt or 'Runtime probe timed out' in txt)


if __name__ == '__main__':
    unittest.main()
