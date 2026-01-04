/**
 * ClipFlow - Events Module
 * 浜嬩欢缁戝畾鍜岀鐞哷n */

// ============================================================================
// Events Module - 事件绑定和管理
// ============================================================================
const Events = {
    // 🔥 修复：初始化标志，防止重复绑定全局监听器
    initialized: false,
    
    // 🔥 修复：存储事件监听器引用，以便清理
    _listeners: {
        // 全局监听器（document级别，只绑定一次）
        // 存储格式：{ key: { handler, eventType, useCapture } }
        global: {},
        // 局部监听器（动态容器，需要清理和重新绑定）
        local: {}
    },
    
    // 🔥 修复：开发环境调试标志
    _debug: typeof window !== 'undefined' && window.location.hostname === 'localhost',
    
    /**
     * 初始化所有事件监听器
     */
    init() {
        // 🔥 修复：如果已初始化，只重新绑定局部监听器（动态容器）
        if (this.initialized) {
            this._initLocalListeners();
            return;
        }
        
        // 初始化全局监听器（只绑定一次）
        this._initGlobalListeners();
        
        // 初始化局部监听器（动态容器）
        this._initLocalListeners();
        
        // 标记为已初始化
        this.initialized = true;
    },
    
    /**
     * 🔥 修复：初始化全局监听器（document级别，只绑定一次）
     */
    _initGlobalListeners() {
        // 🔥 修复：标签搜索按钮（全局监听器）
        const handleTagSearchToggle = (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'toggle-tag-search') {
                e.stopPropagation();
                Actions.toggleTagSearchDropdown();
            }
        };
        if (!this._listeners.global.tagSearchToggle) {
            document.addEventListener('click', handleTagSearchToggle);
            this._listeners.global.tagSearchToggle = {
                handler: handleTagSearchToggle,
                eventType: 'click',
                useCapture: false
            };
            if (this._debug) console.log('[Events] 绑定全局监听器: tagSearchToggle (click)');
        }

        // 🔥 修复：搜索浮层内的搜索输入框事件处理（支持中文输入，全局监听器）
        const handleCompositionStart = (e) => {
            if (e.target.id === 'tag-search-dropdown-input') {
                State.isComposing = true;
            }
        };
        if (!this._listeners.global.compositionStart) {
            document.addEventListener('compositionstart', handleCompositionStart);
            this._listeners.global.compositionStart = {
                handler: handleCompositionStart,
                eventType: 'compositionstart',
                useCapture: false
            };
            if (this._debug) console.log('[Events] 绑定全局监听器: compositionStart');
        }

        const handleCompositionEnd = (e) => {
            if (e.target.id === 'tag-search-dropdown-input') {
                State.isComposing = false;
                // 中文输入完成后再触发搜索
                Actions.searchTags(e.target.value);
            }
        };
        if (!this._listeners.global.compositionEnd) {
            document.addEventListener('compositionend', handleCompositionEnd);
            this._listeners.global.compositionEnd = {
                handler: handleCompositionEnd,
                eventType: 'compositionend',
                useCapture: false
            };
            if (this._debug) console.log('[Events] 绑定全局监听器: compositionEnd');
        }

        // 🔥 修复：非中文输入时，使用 input 事件实时搜索（全局监听器）
        const handleSearchInput = (e) => {
            if (e.target.id === 'tag-search-dropdown-input' && !State.isComposing) {
                Actions.searchTags(e.target.value);
            }
        };
        if (!this._listeners.global.searchInput) {
            document.addEventListener('input', handleSearchInput);
            this._listeners.global.searchInput = {
                handler: handleSearchInput,
                eventType: 'input',
                useCapture: false
            };
            if (this._debug) console.log('[Events] 绑定全局监听器: searchInput');
        }

        // 🔥 修复：搜索浮层内标签点击事件（动态创建，使用事件委托，全局监听器）
        const handleSearchTagClick = (e) => {
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
        };
        if (!this._listeners.global.searchTagClick) {
            document.addEventListener('click', handleSearchTagClick);
            this._listeners.global.searchTagClick = {
                handler: handleSearchTagClick,
                eventType: 'click',
                useCapture: false
            };
            if (this._debug) console.log('[Events] 绑定全局监听器: searchTagClick (click)');
        }

        // 🔥 重构：标签选择器事件委托 - 必须在 closeDropdowns 之前绑定，确保优先处理
        // 解耦 Action 和 ID 的获取，确保无论点击子元素还是父容器，都能拿到正确的指令和 ID
        const handleTagSelectorClick = (e) => {
            // 🔥 重构：只处理标签选择器面板内的点击事件
            const selectorPanel = e.target.closest('#tag-selector-panel');
            if (!selectorPanel) {
                return; // 不在标签选择器内，不处理
            }
            
            // 🔥 重构：解耦 Action 和 ID 的获取
            // 1. 获取最近的 data-action 元素（无论点击的是子元素还是父容器）
            const actionElement = e.target.closest('[data-action]');
            const action = actionElement?.dataset.action;
            
            // 2. 获取最近的 data-tag-id 容器（用于获取标签ID）
            // 优先从 actionElement 获取，否则从最近的 data-tag-id 元素获取
            const tagId = actionElement?.dataset.tagId || 
                         e.target.closest('[data-tag-id]')?.dataset.tagId;
            
            // 3. 获取其他属性（如 index）
            const index = actionElement?.dataset.index || 
                         e.target.closest('[data-index]')?.dataset.index;
            
            // 🔥 重构：使用 switch 结构统一处理不同的 data-action
            if (!action) {
                return; // 没有 action，不处理
            }
            
            e.stopPropagation(); // 阻止事件冒泡，防止触发 closeDropdowns
            
            switch (action) {
                case 'close-tag-selector':
                    Actions.closeTagSelector();
                    break;
                    
                case 'tag-selector-home':
                    Actions.goHomeTagSelector();
                    break;
                    
                case 'tag-selector-jump':
                    if (index !== undefined) {
                        Actions.jumpToTagSelector(parseInt(index));
                    }
                    break;
                    
                case 'tag-selector-enter':
                    if (tagId) {
                        Actions.enterTagSelector(tagId);
                    }
                    break;
                    
                case 'tag-selector-select':
                    if (tagId) {
                        Actions.selectTagInSelector(tagId);
                    }
                    break;
                    
                case 'add-tag-in-selector':
                    Actions.addTagInSelector();
                    break;
                    
                case 'edit-tag-in-selector':
                    if (tagId) {
                        Actions.editTagInSelector(tagId);
                    }
                    break;
                    
                case 'delete-tag-in-selector':
                    if (tagId) {
                        Actions.deleteTagInSelector(tagId);
                    }
                    break;
                    
                default:
                    // 未知的 action，不处理
                    break;
            }
        };
        if (!this._listeners.global.tagSelectorClick) {
            // 🔥 修复：使用捕获阶段，确保在 closeDropdowns 之前执行
            document.addEventListener('click', handleTagSelectorClick, true);
            this._listeners.global.tagSelectorClick = {
                handler: handleTagSelectorClick,
                eventType: 'click',
                useCapture: true
            };
            if (this._debug) console.log('[Events] 绑定全局监听器: tagSelectorClick (click, capture)');
        }

        // 🔥 修复：全局点击关闭下拉菜单（全局监听器）
        // 🔥 修复：必须在标签选择器事件之后绑定，避免干扰
        const handleCloseDropdowns = (e) => {
            Actions.closeDropdowns(e);
        };
        if (!this._listeners.global.closeDropdowns) {
            document.addEventListener('click', handleCloseDropdowns);
            this._listeners.global.closeDropdowns = {
                handler: handleCloseDropdowns,
                eventType: 'click',
                useCapture: false
            };
            if (this._debug) console.log('[Events] 绑定全局监听器: closeDropdowns (click)');
        }

        // 🔥 修复：标签选择器拖拽事件处理（全局监听器）
        // 使用模块级变量存储拖拽状态
        if (!this._dragState) {
            this._dragState = {
                draggedTagItem: null,
                draggedTagIndex: -1,
                draggedTagParentId: null
            };
        }

        const handleTagDragStart = (e) => {
            const tagItem = e.target.closest('.draggable-tag-item');
            if (tagItem && tagItem.draggable) {
                this._dragState.draggedTagItem = tagItem;
                this._dragState.draggedTagIndex = parseInt(tagItem.dataset.childIndex);
                this._dragState.draggedTagParentId = tagItem.dataset.parentTagId;
                tagItem.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
            }
        };
        if (!this._listeners.global.tagDragStart) {
            document.addEventListener('dragstart', handleTagDragStart);
            this._listeners.global.tagDragStart = {
                handler: handleTagDragStart,
                eventType: 'dragstart',
                useCapture: false
            };
            if (this._debug) console.log('[Events] 绑定全局监听器: tagDragStart');
        }

        const handleTagDragEnd = (e) => {
            if (this._dragState.draggedTagItem) {
                this._dragState.draggedTagItem.style.opacity = '1';
                this._dragState.draggedTagItem = null;
                this._dragState.draggedTagIndex = -1;
                this._dragState.draggedTagParentId = null;
            }
        };
        if (!this._listeners.global.tagDragEnd) {
            document.addEventListener('dragend', handleTagDragEnd);
            this._listeners.global.tagDragEnd = {
                handler: handleTagDragEnd,
                eventType: 'dragend',
                useCapture: false
            };
            if (this._debug) console.log('[Events] 绑定全局监听器: tagDragEnd');
        }

        const handleTagDragOver = (e) => {
            const tagItem = e.target.closest('.draggable-tag-item');
            if (tagItem && this._dragState.draggedTagItem && tagItem !== this._dragState.draggedTagItem && 
                tagItem.dataset.parentTagId === this._dragState.draggedTagParentId) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const targetRect = tagItem.getBoundingClientRect();
                const midY = targetRect.top + targetRect.height / 2;
                
                if (e.clientY < midY) {
                    tagItem.parentNode.insertBefore(this._dragState.draggedTagItem, tagItem);
                } else {
                    tagItem.parentNode.insertBefore(this._dragState.draggedTagItem, tagItem.nextSibling);
                }
            }
        };
        if (!this._listeners.global.tagDragOver) {
            document.addEventListener('dragover', handleTagDragOver);
            this._listeners.global.tagDragOver = {
                handler: handleTagDragOver,
                eventType: 'dragover',
                useCapture: false
            };
            if (this._debug) console.log('[Events] 绑定全局监听器: tagDragOver');
        }

        const handleTagDrop = (e) => {
            e.preventDefault();
            if (this._dragState.draggedTagItem && this._dragState.draggedTagParentId) {
                const tagList = this._dragState.draggedTagItem.parentNode;
                const allItems = Array.from(tagList.querySelectorAll('.draggable-tag-item'));
                const newIndex = allItems.indexOf(this._dragState.draggedTagItem);
                
                if (newIndex !== -1 && this._dragState.draggedTagIndex !== newIndex) {
                    Actions.moveChildTag(this._dragState.draggedTagParentId, this._dragState.draggedTagIndex, newIndex);
                }
                
                this._dragState.draggedTagItem = null;
                this._dragState.draggedTagIndex = -1;
                this._dragState.draggedTagParentId = null;
            }
        };
        if (!this._listeners.global.tagDrop) {
            document.addEventListener('drop', handleTagDrop);
            this._listeners.global.tagDrop = {
                handler: handleTagDrop,
                eventType: 'drop',
                useCapture: false
            };
            if (this._debug) console.log('[Events] 绑定全局监听器: tagDrop');
        }

        // 🔥 修复：标签选择器事件已在前面绑定（使用捕获阶段），这里不再重复绑定
    },
    
    /**
     * 🔥 修复：清理局部监听器（动态容器）
     */
    _cleanupLocalListeners() {
        let cleanedCount = 0;
        // 清理所有局部监听器
        Object.keys(this._listeners.local).forEach(key => {
            const listener = this._listeners.local[key];
            if (listener) {
                // 处理单个监听器
                if (listener.element && listener.handler) {
                    try {
                        listener.element.removeEventListener(listener.event, listener.handler);
                        cleanedCount++;
                        if (this._debug) console.log(`[Events] 清理局部监听器: ${key} (${listener.event})`);
                    } catch (error) {
                        console.warn(`[Events] 清理局部监听器失败: ${key}`, error);
                    }
                }
                // 处理多个监听器（如对话框）
                if (listener.handlers && Array.isArray(listener.handlers)) {
                    listener.handlers.forEach(({ element, handler, event }) => {
                        if (element && handler) {
                            try {
                                element.removeEventListener(event, handler);
                                cleanedCount++;
                                if (this._debug) console.log(`[Events] 清理局部监听器: ${key} (${event})`);
                            } catch (error) {
                                console.warn(`[Events] 清理局部监听器失败: ${key} (${event})`, error);
                            }
                        }
                    });
                }
            }
        });
        // 清空局部监听器引用
        this._listeners.local = {};
        if (this._debug && cleanedCount > 0) {
            console.log(`[Events] 清理完成，共清理 ${cleanedCount} 个局部监听器`);
        }
    },
    
    /**
     * 🔥 修复：初始化局部监听器（动态容器，每次需要重新绑定）
     */
    _initLocalListeners() {
        // 清理旧的局部监听器
        this._cleanupLocalListeners();

        // 🔥 修复：添加/更新笔记按钮（局部监听器，但元素持久存在，使用 idempotent 模式）
        const addUpdateBtn = document.getElementById('add-update-btn');
        if (addUpdateBtn && !this._listeners.local.addUpdateBtn) {
            const handler = () => Actions.addOrUpdateNote();
            addUpdateBtn.addEventListener('click', handler);
            this._listeners.local.addUpdateBtn = { element: addUpdateBtn, handler, event: 'click' };
        }

        // 🔥 修复：文本域快捷键 (Cmd+Enter / Ctrl+Enter)（局部监听器）
        const input = Render.elements.input;
        if (input && !this._listeners.local.inputKeydown) {
            const handler = (e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    Actions.addOrUpdateNote();
                }
            };
            input.addEventListener('keydown', handler);
            this._listeners.local.inputKeydown = { element: input, handler, event: 'keydown' };
        }

        // 🔥 修复：标签下拉按钮（局部监听器）
        const tagDropdownBtn = document.getElementById('tag-dropdown-btn');
        if (tagDropdownBtn && !this._listeners.local.tagDropdownBtn) {
            const handler = (e) => {
                e.stopPropagation();
                Actions.toggleTagDropdown();
            };
            tagDropdownBtn.addEventListener('click', handler);
            this._listeners.local.tagDropdownBtn = { element: tagDropdownBtn, handler, event: 'click' };
        }

        // 🔥 修复：标签下拉菜单事件委托（处理动态创建的按钮和标签选择，局部监听器）
        const tagDropdownMenu = Render.elements.tagDropdownMenu;
        if (tagDropdownMenu && !this._listeners.local.tagDropdownMenu) {
            const handler = (e) => {
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
                
                // 处理其他操作（按钮点击等）
                const clickedElement = e.target.closest('[data-action]');
                const action = clickedElement?.dataset.action;
                
                if (action === 'show-add-category-dialog') {
                    e.preventDefault();
                    e.stopPropagation();
                    Modal.showAddCategory();
                    return;
                }
                
                if (action === 'show-add-child-category-dialog') {
                    e.preventDefault();
                    e.stopPropagation();
                    const parentTagId = clickedElement?.dataset.parentTagId;
                    if (parentTagId) {
                        Actions.showAddChildCategoryDialog(parentTagId);
                    }
                    return;
                }
            };
            tagDropdownMenu.addEventListener('click', handler);
            this._listeners.local.tagDropdownMenu = { element: tagDropdownMenu, handler, event: 'click' };
        }

        // 🔥 修复：高度控制按钮（切换按钮，局部监听器）
        const heightToggleBtn = document.getElementById('btn-h-toggle');
        if (heightToggleBtn && !this._listeners.local.heightToggleBtn) {
            const handler = () => Actions.toggleInputHeight();
            heightToggleBtn.addEventListener('click', handler);
            this._listeners.local.heightToggleBtn = { element: heightToggleBtn, handler, event: 'click' };
        }

        // 🔥 修复：分类过滤栏事件委托（局部监听器，动态容器）
        const categoryFilterContainer = Render.elements.categoryFilterContainer;
        if (categoryFilterContainer && !this._listeners.local.categoryFilterContainer) {
            // 使用闭包存储拖拽状态
            const dragState = {
                draggedElement: null,
                draggedIndex: -1
            };
            
            const handleClick = (e) => {
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
            };
            
            const handleDragStart = (e) => {
                const tagElement = e.target.closest('.draggable-tag');
                if (tagElement) {
                    dragState.draggedElement = tagElement;
                    dragState.draggedIndex = parseInt(tagElement.dataset.tagIndex);
                    tagElement.style.opacity = '0.5';
                    e.dataTransfer.effectAllowed = 'move';
                }
            };
            
            const handleDragEnd = (e) => {
                if (dragState.draggedElement) {
                    dragState.draggedElement.style.opacity = '1';
                    dragState.draggedElement = null;
                    dragState.draggedIndex = -1;
                }
            };
            
            const handleDragOver = (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const tagElement = e.target.closest('.draggable-tag');
                if (tagElement && dragState.draggedElement && tagElement !== dragState.draggedElement) {
                    const targetIndex = parseInt(tagElement.dataset.tagIndex);
                    const allTags = Array.from(categoryFilterContainer.querySelectorAll('.draggable-tag'));
                    const draggedRect = dragState.draggedElement.getBoundingClientRect();
                    const targetRect = tagElement.getBoundingClientRect();
                    const midY = targetRect.top + targetRect.height / 2;
                    
                    if (e.clientY < midY) {
                        // 插入到目标之前
                        tagElement.parentNode.insertBefore(dragState.draggedElement, tagElement);
                    } else {
                        // 插入到目标之后
                        tagElement.parentNode.insertBefore(dragState.draggedElement, tagElement.nextSibling);
                    }
                }
            };
            
            const handleDrop = (e) => {
                e.preventDefault();
                if (dragState.draggedElement) {
                    const allTags = Array.from(categoryFilterContainer.querySelectorAll('.draggable-tag'));
                    const newIndex = allTags.indexOf(dragState.draggedElement);
                    
                    if (newIndex !== -1 && dragState.draggedIndex !== newIndex) {
                        Actions.moveTag(dragState.draggedIndex, newIndex);
                    }
                    
                    dragState.draggedElement = null;
                    dragState.draggedIndex = -1;
                }
            };
            
            categoryFilterContainer.addEventListener('click', handleClick);
            categoryFilterContainer.addEventListener('dragstart', handleDragStart);
            categoryFilterContainer.addEventListener('dragend', handleDragEnd);
            categoryFilterContainer.addEventListener('dragover', handleDragOver);
            categoryFilterContainer.addEventListener('drop', handleDrop);
            
            this._listeners.local.categoryFilterContainer = {
                element: categoryFilterContainer,
                handlers: [
                    { handler: handleClick, event: 'click' },
                    { handler: handleDragStart, event: 'dragstart' },
                    { handler: handleDragEnd, event: 'dragend' },
                    { handler: handleDragOver, event: 'dragover' },
                    { handler: handleDrop, event: 'drop' }
                ]
            };
        }

        // 🔥 修复：笔记容器事件委托（局部监听器，动态容器）
        const notesContainer = Render.elements.container;
        if (notesContainer && !this._listeners.local.notesContainer) {
            const handleClick = (e) => {
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
            };
            notesContainer.addEventListener('click', handleClick);
            this._listeners.local.notesContainer = { element: notesContainer, handler: handleClick, event: 'click' };
        }

        // 🔥 修复：添加分类对话框事件（局部监听器，但元素持久存在）
        const addCategoryDialog = Render.elements.addCategoryDialog;
        if (addCategoryDialog && !this._listeners.local.addCategoryDialog) {
            const handlers = [];
            
            // 关闭按钮
            const closeBtns = addCategoryDialog.querySelectorAll('[data-action="close-dialog"]');
            const closeHandler = () => Modal.closeAddCategory();
            closeBtns.forEach(btn => {
                btn.addEventListener('click', closeHandler);
                handlers.push({ element: btn, handler: closeHandler, event: 'click' });
            });

            // 取消按钮
            const cancelBtns = addCategoryDialog.querySelectorAll('[data-action="cancel-dialog"]');
            cancelBtns.forEach(btn => {
                btn.addEventListener('click', closeHandler);
                handlers.push({ element: btn, handler: closeHandler, event: 'click' });
            });

            // 确认按钮
            const confirmBtn = addCategoryDialog.querySelector('[data-action="confirm-add-category"]');
            if (confirmBtn) {
                const confirmHandler = () => Actions.confirmAddCategory();
                confirmBtn.addEventListener('click', confirmHandler);
                handlers.push({ element: confirmBtn, handler: confirmHandler, event: 'click' });
            }

            // 回车键确认
            const newCategoryInput = Render.elements.newCategoryInput;
            if (newCategoryInput) {
                const keydownHandler = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        Actions.confirmAddCategory();
                    }
                };
                newCategoryInput.addEventListener('keydown', keydownHandler);
                handlers.push({ element: newCategoryInput, handler: keydownHandler, event: 'keydown' });
            }
            
            this._listeners.local.addCategoryDialog = { handlers };
        }

        // 🔥 修复：撤销按钮（局部监听器，但元素持久存在）
        const undoBtn = Render.elements.undoBtn;
        if (undoBtn && !this._listeners.local.undoBtn) {
            const handler = () => Actions.undoAction();
            undoBtn.addEventListener('click', handler);
            this._listeners.local.undoBtn = { element: undoBtn, handler, event: 'click' };
        }

        // 🔥 修复：重命名分类对话框事件（局部监听器，但元素持久存在）
        const renameTagDialog = Render.elements.renameTagDialog;
        if (renameTagDialog && !this._listeners.local.renameTagDialog) {
            const handlers = [];
            
            // 关闭按钮
            const closeBtns = renameTagDialog.querySelectorAll('[data-action="close-rename-dialog"]');
            const closeHandler = () => Modal.closeRenameTag();
            closeBtns.forEach(btn => {
                btn.addEventListener('click', closeHandler);
                handlers.push({ element: btn, handler: closeHandler, event: 'click' });
            });

            // 取消按钮
            const cancelBtns = renameTagDialog.querySelectorAll('[data-action="cancel-rename-dialog"]');
            cancelBtns.forEach(btn => {
                btn.addEventListener('click', closeHandler);
                handlers.push({ element: btn, handler: closeHandler, event: 'click' });
            });

            // 确认按钮
            const confirmBtn = renameTagDialog.querySelector('[data-action="confirm-rename-tag"]');
            if (confirmBtn) {
                const confirmHandler = () => Actions.confirmRenameTag();
                confirmBtn.addEventListener('click', confirmHandler);
                handlers.push({ element: confirmBtn, handler: confirmHandler, event: 'click' });
            }

            // 回车键确认
            const renameTagInput = Render.elements.renameTagInput;
            if (renameTagInput) {
                const keydownHandler = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        Actions.confirmRenameTag();
                    }
                };
                renameTagInput.addEventListener('keydown', keydownHandler);
                handlers.push({ element: renameTagInput, handler: keydownHandler, event: 'keydown' });
            }
            
            this._listeners.local.renameTagDialog = { handlers };
        }

        // 🔥 修复：在标签选择器中添加标签对话框事件（局部监听器，但元素持久存在）
        const addTagInSelectorDialog = Render.elements.addTagInSelectorDialog;
        if (addTagInSelectorDialog && !this._listeners.local.addTagInSelectorDialog) {
            const handlers = [];
            
            // 关闭按钮
            const closeBtns = addTagInSelectorDialog.querySelectorAll('[data-action="close-add-tag-in-selector-dialog"]');
            const closeHandler = () => Modal.closeAddTagInSelector();
            closeBtns.forEach(btn => {
                btn.addEventListener('click', closeHandler);
                handlers.push({ element: btn, handler: closeHandler, event: 'click' });
            });

            // 取消按钮
            const cancelBtns = addTagInSelectorDialog.querySelectorAll('[data-action="cancel-add-tag-in-selector-dialog"]');
            cancelBtns.forEach(btn => {
                btn.addEventListener('click', closeHandler);
                handlers.push({ element: btn, handler: closeHandler, event: 'click' });
            });

            // 确认按钮
            const confirmBtn = addTagInSelectorDialog.querySelector('[data-action="confirm-add-tag-in-selector"]');
            if (confirmBtn) {
                const confirmHandler = () => Actions.confirmAddTagInSelector();
                confirmBtn.addEventListener('click', confirmHandler);
                handlers.push({ element: confirmBtn, handler: confirmHandler, event: 'click' });
            }

            // 回车键确认
            const addTagInSelectorInput = Render.elements.addTagInSelectorInput;
            if (addTagInSelectorInput) {
                const keydownHandler = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        Actions.confirmAddTagInSelector();
                    }
                };
                addTagInSelectorInput.addEventListener('keydown', keydownHandler);
                handlers.push({ element: addTagInSelectorInput, handler: keydownHandler, event: 'keydown' });
            }
            
            this._listeners.local.addTagInSelectorDialog = { handlers };
        }
    },
    
    /**
     * 🔥 修复：重置事件系统（用于项目切换时）
     * 清理局部监听器，保留全局监听器
     */
    reset() {
        if (this._debug) console.log('[Events] 重置事件系统（清理局部监听器）');
        // 清理局部监听器
        this._cleanupLocalListeners();
        // 注意：不清理全局监听器，因为它们应该在整个应用生命周期中保持
        // 如果需要完全重置，可以调用 cleanup() 方法
    },
    
    /**
     * 🔥 修复：清理全局监听器
     */
    _cleanupGlobalListeners() {
        let cleanedCount = 0;
        // 清理全局监听器
        Object.keys(this._listeners.global).forEach(key => {
            const listenerInfo = this._listeners.global[key];
            if (listenerInfo) {
                try {
                    // 🔥 修复：使用存储的事件类型和捕获标志
                    const handler = listenerInfo.handler || listenerInfo; // 兼容旧格式
                    const eventType = listenerInfo.eventType || this._getEventTypeFromKey(key);
                    const useCapture = listenerInfo.useCapture || false;
                    
                    document.removeEventListener(eventType, handler, useCapture);
                    cleanedCount++;
                    if (this._debug) console.log(`[Events] 清理全局监听器: ${key} (${eventType}${useCapture ? ', capture' : ''})`);
                } catch (error) {
                    console.warn(`[Events] 清理全局监听器失败: ${key}`, error);
                }
            }
        });
        
        // 清空全局监听器引用
        this._listeners.global = {};
        if (this._debug && cleanedCount > 0) {
            console.log(`[Events] 全局监听器清理完成，共清理 ${cleanedCount} 个监听器`);
        }
    },
    
    /**
     * 🔥 修复：从键名推断事件类型（兼容旧代码）
     */
    _getEventTypeFromKey(key) {
        if (key.includes('Click') || key === 'closeDropdowns' || key === 'tagSearchToggle' || key === 'searchTagClick' || key === 'tagSelectorClick') {
            return 'click';
        } else if (key.includes('Drag')) {
            const eventType = key.replace('tagDrag', '').toLowerCase();
            if (eventType === 'start') return 'dragstart';
            if (eventType === 'end') return 'dragend';
            if (eventType === 'over') return 'dragover';
            if (eventType === 'drop') return 'drop';
        } else if (key === 'compositionStart') {
            return 'compositionstart';
        } else if (key === 'compositionEnd') {
            return 'compositionend';
        } else if (key === 'searchInput') {
            return 'input';
        }
        return 'click'; // 默认
    },
    
    /**
     * 🔥 修复：完全清理所有监听器（用于应用卸载时）
     */
    cleanup() {
        if (this._debug) console.log('[Events] 完全清理所有事件监听器');
        // 清理局部监听器
        this._cleanupLocalListeners();
        
        // 清理全局监听器
        this._cleanupGlobalListeners();
        
        // 清空所有监听器引用
        this._listeners.local = {};
        
        // 重置初始化标志
        this.initialized = false;
        if (this._debug) console.log('[Events] 所有监听器已清理，事件系统已重置');
    }
};


