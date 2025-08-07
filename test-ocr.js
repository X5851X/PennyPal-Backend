// Quick OCR Test Script
import ocrService from './services/ocr.js';

async function testOCR() {
  console.log('🧪 Testing OCR Service...');
  
  try {
    // Check initial status
    console.log('📊 Initial status:', ocrService.getStatus());
    
    // Initialize service
    console.log('🔄 Initializing OCR service...');
    await ocrService.initialize();
    
    // Check status after initialization
    console.log('📊 Status after init:', ocrService.getStatus());
    
    console.log('✅ OCR service test completed successfully!');
    
  } catch (error) {
    console.error('❌ OCR service test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up...');
    await ocrService.cleanup();
    process.exit(0);
  }
}

testOCR();