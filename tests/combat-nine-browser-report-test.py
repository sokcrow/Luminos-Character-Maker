"""Exercise the reporter's real exit code; synthetic data is only a regression fixture."""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

REPORTER = Path(__file__).with_name('combat-nine-browser-report.py').resolve()
CUES = ['actionApproach', 'clashStart', 'clashContact', 'powerCoin', 'powerEnd',
        'clashOutcome', 'clashDefeat', 'clashEnd', 'hitCoin', 'hitMotion']


def fixture():
    cases = []
    for iteration, label in enumerate(['before', 'after', 'after', 'before']):
        clients = []
        for player in range(9):
            cues = []
            for sequence, cue in enumerate(CUES, 1):
                stamp = 1000 + sequence * 100 + player
                row = dict(sequence=sequence, cue=cue, owner='a', opponent='b',
                           index=0, result='heads', startAt=stamp, paintAt=stamp+1)
                if cue == 'clashStart':
                    row['scene'] = dict(camera='combat', participants=['a', 'b'],
                                        movement=[dict(id='a')])
                cues.append(row)
            clients.append(dict(units=[dict(id='a', hp=10)],
                                telemetry=dict(cues=cues, received=[], frames=[dict(ms=16)],
                                               longTasks=[], profile=[])))
        cases.append(dict(label=label, iteration=iteration, sha=label,
                          complete=True, failure=None, wallMs=2000,
                          authority=dict(seed=123), batches={}, clients=clients))
    return cases


class ReporterAcceptance(unittest.TestCase):
    def run_case(self, mutation=None):
        data = fixture()
        if mutation:
            mutation(data[1]['clients'][1]['telemetry']['cues'])
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for case in data:
                folder = root / str(case['iteration'])
                folder.mkdir()
                (folder / 'raw.json').write_text(json.dumps(case))
            env = dict(os.environ, COMBAT_BENCH_CLASH_BUDGET_MS='100')
            result = subprocess.run([sys.executable, str(REPORTER), str(root)],
                                    env=env, capture_output=True, text=True, timeout=60)
            self.assertTrue((root/'summary.json').exists(), result.stderr)
            report = json.loads((root/'summary.json').read_text())
            # All synthetic observed timings are below budget; visual acceptance must
            # independently reject incomplete/broken presentation.
            self.assertTrue(report['performanceBudget']['passed'], result.stderr)
            if mutation:
                self.assertFalse(report['acceptedAfterWithVisualChecks'])
                self.assertNotEqual(result.returncode, 0, result.stdout)
            else:
                self.assertTrue(report['acceptedAfterWithVisualChecks'])
                self.assertEqual(result.returncode, 0, result.stderr)
            return report

    def test_complete_presentation_passes(self):
        self.run_case()

    def test_omitted_animation_fails_even_when_timings_pass(self):
        report = self.run_case(lambda cues: cues.pop(3))
        self.assertTrue(report['valid'])
        self.assertEqual(report['coverage']['after']['omittedCommands'], 1)

    def test_missing_paint_sample_fails(self):
        report = self.run_case(lambda cues: cues[3].update(paintAt=None))
        self.assertTrue(report['valid'])
        self.assertEqual(report['coverage']['after']['missingPaintSamples'], 1)

    def test_duplicate_animation_fails(self):
        self.run_case(lambda cues: cues.append(copy.deepcopy(cues[3])))

    def test_missing_scene_measurement_fails(self):
        self.run_case(lambda cues: cues[1].pop('scene'))

    def test_wrong_camera_fails(self):
        self.run_case(lambda cues: cues[1]['scene'].update(camera='planning'))

    def test_wrong_focus_fails(self):
        self.run_case(lambda cues: cues[1]['scene'].update(participants=['a']))

    def test_missing_movement_fails(self):
        self.run_case(lambda cues: cues[1]['scene'].update(movement=[]))


if __name__ == '__main__':
    unittest.main()
