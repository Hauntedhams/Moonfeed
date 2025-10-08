// Performance Monitoring Script
// Run this in browser console to monitor performance improvements

class PerformanceMonitor {
  constructor() {
    this.logCount = 0;
    this.errorCount = 0;
    this.renderCount = 0;
    this.startTime = Date.now();
    this.originalLog = console.log;
    this.originalError = console.error;
    this.originalWarn = console.warn;
    
    this.init();
  }
  
  init() {
    // Monitor console logs
    console.log = (...args) => {
      this.logCount++;
      this.originalLog(...args);
    };
    
    // Monitor errors
    console.error = (...args) => {
      this.errorCount++;
      this.originalError(...args);
    };
    
    // Monitor warnings
    console.warn = (...args) => {
      this.errorCount++;
      this.originalWarn(...args);
    };
    
    // Monitor React renders
    this.observeRenders();
    
    // Report every 30 seconds
    this.reportInterval = setInterval(() => {
      this.report();
    }, 30000);
    
    console.log('🔍 Performance Monitor started - will report every 30 seconds');
  }
  
  observeRenders() {
    // Monitor for React render count using React DevTools API if available
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      const originalOnCommitFiberRoot = hook.onCommitFiberRoot;
      
      hook.onCommitFiberRoot = (id, root, ...args) => {
        this.renderCount++;
        return originalOnCommitFiberRoot?.call(hook, id, root, ...args);
      };
    }
  }
  
  report() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const logsPerMinute = Math.round((this.logCount / elapsed) * 60);
    const errorsPerMinute = Math.round((this.errorCount / elapsed) * 60);
    const rendersPerMinute = Math.round((this.renderCount / elapsed) * 60);
    
    console.log('📊 PERFORMANCE REPORT:');
    console.log(`⏱️  Elapsed time: ${Math.round(elapsed)}s`);
    console.log(`📝 Console logs: ${this.logCount} total (${logsPerMinute}/min)`);
    console.log(`❌ Errors/warnings: ${this.errorCount} total (${errorsPerMinute}/min)`);
    console.log(`🔄 React renders: ${this.renderCount} total (${rendersPerMinute}/min)`);
    
    // Performance thresholds
    if (logsPerMinute > 100) {
      console.warn('⚠️  High logging frequency detected');
    } else {
      console.log('✅ Logging frequency is acceptable');
    }
    
    if (errorsPerMinute > 10) {
      console.warn('⚠️  High error rate detected');
    } else {
      console.log('✅ Error rate is acceptable');
    }
    
    if (rendersPerMinute > 200) {
      console.warn('⚠️  High render frequency detected');
    } else {
      console.log('✅ Render frequency is acceptable');
    }
  }
  
  stop() {
    console.log = this.originalLog;
    console.error = this.originalError;
    console.warn = this.originalWarn;
    clearInterval(this.reportInterval);
    this.report(); // Final report
    console.log('🔍 Performance Monitor stopped');
  }
}

// Auto-start monitor
const monitor = new PerformanceMonitor();

// Expose to global scope for manual control
window.performanceMonitor = monitor;

console.log('📊 Performance monitor running. Use window.performanceMonitor.stop() to stop.');
console.log('🎯 Target metrics:');
console.log('   - Logs: <100/min (was ~1000/min)');
console.log('   - Errors: <10/min');
console.log('   - Renders: <200/min');
