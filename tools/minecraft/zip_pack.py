import os
import zipfile
import hashlib
import time

start = time.time()
source_dir = os.path.abspath('scratch_pack')
output_zip = os.path.abspath('uploads/mineorange_pack.zip')

os.makedirs(os.path.dirname(output_zip), exist_ok=True)
if os.path.exists(output_zip):
    os.remove(output_zip)

file_count = 0
with zipfile.ZipFile(output_zip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for root, dirs, files in os.walk(source_dir):
        for f in files:
            full_path = os.path.join(root, f)
            arcname = os.path.relpath(full_path, source_dir)
            zf.write(full_path, arcname)
            file_count += 1

elapsed = time.time() - start
size_bytes = os.path.getsize(output_zip)

sha1 = hashlib.sha1()
with open(output_zip, 'rb') as f:
    while chunk := f.read(65536):
        sha1.update(chunk)
hash_hex = sha1.hexdigest()

print(f"Compressed {file_count} files into {output_zip} in {elapsed:.2f}s")
print(f"Size: {size_bytes} bytes ({size_bytes / (1024*1024):.2f} MB)")
print(f"SHA1: {hash_hex}")

# Also verify root files in the zip
with zipfile.ZipFile(output_zip, 'r') as zf:
    names = zf.namelist()
    root_entries = [n for n in names if '/' not in n]
    print(f"Root entries in zip: {root_entries}")
