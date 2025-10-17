#!/usr/bin/env node

/**
 * APK Deployment Script for AGHAM App
 * 
 * This script helps you deploy your APK file for direct download
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 AGHAM APK Deployment Helper');
console.log('================================\n');

// Check if public directory exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
    console.log('❌ Public directory not found. Creating...');
    fs.mkdirSync(publicDir, { recursive: true });
}

// Check if APK file exists
const apkPath = path.join(publicDir, 'agham-app.apk');
if (!fs.existsSync(apkPath)) {
    console.log('📱 APK File Setup Instructions:');
    console.log('1. Build your APK file in Unity/Android Studio');
    console.log('2. Copy your APK file to: ' + apkPath);
    console.log('3. Rename it to: agham-app.apk');
    console.log('4. Run this script again\n');
    
    console.log('💡 Alternative APK names you can use:');
    console.log('   - agham-app.apk (recommended)');
    console.log('   - AGHAM-v1.0.apk');
    console.log('   - agham-mobile.apk\n');
} else {
    const stats = fs.statSync(apkPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log('✅ APK file found!');
    console.log('📁 File: agham-app.apk');
    console.log('📏 Size: ' + fileSizeInMB + ' MB');
    console.log('🔗 Download URL: https://your-domain.com/agham-app.apk\n');
}

console.log('🌐 Deployment Options:');
console.log('1. Vercel (Recommended for Next.js):');
console.log('   - Upload APK to public folder');
console.log('   - Deploy with: vercel --prod');
console.log('   - APK will be available at: https://your-app.vercel.app/agham-app.apk\n');

console.log('2. Netlify:');
console.log('   - Upload APK to public folder');
console.log('   - Deploy with: netlify deploy --prod');
console.log('   - APK will be available at: https://your-app.netlify.app/agham-app.apk\n');

console.log('3. GitHub Pages:');
console.log('   - Upload APK to public folder');
console.log('   - Push to GitHub');
console.log('   - Enable GitHub Pages in repository settings\n');

console.log('4. Custom Server:');
console.log('   - Upload APK to your server\'s public directory');
console.log('   - Ensure proper MIME type: application/vnd.android.package-archive\n');

console.log('📋 Next Steps:');
console.log('1. Place your APK file in the public folder');
console.log('2. Deploy your website');
console.log('3. Test the download link');
console.log('4. Share the download URL with users\n');

console.log('🔧 MIME Type Configuration:');
console.log('If downloads don\'t work, add this to your server config:');
console.log('Add-Type: application/vnd.android.package-archive .apk\n');

console.log('✨ Your download button is ready!');
console.log('Users can now click "Download APK" to get your app directly.');
