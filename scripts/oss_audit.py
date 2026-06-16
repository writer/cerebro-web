#!/usr/bin/env python3
"""Public repository hygiene checks for Cerebro Web."""

from __future__ import annotations

import ipaddress
import os
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse


EXCLUDED_DIRS = {
    ".git",
    ".next",
    ".vercel",
    "build",
    "coverage",
    "dist",
    "node_modules",
}

EXCLUDED_FILES = {
    "package-lock.json",
    "scripts/oss_audit.py",
    "scripts/leak_patterns.txt",
}

ALLOWED_EMAIL_DOMAINS = {
    "example.com",
    "example.net",
    "example.org",
    "writer.com",
}

ALLOWED_HOST_SUFFIXES = (
    ".example.com",
    ".example.net",
    ".example.org",
    ".github.com",
    ".npmjs.org",
    ".registry.npmjs.org",
    ".writer.com",
)
ALLOWED_HOSTS = {
    "docs.renovatebot.com",
    "github.com",
    "localhost",
    "nextjs.org",
    "npmjs.org",
    "registry.npmjs.org",
    "writer.com",
    "www.writer.com",
    "www.w3.org",
}

SENSITIVE_QUERY_KEYS = {
    "access_token",
    "api_key",
    "apikey",
    "auth",
    "authorization",
    "client_secret",
    "key",
    "password",
    "secret",
    "token",
}

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b")
IPV4_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
URL_RE = re.compile(r"https?://[^\s\"'<>]+")
AWS_ACCOUNT_RE = re.compile(r"\b\d{12}\b")
PROHIBITED_PATTERNS = [
    re.compile(r"qordobadev\.com", re.IGNORECASE),
    re.compile(r"\badm\.dev\b", re.IGNORECASE),
    re.compile(r"github\.com/WriterInternal/(security|aws-git-roles|cerebro-web|cerebro)\b"),
    re.compile(r"uses:\s*WriterInternal/(security|aws-git-roles|cerebro-web|cerebro)\b"),
    re.compile(r"github>WriterInternal/"),
    re.compile(r"ghcr\.io/writerinternal/"),
    re.compile(r"arn:aws:iam::\d{12}:"),
    re.compile(
        r"\bWriterInternal/(security-tooling-map|trusted-endpoint|aurelius|seclift|npm-guard|vulnerabilities|security-reviewer|panopticon|dast|writer-vuln-miner|mender|tiresias|2password|huggingface-[a-z0-9-]+-connector|strix)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bwriter-(aurelius|seclift|npm-guard|vulnerabilities|security-reviewer|panopticon|dast|security-tooling-map)[a-z0-9-]*\b",
        re.IGNORECASE,
    ),
]

DEPLOYMENT_MANIFEST_PATHS = [
    re.compile(r"^(infra|deploy|manifests|helm|charts|k8s)/"),
    re.compile(r"(^|/)Pulumi\.[^/]+\.ya?ml$"),
    re.compile(r"(^|/)kustomization\.ya?ml$"),
]


def repo_root() -> Path:
    current = Path(__file__).resolve()
    return current.parents[1]


def iter_files(root: Path):
    for current_root, dirs, files in os.walk(root):
        dirs[:] = [
            item
            for item in dirs
            if item not in EXCLUDED_DIRS and not (Path(current_root) / item).is_symlink()
        ]
        for filename in files:
            path = Path(current_root) / filename
            rel = path.relative_to(root).as_posix()
            if rel in EXCLUDED_FILES or path.is_symlink() or not path.is_file():
                continue
            yield path, rel


def is_text(path: Path) -> bool:
    try:
        return b"\0" not in path.read_bytes()[:4096]
    except OSError:
        return False


def redact(value: str) -> str:
    return f"<REDACTED:len={len(value)}>"


def check_url(rel: str, line_number: int, value: str) -> list[str]:
    findings: list[str] = []
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    if host and host not in ALLOWED_HOSTS and host != "127.0.0.1" and not host.endswith(ALLOWED_HOST_SUFFIXES):
        findings.append(f"{rel}:{line_number}: non-public or unapproved URL host {host}")
    query = parse_qs(parsed.query, keep_blank_values=True)
    for key, values in query.items():
        if key.lower() in SENSITIVE_QUERY_KEYS and any(values):
            findings.append(f"{rel}:{line_number}: URL includes sensitive query key {key}")
    return findings


def check_ip(rel: str, line_number: int, value: str) -> list[str]:
    try:
        ip = ipaddress.ip_address(value)
    except ValueError:
        return []
    if ip.is_private or ip.is_loopback or ip.is_link_local:
        return []
    return [f"{rel}:{line_number}: public IP literal {value}"]


def scan_file(path: Path, rel: str) -> list[str]:
    findings: list[str] = []
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError as exc:
        return [f"{rel}: read failed: {exc}"]
    for line_number, line in enumerate(lines, start=1):
        for match in EMAIL_RE.finditer(line):
            domain = match.group(1).lower()
            if domain not in ALLOWED_EMAIL_DOMAINS:
                findings.append(f"{rel}:{line_number}: non-fixture email {redact(match.group(0))}")
        for match in URL_RE.finditer(line):
            findings.extend(check_url(rel, line_number, match.group(0)))
        if path.suffix != ".svg" and "<path" not in line and "xmlns=" not in line:
            for match in IPV4_RE.finditer(line):
                findings.extend(check_ip(rel, line_number, match.group(0)))
        for pattern in PROHIBITED_PATTERNS:
            if pattern.search(line):
                findings.append(f"{rel}:{line_number}: internal-only reference {redact(line.strip())}")
        if AWS_ACCOUNT_RE.search(line) and "package-lock" not in rel:
            findings.append(f"{rel}:{line_number}: 12-digit account-like identifier")
    return findings


def check_repository_split(root: Path) -> list[str]:
    findings: list[str] = []
    for _, rel in iter_files(root):
        if any(pattern.search(rel) for pattern in DEPLOYMENT_MANIFEST_PATHS):
            findings.append(f"{rel}: deployment manifest belongs in the internal deployment repository")

    producers = root / "src/lib/security-producers.ts"
    try:
        text = producers.read_text(encoding="utf-8")
    except OSError:
        return findings
    if "export const securityProducers: SecurityProducer[] = [" in text:
        findings.append("src/lib/security-producers.ts: public repo must stay config-driven, not hardcode producer registries")
    if "WriterInternal/" in text:
        findings.append("src/lib/security-producers.ts: private producer repositories belong in the private web overlay")
    return findings


def main() -> int:
    root = repo_root()
    findings: list[str] = []
    for path, rel in iter_files(root):
        if is_text(path):
            findings.extend(scan_file(path, rel))
    findings.extend(check_repository_split(root))
    if findings:
        print("oss-audit: public repository hygiene findings:", file=sys.stderr)
        for finding in findings:
            print(f"  {finding}", file=sys.stderr)
        return 1
    print("oss-audit: clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
