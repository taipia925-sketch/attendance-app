#!/usr/bin/env python3
"""Strumento per modificare l'app cifrata.

  python3 tools/app.py unpack <codice> <cartella>   # decifra index.html in <cartella>/app.html (modificabile)
  python3 tools/app.py pack   <codice> <cartella>   # ricompone e cifra <cartella>/app.html dentro index.html

In app.html le stringhe enormi (motore OCR, modello Excel) sono sostituite da segnaposti
@@BLOB0@@, @@BLOB1@@… e salvate a parte in <cartella>/blobs/, così il file resta piccolo da modificare.
La pagina d'accesso è tools/gate.html (con il segnaposto @@PAYLOAD@@). Il codice non va mai scritto nel repository.
"""
import base64, os, re, sys
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "index.html")
GATE = os.path.join(ROOT, "tools", "gate.html")
ITER = 300000
BLOB_RE = re.compile(r'[A-Za-z0-9+/=]{5000,}')


def key(code, salt):
    return PBKDF2HMAC(hashes.SHA256(), 32, salt, ITER).derive(code.encode())


def unpack(code, out):
    h = open(INDEX, encoding="utf-8").read()
    d = base64.b64decode(re.search(r'<script id="pl"[^>]*>(.*?)</script>', h, re.S).group(1).strip())
    html = AESGCM(key(code, d[:16])).decrypt(d[16:28], d[28:], None).decode("utf-8")
    os.makedirs(os.path.join(out, "blobs"), exist_ok=True)
    blobs = []
    def sub(m):
        blobs.append(m.group(0))
        return "@@BLOB%d@@" % (len(blobs) - 1)
    small = BLOB_RE.sub(sub, html)
    for i, b in enumerate(blobs):
        open(os.path.join(out, "blobs", "%d.b64" % i), "w").write(b)
    open(os.path.join(out, "app.html"), "w", encoding="utf-8").write(small)
    print("ok: %s/app.html (%d KB) + %d blob" % (out, len(small) // 1024, len(blobs)))


def build(out):
    html = open(os.path.join(out, "app.html"), encoding="utf-8").read()
    return re.sub(r"@@BLOB(\d+)@@", lambda m: open(os.path.join(out, "blobs", m.group(1) + ".b64")).read(), html)


def pack(code, out):
    pt = build(out).encode("utf-8")
    salt, iv = os.urandom(16), os.urandom(12)
    blob = base64.b64encode(salt + iv + AESGCM(key(code, salt)).encrypt(iv, pt, None)).decode()
    gate = open(GATE, encoding="utf-8").read()
    assert gate.count("@@PAYLOAD@@") == 1
    open(INDEX, "w", encoding="utf-8").write(gate.replace("@@PAYLOAD@@", blob))
    print("ok: index.html (%d KB)" % (os.path.getsize(INDEX) // 1024))


if __name__ == "__main__":
    if len(sys.argv) != 4 or sys.argv[1] not in ("unpack", "pack"):
        sys.exit(__doc__)
    {"unpack": unpack, "pack": pack}[sys.argv[1]](sys.argv[2], sys.argv[3])
