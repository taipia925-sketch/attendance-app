import re,base64,sys
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
h=open(sys.argv[1]).read()
d=base64.b64decode(re.search(r'<script id="pl"[^>]*>(.*?)</script>',h,re.S).group(1).strip())
salt,iv,ct=d[:16],d[16:28],d[28:]
k=PBKDF2HMAC(hashes.SHA256(),32,salt,300000).derive(sys.argv[2].encode())
open(sys.argv[3],'wb').write(AESGCM(k).decrypt(iv,ct,None))
print("ok")
