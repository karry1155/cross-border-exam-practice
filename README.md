# 跨境电商五级冲刺训练项目

这是一个可直接上传到 GitHub Pages 托管的纯静态练习项目。

- `index.html`：训练入口页，可选择精选选择题或简答/实操题。
- `quiz.html`：选择题训练入口，支持全量、精简、极简三档训练。
- `full_questions.json`：1218 道原始全量题，保留题干、选项和答案。
- `qxueyou_refined_practice_questions.json`：373 道精简题，带分类、错因解析和记忆提示。
- `ultra_questions.json`：112 道极简题，从精简题继续提炼，部分题已压平“三短一长”选项长度诱导。
- `skip.html`：直接跳过时展示的考前祝福页。
- `short-answer.html`：根据“题目答案汇总”整理的互动式简答/实操练习。
- `server.js`：本地预览服务，便于浏览器读取 JSON 数据。

本地预览：

```bash
npm start
```

打开：

```text
http://localhost:4173
```

GitHub Pages 托管时，把本目录作为站点根目录即可。

Cloudflare Pages 发布建议：

- Framework preset：`None`
- Build command：留空
- Build output directory：`/`
- Root directory：仓库根目录

## 回退点

本次训练模式改造前的线上版本已打标签：

```text
before-training-modes-20260524
```

## 题库精炼来源

本项目也保留了从全部选择题题库中筛出重点练习题的过程文件。

- 输入来源：`../01-拼音检索全部选择题项目/qxueyou_targeted_practice_questions.json`
- 输出结果：`qxueyou_refined_practice_questions.json`
- 过程文件：`refinement_work/`

脚本：

```bash
node scripts/prepare_qxueyou_refinement.js
node scripts/finalize_qxueyou_refinement.js
```
