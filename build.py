#!/usr/bin/env python3
"""Build a single-page web UI for sanskrit school from all markdown files."""

import os
import json
import re

SCHOOL_DIR = os.path.dirname(os.path.abspath(__file__))
# The repository root index.html belongs to Abhyāsa, the primary app
# (scripts/build.js). The Sanskrit School lesson viewer builds to school/
# so the two no longer collide at the root.
OUTPUT = os.path.join(SCHOOL_DIR, "school", "index.html")

# ── Guard the vyākaraṇam duplicates ──
#
# Six files under vyakaranam/ are byte-identical copies of material merged
# into the numbered lessons.  Both copies are wanted where they sit, so the
# risk is not duplication itself but silent drift: edit one and the other
# quietly disagrees.  The lesson copy is canonical — it is the one this build
# ships — so a mismatch fails here rather than shipping two truths.
#
# The rest of vyakaranam/ is NOT duplicated; it is unique material that this
# build does not yet read at all.  See AUDIT.md.

MERGED_PAIRS = [
    ("vyakaranam/ch01-varnavicharah/theory.md",           "02-varna-vidya/bricks.md"),
    ("vyakaranam/ch02-sandhi/reference.md",               "03-sandhi/reference.md"),
    ("vyakaranam/ch02-sandhi/workbook-questions.md",      "03-sandhi/workbook-questions.md"),
    ("vyakaranam/ch02-sandhi/workbook-answers.md",        "03-sandhi/workbook-answers.md"),
    ("vyakaranam/ch03-sarvanaamani/theory.md",            "05-rupa/bricks.md"),
    ("vyakaranam/ch04-kriyapada/theory.md",               "06-kriya/bricks.md"),
]

def check_merged_pairs():
    drifted = []
    for chapter, lesson in MERGED_PAIRS:
        cp = os.path.join(SCHOOL_DIR, chapter)
        lp = os.path.join(SCHOOL_DIR, lesson)
        if not (os.path.exists(cp) and os.path.exists(lp)):
            continue                      # a deliberate removal is not drift
        with open(cp, encoding="utf-8") as a, open(lp, encoding="utf-8") as b:
            if a.read() != b.read():
                drifted.append((chapter, lesson))
    if drifted:
        print("build.py: merged vyakaranam copies have drifted apart —")
        for chapter, lesson in drifted:
            print("  %s  !=  %s" % (chapter, lesson))
        print("  The lesson copy is canonical; reconcile them before building.")
        raise SystemExit(1)

check_merged_pairs()

# ── Collect lesson stages ──

stages = []

overview_path = os.path.join(SCHOOL_DIR, "00-overview.md")
if os.path.exists(overview_path):
    with open(overview_path, "r") as f:
        stages.append({
            "id": "00-overview", "number": 0,
            "title": "Overview", "subtitle": "Building Sanskrit Like LEGO",
            "files": {"overview": f.read()}, "tabs": ["overview"]
        })

stage_meta = {
    # Stage 0 sits before Nama and is optional: it teaches the script itself,
    # for a reader who cannot yet decode the Devanagari every other stage is
    # set in.  It is deliberately separate from Varna-Vidya, which teaches
    # where in the mouth each sound is made rather than what the page says.
    "00-devanagari": ("Devanagari", "Script Literacy"),
    "01-nama": ("Nama", "Basic Vocabulary"),
    "02-varna-vidya": ("Varna-Vidya", "Letters, Sthana-prayatna, Maheshvara Sutras"),
    "03-sandhi": ("Sandhi", "27 Snap-Rules for Joining Bricks"),
    "04-guna": ("Guna", "Adjectives"),
    "05-rupa": ("Rupa", "Case / Number / Gender -- The Baseplates"),
    "06-kriya": ("Kriya", "Verbs -- The Action Bricks"),
    "07-karaka": ("Karaka", "Semantic Relations"),
    "08-sambodhana": ("Sambodhana", "Direct Address"),
    "09-dhatu": ("Dhatu", "Roots & Upasargas"),
    "10-paryaya": ("Paryaya", "Synonyms & Epithets"),
    "11-samasa": ("Samasa", "Compounds -- LEGO Technic"),
    "12-vakya": ("Vakya", "Free Composition"),
    "13-bhava": ("Bhava", "Emotional Vocabulary"),
    "14-stotra-i": ("Stotra I", "Accusative Constructions"),
    "15-stotra-ii": ("Stotra II", "Varied Cases"),
    "16-prarthana": ("Prarthana", "Requests & Imperatives"),
    "17-puja-vak": ("Puja-Vak", "Sankalpa, Nyasa, Dhyana, Upacara"),
    "18-katha": ("Katha", "Narration"),
    "19-chandas-i": ("Chandas I", "Syllables & Meter"),
    "20-svara-vidya": ("Svara-Vidya", "Vedic Accent"),
    "21-chandas-ii": ("Chandas II", "Anustubh"),
    "22-chandas-iii": ("Chandas III", "Multiple Meters"),
    "23-paryaya-chandas": ("Paryaya-Chandas", "Lexical Flexibility"),
    "24-alankara": ("Alankara", "Poetic Ornament"),
    "25-rasa": ("Rasa", "Emotional Aesthetics"),
    "26-darshana": ("Darshana", "Philosophical Expression"),
    "27-samasyapurana": ("Samasyapurana", "Backwards Composition"),
    "28-dattapadi": ("Dattapadi", "Forced Vocabulary"),
    "29-nishiddhakshari": ("Nishiddhakshari", "Inhibition"),
    "30-citra-kavya": ("Citra-kavya", "Stacked Constraints"),
    "31-dharana-i": ("Dharana I", "Interrupted Memory"),
    "32-dharana-ii": ("Dharana II", "Associative Retrieval"),
    "33-aprastuta-prasanga": ("Aprastuta-prasanga", "Wit & Context Switching"),
    "34-multi-devata": ("Multi-devata", "Rapid Semantic Switching"),
    "35-ashtavadhana": ("Ashtavadhana", "Integrated Attention"),
    "36-avadhana-seva": ("Avadhana-seva", "Mastery"),
}

