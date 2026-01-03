/**
 * ClipFlow - Smart Clipboard Manager
 * Modular State Management and UI Rendering
 */

// ============================================================================
// Constants
// ============================================================================
const STORAGE_KEY = 'clipflow_notes_v3';
const CAT_STORAGE_KEY = 'clipflow_categories_v2';

// 标签ID生成器
let tagIdCounter = 1;
function generateTagId() {
    return `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 将旧格式的树形结构转换为带ID的新格式
function convertTreeToIdFormat(tree, parentId = null) {
    const result = {};
    Object.keys(tree).forEach(key => {
        const tagId = generateTagId();
        result[tagId] = {
            id: tagId,
            name: key,
            parentId: parentId,
            children: convertTreeToIdFormat(tree[key], tagId)
        };
    });
    return result;
}

// 递归扫描 categories 树，生成全局 tagMap 索引表
function buildTagMap(categories, tagMap = {}) {
    Object.keys(categories).forEach(tagId => {
        const tag = categories[tagId];
        if (tag && tag.id) {
            // 只存储必要信息，避免循环引用
            tagMap[tagId] = {
                id: tag.id,
                name: tag.name,
                parentId: tag.parentId || null
            };
            // 递归处理子节点
            if (tag.children && Object.keys(tag.children).length > 0) {
                buildTagMap(tag.children, tagMap);
            }
        }
    });
    return tagMap;
}

// 根据ID在树中查找标签节点（用于获取完整节点，包含children）
function findTagById(categories, tagId) {
    if (!tagId) return null; // 空值检查
    for (const id in categories) {
        if (id === tagId) {
            return categories[id];
        }
        const found = findTagById(categories[id].children || {}, tagId);
        if (found) return found;
    }
    return null;
}

// 根据ID获取完整路径（面包屑）- 使用 tagMap，性能优化
function getBreadcrumbPath(tagMap, tagId) {
    if (!tagMap || !tagId || !tagMap[tagId]) {
        return null; // 空值检查，防止页面空白
    }
    
    const path = [];
    let currentId = tagId;
    
    // 向上追溯父级，直到根节点
    while (currentId && tagMap[currentId]) {
        const tag = tagMap[currentId];
        path.unshift(tag.name);
        currentId = tag.parentId;
    }
    
    return path.length > 0 ? path.join(' / ') : null;
}

// 根据路径字符串查找对应的ID（用于数据迁移）
function findTagIdByPath(categories, path) {
    const parts = path.split('/');
    let current = categories;
    let tagId = null;
    
    for (const part of parts) {
        let found = null;
        for (const id in current) {
            if (current[id].name === part) {
                found = current[id];
                tagId = id;
                break;
            }
        }
        if (!found) return null;
        current = found.children || {};
    }
    
    return tagId;
}

// Default Data - 树形结构（带ID）
const defaultCategoriesTree = {
    "时间": { 
        "早上": {}, 
        "中午": {}, 
        "下午": {},
        "晚上": {}
    },
    "场景": { 
        "商店街": {}, 
        "学校": {}, 
        "家": {},
        "公园": {},
        "咖啡厅": {}
    },
    "好感度": {
        "0~20": {},
        "21~40": {},
        "41~60": {},
        "61~80": {},
        "81~100": {}
    },
    "Work": {
        "项目": {},
        "会议": {},
        "文档": {}
    },
    "Code": {
        "前端": {},
        "后端": {},
        "数据库": {}
    }
};

// 初始化时转换为ID格式
const defaultCategories = convertTreeToIdFormat(defaultCategoriesTree);

// 获取默认标签ID（用于默认笔记）
let defaultTagIds = {};
function getDefaultTagId(path) {
    if (!defaultTagIds[path]) {
        // 临时生成，实际使用时会在数据迁移中处理
        defaultTagIds[path] = generateTagId();
    }
    return defaultTagIds[path];
}

const defaultNotes = [
    {
        id: 1,
        content: "Tailwind CSS is a utility-first CSS framework packed with classes like flex, pt-4, text-center and rotate-90.",
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        expanded: false,
        categories: [] // 将在数据迁移中处理
    },
    {
        id: 2,
        content: "Design is not just what it looks like and feels like. Design is how it works.",
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        expanded: false,
        categories: [] // 将在数据迁移中处理
    }
];

// ============================================================================
// Storage Module - localStorage 读写管理
// ============================================================================
const Storage = {
    /**
     * 从 localStorage 加载笔记数据（支持数据迁移）
     * @param {Object} categories - 可选的分类数据，用于数据迁移（避免循环依赖）
     * @returns {Array} 笔记数组
     */
    loadNotes(categories = null) {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            let loaded = stored ? JSON.parse(stored) : defaultNotes;
            
            // 确保 loaded 是数组
            if (!Array.isArray(loaded)) {
                console.warn('Loaded notes is not an array, using default notes');
                loaded = defaultNotes;
            }
            
            // 数据迁移：将路径字符串转换为ID
            // 如果 categories 未提供，则加载（但要避免循环依赖）
            const catData = categories || this.loadCategories();
            
            const migrated = loaded.map((note, index) => {
                // 确保 note 是对象
                if (!note || typeof note !== 'object') {
                    console.warn(`Invalid note at index ${index}, skipping`);
                    return null;
                }
                
                // 确保有必要的字段
                if (!note.id) {
                    note.id = Date.now() + index;
                }
                if (!note.content) {
                    note.content = '';
                }
                if (!note.date) {
                    note.date = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                if (note.expanded === undefined) {
                    note.expanded = false;
                }
                
                // 处理 categories 字段
                if (!Array.isArray(note.categories)) {
                    note.categories = note.category ? [note.category] : [];
                }
                
                // 检查是否需要迁移（如果categories包含路径字符串而不是ID）
                const needsMigration = note.categories.some(cat => 
                    typeof cat === 'string' && (cat.includes('/') || !cat.startsWith('tag_'))
                );
                
                if (needsMigration && catData) {
                    note.categories = note.categories.map(cat => {
                        if (typeof cat === 'string' && (cat.includes('/') || !cat.startsWith('tag_'))) {
                            // 这是路径字符串，需要转换为ID
                            const tagId = findTagIdByPath(catData, cat);
                            return tagId || null; // 如果找不到，返回null，后续会被过滤
                        }
                        return cat; // 已经是ID，直接返回
                    }).filter(Boolean); // 过滤掉null/undefined/空字符串
                }
                
                return note;
            }).filter(Boolean); // 过滤掉无效的笔记
            
            return migrated;
        } catch (e) {
            console.error('Error loading notes:', e);
            return defaultNotes;
        }
    },

    /**
     * 从 localStorage 加载分类数据（树形结构，带ID）
     * @returns {Object} 分类树形对象 { tagId: { id, name, parentId, children } }
     */
    loadCategories() {
        try {
            const stored = localStorage.getItem(CAT_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                
                // 检查是否已经是新格式（包含id字段）
                const isNewFormat = Object.values(parsed).some(item => 
                    item && typeof item === 'object' && item.id
                );
                
                if (isNewFormat) {
                    return parsed; // 已经是新格式，直接返回
                }
                
                // 旧格式：需要转换
                if (Array.isArray(parsed)) {
                    // 数组格式：转换为树形结构
                    const tree = {};
                    parsed.forEach(cat => {
                        if (typeof cat === 'string') {
                            tree[cat] = {};
                        } else if (cat && cat.name) {
                            tree[cat.name] = cat.subOptions ? 
                                Object.fromEntries(cat.subOptions.map(sub => [sub, {}])) : {};
                        }
                    });
                    return convertTreeToIdFormat(tree);
                } else if (typeof parsed === 'object') {
                    // 树形结构但没有ID：添加ID
                    return convertTreeToIdFormat(parsed);
                }
            }
            return defaultCategories;
        } catch (e) {
            return defaultCategories;
        }
    },

    /**
     * 保存笔记数据到 localStorage
     * @param {Array} notes - 笔记数组
     */
    saveNotes(notes) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    },

    /**
     * 保存分类数据到 localStorage
     * @param {Array} categories - 分类数组
     */
    saveCategories(categories) {
        localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(categories));
    }
};

// ============================================================================
// State Module - 应用状态管理
// ============================================================================
const State = {
    // 核心状态
    notes: [], // categories数组存储tag ID
    categories: {}, // 树形结构：{ tagId: { id, name, parentId, children: {} } }
    tagMap: {}, // 🔥 全局索引表：{ tagId: { id, name, parentId } } - 平铺结构，快速查找
    activeFilters: [], // 存储格式：['tagId1', 'tagId2']，空数组表示显示所有
    filterMode: 'OR', // 筛选模式：'OR' 表示任意匹配，'AND' 表示全部匹配
    editingNoteId: null,
    selectedInputTags: [], // 存储格式：['tagId1', 'tagId2']
    tagSearchQuery: '', // Tag搜索查询
    editingTagId: null, // 正在编辑的tag ID
    tagSearchDropdownOpen: false, // 搜索浮层是否打开
    isComposing: false, // 中文输入法组合状态
    currentInputHeight: 'small', // 当前输入框高度: 'small' 或 'large'
    tagSelectPath: [], // tag选择界面的当前路径（存储tagId数组）
    selectedParentTagId: null, // 标签下拉菜单中选中的父级标签ID

    /**
     * 初始化状态（从 Storage 加载）
     */
    init() {
        // 先加载 categories，然后加载 notes（传入 categories 用于数据迁移）
        this.categories = Storage.loadCategories();
        this.notes = Storage.loadNotes(this.categories);
        
        // 🔥 关键：生成全局 tagMap 索引表
        this.rebuildTagMap();
        
        this.activeFilters = [];
        this.filterMode = 'OR'; // 默认使用OR模式
        this.editingNoteId = null;
        this.selectedInputTags = [];
        this.tagSearchQuery = '';
        this.editingTagId = null;
        this.tagSearchDropdownOpen = false;
        this.isComposing = false;
        this.currentInputHeight = 'small';
        this.tagSelectPath = [];
        this.selectedParentTagId = null;
        
        // 保存迁移后的数据（如果数据有变化）
        Storage.saveCategories(this.categories);
        Storage.saveNotes(this.notes);
    },

    /**
     * 🔥 重建全局 tagMap 索引表（在 categories 变化后调用）
     */
    rebuildTagMap() {
        this.tagMap = buildTagMap(this.categories);
    },

    /**
     * 根据ID获取标签的完整路径（面包屑）- 使用 tagMap，性能优化
     * @param {string} tagId - 标签ID
     * @returns {string} 完整路径，如 "场景 / 商店街"
     */
    getTagFullName(tagId) {
        if (!tagId || !this.tagMap[tagId]) {
            return ''; // 空值检查
        }
        return getBreadcrumbPath(this.tagMap, tagId) || '';
    },

    /**
     * 根据ID获取标签名称 - 使用 tagMap，O(1) 查找
     * @param {string} tagId - 标签ID
     * @returns {string} 标签名称
     */
    getTagName(tagId) {
        if (!tagId || !this.tagMap[tagId]) {
            return tagId || ''; // 空值检查
        }
        return this.tagMap[tagId].name;
    },

    /**
     * 根据ID查找标签节点（在树中查找，用于获取 children）
     * @param {string} tagId - 标签ID
     * @returns {Object|null} 标签节点对象
     */
    getTagById(tagId) {
        if (!tagId || !this.tagMap[tagId]) {
            return null; // 空值检查
        }
        // 使用 tagMap 快速定位，然后从树中获取完整节点
        const findInTree = (tree, targetId) => {
            for (const id in tree) {
                if (id === targetId) {
                    return tree[id];
                }
                if (tree[id].children) {
                    const found = findInTree(tree[id].children, targetId);
                    if (found) return found;
                }
            }
            return null;
        };
        return findInTree(this.categories, tagId);
    },

    /**
     * 根据名称查找标签ID（用于搜索）- 使用 tagMap，性能优化
     * @param {string} name - 标签名称
     * @returns {Array} 匹配的标签ID数组
     */
    findTagIdsByName(name) {
        if (!name || !name.trim()) {
            return Object.keys(this.tagMap);
        }
        const query = name.toLowerCase().trim();
        const results = [];
        // 直接遍历 tagMap，O(n) 但比递归快
        Object.keys(this.tagMap).forEach(tagId => {
            const tag = this.tagMap[tagId];
            if (tag && tag.name && tag.name.toLowerCase().includes(query)) {
                results.push(tagId);
            }
        });
        return results;
    },

    /**
     * 获取当前路径下的标签树
     * @returns {Object} 当前路径下的标签树
     */
    getCurrentTagTree() {
        let target = this.categories;
        this.tagSelectPath.forEach(tagId => {
            if (!tagId || !this.tagMap[tagId]) {
                return {}; // 空值检查
            }
            const findInTree = (tree, targetId) => {
                for (const id in tree) {
                    if (id === targetId) {
                        return tree[id];
                    }
                    if (tree[id].children) {
                        const found = findInTree(tree[id].children, targetId);
                        if (found) return found;
                    }
                }
                return null;
            };
            const tag = findInTree(target, tagId);
            if (tag && tag.children) {
                target = tag.children;
            } else {
                target = {};
            }
        });
        return target;
    },

    /**
     * 获取所有父级标签（顶层标签）
     * @returns {Array} 父级标签数组 [{ id, name, ... }]
     */
    getParentTags() {
        return Object.values(this.categories).filter(tag => !tag.parentId);
    },

    /**
     * 检查是否有子标签被选中（用于判断是否显示父标签）
     * @param {string} parentTagId - 父标签ID
     * @returns {boolean} 是否有子标签被选中
     */
    hasActiveChild(parentTagId) {
        const parentTag = this.getTagById(parentTagId);
        if (!parentTag) return false;
        
        // 检查是否有子标签被选中
        const checkChildren = (children) => {
            for (const childId in children) {
                if (this.activeFilters.includes(childId)) {
                    return true;
                }
                if (children[childId].children) {
                    if (checkChildren(children[childId].children)) {
                        return true;
                    }
                }
            }
            return false;
        };
        
        return parentTag.children ? checkChildren(parentTag.children) : false;
    },

    /**
     * 获取父标签下所有被选中的子标签ID
     * @param {string} parentTagId - 父标签ID
     * @returns {Array} 被选中的子标签ID数组
     */
    getActiveChildren(parentTagId) {
        const parentTag = this.getTagById(parentTagId);
        if (!parentTag || !parentTag.children) return [];
        
        const results = [];
        const collectActive = (children) => {
            for (const childId in children) {
                if (this.activeFilters.includes(childId)) {
                    results.push(childId);
                }
                if (children[childId].children) {
                    collectActive(children[childId].children);
                }
            }
        };
        
        collectActive(parentTag.children);
        return results;
    },

    /**
     * 检查是否是父标签被直接选中
     * @param {string} parentTagId - 父标签ID
     * @returns {boolean} 是否父标签被直接选中
     */
    isParentTagActive(parentTagId) {
        return this.activeFilters.includes(parentTagId);
    },

    /**
     * 打开标签选择器（从指定父标签开始）
     * @param {string} parentTagId - 父标签ID
     */
    openTagSelector(parentTagId) {
        this.tagSelectPath = [parentTagId];
    },

    /**
     * 进入标签选择器的子级
     * @param {string} tagId - 子标签ID
     */
    enterTagSelector(tagId) {
        this.tagSelectPath.push(tagId);
    },

    /**
     * 返回到标签选择器的根目录
     */
    goHomeTagSelector() {
        this.tagSelectPath = [];
    },

    /**
     * 跳转到标签选择器的指定路径
     * @param {number} index - 路径索引
     */
    jumpToTagSelector(index) {
        this.tagSelectPath = this.tagSelectPath.slice(0, index + 1);
    },

    /**
     * 在标签选择器中选择标签（切换选中状态）
     * @param {string} tagId - 标签ID
     */
    toggleTagInSelector(tagId) {
        this.toggleFilter(tagId);
    },

    /**
     * 获取某个标签及其所有子标签的ID（递归）
     * @param {string} tagId - 标签ID
     * @returns {Array} 包含该标签及其所有子标签的ID数组
     */
    getAllDescendantIds(tagId) {
        const result = [tagId]; // 包含自身
        const tag = this.getTagById(tagId);
        if (tag && tag.children) {
            // 递归获取所有子标签
            const collectChildren = (children) => {
                Object.keys(children).forEach(childId => {
                    result.push(childId);
                    if (children[childId].children) {
                        collectChildren(children[childId].children);
                    }
                });
            };
            collectChildren(tag.children);
        }
        return result;
    },

    /**
     * 获取过滤后的笔记列表
     * @returns {Array} 过滤后的笔记数组
     */
    getFilteredNotes() {
        // 如果没有选择任何标签，返回所有笔记（不过滤）
        if (this.activeFilters.length === 0) {
            return this.notes;
        }
        
        // 扩展activeFilters：如果选择了父类，需要包含其所有子类
        const expandedFiltersList = this.activeFilters.map(tagId => {
            // 获取该标签及其所有子标签的ID
            return this.getAllDescendantIds(tagId);
        });
        
        // 交集（AND）模式：笔记必须同时包含所有选中的标签（或其子标签）
        return this.notes.filter(note => {
            // 对于每个选中的标签，笔记必须至少包含该标签或其子标签中的一个
            // 使用 .every() 确保所有条件都满足
            return expandedFiltersList.every(expandedSet => {
                return note.categories.some(catId => expandedSet.includes(catId));
            });
        });
    },

    /**
     * 切换筛选模式
     * @param {string} mode - 'OR' 或 'AND'
     */
    setFilterMode(mode) {
        if (mode === 'OR' || mode === 'AND') {
            this.filterMode = mode;
        }
    },

    /**
     * 切换过滤标签
     * @param {string} tagId - 标签ID，'All' 表示全部
     */
    toggleFilter(tagId) {
        if (tagId === 'All') {
            this.activeFilters = [];
        } else {
            const index = this.activeFilters.indexOf(tagId);
            if (index > -1) {
                this.activeFilters.splice(index, 1);
            } else {
                this.activeFilters.push(tagId);
            }
        }
    },

    /**
     * 切换输入标签选择
     * @param {string} tagId - 标签ID
     */
    toggleInputTag(tagId) {
        const index = this.selectedInputTags.indexOf(tagId);
        if (index > -1) {
            this.selectedInputTags.splice(index, 1);
        } else {
            this.selectedInputTags.push(tagId);
        }
    },

    /**
     * 添加笔记
     * @param {string} content - 笔记内容
     * @param {Array} categories - 分类数组
     * @returns {Object} 新创建的笔记对象
     */
    addNote(content, categories) {
        const newNote = {
            id: Date.now(),
            content: content,
            categories: [...categories],
            date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            expanded: false
        };
        this.notes.push(newNote);
        Storage.saveNotes(this.notes);
        return newNote;
    },

    /**
     * 更新笔记
     * @param {number} id - 笔记 ID
     * @param {string} content - 新内容
     * @param {Array} categories - 新分类数组
     * @returns {boolean} 是否更新成功
     */
    updateNote(id, content, categories) {
        const noteIndex = this.notes.findIndex(n => n.id === id);
        if (noteIndex > -1) {
            this.notes[noteIndex].content = content;
            this.notes[noteIndex].categories = [...categories];
            this.notes[noteIndex].date = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            this.notes[noteIndex].expanded = false;
            Storage.saveNotes(this.notes);
            return true;
        }
        return false;
    },

    /**
     * 删除笔记
     * @param {number} id - 笔记 ID
     * @returns {Object|null} 被删除的笔记对象（用于撤销）
     */
    deleteNote(id) {
        const index = this.notes.findIndex(n => n.id === id);
        if (index > -1) {
            const deletedNote = this.notes[index];
            this.notes.splice(index, 1);
            
            // 如果正在编辑该笔记，清除编辑状态
            if (this.editingNoteId === id) {
                this.editingNoteId = null;
            }
            
            Storage.saveNotes(this.notes);
            return { note: deletedNote, index: index };
        }
        return null;
    },

    /**
     * 撤销删除操作
     * @param {Object} deletedData - 包含 note 和 index 的对象
     */
    undoDelete(deletedData) {
        if (deletedData && deletedData.note) {
            if (deletedData.index >= 0 && deletedData.index <= this.notes.length) {
                this.notes.splice(deletedData.index, 0, deletedData.note);
            } else {
                this.notes.push(deletedData.note);
            }
            Storage.saveNotes(this.notes);
        }
    },

    /**
     * 切换笔记展开/折叠状态
     * @param {number} id - 笔记 ID
     */
    toggleNoteExpand(id) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            note.expanded = !note.expanded;
            Storage.saveNotes(this.notes);
        }
    },

    /**
     * 设置编辑状态
     * @param {number|null} id - 笔记 ID，null 表示取消编辑
     */
    setEditingNote(id) {
        this.editingNoteId = id;
    },

    /**
     * 获取正在编辑的笔记
     * @returns {Object|null} 笔记对象或 null
     */
    getEditingNote() {
        if (this.editingNoteId === null) return null;
        return this.notes.find(n => n.id === this.editingNoteId);
    },

    /**
     * 添加分类（在当前路径下）
     * @param {string} categoryName - 分类名称
     * @param {string} parentId - 父标签ID（可选）
     * @returns {string|null} 新创建的标签ID，失败返回null
     */
    addCategory(categoryName, parentId = null) {
        if (!categoryName || !categoryName.trim()) return null;
        
        const target = parentId ? 
            (this.getTagById(parentId)?.children || {}) : 
            this.getCurrentTagTree();
        
        // 检查同级是否有同名标签
        const nameExists = Object.values(target).some(tag => tag.name === categoryName.trim());
        if (nameExists) return null;
        
        const tagId = generateTagId();
        target[tagId] = {
            id: tagId,
            name: categoryName.trim(),
            parentId: parentId,
            children: {}
        };
        
        // 🔥 更新 tagMap
        this.tagMap[tagId] = {
            id: tagId,
            name: categoryName.trim(),
            parentId: parentId
        };
        
        Storage.saveCategories(this.categories);
        return tagId;
    },

    /**
     * 重命名分类（只需修改name属性，ID保持不变）- 使用 tagMap
     * @param {string} tagId - 标签ID
     * @param {string} newName - 新分类名称
     * @returns {boolean} 是否重命名成功
     */
    renameCategory(tagId, newName) {
        if (!newName || !newName.trim() || !tagId) {
            return false;
        }
        
        const tag = this.getTagById(tagId);
        if (!tag || !this.tagMap[tagId]) {
            return false; // 空值检查
        }
        
        // 检查同级是否有同名标签
        const parent = tag.parentId ? this.getTagById(tag.parentId) : null;
        const siblings = parent ? (parent.children || {}) : this.categories;
        const nameExists = Object.keys(siblings).some(id => 
            id !== tagId && siblings[id].name === newName.trim()
        );
        if (nameExists) {
            return false;
        }
        
        // 只需更新name属性，ID保持不变
        tag.name = newName.trim();
        // 🔥 同步更新 tagMap
        this.tagMap[tagId].name = newName.trim();
        
        Storage.saveCategories(this.categories);
        // 不需要更新notes，因为notes存储的是ID
        return true;
    },

    /**
     * 删除分类（递归删除所有子标签）- 使用 tagMap
     * @param {string} tagId - 标签ID
     */
    deleteCategory(tagId) {
        if (!tagId || !this.tagMap[tagId]) {
            return; // 空值检查
        }
        
        const tag = this.getTagById(tagId);
        if (!tag) return;
        
        // 递归删除所有子标签
        const deleteRecursive = (children) => {
            Object.keys(children).forEach(childId => {
                // 从活动过滤器移除
                this.activeFilters = this.activeFilters.filter(id => id !== childId);
                // 从输入选择移除
                this.selectedInputTags = this.selectedInputTags.filter(id => id !== childId);
                // 从所有笔记移除
                this.notes.forEach(note => {
                    note.categories = note.categories.filter(id => id !== childId);
                });
                // 🔥 从 tagMap 删除
                if (this.tagMap[childId]) {
                    delete this.tagMap[childId];
                }
                // 递归删除子级
                if (children[childId].children) {
                    deleteRecursive(children[childId].children);
                }
            });
        };
        
        if (tag.children) {
            deleteRecursive(tag.children);
        }
        
        // 从活动过滤器移除
        this.activeFilters = this.activeFilters.filter(id => id !== tagId);
        // 从输入选择移除
        this.selectedInputTags = this.selectedInputTags.filter(id => id !== tagId);
        // 从所有笔记移除
        this.notes.forEach(note => {
            note.categories = note.categories.filter(id => id !== tagId);
        });
        
        // 🔥 从 tagMap 删除
        delete this.tagMap[tagId];
        
        // 从树中删除
        const parent = tag.parentId ? this.getTagById(tag.parentId) : null;
        const target = parent ? (parent.children || {}) : this.categories;
        delete target[tagId];
        
        Storage.saveCategories(this.categories);
        Storage.saveNotes(this.notes);
    },

    /**
     * 移动分类位置（在树形结构中，通过改变对象顺序实现）
     * @param {number} fromIndex - 源索引
     * @param {number} toIndex - 目标索引
     */
    moveCategory(fromIndex, toIndex) {
        // 获取父级标签数组（顶层标签）
        const parentTags = this.getParentTags();
        if (fromIndex < 0 || fromIndex >= parentTags.length ||
            toIndex < 0 || toIndex >= parentTags.length ||
            fromIndex === toIndex) {
            return false;
        }
        
        const fromTagId = parentTags[fromIndex].id;
        const toTagId = parentTags[toIndex].id;
        
        // 在树形结构中，我们需要重新组织对象
        // 由于对象属性顺序在ES6+中是有序的，我们可以通过创建新对象来改变顺序
        const newCategories = {};
        const keys = Object.keys(this.categories);
        const fromKey = keys[fromIndex];
        const item = this.categories[fromKey];
        
        // 移除源项
        keys.splice(fromIndex, 1);
        // 插入到目标位置
        keys.splice(toIndex, 0, fromKey);
        
        // 重建categories对象
        keys.forEach(key => {
            newCategories[key] = this.categories[key];
        });
        
        this.categories = newCategories;
        // tagMap不需要更新，因为只是改变了顺序
        Storage.saveCategories(this.categories);
        return true;
    },

    /**
     * 移动子级标签（在同一父级下重新排序）
     * @param {string} parentTagId - 父级标签ID
     * @param {number} fromIndex - 源索引
     * @param {number} toIndex - 目标索引
     * @returns {boolean} 是否移动成功
     */
    moveChildCategory(parentTagId, fromIndex, toIndex) {
        // 找到父级标签
        const parentTag = this.findTagInTree(parentTagId);
        if (!parentTag || !parentTag.children) {
            return false;
        }

        const children = parentTag.children;
        const childIds = Object.keys(children);
        
        if (fromIndex < 0 || fromIndex >= childIds.length ||
            toIndex < 0 || toIndex >= childIds.length ||
            fromIndex === toIndex) {
            return false;
        }

        // 重新排序子级
        const fromId = childIds[fromIndex];
        const newChildren = {};
        const newKeys = [...childIds];
        newKeys.splice(fromIndex, 1);
        newKeys.splice(toIndex, 0, fromId);
        
        newKeys.forEach(key => {
            newChildren[key] = children[key];
        });
        
        parentTag.children = newChildren;
        Storage.saveCategories(this.categories);
        return true;
    }
};

// ============================================================================
// Undo Module - 撤销逻辑管理
// ============================================================================
const UndoManager = {
    lastDeletedData: null,

    /**
     * 保存删除操作的数据
     * @param {Object} deletedData - 包含 note 和 index 的对象
     */
    saveDelete(deletedData) {
        this.lastDeletedData = deletedData;
    },

    /**
     * 执行撤销操作
     */
    undo() {
        if (this.lastDeletedData) {
            State.undoDelete(this.lastDeletedData);
            this.lastDeletedData = null;
            return true;
        }
        return false;
    },

    /**
     * 清除撤销数据
     */
    clear() {
        this.lastDeletedData = null;
    },

    /**
     * 检查是否有可撤销的操作
     * @returns {boolean}
     */
    hasUndo() {
        return this.lastDeletedData !== null;
    }
};

// ============================================================================
// UI Utils - 工具函数
// ============================================================================
const Utils = {
    /**
     * HTML 转义函数，防止 XSS 攻击
     * @param {string} text - 原始文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        return text.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m];
        });
    },

    /**
     * 判断内容是否为长文本
     * @param {string} content - 文本内容
     * @returns {boolean}
     */
    isLongContent(content) {
        return content.length > 150 || (content.match(/\n/g) || []).length > 3;
    }
};

// ============================================================================
// Render Module - UI 渲染模块
// ============================================================================
const Render = {
    // DOM 元素引用（将在初始化时设置）
    elements: {},

    /**
     * 初始化 DOM 元素引用
     */
    initElements() {
        this.elements = {
            container: document.getElementById('notes-container'),
            input: document.getElementById('input-text'),
            emptyState: document.getElementById('empty-state'),
            countDisplay: document.getElementById('count-display'),
            toast: document.getElementById('toast'),
            toastMsg: document.getElementById('toast-message'),
            undoBtn: document.getElementById('undo-btn'),
            inputContainer: document.getElementById('input-container'),
            addUpdateText: document.getElementById('add-update-text'),
            addUpdateIcon: document.getElementById('add-update-icon'),
            categoryFilterContainer: document.getElementById('category-filter-container'),
            tagDropdownMenu: document.getElementById('tag-dropdown-menu'),
            selectedTagsLabel: document.getElementById('selected-tags-label'),
            newCategoryInput: document.getElementById('new-category-input'),
            addCategoryDialog: document.getElementById('add-category-dialog'),
            renameTagInput: document.getElementById('rename-tag-input'),
            renameTagDialog: document.getElementById('rename-tag-dialog'),
            tagSearchDropdown: null, // 动态创建，在 renderFilterBar 中设置
            tagSearchDropdownMenu: null, // 动态创建，在 renderFilterBar 中设置
            tagSearchButton: null, // 动态创建，在 renderFilterBar 中设置
            tagSearchInputWrapper: null, // 搜索输入框容器（动态创建）
            tagListContainer: null // 标签列表容器（动态创建）
        };
        
        // 验证关键元素是否存在
        if (!this.elements.container) {
            console.error('Missing element: notes-container');
        }
        if (!this.elements.input) {
            console.error('Missing element: input-text');
        }
        if (!this.elements.categoryFilterContainer) {
            console.error('Missing element: category-filter-container');
        }
        if (!this.elements.tagDropdownMenu) {
            console.error('Missing element: tag-dropdown-menu');
        }
    },

    /**
     * 创建笔记卡片 HTML 模板
     * @param {Object} note - 笔记对象
     * @returns {string} HTML 字符串
     */
    createNoteCard(note) {
        const isLong = Utils.isLongContent(note.content);
        const colSpanClass = note.expanded 
            ? 'col-span-1 sm:col-span-2 lg:col-span-3' 
            : 'col-span-1';
        const isEditing = note.id === State.editingNoteId;

        // 根据ID实时查找完整路径并显示
        const tagsHtml = note.categories.map(tagId => {
            const fullPath = State.getTagFullName(tagId);
            return `<span class="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">${Utils.escapeHtml(fullPath || tagId)}</span>`;
        }).join('');

        return `
            <div class="group relative flex flex-col bg-white border border-zinc-200 rounded-xl p-5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 ease-out hover:-translate-y-0.5 grid-item-transition ${colSpanClass} ${isEditing ? 'editing-mode ring-1 ring-emerald-200' : ''}" data-note-id="${note.id}">
                <div class="flex justify-between items-start mb-3">
                    <span class="text-[10px] font-medium tracking-wide text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-100">${Utils.escapeHtml(note.date)}</span>
                    
                    <div class="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                        <button data-action="copy" data-note-id="${note.id}" class="touch-target sm:touch-auto sm:p-1.5 flex items-center justify-center text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Copy">
                            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                        </button>
                        <button data-action="edit" data-note-id="${note.id}" class="touch-target sm:touch-auto sm:p-1.5 flex items-center justify-center text-zinc-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Edit">
                            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        </button>
                        <button data-action="delete" data-note-id="${note.id}" class="touch-target sm:touch-auto sm:p-1.5 flex items-center justify-center text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
                
                <div class="relative w-full flex-grow mb-3">
                    <p class="text-sm font-mono text-zinc-600 leading-relaxed whitespace-pre-wrap break-words ${note.expanded ? '' : 'text-clamped'} selection:bg-zinc-200" id="text-${note.id}">${Utils.escapeHtml(note.content)}</p>
                    ${isLong && !note.expanded ? '<div class="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none"></div>' : ''}
                </div>

                <div class="mt-auto flex flex-col gap-3">
                    ${note.categories.length > 0 ? `<div class="flex flex-wrap gap-1.5 w-full">${tagsHtml}</div>` : ''}
                    
                    ${isLong ? `
                    <div class="flex items-center pt-1 border-t border-zinc-50 mt-1">
                        <button data-action="toggle-expand" data-note-id="${note.id}" class="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-900 transition-colors focus:outline-none py-1 rounded-md">
                            <span>${note.expanded ? 'Show less' : 'Show more'}</span>
                            <i data-lucide="${note.expanded ? 'minimize-2' : 'chevron-down'}" class="w-3 h-3"></i>
                        </button>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    /**
     * 渲染笔记列表
     */
    renderNotes() {
        const container = this.elements.container;
        const emptyState = this.elements.emptyState;
        const countDisplay = this.elements.countDisplay;

        // 空值检查
        if (!container) {
            console.error('Cannot render notes: container element not found');
            return;
        }
        if (!emptyState) {
            console.error('Cannot render notes: emptyState element not found');
            return;
        }
        if (!countDisplay) {
            console.error('Cannot render notes: countDisplay element not found');
            return;
        }

        container.innerHTML = '';

        const filteredNotes = State.getFilteredNotes();
        countDisplay.innerText = filteredNotes.length;

        if (filteredNotes.length === 0) {
            emptyState.classList.remove('hidden');
            emptyState.classList.add('flex');
        } else {
            emptyState.classList.add('hidden');
            emptyState.classList.remove('flex');
        }

        // 倒序显示（最新的在前）
        [...filteredNotes].reverse().forEach(note => {
            const cardHtml = this.createNoteCard(note);
            container.insertAdjacentHTML('beforeend', cardHtml);
        });

        // 重新初始化 Lucide 图标
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }
    },

    /**
     * 渲染分类过滤栏
     */
    renderFilterBar() {
        const container = this.elements.categoryFilterContainer;
        
        // 空值检查
        if (!container) {
            console.error('Cannot render filter bar: categoryFilterContainer element not found');
            return;
        }
        
        // 保存当前搜索输入框的值（如果有）
        const currentSearchInput = document.getElementById('tag-search-dropdown-input');
        const preservedSearchValue = currentSearchInput ? currentSearchInput.value : State.tagSearchQuery;
        
        // 清空容器前，清除旧的输入框引用（因为 DOM 元素将被删除）
        if (this.elements.tagSearchInputWrapper) {
            this.elements.tagSearchInputWrapper = null;
            this.elements.tagListContainer = null;
        }
        
        container.innerHTML = '';

        // 顶部操作栏（已选标签展示区）
        const topBar = document.createElement('div');
        topBar.className = 'flex items-center gap-2 w-full mb-3';

        // 已选标签展示区（显示完整路径，如"场景/商店街"）
        const selectedTagsWrapper = document.createElement('div');
        selectedTagsWrapper.className = 'flex flex-wrap items-center gap-2 flex-1';
        selectedTagsWrapper.id = 'selected-tags-display';

        if (State.activeFilters.length > 0) {
            State.activeFilters.forEach(tagId => {
                const fullPath = State.getTagFullName(tagId);
                const tagPill = document.createElement('div');
                tagPill.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-900 text-white border border-zinc-900';
                tagPill.innerHTML = `
                    <span>${Utils.escapeHtml(fullPath || tagId)}</span>
                    <button data-action="remove-filter" data-tag-id="${Utils.escapeHtml(tagId)}" class="hover:text-zinc-300 transition-colors">
                        <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                `;
                selectedTagsWrapper.appendChild(tagPill);
            });
        }

        topBar.appendChild(selectedTagsWrapper);
        container.appendChild(topBar);

        // Tags 容器（只显示父级标签，如果没有选中子级）
        const tagsWrapper = document.createElement('div');
        tagsWrapper.className = 'flex flex-wrap items-center gap-2 w-full';
        tagsWrapper.id = 'tags-wrapper';

        // 'All' 过滤器按钮
        const isAllActive = State.activeFilters.length === 0;
        const allBtn = document.createElement('button');
        allBtn.className = `px-4 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
            isAllActive
                ? 'bg-zinc-900 border-zinc-900 text-white shadow-md'
                : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
        }`;
        allBtn.innerText = 'All';
        allBtn.dataset.action = 'filter';
        allBtn.dataset.category = 'All';
        tagsWrapper.appendChild(allBtn);

        // 只显示父级标签
        // 如果某个父标签下有子标签被选中，该父标签会高亮，但不显示子标签
        const parentTags = State.getParentTags();
        parentTags.forEach((parentTag, index) => {
            const parentTagId = parentTag.id;
            const parentTagName = parentTag.name;
            const hasActiveChild = State.hasActiveChild(parentTagId);
            const isParentActive = State.isParentTagActive(parentTagId);
            // 父标签高亮：如果父标签被直接选中，或者有子标签被选中
            const isHighlighted = isParentActive || hasActiveChild;
            
            const wrapper = document.createElement('div');
            wrapper.className = `group/pill inline-flex items-center rounded-full border transition-all duration-200 select-none ${
                isHighlighted
                    ? 'bg-zinc-900 border-zinc-900 text-white shadow-md shadow-zinc-900/20'
                    : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
            }`;
            
            wrapper.draggable = true;
            wrapper.dataset.tagIndex = index;
            wrapper.dataset.tagId = parentTagId;

            // 拖拽图标
            const dragHandle = document.createElement('div');
            dragHandle.className = `pl-1.5 py-1.5 flex items-center justify-center opacity-0 group-hover/pill:opacity-100 transition-opacity ${isHighlighted ? 'text-zinc-300' : 'text-zinc-400'}`;
            dragHandle.innerHTML = '<i data-lucide="grip-vertical" class="w-3 h-3"></i>';
            dragHandle.dataset.action = 'drag-handle';
            wrapper.appendChild(dragHandle);

            // 标签按钮（点击进入子级或选中父级）
            const labelBtn = document.createElement('button');
            labelBtn.className = "px-2 py-1.5 text-xs font-medium bg-transparent focus:outline-none";
            labelBtn.innerText = parentTagName;
            labelBtn.dataset.action = 'open-tag-selector';
            labelBtn.dataset.parentTagId = parentTagId;
            wrapper.appendChild(labelBtn);

            // 编辑按钮
            const editBtn = document.createElement('button');
            editBtn.className = `px-1 py-1.5 flex items-center justify-center opacity-0 group-hover/pill:opacity-100 transition-opacity focus:outline-none ${isHighlighted ? 'text-zinc-300 hover:text-white' : 'text-zinc-400 hover:text-blue-500'}`;
            editBtn.innerHTML = '<i data-lucide="pencil" class="w-3 h-3"></i>';
            editBtn.title = "Edit Tag";
            editBtn.dataset.action = 'edit-category';
            editBtn.dataset.tagId = parentTagId;
            wrapper.appendChild(editBtn);

            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = `pr-2 pl-1 py-1.5 flex items-center justify-center opacity-0 group-hover/pill:opacity-100 transition-opacity focus:outline-none ${isHighlighted ? 'text-zinc-300 hover:text-white' : 'text-zinc-400 hover:text-red-500'}`;
            deleteBtn.innerHTML = '<i data-lucide="x" class="w-3 h-3"></i>';
            deleteBtn.title = "Delete Tag";
            deleteBtn.dataset.action = 'delete-category';
            deleteBtn.dataset.tagId = parentTagId;

            if (window.innerWidth < 640 && isHighlighted) {
                deleteBtn.classList.remove('opacity-0');
                editBtn.classList.remove('opacity-0');
            }

            wrapper.appendChild(deleteBtn);
            tagsWrapper.appendChild(wrapper);
        });

        container.appendChild(tagsWrapper);

        // 渲染标签选择器（如果打开）
        this.renderTagSelector();

        // 添加新标签按钮
        const addTagBtn = document.createElement('button');
        addTagBtn.className = "ml-1 w-7 h-7 flex items-center justify-center rounded-full border border-dashed border-zinc-300 text-zinc-400 hover:text-zinc-900 hover:border-zinc-400 hover:bg-white transition-all";
        addTagBtn.title = "Create New Tag";
        addTagBtn.innerHTML = '<i data-lucide="plus" class="w-3.5 h-3.5"></i>';
        addTagBtn.dataset.action = 'show-add-category-dialog';
        container.appendChild(addTagBtn);

        // 重新初始化 Lucide 图标
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }
    },

    /**
     * 渲染级联标签选择器（类似提供的HTML原型）
     */
    renderTagSelector() {
        // 检查是否有打开的标签选择器
        let existingSelector = document.getElementById('tag-selector-panel');
        if (!State.tagSelectPath.length && existingSelector) {
            existingSelector.remove();
            return;
        }

        if (!State.tagSelectPath.length) {
            return; // 如果没有打开的选择器，不渲染
        }

        // 创建或更新选择器面板
        if (!existingSelector) {
            existingSelector = document.createElement('div');
            existingSelector.id = 'tag-selector-panel';
            existingSelector.className = 'fixed inset-0 bg-black/20 flex items-center justify-center z-50';
            document.body.appendChild(existingSelector);
        }

        const currentTree = State.getCurrentTagTree();
        const currentPath = State.tagSelectPath;

        existingSelector.innerHTML = `
            <div class="bg-white rounded-2xl border border-zinc-200 shadow-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
                <!-- 头部：面包屑导航 -->
                <div class="px-4 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
                    <div id="tag-selector-breadcrumb" class="flex items-center text-xs font-medium text-zinc-500 flex-1 overflow-x-auto">
                        <span class="cursor-pointer hover:text-zinc-900 whitespace-nowrap" data-action="tag-selector-home">根目录</span>
                    </div>
                    <button data-action="add-tag-in-selector" class="text-zinc-400 hover:text-zinc-900 ml-2" title="添加标签">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                    </button>
                </div>

                <!-- 标签列表 -->
                <div id="tag-selector-list" class="flex-1 overflow-y-auto divide-y divide-zinc-50">
                    <!-- 动态生成 -->
                </div>

                <!-- 底部：完成按钮 -->
                <div class="px-4 py-3 border-t border-zinc-100 flex justify-end">
                    <button data-action="close-tag-selector" class="px-4 py-2 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors">
                        完成
                    </button>
                </div>
            </div>
        `;

        // 渲染面包屑（根据ID查找名称，样式优化，匹配截图样式）
        const breadcrumb = existingSelector.querySelector('#tag-selector-breadcrumb');
        breadcrumb.innerHTML = '<span class="cursor-pointer hover:text-zinc-900 whitespace-nowrap" data-action="tag-selector-home">根目录</span>';
        currentPath.forEach((tagId, index) => {
            const tag = State.getTagById(tagId);
            const tagName = tag ? tag.name : tagId;
            breadcrumb.innerHTML += ` <span class="text-zinc-300 mx-1">/</span> <span class="cursor-pointer hover:text-zinc-900 whitespace-nowrap" data-action="tag-selector-jump" data-index="${index}">${Utils.escapeHtml(tagName)}</span>`;
        });
        
        // 确保面包屑可以横向滚动
        breadcrumb.style.minWidth = '0';

        // 渲染标签列表
        const list = existingSelector.querySelector('#tag-selector-list');
        const tagIds = Object.keys(currentTree);
        
        // 如果有父级路径，先显示"选择父级本身"选项（即使没有子类也要显示）
        if (currentPath.length > 0) {
            const parentTagId = currentPath[currentPath.length - 1];
            const parentTag = State.getTagById(parentTagId);
            if (parentTag) {
                const isParentSelected = State.activeFilters.includes(parentTagId);
                const parentHasChildren = parentTag.children && Object.keys(parentTag.children).length > 0;
                const parentItem = document.createElement('div');
                parentItem.className = "group flex items-center justify-between px-4 py-3 hover:bg-zinc-50 cursor-pointer transition-colors border-b border-zinc-100";
                parentItem.innerHTML = `
                    <div class="flex items-center gap-3 flex-1" data-action="tag-selector-select" data-tag-id="${Utils.escapeHtml(parentTagId)}">
                        <i data-lucide="layers" class="w-4 h-4 text-blue-500"></i>
                        <span class="text-sm font-medium text-zinc-900">${Utils.escapeHtml(parentTag.name)}（全部）</span>
                        <span class="text-xs text-zinc-400">选择此分类${parentHasChildren ? '及其所有子分类' : ''}</span>
                    </div>
                    <div class="flex items-center gap-1">
                        ${isParentSelected ? '<i data-lucide="check" class="w-4 h-4 text-zinc-900 ml-2"></i>' : ''}
                    </div>
                `;
                list.appendChild(parentItem);
            }
        }
        
        if (tagIds.length === 0) {
            // 如果没有子类，显示提示信息（但"（全部）"选项已经在上面的逻辑中显示了）
            const emptyMsg = document.createElement('div');
            emptyMsg.className = "p-8 text-center text-zinc-400 text-xs";
            emptyMsg.innerText = '空空如也，点击右上角添加';
            list.appendChild(emptyMsg);
        } else {
            
            // 渲染标签列表（父类显示"（全部）"选项，子类不显示）
            tagIds.forEach(tagId => {
                const tag = currentTree[tagId];
                const hasChildren = tag.children && Object.keys(tag.children).length > 0;
                const isTagSelected = State.activeFilters.includes(tagId);
                
                // 判断当前路径深度：如果是在根目录，显示"（全部）"选项；如果是在子级，不显示
                const isRootLevel = currentPath.length === 0;
                
                // 只在根目录层级显示"（全部）"选项
                if (isRootLevel) {
                    // 首先显示"（全部）"选项 - 选择该标签本身
                    const allItem = document.createElement('div');
                    allItem.className = "group flex items-center justify-between px-4 py-3 hover:bg-zinc-50 cursor-pointer transition-colors border-b border-zinc-100";
                    allItem.innerHTML = `
                        <div class="flex items-center gap-3 flex-1" data-action="tag-selector-select" data-tag-id="${Utils.escapeHtml(tagId)}">
                            <i data-lucide="layers" class="w-4 h-4 text-blue-500"></i>
                            <span class="text-sm font-medium text-zinc-900">${Utils.escapeHtml(tag.name)}（全部）</span>
                            <span class="text-xs text-zinc-400">选择此分类${hasChildren ? '及其所有子分类' : ''}</span>
                        </div>
                        <div class="flex items-center gap-1">
                            ${isTagSelected ? '<i data-lucide="check" class="w-4 h-4 text-zinc-900 ml-2"></i>' : ''}
                        </div>
                    `;
                    list.appendChild(allItem);
                }
                
                // 如果有子类，显示子类列表（子类不显示"（全部）"选项）
                if (hasChildren) {
                    const children = Object.keys(tag.children);
                    const parentTagId = tagId;
                    children.forEach((childId, index) => {
                        const childTag = tag.children[childId];
                        const childHasChildren = childTag.children && Object.keys(childTag.children).length > 0;
                        const isChildSelected = State.activeFilters.includes(childId);
                        
                        const item = document.createElement('div');
                        item.className = "group flex items-center justify-between px-4 py-3 hover:bg-zinc-50 cursor-pointer transition-colors draggable-tag-item";
                        item.draggable = true;
                        item.dataset.tagId = childId;
                        item.dataset.parentTagId = parentTagId;
                        item.dataset.childIndex = index;
                        item.innerHTML = `
                            <div class="flex items-center gap-3 flex-1">
                                <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move" data-drag-handle="true" style="pointer-events: none;">
                                    <i data-lucide="grip-vertical" class="w-4 h-4 text-zinc-400"></i>
                                </div>
                                <div class="flex items-center gap-3 flex-1" data-action="${childHasChildren ? 'tag-selector-enter' : 'tag-selector-select'}" data-tag-id="${Utils.escapeHtml(childId)}">
                                    <i data-lucide="${childHasChildren ? 'folder' : 'tag'}" class="w-4 h-4 text-zinc-400"></i>
                                    <span class="text-sm text-zinc-700">${Utils.escapeHtml(childTag.name)}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-1">
                                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button data-action="edit-tag-in-selector" data-tag-id="${Utils.escapeHtml(childId)}" class="p-1.5 hover:bg-zinc-200 rounded text-zinc-500" title="编辑">
                                        <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                                    </button>
                                    <button data-action="delete-tag-in-selector" data-tag-id="${Utils.escapeHtml(childId)}" class="p-1.5 hover:bg-red-100 rounded text-red-500" title="删除">
                                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                    </button>
                                </div>
                                ${isChildSelected ? '<i data-lucide="check" class="w-4 h-4 text-zinc-900 ml-2"></i>' : ''}
                            </div>
                        `;
                        list.appendChild(item);
                    });
                } else if (!isRootLevel) {
                    // 如果没有子类且不在根目录，直接显示标签（用于叶子节点）
                    // 需要找到父级标签ID
                    const parentTagId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;
                    const isSelected = State.activeFilters.includes(tagId);
                    const item = document.createElement('div');
                    item.className = "group flex items-center justify-between px-4 py-3 hover:bg-zinc-50 cursor-pointer transition-colors draggable-tag-item";
                    if (parentTagId) {
                        item.draggable = true;
                        item.dataset.tagId = tagId;
                        item.dataset.parentTagId = parentTagId;
                        // 计算当前标签在同级中的索引
                        const parentTag = State.getTagById(parentTagId);
                        if (parentTag && parentTag.children) {
                            const siblingIds = Object.keys(parentTag.children);
                            const currentIndex = siblingIds.indexOf(tagId);
                            item.dataset.childIndex = currentIndex;
                        }
                    }
                    item.innerHTML = `
                        <div class="flex items-center gap-3 flex-1">
                            ${parentTagId ? '<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move" data-drag-handle="true" style="pointer-events: none;"><i data-lucide="grip-vertical" class="w-4 h-4 text-zinc-400"></i></div>' : ''}
                            <div class="flex items-center gap-3 flex-1" data-action="tag-selector-select" data-tag-id="${Utils.escapeHtml(tagId)}">
                                <i data-lucide="tag" class="w-4 h-4 text-zinc-400"></i>
                                <span class="text-sm text-zinc-700">${Utils.escapeHtml(tag.name)}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-1">
                            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button data-action="edit-tag-in-selector" data-tag-id="${Utils.escapeHtml(tagId)}" class="p-1.5 hover:bg-zinc-200 rounded text-zinc-500" title="编辑">
                                    <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                                </button>
                                <button data-action="delete-tag-in-selector" data-tag-id="${Utils.escapeHtml(tagId)}" class="p-1.5 hover:bg-red-100 rounded text-red-500" title="删除">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                            ${isSelected ? '<i data-lucide="check" class="w-4 h-4 text-zinc-900 ml-2"></i>' : ''}
                        </div>
                    `;
                    list.appendChild(item);
                }
            });
        }

        // 重新初始化 Lucide 图标
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }
    },

    /**
     * 初始化标签搜索浮层（仅创建一次，不重复创建输入框）
     */
    initTagSearchDropdown() {
        const dropdown = this.elements.tagSearchDropdown;
        if (!dropdown) return;

        const menu = this.elements.tagSearchDropdownMenu;
        if (!menu) return;

        // 如果已经初始化过且 DOM 元素仍然存在，不重复创建
        if (this.elements.tagSearchInputWrapper && 
            document.contains(this.elements.tagSearchInputWrapper)) {
            return;
        }
        
        // 如果引用存在但 DOM 元素已被删除，清除引用
        if (this.elements.tagSearchInputWrapper && 
            !document.contains(this.elements.tagSearchInputWrapper)) {
            this.elements.tagSearchInputWrapper = null;
            this.elements.tagListContainer = null;
        }

        // 创建搜索输入框容器（只创建一次）
        const searchInputWrapper = document.createElement('div');
        searchInputWrapper.className = 'relative mb-3';
        searchInputWrapper.id = 'tag-search-input-wrapper';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'tag-search-dropdown-input';
        searchInput.placeholder = 'Search tags...';
        searchInput.className = 'w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400';
        searchInput.value = State.tagSearchQuery;
        
        const searchIcon = document.createElement('div');
        searchIcon.className = 'absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none';
        searchIcon.innerHTML = '<i data-lucide="search" class="w-4 h-4"></i>';
        searchInputWrapper.appendChild(searchInput);
        searchInputWrapper.appendChild(searchIcon);
        menu.appendChild(searchInputWrapper);

        // 创建标签列表容器（只创建一次）
        const tagsList = document.createElement('div');
        tagsList.id = 'tag-list-container';
        tagsList.className = 'flex flex-col gap-1 max-h-60 overflow-y-auto';
        menu.appendChild(tagsList);

        // 保存引用
        this.elements.tagSearchInputWrapper = searchInputWrapper;
        this.elements.tagListContainer = tagsList;

        // 重新初始化 Lucide 图标
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }
    },

    /**
     * 渲染标签搜索浮层（只更新标签列表，不重新创建输入框）
     */
    renderTagSearchDropdown() {
        const dropdown = this.elements.tagSearchDropdown;
        if (!dropdown) return;

        // 控制浮层显示/隐藏和动画
        if (State.tagSearchDropdownOpen) {
            // 确保已初始化
            this.initTagSearchDropdown();
            // 显示浮层
            dropdown.classList.remove('hidden');
            // 强制重排以确保动画生效
            void dropdown.offsetWidth;
            // 添加动画类
            dropdown.classList.remove('opacity-0', 'scale-95');
            dropdown.classList.add('opacity-100', 'scale-100');
        } else {
            // 关闭动画
            dropdown.classList.add('opacity-0', 'scale-95');
            dropdown.classList.remove('opacity-100', 'scale-100');
            // 等待动画完成后再隐藏
            setTimeout(() => {
                if (!State.tagSearchDropdownOpen) {
                    dropdown.classList.add('hidden');
                }
            }, 200);
            return;
        }

        // 更新搜索输入框的值（不重新创建）
        const searchInput = document.getElementById('tag-search-dropdown-input');
        if (searchInput) {
            searchInput.value = State.tagSearchQuery;
        }

        // 只更新标签列表容器
        const tagsList = this.elements.tagListContainer;
        if (!tagsList) {
            this.initTagSearchDropdown();
            return;
        }

        // 清空并重新渲染标签列表
        tagsList.innerHTML = '';

        // 收集所有可用的标签（树形结构扁平化，存储ID和完整路径）
        const allTags = []; // [{ id, fullPath }]
        const flattenTags = (tree) => {
            Object.keys(tree).forEach(tagId => {
                const tag = tree[tagId];
                const fullPath = State.getTagFullName(tagId);
                allTags.push({ id: tagId, fullPath: fullPath || tag.name });
                if (tag.children && Object.keys(tag.children).length > 0) {
                    flattenTags(tag.children);
                }
            });
        };
        flattenTags(State.categories);

        // 过滤标签（基于搜索查询，匹配名称或完整路径）
        const query = State.tagSearchQuery ? State.tagSearchQuery.toLowerCase().trim() : '';
        const filteredTags = query
            ? allTags.filter(tag => 
                tag.fullPath.toLowerCase().includes(query) || 
                tag.fullPath.split('/').some(part => part.toLowerCase().includes(query))
            )
            : allTags;

        // 如果没有搜索结果
        if (query && filteredTags.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'flex items-center justify-center py-4 text-sm text-zinc-500';
            noResults.innerHTML = `
                <div class="flex items-center gap-2">
                    <i data-lucide="search-x" class="w-4 h-4 text-zinc-400"></i>
                    <span>无对应tag</span>
                </div>
            `;
            tagsList.appendChild(noResults);
        } else {
            // 显示过滤后的标签列表（显示完整路径，但使用ID）
            filteredTags.forEach(tag => {
                const isActive = State.activeFilters.includes(tag.id);
                const tagItem = document.createElement('button');
                tagItem.className = `flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                    isActive
                        ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                        : 'bg-white text-zinc-600 hover:bg-zinc-50'
                }`;
                tagItem.dataset.action = 'toggle-filter-from-search';
                tagItem.dataset.tagId = tag.id;
                
                tagItem.innerHTML = `
                    <span class="text-sm font-medium">${Utils.escapeHtml(tag.fullPath)}</span>
                    ${isActive ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}
                `;
                
                tagsList.appendChild(tagItem);
            });
        }

        // 重新初始化 Lucide 图标
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }
    },

    /**
     * 渲染标签下拉菜单（两栏布局：左列父级，右列子级）
     */
    renderTagDropdown() {
        const menu = this.elements.tagDropdownMenu;
        
        // 空值检查
        if (!menu) {
            console.error('Cannot render tag dropdown: tagDropdownMenu element not found');
            return;
        }
        
        // 获取左右两列容器
        let parentList = document.getElementById('tag-dropdown-parent-list');
        let childList = document.getElementById('tag-dropdown-child-list');
        
        // 如果容器不存在，说明是第一次渲染，需要创建结构
        if (!parentList || !childList) {
            menu.innerHTML = `
                <div id="tag-dropdown-parent-list" class="w-1/2 border-r border-zinc-200 flex flex-col overflow-y-auto min-h-0">
                    <!-- Populated by JS -->
                </div>
                <div id="tag-dropdown-child-list" class="w-1/2 flex flex-col overflow-y-auto min-h-0">
                    <!-- Populated by JS -->
                </div>
            `;
            parentList = document.getElementById('tag-dropdown-parent-list');
            childList = document.getElementById('tag-dropdown-child-list');
        }
        
        // 动态调整下拉菜单位置，避免超出屏幕边界（在toggleTagDropdown中处理）
        
        // 清空内容
        parentList.innerHTML = '';
        childList.innerHTML = '';

        // 渲染左列：所有父级标签（顶层标签）
        const parentTags = State.getParentTags();
        parentTags.forEach(tag => {
            const isSelected = State.selectedInputTags.includes(tag.id);
            const isActive = State.selectedParentTagId === tag.id;
            const hasChildren = tag.children && Object.keys(tag.children).length > 0;
            
            const item = document.createElement('label');
            item.className = `flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors select-none group ${
                isActive 
                    ? 'bg-blue-50 border-l-2 border-blue-500' 
                    : 'hover:bg-zinc-50'
            }`;
            item.dataset.tagId = tag.id;
            item.dataset.tagCategory = tag.id;
            item.dataset.action = 'select-parent-tag';
            item.innerHTML = `
                <input type="checkbox" class="tag-checkbox hidden" ${isSelected ? 'checked' : ''} data-tag-category="${tag.id}">
                <div class="w-4 h-4 rounded border border-zinc-300 flex items-center justify-center text-xs group-hover:border-zinc-400 transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : ''}">
                    ${isSelected ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
                </div>
                <i data-lucide="${hasChildren ? 'folder' : 'tag'}" class="w-3 h-3 ${isActive ? 'text-blue-500' : 'text-zinc-400'}"></i>
                <span class="text-xs font-medium flex-1 ${isSelected ? 'text-zinc-900' : 'text-zinc-600'}">${Utils.escapeHtml(tag.name)}</span>
            `;
            parentList.appendChild(item);
        });

        // 添加"创建新标签"按钮到左列底部
        const addDiv = document.createElement('div');
        addDiv.className = "border-t border-zinc-100 mt-auto";
        const addBtn = document.createElement('button');
        addBtn.className = "w-full text-left px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1";
        const createText = parentTags.length > 0 ? 'Create' : 'Create New';
        addBtn.innerHTML = `<i data-lucide="plus" class="w-3 h-3"></i> ${createText}`;
        addBtn.dataset.action = 'show-add-category-dialog';
        addDiv.appendChild(addBtn);
        parentList.appendChild(addDiv);

        // 渲染右列：当前选中父级的子级标签
        if (State.selectedParentTagId) {
            const parentTag = State.getTagById(State.selectedParentTagId);
            if (parentTag) {
                const isParentSelected = State.selectedInputTags.includes(State.selectedParentTagId);
                const hasChildren = parentTag.children && Object.keys(parentTag.children).length > 0;
                
                // 首先显示"（全部）"选项 - 选择父级本身
                const allItem = document.createElement('label');
                allItem.className = "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-50 transition-colors select-none group border-b border-zinc-100";
                allItem.dataset.tagCategory = State.selectedParentTagId;
                allItem.dataset.action = 'toggle-input-tag';
                allItem.innerHTML = `
                    <input type="checkbox" class="tag-checkbox hidden" ${isParentSelected ? 'checked' : ''} data-tag-category="${State.selectedParentTagId}">
                    <div class="w-4 h-4 rounded border border-zinc-300 flex items-center justify-center text-xs group-hover:border-zinc-400 transition-colors ${isParentSelected ? 'bg-blue-500 border-blue-500' : ''}">
                        ${isParentSelected ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
                    </div>
                    <i data-lucide="layers" class="w-3 h-3 text-blue-500"></i>
                    <span class="text-xs font-medium flex-1 ${isParentSelected ? 'text-zinc-900' : 'text-zinc-600'}">${Utils.escapeHtml(parentTag.name)}（全部）</span>
                    <span class="text-xs text-zinc-400">${hasChildren ? '包含所有子分类' : ''}</span>
                `;
                childList.appendChild(allItem);
                
                // 如果有子类，显示子类列表
                if (hasChildren) {
                    const children = Object.keys(parentTag.children);
                    children.forEach(childId => {
                        const childTag = parentTag.children[childId];
                        const isSelected = State.selectedInputTags.includes(childId);
                        const childHasChildren = childTag.children && Object.keys(childTag.children).length > 0;
                        
                        const item = document.createElement('label');
                        item.className = "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-50 transition-colors select-none group";
                        item.dataset.tagCategory = childId;
                        item.dataset.action = 'toggle-input-tag';
                        item.innerHTML = `
                            <input type="checkbox" class="tag-checkbox hidden" ${isSelected ? 'checked' : ''} data-tag-category="${childId}">
                            <div class="w-4 h-4 rounded border border-zinc-300 flex items-center justify-center text-xs group-hover:border-zinc-400 transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : ''}">
                                ${isSelected ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
                            </div>
                            <i data-lucide="${childHasChildren ? 'folder' : 'tag'}" class="w-3 h-3 text-zinc-400"></i>
                            <span class="text-xs font-medium flex-1 ${isSelected ? 'text-zinc-900' : 'text-zinc-600'}">${Utils.escapeHtml(childTag.name)}</span>
                        `;
                        childList.appendChild(item);
                    });
                }
                
                // 添加"创建子标签"按钮到右列底部
                const addChildDiv = document.createElement('div');
                addChildDiv.className = "border-t border-zinc-100 mt-auto";
                const addChildBtn = document.createElement('button');
                addChildBtn.className = "w-full text-left px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1";
                const createChildText = hasChildren ? 'Create' : 'Create New';
                addChildBtn.innerHTML = `<i data-lucide="plus" class="w-3 h-3"></i> ${createChildText}`;
                addChildBtn.dataset.action = 'show-add-child-category-dialog';
                addChildBtn.dataset.parentTagId = State.selectedParentTagId;
                addChildDiv.appendChild(addChildBtn);
                childList.appendChild(addChildDiv);
            } else {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = "px-3 py-8 text-center text-xs text-zinc-400";
                emptyMsg.innerText = '请选择左侧父级标签';
                childList.appendChild(emptyMsg);
            }
        } else {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = "px-3 py-8 text-center text-xs text-zinc-400";
            emptyMsg.innerText = '请选择左侧父级标签';
            childList.appendChild(emptyMsg);
        }

        // 重新初始化 Lucide 图标
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }
    },

    /**
     * 更新已选标签标签显示（根据ID实时查找完整路径）
     */
    updateSelectedTagsLabel() {
        const label = this.elements.selectedTagsLabel;
        if (State.selectedInputTags.length === 0) {
            label.innerText = "Select Tags";
            label.className = "text-zinc-500";
        } else if (State.selectedInputTags.length === 1) {
            const fullPath = State.getTagFullName(State.selectedInputTags[0]);
            label.innerText = fullPath || State.selectedInputTags[0];
            label.className = "text-zinc-900 font-medium";
        } else {
            label.innerText = `${State.selectedInputTags.length} Tags`;
            label.className = "text-zinc-900 font-medium";
        }
    },

    /**
     * 更新输入框编辑状态显示
     */
    updateInputEditState() {
        const container = this.elements.inputContainer;
        const textEl = this.elements.addUpdateText;
        const iconEl = this.elements.addUpdateIcon;

        if (State.editingNoteId !== null) {
            textEl.innerText = 'Update Note';
            if (iconEl) {
                iconEl.setAttribute('data-lucide', 'check');
            }
            container.classList.add('editing-mode', 'ring-emerald-400/50');
        } else {
            textEl.innerText = 'Add Note';
            if (iconEl) {
                iconEl.setAttribute('data-lucide', 'plus');
            }
            container.classList.remove('editing-mode', 'ring-emerald-400/50');
        }

        // 重新初始化图标
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * 更新高度切换按钮的图标和样式
     */
    updateHeightButton() {
        const toggleBtn = document.getElementById('btn-h-toggle');
        const toggleIcon = document.getElementById('btn-h-toggle-icon');
        if (!toggleBtn || !toggleIcon) return;

        const currentHeight = State.currentInputHeight;
        
        if (currentHeight === 'large') {
            // 当前是large，显示"收起"图标（minimize-2）
            toggleIcon.setAttribute('data-lucide', 'minimize-2');
            toggleBtn.title = 'Collapse Height';
            toggleBtn.classList.add('height-btn-active');
        } else {
            // 当前是small，显示"展开"图标（maximize-2）
            toggleIcon.setAttribute('data-lucide', 'maximize-2');
            toggleBtn.title = 'Expand Height';
            toggleBtn.classList.remove('height-btn-active');
        }

        // 重新初始化图标
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * 主渲染函数（渲染所有 UI）
     */
    render() {
        // 确保元素已初始化
        if (!this.elements) {
            this.initElements();
        }
        
        // 渲染各个组件
        this.renderFilterBar();
        this.renderNotes();
        this.updateSelectedTagsLabel();
        this.updateInputEditState();
        this.updateHeightButton();
        
        // 重新初始化 Lucide 图标（因为DOM可能已更新）
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
        }
    }
};

// ============================================================================
// Toast & Modal Module - 通知和弹窗管理
// ============================================================================
const Toast = {
    toastTimeout: null,

    /**
     * 显示 Toast 通知
     * @param {string} message - 消息文本
     * @param {boolean} allowUndo - 是否显示撤销按钮
     */
    show(message, allowUndo = false) {
        const toast = Render.elements.toast;
        const toastMsg = Render.elements.toastMsg;
        const undoBtn = Render.elements.undoBtn;
        const icon = document.getElementById('toast-icon');

        toastMsg.innerText = message;

        if (allowUndo) {
            undoBtn.classList.remove('hidden');
            if (icon) icon.setAttribute('data-lucide', 'trash-2');
        } else {
            undoBtn.classList.add('hidden');
            if (icon) icon.setAttribute('data-lucide', 'check-circle-2');
        }

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        toast.classList.remove('translate-y-32', 'opacity-0');
        clearTimeout(this.toastTimeout);
        
        this.toastTimeout = setTimeout(() => {
            toast.classList.add('translate-y-32', 'opacity-0');
            setTimeout(() => {
                undoBtn.classList.add('hidden');
                UndoManager.clear();
            }, 300);
        }, 4000);
    }
};

const Modal = {
    /**
     * 显示添加分类对话框
     */
    showAddCategory() {
        Render.elements.newCategoryInput.value = '';
        Render.elements.addCategoryDialog.showModal();
    },

    /**
     * 关闭添加分类对话框
     */
    closeAddCategory() {
        Render.elements.addCategoryDialog.close();
    },

    /**
     * 显示重命名分类对话框
     */
    showRenameTag() {
        if (Render.elements.renameTagDialog) {
            Render.elements.renameTagDialog.showModal();
        }
    },

    /**
     * 关闭重命名分类对话框
     */
    closeRenameTag() {
        if (Render.elements.renameTagDialog) {
            Render.elements.renameTagDialog.close();
            State.editingTagId = null;
        }
    }
};

// ============================================================================
// Actions Module - 用户操作处理
// ============================================================================
const Actions = {
    /**
     * 添加或更新笔记
     */
    addOrUpdateNote() {
        const input = Render.elements.input;
        const text = input.value.trim();
        
        if (!text) return;

        if (State.editingNoteId !== null) {
            // 更新笔记
            const success = State.updateNote(
                State.editingNoteId,
                text,
                State.selectedInputTags
            );
            if (success) {
                Toast.show('Note updated');
            }
            State.setEditingNote(null);
        } else {
            // 添加新笔记
            State.addNote(text, State.selectedInputTags);
            Toast.show('Note added');
        }

        // 清空输入
        input.value = '';
        State.selectedInputTags = [];
        Render.render();
    },

    /**
     * 编辑笔记
     * @param {number} id - 笔记 ID
     */
    editNote(id) {
        const note = State.notes.find(n => n.id === id);
        if (!note) return;

        const input = Render.elements.input;
        input.value = note.content;
        State.selectedInputTags = [...note.categories];
        State.setEditingNote(id);

        window.scrollTo({ top: 0, behavior: 'smooth' });
        input.focus();
        Render.render();
    },

    /**
     * 删除笔记
     * @param {number} id - 笔记 ID
     */
    deleteNote(id) {
        const deletedData = State.deleteNote(id);
        if (deletedData) {
            UndoManager.saveDelete(deletedData);
            Render.render();
            Toast.show('Note deleted', true);
        }
    },

    /**
     * 撤销删除操作
     */
    undoAction() {
        if (UndoManager.undo()) {
            Render.render();
            Toast.show('Action undone');
        }
    },

    /**
     * 复制到剪贴板
     * @param {number} id - 笔记 ID
     */
    async copyToClipboard(id) {
        const note = State.notes.find(n => n.id === id);
        if (!note) return;

        try {
            await navigator.clipboard.writeText(note.content);
            Toast.show('Copied to clipboard');
        } catch (err) {
            // 降级方案
            const ta = document.createElement("textarea");
            ta.value = note.content;
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                Toast.show('Copied');
            } catch (e) {
                Toast.show('Copy failed');
            }
            document.body.removeChild(ta);
        }
    },

    /**
     * 切换笔记展开/折叠
     * @param {number} id - 笔记 ID
     */
    toggleExpand(id) {
        State.toggleNoteExpand(id);
        Render.render();
    },

    /**
     * 切换过滤标签
     * @param {string} category - 分类名称
     */
    toggleFilter(category) {
        State.toggleFilter(category);
        Render.render();
        // 如果搜索浮层打开，更新浮层显示
        if (State.tagSearchDropdownOpen) {
            Render.renderTagSearchDropdown();
        }
    },

    /**
     * 切换输入标签选择
     * @param {string} category - 分类名称
     */
    toggleInputTag(category) {
        State.toggleInputTag(category);
        Render.renderTagDropdown();
        Render.updateSelectedTagsLabel();
    },

    /**
     * 确认添加分类
     */
    confirmAddCategory() {
        const input = Render.elements.newCategoryInput;
        const inputVal = input.value.trim();
        
        const tagId = State.addCategory(inputVal);
        if (tagId) {
            Modal.closeAddCategory();
            Render.render();
            Render.renderTagDropdown();
            Toast.show(`Category "${inputVal}" added`);
        }
    },

    /**
     * 显示添加子标签对话框
     * @param {string} parentTagId - 父标签ID
     */
    showAddChildCategoryDialog(parentTagId) {
        const tagName = prompt('输入新子标签名称:');
        if (tagName && tagName.trim()) {
            const tagId = State.addCategory(tagName.trim(), parentTagId);
            if (tagId) {
                Render.renderTagDropdown();
                Toast.show(`子标签 "${tagName}" 已添加`);
            } else {
                Toast.show('标签名称已存在或添加失败');
            }
        }
    },

    /**
     * 编辑分类（打开重命名对话框）
     * @param {string} tagId - 标签ID
     */
    editCategory(tagId) {
        const tag = State.getTagById(tagId);
        if (!tag) return;
        
        State.editingTagId = tagId;
        const input = Render.elements.renameTagInput;
        if (input) {
            input.value = tag.name;
            Modal.showRenameTag();
        }
    },

    /**
     * 确认重命名分类
     */
    confirmRenameTag() {
        const tagId = State.editingTagId;
        const input = Render.elements.renameTagInput;
        if (!input || !tagId) return;

        const tag = State.getTagById(tagId);
        if (!tag) return;

        const oldName = tag.name;
        const newName = input.value.trim();
        
        if (State.renameCategory(tagId, newName)) {
            Modal.closeRenameTag();
            Render.render();
            Render.renderTagDropdown();
            Toast.show(`Tag renamed from "${oldName}" to "${newName}"`);
        } else {
            if (newName === '') {
                Toast.show('Tag name cannot be empty');
            } else {
                Toast.show(`Tag name "${newName}" already exists in this level`);
            }
        }
    },

    /**
     * 删除分类
     * @param {string} tagId - 标签ID
     */
    deleteCategory(tagId) {
        const tag = State.getTagById(tagId);
        if (!tag) return;
        
        const tagName = State.getTagFullName(tagId) || tag.name;
        if (confirm(`Permanently delete tag "${tagName}"? This will remove it from all notes.`)) {
            State.deleteCategory(tagId);
            Render.render();
            Render.renderTagDropdown();
            Toast.show(`Tag "${tagName}" deleted`);
        }
    },

    /**
     * 处理tag搜索（搜索浮层内的搜索）
     * @param {string} query - 搜索查询
     */
    searchTags(query) {
        // 如果正在输入中文，不触发搜索
        if (State.isComposing) {
            return;
        }
        State.tagSearchQuery = query;
        Render.renderTagSearchDropdown();
    },

    /**
     * 切换标签搜索浮层
     */
    toggleTagSearchDropdown() {
        State.tagSearchDropdownOpen = !State.tagSearchDropdownOpen;
        
        if (!State.tagSearchDropdownOpen) {
            // 关闭时不清空搜索词，保留用户输入
            State.isComposing = false;
        }
        
        // 重新渲染过滤栏以更新按钮状态和浮层显示
        Render.renderFilterBar();
        
        // 如果打开浮层，聚焦搜索输入框
        if (State.tagSearchDropdownOpen) {
            setTimeout(() => {
                const searchInput = document.getElementById('tag-search-dropdown-input');
                if (searchInput) {
                    searchInput.focus();
                    // 如果输入框有内容，将光标移到末尾
                    if (searchInput.value) {
                        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
                    }
                }
            }, 100);
        }
    },

    /**
     * 关闭标签搜索浮层
     */
    closeTagSearchDropdown() {
        State.tagSearchDropdownOpen = false;
        // 不清空搜索词，保留用户输入以便下次打开时继续使用
        State.isComposing = false;
        Render.renderFilterBar();
    },

    /**
     * 打开标签选择器
     * @param {string} parentTagId - 父标签ID
     */
    openTagSelector(parentTagId) {
        State.openTagSelector(parentTagId);
        Render.renderFilterBar();
    },

    /**
     * 关闭标签选择器
     */
    closeTagSelector() {
        State.goHomeTagSelector();
        Render.renderFilterBar();
    },

    /**
     * 进入标签选择器的子级
     * @param {string} tagId - 子标签ID
     */
    enterTagSelector(tagId) {
        State.enterTagSelector(tagId);
        Render.renderFilterBar();
    },

    /**
     * 返回到标签选择器的根目录
     */
    goHomeTagSelector() {
        State.goHomeTagSelector();
        Render.renderFilterBar();
    },

    /**
     * 跳转到标签选择器的指定路径
     * @param {number} index - 路径索引
     */
    jumpToTagSelector(index) {
        State.jumpToTagSelector(index);
        Render.renderFilterBar();
    },

    /**
     * 在标签选择器中选择标签
     * @param {string} tagId - 标签ID
     */
    selectTagInSelector(tagId) {
        State.toggleTagInSelector(tagId);
        Render.render();
    },

    /**
     * 在标签选择器中添加标签
     */
    addTagInSelector() {
        const currentPath = State.tagSelectPath;
        const parentId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;
        const tagName = prompt('输入新标签名称:');
        if (tagName && tagName.trim()) {
            const tagId = State.addCategory(tagName.trim(), parentId);
            if (tagId) {
                Render.renderFilterBar();
                Toast.show(`标签 "${tagName}" 已添加`);
            } else {
                Toast.show('标签名称已存在或添加失败');
            }
        }
    },

    /**
     * 在标签选择器中编辑标签
     * @param {string} tagId - 标签ID
     */
    editTagInSelector(tagId) {
        const tag = State.getTagById(tagId);
        if (!tag) return;
        
        Actions.editCategory(tagId);
    },

    /**
     * 在标签选择器中删除标签
     * @param {string} tagId - 标签ID
     */
    deleteTagInSelector(tagId) {
        const tag = State.getTagById(tagId);
        if (!tag) return;
        
        const tagName = State.getTagFullName(tagId) || tag.name;
        if (confirm(`确定要删除标签 "${tagName}" 吗？其下所有子标签也会被删除！`)) {
            State.deleteCategory(tagId);
            Render.renderFilterBar();
            Render.render();
            Toast.show(`标签 "${tagName}" 已删除`);
        }
    },

    /**
     * 从搜索浮层中切换过滤标签（不关闭浮层）
     * @param {string} tagId - 标签ID
     */
    toggleFilterFromSearch(tagId) {
        State.toggleFilter(tagId);
        // 只更新标签列表的选中状态，不关闭浮层，不清空搜索
        Render.renderTagSearchDropdown();
        Render.renderFilterBar();
    },

    /**
     * 移除已选过滤器
     * @param {string} tagId - 标签ID
     */
    removeFilter(tagId) {
        if (State.activeFilters.includes(tagId)) {
            State.activeFilters = State.activeFilters.filter(id => id !== tagId);
            Render.render();
        }
    },

    /**
     * 处理tag拖拽
     * @param {number} fromIndex - 源索引
     * @param {number} toIndex - 目标索引
     */
    moveTag(fromIndex, toIndex) {
        if (State.moveCategory(fromIndex, toIndex)) {
            Render.render();
            Render.renderTagDropdown();
        }
    },

    /**
     * 移动子级标签（在同一父级下重新排序）
     * @param {string} parentTagId - 父级标签ID
     * @param {number} fromIndex - 源索引
     * @param {number} toIndex - 目标索引
     */
    moveChildTag(parentTagId, fromIndex, toIndex) {
        if (State.moveChildCategory(parentTagId, fromIndex, toIndex)) {
            Render.renderFilterBar();
        }
    },

    /**
     * 设置筛选模式
     * @param {string} mode - 'OR' 或 'AND'
     */
    setFilterMode(mode) {
        State.setFilterMode(mode);
        Render.render();
    },

    /**
     * 切换输入框高度（在small和large之间切换）
     */
    toggleInputHeight() {
        const input = Render.elements.input;
        if (!input) return;
        
        // 切换高度：small <-> large
        const newHeight = State.currentInputHeight === 'small' ? 'large' : 'small';
        
        // 移除所有高度类
        input.classList.remove('h-32', 'h-64', 'h-96');
        
        // 添加新的高度类
        const hClass = newHeight === 'small' ? 'h-32' : 'h-96';
        input.classList.add(hClass);
        
        // 更新状态
        State.currentInputHeight = newHeight;
        
        // 更新按钮图标和样式
        Render.updateHeightButton();
    },

    /**
     * 切换标签下拉菜单显示
     */
    toggleTagDropdown() {
        const menu = Render.elements.tagDropdownMenu;
        const btn = document.getElementById('tag-dropdown-btn');
        
        if (!menu || !btn) return;
        
        menu.classList.toggle('hidden');
        if (!menu.classList.contains('hidden')) {
            Render.renderTagDropdown();
            
            // 确保菜单始终向下展开（top-full）
            menu.classList.remove('bottom-full', 'mb-2');
            menu.classList.add('top-full', 'mt-2');
            
            // 调整水平位置，避免超出屏幕边界
            setTimeout(() => {
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const btnRect = btn.getBoundingClientRect();
                const padding = 16; // 左右留出16px的边距
                const isSmallScreen = viewportWidth < 640; // sm断点
                
                // 小屏幕下的特殊处理
                if (isSmallScreen) {
                    // 在小屏幕上，菜单应该贴合搜索框边缘或居中
                    const containerRect = btn.closest('#tag-dropdown-container')?.getBoundingClientRect();
                    if (containerRect) {
                        // 计算菜单应该的位置，确保不超出屏幕
                        const maxMenuWidth = viewportWidth - padding * 2;
                        const containerLeft = containerRect.left;
                        
                        // 如果容器在屏幕左侧，菜单左对齐
                        if (containerLeft < padding) {
                            menu.style.left = `${padding - containerLeft}px`;
                            menu.style.right = 'auto';
                        } 
                        // 如果容器在屏幕右侧，菜单右对齐
                        else if (containerLeft + maxMenuWidth > viewportWidth - padding) {
                            menu.style.left = 'auto';
                            menu.style.right = `${viewportWidth - containerRect.right - padding}px`;
                        }
                        // 否则保持默认左对齐
                        else {
                            menu.style.left = '0';
                            menu.style.right = 'auto';
                        }
                        
                        // 确保最大宽度不超过视口
                        menu.style.maxWidth = `${maxMenuWidth}px`;
                        menu.style.width = `${maxMenuWidth}px`;
                    }
                } else {
                    // 大屏幕下的处理
                    const menuRect = menu.getBoundingClientRect();
                    const menuWidth = menuRect.width || 384;
                    
                    // 检查右侧是否超出
                    if (btnRect.left + menuWidth > viewportWidth - padding) {
                        // 如果超出右侧，调整到右侧对齐
                        const maxLeft = padding;
                        if (btnRect.right - menuWidth >= maxLeft) {
                            menu.style.left = 'auto';
                            menu.style.right = '0';
                        } else {
                            // 如果右侧对齐也会超出，则左对齐并限制最大宽度
                            menu.style.left = `${maxLeft - btnRect.left}px`;
                            menu.style.right = 'auto';
                            menu.style.maxWidth = `${viewportWidth - maxLeft * 2}px`;
                        }
                    } else if (btnRect.left < padding) {
                        // 如果左侧超出，左对齐并限制位置
                        menu.style.left = `${padding - btnRect.left}px`;
                        menu.style.right = 'auto';
                        menu.style.maxWidth = `${viewportWidth - padding * 2}px`;
                    } else {
                        // 重置为默认位置
                        menu.style.left = '0';
                        menu.style.right = 'auto';
                        menu.style.maxWidth = '';
                        menu.style.width = '';
                    }
                }
                
                // 确保菜单高度不超过视口（向下展开时，需要考虑按钮下方的可用空间）
                setTimeout(() => {
                    const menuRect = menu.getBoundingClientRect();
                    const btnRect = btn.getBoundingClientRect();
                    const availableSpaceBelow = viewportHeight - btnRect.bottom - padding;
                    const maxMenuHeight = Math.min(320, availableSpaceBelow - 8); // 8px是mt-2的间距
                    
                    if (maxMenuHeight > 200) {
                        menu.style.maxHeight = `${maxMenuHeight}px`;
                    } else {
                        // 如果下方空间不足，至少保证最小高度
                        menu.style.maxHeight = `${Math.max(200, availableSpaceBelow - 8)}px`;
                    }
                }, 10);
            }, 0);
        }
    },

    /**
     * 关闭所有下拉菜单
     * @param {Event} e - 点击事件
     */
    closeDropdowns(e) {
        // 排除触发按钮本身，避免"瞬间关闭又打开"的问题
        const tagDropdownBtn = e.target.closest('#tag-dropdown-btn');
        const tagSearchBtn = e.target.closest('#tag-search-button');
        if (tagDropdownBtn || tagSearchBtn) {
            return; // 如果是点击按钮本身，不处理
        }

        const tagDropdownContainer = document.getElementById('tag-dropdown-container');
        // 如果点击不在下拉菜单容器内，关闭下拉菜单
        if (tagDropdownContainer && !e.target.closest('#tag-dropdown-container')) {
            const menu = Render.elements.tagDropdownMenu;
            if (menu) {
                menu.classList.add('hidden');
            }
        }

        // 如果点击不在搜索浮层容器内，关闭搜索浮层
        const tagSearchDropdown = Render.elements.tagSearchDropdown;
        const tagSearchButtonWrapper = document.getElementById('tag-search-button-wrapper');
        if (tagSearchDropdown && tagSearchButtonWrapper && 
            !e.target.closest('#tag-search-button-wrapper')) {
            Actions.closeTagSearchDropdown();
        }
    }
};

// ============================================================================
// Events Module - 事件绑定和管理
// ============================================================================
const Events = {
    /**
     * 初始化所有事件监听器
     */
    init() {
        // 添加/更新笔记按钮
        const addUpdateBtn = document.getElementById('add-update-btn');
        if (addUpdateBtn) {
            addUpdateBtn.addEventListener('click', () => Actions.addOrUpdateNote());
        }

        // 文本域快捷键 (Cmd+Enter / Ctrl+Enter)
        const input = Render.elements.input;
        if (input) {
            input.addEventListener('keydown', (e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    Actions.addOrUpdateNote();
                }
            });
        }

        // 标签下拉按钮
        const tagDropdownBtn = document.getElementById('tag-dropdown-btn');
        if (tagDropdownBtn) {
            tagDropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                Actions.toggleTagDropdown();
            });
        }

        // 标签下拉菜单事件委托（处理动态创建的按钮和标签选择）
        const tagDropdownMenu = Render.elements.tagDropdownMenu;
        if (tagDropdownMenu) {
            tagDropdownMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // 处理右列子级标签的选择
                const childLabel = e.target.closest('label[data-tag-category][data-action="toggle-input-tag"]');
                if (childLabel) {
                    const tagId = childLabel.dataset.tagCategory;
                    e.preventDefault();
                    Actions.toggleInputTag(tagId);
                    return;
                }
                
                // 处理左列父级标签
                const parentLabel = e.target.closest('label[data-tag-id]');
                if (parentLabel) {
                    const tagId = parentLabel.dataset.tagId || parentLabel.dataset.tagCategory;
                    const action = parentLabel.dataset.action;
                    
                    // 如果点击的是checkbox或其容器，切换标签选择
                    if (e.target.type === 'checkbox' || 
                        e.target.closest('.tag-checkbox') || 
                        e.target.closest('input[type="checkbox"]') ||
                        e.target.classList.contains('w-4') ||
                        e.target.closest('.w-4')) {
                        e.preventDefault();
                        Actions.toggleInputTag(tagId);
                        return;
                    }
                    
                    // 如果点击的是其他区域（标签名、图标等），切换父级选择（显示子级）
                    if (action === 'select-parent-tag' && tagId) {
                        if (State.selectedParentTagId === tagId) {
                            State.selectedParentTagId = null; // 取消选择
                        } else {
                            State.selectedParentTagId = tagId; // 选择新的父级
                        }
                        Render.renderTagDropdown();
                        return;
                    }
                }
                
                // 处理其他操作
                const clickedElement = e.target.closest('[data-action]');
                const action = clickedElement?.dataset.action;
                if (action === 'show-add-category-dialog') {
                    Modal.showAddCategory();
                } else if (action === 'show-add-child-category-dialog') {
                    const parentTagId = clickedElement?.dataset.parentTagId;
                    if (parentTagId) {
                        Actions.showAddChildCategoryDialog(parentTagId);
                    }
                }
            });
        }

        // 高度控制按钮（切换按钮）
        const heightToggleBtn = document.getElementById('btn-h-toggle');
        if (heightToggleBtn) {
            heightToggleBtn.addEventListener('click', () => Actions.toggleInputHeight());
        }

        // 标签搜索按钮
        document.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'toggle-tag-search') {
                e.stopPropagation();
                Actions.toggleTagSearchDropdown();
            }
        });

        // 搜索浮层内的搜索输入框事件处理（支持中文输入）
        document.addEventListener('compositionstart', (e) => {
            if (e.target.id === 'tag-search-dropdown-input') {
                State.isComposing = true;
            }
        });

        document.addEventListener('compositionend', (e) => {
            if (e.target.id === 'tag-search-dropdown-input') {
                State.isComposing = false;
                // 中文输入完成后再触发搜索
                Actions.searchTags(e.target.value);
            }
        });

        // 非中文输入时，使用 input 事件实时搜索
        document.addEventListener('input', (e) => {
            if (e.target.id === 'tag-search-dropdown-input' && !State.isComposing) {
                Actions.searchTags(e.target.value);
            }
        });

        // 搜索浮层内标签点击事件（动态创建，使用事件委托）
        document.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            const tagId = e.target.closest('[data-tag-id]')?.dataset.tagId;
            
            if (action === 'toggle-filter-from-search' && tagId) {
                e.stopPropagation();
                Actions.toggleFilterFromSearch(tagId);
            } else if (action === 'remove-filter' && tagId) {
                e.stopPropagation();
                Actions.removeFilter(tagId);
            } else if (action === 'set-filter-mode') {
                e.stopPropagation();
                const mode = e.target.closest('[data-mode]')?.dataset.mode;
                if (mode) {
                    Actions.setFilterMode(mode);
                }
            }
        });

        // 分类过滤栏事件委托
        const categoryFilterContainer = Render.elements.categoryFilterContainer;
        if (categoryFilterContainer) {
            categoryFilterContainer.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;
                const tagId = e.target.closest('[data-tag-id]')?.dataset.tagId;
                const parentTagId = e.target.closest('[data-parent-tag-id]')?.dataset.parentTagId;
                const category = e.target.closest('[data-category]')?.dataset.category; // 兼容All按钮
                
                if (action === 'open-tag-selector' && parentTagId) {
                    e.stopPropagation();
                    Actions.openTagSelector(parentTagId);
                } else if (action === 'filter' && category) {
                    e.stopPropagation();
                    Actions.toggleFilter(category); // All按钮
                } else if (action === 'edit-category' && tagId) {
                    e.stopPropagation();
                    Actions.editCategory(tagId);
                } else if (action === 'delete-category' && tagId) {
                    e.stopPropagation();
                    Actions.deleteCategory(tagId);
                } else if (action === 'show-add-category-dialog') {
                    e.stopPropagation();
                    Modal.showAddCategory();
                }
            });

            // Tag拖拽事件
            let draggedElement = null;
            let draggedIndex = -1;

            categoryFilterContainer.addEventListener('dragstart', (e) => {
                const tagElement = e.target.closest('.draggable-tag');
                if (tagElement) {
                    draggedElement = tagElement;
                    draggedIndex = parseInt(tagElement.dataset.tagIndex);
                    tagElement.style.opacity = '0.5';
                    e.dataTransfer.effectAllowed = 'move';
                }
            });

            categoryFilterContainer.addEventListener('dragend', (e) => {
                if (draggedElement) {
                    draggedElement.style.opacity = '1';
                    draggedElement = null;
                    draggedIndex = -1;
                }
            });

            categoryFilterContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const tagElement = e.target.closest('.draggable-tag');
                if (tagElement && draggedElement && tagElement !== draggedElement) {
                    const targetIndex = parseInt(tagElement.dataset.tagIndex);
                    const allTags = Array.from(categoryFilterContainer.querySelectorAll('.draggable-tag'));
                    const draggedRect = draggedElement.getBoundingClientRect();
                    const targetRect = tagElement.getBoundingClientRect();
                    const midY = targetRect.top + targetRect.height / 2;
                    
                    if (e.clientY < midY) {
                        // 插入到目标之前
                        tagElement.parentNode.insertBefore(draggedElement, tagElement);
                    } else {
                        // 插入到目标之后
                        tagElement.parentNode.insertBefore(draggedElement, tagElement.nextSibling);
                    }
                }
            });

            categoryFilterContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedElement) {
                    const allTags = Array.from(categoryFilterContainer.querySelectorAll('.draggable-tag'));
                    const newIndex = allTags.indexOf(draggedElement);
                    
                    if (newIndex !== -1 && draggedIndex !== newIndex) {
                        Actions.moveTag(draggedIndex, newIndex);
                    }
                    
                    draggedElement = null;
                    draggedIndex = -1;
                }
            });
        }

        // 笔记容器事件委托
        const notesContainer = Render.elements.container;
        if (notesContainer) {
            notesContainer.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;
                const noteId = parseInt(e.target.closest('[data-note-id]')?.dataset.noteId);
                
                if (!action || !noteId) return;

                switch (action) {
                    case 'copy':
                        Actions.copyToClipboard(noteId);
                        break;
                    case 'edit':
                        Actions.editNote(noteId);
                        break;
                    case 'delete':
                        Actions.deleteNote(noteId);
                        break;
                    case 'toggle-expand':
                        Actions.toggleExpand(noteId);
                        break;
                }
            });
        }

        // 添加分类对话框事件
        const addCategoryDialog = Render.elements.addCategoryDialog;
        if (addCategoryDialog) {
            // 关闭按钮
            const closeBtns = addCategoryDialog.querySelectorAll('[data-action="close-dialog"]');
            closeBtns.forEach(btn => {
                btn.addEventListener('click', () => Modal.closeAddCategory());
            });

            // 取消按钮
            const cancelBtns = addCategoryDialog.querySelectorAll('[data-action="cancel-dialog"]');
            cancelBtns.forEach(btn => {
                btn.addEventListener('click', () => Modal.closeAddCategory());
            });

            // 确认按钮
            const confirmBtn = addCategoryDialog.querySelector('[data-action="confirm-add-category"]');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => Actions.confirmAddCategory());
            }

            // 回车键确认
            const newCategoryInput = Render.elements.newCategoryInput;
            if (newCategoryInput) {
                newCategoryInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        Actions.confirmAddCategory();
                    }
                });
            }
        }

        // 撤销按钮
        const undoBtn = Render.elements.undoBtn;
        if (undoBtn) {
            undoBtn.addEventListener('click', () => Actions.undoAction());
        }

        // 重命名分类对话框事件
        const renameTagDialog = Render.elements.renameTagDialog;
        if (renameTagDialog) {
            // 关闭按钮
            const closeBtns = renameTagDialog.querySelectorAll('[data-action="close-rename-dialog"]');
            closeBtns.forEach(btn => {
                btn.addEventListener('click', () => Modal.closeRenameTag());
            });

            // 取消按钮
            const cancelBtns = renameTagDialog.querySelectorAll('[data-action="cancel-rename-dialog"]');
            cancelBtns.forEach(btn => {
                btn.addEventListener('click', () => Modal.closeRenameTag());
            });

            // 确认按钮
            const confirmBtn = renameTagDialog.querySelector('[data-action="confirm-rename-tag"]');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => Actions.confirmRenameTag());
            }

            // 回车键确认
            const renameTagInput = Render.elements.renameTagInput;
            if (renameTagInput) {
                renameTagInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        Actions.confirmRenameTag();
                    }
                });
            }
        }

        // 全局点击关闭下拉菜单
        document.addEventListener('click', (e) => {
            Actions.closeDropdowns(e);
        });

        // 标签选择器拖拽事件处理
        let draggedTagItem = null;
        let draggedTagIndex = -1;
        let draggedTagParentId = null;

        document.addEventListener('dragstart', (e) => {
            const tagItem = e.target.closest('.draggable-tag-item');
            if (tagItem && tagItem.draggable) {
                draggedTagItem = tagItem;
                draggedTagIndex = parseInt(tagItem.dataset.childIndex);
                draggedTagParentId = tagItem.dataset.parentTagId;
                tagItem.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        document.addEventListener('dragend', (e) => {
            if (draggedTagItem) {
                draggedTagItem.style.opacity = '1';
                draggedTagItem = null;
                draggedTagIndex = -1;
                draggedTagParentId = null;
            }
        });

        document.addEventListener('dragover', (e) => {
            const tagItem = e.target.closest('.draggable-tag-item');
            if (tagItem && draggedTagItem && tagItem !== draggedTagItem && 
                tagItem.dataset.parentTagId === draggedTagParentId) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const targetRect = tagItem.getBoundingClientRect();
                const midY = targetRect.top + targetRect.height / 2;
                
                if (e.clientY < midY) {
                    tagItem.parentNode.insertBefore(draggedTagItem, tagItem);
                } else {
                    tagItem.parentNode.insertBefore(draggedTagItem, tagItem.nextSibling);
                }
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedTagItem && draggedTagParentId) {
                const tagList = draggedTagItem.parentNode;
                const allItems = Array.from(tagList.querySelectorAll('.draggable-tag-item'));
                const newIndex = allItems.indexOf(draggedTagItem);
                
                if (newIndex !== -1 && draggedTagIndex !== newIndex) {
                    Actions.moveChildTag(draggedTagParentId, draggedTagIndex, newIndex);
                }
                
                draggedTagItem = null;
                draggedTagIndex = -1;
                draggedTagParentId = null;
            }
        });

        // 标签选择器事件委托
        document.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            const tagId = e.target.closest('[data-tag-id]')?.dataset.tagId;
            const index = e.target.closest('[data-index]')?.dataset.index;
            
            if (action === 'close-tag-selector') {
                e.stopPropagation();
                Actions.closeTagSelector();
            } else if (action === 'tag-selector-home') {
                e.stopPropagation();
                Actions.goHomeTagSelector();
            } else if (action === 'tag-selector-jump' && index !== undefined) {
                e.stopPropagation();
                Actions.jumpToTagSelector(parseInt(index));
            } else if (action === 'tag-selector-enter' && tagId) {
                e.stopPropagation();
                Actions.enterTagSelector(tagId);
            } else if (action === 'tag-selector-select' && tagId) {
                e.stopPropagation();
                Actions.selectTagInSelector(tagId);
            } else if (action === 'add-tag-in-selector') {
                e.stopPropagation();
                Actions.addTagInSelector();
            } else if (action === 'edit-tag-in-selector' && tagId) {
                e.stopPropagation();
                Actions.editTagInSelector(tagId);
            } else if (action === 'delete-tag-in-selector' && tagId) {
                e.stopPropagation();
                Actions.deleteTagInSelector(tagId);
            }
        });
    }
};

// ============================================================================
// Initialization - 应用初始化
// ============================================================================
function init() {
    // 初始化状态
    State.init();
    
    // 初始化渲染模块的 DOM 引用
    Render.initElements();
    
    // 初始化事件监听
    Events.init();
    
    // 初始渲染
    Render.render();
    Render.renderTagDropdown();
    
    // 初始化 Lucide 图标
    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
    }
}

// DOMContentLoaded 时初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

