# 跨境电商五级冲刺训练项目

这是一个可直接上传到 GitHub Pages 托管的纯静态练习项目。

- `index.html`：训练入口页，可选择精选选择题或简答/实操题。
- `quiz.html`：读取 `qxueyou_refined_practice_questions.json`，支持即时判分、错题解析、分类筛选、随机练习、错题本和收藏。
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
