# 跨境电商五级冲刺训练项目

这是一个可直接上传到 GitHub Pages 或 Cloudflare Pages 托管的练习项目。选择题、简答题页面不需要登录即可使用；如果发布到 Cloudflare Pages，并绑定 D1 数据库，还可以把匿名作答统计汇总到你的后台。

- `index.html`：训练入口页，可选择精选选择题或简答/实操题。
- `quiz.html`：选择题训练入口，支持全量、精简、极简三档训练。
- `full_questions.json`：1218 道原始全量题，保留题干、选项和答案。
- `qxueyou_refined_practice_questions.json`：373 道精简题，带分类、错因解析和记忆提示。
- `ultra_questions.json`：88 道极简题，从精简题继续提炼，保留高质量考点并纳入已知错题。
- `skip.html`：直接跳过时展示的考前祝福页。
- `short-answer.html`：根据“题目答案汇总”整理的互动式简答/实操练习。
- `analytics.html`：你自己的匿名统计看板，需要 Cloudflare 环境变量 `ADMIN_TOKEN` 才能读取数据。
- `functions/api/*`：Cloudflare Pages Functions，用于接收作答、收藏，输出公开收藏数和后台统计。
- `migrations/0001_analytics.sql`：Cloudflare D1 数据表。
- `server.js`：本地预览服务，便于浏览器读取 JSON 数据。

本地预览：

```bash
npm start
```

打开：

```text
http://localhost:4173
```

GitHub Pages 托管时，把本目录作为站点根目录即可；GitHub Pages 不支持本项目的云端统计接口，练习功能仍正常。

Cloudflare Pages 发布建议：

- Framework preset：`None`
- Build command：留空
- Build output directory：`/`
- Root directory：仓库根目录

## 云端统计

Cloudflare Pages 可以继续托管静态页面，同时用 Pages Functions + D1 收集匿名汇总数据。用户不需要登录；前端只上传匿名浏览器编号、题号、训练模式、选择项、正确与否、收藏状态，不上传个人身份信息。

推荐配置：

1. 在 Cloudflare 创建 D1 数据库，例如 `cross-border-exam-analytics`。
2. 执行迁移：

```bash
npx wrangler d1 migrations apply cross-border-exam-analytics --remote
```

3. 在 Cloudflare Pages 项目里添加 D1 binding：

```text
Variable name: DB
D1 database: cross-border-exam-analytics
```

4. 在 Cloudflare Pages 项目里添加环境变量：

```text
ADMIN_TOKEN=你自己设置的一串后台口令
```

5. 重新部署。部署后打开：

```text
https://你的域名/analytics.html
```

输入 `ADMIN_TOKEN` 即可查看高错率题、收藏排行和分类概览。普通用户在练习页能看到每道题的全站匿名收藏数；没有配置 D1 时，练习页面仍会正常使用，只是统计不会写入云端，收藏数也不会从云端更新。

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
