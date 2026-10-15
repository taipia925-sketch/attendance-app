import re,base64,os,sys
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
gate,app,code,out=sys.argv[1:5]
pt=open(app,'rb').read()
salt,iv=os.urandom(16),os.urandom(12)
k=PBKDF2HMAC(hashes.SHA256(),32,salt,300000).derive(code.encode())
blob=base64.b64encode(salt+iv+AESGCM(k).encrypt(iv,pt,None)).decode()
h=open(gate).read()
h2,n=re.subn(r'(<script id="pl" type="application/octet-stream">).*?(</script>)',lambda m:m.group(1)+blob+m.group(2),h,flags=re.S)
assert n==1
open(out,'w').write(h2)
print('ok',len(h2))
