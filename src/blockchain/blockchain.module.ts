import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [BlockchainController],
  providers: [BlockchainService, PrismaService],
})
export class BlockchainModule {}
