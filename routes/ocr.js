// OCR Routes without file upload - routes/ocr.js
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import ocrService from '../services/ocr.js';
import { authenticate } from '../middlewares/auth.js';
import { Receipt, OCRLog } from '../models/Receipt.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Initialize OCR service when routes are loaded with proper error handling
const initializeOCR = async () => {
  try {
    if (ocrService) {
      await ocrService.initialize();
      console.log('✅ OCR service initialized successfully');
    } else {
      console.error('❌ OCR service is not available');
    }
  } catch (error) {
    console.error('❌ Failed to initialize OCR service:', error);
  }
};

// Initialize OCR (but don't await it to avoid blocking route loading)
initializeOCR().catch(error => {
  console.warn('⚠️  OCR initialization failed during route setup:', error.message);
});

// Add graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('🔄 Received SIGTERM, cleaning up OCR service...');
  if (ocrService) {
    await ocrService.cleanup();
  }
});

process.on('SIGINT', async () => {
  console.log('🔄 Received SIGINT, cleaning up OCR service...');
  if (ocrService) {
    await ocrService.cleanup();
  }
  process.exit(0);
});

// FIXED: Enhanced health check endpoint - NO AUTH REQUIRED
router.get('/health', async (req, res) => {
  console.log('🔍 OCR Health check requested');
  
  try {
    if (!ocrService) {
      return res.status(503).json({
        success: false,
        service: 'OCR',
        status: 'unavailable',
        message: 'OCR service is not available',
        timestamp: new Date().toISOString()
      });
    }

    const status = ocrService.getStatus();
    const isHealthy = status.ready;

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      service: 'OCR',
      status: isHealthy ? 'ready' : 'initializing',
      details: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ OCR health check error:', error);
    res.status(500).json({
      success: false,
      service: 'OCR',
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// FIXED: Enhanced test endpoint - NO AUTH REQUIRED
router.get('/test-sample', (req, res) => {
  console.log('🔍 OCR Test sample requested');
  
  try {
    const sampleReceiptData = {
      success: true,
      data: {
        text: "ALFAMART\nJl. Sudirman No. 123\nJakarta Pusat 10110\n\nTanggal: 04/08/2025\nWaktu: 15:45:22\nKasir: KASIR01\n\nBeras Premium 5kg       28.500\nMinyak Goreng 2L        24.000\nTelor Ayam 1kg          32.000\nRoti Tawar Gandum       15.500\nSusu UHT 1L            18.000\nMie Instan 5pcs         12.500\n\nSubtotal:              130.500\nPPN 11%:                14.355\nTotal:                 144.855\n\nTunai:                 150.000\nKembali:                 5.145\n\nTerima Kasih\nKunjungi Kami Lagi",
        confidence: 92.8,
        receiptData: {
          storeName: "ALFAMART",
          date: "04/08/2025",
          time: "15:45:22",
          total: 144855,
          subtotal: 130500,
          tax: 14355,
          currency: "IDR",
          items: [
            { name: "Beras Premium 5kg", price: 28500, quantity: 1, lineNumber: 7 },
            { name: "Minyak Goreng 2L", price: 24000, quantity: 1, lineNumber: 8 },
            { name: "Telor Ayam 1kg", price: 32000, quantity: 1, lineNumber: 9 },
            { name: "Roti Tawar Gandum", price: 15500, quantity: 1, lineNumber: 10 },
            { name: "Susu UHT 1L", price: 18000, quantity: 1, lineNumber: 11 },
            { name: "Mie Instan 5pcs", price: 12500, quantity: 1, lineNumber: 12 }
          ],
          rawText: "ALFAMART\nJl. Sudirman No. 123\nJakarta Pusat 10110\n\nTanggal: 04/08/2025\nWaktu: 15:45:22\nKasir: KASIR01\n\nBeras Premium 5kg       28.500\nMinyak Goreng 2L        24.000\nTelor Ayam 1kg          32.000\nRoti Tawar Gandum       15.500\nSusu UHT 1L            18.000\nMie Instan 5pcs         12.500\n\nSubtotal:              130.500\nPPN 11%:                14.355\nTotal:                 144.855\n\nTunai:                 150.000\nKembali:                 5.145\n\nTerima Kasih\nKunjungi Kami Lagi",
          confidence: "high"
        },
        processing: {
          timeMs: 2450,
          filename: "sample-receipt.jpg",
          size: 245678,
          requestId: "sample-" + Date.now()
        }
      }
    };

    res.json(sampleReceiptData);
  } catch (error) {
    console.error('❌ Test sample error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate sample data',
      error: error.message
    });
  }
});

// FIXED: Simple status endpoint - NO AUTH REQUIRED
router.get('/status', async (req, res) => {
  try {
    const status = ocrService ? ocrService.getStatus() : null;
    
    res.json({
      success: true,
      message: 'OCR routes are working',
      service: 'OCR',
      timestamp: new Date().toISOString(),
      ocrServiceAvailable: !!ocrService,
      ocrStatus: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking OCR status',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced utility function to convert base64 to buffer
const base64ToBuffer = (base64Data) => {
  try {
    if (!base64Data || typeof base64Data !== 'string') {
      throw new Error('Invalid image data: must be a non-empty string');
    }

    // Clean base64 data
    const base64Clean = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Validate base64 format
    if (!/^[A-Za-z0-9+/]+=*$/.test(base64Clean)) {
      throw new Error('Invalid base64 format');
    }

    const buffer = Buffer.from(base64Clean, 'base64');
    
    // Check if buffer is valid image by checking magic bytes
    if (buffer.length < 10) {
      throw new Error('Image data too small to be valid');
    }

    // Check for common image formats
    const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8;
    const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isWebP = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    
    if (!isJPEG && !isPNG && !isWebP) {
      console.warn('⚠️ Image format may not be supported (not JPEG/PNG/WebP)');
    }

    return buffer;
  } catch (error) {
    throw new Error(`Failed to process image data: ${error.message}`);
  }
};

// IMPORTANT: Apply authentication middleware ONLY to protected routes
// All routes below this line require authentication
router.use(authenticate);

// Enhanced receipt processing endpoint - BASE64 VERSION
router.post('/receipt', async (req, res) => {
  const requestId = uuidv4();
  const userId = req.user.id;
  const startTime = Date.now();
  
  try {
    if (!ocrService) {
      return res.status(503).json({
        success: false,
        message: 'OCR service is currently unavailable',
        code: 'SERVICE_UNAVAILABLE',
        requestId,
        tips: [
          'Try again in a few moments',
          'Check server logs for initialization errors',
          'Contact support if problem persists'
        ]
      });
    }

    // Check if OCR service is ready
    const serviceStatus = ocrService.getStatus();
    if (!serviceStatus.ready) {
      console.log('🔄 OCR service not ready, attempting initialization...');
      try {
        await ocrService.initialize();
      } catch (initError) {
        return res.status(503).json({
          success: false,
          message: 'OCR service initialization failed',
          code: 'INITIALIZATION_FAILED',
          requestId,
          error: initError.message,
          tips: [
            'Server may be under heavy load',
            'Try again in a few moments',
            'Contact support if problem persists'
          ]
        });
      }
    }

    const { imageData, filename = 'receipt.jpg', useGoogleVision = false } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        message: 'No receipt image data provided. Send base64 image in "imageData" field.',
        code: 'NO_IMAGE_DATA',
        requestId
      });
    }

    // Enhanced image data validation
    try {
      const imageBuffer = base64ToBuffer(imageData);
      const fileSize = imageBuffer.length;
      
      console.log(`💾 Processing image buffer (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);

      if (fileSize > 10 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'Image size too large. Maximum size is 10MB.',
          code: 'IMAGE_TOO_LARGE',
          requestId,
          tips: ['Compress your image', 'Use JPEG format for smaller size']
        });
      }

      if (fileSize < 1024) {
        return res.status(400).json({
          success: false,
          message: 'Image size too small. Minimum size is 1KB.',
          code: 'IMAGE_TOO_SMALL',
          requestId,
          tips: ['Use higher resolution image', 'Ensure image is not corrupted']
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'INVALID_IMAGE_DATA',
        requestId,
        tips: [
          'Ensure image is properly base64 encoded',
          'Use supported formats: JPEG, PNG, WebP',
          'Check if image data is complete'
        ]
      });
    }

    console.log(`📁 Processing base64 image: ${filename} (Request: ${requestId})`);

    // Image validation already done above, just get the buffer again
    const imageBuffer = base64ToBuffer(imageData);
    const fileSize = imageBuffer.length;

    let ocrResult;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔍 OCR attempt ${attempts}/${maxAttempts}...`);
      
      try {
        ocrResult = await ocrService.extractReceiptData(imageBuffer, useGoogleVision);
        
        if (ocrResult.success || attempts === maxAttempts) {
          break;
        }
        
        if (attempts < maxAttempts) {
          console.log(`⏳ Attempt ${attempts} failed, retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (!ocrService.getStatus().ready) {
            await ocrService.initialize();
          }
        }
      } catch (error) {
        console.error(`❌ OCR attempt ${attempts} error:`, error);
        if (attempts === maxAttempts) {
          ocrResult = {
            success: false,
            error: error.message,
            text: '',
            confidence: 0
          };
        }
      }
    }

    const processingTime = Date.now() - startTime;

    // Create comprehensive OCR log entry
    const ocrLog = new OCRLog({
      userId,
      requestId,
      endpoint: '/ocr/receipt',
      originalFilename: filename,
      fileSize: fileSize,
      mimeType: 'image/jpeg',
      success: ocrResult.success,
      attempts: attempts,
      processingTime,
      extractedText: ocrResult.text || '',
      confidence: ocrResult.confidence || 0,
      confidenceLevel: ocrResult.receiptData?.confidence || 'low',
      errorMessage: ocrResult.error || null,
      receiptData: ocrResult.success ? {
        storeName: ocrResult.receiptData?.storeName,
        date: ocrResult.receiptData?.date,
        time: ocrResult.receiptData?.time,
        total: ocrResult.receiptData?.total,
        subtotal: ocrResult.receiptData?.subtotal,
        tax: ocrResult.receiptData?.tax,
        currency: ocrResult.receiptData?.currency,
        itemCount: ocrResult.receiptData?.items?.length || 0
      } : null,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip || req.connection.remoteAddress
    });

    await ocrLog.save();

    if (!ocrResult.success) {
      return res.status(422).json({
        success: false,
        message: 'Failed to process receipt image',
        details: ocrResult.error,
        code: 'OCR_PROCESSING_FAILED',
        requestId,
        attempts: attempts,
        tips: [
          'Ensure good lighting',
          'Keep receipt flat and straight', 
          'Avoid shadows and glare',
          'Use high resolution image'
        ]
      });
    }

    // Enhanced data validation and correction
    const receiptData = ocrResult.receiptData;
    
    // Validate and correct total amount
    if (receiptData.total <= 0 && receiptData.items && receiptData.items.length > 0) {
      receiptData.total = receiptData.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
      console.log(`💡 Calculated total from items: ${receiptData.total}`);
    }

    // Smart date parsing - detect year position automatically
    let receiptDate = null;
    if (receiptData.date) {
      try {
        const numbers = receiptData.date.match(/\d+/g);
        
        if (numbers && numbers.length >= 3) {
          let day, month, year;
          
          // Find the year (4 digits or 2 digits > 31)
          const yearIndex = numbers.findIndex(n => n.length === 4 || parseInt(n) > 31);
          
          if (yearIndex !== -1) {
            year = parseInt(numbers[yearIndex]);
            if (year < 100) year += year > 50 ? 1900 : 2000;
            
            // Get remaining numbers for day/month
            const remaining = numbers.filter((_, i) => i !== yearIndex).map(n => parseInt(n));
            
            if (remaining.length >= 2) {
              // Assume first remaining is day, second is month (or vice versa if month > 12)
              if (remaining[0] > 12) {
                day = remaining[0];
                month = remaining[1];
              } else if (remaining[1] > 12) {
                day = remaining[1];
                month = remaining[0];
              } else {
                // Both <= 12, assume DD-MM format
                day = remaining[0];
                month = remaining[1];
              }
            }
          } else {
            // No clear year found, assume DD-MM-YY format
            day = parseInt(numbers[0]);
            month = parseInt(numbers[1]);
            year = parseInt(numbers[2]);
            if (year < 100) year += year > 50 ? 1900 : 2000;
          }
          
          // Validate and create date
          if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
            receiptDate = new Date(year, month - 1, day);
            if (isNaN(receiptDate.getTime())) receiptDate = null;
          }
        }
      } catch (error) {
        receiptDate = null;
      }
    }

    // Save receipt to database with enhanced data
    const receipt = new Receipt({
      userId,
      storeName: receiptData.storeName || 'Unknown Store',
      receiptDate: receiptDate, // Keep null if no valid date found
      receiptTime: receiptData.time || null,
      subtotal: receiptData.subtotal || 0,
      tax: receiptData.tax || 0,
      total: receiptData.total || 0,
      currency: receiptData.currency || 'IDR',
      items: (receiptData.items || []).map(item => ({
        name: item.name || 'Unknown Item',
        price: item.price || 0,
        quantity: item.quantity || 1,
        lineNumber: item.lineNumber || 0
      })),
      ocrText: ocrResult.text,
      ocrConfidence: ocrResult.confidence,
      ocrConfidenceLevel: receiptData.confidence,
      processingTime,
      attempts: attempts,
      originalFilename: filename,
      fileSize: fileSize,
      status: receiptData.confidence === 'high' ? 'verified' : 'pending'
    });

    const savedReceipt = await receipt.save();
    console.log(`✅ Receipt saved to database with ID: ${savedReceipt._id}`);

    // Success response with comprehensive data
    res.json({
      success: true,
      data: {
        receiptId: savedReceipt._id,
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        receipt: {
          id: savedReceipt._id,
          storeName: savedReceipt.storeName,
          date: savedReceipt.receiptDate ? `${savedReceipt.receiptDate.getDate().toString().padStart(2, '0')}-${(savedReceipt.receiptDate.getMonth() + 1).toString().padStart(2, '0')}-${savedReceipt.receiptDate.getFullYear()}` : null,
          time: savedReceipt.receiptTime,
          amount: savedReceipt.total,
          subtotal: savedReceipt.subtotal,
          tax: savedReceipt.tax,
          currency: savedReceipt.currency,
          items: (receiptData.items || []).map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity
          })),
          confidence: receiptData.confidence,
          status: savedReceipt.status
        },
        processing: {
          timeMs: processingTime,
          attempts: attempts,
          filename: filename,
          size: fileSize,
          requestId
        },
        // Add edit endpoints for frontend
        editEndpoints: {
          quickEdit: `/ocr/receipts/${savedReceipt._id}/quick-edit`,
          fullEdit: `/ocr/receipts/${savedReceipt._id}`,
          view: `/ocr/receipts/${savedReceipt._id}`
        }
      }
    });

    console.log(`✅ Receipt processed successfully in ${processingTime}ms after ${attempts} attempt(s) (Request: ${requestId})`);

  } catch (error) {
    console.error('❌ Receipt processing error:', error);
    
    try {
      const errorLog = new OCRLog({
        userId,
        requestId,
        endpoint: '/ocr/receipt',
        originalFilename: req.body?.filename || 'unknown',
        fileSize: 0,
        mimeType: 'image/jpeg',
        success: false,
        processingTime: Date.now() - startTime,
        errorMessage: error.message,
        errorCode: 'PROCESSING_ERROR',
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip || req.connection.remoteAddress
      });
      await errorLog.save();
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during receipt processing',
      error: error.message,
      code: 'INTERNAL_ERROR',
      requestId
    });
  }
});

// Enhanced text-only extraction endpoint - BASE64 VERSION
router.post('/text', async (req, res) => {
  const requestId = uuidv4();
  const userId = req.user.id;
  const startTime = Date.now();
  
  try {
    if (!ocrService) {
      return res.status(503).json({
        success: false,
        message: 'OCR service is currently unavailable',
        code: 'SERVICE_UNAVAILABLE',
        requestId
      });
    }

    const { imageData, filename = 'image.jpg', useGoogleVision = false } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        message: 'No image data provided. Send base64 image in "imageData" field.',
        code: 'NO_IMAGE_DATA',
        requestId
      });
    }

    console.log(`📁 Extracting text from base64 image: ${filename} (Request: ${requestId})`);

    const imageBuffer = base64ToBuffer(imageData);
    const fileSize = imageBuffer.length;

    if (fileSize > 10 * 1024 * 1024) {
      throw new Error('Image size too large. Maximum size is 10MB.');
    }

    let result;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔍 Text extraction attempt ${attempts}/${maxAttempts}...`);
      
      try {
        result = await ocrService.extractText(imageBuffer, useGoogleVision);
        
        if (result.success || attempts === maxAttempts) {
          break;
        }
        
        if (attempts < maxAttempts) {
          console.log(`⏳ Attempt ${attempts} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          if (!ocrService.getStatus().ready) {
            await ocrService.initialize();
          }
        }
      } catch (error) {
        console.error(`❌ Text extraction attempt ${attempts} error:`, error);
        if (attempts === maxAttempts) {
          result = {
            success: false,
            error: error.message,
            text: '',
            confidence: 0
          };
        }
      }
    }

    const processingTime = Date.now() - startTime;

    // Create OCR log entry
    const ocrLog = new OCRLog({
      userId,
      requestId,
      endpoint: '/ocr/text',
      originalFilename: filename,
      fileSize: fileSize,
      mimeType: 'image/jpeg',
      success: result.success,
      attempts: attempts,
      processingTime,
      extractedText: result.text || '',
      confidence: result.confidence || 0,
      errorMessage: result.error || null,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip || req.connection.remoteAddress
    });

    await ocrLog.save();

    res.json({
      ...result,
      processing: {
        timeMs: processingTime,
        attempts: attempts,
        filename: filename,
        size: fileSize,
        requestId
      }
    });

  } catch (error) {
    console.error('❌ Text extraction error:', error);
    
    try {
      const errorLog = new OCRLog({
        userId,
        requestId,
        endpoint: '/ocr/text',
        originalFilename: req.body?.filename || 'unknown',
        fileSize: 0,
        mimeType: 'image/jpeg',
        success: false,
        processingTime: Date.now() - startTime,
        errorMessage: error.message,
        errorCode: 'PROCESSING_ERROR',
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip || req.connection.remoteAddress
      });
      await errorLog.save();
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during text extraction',
      error: error.message,
      code: 'INTERNAL_ERROR',
      requestId
    });
  }
});

// NEW: Test both OCR engines endpoint
router.post('/test-engines', async (req, res) => {
  const requestId = uuidv4();
  const userId = req.user.id;
  const startTime = Date.now();
  
  try {
    if (!ocrService) {
      return res.status(503).json({
        success: false,
        message: 'OCR service is currently unavailable',
        code: 'SERVICE_UNAVAILABLE',
        requestId
      });
    }

    const { imageData, filename = 'test-image.jpg' } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        message: 'No image data provided. Send base64 image in "imageData" field.',
        code: 'NO_IMAGE_DATA',
        requestId
      });
    }

    console.log(`📁 Testing both OCR engines with image: ${filename} (Request: ${requestId})`);

    const imageBuffer = base64ToBuffer(imageData);
    const fileSize = imageBuffer.length;

    if (fileSize > 10 * 1024 * 1024) {
      throw new Error('Image size too large. Maximum size is 10MB.');
    }

    const tesseractResult = await ocrService.extractTextWithTesseract(imageBuffer);
    const googleResult = await ocrService.extractTextWithGoogleVision(imageBuffer);
    
    const testResult = {
      tesseract: tesseractResult,
      google: googleResult,
      recommendation: googleResult.success && googleResult.confidence > tesseractResult.confidence ? 'google' : 'tesseract'
    };
    
    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      data: testResult,
      processing: {
        timeMs: processingTime,
        filename: filename,
        size: fileSize,
        requestId
      }
    });

  } catch (error) {
    console.error('❌ Engine test error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during engine testing',
      error: error.message,
      code: 'INTERNAL_ERROR',
      requestId
    });
  }
});

// Receipt management routes (simplified versions)
router.get('/receipts', async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 10, 
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { userId };
    
    if (status && status !== 'all') {
      query.status = status;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const receipts = await Receipt.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-ocrText');

    const total = await Receipt.countDocuments(query);

    res.json({
      success: true,
      data: {
        receipts,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: receipts.length,
          totalRecords: total
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching receipts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch receipts',
      error: error.message
    });
  }
});

// Get specific receipt
router.get('/receipts/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const receipt = await Receipt.findOne({ 
      _id: req.params.id, 
      userId 
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    res.json({
      success: true,
      data: receipt
    });

  } catch (error) {
    console.error('❌ Error fetching receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch receipt',
      error: error.message
    });
  }
});

// Update receipt data (for manual corrections)
router.put('/receipts/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const receiptId = req.params.id;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.userId;
    delete updates.ocrText;
    delete updates.ocrConfidence;
    delete updates.processingTime;
    delete updates.createdAt;
    delete updates.updatedAt;

    // Validate amount fields
    if (updates.total !== undefined && updates.total < 0) {
      return res.status(400).json({
        success: false,
        message: 'Total amount must be non-negative'
      });
    }

    if (updates.subtotal !== undefined && updates.subtotal < 0) {
      return res.status(400).json({
        success: false,
        message: 'Subtotal must be non-negative'
      });
    }

    if (updates.tax !== undefined && updates.tax < 0) {
      return res.status(400).json({
        success: false,
        message: 'Tax amount must be non-negative'
      });
    }

    // Validate and parse date if provided
    if (updates.receiptDate !== undefined) {
      if (updates.receiptDate === null || updates.receiptDate === '') {
        updates.receiptDate = null;
      } else {
        const parsedDate = new Date(updates.receiptDate);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid date format. Use YYYY-MM-DD or ISO date string'
          });
        }
        updates.receiptDate = parsedDate;
      }
    }

    // Validate currency
    if (updates.currency && !['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'MYR', 'KRW'].includes(updates.currency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid currency. Supported: IDR, USD, EUR, JPY, SGD, MYR, KRW'
      });
    }

    // Find and update receipt
    const receipt = await Receipt.findOneAndUpdate(
      { _id: receiptId, userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    // Log the correction if significant fields were changed
    const significantFields = ['total', 'subtotal', 'tax', 'receiptDate', 'storeName'];
    const changedFields = Object.keys(updates).filter(key => significantFields.includes(key));
    
    if (changedFields.length > 0) {
      console.log(`📝 Receipt ${receiptId} updated by user ${userId}:`, changedFields);
    }

    res.json({
      success: true,
      message: 'Receipt updated successfully',
      data: receipt,
      updatedFields: Object.keys(updates)
    });

  } catch (error) {
    console.error('❌ Error updating receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update receipt',
      error: error.message
    });
  }
});

// Get receipt data for editing (simplified format)
router.get('/receipts/:id/edit', async (req, res) => {
  try {
    const userId = req.user.id;
    const receipt = await Receipt.findOne({ 
      _id: req.params.id, 
      userId 
    }).select('storeName receiptDate receiptTime total subtotal tax currency items status ocrConfidenceLevel');

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    // Format data for easy editing
    const editData = {
      id: receipt._id,
      storeName: receipt.storeName || '',
      date: receipt.receiptDate ? receipt.receiptDate.toISOString().split('T')[0] : '', // YYYY-MM-DD format
      time: receipt.receiptTime || '',
      amount: receipt.total || 0,
      subtotal: receipt.subtotal || 0,
      tax: receipt.tax || 0,
      currency: receipt.currency || 'IDR',
      items: receipt.items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      status: receipt.status,
      confidence: receipt.ocrConfidenceLevel
    };

    res.json({
      success: true,
      data: editData
    });

  } catch (error) {
    console.error('❌ Error fetching receipt for editing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch receipt data',
      error: error.message
    });
  }
});

// Quick update for amount and date (simplified endpoint)
router.patch('/receipts/:id/quick-edit', async (req, res) => {
  try {
    const userId = req.user.id;
    const receiptId = req.params.id;
    const { amount, date, storeName } = req.body;

    const updates = {};
    
    // Update amount if provided
    if (amount !== undefined) {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount < 0) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be a valid positive number'
        });
      }
      updates.total = numAmount;
    }

    // Update date if provided
    if (date !== undefined) {
      if (date === '' || date === null) {
        updates.receiptDate = null;
      } else {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid date format. Use YYYY-MM-DD'
          });
        }
        updates.receiptDate = parsedDate;
      }
    }

    // Update store name if provided
    if (storeName !== undefined) {
      updates.storeName = storeName.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const receipt = await Receipt.findOneAndUpdate(
      { _id: receiptId, userId },
      updates,
      { new: true, runValidators: true }
    ).select('storeName receiptDate total currency');

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    res.json({
      success: true,
      message: 'Receipt updated successfully',
      data: {
        id: receipt._id,
        storeName: receipt.storeName,
        date: receipt.receiptDate ? receipt.receiptDate.toISOString().split('T')[0] : null,
        amount: receipt.total,
        currency: receipt.currency
      }
    });

  } catch (error) {
    console.error('❌ Error quick updating receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update receipt',
      error: error.message
    });
  }
});

// Delete receipt
router.delete('/receipts/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const receipt = await Receipt.findOneAndDelete({ 
      _id: req.params.id, 
      userId 
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    res.json({
      success: true,
      message: 'Receipt deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete receipt',
      error: error.message
    });
  }
});

// Initialize/Reinitialize OCR service endpoint
router.post('/reinitialize', async (req, res) => {
  try {
    if (!ocrService) {
      return res.status(503).json({
        success: false,
        message: 'OCR service is not available'
      });
    }

    await ocrService.terminate();
    await ocrService.initialize();
    
    const status = ocrService.getStatus();

    res.json({
      success: true,
      message: 'OCR service reinitialized successfully',
      status: status
    });

  } catch (error) {
    console.error('❌ Error reinitializing OCR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reinitialize OCR service',
      error: error.message
    });
  }
});

export default router;