file_labels = {
    "bricks": "Bricks",
    "theory": "Theory", "reference": "Reference",
    "workbook-questions": "Questions", "workbook-answers": "Answers",
    "badge": "Badge",
}

tab_order = ["bricks", "theory", "reference", "workbook-questions", "workbook-answers", "badge"]

for dirname, (title, subtitle) in stage_meta.items():
    stage_dir = os.path.join(SCHOOL_DIR, dirname)
    if not os.path.isdir(stage_dir):
        continue
    num = int(dirname.split("-")[0])
    files = {}
    tabs = []
    for fname in tab_order:
        fpath = os.path.join(stage_dir, f"{fname}.md")
        if os.path.exists(fpath):
            with open(fpath, "r") as f:
                files[fname] = f.read()
                tabs.append(fname)
    stages.append({"id": dirname, "number": num, "title": title,
                    "subtitle": subtitle, "files": files, "tabs": tabs})

stages.sort(key=lambda s: s["number"])

# ── Collect vocab files ──

vocab_dir = os.path.join(SCHOOL_DIR, "vocab")
vocab_categories = []

if os.path.isdir(vocab_dir):
    vocab_meta = {
        "00-index": ("Index", "Source texts & overview"),
        "01-goddess-names": ("Goddess Names", "Names, epithets, forms of Devi"),
        "02-god-names": ("God Names", "Male deities, sages, celestials"),
        "03-demons": ("Demons", "Asuras, demon vocabulary"),
        "04-weapons": ("Weapons", "Weapons, instruments, battle gear"),
        "05-body": ("Body", "Body parts, description, adornment"),
        "06-nature-cosmos": ("Nature & Cosmos", "Earth, sky, water, mountains"),
        "07-war-combat": ("War & Combat", "Battle terms, combat verbs"),
        "08-sound-speech": ("Sound & Speech", "Sound, praise, narrative markers"),
        "09-emotions": ("Emotions", "Mental states, qualities of mind"),
        "10-verbs": ("Verbs", "High-frequency action verbs"),
        "11-adjectives": ("Adjectives", "Power, beauty, size, intensity"),
        "12-ritual": ("Ritual", "Worship, offering, mantra"),
        "13-philosophy": ("Philosophy", "Metaphysics, tattvas, moksha"),
        "14-animals": ("Animals", "Animals, vehicles, mounts"),
        "15-indeclinables": ("Indeclinables", "Particles, conjunctions, adverbs"),
        "16-prefixes-suffixes": ("Prefixes & Suffixes", "Upasargas, taddhita, krt"),
        "17-compounds": ("Compounds", "Key samasas broken down"),
        "18-formulae": ("Formulae", "Recurring phrases, refrains"),
        "19-numbers-time-space": ("Numbers & Time", "Numbers, time, directions"),
        "20-sacred-geography": ("Sacred Geography", "Places, tirthas, plants"),
        "21-deity-vibhakti": ("Deity Vibhakti", "Eight baseplates -- full declension tables"),
    }
    for fname in sorted(os.listdir(vocab_dir)):
        if not fname.endswith(".md"):
            continue
        key = fname.replace(".md", "")
        title, subtitle = vocab_meta.get(key, (key, ""))
        fpath = os.path.join(vocab_dir, fname)
        with open(fpath, "r") as f:
            content = f.read()
        cards = []
        for line in content.split("\n"):
            line = line.strip()
            if not line.startswith("|") or line.startswith("|---") or line.startswith("| -"):
                continue
            cols = [c.strip() for c in line.split("|")[1:-1]]
            if len(cols) >= 2:
                term = cols[0]
                meaning = cols[1]
                if term.lower() in ("term", "root", "phrase", "file", "abbreviation",
                                     "prefix", "suffix", "pattern", "number", "type",
                                     "compound", "element", "#", ""):
                    continue
                if meaning.lower() in ("meaning", "function", "category", "text",
                                        "tradition", "entries", ""):
                    continue
                term = re.sub(r'\*\*(.+?)\*\*', r'\1', term)
                meaning = re.sub(r'\*\*(.+?)\*\*', r'\1', meaning)
                if term and meaning and len(term) < 100:
                    cards.append({"t": term, "m": meaning})
        vocab_categories.append({
            "id": key, "title": title, "subtitle": subtitle,
            "content": content, "cards": cards
        })

# ── Build HTML ──

html = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sanskrit School</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
/* ══════════════════════════════════════════════
   CSS CUSTOM PROPERTIES
   ══════════════════════════════════════════════ */
:root {
  --bg:              #0d0d1a;
  --bg-surface:      #121222;
  --bg-elevated:     #1a1a2e;
  --bg-hover:        #222240;
  --bg-active:       #2a2a4a;

  --text:            #f0e6d3;
  --text-secondary:  #b8a99a;
  --text-muted:      #7a6e62;
  --text-dim:        #4a4040;

  --gold:            #c9a84c;
  --gold-dim:        #a08530;
  --gold-glow:       rgba(201, 168, 76, 0.08);
  --gold-glow-strong:rgba(201, 168, 76, 0.15);

  --accent-warm:     #d4956b;
  --accent-cool:     #7b8ec9;

  --border:          #262640;
  --border-subtle:   #1e1e35;

  --code-bg:         #0a0a14;
  --table-header:    #161628;
  --table-alt:       #0f0f1e;

  --green:           #6bcf8e;
  --red:             #e07070;

  --sidebar-w:       300px;
  --content-max:     750px;
  --radius:          8px;
  --radius-lg:       12px;

  --font-serif:      'Iowan Old Style', 'Palatino Linotype', 'Palatino', 'Georgia', 'Noto Serif', serif;
  --font-sans:       -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
  --font-mono:       'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Menlo', 'Consolas', monospace;

  --transition:      0.2s ease;
  --transition-slow: 0.35s ease;
}

