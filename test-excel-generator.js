// Simple script to create a test Excel file for testing import functionality
import XLSX from 'xlsx';

// Sample product data
const products = [
    {
        name: 'Space Explorer T-Shirt',
        category: 'Apparel', 
        price: 24.99,
        stock: 25,
        description: 'Comfortable cotton t-shirt with space exploration theme',
        sku: 'APP-SPACE-001',
        imageUrl: '',
        materials: 'Cotton T-Shirt;Screen Print Ink'
    },
    {
        name: 'Galaxy Coffee Mug',
        category: 'Drinkware',
        price: 16.50,
        stock: 40,
        description: 'Ceramic mug with beautiful galaxy design',
        sku: 'DRK-GALAXY-002', 
        imageUrl: '',
        materials: 'Ceramic Mug;Sublimation Ink'
    },
    {
        name: 'Astronaut Sticker Pack',
        category: 'Stickers',
        price: 12.99,
        stock: 100,
        description: 'Pack of 10 high-quality vinyl stickers',
        sku: 'STK-ASTRO-003',
        imageUrl: '',
        materials: 'Vinyl Sticker Paper;Digital Print'
    },
    {
        name: 'Nebula Art Print',
        category: 'Prints',
        price: 29.99,
        stock: 15,
        description: 'Beautiful nebula artwork print on premium paper',
        sku: 'PRT-NEBULA-004',
        imageUrl: '',
        materials: 'Premium Photo Paper;Digital Print'
    },
    {
        name: 'Cosmic Hoodie',
        category: 'Apparel',
        price: 45.00,
        stock: 30,
        description: 'Warm hoodie with cosmic design',
        sku: 'APP-COSMIC-005',
        imageUrl: '',
        materials: 'Cotton Hoodie;Screen Print Ink'
    }
];

// Convert to array format for Excel
const data = [
    // Header row
    ['name', 'category', 'price', 'stock', 'description', 'sku', 'imageUrl', 'materials'],
    // Data rows
    ...products.map(product => [
        product.name,
        product.category,
        product.price,
        product.stock,
        product.description,
        product.sku,
        product.imageUrl,
        product.materials
    ])
];

// Create workbook and worksheet
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data);

// Set column widths for better formatting
ws['!cols'] = [
    { wch: 25 }, // name
    { wch: 12 }, // category
    { wch: 8 },  // price
    { wch: 8 },  // stock
    { wch: 40 }, // description
    { wch: 18 }, // sku
    { wch: 20 }, // imageUrl
    { wch: 30 }  // materials
];

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Products');

// Write file
XLSX.writeFile(wb, 'sample-products.xlsx');

console.log('✅ Test Excel file created: sample-products.xlsx');
console.log('📊 Contains', products.length, 'sample products');