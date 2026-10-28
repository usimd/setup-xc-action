#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["requests"]
# ///
"""
Checks Microchip's product pages for the latest XC compiler versions and
appends new versions to the integration-test matrix, and updates the XC8
smoke-test version in .github/workflows/ci.yml.

Outputs 'updated=true' and a 'summary' to $GITHUB_OUTPUT when changes are made.
"""

import os
import re
import sys
from pathlib import Path

COMPILERS: dict[str, dict] = {
    "xc8": {
        "url": "https://www.microchip.com/en-us/tools-resources/develop/mplab-xc-compilers/xc8",
        "pattern": r"xc8-v(\d+\.\d+)-full-install-linux-x64-installer\.run",
    },
    "xc16": {
        "url": "https://www.microchip.com/en-us/tools-resources/develop/mplab-xc-compilers/xc16",
        "pattern": r"xc16-v(\d+\.\d+)-full-install-linux64-installer\.run",
    },
    "xc32": {
        "url": "https://www.microchip.com/en-us/tools-resources/develop/mplab-xc-compilers/xc32",
        "pattern": r"xc32-v(\d+\.\d+)-full-install-linux-x64-installer\.run",
    },
}

TEST_WORKFLOW = Path(".github/workflows/test.yml")
CI_WORKFLOW = Path(".github/workflows/ci.yml")
MATRIX_BINARIES = {"xc8": "xc8-cc", "xc16": "xc16-gcc", "xc32": "xc32-gcc"}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (compatible; version-checker)"
}


def get_latest_version(compiler: str, config: dict) -> str:
    import requests

    resp = requests.get(config["url"], headers=HEADERS, timeout=30)
    resp.raise_for_status()
    match = re.search(config["pattern"], resp.text)
    if not match:
        print(f"ERROR: could not find {compiler} version on {config['url']}", file=sys.stderr)
        sys.exit(1)
    return match.group(1)


def update_file(path: Path, latest: dict[str, str]) -> list[str]:
    """Returns list of human-readable change descriptions, or empty list if nothing changed."""
    content = path.read_text()
    original = content
    changes = []

    for compiler, new_version in latest.items():
        # Match: compiler: 'xc8'\n...version: '3.10' (handles varying indentation)
        pattern = rf"(compiler: ['\"]({re.escape(compiler)})['\"](?:[^\n]*\n)+?(\s+)version: ['\"])(\d+\.\d+)(['\"])"

        def replacer(m: re.Match) -> str:
            old_version = m.group(4)
            if old_version == new_version:
                return m.group(0)
            changes.append(f"{compiler}: {old_version} → {new_version}")
            return m.group(1) + new_version + m.group(5)

        content = re.sub(pattern, replacer, content)

    if content != original:
        path.write_text(content)
    return changes


def update_test_matrix(path: Path, latest: dict[str, str]) -> list[str]:
    """Append newly discovered versions to the integration-test matrix."""
    content = path.read_text()
    include_match = re.search(r"(?m)^        include:\s*$", content)
    if not include_match:
        raise ValueError(f"Could not find matrix include section in {path}")

    steps_match = re.search(r"(?m)^    steps:\s*$", content[include_match.end() :])
    if not steps_match:
        raise ValueError(f"Could not find matrix steps section in {path}")

    matrix_end = include_match.end() + steps_match.start()
    changes = []

    for compiler, new_version in latest.items():
        entry = rf"(?m)^          - compiler: ['\"]{re.escape(compiler)}['\"]\n            version: ['\"]{re.escape(new_version)}['\"]"
        if re.search(entry, content[include_match.end() : matrix_end]):
            continue

        binary = MATRIX_BINARIES[compiler]
        addition = (
            f"          - compiler: '{compiler}'"
            f"\n            version: '{new_version}'"
            f"\n            binary: '{binary}'\n"
        )
        content = content[:matrix_end] + addition + content[matrix_end:]
        matrix_end += len(addition)
        changes.append(f"{compiler}: added {new_version} to test matrix")

    if changes:
        path.write_text(content)
    return changes


def set_github_output(key: str, value: str) -> None:
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file:
        with open(output_file, "a") as f:
            # Use heredoc syntax for multiline values
            delimiter = "EOF"
            f.write(f"{key}<<{delimiter}\n{value}\n{delimiter}\n")
    else:
        print(f"::set-output name={key}::{value}")


def main() -> None:
    print("Fetching latest XC compiler versions from Microchip...")
    latest: dict[str, str] = {}
    for compiler, config in COMPILERS.items():
        version = get_latest_version(compiler, config)
        print(f"  {compiler}: {version}")
        latest[compiler] = version

    all_changes = update_test_matrix(TEST_WORKFLOW, latest) if TEST_WORKFLOW.exists() else []
    if CI_WORKFLOW.exists():
        ci_changes = update_file(CI_WORKFLOW, {"xc8": latest["xc8"]})
        if ci_changes:
            print(f"Updated {CI_WORKFLOW}: {', '.join(ci_changes)}")
            all_changes.extend(ci_changes)

    if all_changes:
        # Deduplicate while preserving order
        seen: set[str] = set()
        unique_changes = [c for c in all_changes if not (c in seen or seen.add(c))]  # type: ignore[func-returns-value]
        summary_lines = ["Updated XC compiler versions in test workflows:", ""]
        summary_lines += [f"- {c}" for c in unique_changes]
        summary = "\n".join(summary_lines)
        print("\n" + summary)
        set_github_output("updated", "true")
        set_github_output("summary", summary)
    else:
        print("All compiler versions are already up to date.")
        set_github_output("updated", "false")


if __name__ == "__main__":
    main()
