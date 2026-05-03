const fs = require("fs");
const path = require("path");

const vocabPath = path.join(__dirname, "..", "data", "vocab.js");
const source = fs.readFileSync(vocabPath, "utf8");
const data = JSON.parse(source.replace(/^window\.VOCAB_DATA = /, "").replace(/;\s*$/, ""));

const counts = data.reduce((acc, entry) => {
  acc[entry.level] = (acc[entry.level] || 0) + 1;
  return acc;
}, {});

const suspicious = data.filter((entry) => {
  if (!entry.word || !entry.pos || !entry.meaning) return true;
  if (/[\u0E00-\u0E7F]/.test(entry.word)) return true;
  if (/[A-Za-z]{3,}/.test(entry.meaning)) return true;
  if (entry.word.length > 30 || entry.meaning.length <= 1) return true;
  return false;
});

const needsPosCleanup = data.filter((entry) => /\/|\barticle\b|\binfinitive marker\b|\(|\)/.test(entry.pos));
const duplicateWords = new Map();

data.forEach((entry) => {
  const key = entry.word.toLowerCase();
  duplicateWords.set(key, [...(duplicateWords.get(key) || []), entry]);
});

const repeatedAcrossLevels = [...duplicateWords.values()].filter((items) => items.length > 1);

console.log(`Total entries: ${data.length}`);
console.log(`Level counts: ${JSON.stringify(counts)}`);
console.log(`Structural issues: ${suspicious.length}`);
console.log(`POS cleanup candidates: ${needsPosCleanup.length}`);
console.log(`Repeated words across levels/POS: ${repeatedAcrossLevels.length}`);

if (suspicious.length) {
  console.log("\nStructural issue samples:");
  suspicious.slice(0, 20).forEach((entry) => console.log(entry));
}

if (needsPosCleanup.length) {
  console.log("\nPOS cleanup samples:");
  needsPosCleanup.slice(0, 20).forEach((entry) => console.log(entry));
}
