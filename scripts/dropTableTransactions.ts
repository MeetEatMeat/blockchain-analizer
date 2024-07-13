import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from '../src/blockchain/blockchain.service';
import { PrismaService } from '../src/prisma.service';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    const module: TestingModule = await Test.createTestingModule({
        providers: [BlockchainService, PrismaService],
    }).compile();

    const blockchainService = module.get<BlockchainService>(BlockchainService);

    const counBefore = await blockchainService.getTransactionsCount();
    await blockchainService.deleteAllTransactions();
    const countAfter = await blockchainService.getTransactionsCount();
    console.log(`Number of transactions before: ${counBefore} Number of transactions after: ${countAfter}`);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});


// '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' Uniswap Uni token
// '0xb81d70802a816b5dacba06d708b5acf19dcd436d' Dextoken
// '0xba12222222228d8ba445958a75a0704d566bf2c8' Balancer vault
// '0xa1d0E215a23d7030842FC67cE582a6aFa3CCaB83' Yfii token
