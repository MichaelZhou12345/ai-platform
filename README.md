# AI 组织系统开源版

## 0. 项目说明

用 AI 的思维组织团队。本项目用于日常团队 OKR 推进及周报生成，其特性如下：

1. **OKR 保持聚焦对齐**。leader 定了 OKR 后，团队小伙伴们一键认领自己的KR，认领完的 KR 会出现在个人视图里。每周周会前，在个人 OKR 视图里使用 markdown 语法填写自己认领的需求的进展，进展会同步到团队 OKR 进展里。再也不用担心和别人一起写同个企微文档导致页面跳来跳去了；
2. **演讲者模式**。专门针对开会设计的演讲者模式，文字拉大，画幅拉满，聚焦每个人做的事情，风险问题自动高亮显示，开会过程中支持随时记录待办，待办会沉淀到一个专门的 tab（后面会介绍）。开完会支持把会议材料一键导出成专门针对邮件排版优化的 HTML ，贴到邮箱发周报。
3. **知彼解己**。聚合查看团队每个人的下周计划，了解每个人的工作安排和任务优先级，促进团队协作和资源协调。
4. **以终为始**。所有的待办沉淀到这里，从目标出发，确保每项任务都朝着既定方向前进，实现高效的任务执行和成果交付。
5. **集思广益**。随时记录和管理创意想法，周会前想讨论的议题也可以在这里收集，还可以将想法转化为具体待办事项。
6. **统合综效**。汇集和管理各类常用平台、工具和资源，提供便捷的分类搜索功能，整合内外部资源，提升工作效率，实现协同增效。日常团队成员们为需求 vibe coding 的一些测评工具、效果评测平台等也会汇总到这里。
7. **不断更新**。AI 自动收集整理的一些 AI 相关的新闻、新模型进展以及论文。保持学习，紧跟 AI 技术，持续提升自己。
8. **文化牵引**。是的，被你猜中了，这些功能的设计充分结合了《高效能人士的七个习惯》的思想，希望团队的小伙伴们都能给自己的大脑组装上高效能的思维，让自己的职场生涯少走点歪路。
9. **AI Everywhere**。 除了整个站点是 AI 构建的之外，还有一个常驻的 AI 助手，可以随时呼出出来询问这个站点的任何历史数据，比如有哪些我需要关注的风险，某个项目的进展，还支持增加 QPilot 助手作为子 Agent ，实现诸如 QQ 版本节奏、bug 查询的功能。你甚至可以让 AI 帮你结合 OKR 进展填写考核自评。另外，还提供配套 Skill ，可以跟 OpenClaw、Claude Code 等更多 AI 项目连接。
10. **内部开源**。为此我专门做了不少通用性适配改造。

## 1. 快速上手

> 注意：出于安全考虑，with 导入工蜂代码仓库已经不再支持实时预览和一键发布了。如果找不到发布入口，可联系本人 josephpan 拉群支持。

1. 访问这个项目的 [工蜂仓库](https://git.woa.com/josephpan/ai-org) ，fork 这个仓库。
2. 访问 [with.woa.com](https://with.woa.com/) 
3. 打开代码仓库，选择导入你刚刚 fork 的那个 ai-org 项目。
  ![image#676px #184px](https://wdoc-76491.picgzc.qpic.cn/MTY4ODg1MDUyMjYzMjk4Mw_779184_QQBeUf0cAkIul53O_1769014751?w=2280&h=618&type=image/png)
4. 在导入后的项目的对话框里，输入以下指令：

  > 使用 schema.sql 创建数据库表结构并初始化基础数据，并把 config.yml 里的数据库配置替换为刚创建的数据库配置。

  耐心等待数据库完成初始化。
5. 修改根目录下的 config.yml，把管理员改为你自己。
  ![image#627px #428px](https://wdoc-76491.picgzc.qpic.cn/MTY4ODg1MDUyMjYzMjk4Mw_58461_fukjJpozE1yLcaLp_1769012240?w=2280&h=774&type=image/png)
6. 全屏预览，点击右上角你的头像 -> 设置，在设置弹窗底下，导入如下 json 文件配置：[ai_org_init_config.json](https://iwiki.woa.com/tencent/api/attachments/s3/url?attachmentid=40794948)
7. 去 [QPilot](https://qpilot.woa.com/settings/api) 里申请一个 API Key，然后填写到设置 -> AI 配置 -> 主 Agent 配置里的 API-Key 里。
  ![image#638px #422px](https://wdoc-76491.picgzc.qpic.cn/MTY4ODg1MDUyMjYzMjk4Mw_735042_zSSiBIae3hOLhlbb_1769012675?w=2280&h=1454&type=image/png)
8. 配置完成，就可以发布到测试环境给团队的小伙伴们用起来啦
9. Happy Hacking！

## 2. 如何获得更新

with 一旦 fork 出去后就跟原仓库不再同步了。不过，我们依然可以换个法子实现更新功能 —— 让 AI 来合并补丁。

后续如果有更新，补丁将持续发布到项目 [更新说明](https://iwiki.woa.com/p/4018145410)，你可以根据需要下载相应的补丁文件，并贴到 with 里让 AI 帮你合并。query 示例：

![image.png#276px #319px](https://iwiki.woa.com/tencent/api/attachments/s3/url?attachmentid=40747584)

## 3. 如何绑定 OpenClaw

如果希望你的 OpenClaw 能够打通这个平台，实现对平台里诸如查询团队OKR、个人OKR、进展记录、待办事项、周报等数据的问询，你可以导入 okr-sql-query 这个技能。

![效果示例](https://iwiki.woa.com/tencent/api/attachments/s3/url?attachmentid=40750607)

1. 如果是内网版 OpenClaw： 
如果是[内网版 OpenClaw](https://openclaw.woa.com/) ，你可以从 Knot 里导入[okr-sql-query](https://knot.woa.com/skills/detail/1494) ：
  ![image.3.png](https://iwiki.woa.com/tencent/api/attachments/s3/url?attachmentid=40750507)
2. 如果是其他版本 OpenClaw
如果是自建的 OpenClaw ，你可以直接下载 [okr-sql-query.zip](https://iwiki.woa.com/tencent/api/attachments/s3/url?attachmentid=40750532) 并解压到 OpenClaw 的工作目录。

完成后需要 config.yml 里的数据库相应配置也配到 OpenClaw 的 gateway 变量中，示例：
  ![image.2.png](https://iwiki.woa.com/tencent/api/attachments/s3/url?attachmentid=40750340)
# ai-
