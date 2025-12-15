#!/usr/bin/env node
/**
 * ZEC Refund Script
 * 
 * This script calls the TEE's refund endpoint to claim ZEC back to SOL.
 * The TEE will create a 1Click quote and attempt to process the refund.
 * 
 * Usage: node claim-refund.js
 */

const TEE_ENDPOINT = 'https://66a817b166c0b222ae386af54c178986e90beb0a-3000.dstack-pha-prod7.phala.network';

// Your data
const LAUNCH_ID = 'TestToken_3209NZ';
const USER_PUBKEY = 'E1YEzC6c5XSLzXZM5QLfz8mRTXhnQ7ecLXFjkZYEfknw';

async function claimRefund() {
  console.log('==========================================');
  console.log('ZEC REFUND CLAIM');
  console.log('==========================================');
  console.log(`TEE Endpoint: ${TEE_ENDPOINT}`);
  console.log(`Launch ID: ${LAUNCH_ID}`);
  console.log(`User Pubkey: ${USER_PUBKEY}`);
  console.log('');
  
  // Step 1: Check TEE connectivity
  console.log('[1] Checking TEE connectivity...');
  try {
    const healthResp = await fetch(`${TEE_ENDPOINT}/health`);
    if (healthResp.ok) {
      console.log('   ✅ TEE is accessible');
    } else {
      console.log('   ⚠️ TEE health check returned:', healthResp.status);
    }
  } catch (e) {
    console.log('   ❌ Cannot reach TEE:', e.message);
    return;
  }
  
  // Step 2: Check escrow status
  console.log('\n[2] Checking escrow status...');
  try {
    const statusResp = await fetch(`${TEE_ENDPOINT}/escrow/${encodeURIComponent(LAUNCH_ID)}`);
    if (statusResp.ok) {
      const status = await statusResp.json();
      console.log('   Escrow status:');
      console.log('   - Total ZEC:', status.total_zec);
      console.log('   - Total USD:', status.total_usd);
      console.log('   - Finalized:', status.finalized);
      console.log('   - Goal reached:', status.goal_reached);
      console.log('   - Refunds enabled:', status.refunds_enabled);
      
      if (!status.finalized) {
        console.log('\n   ⚠️ Sale not finalized. Need to finalize first.');
        console.log('   Would you like to finalize? (This should be done by creator)');
      }
      
      if (status.goal_reached) {
        console.log('\n   ⚠️ Goal was reached! Use proof tickets to claim tokens instead.');
        return;
      }
    } else {
      const errorText = await statusResp.text();
      console.log('   ⚠️ Could not get escrow status:', errorText);
      console.log('   Proceeding with refund attempt anyway...');
    }
  } catch (e) {
    console.log('   ⚠️ Error checking status:', e.message);
    console.log('   Proceeding with refund attempt...');
  }
  
  // Step 3: Attempt to claim refund
  console.log('\n[3] Claiming refund...');
  try {
    const refundResp = await fetch(`${TEE_ENDPOINT}/escrow/${encodeURIComponent(LAUNCH_ID)}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_pubkey: USER_PUBKEY,
      }),
    });
    
    if (refundResp.ok) {
      const result = await refundResp.json();
      console.log('   ✅ Refund response:', JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log('\n   🎉 REFUND SUCCESSFUL!');
        console.log(`   Refund amount: $${result.refund_amount_usd}`);
        console.log(`   SOL address: ${result.sol_address}`);
        if (result.tx_id) {
          console.log(`   TX ID: ${result.tx_id}`);
        }
      } else {
        console.log('\n   ⚠️ Refund returned but not successful');
        console.log(`   Error: ${result.error || 'Unknown'}`);
      }
    } else {
      const errorText = await refundResp.text();
      console.log('   ❌ Refund failed:', errorText);
    }
  } catch (e) {
    console.log('   ❌ Error claiming refund:', e.message);
  }
}

claimRefund();
