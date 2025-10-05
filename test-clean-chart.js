#!/usr/bin/env node

const axios = require('axios');

async function testCleanChart() {
    console.log('🧪 Testing CleanPriceChart integration...\n');
    
    // Test 1: Check if universal chart API is running
    try {
        console.log('1️⃣ Testing Universal Chart API...');
        const healthResponse = await axios.get('http://localhost:3005/health');
        console.log('✅ API Status:', healthResponse.data.status);
        console.log('📊 Endpoints:', healthResponse.data.endpoints.join(', '));
        console.log('');
    } catch (error) {
        console.log('❌ Universal Chart API not responding!');
        console.log('   Please start the backend: node backend/universal-chart-server.js');
        return false;
    }
    
    // Test 2: Test BAGWORK chart data
    try {
        console.log('2️⃣ Testing BAGWORK chart data...');
        const bagworkAddress = '7Pnqg1S6MYrL6AP1ZXcToTHfdBbTB77ze6Y33qBBpump';
        const chartResponse = await axios.get(`http://localhost:3005/api/token-chart/${bagworkAddress}`);
        
        if (chartResponse.data.success) {
            const chart = chartResponse.data.chart;
            console.log('✅ Chart Data Success:');
            console.log(`   📈 Data Points: ${chart.points.length}`);
            console.log(`   🎯 Token: ${chartResponse.data.tokenInfo?.symbol} (${chartResponse.data.tokenInfo?.name})`);
            console.log(`   💰 Price Range: $${chart.priceInfo.min.toFixed(8)} → $${chart.priceInfo.max.toFixed(8)}`);
            console.log(`   📊 1H Change: ${chart.priceInfo.change > 0 ? '+' : ''}${chart.priceInfo.change.toFixed(2)}%`);
            console.log(`   ⏰ Timeframe: ${chart.metadata.timeframe} (${chart.metadata.interval} intervals)`);
            console.log('');
        } else {
            console.log('❌ Chart API returned failure:', chartResponse.data.error);
            return false;
        }
    } catch (error) {
        console.log('❌ Failed to get BAGWORK chart data:', error.message);
        return false;
    }
    
    // Test 3: Check frontend
    try {
        console.log('3️⃣ Testing Frontend...');
        const frontendResponse = await axios.get('http://localhost:5174', { 
            timeout: 3000,
            validateStatus: () => true // Don't throw on any status
        });
        
        if (frontendResponse.status === 200) {
            console.log('✅ Frontend running on http://localhost:5174');
            console.log('   🎯 CleanPriceChart should be visible in coin pages (Clean View tab)');
            console.log('');
        } else {
            console.log('⚠️ Frontend responding but with status:', frontendResponse.status);
        }
    } catch (error) {
        console.log('❌ Frontend not responding on port 5174');
        console.log('   Please start frontend: npm run dev');
        console.log('');
    }
    
    // Test 4: Test another token to verify universal API
    try {
        console.log('4️⃣ Testing another token (SOL/USDC)...');
        const solAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
        const solChartResponse = await axios.get(`http://localhost:3005/api/token-chart/${solAddress}`, { 
            timeout: 10000 // 10 second timeout for rate limiting
        });
        
        if (solChartResponse.data.success) {
            const chart = solChartResponse.data.chart;
            console.log('✅ Universal API works for other tokens:');
            console.log(`   📈 Data Points: ${chart.points.length}`);
            console.log(`   🎯 Token: ${solChartResponse.data.tokenInfo?.symbol || 'Unknown'}`);
            console.log('');
        } else {
            console.log('⚠️ Other token failed:', solChartResponse.data.error);
            console.log('   (This might be due to Birdeye API rate limits)');
            console.log('');
        }
    } catch (error) {
        console.log('⚠️ Other token test failed:', error.message);
        console.log('   (This might be due to Birdeye API rate limits)');
        console.log('');
    }
    
    console.log('🎉 CleanPriceChart Test Complete!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   • CleanPriceChart should show 60 real price points for the last hour');
    console.log('   • Data source indicator shows "🎯 Live Market Data (60 Points)"');
    console.log('   • Chart appears in coin pages under "Clean View" tab (default)');
    console.log('   • Universal chart API provides real market data via Birdeye');
    console.log('');
    console.log('🔗 Test URLs:');
    console.log('   Frontend: http://localhost:5174');
    console.log('   API Health: http://localhost:3005/health');
    console.log(`   BAGWORK Chart: http://localhost:3005/api/token-chart/7Pnqg1S6MYrL6AP1ZXcToTHfdBbTB77ze6Y33qBBpump`);
    
    return true;
}

// Run the test
testCleanChart().catch(console.error);
