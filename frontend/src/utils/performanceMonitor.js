// Mobile Performance Diagnostic Tool
// Run this in browser console to monitor memory and performance

class MobilePerformanceMonitor {
  constructor() {
    this.startTime = Date.now();
    this.samples = [];
    this.maxSamples = 100;
    this.isRunning = false;
    this.interval = null;
  }

  // Start monitoring
  start() {
    if (this.isRunning) return;
    
    console.log('🔍 Mobile Performance Monitor Started');
    console.log('📱 Device:', navigator.userAgent);
    console.log('📊 Screen:', `${window.innerWidth}x${window.innerHeight}`);
    
    this.isRunning = true;
    this.interval = setInterval(() => this.sample(), 2000);
    
    // Also monitor specific events
    this.attachEventListeners();
  }

  // Take a performance sample
  sample() {
    const sample = {
      timestamp: Date.now() - this.startTime,
      memory: this.getMemoryInfo(),
      dom: this.getDOMInfo(),
      performance: this.getPerformanceInfo()
    };
    
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
    
    // Log warning if memory is high
    if (sample.memory.usedMB > 150) {
      console.warn('⚠️ HIGH MEMORY:', sample.memory.usedMB, 'MB');
    }
  }

  // Get memory information
  getMemoryInfo() {
    if (performance.memory) {
      return {
        usedMB: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        totalMB: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limitMB: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
        percentage: Math.round((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100)
      };
    }
    return { error: 'Memory API not available' };
  }

  // Get DOM information
  getDOMInfo() {
    return {
      nodes: document.getElementsByTagName('*').length,
      images: document.images.length,
      scripts: document.scripts.length,
      iframes: document.getElementsByTagName('iframe').length,
      listeners: this.estimateEventListeners()
    };
  }

  // Get performance metrics
  getPerformanceInfo() {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      loadTime: nav ? Math.round(nav.loadEventEnd - nav.fetchStart) : 0,
      fps: this.estimateFPS(),
      longTasks: performance.getEntriesByType('longtask').length
    };
  }

  // Estimate event listeners (rough count)
  estimateEventListeners() {
    let count = 0;
    const elements = document.getElementsByTagName('*');
    for (let elem of elements) {
      const events = getEventListeners ? getEventListeners(elem) : {};
      count += Object.keys(events).length;
    }
    return count;
  }

  // Estimate FPS
  estimateFPS() {
    // This is a simplified estimation
    return Math.round(1000 / 16.67); // Assuming 60fps target
  }

  // Attach event listeners for diagnostics
  attachEventListeners() {
    // Monitor scroll events
    let scrollCount = 0;
    window.addEventListener('scroll', () => {
      scrollCount++;
    }, { passive: true });

    // Monitor component renders (if React DevTools available)
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      console.log('✅ React DevTools detected');
    }

    // Monitor memory warnings
    if ('memory' in performance) {
      setInterval(() => {
        const mem = this.getMemoryInfo();
        if (mem.percentage > 80) {
          console.error('🚨 CRITICAL MEMORY:', mem.usedMB, 'MB (', mem.percentage, '%)');
        }
      }, 5000);
    }
  }

  // Generate report
  report() {
    console.log('📊 PERFORMANCE REPORT');
    console.log('='.repeat(50));
    
    if (this.samples.length === 0) {
      console.log('No samples collected yet');
      return;
    }

    const latest = this.samples[this.samples.length - 1];
    const first = this.samples[0];
    
    console.log('⏱️  Runtime:', Math.round((Date.now() - this.startTime) / 1000), 'seconds');
    console.log('');
    
    console.log('💾 MEMORY:');
    console.log('  Current:', latest.memory.usedMB, 'MB');
    console.log('  Limit:', latest.memory.limitMB, 'MB');
    console.log('  Usage:', latest.memory.percentage, '%');
    console.log('  Growth:', (latest.memory.usedMB - first.memory.usedMB), 'MB');
    console.log('');
    
    console.log('🌳 DOM:');
    console.log('  Nodes:', latest.dom.nodes);
    console.log('  Images:', latest.dom.images);
    console.log('  iframes:', latest.dom.iframes);
    console.log('  Scripts:', latest.dom.scripts);
    console.log('');
    
    console.log('⚡ PERFORMANCE:');
    console.log('  Load Time:', latest.performance.loadTime, 'ms');
    console.log('  Long Tasks:', latest.performance.longTasks);
    console.log('');
    
    // Memory leak detection
    const memoryGrowth = latest.memory.usedMB - first.memory.usedMB;
    if (memoryGrowth > 50) {
      console.error('🚨 POSSIBLE MEMORY LEAK:', memoryGrowth, 'MB growth');
    }
    
    // DOM bloat detection
    if (latest.dom.nodes > 3000) {
      console.warn('⚠️ HIGH DOM NODE COUNT:', latest.dom.nodes);
    }
    
    console.log('='.repeat(50));
  }

  // Stop monitoring
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.isRunning = false;
    console.log('🛑 Monitoring stopped');
    this.report();
  }

  // Find memory hogs
  findMemoryHogs() {
    console.log('🔍 SEARCHING FOR MEMORY HOGS...');
    
    // Check for large images
    const images = Array.from(document.images);
    const largeImages = images.filter(img => {
      return img.naturalWidth * img.naturalHeight > 1000000; // > 1MP
    });
    
    if (largeImages.length > 0) {
      console.warn('📸 Large images found:', largeImages.length);
      largeImages.forEach(img => {
        console.log('  -', img.src, `(${img.naturalWidth}x${img.naturalHeight})`);
      });
    }
    
    // Check for iframes (charts, embeds)
    const iframes = document.getElementsByTagName('iframe');
    if (iframes.length > 0) {
      console.warn('🖼️  iframes found:', iframes.length);
      Array.from(iframes).forEach(iframe => {
        console.log('  -', iframe.src);
      });
    }
    
    // Check for WebSocket connections
    console.log('🔌 WebSocket connections:', window.__WEBSOCKET_COUNT__ || 'Unknown');
    
    // Check local storage
    let localStorageSize = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        localStorageSize += localStorage[key].length;
      }
    }
    console.log('💾 LocalStorage size:', Math.round(localStorageSize / 1024), 'KB');
  }
}

// Create global monitor instance
window.perfMonitor = new MobilePerformanceMonitor();

console.log('📱 Mobile Performance Monitor loaded!');
console.log('📝 Usage:');
console.log('  perfMonitor.start()  - Start monitoring');
console.log('  perfMonitor.report() - Get current report');
console.log('  perfMonitor.stop()   - Stop and generate final report');
console.log('  perfMonitor.findMemoryHogs() - Find memory-intensive elements');

export default MobilePerformanceMonitor;
