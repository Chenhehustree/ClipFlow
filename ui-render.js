/**
 * ClipFlow - UI Render Module
 * UI娓叉煋妯″潡锛堝寘鍚玌ndoManager, Utils, Render, Toast, Modal锛塦n */

// ============================================================================
// Undo Module - 撤销逻辑管理
// ============================================================================

// 🔥 修复：操作类型常量
const UNDO_ACTION_TYPES = {
    DELETE_NOTE: 'DELETE_NOTE',
    DELETE_TAG: 'DELETE_TAG',
    RENAME_TAG: 'RENAME_TAG'
};

const UndoManager = {
    lastAction: null,

    /**
     * 🔥 修复：保存操作快照（通用方法）
     * @param {string} actionType - 操作类型（UNDO_ACTION_TYPES）
     * @param {Object} actionData - 操作数据
     */
    saveAction(actionType, actionData) {
        this.lastAction = {
            type: actionType,
            data: actionData,
            timestamp: Date.now()
        };
    },

    /**
     * 🔥 兼容：保存删除笔记操作的数据（向后兼容）
     * @param {Object} deletedData - 包含 note 和 index 的对象
     */
    saveDelete(deletedData) {
        this.saveAction(UNDO_ACTION_TYPES.DELETE_NOTE, deletedData);
    },

    /**
     * 🔥 修复：执行撤销操作（支持多种操作类型）
     */
    undo() {
        if (!this.lastAction) {
            return false;
        }

        const { type, data } = this.lastAction;
        let success = false;

        switch (type) {
            case UNDO_ACTION_TYPES.DELETE_NOTE:
                success = State.undoDeleteNote(data);
                break;
            case UNDO_ACTION_TYPES.DELETE_TAG:
                success = State.undoDeleteTag(data);
                break;
            case UNDO_ACTION_TYPES.RENAME_TAG:
                success = State.undoRenameTag(data);
                break;
            default:
                console.warn('Unknown undo action type:', type);
                return false;
        }

        if (success) {
            this.lastAction = null;
            return true;
        }

        return false;
    },

    /**
     * 清除撤销数据
     */
    clear() {
        this.lastAction = null;
    },

    /**
     * 检查是否有可撤销的操作
     * @returns {boolean}
     */
    hasUndo() {
        return this.lastAction !== null;
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
            addTagInSelectorInput: document.getElementById('add-tag-in-selector-input'),
            addTagInSelectorDialog: document.getElementById('add-tag-in-selector-dialog'),
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

        // 🔥 修复：获取当前有效的标签树（getCurrentTagTree 内部已经处理了路径验证）
        let currentTree = State.getCurrentTagTree();
        
        // 🔥 修复：验证路径是否有效（如果路径中的标签不存在，getCurrentTagTree 会清理路径）
        // 如果路径被清理后为空，说明所有路径都无效，应该重置
        if (State.tagSelectPath.length === 0 && currentTree === State.categories) {
            // 路径已被清理，currentTree 已经是根目录，无需操作
        }
        
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
        
        // 🔥 重构：如果有父级路径，先显示"选择父级本身"选项（即使没有子类也要显示）
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

        // 🔥 修复：渲染右列：当前选中父级的子级标签
        // 必须判断：如果 State.selectedParentTagId 为空，右侧应显示"请选择父类"
        // 如果非空，仅渲染该父类下的 children 对象
        // 禁止回退：严禁在 selectedParentTagId 有值时，因为子类为空就默认去渲染 State.categories
        if (!State.selectedParentTagId) {
            // selectedParentTagId 为空，显示提示
            const emptyMsg = document.createElement('div');
            emptyMsg.className = "px-3 py-8 text-center text-xs text-zinc-400";
            emptyMsg.innerText = '请选择左侧父级标签';
            childList.appendChild(emptyMsg);
        } else {
            // selectedParentTagId 有值，获取该父级标签
            const parentTag = State.getTagById(State.selectedParentTagId);
            
            // 🔥 修复：如果 selectedParentTagId 指向的标签已被删除，清除它并显示提示
            if (!parentTag) {
                State.selectedParentTagId = null;
                const emptyMsg = document.createElement('div');
                emptyMsg.className = "px-3 py-8 text-center text-xs text-zinc-400";
                emptyMsg.innerText = '请选择左侧父级标签';
                childList.appendChild(emptyMsg);
            } else {
                // 父级标签存在，渲染该父级下的内容
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
                
                // 🔥 修复：如果有子类，显示子类列表；如果没有子类，不显示任何子类（但保留"（全部）"选项和创建按钮）
                if (hasChildren) {
                    // 只渲染该父类的 children，不渲染 State.categories
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
                // 🔥 修复：即使没有子类，也显示创建按钮（这样用户可以添加第一个子类）
                
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
            }
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
        
        // 🔥 修复：确保渲染顺序正确，先更新过滤栏（包括标签选择器），再更新笔记列表
        // 这样筛选逻辑才能正确工作
        this.renderFilterBar();
        // 🔥 修复：确保笔记列表在过滤栏之后渲染，这样筛选状态已经更新
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
    },

    /**
     * 显示在标签选择器中添加标签对话框
     */
    showAddTagInSelector() {
        const input = Render.elements.addTagInSelectorInput;
        if (input) {
            input.value = '';
            input.focus();
        }
        if (Render.elements.addTagInSelectorDialog) {
            Render.elements.addTagInSelectorDialog.showModal();
        }
    },

    /**
     * 关闭在标签选择器中添加标签对话框
     */
    closeAddTagInSelector() {
        if (Render.elements.addTagInSelectorDialog) {
            Render.elements.addTagInSelectorDialog.close();
            State.addingTagParentId = null;
        }
    }
};
