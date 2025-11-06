/**
 * 🚨 MOBILE PERFORMANCE FIX - CRITICAL OPTIMIZATIONS
 * 
 * This file contains optimizations to prevent mobile force restarts:
 * 
 * 1. RAF (RequestAnimationFrame) Cleanup
 * 2. Event Listener Cleanup
 * 3. Image Lazy Loading
 * 4. Component Unmount Cleanup
 * 5. Memory Leak Prevention
 */

// ==========================================
// 1. RAF Manager - Prevent RAF leaks
// ==========================================
class RAFManager {
  constructor() {
    this.activeRAFs = new Map();
  }

  request(callback, id) {
    const rafId = requestAnimationFrame((timestamp) => {
      this.activeRAFs.delete(id);
      callback(timestamp);
    });
    this.activeRAFs.set(id, rafId);
    return rafId;
  }

  cancel(id) {
    const rafId = this.activeRAFs.get(id);
    if (rafId) {
      cancelAnimationFrame(rafId);
      this.activeRAFs.delete(id);
    }
  }

  cancelAll() {
    this.activeRAFs.forEach((rafId) => {
      cancelAnimationFrame(rafId);
    });
    this.activeRAFs.clear();
  }

  getActiveCount() {
    return this.activeRAFs.size;
  }
}

export const rafManager = new RAFManager();

// ==========================================
// 2. Event Listener Manager - Track & Cleanup
// ==========================================
class EventListenerManager {
  constructor() {
    this.listeners = new Map();
  }

  add(element, event, handler, options, id) {
    element.addEventListener(event, handler, options);
    
    if (!this.listeners.has(id)) {
      this.listeners.set(id, []);
    }
    
    this.listeners.get(id).push({ element, event, handler, options });
  }

  remove(id) {
    const listeners = this.listeners.get(id);
    if (listeners) {
      listeners.forEach(({ element, event, handler, options }) => {
        element.removeEventListener(event, handler, options);
      });
      this.listeners.delete(id);
    }
  }

  removeAll() {
    this.listeners.forEach((_, id) => {
      this.remove(id);
    });
  }

  getActiveCount() {
    let count = 0;
    this.listeners.forEach((listeners) => {
      count += listeners.length;
    });
    return count;
  }
}

export const eventListenerManager = new EventListenerManager();

// ==========================================
// 3. Image Loader - Lazy load with cleanup
// ==========================================
class ImageLoader {
  constructor() {
    this.loadedImages = new Set();
    this.intersectionObserver = null;
  }

  init() {
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = entry.target;
              const src = img.dataset.src;
              if (src && !img.src) {
                img.src = src;
                this.loadedImages.add(src);
                this.intersectionObserver.unobserve(img);
              }
            }
          });
        },
        {
          rootMargin: '50px', // Load slightly before visible
          threshold: 0.01
        }
      );
    }
  }

  observe(img) {
    if (this.intersectionObserver) {
      this.intersectionObserver.observe(img);
    }
  }

  unobserve(img) {
    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(img);
    }
  }

  cleanup() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    this.loadedImages.clear();
  }

  getLoadedCount() {
    return this.loadedImages.size;
  }
}

export const imageLoader = new ImageLoader();

// ==========================================
// 4. Component Cleanup Manager
// ==========================================
class ComponentCleanupManager {
  constructor() {
    this.cleanupFunctions = new Map();
  }

  register(componentId, cleanupFn) {
    if (!this.cleanupFunctions.has(componentId)) {
      this.cleanupFunctions.set(componentId, []);
    }
    this.cleanupFunctions.get(componentId).push(cleanupFn);
  }

  cleanup(componentId) {
    const cleanupFns = this.cleanupFunctions.get(componentId);
    if (cleanupFns) {
      cleanupFns.forEach((fn) => {
        try {
          fn();
        } catch (error) {
          console.error(`Cleanup error for ${componentId}:`, error);
        }
      });
      this.cleanupFunctions.delete(componentId);
    }
  }

