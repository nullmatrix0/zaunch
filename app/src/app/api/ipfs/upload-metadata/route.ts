import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  STORACHA_EMAIL,
  STORACHA_PRIVATE_KEY,
  STORACHA_PROOF,
  STORACHA_SPACE_DID,
} from '@/configs/env.config';
import { IPFSService } from '@/lib/ipfsService';

// Upload Metadata Schema
const UploadMetadataSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  symbol: z.string().min(1, 'Symbol is required'),
  imageUri: z.string().min(1, 'Image URI is required'),
  description: z.string().optional(),
  website: z.string().optional(),
  twitter: z.string().optional(),
  telegram: z.string().optional(),
});

// Only initialize IPFS service if required env var is present
const ipfsService = STORACHA_EMAIL
  ? new IPFSService(STORACHA_EMAIL, STORACHA_PRIVATE_KEY, STORACHA_PROOF, STORACHA_SPACE_DID)
  : null;

export async function POST(request: NextRequest) {
  if (!ipfsService) {
    return NextResponse.json(
      {
        success: false,
        message:
          'IPFS service is not configured. Please set STORACHA_EMAIL and optionally STORACHA_PRIVATE_KEY, STORACHA_PROOF, STORACHA_SPACE_DID environment variables',
      },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();

    // Validate request body
    const metadataData = UploadMetadataSchema.parse(body);

    const cid = await ipfsService.uploadTokenMetadata(
      metadataData.name,
      metadataData.symbol,
      metadataData.imageUri,
      metadataData.description || '',
      metadataData.website || '',
      metadataData.twitter || '',
      metadataData.telegram || '',
    );

    return NextResponse.json(
      {
        success: true,
        data: { imageUri: cid },
        message: 'Metadata uploaded successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error in upload metadata route:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validation error: ' + error.issues.map((e) => e.message).join(', '),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
