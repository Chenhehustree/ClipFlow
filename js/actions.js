/**
 * ClipFlow - Actions Module
 * 鐢ㄦ埛鎿嶄綔澶勭悊
 */

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
     * @param {string} tagId - 标签ID，'All' 表示全部
     */
    toggleFilter(tagId) {
        // 🔥 修复：使用与 removeFilter 相同的逻辑，直接修改 activeFilters
        // 🔥 修复：确保传入的是 tagId，而不是标签名称
        if (tagId === 'All') {
            State.activeFilters = [];
        } else {
            // 🔥 修复：确保 tagId 是有效的字符串
            if (!tagId || typeof tagId !== 'string') {
                console.warn('toggleFilter: 无效的 tagId', tagId);
                return;
            }
            const index = State.activeFilters.indexOf(tagId);
            if (index > -1) {
                State.activeFilters.splice(index, 1);
            } else {
                State.activeFilters.push(tagId);
            }
        }
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
            
            // 🔥 修复：创建tag后自动打开标签选择器并进入新创建的tag目录
            // 这样用户可以看到"该父级（全部）"选项和子级列表，符合旧版的正确逻辑
            State.tagSelectPath = [tagId];
            
            // 🔥 修复：确保渲染标签选择器（renderFilterBar会调用renderTagSelector）
            Render.render();
            Render.renderTagDropdown();

            // 🔥 修复：使用 requestAnimationFrame 确保 DOM 已更新后再重新初始化图标
            requestAnimationFrame(() => {
                const selectorPanel = document.getElementById('tag-selector-panel');
                if (selectorPanel && typeof lucide !== 'undefined') {
                    lucide.createIcons(selectorPanel, { attrs: { 'stroke-width': '1.5' } });
                }
                if (typeof lucide !== 'undefined') {
                    // 重新初始化所有图标，确保新添加的标签图标正确渲染
                    lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
                }
            });

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
                // 🔥 修复：确保添加子标签后立即刷新界面
                Render.renderTagDropdown();

                // 🔥 修复：使用 requestAnimationFrame 确保 DOM 已更新后再重新初始化图标
                requestAnimationFrame(() => {
                    const tagDropdownMenu = Render.elements.tagDropdownMenu;
                    if (tagDropdownMenu && typeof lucide !== 'undefined') {
                        // 重新初始化下拉菜单内的图标，确保新添加的标签图标正确渲染
                        lucide.createIcons(tagDropdownMenu, { attrs: { 'stroke-width': '1.5' } });
                    }
                });

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

        const result = State.renameCategory(tagId, newName);
        if (result) {
            // 🔥 修复：保存重命名快照用于撤销
            UndoManager.saveAction(UNDO_ACTION_TYPES.RENAME_TAG, result);
            
            Modal.closeRenameTag();
            Render.render();
            Render.renderTagDropdown();
            Toast.show(`Tag renamed from "${oldName}" to "${newName}"`, true);
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
            // 🔥 修复：记录删除前是否选中了该标签
            const wasSelectedParent = State.selectedParentTagId === tagId;

            // 🔥 修复：保存删除快照用于撤销
            const snapshot = State.deleteCategory(tagId);
            if (snapshot) {
                UndoManager.saveAction(UNDO_ACTION_TYPES.DELETE_TAG, snapshot);
            }

            // 🔥 修复：如果删除的是当前选中的父标签，确保清除并重新渲染
            if (wasSelectedParent && State.selectedParentTagId === tagId) {
                State.selectedParentTagId = null;
            }

            Render.render();
            Render.renderTagDropdown();
            Toast.show(`Tag "${tagName}" deleted`, true);
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
        // 🔥 修复：确保 tagId 是有效的字符串
        if (!tagId || typeof tagId !== 'string') {
            console.warn('selectTagInSelector: 无效的 tagId', tagId);
            return;
        }
        // 🔥 修复：使用与 removeFilter 相同的逻辑，直接修改 activeFilters
        const index = State.activeFilters.indexOf(tagId);
        const wasSelected = index > -1;
        
        if (wasSelected) {
            State.activeFilters.splice(index, 1);
        } else {
            State.activeFilters.push(tagId);
        }
        
        // 🔥 修复：确保状态更新后立即触发筛选
        // 使用 Render.render() 确保所有组件都正确更新
        // renderFilterBar() 会调用 renderTagSelector()，所以不需要单独调用
        Render.render();
        
        // 🔥 修复：调试日志（开发环境）
        if (typeof console !== 'undefined' && console.debug) {
            console.debug('selectTagInSelector:', {
                tagId,
                action: wasSelected ? 'removed' : 'added',
                activeFilters: [...State.activeFilters],
                filteredCount: State.getFilteredNotes().length,
                totalNotes: State.notes.length
            });
        }
    },

    /**
     * 在标签选择器中添加标签
     */
    addTagInSelector() {
        const currentPath = State.tagSelectPath;
        const parentId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;
        
        // 🔥 修复：使用对话框而不是prompt来输入标签名称
        State.addingTagParentId = parentId; // 存储父标签ID，用于确认时使用
        Modal.showAddTagInSelector();
    },

    /**
     * 确认在标签选择器中添加标签
     */
    confirmAddTagInSelector() {
        const input = Render.elements.addTagInSelectorInput;
        if (!input) return;
        
        const tagName = input.value.trim();
        // 🔥 修复：确保使用 State.addingTagParentId（可能来自标签选择器或标签下拉菜单）
        const parentId = State.addingTagParentId;
        
        if (!tagName) {
            Toast.show('标签名称不能为空');
            return;
        }
        
        const tagId = State.addCategory(tagName, parentId);
        if (tagId) {
            Modal.closeAddTagInSelector();
            
            // 🔥 修复：判断是在标签选择器中创建还是在标签下拉菜单中创建
            // 优先检查：如果 addingTagParentId 等于 selectedParentTagId，说明是在标签下拉菜单中创建的
            const isInTagDropdown = State.selectedParentTagId !== null && 
                                   State.addingTagParentId === State.selectedParentTagId;
            const isInTagSelector = !isInTagDropdown && State.tagSelectPath.length > 0;
            
            if (isInTagDropdown) {
                // 🔥 修复：在标签下拉菜单中创建子类
                // 保持 State.selectedParentTagId 不变，并立即执行 Render.renderTagDropdown()
                // 这样用户会发现三级窗口关闭后，二级窗口右侧立刻出现了刚才起名的子标签
                Render.renderTagDropdown();
                
                // 🔥 修复：使用 requestAnimationFrame 确保 DOM 已更新后再重新初始化图标
                requestAnimationFrame(() => {
                    const tagDropdownMenu = Render.elements.tagDropdownMenu;
                    if (tagDropdownMenu && typeof lucide !== 'undefined') {
                        lucide.createIcons(tagDropdownMenu, { attrs: { 'stroke-width': '1.5' } });
                    }
                });
            } else if (isInTagSelector) {
                // 在标签选择器中创建
                // 🔥 修复：如果在根目录创建tag（parentId为null），自动进入新创建的tag目录
                // 这样用户可以看到"该父级（全部）"选项和子级列表，符合旧版的正确逻辑
                if (parentId === null) {
                    // 在根目录创建，自动进入新创建的tag目录
                    State.tagSelectPath = [tagId];
                }
                // 如果在子级目录创建，保持当前路径不变，新tag会显示在当前目录的子级列表中
                
                // 🔥 修复：确保添加标签后立即刷新界面，包括标签选择器
                // renderFilterBar 内部会调用 renderTagSelector，但为了确保同步，我们显式调用
                Render.renderFilterBar();

                // 🔥 修复：使用 requestAnimationFrame 确保 DOM 已更新后再重新初始化图标
                // 这样可以确保新添加的标签的图标被正确初始化，事件委托也能正常工作
                requestAnimationFrame(() => {
                    const selectorPanel = document.getElementById('tag-selector-panel');
                    if (selectorPanel && typeof lucide !== 'undefined') {
                        // 🔥 修复：重新初始化选择器面板内的图标，确保新添加的标签图标正确渲染
                        lucide.createIcons(selectorPanel, { attrs: { 'stroke-width': '1.5' } });
                    }
                });
            } else {
                // 其他情况（可能是从其他地方调用），刷新整个界面
                Render.render();
                Render.renderTagDropdown();
            }

            Toast.show(`标签 "${tagName}" 已添加`);
        } else {
            Toast.show('标签名称已存在或添加失败');
        }
        
        // 🔥 修复：清除临时状态（但保持 selectedParentTagId 不变）
        State.addingTagParentId = null;
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
            // 🔥 修复：记录删除前是否选中了该标签
            const wasSelectedParent = State.selectedParentTagId === tagId;

            // 🔥 修复：保存删除快照用于撤销
            const snapshot = State.deleteCategory(tagId);
            if (snapshot) {
                UndoManager.saveAction(UNDO_ACTION_TYPES.DELETE_TAG, snapshot);
            }

            // 🔥 修复：如果删除的是当前选中的父标签，确保清除并重新渲染
            if (wasSelectedParent && State.selectedParentTagId === tagId) {
                State.selectedParentTagId = null;
            }

            Render.renderFilterBar();
            Render.render();
            Render.renderTagDropdown(); // 🔥 修复：确保下拉菜单也更新
            Toast.show(`标签 "${tagName}" 已删除`, true);
        }
    },

    /**
     * 从搜索浮层中切换过滤标签（不关闭浮层）
     * @param {string} tagId - 标签ID
     */
    toggleFilterFromSearch(tagId) {
        // 🔥 修复：确保 tagId 是有效的字符串
        if (!tagId || typeof tagId !== 'string') {
            console.warn('toggleFilterFromSearch: 无效的 tagId', tagId);
            return;
        }
        // 🔥 修复：使用与 removeFilter 相同的逻辑，直接修改 activeFilters
        const index = State.activeFilters.indexOf(tagId);
        if (index > -1) {
            State.activeFilters.splice(index, 1);
        } else {
            State.activeFilters.push(tagId);
        }
        // 只更新标签列表的选中状态，不关闭浮层，不清空搜索
        Render.renderTagSearchDropdown();
        Render.renderFilterBar();
        // 🔥 修复：更新文章列表，使筛选结果实时生效
        Render.renderNotes();
    },

    /**
     * 移除已选过滤器
     * @param {string} tagId - 标签ID
     */
    removeFilter(tagId) {
        // 🔥 修复：确保 tagId 是有效的字符串
        if (!tagId || typeof tagId !== 'string') {
            console.warn('removeFilter: 无效的 tagId', tagId);
            return;
        }
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
        if (!menu || !btn) {
            return;
        }

        // 🔥 修复：在打开下拉菜单前，验证 selectedParentTagId 是否有效
        if (State.selectedParentTagId) {
            const parentTag = State.getTagById(State.selectedParentTagId);
            if (!parentTag) {
                // 如果指向的标签已被删除，清除它
                State.selectedParentTagId = null;
            }
        }

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
        // 🔥 修复：排除触发按钮本身，避免"瞬间关闭又打开"的问题
        const tagDropdownBtn = e.target.closest('#tag-dropdown-btn');
        const tagSearchBtn = e.target.closest('#tag-search-button');
        if (tagDropdownBtn || tagSearchBtn) {
            return; // 如果是点击按钮本身，不处理
        }

        // 🔥 修复：排除标签选择器面板，避免干扰标签选择
        const tagSelectorPanel = e.target.closest('#tag-selector-panel');
        if (tagSelectorPanel) {
            return; // 如果点击在标签选择器内，不处理（由标签选择器自己的事件处理）
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

