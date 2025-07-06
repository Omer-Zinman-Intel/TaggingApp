
// Enhanced logger for comprehensive action tracking
(function() {
    function log(level, ...args) {
        const msg = `[${new Date().toISOString()}] [${level}]`;
        console[level === 'error' ? 'error' : 'log'](msg, ...args);
        // Send to server
        try {
            fetch('/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    level, 
                    message: args.map(String).join(' '), 
                    time: new Date().toISOString(),
                    url: window.location.href,
                    userAgent: navigator.userAgent
                })
            });
        } catch (e) {}
    }
    
    window.appLogger = {
        info: (...args) => log('info', ...args),
        warn: (...args) => log('warn', ...args),
        error: (...args) => log('error', ...args),
        
        // Action tracking methods
        action: (actionType, details) => {
            const actionData = {
                type: 'USER_ACTION',
                action: actionType,
                details: details || {},
                timestamp: new Date().toISOString(),
                url: window.location.href
            };
            log('info', 'ACTION:', JSON.stringify(actionData));
        },
        
        modalLoaded: (modalId, components) => {
            const modalData = {
                type: 'MODAL_LOADED',
                modalId: modalId,
                components: components || {},
                timestamp: new Date().toISOString()
            };
            log('info', 'MODAL_LOADED:', JSON.stringify(modalData));
        },
        
        buttonClick: (buttonName, context) => {
            const buttonData = {
                type: 'BUTTON_CLICK',
                button: buttonName,
                context: context || {},
                timestamp: new Date().toISOString()
            };
            log('info', 'BUTTON_CLICK:', JSON.stringify(buttonData));
        },
        
        componentStatus: (componentName, status, details) => {
            const componentData = {
                type: 'COMPONENT_STATUS',
                component: componentName,
                status: status, // 'loaded', 'error', 'missing', etc.
                details: details || {},
                timestamp: new Date().toISOString()
            };
            log('info', 'COMPONENT:', JSON.stringify(componentData));
        }
    };
    
    // Track page load
    document.addEventListener('DOMContentLoaded', function() {
        window.appLogger.action('PAGE_LOAD', {
            url: window.location.href,
            title: document.title
        });
    });
})();
