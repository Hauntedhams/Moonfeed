/**
 * 🧪 Chart Horizontal Scroll Diagnostic Test
 * 
 * Run this in the browser console while viewing a coin card to test scroll functionality.
 * 
 * Usage:
 * 1. Open the app in browser
 * 2. Scroll to a coin with visible charts
 * 3. Open DevTools console (F12)
 * 4. Copy and paste this entire script
 * 5. Run: testChartScroll()
 */

function testChartScroll() {
  console.clear();
  console.log('🧪 CHART SCROLL DIAGNOSTIC TEST\n');
  console.log('═'.repeat(50));
  
  // Find the charts container
  const chartsContainer = document.querySelector('.charts-horizontal-container');
  
  if (!chartsContainer) {
    console.error('❌ Charts container not found!');
    console.log('💡 Make sure you\'re viewing a coin card with charts visible');
    return;
  }
  
  console.log('✅ Charts container found');
  
  // Test 1: Check container properties
  console.log('\n📋 Container Properties:');
  console.log('─'.repeat(50));
  const containerWidth = chartsContainer.clientWidth;
  const scrollWidth = chartsContainer.scrollWidth;
  const scrollLeft = chartsContainer.scrollLeft;
  
  console.log(`  Width: ${containerWidth}px`);
  console.log(`  Scroll Width: ${scrollWidth}px (should be ~${containerWidth * 2}px for 2 pages)`);
  console.log(`  Current Scroll Position: ${scrollLeft}px`);
  console.log(`  Current Page: ${Math.round(scrollLeft / containerWidth)}`);
  
  const isScrollable = scrollWidth > containerWidth;
  console.log(`  Is Scrollable: ${isScrollable ? '✅ Yes' : '❌ No'}`);
  
  // Test 2: Check CSS properties
  console.log('\n🎨 CSS Properties:');
  console.log('─'.repeat(50));
  const styles = window.getComputedStyle(chartsContainer);
  console.log(`  overflow-x: ${styles.overflowX} (should be "auto" or "scroll")`);
  console.log(`  scroll-snap-type: ${styles.scrollSnapType} (should include "x mandatory")`);
  console.log(`  scroll-behavior: ${styles.scrollBehavior} (should be "smooth")`);
  console.log(`  display: ${styles.display} (should be "flex")`);
  
  // Test 3: Check nav dots
  console.log('\n🎯 Navigation Dots:');
  console.log('─'.repeat(50));
  const navDots = document.querySelectorAll('.chart-nav-dots-top .nav-dot');
  console.log(`  Found: ${navDots.length} dots (should be 2)`);
  
  navDots.forEach((dot, i) => {
    const isActive = dot.classList.contains('active');
    console.log(`  Dot ${i}: ${isActive ? '🟢 ACTIVE' : '⚪ Inactive'}`);
  });
  
  // Test 4: Check chart pages
  console.log('\n📄 Chart Pages:');
  console.log('─'.repeat(50));
  const chartPages = chartsContainer.querySelectorAll('.chart-page');
  console.log(`  Found: ${chartPages.length} pages (should be 2)`);
  
  chartPages.forEach((page, i) => {
    const pageWidth = page.offsetWidth;
    const pageStyles = window.getComputedStyle(page);
    console.log(`  Page ${i}:`);
    console.log(`    Width: ${pageWidth}px`);
    console.log(`    Flex: ${pageStyles.flex}`);
    console.log(`    Scroll Snap Align: ${pageStyles.scrollSnapAlign}`);
  });
  
  // Test 5: Interactive scroll test
  console.log('\n🎬 Interactive Scroll Test:');
  console.log('─'.repeat(50));
  console.log('  Starting automated scroll test...\n');
  
  let testStep = 0;
  
  const runScrollTest = () => {
    switch(testStep) {
      case 0:
        console.log('  ➡️  Step 1: Scrolling to page 1 (Advanced Chart)...');
        chartsContainer.scrollTo({ left: containerWidth, behavior: 'smooth' });
        testStep++;
        setTimeout(runScrollTest, 1000);
        break;
        
      case 1:
        const currentPos1 = chartsContainer.scrollLeft;
        const currentPage1 = Math.round(currentPos1 / containerWidth);
        console.log(`     Current position: ${currentPos1}px (Page ${currentPage1})`);
        console.log(currentPage1 === 1 ? '     ✅ Successfully scrolled to page 1' : '     ❌ Failed to scroll to page 1');
        testStep++;
        setTimeout(runScrollTest, 500);
        break;
        
      case 2:
        console.log('\n  ⬅️  Step 2: Scrolling back to page 0 (Clean Chart)...');
        chartsContainer.scrollTo({ left: 0, behavior: 'smooth' });
        testStep++;
        setTimeout(runScrollTest, 1000);
        break;
        
      case 3:
        const currentPos2 = chartsContainer.scrollLeft;
        const currentPage2 = Math.round(currentPos2 / containerWidth);
        console.log(`     Current position: ${currentPos2}px (Page ${currentPage2})`);
        console.log(currentPage2 === 0 ? '     ✅ Successfully scrolled back to page 0' : '     ❌ Failed to scroll back to page 0');
        testStep++;
        setTimeout(runScrollTest, 500);
        break;
        
      case 4:
        console.log('\n🎉 Automated Test Complete!\n');
        console.log('═'.repeat(50));
        console.log('\n📝 Manual Test Instructions:');
        console.log('  1. Try swiping/dragging on the nav dots area');
        console.log('  2. Click each nav dot to switch pages');
        console.log('  3. Check that active dot updates correctly');
        console.log('  4. Verify smooth scroll animation');
        console.log('  5. Test on both mobile and desktop\n');
        break;
    }
  };
  
  runScrollTest();
}

// Helper function to monitor scroll events
function monitorScroll(duration = 10000) {
  console.clear();
  console.log('👀 MONITORING SCROLL EVENTS\n');
  console.log('═'.repeat(50));
  console.log(`Monitoring for ${duration/1000} seconds...`);
  console.log('Try scrolling the charts now!\n');
  
  const chartsContainer = document.querySelector('.charts-horizontal-container');
  
  if (!chartsContainer) {
    console.error('❌ Charts container not found!');
    return;
  }
  
  let scrollCount = 0;
  
  const handler = (e) => {
    scrollCount++;
    const scrollLeft = chartsContainer.scrollLeft;
    const containerWidth = chartsContainer.clientWidth;
    const currentPage = Math.round(scrollLeft / containerWidth);
    
    console.log(`📊 Scroll Event #${scrollCount}:`);
    console.log(`   Position: ${scrollLeft.toFixed(0)}px`);
    console.log(`   Page: ${currentPage}`);
    console.log(`   Timestamp: ${new Date().toLocaleTimeString()}\n`);
  };
  
  chartsContainer.addEventListener('scroll', handler);
  
  setTimeout(() => {
    chartsContainer.removeEventListener('scroll', handler);
    console.log('═'.repeat(50));
    console.log(`\n✅ Monitoring complete. Total scroll events: ${scrollCount}\n`);
  }, duration);
}

// Auto-run the main test
console.log('🚀 Chart Scroll Diagnostic Loaded!');
console.log('\nAvailable Commands:');
console.log('  testChartScroll()     - Run full diagnostic test');
console.log('  monitorScroll(10000)  - Monitor scroll events for 10 seconds');
console.log('\nRunning automatic test in 2 seconds...\n');

setTimeout(() => {
  testChartScroll();
}, 2000);
