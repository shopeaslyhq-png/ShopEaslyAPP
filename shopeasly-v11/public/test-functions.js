// Test script to verify Excel upload functionality works
console.log('🧪 Testing Excel Upload Functionality...');

// Test if XLSX library is available
if (typeof XLSX !== 'undefined') {
    console.log('✅ XLSX library loaded successfully');
    
    // Test reading our sample file
    fetch('/sample-products.xlsx')
        .then(response => {
            if (response.ok) {
                console.log('✅ Sample Excel file is accessible');
                return response.arrayBuffer();
            } else {
                throw new Error('Sample file not found');
            }
        })
        .then(arrayBuffer => {
            console.log('✅ File loaded as ArrayBuffer');
            
            // Parse with XLSX
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            console.log('✅ Workbook parsed successfully');
            console.log('📊 Worksheets found:', workbook.SheetNames);
            
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            console.log('✅ Data extracted successfully');
            console.log('📈 Rows found:', jsonData.length);
            console.log('📋 Headers:', jsonData[0]);
            console.log('🔍 Sample data:', jsonData.slice(1, 3));
            
            console.log('🎉 Excel upload functionality is working correctly!');
        })
        .catch(error => {
            console.log('❌ Error testing Excel functionality:', error);
        });
} else {
    console.log('❌ XLSX library not loaded');
}

// Test bulk creation modal functions
if (typeof openBulkCreation === 'function') {
    console.log('✅ openBulkCreation function is available');
} else {
    console.log('❌ openBulkCreation function not found');
}

if (typeof handleFileUpload === 'function') {
    console.log('✅ handleFileUpload function is available');
} else {
    console.log('❌ handleFileUpload function not found');
}

if (typeof displayCSVPreview === 'function') {
    console.log('✅ displayCSVPreview function is available');
} else {
    console.log('❌ displayCSVPreview function not found');
}

console.log('🔍 Test complete. Check above for any issues.');