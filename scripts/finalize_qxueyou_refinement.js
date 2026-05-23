const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WORK_DIR = path.join(ROOT, 'refinement_work');
const INPUT_DIR = path.join(WORK_DIR, 'worker_outputs');
const OUTPUT = path.join(ROOT, 'qxueyou_refined_practice_questions.json');
const REPORT = path.join(WORK_DIR, 'refinement_report.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[（）()。.,，、；;:：“”"'‘’!?！？]/g, '');
}

function duplicateKey(item) {
  const question = normalizeText(item.question);
  if (question.length >= 18) return `q:${question}`;
  return `kp:${normalizeText(item.category)}:${normalizeText(item.knowledge_point)}:${normalizeText(item.pitfall)}`;
}

function inferCategory(question, reason) {
  const text = `${question || ''}${reason || ''}`;
  if (/物流|运费|发货|仓储|库存|配送|货代/.test(text)) return '物流与履约';
  if (/支付|收款|结算|退款|汇率|资金|融资/.test(text)) return '支付与资金';
  if (/SEO|搜索|关键词|标题|流量|广告|推广|营销|转化/.test(text)) return '搜索与营销';
  if (/数据|分析|指标|转化率|点击率|客单价|报表/.test(text)) return '数据分析';
  if (/客服|投诉|售后|询盘|沟通|评价/.test(text)) return '客服与售后';
  if (/平台|规则|店铺|商品|上架|详情页|SKU|类目/.test(text)) return '平台运营';
  if (/海关|税|合规|营业执照|电子合同|数字证书|安全|隐私/.test(text)) return '法规与安全';
  return '综合考点';
}

function inferKnowledgePoint(question, reason) {
  const text = String(reason || '').trim();
  if (text) return text.replace(/[。.]$/, '').slice(0, 48);
  return String(question || '').replace(/[。（(].*$/, '').slice(0, 48);
}

function score(item) {
  const value = Number(item.value_score || 0);
  const confidencePenalty = Number(item.confidence || 1) < 0.75 ? 0.5 : 0;
  const trapBonus = Array.isArray(item.trap_type) ? Math.min(item.trap_type.length * 0.1, 0.3) : 0;
  return value + confidencePenalty + trapBonus;
}

const files = fs
  .readdirSync(INPUT_DIR)
  .filter((file) => /^batch_\d+_candidates\.json$/.test(file))
  .sort();

if (!files.length) {
  throw new Error(`No worker candidate files found in ${INPUT_DIR}`);
}

const all = [];
const batchStats = [];

for (const file of files) {
  const data = readJson(path.join(INPUT_DIR, file));
  const questions = Array.isArray(data.questions)
    ? data.questions
    : Array.isArray(data.candidates)
      ? data.candidates
      : [];
  batchStats.push({
    file,
    batch_id: data.batch_id,
    reviewed_count: data.reviewed_count,
    selected_count: questions.length,
    declared_selected_count: data.selected_count || data.kept_count,
  });
  for (const item of questions) {
    const keepReason = item.why_keep || item.keep_reason || item.reason || '';
    all.push({
      source_id: item.source_id,
      category: item.category || inferCategory(item.question, keepReason),
      knowledge_point: item.knowledge_point || inferKnowledgePoint(item.question, keepReason),
      trap_type: Array.isArray(item.trap_type) ? item.trap_type : [],
      question: item.question,
      options: item.options || {},
      answer: item.answer,
      pitfall: item.pitfall || keepReason,
      memory_tip: item.memory_tip || '',
      value_score: Number(item.value_score || 4),
      why_keep: keepReason,
      predicted_answer: item.predicted_answer || null,
      confidence: typeof item.confidence === 'number' ? item.confidence : null,
    });
  }
}

const keptByKey = new Map();
const droppedDuplicates = [];

for (const item of all.sort((a, b) => score(b) - score(a))) {
  const key = duplicateKey(item);
  if (!keptByKey.has(key)) {
    keptByKey.set(key, item);
    continue;
  }

  droppedDuplicates.push({
    source_id: item.source_id,
    duplicate_of: keptByKey.get(key).source_id,
    reason: '题干或知识点高度相近，保留价值评分更高或更完整的一题。',
  });
}

const questions = Array.from(keptByKey.values()).sort((a, b) => {
  if (a.category !== b.category) return a.category.localeCompare(b.category, 'zh-Hans-CN');
  if (a.knowledge_point !== b.knowledge_point) return a.knowledge_point.localeCompare(b.knowledge_point, 'zh-Hans-CN');
  return Number(a.source_id) - Number(b.source_id);
});

writeJson(OUTPUT, {
  metadata: {
    source_file: '../01-拼音检索全部选择题项目/qxueyou_targeted_practice_questions.json',
    selection_policy:
      '保留易错、陷阱、专业、概念边界和高频操作流程题；剔除纯常识、明显判断和重复弱题。',
    total_source_questions: 1218,
    total_candidates_before_dedupe: all.length,
    total_selected: questions.length,
  },
  questions,
  dropped_duplicates: droppedDuplicates,
});

writeJson(REPORT, {
  batch_stats: batchStats,
  total_candidates_before_dedupe: all.length,
  total_selected: questions.length,
  dropped_duplicate_count: droppedDuplicates.length,
});

console.log(`Read ${files.length} candidate files.`);
console.log(`Candidates before dedupe: ${all.length}`);
console.log(`Final selected: ${questions.length}`);
console.log(`Wrote ${OUTPUT}`);
