// Mette icona e dati del programma (nome, descrizione, versione) dentro Attendance.exe, senza strumenti Windows.
const ResEdit = require('resedit'), fs = require('fs');
const [exe, ico] = process.argv.slice(2);
const pe = ResEdit.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(pe);
const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(ico));
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const gid = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, gid, lang, iconFile.icons.map(i => i.data));
const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
const L = { lang: 1033, codepage: 1200 };
vi.setStringValues(L, { ProductName: 'Attendance', FileDescription: 'Attendance', CompanyName: 'Attendance', InternalName: 'Attendance', OriginalFilename: 'Attendance.exe', LegalCopyright: '' });
vi.removeStringValue(L, 'OriginalFilename'); vi.setStringValues(L, { OriginalFilename: 'Attendance.exe' });
vi.setFileVersion(1, 0, 0, 0, 1033); vi.setProductVersion(1, 0, 0, 0, 1033);
vi.outputToResourceEntries(res.entries);
res.outputResource(pe);
fs.writeFileSync(exe, Buffer.from(pe.generate()));
console.log('Attendance.exe: icona e dati aggiornati');
