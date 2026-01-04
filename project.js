/**
 * ClipFlow - Project Management Module
 * 椤圭洰绠＄悊妯″潡
 */

// ============================================================================
// Project Management Module - 项目管理模块
// ============================================================================
const ProjectManager = {
    /**
     * 渲染项目列表（九宫格）
     */
    renderProjects() {
        const projectsGrid = document.getElementById('projects-grid');
        if (!projectsGrid) return;
        
        projectsGrid.innerHTML = '';

        // 1. Create "New Project" Entry Card
        const newProjectCard = document.createElement('div');
        newProjectCard.className = `
            group h-56 rounded-xl border-2 border-dashed border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50/50 
            flex flex-col items-center justify-center cursor-pointer transition-all duration-200 active:scale-[0.99]
        `;
        newProjectCard.onclick = () => {
            const input = document.getElementById('new-project-input');
            if (input) input.value = '';
            const dialog = document.getElementById('create-project-dialog');
            if (dialog) dialog.showModal();
        };
        newProjectCard.innerHTML = `
            <div class="w-12 h-12 rounded-full bg-zinc-100 group-hover:bg-white border border-zinc-200 flex items-center justify-center mb-3 transition-colors shadow-sm group-hover:shadow-md">
                <i data-lucide="plus" class="w-6 h-6 text-zinc-400 group-hover:text-zinc-900 transition-colors"></i>
            </div>
            <span class="text-sm font-medium text-zinc-500 group-hover:text-zinc-900">New Project</span>
        `;
        projectsGrid.appendChild(newProjectCard);

        // 2. Render Existing Projects
        State.projects.forEach(project => {
            const card = document.createElement('div');
            card.className = `
                group bg-white rounded-xl border border-zinc-200 overflow-hidden hover:shadow-lg hover:shadow-zinc-200/50 hover:border-zinc-300 
                transition-all duration-300 relative h-56 flex flex-col cursor-pointer
            `;
            
            // Cover Area
            const coverDiv = document.createElement('div');
            coverDiv.className = "h-28 w-full bg-cover bg-center shrink-0 relative";
            coverDiv.style.background = project.cover.includes('gradient') ? project.cover : `url(${project.cover})`;
            
            // Card Body
            const bodyDiv = document.createElement('div');
            bodyDiv.className = "p-4 flex flex-col justify-between flex-1 bg-white";
            
            const dateStr = new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            
            // 🔥 修复：使用 textContent 防止 XSS 攻击
            bodyDiv.innerHTML = `
                <div>
                    <h3 class="font-semibold text-zinc-900 tracking-tight leading-snug group-hover:text-black transition-colors mb-1 truncate"></h3>
                    <p class="text-xs text-zinc-400 font-medium">${dateStr}</p>
                </div>
            `;
            // 🔥 修复：使用 textContent 安全地设置项目名称
            const titleEl = bodyDiv.querySelector('h3');
            if (titleEl) {
                titleEl.textContent = project.name;
            }

            // More Options Button (Top Right)
            const moreBtn = document.createElement('button');
            moreBtn.className = `
                absolute top-3 right-3 p-1.5 rounded-lg bg-white/90 text-zinc-600 opacity-0 group-hover:opacity-100 
                hover:bg-white hover:text-zinc-900 shadow-sm border border-zinc-200/50 backdrop-blur-sm transition-all
            `;
            moreBtn.innerHTML = `<i data-lucide="more-horizontal" class="w-4 h-4"></i>`;
            moreBtn.onclick = (e) => {
                e.stopPropagation();
                this.toggleContextMenu(e, project.id);
            };

            // Card Click -> Open Project
            card.onclick = () => this.openProject(project);

            card.appendChild(coverDiv);
            card.appendChild(bodyDiv);
            card.appendChild(moreBtn);
            projectsGrid.appendChild(card);
        });

        // Re-init icons for injected content
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * 打开项目（切换到笔记管理界面）
     */
    openProject(project) {
        // 保存当前项目数据（如果有）
        if (State.currentProjectId) {
            State.saveCurrentProjectData();
        }

        // 🔥 修复：重置UI临时状态
        State.resetTempState();

        // 切换到项目
        State.loadProjectData(project.id);
        
        // 更新UI - 先切换视图
        const dashboardView = document.getElementById('dashboard-view');
        const appView = document.getElementById('app-view');
        if (dashboardView) dashboardView.classList.add('hidden');
        if (appView) appView.classList.remove('hidden');
        
        // 更新项目名称
        const projectNameEl = document.getElementById('current-project-name');
        if (projectNameEl) projectNameEl.textContent = project.name;
        
        // 等待DOM更新后初始化元素和事件（使用setTimeout确保视图已显示）
        setTimeout(() => {
            // 初始化渲染模块的 DOM 引用
            Render.initElements();
            
            // 🔥 修复：重置局部监听器（清理旧项目的监听器）
            Events.reset();
            
            // 初始化事件监听（必须在元素初始化后）
            // 注意：Events.init() 会检查 initialized 标志，全局监听器只绑定一次
            Events.init();
            
            // 初始渲染
            Render.render();
            Render.renderTagDropdown();
            
            // 初始化 Lucide 图标
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
            }
        }, 0);
    },

    /**
     * 返回项目管理界面
     */
    backToDashboard() {
        // 保存当前项目数据
        if (State.currentProjectId) {
            State.saveCurrentProjectData();
            State.currentProjectId = null;
        }
        
        const dashboardView = document.getElementById('dashboard-view');
        const appView = document.getElementById('app-view');
        if (dashboardView) dashboardView.classList.remove('hidden');
        if (appView) appView.classList.add('hidden');
        
        // 重新渲染项目列表
        this.renderProjects();
    },

    /**
     * 创建新项目
     */
    createProject(name) {
        // 🔥 修复：输入验证和清理
        if (!name || typeof name !== 'string') {
            return;
        }
        
        // 清理输入：移除前后空格，限制长度
        const cleanName = name.trim().substring(0, 100);
        if (!cleanName) {
            return;
        }
        
        const gradients = [
            'linear-gradient(135deg, #e9d5ff 0%, #fae8ff 100%)',
            'linear-gradient(135deg, #bfdbfe 0%, #ddd6fe 100%)',
            'linear-gradient(135deg, #bbf7d0 0%, #dcfce7 100%)',
            'linear-gradient(135deg, #fed7aa 0%, #fef3c7 100%)'
        ];
        const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];

        const newProject = {
            id: Date.now().toString(),
            name: cleanName,
            cover: randomGradient,
            createdAt: Date.now()
        };

        State.projects.unshift(newProject);
        Storage.saveProjects(State.projects);
        this.renderProjects();
    },

    /**
     * 删除项目
     */
    deleteProject(projectId) {
        // 删除项目的笔记和标签数据
        const notesKey = getStorageKey(projectId);
        const catKey = getCatStorageKey(projectId);
        localStorage.removeItem(notesKey);
        localStorage.removeItem(catKey);
        
        // 从项目列表中移除
        State.projects = State.projects.filter(p => p.id !== projectId);
        Storage.saveProjects(State.projects);
        
        // 如果删除的是当前项目，返回仪表板
        if (State.currentProjectId === projectId) {
            State.currentProjectId = null;
            this.backToDashboard();
        } else {
            this.renderProjects();
        }
    },

    /**
     * 重命名项目
     */
    renameProject(projectId, newName) {
        // 🔥 修复：输入验证和清理
        if (!newName || typeof newName !== 'string') {
            return;
        }
        
        // 清理输入：移除前后空格，限制长度
        const cleanName = newName.trim().substring(0, 100);
        if (!cleanName) {
            return;
        }
        
        const project = State.projects.find(p => p.id === projectId);
        if (project) {
            project.name = cleanName;
            Storage.saveProjects(State.projects);
            this.renderProjects();
            
            // 如果正在查看该项目，更新标题
            if (State.currentProjectId === projectId) {
                const projectNameEl = document.getElementById('current-project-name');
                if (projectNameEl) projectNameEl.textContent = cleanName;
            }
        }
    },

    /**
     * 更改项目封面
     */
    changeProjectCover(projectId) {
        const gradients = [
            'linear-gradient(135deg, #e9d5ff 0%, #fae8ff 100%)',
            'linear-gradient(135deg, #bfdbfe 0%, #ddd6fe 100%)',
            'linear-gradient(135deg, #bbf7d0 0%, #dcfce7 100%)',
            'linear-gradient(135deg, #fed7aa 0%, #fef3c7 100%)',
            `linear-gradient(${Math.floor(Math.random()*360)}deg, #e4e4e7, #fafafa)`
        ];
        const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];
        
        const project = State.projects.find(p => p.id === projectId);
        if (project) {
            project.cover = randomGradient;
            Storage.saveProjects(State.projects);
            this.renderProjects();
        }
    },

    /**
     * 显示/隐藏上下文菜单
     */
    currentContextProjectId: null,
    toggleContextMenu(e, projectId) {
        e.preventDefault();
        this.currentContextProjectId = projectId;
        
        const contextMenu = document.getElementById('project-context-menu');
        if (!contextMenu) return;
        
        // Positioning
        const rect = e.currentTarget.getBoundingClientRect();
        contextMenu.style.top = `${rect.bottom + 4}px`;
        contextMenu.style.left = `${rect.right - 192}px`;
        
        contextMenu.classList.remove('hidden');
        
        // Close on click elsewhere
        const closeMenu = (ev) => {
            if (!contextMenu.contains(ev.target) && ev.target !== e.currentTarget) {
                contextMenu.classList.add('hidden');
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    },

    /**
     * 初始化项目管理事件
     */
    initEvents() {
        // 创建项目对话框
        const createDialog = document.getElementById('create-project-dialog');
        const newProjectInput = document.getElementById('new-project-input');
        const confirmCreateBtn = document.getElementById('btn-confirm-create-project');
        
        if (confirmCreateBtn) {
            confirmCreateBtn.addEventListener('click', () => {
                const name = newProjectInput ? newProjectInput.value.trim() : '';
                if (name) {
                    this.createProject(name);
                    if (createDialog) createDialog.close();
                }
            });
        }

        // 返回按钮
        const backBtn = document.getElementById('btn-back-dashboard');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.backToDashboard();
            });
        }

        // 上下文菜单
        const contextMenu = document.getElementById('project-context-menu');
        if (contextMenu) {
            contextMenu.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                
                const action = btn.dataset.action;
                const projectId = this.currentContextProjectId;
                
                if (action === 'delete') {
                    const project = State.projects.find(p => p.id === projectId);
                    if (project) {
                        const deleteDialog = document.getElementById('delete-confirm-dialog');
                        const deleteProjectNameSpan = document.getElementById('delete-project-name');
                        if (deleteProjectNameSpan) {
                            // 🔥 修复：使用 textContent 防止 XSS
                            deleteProjectNameSpan.textContent = project.name;
                        }
                        if (deleteDialog) deleteDialog.showModal();
                        contextMenu.classList.add('hidden');
                    }
                } else if (action === 'edit') {
                    const project = State.projects.find(p => p.id === projectId);
                    if (project) {
                        const newName = prompt("重命名项目:", project.name);
                        if (newName) {
                            this.renameProject(projectId, newName);
                        }
                        contextMenu.classList.add('hidden');
                    }
                } else if (action === 'cover') {
                    this.changeProjectCover(projectId);
                    contextMenu.classList.add('hidden');
                }
            });
        }

        // 删除确认对话框
        const deleteDialog = document.getElementById('delete-confirm-dialog');
        const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
        const cancelDeleteBtn = document.getElementById('btn-cancel-delete');
        
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => {
                if (this.currentContextProjectId) {
                    this.deleteProject(this.currentContextProjectId);
                }
                if (deleteDialog) deleteDialog.close();
            });
        }
        
        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', () => {
                if (deleteDialog) deleteDialog.close();
            });
        }
    }
};
