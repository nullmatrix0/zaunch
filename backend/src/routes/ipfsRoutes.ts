import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { IPFSService } from '../services/ipfsService';
import { UploadMetadataSchema } from '../types';

const app = new Hono();

// Environment variables for Storacha (optional - IPFS routes will return errors if not configured)
const STORACHA_EMAIL = process.env.STORACHA_EMAIL;
const STORACHA_PRIVATE_KEY = process.env.STORACHA_PRIVATE_KEY;
const STORACHA_PROOF = process.env.STORACHA_PROOF;
const STORACHA_SPACE_DID = process.env.STORACHA_SPACE_DID;

// Only initialize IPFS service if required env var is present
const ipfsService = STORACHA_EMAIL
  ? new IPFSService(STORACHA_EMAIL, STORACHA_PRIVATE_KEY, STORACHA_PROOF, STORACHA_SPACE_DID)
  : null;

// Upload image file
app.post('/upload-image', async (c) => {
  if (!ipfsService) {
    return c.json(
      {
        success: false,
        message:
          'IPFS service is not configured. Please set STORACHA_EMAIL and optionally STORACHA_PRIVATE_KEY, STORACHA_PROOF, STORACHA_SPACE_DID environment variables',
      },
      503,
    );
  }

  try {
    const formData = await c.req.formData();
    const imageFile = formData.get('image') as File;
    const fileName = formData.get('fileName') as string;

    if (!imageFile) {
      return c.json(
        {
          success: false,
          message: 'Image file is required',
        },
        400,
      );
    }

    // Validate file type
    if (!imageFile.type.startsWith('image/')) {
      return c.json(
        {
          success: false,
          message: 'File must be an image',
        },
        400,
      );
    }

    const cid = await ipfsService.uploadImage(imageFile, fileName);

    return c.json(
      {
        success: true,
        data: { imageUri: cid },
        message: 'Image uploaded successfully',
      },
      201,
    );
  } catch (error) {
    console.error('Error in upload image route:', error);
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      500,
    );
  }
});

// Upload metadata JSON
app.post('/upload-metadata', zValidator('json', UploadMetadataSchema), async (c) => {
  if (!ipfsService) {
    return c.json(
      {
        success: false,
        message:
          'IPFS service is not configured. Please set STORACHA_EMAIL and optionally STORACHA_PRIVATE_KEY, STORACHA_PROOF, STORACHA_SPACE_DID environment variables',
      },
      503,
    );
  }

  try {
    const metadataData = c.req.valid('json');

    const cid = await ipfsService.uploadTokenMetadata(
      metadataData.name,
      metadataData.symbol,
      metadataData.imageUri,
      metadataData.bannerUri,
      metadataData.description,
      metadataData.website || '',
      metadataData.twitter || '',
      metadataData.telegram || '',
    );

    return c.json(
      {
        success: true,
        data: { imageUri: cid },
        message: 'Metadata uploaded successfully',
      },
      201,
    );
  } catch (error) {
    console.error('Error in upload metadata route:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          message: 'Validation error: ' + error.errors.map((e) => e.message).join(', '),
        },
        400,
      );
    }

    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      500,
    );
  }
});

// Health check endpoint
app.get('/health', async (c) => {
  return c.json({
    success: true,
    message: ipfsService ? 'IPFS service is running' : 'IPFS service is not configured',
    configured: !!ipfsService,
  });
});

export default app;
