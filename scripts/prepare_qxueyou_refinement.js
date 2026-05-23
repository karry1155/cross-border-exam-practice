const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, '..', '01-拼音检索全部选择题项目', 'qxueyou_targeted_practice_questions.json');
const OUT_DIR = path.join(ROOT, 'refinement_work');
const BATCH_SIZE = 305;

function cleanQuestion(item) {
  const options = { ...(item.options || {}) };
  const cleaningNotes = [];

  for (const key of Object.keys(options)) {
    const value = String(options[key]).trim();
    if (!value) {
      delete options[key];
      cleaningNotes.push(`removed empty option ${key}`);
      continue;
    }

    if (
      key === 'E' &&
      ['A', 'B', 'C', 'D'].includes(value) &&
      Object.prototype.hasOwnProperty.call(options, value)
    ) {
      delete options[key];
      cleaningNotes.push(`removed suspicious option E="${value}"`);
    }
  }

  return {
    source_id: item.id,
    question: item.question,
    options,
    answer: item.answer,
    cleaning_notes: cleaningNotes,
  };
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'batches'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'keys'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'worker_outputs'), { recursive: true });

const raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
const cleaned = raw.map(cleanQuestion);
const cleaningNotes = cleaned
  .filter((item) => item.cleaning_notes.length)
  .map((item) => ({ source_id: item.source_id, notes: item.cleaning_notes }));

for (let i = 0; i < cleaned.length; i += BATCH_SIZE) {
  const batchNo = Math.floor(i / BATCH_SIZE) + 1;
  const batchId = `batch_${String(batchNo).padStart(2, '0')}`;
  const items = cleaned.slice(i, i + BATCH_SIZE);

  writeJson(path.join(OUT_DIR, 'batches', `${batchId}.json`), {
    batch_id: batchId,
    questions: items.map(({ source_id, question, options }) => ({
      source_id,
      question,
      options,
    })),
  });

  writeJson(path.join(OUT_DIR, 'keys', `${batchId}_key.json`), {
    batch_id: batchId,
    answers: items.map(({ source_id, answer }) => ({ source_id, answer })),
  });
}

writeJson(path.join(OUT_DIR, 'cleaned_questions_with_answers.json'), {
  source_file: path.basename(SOURCE),
  total_questions: cleaned.length,
  questions: cleaned.map(({ cleaning_notes, ...item }) => item),
});

writeJson(path.join(OUT_DIR, 'cleaning_notes.json'), {
  total_notes: cleaningNotes.length,
  notes: cleaningNotes,
});

console.log(`Prepared ${cleaned.length} questions in ${Math.ceil(cleaned.length / BATCH_SIZE)} batches.`);
console.log(`Output: ${OUT_DIR}`);
