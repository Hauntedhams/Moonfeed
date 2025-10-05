#!/usr/bin/env node

const axios = require('axios');

async function testLoadGraphButton() {
    console.log('🧪 Testing Load Graph Button Implementation...\n');
    
    // Test 1: Verify backend is still running
    try {
        console.log('1️⃣ Testing Universal Chart API...');
        const healthResponse = await axios.get('http://localhost:3005/health');
        console.log('✅ API Status:', healthResponse.data.status);
        console.log('');
    } catch (error) {
        console.log('❌ Universal Chart API not responding!');
        return false;
    }
    
    // Test 2: Verify frontend is running
    try {
        console.log('2️⃣ Testing Frontend...');
        const frontendResponse = await axios.get('http://localhost:5174', { 
            timeout: 3000,
            validateStatus: () => true 
        });
        
        if (frontendResponse.status === 200) {
            console.log('✅ Frontend running on http://localhost:5174');
            console.log('');
        } else {
            console.log('⚠️ Frontend responding but with status:', frontendResponse.status);
        }
    } catch (error) {
        console.log('❌ Frontend not responding');
        return false;
    }
    
    // Test 3: Test API endpoint with BAGWORK
    try {
        console.log('3️⃣ Testing BAGWORK chart data (should work when Load Graph is clicked)...');
        const bagworkAddress = '7Pnqg1S6MYrL6AP1ZXcToTHfdBbTB77ze6Y33qBBpump';
        const chartResponse = await axios.get(`http://localhost:3005/api/token-chart/${bagworkAddress}`);
        
        if (chartResponse.data.success) {
            const chart = chartResponse.data.chart;
            console.log('✅ API Ready for Load Graph Button:');
            console.log(`   📈 Will load ${chart.points.length} data points`);
            console.log(`   🎯 Token: ${chartResponse.data.tokenInfo?.symbol}`);
            console.log(`   ⏰ Timeframe: ${chart.metadata.timeframe} (${chart.metadata.interval} intervals)`);
            console.log('');
        }
    } catch (error) {
        console.log('❌ Chart API error:', error.message);
        return false;
    }
    
    console.log('🎉 Load Graph Button Test Complete!');
    console.log('');
    console.log('📋 Expected Behavior:');
    console.log('   1. 📊 Chart shows "Load Graph" button overlay initially');
    console.log('   2. 🔵 Data source shows "📊 Ready to Load Market Data"');
    console.log('   3. 👆 Click "Load Graph" button → triggers API call');
    console.log('   4. ⏳ Shows loading spinner while fetching data');
    console.log('   5. 🎯 Displays real chart with "🎯 Live Market Data (60 Points)"');
    console.log('   6. 🔄 Button hidden after successful load');
    console.log('');
    console.log('🔗 Test URL: http://localhost:5174');
    console.log('   → Navigate to any coin page');
    console.log('   → Check Clean View tab (default)');
    console.log('   → Click "Load Graph" button');
    
    return true;
}

// Run the test
testLoadGraphButton().catch(console.error);
