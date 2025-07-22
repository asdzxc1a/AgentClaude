/**
 * Database initialization script
 * Creates the SQLite database with all required tables and indexes
 */

import { ObservabilityDatabase } from './database';

async function initializeDatabase() {
  console.log('🔧 Initializing database...');
  
  try {
    const db = new ObservabilityDatabase();
    
    // Wait a moment for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const stats = await db.getStats();
    console.log('📊 Database Statistics:');
    console.log(`- Total events: ${stats.total_events}`);
    console.log(`- Database path: ${stats.database_path}`);
    
    db.close();
    console.log('✅ Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  initializeDatabase();
}