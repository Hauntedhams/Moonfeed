#!/usr/bin/env node
/**
 * Test Birdeye WebSocket connection directly
 * This tests if we can connect to Birdeye from the backend
 */

const WebSocketClient = require('websocket').client;
const util = require("util");

const BIRDEYE_API_KEY = '29e047952f0d45ed8927939bbc08f09c';
const BIRDEYE_WS_URL = 'wss://public-api.birdeye.so/socket/solana';
const TEST_TOKEN = '68juafUzrfoshWb2QFCkGHoPAErmhmxxn19BrTkPzHB6'; // Probos

console.log('🧪 Testing Birdeye WebSocket connection...\n');

const client = new WebSocketClient();

client.on('connectFailed', function (error) {
    console.log('❌ Connect Error:', error.toString());
    process.exit(1);
});

client.on('connect', function (connection) {
    console.log('✅ WebSocket Client Connected\n');
    
    connection.on('error', function (error) {
        console.log("❌ Connection Error:", error.toString());
    });
    
    connection.on('close', function () {
        console.log('\n🔌 Connection Closed');
        process.exit(0);
    });
    
    connection.on('message', function (message) {
        if (message.type === 'utf8') {
            try {
                const data = JSON.parse(message.utf8Data);
                console.log('📨 Received:', JSON.stringify(data, null, 2));
                
                // Exit after receiving a few messages
                if (data.type === 'PRICE_DATA') {
                    console.log('\n✅ SUCCESS: Received price data!');
                    console.log('   This confirms Birdeye WebSocket works from backend');
                    connection.close();
                }
            } catch (e) {
                console.log("Received:", message.utf8Data);
            }
        }
    });

    // Subscribe to price updates
    const msg = {
        type: "SUBSCRIBE_PRICE",
        data: {
            chartType: "1m",
            currency: "pair",
            address: TEST_TOKEN
        }
    };

    console.log('📤 Sending subscription:', msg);
    connection.send(JSON.stringify(msg));
    
    // Auto-close after 10 seconds
    setTimeout(() => {
        console.log('\n⏱️  Test timeout - closing connection');
        connection.close();
    }, 10000);
});

const url = util.format('%s?x-api-key=%s', BIRDEYE_WS_URL, BIRDEYE_API_KEY);
console.log('🔌 Connecting to:', url.replace(BIRDEYE_API_KEY, '***'));
console.log('📋 Protocol: echo-protocol');
console.log('🌐 Origin: https://birdeye.so\n');

client.connect(url, 'echo-protocol', "https://birdeye.so");