/* ══════════════════════════════════════════════
   RESET & BASE
   ══════════════════════════════════════════════ */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

html { font-size: 16px; -webkit-text-size-adjust: 100%; }

body {
  font-family: var(--font-serif);
  background: var(--bg);
  color: var(--text);
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

::selection {
  background: var(--gold);
  color: var(--bg);
}

/* Scrollbars */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-dim); }

/* ══════════════════════════════════════════════
   SCROLL PROGRESS BAR (top of content)
   ══════════════════════════════════════════════ */
.scroll-progress {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: transparent;
  z-index: 10;
  flex-shrink: 0;
}
.scroll-progress-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, var(--gold-dim), var(--gold), var(--accent-warm));
  transition: width 0.1s linear;
}

/* ══════════════════════════════════════════════
   SIDEBAR
   ══════════════════════════════════════════════ */
.sidebar {
  width: var(--sidebar-w);
  min-width: var(--sidebar-w);
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  transition: transform var(--transition-slow);
  z-index: 100;
}

/* Header */
.sidebar-header {
  padding: 28px 24px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.sidebar-header h1 {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 400;
  color: var(--gold);
  letter-spacing: 0.5px;
  line-height: 1.2;
}

.sidebar-header .subtitle {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 6px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

/* Search */
.sidebar-search {
  padding: 12px 16px;
  flex-shrink: 0;
}

.sidebar-search input {
  width: 100%;
  padding: 9px 14px 9px 36px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition);
}

.sidebar-search input:focus {
  border-color: var(--gold-dim);
}

.sidebar-search input::placeholder {
  color: var(--text-dim);
}

.sidebar-search-wrap {
  position: relative;
}

.sidebar-search-wrap::before {
  content: '';
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--text-dim);
  border-radius: 50%;
  pointer-events: none;
}

.sidebar-search-wrap::after {
  content: '';
  position: absolute;
  left: 24px;
  top: 60%;
  width: 5px;
  height: 1.5px;
  background: var(--text-dim);
  transform: rotate(45deg);
  transform-origin: left center;
  pointer-events: none;
}

/* Section Toggle */
.section-toggle {
  padding: 8px 16px;
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
}

.section-btn {
  flex: 1;
  padding: 8px 0;
  text-align: center;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border-radius: 6px;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-muted);
  transition: all var(--transition);
  position: relative;
}

.section-btn.active {
  background: var(--gold-glow-strong);
  color: var(--gold);
}

.section-btn:hover:not(.active) {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

/* Stage List */
.stage-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0 20px;
}

/* Phase headers */
.phase-header {
  padding: 0 8px;
  margin-top: 8px;
}

.phase-header:first-child {
  margin-top: 4px;
}

.phase-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 6px;
  transition: background var(--transition);
}

.phase-toggle:hover {
  background: var(--bg-hover);
}

.phase-arrow {
  color: var(--text-dim);
  font-size: 10px;
  transition: transform var(--transition);
  width: 12px;
  text-align: center;
  flex-shrink: 0;
}

.phase-header.collapsed .phase-arrow {
  transform: rotate(-90deg);
}

.phase-label {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-dim);
}

.phase-count {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
}

.phase-stages {
  overflow: hidden;
  transition: max-height var(--transition-slow), opacity var(--transition);
}

.phase-header.collapsed .phase-stages {
  max-height: 0 !important;
  opacity: 0;
}

/* Stage items */
.stage-item {
  padding: 9px 16px 9px 20px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: all var(--transition);
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 0 8px;
  border-radius: 0 6px 6px 0;
}

.stage-item:hover {
  background: var(--bg-hover);
}

.stage-item.active {
  background: var(--gold-glow);
  border-left-color: var(--gold);
}

.stage-item.visited .stage-num::after {
  content: '';
  display: inline-block;
  width: 4px;
  height: 4px;
  background: var(--gold-dim);
  border-radius: 50%;
  margin-left: 4px;
  vertical-align: middle;
}

.stage-item.hidden { display: none; }

.stage-num {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  min-width: 22px;
  flex-shrink: 0;
}

.stage-info { flex: 1; min-width: 0; }

.stage-title {
  font-family: var(--font-serif);
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.3;
}

.active .stage-title { color: var(--gold); }

.stage-subtitle {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

/* ══════════════════════════════════════════════
   MAIN CONTENT AREA
   ══════════════════════════════════════════════ */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* Tab bar */
.tab-bar {
  display: flex;
  align-items: flex-end;
  padding: 0 40px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  overflow-x: auto;
  gap: 2px;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.tab-bar::-webkit-scrollbar { display: none; }

.tab {
  padding: 12px 20px 11px;
  font-family: var(--font-sans);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all var(--transition);
  white-space: nowrap;
  letter-spacing: 0.2px;
  position: relative;
  border-radius: 6px 6px 0 0;
}

.tab:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

.tab.active {
  color: var(--gold);
  border-bottom-color: var(--gold);
  background: transparent;
}

/* Content progress bar */
.progress-bar {
  height: 2px;
  background: var(--border-subtle);
  flex-shrink: 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--gold-dim) 0%, var(--gold) 50%, var(--accent-warm) 100%);
  transition: width 0.4s ease;
  border-radius: 0 1px 1px 0;
}

/* Content wrapper */
.content-wrap {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.content {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 48px 40px 100px;
  animation: fadeIn 0.25s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ══════════════════════════════════════════════
   MARKDOWN TYPOGRAPHY
   ══════════════════════════════════════════════ */
.content h1 {
  font-size: 26px;
  font-weight: 400;
  color: var(--gold);
  margin-bottom: 24px;
  line-height: 1.35;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
  letter-spacing: 0.3px;
}

.content h2 {
  font-size: 20px;
  font-weight: 400;
  color: var(--accent-warm);
  margin-top: 48px;
  margin-bottom: 16px;
  line-height: 1.35;
  letter-spacing: 0.2px;
}

.content h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin-top: 32px;
  margin-bottom: 12px;
  line-height: 1.4;
}

.content h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-top: 24px;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: var(--font-sans);
}

