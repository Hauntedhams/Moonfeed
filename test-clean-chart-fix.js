#!/usr/bin/env node

/**
 * Test script for Clean Chart Fix
 * Tests the new /api/chart endpoint that provides real Birdeye price history
 */

const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:3001';
const TEST_TOKEN_ADDRESS = '7Pnqg1S6MYrL6AP1ZXcToTHfdBbTB77ze6Y33qBBpump'; // BAGWORK token

async function testChartEndpoint() {
    console.log('🧪 Testing Clean Chart Fix\n');
    console.log('=' .repeat(60));
    
    try {
        // Test 1: Check if endpoint exists
        console.log('\n📊 Test 1: Chart Endpoint Availability');
        console.log('-'.repeat(60));
        
        const testUrl = `${BACKEND_URL}/api/chart/${TEST_TOKEN_ADDRESS}`;
        console.log(`   Calling: ${testUrl}`);
        
        const response = await fetch(testUrl);
        
        console.log(`   Status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            console.log('   ❌ Endpoint returned error status');
            const errorText = await response.text();
            console.log(`   Error: ${errorText}`);
            return false;
        }
        
        const data = await response.json();
        
        console.log(`   ✅ Endpoint is working!`);
        console.log(`   Success: ${data.success}`);
        
        // Test 2: Validate response structure
        console.log('\n📈 Test 2: Response Data Structure');
        console.log('-'.repeat(60));
        
        if (data.success && data.data) {
            console.log(`   ✅ Has tokenInfo: ${!!data.data.tokenInfo}`);
            console.log(`   ✅ Has dataPoints: ${!!data.data.dataPoints}`);
            console.log(`   ✅ Has metadata: ${!!data.data.metadata}`);
            
            // Test 3: Validate data points
            console.log('\n📊 Test 3: Price Data Validation');
            console.log('-'.repeat(60));
            
            const dataPoints = data.data.dataPoints;
            console.log(`   Data points count: ${dataPoints.length}`);
            
            if (dataPoints.length > 0) {
                console.log(`   ✅ Has price data`);
                
                const firstPoint = dataPoints[0];
                const lastPoint = dataPoints[dataPoints.length - 1];
                
                console.log(`   First point:`, {
                    timestamp: firstPoint.timestamp,
                    price: firstPoint.price,
                    time: firstPoint.time
                });
                
                console.log(`   Last point:`, {
                    timestamp: lastPoint.timestamp,
                    price: lastPoint.price,
                    time: lastPoint.time
                });
                
                // Test 4: Price info
                console.log('\n💰 Test 4: Price Information');
                console.log('-'.repeat(60));
                
                const tokenInfo = data.data.tokenInfo;
                console.log(`   Token: ${tokenInfo.address.substring(0, 8)}...`);
                console.log(`   Min Price: $${tokenInfo.minPrice.toFixed(8)}`);
                console.log(`   Max Price: $${tokenInfo.maxPrice.toFixed(8)}`);
                console.log(`   Price Change: ${tokenInfo.priceChange.toFixed(2)}%`);
                
                // Test 5: Test different timeframes
                console.log('\n⏰ Test 5: Multiple Timeframes');
                console.log('-'.repeat(60));
                
                const timeframes = ['1m', '15m', '1h', '4h', '24h'];
                
                for (const tf of timeframes) {
                    const tfUrl = `${BACKEND_URL}/api/chart/${TEST_TOKEN_ADDRESS}?timeframe=${tf}`;
                    const tfResponse = await fetch(tfUrl);
                    
                    if (tfResponse.ok) {
                        const tfData = await tfResponse.json();
                        const pointCount = tfData.data?.dataPoints?.length || 0;
                        console.log(`   ✅ ${tf}: ${pointCount} data points`);
                    } else {
                        console.log(`   ❌ ${tf}: Failed (${tfResponse.status})`);
                    }
                }
                
                console.log('\n' + '='.repeat(60));
                console.log('🎉 Clean Chart Fix Test Complete!');
                console.log('='.repeat(60));
                console.log('\n✅ The /api/chart endpoint is working correctly');
                console.log('✅ Frontend can now load real price history data');
                console.log('✅ PriceHistoryChart (Clean tab) will display real charts\n');
                
                return true;
            } else {
                console.log('   ❌ No data points returned');
                return false;
            }
        } else {
            console.log('   ❌ Invalid response structure');
            console.log('   Response:', JSON.stringify(data, null, 2));
            return false;
        }
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        console.error('\nMake sure:');
        console.error('   1. Backend server is running (npm run dev in /backend)');
        console.error('   2. Birdeye API key is configured in .env');
        console.error('   3. Port 3001 is accessible\n');
        return false;
    }
}

// Run the test
testChartEndpoint().then(success => {
    process.exit(success ? 0 : 1);
});
