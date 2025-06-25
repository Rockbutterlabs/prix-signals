import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing DATABASE_URL environment variable');
}

const sql = postgres(connectionString);

export default sql; 