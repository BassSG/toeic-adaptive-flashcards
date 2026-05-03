# TOEIC Adaptive Flashcard Web App

MVP web app for TOEIC vocabulary practice using vocabulary extracted from the provided Oxford 3000 PDF only.

## Files

- `index.html` - app shell
- `styles.css` - responsive UI
- `app.js` - quiz, adaptive logic, LocalStorage, dashboard
- `data/vocab.js` - extracted vocabulary dataset
- `tools/extract_vocab.py` - PDF extraction script
- `tools/audit_vocab.js` - dataset structure audit helper

## Implemented

- 3-choice vocabulary quiz
- Per-word memory model: correct, wrong, strength, lastSeen
- Adaptive selection: weak words, unseen words, stale words
- Review mode for weak/wrong words
- Saved words mode
- Tester name and formal test session start screen
- Configurable test sessions, defaulting to 50 questions in 15 minutes
- Countdown timer, progress bar, answered count, current/best streak, and test history
- Click-to-listen pronunciation using the browser Speech Synthesis API
- Score, total answered, accuracy, current level, learned words
- Top weak words and saved words dashboard
- LocalStorage persistence

## Data Notes

The supplied PDF contains CEFR source levels A1-B2. The app groups them into three product tiers:

- A = A1 + A2
- B = B1
- C = B2

Dataset audit result: 3,134 total entries, no empty fields, no Thai text in the word column, and no English text in the Thai meaning column. Repeated words are kept when they appear with different POS or source levels.

## Run

Open `index.html` in a browser.

## GitHub Pages

This app is static. The live site is published from the `gh-pages` branch.
