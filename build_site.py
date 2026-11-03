#!/usr/bin/env python3
"""Create a minimal, safe GitHub Pages artifact, without source scripts."""
import pathlib,shutil
root=pathlib.Path(__file__).resolve().parents[1]
site=root/'_site'
if site.exists():shutil.rmtree(site)
site.mkdir()
for name in ('index.html','sw.js','manifest.webmanifest','.nojekyll'):
    shutil.copy2(root/name,site/name)
for folder in ('assets','data'):
    shutil.copytree(root/folder,site/folder)
print('Sitio listo:',site)
