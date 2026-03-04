# 需求文档

## 引言
本项目旨在为团队开发一个完整的OKR（Objectives and Key Results）管理系统，支持团队级别和个人级别的OKR设定、认领、进展跟踪以及待办事项管理。系统需要实现权限控制、数据持久化、Markdown渲染、AI辅助填写等功能，为团队提供一个高效的目标管理工具。

## 需求

### 需求 1：用户身份认证与权限管理

**用户故事：** 作为系统用户，我希望系统能够自动识别我的身份信息，以便根据我的权限展示和操作相应的功能。

#### 验收标准

1. WHEN 用户访问系统 THEN 系统 SHALL 调用 `/ts:auth/tauth/info.ashx` 接口获取用户信息
2. WHEN 用户信息获取成功 THEN 系统 SHALL 显示用户的中文名称和头像（使用 `https://r.hrc.woa.com/photo/150/${EngName}.png?default_when_absent=true` 格式）
3. IF 当前用户的 EngName 为 "josephpan" THEN 系统 SHALL 在团队OKR tab中显示编辑权限
4. IF 当前用户的 EngName 不是 "josephpan" THEN 系统 SHALL 在团队OKR tab中仅显示查看和认领权限

### 需求 2：团队OKR管理

**用户故事：** 作为团队管理者（josephpan），我希望能够设定团队级别的OKR，以便为团队成员提供明确的目标方向。

#### 验收标准

1. WHEN josephpan 访问团队OKR tab THEN 系统 SHALL 显示"添加Objective"按钮
2. WHEN josephpan 点击"添加Objective" THEN 系统 SHALL 弹出表单允许输入Objective内容
3. WHEN josephpan 添加Objective后 THEN 系统 SHALL 支持为该Objective添加多个Key Results
4. WHEN 任何用户查看团队OKR THEN 系统 SHALL 显示所有已设定的Objectives和Key Results
5. WHEN 用户点击某个KR的"认领"按钮 THEN 系统 SHALL 将该KR及其所属O添加到该用户的个人OKR中
6. WHEN KR被认领后 THEN 系统 SHALL 在团队OKR中标记该KR的认领状态和认领人信息

### 需求 3：个人OKR管理

**用户故事：** 作为团队成员，我希望能够管理自己的OKR，包括从团队认领的和自己创建的，以便清晰地跟踪个人目标。

#### 验收标准

1. WHEN 用户访问个人OKR tab THEN 系统 SHALL 显示该用户的所有OKR（包括认领的和自建的）
2. WHEN 用户从团队OKR认领KR THEN 系统 SHALL 自动将对应的O和KR添加到个人OKR中
3. IF 个人OKR中已存在相同的O THEN 系统 SHALL 仅添加新的KR，避免O重复
4. WHEN 用户查看个人OKR中的O或KR THEN 系统 SHALL 显示其来源标识（团队认领/自建）
5. WHEN 用户点击来源标识 THEN 系统 SHALL 跳转到团队OKR tab并定位到对应项
6. WHEN 用户点击O或KR的文字 THEN 系统 SHALL 允许用户进行二次编辑
7. WHEN 用户保存编辑后 THEN 系统 SHALL 更新数据库中的内容

### 需求 4：KR进展跟踪

**用户故事：** 作为团队成员，我希望能够记录每个KR的周进展和整体进展，以便清晰地展示工作成果。

#### 验收标准

1. WHEN 用户展开某个KR THEN 系统 SHALL 显示"周进展"和"整体进展"两个输入区域
2. WHEN 用户在进展区域输入内容 THEN 系统 SHALL 支持Markdown语法
3. WHEN 用户保存进展内容 THEN 系统 SHALL 以Markdown格式渲染显示
4. WHEN 用户在进展中插入图片 THEN 系统 SHALL 支持图片的显示和渲染
5. WHEN 用户保存进展 THEN 系统 SHALL 记录填写时间和填写人信息

### 需求 5：AI辅助填写整体进展

**用户故事：** 作为团队成员，我希望系统能够根据我的周进展自动生成整体进展草稿，以便提高填写效率。

