import { type NextRequest, NextResponse } from 'next/server';
import {
  STORACHA_EMAIL,
  STORACHA_PRIVATE_KEY,
  STORACHA_PROOF,
  STORACHA_SPACE_DID,
} from '@/configs/env.config';
import { IPFSService } from '@/lib/ipfsService';

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
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const fileName = formData.get('fileName') as string | null;

    if (!imageFile) {
      return NextResponse.json(
        {
          success: false,
          message: 'Image file is required',
        },
        { status: 400 },
      );
    }

    // Validate file type
    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json(
        {
          success: false,
          message: 'File must be an image',
        },
        { status: 400 },
      );
    }

    const cid = await ipfsService.uploadImage(imageFile, fileName || undefined);

    return NextResponse.json(
      {
        success: true,
        data: { imageUri: cid },
        message: 'Image uploaded successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error in upload image route:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