.content p {
  font-size: 15.5px;
  line-height: 1.85;
  margin-bottom: 16px;
  color: var(--text);
}

.content ul, .content ol {
  margin-bottom: 16px;
  padding-left: 24px;
}

.content li {
  font-size: 15.5px;
  line-height: 1.8;
  margin-bottom: 6px;
  color: var(--text);
}

.content li::marker {
  color: var(--gold-dim);
}

/* Blockquotes -- Sanskrit verses or important notes */
.content blockquote {
  border-left: 3px solid var(--gold-dim);
  padding: 16px 24px;
  margin: 24px 0;
  background: var(--gold-glow);
  border-radius: 0 var(--radius) var(--radius) 0;
  font-style: italic;
}

.content blockquote p {
  margin-bottom: 6px;
  color: var(--text-secondary);
  font-size: 15px;
}

.content blockquote p:last-child {
  margin-bottom: 0;
}

/* Inline code -- transliteration */
.content code {
  background: var(--code-bg);
  padding: 2px 7px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13.5px;
  color: var(--gold);
  border: 1px solid var(--border-subtle);
}

/* Code blocks */
.content pre {
  background: var(--code-bg);
  padding: 20px 24px;
  border-radius: var(--radius);
  overflow-x: auto;
  margin: 20px 0;
  border: 1px solid var(--border);
  line-height: 1.65;
}

.content pre code {
  background: none;
  padding: 0;
  border: none;
  font-size: 13.5px;
  color: var(--text);
}

/* Strong -- highlight Sanskrit terms */
.content strong {
  color: var(--gold);
  font-weight: 600;
}

/* Emphasis */
.content em {
  color: var(--text-secondary);
  font-style: italic;
}

/* Links */
.content a {
  color: var(--accent-cool);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color var(--transition);
}

.content a:hover {
  border-bottom-color: var(--accent-cool);
}

/* Horizontal rule */
.content hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 40px 0;
}

/* ══════════════════════════════════════════════
   TABLES -- THE CORE LEARNING TOOL
   ══════════════════════════════════════════════ */
.content .table-wrap {
  overflow-x: auto;
  margin: 24px 0;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--bg-surface);
}

.content table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  line-height: 1.5;
}

.content thead {
  background: var(--table-header);
}

.content th {
  padding: 12px 16px;
  text-align: left;
  color: var(--gold);
  font-weight: 500;
  font-family: var(--font-sans);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  border-bottom: 2px solid var(--border);
  white-space: nowrap;
}

.content td {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: top;
  color: var(--text);
  font-size: 14px;
}

.content tbody tr:nth-child(even) {
  background: var(--table-alt);
}

.content tbody tr:hover {
  background: var(--bg-hover);
}

.content tbody tr:last-child td {
  border-bottom: none;
}

/* First column in tables -- often the Sanskrit term */
.content td:first-child {
  color: var(--gold);
  font-weight: 500;
}

/* ══════════════════════════════════════════════
   BOTTOM NAVIGATION
   ══════════════════════════════════════════════ */
.bottom-nav {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  margin-top: 56px;
  padding-top: 32px;
  border-top: 1px solid var(--border);
  gap: 16px;
}

.nav-btn {
  padding: 14px 20px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-size: 14px;
  font-family: var(--font-serif);
  cursor: pointer;
  transition: all var(--transition);
  text-decoration: none;
  max-width: 48%;
}

.nav-btn:hover {
  border-color: var(--gold-dim);
  background: var(--bg-elevated);
}

.nav-btn.disabled {
  opacity: 0.2;
  pointer-events: none;
}

.nav-btn .nav-label {
  font-family: var(--font-sans);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-dim);
  display: block;
  margin-bottom: 4px;
}

.nav-btn .nav-title {
  color: var(--gold);
  font-size: 14px;
}

/* ══════════════════════════════════════════════
   FLASHCARDS
   ══════════════════════════════════════════════ */
.flashcard-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  max-width: 520px;
  margin: 0 auto;
}

.fc-progress {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}

.fc-bar {
  width: 100%;
  height: 3px;
  background: var(--border);
  border-radius: 2px;
  margin-bottom: 40px;
  overflow: hidden;
}

.fc-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--gold-dim), var(--gold));
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* Card */
.fc-card {
  width: 100%;
  min-height: 240px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 36px;
  cursor: pointer;
  user-select: none;
  transition: all var(--transition);
  position: relative;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2);
}

.fc-card:hover {
  border-color: var(--gold-dim);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.25);
}

.fc-card::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 20%;
  right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold-dim), transparent);
  opacity: 0.5;
}

.fc-term {
  font-family: var(--font-serif);
  font-size: 30px;
  color: var(--gold);
  text-align: center;
  line-height: 1.4;
  letter-spacing: 0.5px;
}

.fc-hint {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 20px;
  letter-spacing: 0.5px;
}

.fc-meaning {
  font-size: 18px;
  color: var(--text);
  text-align: center;
  margin-top: 24px;
  line-height: 1.55;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  width: 100%;
  animation: fadeIn 0.2s ease;
}

/* Buttons */
.fc-buttons {
  display: flex;
  gap: 12px;
  margin-top: 28px;
  width: 100%;
}

.fc-btn {
  flex: 1;
  padding: 14px 20px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 14px;
  font-family: var(--font-sans);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
  text-align: center;
}

.fc-btn:hover { transform: translateY(-1px); }

.fc-btn.again {
  border-color: var(--red);
  color: var(--red);
}
.fc-btn.again:hover {
  background: var(--red);
  color: var(--bg);
}

