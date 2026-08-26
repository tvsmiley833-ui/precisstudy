#!/usr/bin/env python3
"""Sync all 50 guides into: chat.ts SUBJECTS, progress-routes SUBJECTS,
shared/unit-titles.js exports, and dashboard SUBJECTS_CONFIG.
Also generates camelCase keys matching existing conventions."""
import json, glob, os, re

BASE = "/Users/smiley/Claude/precisstudy"
GUIDES = sorted(glob.glob(f"{BASE}/guides/*.json"))
SKIP = {"economics-core"}

def camel(slug):
    parts = re.split(r"[-]", slug)
    return parts[0] + "".join(p.capitalize() for p in parts[1:])

def label(d):
    t = d.get("title", "")
    return t

entries = []  # (slug, camelKey, title, units[{id,name}])
for f in GUIDES:
    slug = os.path.basename(f)[:-5]
    if slug in SKIP: continue
    d = json.load(open(f))
    units = [{"id": u["id"], "name": u["name"]} for u in d.get("units", [])]
    entries.append((slug, camel(slug), d.get("title", slug), units))

# ---------- 1. progress-routes.ts SUBJECTS ----------
p = f"{BASE}/src/progress-routes.ts"
s = open(p).read()
slugs_joined = ", ".join(f'"{e[0]}"' for e in entries)
s = re.sub(r'const SUBJECTS = \[[^\]]*\];',
           f'const SUBJECTS = [{slugs_joined}];', s, count=1)
open(p, "w").write(s)
print("progress-routes.ts:", len(entries), "subjects")

# ---------- 2. chat.ts SUBJECTS tutor personas ----------
p = f"{BASE}/src/chat.ts"
s = open(p).read()
persona_lines = []
for slug, key, title, _ in entries:
    persona_lines.append(
        f'  "{slug}": "You are a concise, friendly tutor helping a student study {title}. Keep answers short (2-5 sentences), accurate, and focused on the question asked.",')
new_block = "export const SUBJECTS = Object.assign(Object.create(null), {\n" + "\n".join(persona_lines) + "\n});"
s = re.sub(r'export const SUBJECTS = Object\.assign\(Object\.create\(null\), \{.*?\}\);',
           new_block, s, count=1, flags=re.S)
open(p, "w").write(s)
print("chat.ts:", len(persona_lines), "personas")

# ---------- 3. shared/unit-titles.js — append new exports ----------
p = f"{BASE}/public/shared/unit-titles.js"
s = open(p).read()
existing = set(re.findall(r'export const (\w+)Units', s))
new_exports = []
for slug, key, title, units in entries:
    var = key + "Units"
    if var in existing: continue
    lines = ",\n".join(f'  {{ id: {u["id"]}, name: {json.dumps(u["name"])} }}' for u in units)
    new_exports.append(f"/** @type {{Unit[]}} */\nexport const {var} = [\n{lines}\n];\n")
if new_exports:
    s += "\n// ===== Auto-added: top-50 expansion =====\n" + "\n".join(new_exports)
    open(p, "w").write(s)
print("unit-titles.js: +", len(new_exports), "exports")

# ---------- 4. dashboard SUBJECTS_CONFIG ----------
p = f"{BASE}/public/dashboard/index.html"
s = open(p).read()
cfg_lines = []
for slug, key, title, _ in entries:
    cfg_lines.append(f"  {{ key: '{slug}', label: '{title}', href: '/{slug}', units: {key}Units }},")
new_cfg = "const SUBJECTS_CONFIG = [\n" + "\n".join(cfg_lines) + "\n];"
s2 = re.sub(r'const SUBJECTS_CONFIG = \[.*?\];', new_cfg, s, count=1, flags=re.S)
# ensure imports cover all unit vars
import_names = sorted({e[1] + "Units" for e in entries})
imp = "import { " + ", ".join(import_names) + " } from '/shared/unit-titles.js';"
s2 = re.sub(r"import \{[^}]*\} from '/shared/unit-titles\.js';", imp, s2, count=1)
if s2 != s:
    open(p, "w").write(s2)
print("dashboard config updated")
print("\nDone. Total guides registered everywhere:", len(entries))
