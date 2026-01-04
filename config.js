/**
 * ClipFlow - Configuration & Utility Functions
 * 基础常量、全局工具函数
 */

// ============================================================================
// Constants
// ============================================================================
// 项目列表存储键
const PROJECTS_STORAGE_KEY = 'clipflow_projects';

// 动态生成存储键（基于项目ID）
function getStorageKey(projectId) {
    return `clipflow_notes_${projectId}`;
}

function getCatStorageKey(projectId) {
    return `clipflow_categories_${projectId}`;
}

// 标签ID生成器
let tagIdCounter = 1;
/**
 * 🔥 修复：生成唯一的标签ID，确保绝对唯一性
 * @param {Object} tagMap - 标签映射表（可选），用于检查ID唯一性
 * @returns {string} 唯一的标签ID
 */
function generateTagId(tagMap = null) {
    let tagId;
    let attempts = 0;
    const maxAttempts = 100; // 增加最大尝试次数，确保能生成唯一ID
    
    // 🔥 修复：优先使用传入的 tagMap 参数，如果没有则尝试从 State 获取
    const checkMap = tagMap || (typeof State !== 'undefined' && State.tagMap ? State.tagMap : null);
    
    // 使用 while 循环确保生成的 ID 是绝对唯一的
    while (true) {
        // 每次循环都获取新的时间戳，确保唯一性
        const timestamp = Date.now();
        
        // 生成随机部分
        let randomPart;
        
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            // 🔥 修复：使用 crypto API 生成更安全的随机数
            try {
                const array = new Uint8Array(8);
                crypto.getRandomValues(array);
                randomPart = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
            } catch (e) {
                // 如果 crypto.getRandomValues 失败，使用降级方案
                const random1 = Math.random().toString(36).substr(2, 9);
                const random2 = Math.random().toString(36).substr(2, 9);
                const random3 = Math.random().toString(36).substr(2, 5);
                randomPart = `${random1}_${random2}_${random3}`;
            }
        } else {
            // 🔥 降级方案：使用 Math.random 组合生成随机数
            // 添加更多随机性以确保唯一性
            const random1 = Math.random().toString(36).substr(2, 9);
            const random2 = Math.random().toString(36).substr(2, 9);
            const random3 = Math.random().toString(36).substr(2, 9);
            randomPart = `${random1}_${random2}_${random3}`;
        }
        
        // 生成ID（使用时间戳和随机部分）
        tagId = `tag_${timestamp}_${randomPart}`;
        
        attempts++;
        
        // 🔥 修复：检查ID是否已存在于 tagMap 中
        if (checkMap && checkMap[tagId]) {
            // ID 已存在，继续循环生成新的ID
            if (attempts >= maxAttempts) {
                // 如果达到最大尝试次数仍未找到唯一ID，使用备用方案
                // 添加额外的随机后缀和计数器
                const fallbackRandom = Math.random().toString(36).substr(2, 7);
                tagId = `tag_${timestamp}_${randomPart}_${attempts}_${fallbackRandom}`;
                console.warn('generateTagId: 达到最大尝试次数，使用备用ID生成方案', { attempts, tagId });
                // 即使使用备用方案，也再次检查唯一性
                if (!checkMap[tagId]) {
                    break;
                }
                // 如果备用方案仍然冲突，继续尝试（理论上几乎不可能）
                continue;
            }
            continue;
        } else {
            // ID 不存在，是唯一的，退出循环
            break;
        }
    }
    
    return tagId;
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
// 🔥 重构：存储对树中对象的引用，而不是副本，确保数据一致性
function buildTagMap(categories, tagMap = {}) {
    Object.keys(categories).forEach(tagId => {
        const tag = categories[tagId];
        if (tag && tag.id) {
            // 🔥 关键：直接存储对树中对象的引用，而不是创建副本
            // 这样修改 tagMap[tagId] 或 categories 中的对象，两边都会同步更新
            tagMap[tagId] = tag;
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