#### 验收标准

1. WHEN 用户点击整体进展区域的"AI填写"按钮 THEN 系统 SHALL 收集该KR的所有周进展和当前整体进展
2. WHEN 系统收集完数据 THEN 系统 SHALL 调用AI接口生成新的整体进展草稿
3. WHEN AI生成完成 THEN 系统 SHALL 弹出确认对话框显示草稿内容
4. WHEN 用户点击"确认更新"按钮 THEN 系统 SHALL 用新草稿覆盖当前的整体进展
5. WHEN 用户点击"取消"按钮 THEN 系统 SHALL 关闭对话框，保持原内容不变

### 需求 6：团队OKR进展汇总

**用户故事：** 作为团队管理者，我希望在团队OKR tab中看到所有成员的填写情况，以便了解整体进展。

#### 验收标准

1. WHEN 用户访问团队OKR tab THEN 系统 SHALL 显示所有成员填写的OKR进展
2. WHEN 显示进展条目 THEN 系统 SHALL 包含填写人、填写时间、周进展、整体进展四个信息
3. WHEN 用户查看某个进展条目 THEN 系统 SHALL 在该条目旁显示"创建待办"按钮
4. WHEN 用户点击"创建待办"按钮 THEN 系统 SHALL 弹出待办填写表单
5. WHEN 用户填写待办内容并保存 THEN 系统 SHALL 自动将该进展的填写人设置为待办的跟进人
6. WHEN 待办创建成功 THEN 系统 SHALL 将待办添加到待办tab中

### 需求 7：待办事项管理

**用户故事：** 作为团队成员，我希望能够管理所有待办事项，包括查看、更新进展和标记完成状态，以便跟踪任务执行情况。

#### 验收标准

1. WHEN 用户访问待办tab THEN 系统 SHALL 显示所有待办事项列表
2. WHEN 用户查看待办列表 THEN 系统 SHALL 显示待办标题、跟进人、创建时间、状态等信息
3. WHEN 用户点击某个待办 THEN 系统 SHALL 展开显示详细信息和进展记录
4. WHEN 用户在待办中添加进展 THEN 系统 SHALL 保存进展内容和时间
5. WHEN 用户点击"标记完成"按钮 THEN 系统 SHALL 更新待办状态为已完成
6. WHEN 用户使用搜索功能 THEN 系统 SHALL 根据关键词过滤待办列表
7. WHEN 用户使用过滤功能 THEN 系统 SHALL 支持按状态、跟进人等条件过滤
8. WHEN 用户使用排序功能 THEN 系统 SHALL 支持按创建时间、更新时间等排序

### 需求 8：数据持久化

**用户故事：** 作为系统用户，我希望所有数据能够持久化保存，以便随时查看和更新历史记录。

#### 验收标准

1. WHEN 用户创建或编辑OKR THEN 系统 SHALL 将数据保存到MySQL数据库
2. WHEN 用户添加进展或待办 THEN 系统 SHALL 将数据保存到MySQL数据库
3. WHEN 用户刷新页面 THEN 系统 SHALL 从数据库加载所有历史数据
4. IF 数据库连接失败 THEN 系统 SHALL 显示友好的错误提示
5. WHEN 多个用户同时操作 THEN 系统 SHALL 确保数据一致性

### 需求 9：响应式设计与用户体验

**用户故事：** 作为系统用户，我希望系统界面美观、操作流畅，在不同设备上都能良好展示。

#### 验收标准

1. WHEN 用户在桌面端访问 THEN 系统 SHALL 以多列布局展示内容
2. WHEN 用户在移动端访问 THEN 系统 SHALL 自适应为单列布局
3. WHEN 用户进行操作 THEN 系统 SHALL 提供即时的视觉反馈（加载动画、成功提示等）
4. WHEN 用户查看长内容 THEN 系统 SHALL 提供合理的滚动和折叠机制
5. WHEN 系统渲染Markdown内容 THEN 系统 SHALL 保持良好的排版和可读性
