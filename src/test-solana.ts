import { SolanaService } from './services/solana';

async function testSolanaService() {
  try {
    const solanaService = SolanaService.getInstance();
    
    // Test getSlot
    console.log('Testing getSlot...');
    const slot = await solanaService.getSlot();
    console.log('Current slot:', slot);
    
    // Test getBlockTime
    console.log('\nTesting getBlockTime...');
    const blockTime = await solanaService.getBlockTime(slot);
    console.log('Block time:', new Date(blockTime * 1000).toISOString());
    
    // Test getRecentBlockhash
    console.log('\nTesting getRecentBlockhash...');
    const blockhash = await solanaService.getRecentBlockhash();
    console.log('Recent blockhash:', blockhash);
    
    // Test token program monitoring
    console.log('\nMonitoring token program logs...');
    console.log('Press Ctrl+C to stop');
    
  } catch (error) {
    console.error('Error testing Solana service:', error);
  }
}

testSolanaService(); 