.fc-btn.good {
  border-color: var(--green);
  color: var(--green);
}
.fc-btn.good:hover {
  background: var(--green);
  color: var(--bg);
}

.fc-score {
  display: flex;
  gap: 24px;
  margin-top: 24px;
  font-family: var(--font-mono);
  font-size: 12px;
}

.fc-score span { color: var(--text-dim); }
.fc-score .g { color: var(--green); }
.fc-score .r { color: var(--red); }

/* Done screen */
.fc-done {
  text-align: center;
  padding: 60px 20px;
}

.fc-done h2 {
  font-family: var(--font-serif);
  color: var(--gold);
  font-weight: 400;
  font-size: 24px;
  margin-bottom: 16px;
}

.fc-done p {
  color: var(--text-muted);
  margin-bottom: 28px;
  font-size: 14px;
}

.fc-restart {
  padding: 12px 32px;
  background: var(--gold);
  color: var(--bg);
  border: none;
  border-radius: var(--radius);
  font-size: 14px;
  font-family: var(--font-sans);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
}

.fc-restart:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* ══════════════════════════════════════════════
   WELCOME SCREEN
   ══════════════════════════════════════════════ */
.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 40px;
  min-height: 60vh;
}

.welcome-icon {
  font-size: 48px;
  margin-bottom: 24px;
  opacity: 0.15;
  font-family: var(--font-serif);
  color: var(--gold);
}

.welcome h2 {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 400;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.welcome p {
  font-size: 14px;
  color: var(--text-muted);
  max-width: 360px;
  line-height: 1.7;
}

.welcome .shortcut-hint {
  margin-top: 32px;
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
}

.welcome .shortcut-hint span {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 6px;
}

.welcome .shortcut-hint kbd {
  display: inline-block;
  padding: 2px 7px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

/* ══════════════════════════════════════════════
   MOBILE
   ══════════════════════════════════════════════ */
.mobile-toggle {
  display: none;
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 200;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--gold);
  width: 42px;
  height: 42px;
  border-radius: var(--radius);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  transition: all var(--transition);
}

.mobile-toggle:hover {
  background: var(--bg-active);
}

.overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 50;
  opacity: 0;
  transition: opacity var(--transition-slow);
}

.overlay.show {
  display: block;
  opacity: 1;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    transform: translateX(-100%);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.4);
    width: 85vw;
    min-width: 85vw;
    max-width: 360px;
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .mobile-toggle {
    display: flex !important;
  }

  .content {
    padding: 32px 20px 80px;
  }

  .tab-bar {
    padding: 0 16px;
  }

  .tab {
    padding: 10px 14px;
    font-size: 12px;
  }

  .content h1 { font-size: 22px; }
  .content h2 { font-size: 18px; }

  .fc-term { font-size: 24px; }
  .fc-card { padding: 36px 24px; min-height: 200px; }

  .bottom-nav {
    flex-direction: column;
    gap: 12px;
  }

  .nav-btn {
    max-width: 100%;
  }

  .welcome { padding: 60px 20px; }
}

/* ══════════════════════════════════════════════
   KEYBOARD SHORTCUT FOOTER
   ══════════════════════════════════════════════ */
