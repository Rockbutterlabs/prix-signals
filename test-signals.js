const { SignalAggregator } = require('./dist/services/signal-aggregator');

async function testSignalAlgorithm() {
  console.log('🧪 Testing Signal Algorithm...\n');
  
  const aggregator = new SignalAggregator();
  
  try {
    // Test getting latest signals
    console.log('📊 Fetching latest signals...');
    const signals = await aggregator.getLatestSignals();
    
    console.log(`✅ Found ${signals.length} signals\n`);
    
    if (signals.length > 0) {
      console.log('🏆 Top 5 Signals:');
      signals.slice(0, 5).forEach((signal, index) => {
        console.log(`\n${index + 1}. ${signal.symbol}`);
        console.log(`   Price: $${signal.price.toFixed(6)}`);
        console.log(`   Change: ${signal.priceChange.toFixed(2)}%`);
        console.log(`   Volume: $${signal.volume.toLocaleString()}`);
        console.log(`   Market Cap: $${signal.marketCap.toLocaleString()}`);
        console.log(`   Score: ${signal.score?.total || 0}/100`);
        console.log(`   Risk: ${signal.riskLevel}`);
        console.log(`   Premium: ${signal.isPremium ? 'Yes' : 'No'}`);
        if (signal.patterns && signal.patterns.length > 0) {
          console.log(`   Patterns: ${signal.patterns.join(', ')}`);
        }
      });
    }
    
    // Test market overview
    console.log('\n📈 Market Overview:');
    const overview = await aggregator.getMarketOverview();
    
    console.log(`🔥 Hot Signals: ${overview.hotSignals.length}`);
    console.log(`📊 Volume Leaders: ${overview.volumeLeaders.length}`);
    console.log(`💎 Premium Picks: ${overview.premiumPicks.length}`);
    console.log(`🚀 Trending: ${overview.trending.length}`);
    
    // Test low cap signals
    console.log('\n💰 Low Cap Signals:');
    const lowCapSignals = await aggregator.getLowCapSignals();
    console.log(`Found ${lowCapSignals.length} low cap signals (< $1M market cap)`);
    
  } catch (error) {
    console.error('❌ Error testing signal algorithm:', error);
  }
}

testSignalAlgorithm(); 