  cleanupAll() {
    this.cleanupFunctions.forEach((fns, id) => {
      this.cleanup(id);
    });
  }
}

export const cleanupManager = new ComponentCleanupManager();

// ==========================================
// 5. Memory Monitor - Detect leaks
// ==========================================
class MemoryMonitor {
  constructor() {
    this.samples = [];
    this.warningThreshold = 100; // MB
    this.criticalThreshold = 150; // MB
  }

  check() {
    if (!performance.memory) return null;

    const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    const limitMB = Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024);
    const percentage = Math.round((usedMB / limitMB) * 100);

    const sample = {
      timestamp: Date.now(),
      usedMB,
      limitMB,
      percentage
    };

    this.samples.push(sample);
    if (this.samples.length > 20) {
      this.samples.shift();
    }

    // Check thresholds
    if (usedMB > this.criticalThreshold) {
      console.error(`🚨 CRITICAL MEMORY: ${usedMB}MB (${percentage}%)`);
      this.triggerEmergencyCleanup();
    } else if (usedMB > this.warningThreshold) {
      console.warn(`⚠️ HIGH MEMORY: ${usedMB}MB (${percentage}%)`);
    }

    return sample;
  }

  triggerEmergencyCleanup() {
    console.log('🧹 EMERGENCY CLEANUP TRIGGERED');
    
    // Cancel all RAFs
    rafManager.cancelAll();
    console.log('✅ Canceled all RAF');
    
    // Report current state
    console.log('📊 Active resources:');
    console.log('  - RAFs:', rafManager.getActiveCount());
    console.log('  - Event Listeners:', eventListenerManager.getActiveCount());
    console.log('  - Loaded Images:', imageLoader.getLoadedCount());
  }

  getAverageMemory() {
    if (this.samples.length === 0) return 0;
    const sum = this.samples.reduce((acc, sample) => acc + sample.usedMB, 0);
    return Math.round(sum / this.samples.length);
  }

  getMemoryTrend() {
    if (this.samples.length < 2) return 'stable';
    
    const recent = this.samples.slice(-5);
    const older = this.samples.slice(-10, -5);
    
    const recentAvg = recent.reduce((acc, s) => acc + s.usedMB, 0) / recent.length;
    const olderAvg = older.reduce((acc, s) => acc + s.usedMB, 0) / older.length;
    
    const diff = recentAvg - olderAvg;
    
    if (diff > 10) return 'increasing';
    if (diff < -10) return 'decreasing';
    return 'stable';
  }
}

export const memoryMonitor = new MemoryMonitor();

// ==========================================
// 6. Initialize all monitors
// ==========================================
export function initializePerformanceMonitoring() {
  console.log('🚀 Initializing performance monitoring...');
  
  // Initialize image loader
  imageLoader.init();
  
  // Monitor memory every 5 seconds
  setInterval(() => {
    memoryMonitor.check();
  }, 5000);
  
  // Log status every 30 seconds
  setInterval(() => {
    const memory = memoryMonitor.check();
    const trend = memoryMonitor.getMemoryTrend();
    
    console.log('📊 Performance Status:');
    console.log(`  Memory: ${memory?.usedMB}MB (trend: ${trend})`);
    console.log(`  RAFs: ${rafManager.getActiveCount()}`);
    console.log(`  Event Listeners: ${eventListenerManager.getActiveCount()}`);
    console.log(`  Images: ${imageLoader.getLoadedCount()}`);
  }, 30000);
  
  console.log('✅ Performance monitoring initialized');
}

// Emergency cleanup on page visibility change
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('👋 Page hidden - performing cleanup');
      rafManager.cancelAll();
    }
  });
}

// Cleanup on beforeunload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    console.log('👋 Page unloading - performing cleanup');
    rafManager.cancelAll();
    eventListenerManager.removeAll();
    cleanupManager.cleanupAll();
    imageLoader.cleanup();
  });
}
