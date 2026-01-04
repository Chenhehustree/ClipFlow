/**
 * ClipFlow - Main Entry
 * 搴旂敤鍒濆鍖栧叆鍙n */

// ============================================================================
// Initialization - 应用初始化
// ============================================================================
function init() {
    // 初始化状态
    State.init();
    
    // 初始化项目管理事件
    ProjectManager.initEvents();
    
    // 根据是否有当前项目决定显示哪个视图
    if (State.currentProjectId) {
        // 冷启动：有默认项目，显示笔记管理界面
        const project = State.projects.find(p => p.id === State.currentProjectId);
        if (project) {
            const dashboardView = document.getElementById('dashboard-view');
            const appView = document.getElementById('app-view');
            if (dashboardView) dashboardView.classList.add('hidden');
            if (appView) appView.classList.remove('hidden');
            
            const projectNameEl = document.getElementById('current-project-name');
            if (projectNameEl) projectNameEl.textContent = project.name;
            
            // 等待DOM更新后初始化（使用setTimeout确保视图已显示）
            setTimeout(() => {
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
            }, 0);
        }
    } else {
        // 有项目但未选中，显示项目管理界面（九宫格）
        ProjectManager.renderProjects();
        
        // 初始化 Lucide 图标
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

// DOMContentLoaded 时初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
