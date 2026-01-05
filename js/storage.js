/**
 * ClipFlow - Storage Module
 * localStorage 读写管理
 */

// ============================================================================
// Storage Module - localStorage 读写管理
// ============================================================================
const Storage = {
    /**
     * 从 localStorage 加载笔记数据（支持数据迁移）
     * @param {string} projectId - 项目ID
     * @param {Object} categories - 可选的分类数据，用于数据迁移（避免循环依赖）
     * @returns {Array} 笔记数组
     */
    loadNotes(projectId, categories = null) {
        try {
            const storageKey = getStorageKey(projectId);
            const stored = localStorage.getItem(storageKey);
            let loaded = stored ? JSON.parse(stored) : defaultNotes;
            
            // 确保 loaded 是数组
            if (!Array.isArray(loaded)) {
                console.warn('Loaded notes is not an array, using default notes');
                loaded = defaultNotes;
            }
            
            // 数据迁移：将路径字符串转换为ID
            // 如果 categories 未提供，则加载（但要避免循环依赖）
            const catData = categories || this.loadCategories(projectId);
            
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
     * @param {string} projectId - 项目ID
     * @returns {Object} 分类树形对象 { tagId: { id, name, parentId, children } }
     */
    loadCategories(projectId) {
        try {
            const storageKey = getCatStorageKey(projectId);
            const stored = localStorage.getItem(storageKey);
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
            // 🔥 新项目返回空的categories，不包含默认标签
            return {};
        } catch (e) {
            // 🔥 出错时也返回空的categories
            return {};
        }
    },

    /**
     * 保存笔记数据到 localStorage
     * @param {string} projectId - 项目ID
     * @param {Array} notes - 笔记数组
     */
    saveNotes(projectId, notes) {
        const storageKey = getStorageKey(projectId);
        localStorage.setItem(storageKey, JSON.stringify(notes));
    },

    /**
     * 保存分类数据到 localStorage
     * @param {string} projectId - 项目ID
     * @param {Array} categories - 分类数组
     */
    saveCategories(projectId, categories) {
        const storageKey = getCatStorageKey(projectId);
        localStorage.setItem(storageKey, JSON.stringify(categories));
    },

    /**
     * 加载项目列表
     * @returns {Array} 项目数组
     */
    loadProjects() {
        try {
            const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Error loading projects:', e);
            return [];
        }
    },

    /**
     * 保存项目列表
     * @param {Array} projects - 项目数组
     */
    saveProjects(projects) {
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    }
};

