import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { logRequestStart, logRequestEnd, logError } from '../lib/logger';
import {
  buildDbcConfigRequest,
  buildDeployTokenRequest,
  buildSwapTokenRequest,
} from '../lib/meteora';
import { MeteoraService } from '../services/meteoraService';
import { DbcConfigRequestSchema, DeployTokenRequestSchema, SwapTokenRequestSchema } from '../types';
import type { DbcConfigRequestType, DeployTokenRequestType, SwapTokenRequestType } from '../types';

const app = new Hono();
const meteoraService = new MeteoraService();

// Create DBC Configuration
app.post('/dbc-config', zValidator('json', DbcConfigRequestSchema), async (c) => {
  try {
    const requestData = c.req.valid('json') as DbcConfigRequestType;

    const dbcConfigRequest = buildDbcConfigRequest(requestData);

    const transaction = await meteoraService.createDbcConfig(dbcConfigRequest);

    return c.json(
      {
        success: true,
        data: {
          dbcConfigKeypair: transaction.dbcConfigKeypair,
          transaction: transaction.dbcConfigTransaction,
          message: 'DBC configuration transaction created successfully',
        },
      },
      201,
    );
  } catch (error) {
    console.error('Error in create DBC config route:', error);

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

    // Handle Solana PublicKey errors
    if (error instanceof Error && error.message.includes('Invalid public key')) {
      return c.json(
        {
          success: false,
          message: 'Invalid signer public key format',
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

// Deploy Token
app.post('/deploy-token', zValidator('json', DeployTokenRequestSchema), async (c) => {
  try {
    const requestData = c.req.valid('json') as DeployTokenRequestType;

    const deployTokenRequest = buildDeployTokenRequest(requestData);

    const result = await meteoraService.deployToken(deployTokenRequest);

    return c.json(
      {
        success: true,
        data: {
          transaction: result.transaction,
          baseMint: result.baseMint,
          message: 'Token deployment transaction created successfully',
        },
      },
      201,
    );
  } catch (error) {
    console.error('Error in deploy token route:', error);

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

    // Handle Solana PublicKey errors
    if (error instanceof Error && error.message.includes('Invalid public key')) {
      return c.json(
        {
          success: false,
          message: 'Invalid signer public key format',
        },
        400,
      );
    }

    // Handle Keypair errors
    if (error instanceof Error && error.message.includes('Invalid secret key')) {
      return c.json(
        {
          success: false,
          message: 'Invalid DBC config keypair format',
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

// Add Swap Route
app.post('/swap', zValidator('json', SwapTokenRequestSchema), async (c) => {
  try {
    const requestData = c.req.valid('json') as SwapTokenRequestType;
    const swapRequest = buildSwapTokenRequest(requestData);
    const result = await meteoraService.swap(swapRequest);
    return c.json(
      {
        success: true,
        data: {
          transaction: result.transaction,
          baseMint: result.baseMint,
          message: 'Swap transaction created successfully',
        },
      },
      201,
    );
  } catch (error) {
    console.error('Error in swap route:', error);

    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          message: 'Validation error: ' + error.errors.map((e) => e.message).join(', '),
        },
        400,
      );
    }

    if (error instanceof Error && error.message.includes('Invalid public key')) {
      return c.json(
        {
          success: false,
          message: 'Invalid public key format in request',
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

app.get('/pool/state/:mintAddress', async (c) => {
  const startTime = Date.now();
  const mintAddress = c.req.param('mintAddress');
  logRequestStart('GET /api/meteora/pool/state/:mintAddress', { mintAddress });

  try {
    const pool = await meteoraService.getPoolStateByMintAddress(mintAddress);
    const duration = Date.now() - startTime;
    logRequestEnd('GET /api/meteora/pool/state/:mintAddress', duration, true, { mintAddress });
    return c.json({ success: true, data: pool });
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(
      'Error in get pool by mint address route',
      error instanceof Error ? error : new Error(String(error)),
      { mintAddress },
    );
    logRequestEnd('GET /api/meteora/pool/state/:mintAddress', duration, false, { mintAddress });
    return c.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      500,
    );
  }
});

app.get('/pool/config/:mintAddress', async (c) => {
  const startTime = Date.now();
  const mintAddress = c.req.param('mintAddress');
  logRequestStart('GET /api/meteora/pool/config/:mintAddress', { mintAddress });

  try {
    const poolConfig = await meteoraService.getPoolConfigByMintAddress(mintAddress);
    const duration = Date.now() - startTime;
    logRequestEnd('GET /api/meteora/pool/config/:mintAddress', duration, true, { mintAddress });
    return c.json({ success: true, data: poolConfig });
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(
      'Error in get pool config by mint address route',
      error instanceof Error ? error : new Error(String(error)),
      { mintAddress },
    );
    logRequestEnd('GET /api/meteora/pool/config/:mintAddress', duration, false, { mintAddress });
    return c.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      500,
    );
  }
});

app.get('/pool/metadata/:mintAddress', async (c) => {
  try {
    const mintAddress = c.req.param('mintAddress');
    const poolMetadata = await meteoraService.getPoolMetadataByMintAddress(mintAddress);
    return c.json({ success: true, data: poolMetadata });
  } catch (error) {
    console.error('Error in get pool migration quote threshold by mint address route:', error);
    return c.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      500,
    );
  }
});

app.get('/pool/curve-progress/:mintAddress', async (c) => {
  try {
    const mintAddress = c.req.param('mintAddress');
    const poolCurveProgress = await meteoraService.getPoolCurveProgressByMintAddress(mintAddress);
    return c.json({ success: true, data: poolCurveProgress });
  } catch (error) {
    console.error('Error in get pool curve progress by mint address route:', error);
    return c.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      500,
    );
  }
});

export default app;
