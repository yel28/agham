#!/usr/bin/env node

/**
 * Update Download Link Helper
 * 
 * Use this to update your download button with a cloud-hosted APK link
 */

const fs = require('fs');
const path = require('path');

console.log('🔗 Download Link Update Helper');
console.log('==============================\n');

console.log('📋 To update your download button:');
console.log('1. Get your cloud APK link (Google Drive, Dropbox, etc.)');
console.log('2. Run this command:');
console.log('   node update-download-link.js "YOUR_APK_LINK_HERE"\n');

console.log('💡 Example:');
console.log('   node update-download-link.js "https://drive.google.com/file/d/1234567890/view"\n');

// Check if link provided
const apkLink = process.argv[2];

if (apkLink) {
    console.log('🔄 Updating download button...\n');
    
    // Read the homepage file
    const homepagePath = path.join(__dirname, 'app', 'homepage', 'page.jsx');
    
    if (fs.existsSync(homepagePath)) {
        let content = fs.readFileSync(homepagePath, 'utf8');
        
        // Update the href
        content = content.replace(
            /href="\/agham-app\.apk"/g,
            `href="${apkLink}"`
        );
        
        // Write back
        fs.writeFileSync(homepagePath, content);
        
        console.log('✅ Download button updated!');
        console.log('🔗 New link: ' + apkLink);
        console.log('\n📋 Next steps:');
        console.log('1. Deploy again: vercel --prod --yes');
        console.log('2. Test the download link');
        console.log('3. Share your website URL\n');
        
    } else {
        console.log('❌ Homepage file not found');
    }
} else {
    console.log('💡 Usage: node update-download-link.js "YOUR_APK_LINK"');
}
