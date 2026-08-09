import os
import zipfile
import sys


def add_all(zf, root, prefix=""):
    for name in sorted(os.listdir(root)):
        full = os.path.join(root, name)
        arc = name if not prefix else prefix + "/" + name
        if os.path.isdir(full):
            add_all(zf, full, arc)
        else:
            zf.write(full, arc)


if __name__ == "__main__":
    addon, output = sys.argv[1:3]
    if os.path.exists(output):
        os.remove(output)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zf:
        add_all(zf, addon)
    print("OK", os.path.getsize(output))