.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.sidebar-footer span {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.sidebar-footer kbd {
  display: inline-block;
  padding: 1px 5px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
}
</style>
</head>
<body>

<div class="mobile-toggle" onclick="toggleSidebar()">&#9776;</div>
<div class="overlay" id="overlay" onclick="toggleSidebar()"></div>

<nav class="sidebar" id="sidebar">
  <div class="sidebar-header">
    <h1>Sanskrit School</h1>
    <div class="subtitle">36 Stages &middot; Language &middot; Poetry &middot; Avadhana</div>
  </div>
  <div class="section-toggle">
    <div class="section-btn active" onclick="showSection('lessons')">Lessons</div>
    <div class="section-btn" onclick="showSection('vocab')">Vocabulary</div>
  </div>
  <div class="sidebar-search">
    <div class="sidebar-search-wrap">
      <input type="text" id="search" placeholder='Search stages...' oninput="filterItems(this.value)">
    </div>
  </div>
  <div class="stage-list" id="stageList"></div>
  <div class="sidebar-footer">
    <span><kbd>/</kbd> search &nbsp; <kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate &nbsp; <kbd>1</kbd>-<kbd>6</kbd> tabs</span>
  </div>
</nav>

<main class="main">
  <div class="tab-bar" id="tabBar"></div>
  <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width:0%"></div></div>
  <div class="content-wrap" id="contentWrap">
    <div class="scroll-progress"><div class="scroll-progress-fill" id="scrollProgressFill"></div></div>
    <div class="content" id="content">
      <div class="welcome">
        <div class="welcome-icon">&#x0950;</div>
        <h2>Select a stage to begin</h2>
        <p>Work through 36 stages from basic vocabulary to avadhana mastery, or explore the vocabulary bank.</p>
        <div class="shortcut-hint">
          <span><kbd>/</kbd> Search</span>
          <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> Navigate</span>
          <span><kbd>1</kbd>-<kbd>6</kbd> Tabs</span>
        </div>
      </div>
    </div>
  </div>
</main>

<script>
const STAGES = """ + json.dumps(stages, ensure_ascii=False) + """;
const FILE_LABELS = """ + json.dumps(file_labels) + """;
const VOCAB = """ + json.dumps(vocab_categories, ensure_ascii=False) + """;

const PHASES = [
  { label: "Phase 1: Language Acquisition", range: [1, 12] },
  { label: "Phase 2: Poetic Composition",   range: [13, 25] },
  { label: "Phase 3: Avadhana",             range: [26, 36] },
];

let currentSection = 'lessons';
let currentStage = null;
let currentTab = null;
let currentVocab = null;
let visitedStages = new Set();

// Load visited stages from localStorage
try {
  const saved = localStorage.getItem('ss-visited');
  if (saved) visitedStages = new Set(JSON.parse(saved));
} catch(e) {}

function saveVisited() {
  try {
    localStorage.setItem('ss-visited', JSON.stringify([...visitedStages]));
  } catch(e) {}
}

// ── Flashcard state ──
let fcCards = [];
let fcIdx = 0;
let fcRevealed = false;
let fcGood = 0;
let fcAgain = 0;
let fcBatchSize = 20;
let fcMissed = [];

// ── Scroll progress tracking ──
const contentWrap = document.getElementById('contentWrap');
contentWrap.addEventListener('scroll', function() {
  const el = this;
  const scrollTop = el.scrollTop;
  const scrollHeight = el.scrollHeight - el.clientHeight;
  const pct = scrollHeight > 0 ? Math.min(100, (scrollTop / scrollHeight) * 100) : 0;
  document.getElementById('scrollProgressFill').style.width = pct + '%';
});

// ══════════════════════════════════════════════
// SECTION SWITCHING
// ══════════════════════════════════════════════
function showSection(section) {
  currentSection = section;
  document.querySelectorAll('.section-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.section-btn[onclick*="' + section + '"]').classList.add('active');
  document.getElementById('search').value = '';
  document.getElementById('search').placeholder = section === 'lessons' ? 'Search stages...' : 'Search vocabulary...';
  buildSidebar();
  if (section === 'lessons') {
    selectStage(0);
  } else {
    selectVocab(0);
  }
}

// ══════════════════════════════════════════════
// SIDEBAR BUILDER
// ══════════════════════════════════════════════
function buildSidebar() {
  const list = document.getElementById('stageList');
  let html = '';

  if (currentSection === 'lessons') {
    // Overview (stage 0) first, outside any phase
    const overviewIdx = STAGES.findIndex(s => s.number === 0);
    if (overviewIdx >= 0) {
      const s = STAGES[overviewIdx];
      const visited = visitedStages.has(s.id) ? ' visited' : '';
      html += '<div class="stage-item' + visited + '" data-idx="' + overviewIdx + '" data-section="lessons" onclick="selectStage(' + overviewIdx + ')">';
      html += '<span class="stage-num"></span>';
      html += '<div class="stage-info"><div class="stage-title">' + s.title + '</div>';
      html += '<div class="stage-subtitle">' + s.subtitle + '</div></div></div>';
    }

    // Phases
    PHASES.forEach((phase, pi) => {
      const stagesInPhase = STAGES.filter(s => s.number >= phase.range[0] && s.number <= phase.range[1]);
      if (stagesInPhase.length === 0) return;

      const count = stagesInPhase.length;
      html += '<div class="phase-header" id="phase-' + pi + '">';
      html += '<button class="phase-toggle" onclick="togglePhase(' + pi + ')">';
      html += '<span class="phase-arrow">&#9660;</span>';
      html += '<span class="phase-label">' + phase.label + '</span>';
      html += '<span class="phase-count">' + count + '</span>';
      html += '</button>';
      html += '<div class="phase-stages" style="max-height:' + (count * 60) + 'px">';

      stagesInPhase.forEach(s => {
        const i = STAGES.indexOf(s);
        const num = String(s.number).padStart(2, '0');
        const visited = visitedStages.has(s.id) ? ' visited' : '';
        html += '<div class="stage-item' + visited + '" data-idx="' + i + '" data-section="lessons" onclick="selectStage(' + i + ')">';
        html += '<span class="stage-num">' + num + '</span>';
        html += '<div class="stage-info"><div class="stage-title">' + s.title + '</div>';
        html += '<div class="stage-subtitle">' + s.subtitle + '</div></div></div>';
      });

      html += '</div></div>';
    });
  } else {
    // Vocab section
    html += '<div class="phase-header" id="phase-vocab">';
    html += '<button class="phase-toggle" onclick="togglePhase(&quot;vocab&quot;)">';
    html += '<span class="phase-arrow">&#9660;</span>';
    html += '<span class="phase-label">Vocabulary Bank</span>';
    html += '<span class="phase-count">' + VOCAB.length + '</span>';
    html += '</button>';
    html += '<div class="phase-stages" style="max-height:' + (VOCAB.length * 60) + 'px">';

    VOCAB.forEach((v, i) => {
      const num = v.id.split('-')[0];
      const cardCount = v.cards.length;
      const sub = v.subtitle + (cardCount > 0 ? ' &middot; ' + cardCount + ' cards' : '');
      html += '<div class="stage-item" data-idx="' + i + '" data-section="vocab" onclick="selectVocab(' + i + ')">';
      html += '<span class="stage-num">' + num + '</span>';
      html += '<div class="stage-info"><div class="stage-title">' + v.title + '</div>';
      html += '<div class="stage-subtitle">' + sub + '</div></div></div>';
    });

    html += '</div></div>';
  }

  list.innerHTML = html;
}

function togglePhase(id) {
  const el = document.getElementById('phase-' + id);
  if (el) el.classList.toggle('collapsed');
}

// ══════════════════════════════════════════════
// STAGE SELECTION
// ══════════════════════════════════════════════
function selectStage(idx) {
  currentStage = idx;
  currentVocab = null;
  const stage = STAGES[idx];

  // Mark visited
  visitedStages.add(stage.id);
  saveVisited();

  // Update sidebar active states
  document.querySelectorAll('.stage-item').forEach(el => el.classList.remove('active'));
  const item = document.querySelector('.stage-item[data-idx="' + idx + '"][data-section="lessons"]');
  if (item) {
    item.classList.add('active');
    item.classList.add('visited');
  }

  // Build tabs
  const tabBar = document.getElementById('tabBar');
  if (stage.number === 0) {
    tabBar.innerHTML = '<div class="tab active">Overview</div>';
    renderContent(stage.files.overview);
    currentTab = 'overview';
  } else {
    let tabHtml = '';
    stage.tabs.forEach((t, ti) => {
      const cls = ti === 0 ? 'active' : '';
      const label = FILE_LABELS[t] || t;
      tabHtml += '<div class="tab ' + cls + '" data-tab="' + t + '" onclick="selectTab(&quot;' + t + '&quot;)">' + label + '</div>';
    });
    tabBar.innerHTML = tabHtml;
    currentTab = stage.tabs[0];
    renderContent(stage.files[currentTab]);
  }

  closeMobileSidebar();
}

function selectVocab(idx) {
  currentVocab = idx;
  currentStage = null;
  const v = VOCAB[idx];

  document.querySelectorAll('.stage-item').forEach(el => el.classList.remove('active'));
  const item = document.querySelector('.stage-item[data-idx="' + idx + '"][data-section="vocab"]');
  if (item) item.classList.add('active');

  const tabBar = document.getElementById('tabBar');
  let tabHtml = '<div class="tab active" data-tab="browse" onclick="selectVocabTab(&quot;browse&quot;)">Browse</div>';
  if (v.cards.length > 0) {
    tabHtml += '<div class="tab" data-tab="flashcard" onclick="selectVocabTab(&quot;flashcard&quot;)">Flashcards</div>';
  }
  tabBar.innerHTML = tabHtml;
  currentTab = 'browse';
  renderContent(v.content);
  closeMobileSidebar();
}

function selectVocabTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  const tabEl = document.querySelector('.tab[data-tab="' + tab + '"]');
  if (tabEl) tabEl.classList.add('active');

  if (tab === 'browse') {
    renderContent(VOCAB[currentVocab].content);
  } else {
    startFlashcards(VOCAB[currentVocab].cards);
  }
}

