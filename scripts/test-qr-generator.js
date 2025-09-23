const QRCode = require('qrcode');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

// Test data - you can modify this
const carData = {
  serie: '2FMDK3GC0DB011234', // Change this VIN
  marca: 'Ford', // Change this brand
  color: 'Azul', // Change this color
  ubicaciones: 'Lote B-2', // Change this location
  location: 'Bodega Coyote',
  timestamp: '2024-01-15T10:30:00Z',
  type: 'car_inventory'
};

const jsonData = JSON.stringify(carData);

console.log('🔍 Generating test QR code...');
console.log('📊 Car data:', carData);

// Calculate size for 5x5 cm at 300 DPI (print quality)
const canvasSize = 590; // 5x5 cm at 300 DPI
const qrSize = 560; // Much bigger QR code to match your mockup
const margin = 20;
const textHeight = 40; // Smaller space for text
const totalWidth = canvasSize;
const totalHeight = canvasSize;

// Generate QR code (clean format like your example)
QRCode.toBuffer(jsonData, {
  type: 'png',
  width: qrSize,
  margin: 2,  // Standard quiet zone like your example
  color: { dark: '#000000', light: '#FFFFFF' },
  errorCorrectionLevel: 'M'
}).then(async (qrBuffer) => {
  // Load QR code image
  const qrImage = await loadImage(qrBuffer);
  
  // Create canvas for 5x5cm
  const canvas = createCanvas(totalWidth, totalHeight);
  const ctx = canvas.getContext('2d');
  
  // Fill background with white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalWidth, totalHeight);
  
  // Draw much bigger QR code at the top (like your mockup)
  const qrX = (canvasSize - qrSize) / 2; // Center horizontally
  const qrY = margin; // Top margin
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
  
  // Add text below QR code in horizontal row (flex-row)
  const textStartY = qrY + qrSize + 4; // Start text below QR
  const textX = canvasSize / 2; // Center text
  
  // Configure text style
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  
  // Create horizontal layout: Serie | Marca-Color | Ubicaciones
  const textY = textStartY;
  const separator = ' | '; // Separator between items
  
  // Combine all text in one line
  const fullText = `${carData.serie}${separator}${carData.marca} - ${carData.color}${separator}${carData.ubicaciones}`;
  
  // Draw the combined text
  ctx.font = '14px Arial';
  ctx.fillText(fullText, textX, textY);
  
  // Save the canvas as PNG
  const buffer = canvas.toBuffer('image/png');
  const filename = `test-qr-${Date.now()}.png`;
  fs.writeFileSync(filename, buffer);
  
  console.log(`✅ Generated ${filename}`);
  console.log('📊 QR Code Details:');
  console.log(`   Canvas: ${canvasSize}x${canvasSize} pixels (5x5cm at 300 DPI)`);
  console.log(`   QR code: ${qrSize}x${qrSize} pixels`);
  console.log(`   Text: 10px (horizontal row layout)`);
  console.log(`   Layout: ${carData.serie} | ${carData.marca} - ${carData.color} | ${carData.ubicaciones}`);
}).catch(err => {
  console.error('❌ Error:', err.message);
});
