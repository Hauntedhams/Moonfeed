// Mobile Optimization Utilities
// Aggressive cleanup and resource management for mobile devices

export const MobileOptimizer = {
  isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
  cleanupTasks: [],
  memoryThreshold: 100 * 1024 * 1024, // 100MB

  // Initialize optimizer
  init() {
    if (!this.isMobile) return;

    console.log('📱 Mobile Optimizer initialized');
    
    // Monitor memory
    this.startMemoryMonitor();
    
    // Setup cleanup on page hide
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.aggressiveCleanup();
      }
    });

    // Setup cleanup on low memory (if supported)
    if ('memory' in performance) {
      setInterval(() => this.checkMemory(), 10000);
    }
  },

  // Start memory monitoring
  startMemoryMonitor() {
    if (!('memory' in performance)) return;

    setInterval(() => {
      const used = performance.memory.usedJSHeapSize;
      const limit = performance.memory.jsHeapSizeLimit;
      const percentage = (used / limit) * 100;

      if (percentage > 80) {
        console.warn('⚠️ High memory usage:', Math.round(percentage), '%');
        this.aggressiveCleanup();
      }
    }, 5000);
  },

  // Check memory and trigger cleanup if needed
  checkMemory() {
    if (!('memory' in performance)) return;

    const used = performance.memory.usedJSHeapSize;
    
    if (used > this.memoryThreshold) {
      console.warn('🧹 Memory threshold exceeded, running cleanup...');
      this.aggressiveCleanup();
    }
  },

  // Register cleanup task
  registerCleanup(name, cleanupFn) {
    this.cleanupTasks.push({ name, fn: cleanupFn });
  },

  // Run all cleanup tasks
  aggressiveCleanup() {
    console.log('🧹 Running aggressive cleanup...');
    
    // Run registered cleanup tasks
    this.cleanupTasks.forEach(task => {
      try {
        task.fn();
        console.log('  ✅', task.name);
      } catch (err) {
        console.error('  ❌', task.name, err);
      }
    });

    // Clear cleanup tasks
    this.cleanupTasks = [];

    // Force garbage collection (if available)
    if (window.gc) {
      window.gc();
      console.log('  ✅ Garbage collection triggered');
    }
  },

  // Destroy iframe safely - LET REACT HANDLE DOM REMOVAL
  destroyIframe(iframeRef) {
    if (!iframeRef || !iframeRef.current) return;

    try {
      const iframe = iframeRef.current;
      
      // Stop loading
      if (iframe.contentWindow) {
        try {
          iframe.contentWindow.stop();
        } catch (e) {
          // Cross-origin iframe, can't stop
        }
      }

      // Clear src to unload content and free memory
      iframe.src = 'about:blank';
      
      // ❌ DON'T REMOVE FROM DOM - Let React handle it
      // This was causing: "Failed to execute 'removeChild' on 'Node'"
      // if (iframe.parentNode) {
      //   iframe.parentNode.removeChild(iframe);
      // }

      console.log('🧹 iframe cleaned (React will remove from DOM)');
    } catch (err) {
      console.error('Error cleaning iframe:', err);
    }
  },

  // Unload images to free memory
  unloadImages(container) {
    if (!container) return;

    const images = container.querySelectorAll('img');
    images.forEach(img => {
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    });

    console.log('🧹 Unloaded', images.length, 'images');
  },

  // Clear event listeners
  clearEventListeners(element) {
    if (!element) return;

    const clone = element.cloneNode(true);
    element.parentNode.replaceChild(clone, element);
    
    return clone;
  },

  // Debounce with memory cleanup
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        timeout = null;
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Throttle with memory awareness
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // Check if component should render (based on memory)
  shouldRender() {
    if (!this.isMobile) return true;
    if (!('memory' in performance)) return true;

    const used = performance.memory.usedJSHeapSize;
    const limit = performance.memory.jsHeapSizeLimit;
    const percentage = (used / limit) * 100;

    return percentage < 85; // Don't render if >85% memory used
  },

  // Get memory stats
  getMemoryStats() {
    if (!('memory' in performance)) {
      return { available: false };
    }

    const memory = performance.memory;
    return {
      available: true,
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
      percentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
    };
  }
};

// Auto-initialize on mobile
if (MobileOptimizer.isMobile) {
  MobileOptimizer.init();
}

export default MobileOptimizer;