function selectTab(tab) {
  if (currentStage === null) return;
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  const tabEl = document.querySelector('.tab[data-tab="' + tab + '"]');
  if (tabEl) tabEl.classList.add('active');
  renderContent(STAGES[currentStage].files[tab]);
}

// ══════════════════════════════════════════════
// CONTENT RENDERER
// ══════════════════════════════════════════════
function renderContent(md) {
  const el = document.getElementById('content');
  let html = marked.parse(md);

  // Wrap tables for horizontal scroll
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');

  // Add bottom nav for lessons
  if (currentSection === 'lessons' && currentStage !== null) {
    html += buildBottomNav();
  }

  el.innerHTML = html;
  document.getElementById('contentWrap').scrollTop = 0;
  document.getElementById('scrollProgressFill').style.width = '0%';
  updateProgress();
}

function buildBottomNav() {
  const stage = STAGES[currentStage];
  const tabs = stage.tabs || [];
  const tabIdx = tabs.indexOf(currentTab);
  let h = '<div class="bottom-nav">';

  if (tabIdx > 0) {
    const prevTab = tabs[tabIdx - 1];
    h += '<div class="nav-btn" onclick="selectTab(&quot;' + prevTab + '&quot;)"><span class="nav-label">Previous</span><span class="nav-title">' + (FILE_LABELS[prevTab] || prevTab) + '</span></div>';
  } else if (currentStage > 0) {
    const prevStage = STAGES[currentStage - 1];
    h += '<div class="nav-btn" onclick="selectStage(' + (currentStage - 1) + ')"><span class="nav-label">Previous Stage</span><span class="nav-title">' + prevStage.title + '</span></div>';
  } else {
    h += '<div class="nav-btn disabled"></div>';
  }

  if (tabIdx < tabs.length - 1) {
    const nextTab = tabs[tabIdx + 1];
    h += '<div class="nav-btn" onclick="selectTab(&quot;' + nextTab + '&quot;)"><span class="nav-label">Next</span><span class="nav-title">' + (FILE_LABELS[nextTab] || nextTab) + '</span></div>';
  } else if (currentStage < STAGES.length - 1) {
    const nextStage = STAGES[currentStage + 1];
    h += '<div class="nav-btn" onclick="selectStage(' + (currentStage + 1) + ')"><span class="nav-label">Next Stage</span><span class="nav-title">' + nextStage.title + '</span></div>';
  } else {
    h += '<div class="nav-btn disabled"></div>';
  }

  h += '</div>';
  return h;
}

function updateProgress() {
  const fill = document.getElementById('progressFill');
  if (currentSection === 'lessons' && currentStage !== null) {
    const stage = STAGES[currentStage];
    const tabs = stage.tabs || [];
    const tabIdx = Math.max(0, tabs.indexOf(currentTab));
    const stageProgress = currentStage / STAGES.length;
    const tabProgress = tabs.length > 1 ? (tabIdx / (tabs.length - 1)) / STAGES.length : 0;
    fill.style.width = Math.round((stageProgress + tabProgress) * 100) + '%';
  } else if (currentSection === 'vocab' && currentVocab !== null) {
    fill.style.width = Math.round(((currentVocab + 1) / VOCAB.length) * 100) + '%';
  }
}

