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
            
            // 🔥 修复：使用双重 requestAnimationFrame 确保 DOM 完全更新
            // 第一次：等待视图切换完成
            requestAnimationFrame(() => {
                // 第二次：确保 DOM 渲染完成
                requestAnimationFrame(() => {
                    // 初始化渲染模块的 DOM 引用
                    Render.initElements();
                    
                    // 初始化事件监听
                    Events.init();
                    
                    // 初始渲染
                    Render.render();
                    Render.renderTagDropdown();
                    
                    // 🔥 修复：使用 requestAnimationFrame 确保在 DOM 更新后初始化图标
                    requestAnimationFrame(() => {
                        if (typeof lucide !== 'undefined') {
                            lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
                        }
                    });
                });
            });
        }
    } else {
        // 有项目但未选中，显示项目管理界面（九宫格）
        ProjectManager.renderProjects();
        
        // 🔥 修复：使用 requestAnimationFrame 确保在 DOM 更新后初始化图标
        requestAnimationFrame(() => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        });
    }
}

// 🔥 修复：使用 defer 后，脚本会在 DOM 解析完成后执行
// 此时 document.readyState 应该是 'interactive' 或 'complete'
// 直接执行 init() 即可，不需要等待 DOMContentLoaded
// 但如果为了兼容性，保留检查逻辑
if (document.readyState === 'loading') {
    // 如果还在加载中（理论上使用 defer 时不应该发生），等待 DOMContentLoaded
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM 已就绪，直接初始化
    init();
}
