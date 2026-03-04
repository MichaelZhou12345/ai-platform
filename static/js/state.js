// ==================== 全局状态管理 ====================

// 全局状态变量
let currentUser = null;
let currentTab = 'team';
let currentTeamView = 'list'; // list, card, mindmap
let teamObjectivesData = null; // 缓存团队OKR数据
let teamProgressDataCache = {}; // 缓存团队进展数据 {source_kr_id: {user_eng_name: {...}}}
let personalObjectivesData = null; // 缓存个人OKR数据
let krClaimsCache = null; // 缓存KR认领数据
let currentAIKrId = null;
let currentAIDraft = '';
let currentEditingWeeklyProgressId = null; // 当前正在编辑的周进展ID
let mindMapKeyboardEnabled = false; // 键盘移动状态
let currentImageUploadTarget = null; // 当前图片上传目标