// ══════════════════════════════════════════════
// FLASHCARDS
// ══════════════════════════════════════════════
function startFlashcards(cards, batchSize) {
  batchSize = batchSize || fcBatchSize;
  const deck = shuffle([...cards]);
  fcCards = deck.slice(0, Math.min(batchSize, deck.length));
  fcBatchSize = batchSize;
  fcIdx = 0;
  fcRevealed = false;
  fcGood = 0;
  fcAgain = 0;
  fcMissed = [];
  renderFlashcard();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderFlashcard() {
  const el = document.getElementById('content');
  const total = VOCAB[currentVocab].cards.length;

  if (fcIdx >= fcCards.length) {
    let h = '<div class="fc-done"><h2>Round Complete</h2>';
    h += '<p>' + fcGood + ' known &middot; ' + fcAgain + ' to review &middot; ' + fcCards.length + ' cards</p>';
    if (fcMissed.length > 0) {
      h += '<button class="fc-restart" onclick="startFlashcards(fcMissed, fcMissed.length)" style="margin-right:12px">Drill Missed (' + fcMissed.length + ')</button>';
    }
    h += '<button class="fc-restart" onclick="startFlashcards(VOCAB[currentVocab].cards, fcBatchSize)">New Round</button>';
    if (total > 20) {
      h += '<div style="margin-top:24px; display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">';
      [10, 20, 50, total].forEach(n => {
        const label = n === total ? 'All ' + total : n;
        const act = n === fcBatchSize ? 'color:var(--gold);border-color:var(--gold)' : '';
        h += '<button class="nav-btn" style="' + act + '" onclick="startFlashcards(VOCAB[currentVocab].cards,' + n + ')">' + label + '</button>';
      });
      h += '</div>';
    }
    h += '</div>';
    el.innerHTML = h;
    document.getElementById('contentWrap').scrollTop = 0;
    return;
  }

  const card = fcCards[fcIdx];
  const pct = Math.round((fcIdx / fcCards.length) * 100);

  let h = '<div class="flashcard-container">';
  h += '<div class="fc-progress">' + (fcIdx + 1) + ' / ' + fcCards.length;
  if (total > fcCards.length) h += ' (of ' + total + ')';
  h += '</div>';
  h += '<div class="fc-bar"><div class="fc-bar-fill" style="width:' + pct + '%"></div></div>';
  h += '<div class="fc-card" onclick="revealCard()">';
  h += '<div class="fc-term">' + escHtml(card.t) + '</div>';

  if (fcRevealed) {
    h += '<div class="fc-meaning">' + escHtml(card.m) + '</div>';
  } else {
    h += '<div class="fc-hint">tap or press space to reveal</div>';
  }

  h += '</div>';

  if (fcRevealed) {
    h += '<div class="fc-buttons">';
    h += '<button class="fc-btn again" onclick="fcAnswer(false)">&#8592; Again</button>';
    h += '<button class="fc-btn good" onclick="fcAnswer(true)">Good &#8594;</button>';
    h += '</div>';
  }

  h += '<div class="fc-score"><span class="g">good: ' + fcGood + '</span><span class="r">again: ' + fcAgain + '</span></div>';
  h += '</div>';

  el.innerHTML = h;
  document.getElementById('contentWrap').scrollTop = 0;
}

function revealCard() {
  if (!fcRevealed) {
    fcRevealed = true;
    renderFlashcard();
  }
}

function fcAnswer(good) {
  if (good) {
    fcGood++;
  } else {
    fcAgain++;
    fcMissed.push(fcCards[fcIdx]);
    const reinsert = Math.min(fcIdx + 3 + Math.floor(Math.random() * 4), fcCards.length);
    fcCards.splice(reinsert, 0, fcCards[fcIdx]);
  }
  fcIdx++;
  fcRevealed = false;
  renderFlashcard();
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ══════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════
function filterItems(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.stage-item').forEach(el => {
    const idx = parseInt(el.dataset.idx);
    let text = '';
    if (currentSection === 'lessons') {
      const s = STAGES[idx];
      if (s) text = (s.title + ' ' + s.subtitle + ' ' + s.id).toLowerCase();
    } else {
      const v = VOCAB[idx];
      if (v) text = (v.title + ' ' + v.subtitle + ' ' + v.id).toLowerCase();
    }
    el.classList.toggle('hidden', q.length > 0 && !text.includes(q));
  });

  // Expand all phases when searching, collapse when cleared
  if (q.length > 0) {
    document.querySelectorAll('.phase-header').forEach(el => el.classList.remove('collapsed'));
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}

function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

// ══════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;

  // Flashcard keys
  if (currentTab === 'flashcard' && currentVocab !== null) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); revealCard(); }
    else if (fcRevealed && (e.key === '1' || e.key === 'a' || e.key === 'ArrowLeft')) { e.preventDefault(); fcAnswer(false); }
    else if (fcRevealed && (e.key === '2' || e.key === 'g' || e.key === 'ArrowRight')) { e.preventDefault(); fcAnswer(true); }
    return;
  }

  // Tab shortcuts: 1-6 for lesson tabs
  if (currentSection === 'lessons' && currentStage !== null && STAGES[currentStage].number > 0) {
    const stage = STAGES[currentStage];
    const tabNum = parseInt(e.key);
    if (tabNum >= 1 && tabNum <= 6 && stage.tabs[tabNum - 1]) {
      selectTab(stage.tabs[tabNum - 1]);
      return;
    }
  }

  // Arrow navigation
  if (currentSection === 'lessons') {
    if (e.key === 'ArrowDown' && currentStage < STAGES.length - 1) {
      e.preventDefault();
      selectStage(currentStage + 1);
      document.querySelector('.stage-item.active')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp' && currentStage > 0) {
      e.preventDefault();
      selectStage(currentStage - 1);
      document.querySelector('.stage-item.active')?.scrollIntoView({ block: 'nearest' });
    }
  } else {
    if (e.key === 'ArrowDown' && currentVocab < VOCAB.length - 1) {
      e.preventDefault();
      selectVocab(currentVocab + 1);
      document.querySelector('.stage-item.active')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp' && currentVocab > 0) {
      e.preventDefault();
      selectVocab(currentVocab - 1);
      document.querySelector('.stage-item.active')?.scrollIntoView({ block: 'nearest' });
    }
  }

  // Focus search
  if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    document.getElementById('search').focus();
  }

  // Escape to blur search
  if (e.key === 'Escape') {
    document.getElementById('search').blur();
    closeMobileSidebar();
  }
});

// Search input: escape to blur
document.getElementById('search').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.target.blur();
    e.target.value = '';
    filterItems('');
  }
});

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
buildSidebar();
</script>
</body>
</html>
"""

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
with open(OUTPUT, "w") as f:
    f.write(html)

total_cards = sum(len(v["cards"]) for v in vocab_categories)
print(f"Built: {OUTPUT}")
print(f"Lessons: {len(stages)} stages")
print(f"Vocab: {len(vocab_categories)} categories, {total_cards} flashcards")
