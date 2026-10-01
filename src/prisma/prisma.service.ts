import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();


function getPgPool(): Pool {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres:techo123@127.0.0.1:5432/techo_partners_db?schema=public';

  const maxPoolSize = parseInt(process.env.DB_POOL_MAX || '25', 10);
  const statementTimeout = parseInt(process.env.DB_STATEMENT_TIMEOUT || '15000', 10);
  const queryTimeout = parseInt(process.env.DB_QUERY_TIMEOUT || '15000', 10);

  const pool = new Pool({
    connectionString,
    max: Math.max(maxPoolSize, 10),
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000,
    statement_timeout: statementTimeout,
    query_timeout: queryTimeout,
    keepAlive: true,
  });

  pool.on('error', (err) => {
    console.error('[Prisma Pool Error - Non Fatal]', err.message);
  });

  return pool;
}

let sharedPool: Pool | null = null;
let sharedAdapter: PrismaPg | null = null;

function getSharedAdapter(): PrismaPg {
  if (!sharedAdapter) {
    sharedPool = getPgPool();
    sharedAdapter = new PrismaPg(sharedPool);
  }
  return sharedAdapter;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ adapter: getSharedAdapter() });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma connected to PostgreSQL Database successfully');
    } catch (err: any) {
      this.logger.error(`Prisma connection error: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    if (sharedPool) {
      await sharedPool.end();
    }
  }
}
