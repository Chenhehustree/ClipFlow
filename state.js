/**
 * ClipFlow - State Module
 * 搴旂敤鐘舵€佺鐞哷n */

// ============================================================================
// State Module - 应用状态管理
// ============================================================================
const State = {
    // 🔥 修复：开发环境调试标志
    _debug: typeof window !== 'undefined' && window.location.hostname === 'localhost',
    
    // 项目管理状态
    projects: [], // 项目列表
    currentProjectId: null, // 当前选中的项目ID
    
    // 核心状态
    notes: [], // categories数组存储tag ID
    categories: {}, // 树形结构：{ tagId: { id, name, parentId, children: {}, order: [] } }
    rootOrder: [], // 🔥 根层级标签的顺序数组，存储顶层标签ID
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
    addingTagParentId: null, // 临时状态：在标签选择器中添加标签时的父标签ID

    /**
     * 初始化状态（从 Storage 加载）
     */
    init() {
        // 加载项目列表
        this.projects = Storage.loadProjects();
        
        // 冷启动逻辑：如果项目列表为空，创建默认项目并直接进入笔记视图
        if (this.projects.length === 0) {
            const defaultProject = {
                id: Date.now().toString(),
                name: '默认项目',
                cover: 'linear-gradient(135deg, #e9d5ff 0%, #fae8ff 100%)',
                createdAt: Date.now()
            };
            this.projects.push(defaultProject);
            Storage.saveProjects(this.projects);
            this.currentProjectId = defaultProject.id;
        } else {
            // 如果有项目，默认停留在九宫格页面（不设置currentProjectId）
            this.currentProjectId = null;
        }
        
        // 如果有当前项目，加载项目数据
        if (this.currentProjectId) {
            this.loadProjectData(this.currentProjectId);
        } else {
            // 初始化空状态
            this.notes = [];
            this.categories = {};
            this.rootOrder = [];
            this.tagMap = {};
        }
        
        // 重置其他状态
        this.activeFilters = [];
        this.filterMode = 'OR';
        this.editingNoteId = null;
        this.selectedInputTags = [];
        this.tagSearchQuery = '';
        this.editingTagId = null;
        this.tagSearchDropdownOpen = false;
        this.isComposing = false;
        this.currentInputHeight = 'small';
        this.tagSelectPath = [];
        this.selectedParentTagId = null;
        this.addingTagParentId = null;
    },

    /**
     * 加载指定项目的数据
     * 🔥 重构：增加空值检查和排序数组初始化
     * @param {string} projectId - 项目ID
     */
    loadProjectData(projectId) {
        // 🔥 重构：防御性编程 - 空值检查
        if (!projectId || typeof projectId !== 'string') {
            console.warn('loadProjectData: 无效的 projectId', projectId);
            // 初始化为空状态
            this.notes = [];
            this.categories = {};
            this.rootOrder = [];
            this.tagMap = {};
            return;
        }
        
        this.currentProjectId = projectId;
        // 先加载 categories，然后加载 notes（传入 categories 用于数据迁移）
        this.categories = Storage.loadCategories(projectId);
        this.notes = Storage.loadNotes(projectId, this.categories);
        
        // 🔥 重构：初始化排序数组（如果不存在）
        this.initializeOrderArrays();
        
        // 🔥 关键：生成全局 tagMap 索引表
        this.rebuildTagMap();
        
        // 保存迁移后的数据（如果数据有变化）
        Storage.saveCategories(projectId, this.categories);
        Storage.saveNotes(projectId, this.notes);
    },

    /**
     * 🔥 初始化排序数组：为每个层级生成 order 数组（如果不存在）
     * 用于向后兼容：旧数据可能没有 order 字段
     */
    initializeOrderArrays() {
        // 初始化根层级的 order
        if (!this.rootOrder || !Array.isArray(this.rootOrder) || this.rootOrder.length === 0) {
            // 根据现有对象键生成初始顺序
            this.rootOrder = Object.keys(this.categories).filter(tagId => {
                const tag = this.categories[tagId];
                return tag && !tag.parentId; // 只包含顶层标签
            });
        }
        
        // 递归初始化每个标签的 order 数组
        const initOrderRecursive = (children) => {
            if (!children || typeof children !== 'object') return;
            
            Object.keys(children).forEach(tagId => {
                const tag = children[tagId];
                if (tag && typeof tag === 'object') {
                    // 如果标签没有 order 数组，根据 children 对象的键生成
                    if (!tag.order || !Array.isArray(tag.order) || tag.order.length === 0) {
                        if (tag.children && typeof tag.children === 'object') {
                            tag.order = Object.keys(tag.children);
                        } else {
                            tag.order = [];
                        }
                    }
                    // 递归处理子标签
                    if (tag.children && typeof tag.children === 'object') {
                        initOrderRecursive(tag.children);
                    }
                }
            });
        };
        
        // 从根层级开始递归
        initOrderRecursive(this.categories);
    },

    /**
     * 🔥 修复：重置UI临时状态（项目切换时调用）
     */
    resetTempState() {
        this.activeFilters = [];
        this.tagSearchQuery = '';
        this.tagSelectPath = [];
        this.selectedParentTagId = null;
        this.tagSearchDropdownOpen = false;
        this.editingNoteId = null;
        this.selectedInputTags = [];
        this.editingTagId = null;
        this.isComposing = false;
        this.currentInputHeight = 'small';
        this.addingTagParentId = null;
    },

    /**
     * 🔥 修复：统一的保存函数，包含异常处理和错误恢复
     * 保存当前项目的数据
     */
    saveCurrentProjectData() {
        if (!this.currentProjectId) {
            return;
        }
        
        try {
            Storage.saveCategories(this.currentProjectId, this.categories);
            Storage.saveNotes(this.currentProjectId, this.notes);
        } catch (error) {
            // 🔥 修复：处理存储异常
            if (error.name === 'QuotaExceededError') {
                // localStorage 空间不足
                console.error('Storage quota exceeded');
                if (typeof Toast !== 'undefined') {
                    Toast.show('存储空间不足，请清理一些数据');
                }
                
                // 尝试清理无效数据
                try {
                    this._cleanupInvalidStorage();
                    // 重试保存
                    Storage.saveCategories(this.currentProjectId, this.categories);
                    Storage.saveNotes(this.currentProjectId, this.notes);
                } catch (retryError) {
                    console.error('Failed to save after cleanup:', retryError);
                }
            } else {
                console.error('Failed to save project data:', error);
                if (typeof Toast !== 'undefined') {
                    Toast.show('保存失败，请重试');
                }
            }
        }
    },

    /**
     * 🔥 修复：清理无效的存储数据
     * 删除已不存在项目的残余键值
     */
    _cleanupInvalidStorage() {
        const projectIds = new Set(this.projects.map(p => p.id));
        const allKeys = Object.keys(localStorage);
        
        allKeys.forEach(key => {
            // 检查是否是项目相关的键
            if (key.startsWith('clipflow_notes_') || key.startsWith('clipflow_categories_')) {
                const projectId = key.replace(/^clipflow_(notes|categories)_/, '');
                // 如果项目不存在，删除该键
                if (!projectIds.has(projectId) && projectId !== 'v2' && projectId !== 'v3') {
                    localStorage.removeItem(key);
                    console.log(`Cleaned up invalid storage key: ${key}`);
                }
            }
        });
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
     * 🔥 重构：使用 tagMap 的 O(1) 查找，直接返回引用（tagMap 中存储的是对树中对象的引用）
     * @param {string} tagId - 标签ID
     * @returns {Object|null} 标签节点对象
     */
    getTagById(tagId) {
        if (!tagId || !this.tagMap[tagId]) {
            return null; // 空值检查
        }
        // 🔥 重构：直接通过 tagMap 返回，因为 tagMap 中存储的是对 categories 树中对象的引用
        // 这样既实现了 O(1) 查找，又保证了数据一致性
        return this.tagMap[tagId];
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
     * 🔥 重构：使用 getTagById 的 O(1) 查找替代递归遍历
     * @returns {Object} 当前路径下的标签树
     */
    getCurrentTagTree() {
        let target = this.categories;
        // 🔥 清理无效的路径（如果路径中的标签已被删除）
        const validPath = [];
        for (const tagId of this.tagSelectPath) {
            if (tagId && this.tagMap[tagId]) {
                // 🔥 重构：使用 getTagById 的 O(1) 查找
                const tag = this.getTagById(tagId);
                if (tag) {
                    // 🔥 修复：如果找到了tag，无论是否有children，都应该使用它的children（如果没有则使用空对象）
                    // 这样可以确保进入某个父级tag时，只显示该父级的子类，而不是回退到根目录的所有tag
                    target = tag.children || {};
                    validPath.push(tagId);
                } else {
                    // 路径中断，停止遍历
                    break;
                }
            } else {
                // 标签不存在，停止遍历
                break;
            }
        }
        // 🔥 如果路径被清理，更新 tagSelectPath
        if (validPath.length !== this.tagSelectPath.length) {
            this.tagSelectPath = validPath;
        }
        return target;
    },

    /**
     * 获取所有父级标签（顶层标签）
     * 🔥 重构：按照 rootOrder 的顺序返回，确保 UI 显示顺序稳定
     * @returns {Array} 父级标签数组 [{ id, name, ... }]
     */
    getParentTags() {
        const parentTags = Object.values(this.categories).filter(tag => !tag.parentId);
        
        // 🔥 重构：如果存在 rootOrder，按照 rootOrder 的顺序返回
        if (this.rootOrder && Array.isArray(this.rootOrder) && this.rootOrder.length > 0) {
            // 按照 rootOrder 的顺序排序
            const orderedTags = [];
            const tagMap = {};
            parentTags.forEach(tag => {
                tagMap[tag.id] = tag;
            });
            
            // 先按照 rootOrder 的顺序添加
            this.rootOrder.forEach(tagId => {
                if (tagMap[tagId]) {
                    orderedTags.push(tagMap[tagId]);
                    delete tagMap[tagId];
                }
            });
            
            // 添加不在 rootOrder 中的标签（向后兼容）
            Object.values(tagMap).forEach(tag => {
                orderedTags.push(tag);
            });
            
            return orderedTags;
        }
        
        // 如果没有 rootOrder，返回原始顺序（向后兼容）
        return parentTags;
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
     * 🔥 修复：确保递归获取所有层级的后代标签，实现向上兼容筛选
     * @param {string} tagId - 标签ID
     * @returns {Array} 包含该标签及其所有子标签的ID数组（包含所有层级）
     */
    getAllDescendantIds(tagId) {
        // 🔥 修复：空值检查和类型检查
        if (!tagId || typeof tagId !== 'string') {
            return [];
        }
        
        const result = [tagId]; // 包含自身
        const tag = this.getTagById(tagId);
        
        // 🔥 修复：如果标签不存在，只返回自身ID（避免错误）
        if (!tag) {
            return result;
        }
        
        // 🔥 修复：递归获取所有层级的子标签
        const collectChildren = (children) => {
            if (!children || typeof children !== 'object') {
                return;
            }
            
            Object.keys(children).forEach(childId => {
                // 🔥 修复：确保 childId 是有效的字符串
                if (!childId || typeof childId !== 'string') {
                    return;
                }
                // 添加子标签ID
                result.push(childId);
                
                // 🔥 修复：递归处理子标签的子标签（支持多层级）
                const childTag = children[childId];
                if (childTag && childTag.children && typeof childTag.children === 'object' && Object.keys(childTag.children).length > 0) {
                    collectChildren(childTag.children);
                }
            });
        };
        
        // 如果有子标签，递归收集所有后代
        if (tag.children && typeof tag.children === 'object' && Object.keys(tag.children).length > 0) {
            collectChildren(tag.children);
        }
        
        // 🔥 修复：去重并过滤无效值
        return [...new Set(result.filter(id => id && typeof id === 'string'))];
    },

    /**
     * 获取过滤后的笔记列表
     * 🔥 重构：AND 模式下的父子兼容性处理，去冗余和向上兼容
     * @returns {Array} 过滤后的笔记数组
     */
    getFilteredNotes() {
        // 🔥 重构：性能拦截 - 如果 activeFilters 为空或无效，直接返回
        if (!this.activeFilters || !Array.isArray(this.activeFilters) || this.activeFilters.length === 0) {
            return this.notes;
        }
        
        // 🔥 重构：去冗余处理 - 如果 activeFilters 中同时包含了"父标签"和"其子标签"，移除父标签
        // 因为选中子标签隐含了对父类范围的缩小
        const deduplicatedFilters = [...this.activeFilters];
        const toRemove = new Set();
        
        for (let i = 0; i < deduplicatedFilters.length; i++) {
            const tagId = deduplicatedFilters[i];
            if (!tagId || typeof tagId !== 'string') continue;
            
            // 获取该标签的所有后代ID
            const descendantIds = this.getAllDescendantIds(tagId);
            
            // 检查是否有任何后代也在 activeFilters 中
            for (let j = 0; j < deduplicatedFilters.length; j++) {
                if (i !== j && descendantIds.includes(deduplicatedFilters[j])) {
                    // 如果父标签的子标签也在过滤器中，标记父标签为待移除
                    toRemove.add(tagId);
                    break;
                }
            }
        }
        
        // 移除冗余的父标签
        const cleanedFilters = deduplicatedFilters.filter(tagId => !toRemove.has(tagId));
        
        // 🔥 重构：如果没有有效的过滤器，返回所有笔记
        if (cleanedFilters.length === 0) {
            return this.notes;
        }
        
        // 🔥 重构：扩展 cleanedFilters，将每个选中的标签扩展为其自身及其所有后代的ID集合
        // 这样当选中父标签（如"场景"）时，会自动包含所有子标签（如"咖啡厅"、"办公室"）的笔记
        const expandedFiltersList = cleanedFilters.map(tagId => {
            // 确保 tagId 是有效的字符串
            if (!tagId || typeof tagId !== 'string') {
                return [];
            }
            // 获取该标签及其所有子标签的ID（递归获取所有层级）
            const descendantIds = this.getAllDescendantIds(tagId);
            // 确保返回的是有效的ID数组
            return descendantIds.filter(id => id && typeof id === 'string');
        }).filter(set => set.length > 0); // 过滤掉空集合
        
        // 🔥 重构：如果没有有效的过滤器，返回所有笔记
        if (expandedFiltersList.length === 0) {
            return this.notes;
        }
        
        // 🔥 重构：将所有选中标签的ID扁平化为一个数组（用于OR模式），并去重
        const allFilterIds = [...new Set(expandedFiltersList.flat())];
        
        // 🔥 重构：根据 filterMode 决定使用 AND 还是 OR 模式
        if (this.filterMode === 'AND') {
            // 交集（AND）模式：笔记必须同时包含所有选中的标签（或其子标签）
            // 🔥 重构：向上兼容 - 支持"笔记包含标签 A 且 包含标签 B（或 B 的子类）"
            return this.notes.filter(note => {
                // 确保笔记有categories属性
                if (!note.categories || !Array.isArray(note.categories) || note.categories.length === 0) {
                    return false;
                }
                
                // 对于每个选中的标签集合，笔记必须至少包含该集合中的一个ID
                // 使用 .every() 确保所有条件都满足
                return expandedFiltersList.every(expandedSet => {
                    return note.categories.some(catId => {
                        if (!catId || typeof catId !== 'string') return false;
                        return expandedSet.includes(catId);
                    });
                });
            });
        } else {
            // 并集（OR）模式：笔记只要包含任意一个选中的标签（或其子标签）就显示
            return this.notes.filter(note => {
                // 确保笔记有categories属性
                if (!note.categories || !Array.isArray(note.categories) || note.categories.length === 0) {
                    return false;
                }
                
                // 笔记必须至少包含一个选中的标签ID（或其子标签ID）
                return note.categories.some(catId => {
                    if (!catId || typeof catId !== 'string') return false;
                    return allFilterIds.includes(catId);
                });
            });
        }
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
        this.saveCurrentProjectData();
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
            this.saveCurrentProjectData();
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
            
            this.saveCurrentProjectData();
            return { note: deletedNote, index: index };
        }
        return null;
    },

    /**
     * 🔥 修复：撤销删除笔记操作（重命名以匹配新的Undo系统）
     * @param {Object} deletedData - 包含 note 和 index 的对象
     */
    undoDeleteNote(deletedData) {
        if (deletedData && deletedData.note) {
            if (deletedData.index >= 0 && deletedData.index <= this.notes.length) {
                this.notes.splice(deletedData.index, 0, deletedData.note);
            } else {
                this.notes.push(deletedData.note);
            }
            this.saveCurrentProjectData();
            return true;
        }
        return false;
    },

    /**
     * 🔥 兼容：撤销删除操作（向后兼容）
     * @param {Object} deletedData - 包含 note 和 index 的对象
     */
    undoDelete(deletedData) {
        return this.undoDeleteNote(deletedData);
    },

    /**
     * 🔥 修复：撤销删除标签操作
     * @param {Object} tagSnapshot - 标签快照数据
     * @returns {boolean} 是否撤销成功
     */
    undoDeleteTag(tagSnapshot) {
        if (!tagSnapshot || !tagSnapshot.tagId) {
            return false;
        }

        try {
            const { tagId, tagData, parentId, parentOrderIndex, rootOrderIndex } = tagSnapshot;

            // 深度克隆标签数据以避免引用问题
            const restoreTag = JSON.parse(JSON.stringify(tagData));

            // 恢复标签到树中
            if (parentId) {
                const parent = this.getTagById(parentId);
                if (parent) {
                    if (!parent.children) {
                        parent.children = {};
                    }
                    parent.children[tagId] = restoreTag;
                    
                    // 恢复order数组中的位置
                    if (parent.order && Array.isArray(parent.order) && parentOrderIndex !== undefined) {
                        parent.order.splice(parentOrderIndex, 0, tagId);
                    }
                }
            } else {
                // 顶层标签
                this.categories[tagId] = restoreTag;
                
                // 恢复rootOrder中的位置
                if (this.rootOrder && Array.isArray(this.rootOrder) && rootOrderIndex !== undefined) {
                    this.rootOrder.splice(rootOrderIndex, 0, tagId);
                }
            }

            // 重建tagMap（包含所有子标签）
            this.rebuildTagMap();

            this.saveCurrentProjectData();
            return true;
        } catch (error) {
            console.error('Failed to undo delete tag:', error);
            return false;
        }
    },

    /**
     * 🔥 修复：撤销重命名标签操作
     * @param {Object} renameSnapshot - 重命名快照数据
     * @returns {boolean} 是否撤销成功
     */
    undoRenameTag(renameSnapshot) {
        if (!renameSnapshot || !renameSnapshot.tagId || !renameSnapshot.oldName) {
            return false;
        }

        const { tagId, oldName } = renameSnapshot;
        const tag = this.getTagById(tagId);
        
        if (!tag) {
            return false;
        }

        // 恢复旧名称
        tag.name = oldName;
        
        // tagMap存储的是引用，会自动同步
        this.saveCurrentProjectData();
        return true;
    },

    /**
     * 切换笔记展开/折叠状态
     * @param {number} id - 笔记 ID
     */
    toggleNoteExpand(id) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            note.expanded = !note.expanded;
            this.saveCurrentProjectData();
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
     * 🔥 重构：确保"单源真理"，tagMap 中存储的是对 categories 树中对象的引用
     * @param {string} categoryName - 分类名称
     * @param {string} parentId - 父标签ID（可选）
     * @returns {string|null} 新创建的标签ID，失败返回null
     */
    addCategory(categoryName, parentId = null) {
        if (!categoryName || !categoryName.trim()) return null;
        
        // 🔥 修复：确保正确获取目标容器
        let target;
        let parentTag = null;
        
        if (parentId) {
            // 如果有父标签ID，获取父标签对象
            parentTag = this.getTagById(parentId);
            if (!parentTag) {
                // 父标签不存在，返回null
                return null;
            }
            // 🔥 修复：确保父标签有 children 对象，如果没有则创建
            if (!parentTag.children) {
                parentTag.children = {};
            }
            target = parentTag.children;
        } else {
            // 如果没有父标签ID，使用当前路径的标签树
            target = this.getCurrentTagTree();
        }
        
        // 检查同级是否有同名标签
        const nameExists = Object.values(target).some(tag => tag.name === categoryName.trim());
        if (nameExists) return null;
        
        // 🔥 修复：传入 tagMap 确保ID唯一性
        const tagId = generateTagId(this.tagMap);
        // 🔥 重构：先创建标签对象并插入到 categories 树中
        const newTag = {
            id: tagId,
            name: categoryName.trim(),
            parentId: parentId,
            children: {},
            order: [] // 🔥 排序数组：存储子标签ID的顺序
        };
        target[tagId] = newTag;
        
        // 🔥 重构：更新排序数组
        if (parentId) {
            // 如果是子标签，更新父标签的 order 数组
            if (!parentTag.order || !Array.isArray(parentTag.order)) {
                parentTag.order = [];
            }
            parentTag.order.push(tagId);
        } else {
            // 如果是顶层标签，更新 rootOrder
            if (!this.rootOrder || !Array.isArray(this.rootOrder)) {
                this.rootOrder = [];
            }
            this.rootOrder.push(tagId);
        }
        
        // 🔥 重构：将同一对象的引用存入 tagMap，而不是创建副本
        // 这样修改任一处，两边数据都会同步更新
        this.tagMap[tagId] = newTag;
        
        this.saveCurrentProjectData();
        return tagId;
    },

    /**
     * 重命名分类（只需修改name属性，ID保持不变）- 使用 tagMap
     * 🔥 重构：由于 tagMap 存储的是引用，只需更新 tag.name 即可
     * 🔥 修复：返回快照数据用于撤销
     * @param {string} tagId - 标签ID
     * @param {string} newName - 新分类名称
     * @returns {Object|boolean} 如果成功返回包含oldName的快照对象，失败返回false
     */
    renameCategory(tagId, newName) {
        if (!newName || !newName.trim() || !tagId) {
            return false;
        }
        
        const tag = this.getTagById(tagId);
        if (!tag) {
            return false; // 空值检查
        }
        
        // 🔥 修复：保存旧名称用于撤销
        const oldName = tag.name;
        
        // 检查同级是否有同名标签
        const parent = tag.parentId ? this.getTagById(tag.parentId) : null;
        const siblings = parent ? (parent.children || {}) : this.categories;
        const nameExists = Object.keys(siblings).some(id => 
            id !== tagId && siblings[id].name === newName.trim()
        );
        if (nameExists) {
            return false;
        }
        
        // 🔥 重构：只需更新name属性，由于 tagMap 存储的是引用，会自动同步
        tag.name = newName.trim();
        
        this.saveCurrentProjectData();
        // 不需要更新notes，因为notes存储的是ID
        
        // 🔥 修复：返回快照数据用于撤销
        return {
            tagId: tagId,
            oldName: oldName
        };
    },

    /**
     * 删除分类（递归删除所有子标签）- 使用 tagMap
     * 🔥 重构：使用 getAllDescendantIds 一次性收集所有待删除 ID，使用 Set 进行批量操作
     * 🔥 修复：返回快照数据用于撤销
     * @param {string} tagId - 标签ID
     * @returns {Object|null} 返回删除快照数据（用于撤销），如果删除失败返回null
     */
    deleteCategory(tagId) {
        if (!tagId || !this.tagMap[tagId]) {
            return; // 空值检查
        }
        
        const tag = this.getTagById(tagId);
        if (!tag) return null;
        
        // 🔥 修复：保存删除前的快照数据（用于撤销）
        const parent = tag.parentId ? this.getTagById(tag.parentId) : null;
        const parentId = tag.parentId || null;
        let parentOrderIndex = null;
        let rootOrderIndex = null;
        
        if (parentId && parent && parent.order) {
            parentOrderIndex = parent.order.indexOf(tagId);
        } else if (!parentId && this.rootOrder) {
            rootOrderIndex = this.rootOrder.indexOf(tagId);
        }
        
        // 深度克隆标签数据（包括所有子标签）
        const tagSnapshot = JSON.parse(JSON.stringify(tag));
        
        // 🔥 重构：使用 getAllDescendantIds 一次性收集所有待删除的 ID（包括自身）
        const allIdsToDelete = this.getAllDescendantIds(tagId);
        const idsSet = new Set(allIdsToDelete); // 使用 Set 进行 O(1) 查找
        
        // 🔥 修复：级联清理笔记中的标签引用（增强防御性编程）
        if (this.notes && Array.isArray(this.notes)) {
            this.notes.forEach((note, index) => {
                try {
                    // 🔥 防御性编程：确保 note 存在且 categories 是数组
                    if (!note || typeof note !== 'object') {
                        console.warn(`deleteCategory: 笔记 ${index} 不是有效对象，跳过`);
                        return;
                    }
                    
                    // 如果 categories 字段不存在或不是数组，初始化为空数组
                    if (!note.categories) {
                        note.categories = [];
                    } else if (!Array.isArray(note.categories)) {
                        console.warn(`deleteCategory: 笔记 ${note.id || index} 的 categories 不是数组，已重置为空数组`);
                        note.categories = [];
                    }
                    
                    // 过滤掉所有需要删除的标签ID
                    const originalLength = note.categories.length;
                    note.categories = note.categories.filter(id => {
                        // 🔥 防御性编程：确保 id 是有效的字符串
                        if (!id || typeof id !== 'string') {
                            return false; // 过滤掉无效的ID
                        }
                        return !idsSet.has(id);
                    });
                    
                    // 可选：如果删除了标签，记录日志（仅在开发环境）
                    if (note.categories.length !== originalLength && this._debug) {
                        console.log(`deleteCategory: 从笔记 ${note.id || index} 中移除了 ${originalLength - note.categories.length} 个标签引用`);
                    }
                } catch (error) {
                    console.error(`deleteCategory: 处理笔记 ${index} 时出错`, error);
                    // 出错时，至少确保 categories 是数组，避免后续崩溃
                    if (note) {
                        note.categories = Array.isArray(note.categories) ? note.categories : [];
                    }
                }
            });
        } else {
            console.warn('deleteCategory: this.notes 不存在或不是数组');
        }
        
        // 🔥 重构：一次性清理 activeFilters 和 selectedInputTags
        this.activeFilters = this.activeFilters.filter(id => !idsSet.has(id));
        this.selectedInputTags = this.selectedInputTags.filter(id => !idsSet.has(id));
        
        // 🔥 重构：一次性清理 tagSelectPath
        this.tagSelectPath = this.tagSelectPath.filter(id => !idsSet.has(id));
        
        // 🔥 重构：清除 selectedParentTagId（如果匹配）
        if (idsSet.has(this.selectedParentTagId)) {
            this.selectedParentTagId = null;
        }
        
        // 🔥 重构：从 tagMap 中批量删除
        idsSet.forEach(id => {
            if (this.tagMap[id]) {
                delete this.tagMap[id];
            }
        });
        
        // 🔥 重构：从树中递归删除（需要递归删除树结构）
        const deleteFromTree = (tree, targetId) => {
            if (tree[targetId]) {
                // 先递归删除子节点
                if (tree[targetId].children) {
                    Object.keys(tree[targetId].children).forEach(childId => {
                        deleteFromTree(tree[targetId].children, childId);
                    });
                }
                // 然后删除自身
                delete tree[targetId];
            }
        };
        
        // 从树中删除
        const target = parent ? (parent.children || {}) : this.categories;
        deleteFromTree(target, tagId);
        
        // 🔥 重构：更新排序数组
        if (parent) {
            // 如果是子标签，从父标签的 order 数组中移除
            if (parent.order && Array.isArray(parent.order)) {
                parent.order = parent.order.filter(id => id !== tagId);
            }
        } else {
            // 如果是顶层标签，从 rootOrder 中移除
            if (this.rootOrder && Array.isArray(this.rootOrder)) {
                this.rootOrder = this.rootOrder.filter(id => id !== tagId);
            }
        }
        
        // 🔥 如果删除后 categories 为空，重置相关状态
        if (Object.keys(this.categories).length === 0) {
            this.tagSelectPath = [];
            this.selectedParentTagId = null;
            this.rootOrder = [];
        }
        
        this.saveCurrentProjectData();
        
        // 🔥 修复：返回快照数据用于撤销
        return {
            tagId: tagId,
            tagData: tagSnapshot,
            parentId: parentId,
            parentOrderIndex: parentOrderIndex,
            rootOrderIndex: rootOrderIndex
        };
    },

    /**
     * 移动分类位置（在树形结构中，通过改变 order 数组实现）
     * 🔥 重构：操作 rootOrder 数组而不是重组整个对象
     * @param {number} fromIndex - 源索引
     * @param {number} toIndex - 目标索引
     */
    moveCategory(fromIndex, toIndex) {
        // 🔥 重构：使用 rootOrder 数组
        if (!this.rootOrder || !Array.isArray(this.rootOrder)) {
            this.initializeOrderArrays();
        }
        
        if (fromIndex < 0 || fromIndex >= this.rootOrder.length ||
            toIndex < 0 || toIndex >= this.rootOrder.length ||
            fromIndex === toIndex) {
            return false;
        }
        
        // 🔥 重构：操作 order 数组
        const fromTagId = this.rootOrder[fromIndex];
        this.rootOrder.splice(fromIndex, 1);
        this.rootOrder.splice(toIndex, 0, fromTagId);
        
        // 🔥 可选：根据 order 数组重建 categories 对象（保持对象键顺序与 order 一致）
        // 但这不是必须的，因为我们可以通过 order 数组来获取顺序
        const newCategories = {};
        this.rootOrder.forEach(tagId => {
            if (this.categories[tagId]) {
                newCategories[tagId] = this.categories[tagId];
            }
        });
        // 添加不在 order 中的标签（向后兼容）
        Object.keys(this.categories).forEach(tagId => {
            if (!this.rootOrder.includes(tagId)) {
                newCategories[tagId] = this.categories[tagId];
            }
        });
        this.categories = newCategories;
        
        this.saveCurrentProjectData();
        return true;
    },

    /**
     * 移动子级标签（在同一父级下重新排序）
     * 🔥 重构：操作 order 数组而不是重组整个对象
     * @param {string} parentTagId - 父级标签ID
     * @param {number} fromIndex - 源索引
     * @param {number} toIndex - 目标索引
     * @returns {boolean} 是否移动成功
     */
    moveChildCategory(parentTagId, fromIndex, toIndex) {
        // 找到父级标签
        const parentTag = this.getTagById(parentTagId);
        if (!parentTag || !parentTag.children) {
            return false;
        }

        // 🔥 重构：使用 order 数组
        if (!parentTag.order || !Array.isArray(parentTag.order)) {
            // 如果不存在 order，根据 children 对象的键生成
            parentTag.order = Object.keys(parentTag.children);
        }
        
        if (fromIndex < 0 || fromIndex >= parentTag.order.length ||
            toIndex < 0 || toIndex >= parentTag.order.length ||
            fromIndex === toIndex) {
            return false;
        }

        // 🔥 重构：操作 order 数组
        const fromId = parentTag.order[fromIndex];
        parentTag.order.splice(fromIndex, 1);
        parentTag.order.splice(toIndex, 0, fromId);
        
        // 🔥 可选：根据 order 数组重建 children 对象（保持对象键顺序与 order 一致）
        const newChildren = {};
        parentTag.order.forEach(tagId => {
            if (parentTag.children[tagId]) {
                newChildren[tagId] = parentTag.children[tagId];
            }
        });
        // 添加不在 order 中的子标签（向后兼容）
        Object.keys(parentTag.children).forEach(tagId => {
            if (!parentTag.order.includes(tagId)) {
                newChildren[tagId] = parentTag.children[tagId];
            }
        });
        parentTag.children = newChildren;
        
        this.saveCurrentProjectData();
        return true;
    }
};
