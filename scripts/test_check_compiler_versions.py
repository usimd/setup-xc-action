import runpy
import tempfile
import unittest
from pathlib import Path


UPDATE_TEST_MATRIX = runpy.run_path(
    str(Path(__file__).with_name("check-compiler-versions.py"))
)["update_test_matrix"]


class UpdateTestMatrixTests(unittest.TestCase):
    def test_appends_versions_without_replacing_existing_coverage(self) -> None:
        workflow = """jobs:
  test-matrix:
    strategy:
      matrix:
        include:
          - compiler: 'xc8'
            version: '3.10'
            binary: 'xc8-cc'
    steps:
      - uses: ./
"""

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "test.yml"
            path.write_text(workflow)

            changes = UPDATE_TEST_MATRIX(path, {"xc8": "4.00", "xc16": "2.10"})

            updated = path.read_text()
            self.assertIn("version: '3.10'", updated)
            self.assertIn("version: '4.00'", updated)
            self.assertIn("binary: 'xc8-cc'", updated)
            self.assertIn("compiler: 'xc16'\n            version: '2.10'", updated)
            self.assertEqual(len(changes), 2)

    def test_does_not_append_duplicate_versions(self) -> None:
        workflow = """jobs:
  test-matrix:
    strategy:
      matrix:
        include:
          - compiler: 'xc8'
            version: '4.00'
            binary: 'xc8-cc'
    steps:
      - uses: ./
"""

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "test.yml"
            path.write_text(workflow)

            changes = UPDATE_TEST_MATRIX(path, {"xc8": "4.00"})

            self.assertEqual(changes, [])
            self.assertEqual(path.read_text(), workflow)


if __name__ == "__main__":
    unittest.main()