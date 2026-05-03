# TOEIC Adaptive Flashcard Web App

MVP web app for TOEIC vocabulary practice using vocabulary extracted from the provided Oxford 3000 PDF only.

## Files

- `index.html` - app shell
- `styles.css` - responsive UI
- `app.js` - quiz, adaptive logic, LocalStorage, dashboard
- `data/vocab.js` - extracted vocabulary dataset
- `tools/extract_vocab.py` - PDF extraction script

## Implemented

- 3-choice vocabulary quiz
- Per-word memory model: correct, wrong, strength, lastSeen
- Adaptive selection: weak words, unseen words, stale words
- Review mode for weak/wrong words
- Saved words mode
- Tester name and formal test session start screen
- Session timer, answered count, current/best streak, and test history
- Click-to-listen pronunciation using the browser Speech Synthesis API
- Score, total answered, accuracy, current level, learned words
- Top weak words and saved words dashboard
- LocalStorage persistence

## Data Notes

The supplied PDF contains CEFR levels A1-B2. The app renders C1/C2 as disabled because no C1/C2 vocabulary exists in the provided source file.

## Run

Open `index.html` in a browser.

## GitHub Pages

This app is static. Deploy from the `main` branch root with GitHub Pages.
