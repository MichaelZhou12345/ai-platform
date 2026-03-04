# 实施计划

## 任务清单

- [ ] 1. 创建数据库并设计表结构
   - 使用MCP工具创建MySQL数据库（wqdcw2vp）
   - 设计并创建团队OKR表（objectives, key_results）
   - 设计并创建个人OKR表（user_objectives, user_key_results）
   - 设计并创建进展记录表（weekly_progress, overall_progress）
   - 设计并创建待办事项表（todos, todo_progress）
   - 设计并创建认领关系表（kr_claims）
   - _需求：8.1, 8.2_

- [ ] 2. 搭建后端服务架构
   - 创建Python FastAPI后端项目结构
   - 配置数据库连接（通过环境变量）
   - 实现数据库连接池和错误处理
   - 创建requirements.txt和Dockerfile
   - _需求：8.1, 8.4_

- [ ] 3. 实现用户认证与权限管理API
   - 创建用户信息获取接口（代理/ts:auth/tauth/info.ashx）
   - 实现权限验证中间件（区分josephpan和普通用户）
   - 实现用户头像URL生成逻辑
   - _需求：1.1, 1.2, 1.3, 1.4_

- [ ] 4. 实现团队OKR管理API
   - 创建团队Objective的增删改查接口
   - 创建团队Key Result的增删改查接口
   - 实现KR认领接口（记录认领人和时间）
   - 实现团队OKR列表查询接口（包含认领状态）
   - _需求：2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 5. 实现个人OKR管理API
   - 创建个人OKR查询接口（包含来源标识）
   - 实现个人O和KR的编辑接口
   - 实现O去重逻辑（认领时自动合并）
   - 实现跨tab跳转定位数据接口
   - _需求：3.1, 3.2, 3.3, 3.4, 3.6, 3.7_

- [ ] 6. 实现进展跟踪API
   - 创建周进展的增删改查接口
   - 创建整体进展的增删改查接口
   - 实现进展记录的时间戳和填写人记录
   - 实现团队进展汇总查询接口
   - _需求：4.1, 4.5, 6.1, 6.2_

- [ ] 7. 实现AI辅助填写功能（模拟）
   - 创建AI生成整体进展接口
   - 实现基于周进展和历史整体进展的内容汇总逻辑
   - 返回草稿供前端确认
   - _需求：5.1, 5.2, 5.3_

- [ ] 8. 实现待办事项管理API
   - 创建待办的增删改查接口
   - 实现待办进展追加接口
   - 实现待办状态更新接口
   - 实现搜索、过滤、排序功能
   - _需求：6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [ ] 9. 开发前端页面结构
   - 创建HTML主页面（index.html）
   - 实现Tab切换组件（团队OKR、个人OKR、待办）
   - 实现用户信息展示组件（头像、姓名）
   - 集成Tailwind CSS样式框架
   - 集成Markdown渲染库（marked.js）
   - _需求：9.1, 9.2, 9.3_

- [ ] 10. 实现团队OKR前端功能
   - 实现团队OKR列表展示（O和KR树形结构）
   - 实现josephpan的添加/编辑功能（弹窗表单）
   - 实现KR认领按钮和交互
   - 实现认领状态标记显示
   - 实现团队进展汇总展示
   - 实现"创建待办"按钮和弹窗
   - _需求：2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 11. 实现个人OKR前端功能
   - 实现个人OKR列表展示（包含来源标识）
   - 实现O和KR文字的二次编辑功能
   - 实现来源标识点击跳转功能
   - 实现周进展和整体进展的输入和展示
   - 集成Markdown编辑器和渲染器
   - 实现图片上传和显示功能
   - 实现"AI填写"按钮和确认弹窗
   - _需求：3.1, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 5.1, 5.3, 5.4, 5.5_

- [ ] 12. 实现待办事项前端功能
   - 实现待办列表展示（表格或卡片形式）
   - 实现待办详情展开和折叠
   - 实现进展追加输入框
   - 实现完成状态切换按钮
   - 实现搜索框和过滤器
   - 实现排序功能
   - _需求：7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [ ] 13. 实现响应式设计和用户体验优化
   - 实现桌面端多列布局
   - 实现移动端自适应单列布局
   - 添加加载动画和成功提示
   - 优化长内容的滚动和折叠
   - 优化Markdown渲染样式
   - 添加错误提示和友好的错误处理
   - _需求：9.1, 9.2, 9.3, 9.4, 9.5, 8.4_

- [ ] 14. 集成前后端并测试
   - 配置FastAPI静态文件服务（mount到/static）
   - 确保前端API调用路径正确
   - 测试所有功能流程
   - 修复bug和优化性能
   - _需求：所有需求的集成测试_

## 技术栈说明

### 后端
- **框架**: Python + FastAPI
- **数据库**: MySQL（wqdcw2vp）
- **部署**: Docker + Uvicorn

### 前端
- **架构**: 纯静态页面（HTML + CSS + JavaScript）
- **样式**: Tailwind CSS（CDN）
- **Markdown**: marked.js（CDN）
- **图标**: Heroicons（CDN）

## 数据库表设计概要

1. **objectives** - 团队目标表
   - id, title, description, created_by, created_at, updated_at

2. **key_results** - 团队关键结果表
   - id, objective_id, title, description, created_at, updated_at

3. **kr_claims** - KR认领关系表
   - id, kr_id, objective_id, user_eng_name, user_chn_name, claimed_at

4. **user_objectives** - 个人目标表
   - id, user_eng_name, title, description, source_type, source_id, created_at, updated_at

5. **user_key_results** - 个人关键结果表
   - id, user_objective_id, user_eng_name, title, description, source_type, source_kr_id, created_at, updated_at

6. **weekly_progress** - 周进展表
   - id, kr_id, user_eng_name, user_chn_name, content, created_at

7. **overall_progress** - 整体进展表
   - id, kr_id, user_eng_name, user_chn_name, content, updated_at

8. **todos** - 待办事项表
   - id, title, description, assignee_eng_name, assignee_chn_name, status, created_by, created_at, updated_at

9. **todo_progress** - 待办进展表
   - id, todo_id, content, created_by, created_at

## 实施顺序说明

任务按照以下顺序执行，确保依赖关系清晰：
1. 先搭建数据库和后端基础架构（任务1-2）
2. 再实现各模块的后端API（任务3-8）
3. 然后开发前端页面和组件（任务9-12）
4. 最后进行响应式优化和集成测试（任务13-14）
