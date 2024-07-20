import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from '../src/blockchain/blockchain.service';
import { PrismaService } from '../src/prisma.service';
import * as dotenv from 'dotenv';

dotenv.config();

async function main(contractaddress: string, address: string) {
    const module: TestingModule = await Test.createTestingModule({
        providers: [BlockchainService, PrismaService],
    }).compile();

    const blockchainService = module.get<BlockchainService>(BlockchainService);

    const counBefore = await blockchainService.getTokenTransferCount();
    await blockchainService.updateTokenTransfers(contractaddress, address, true);
    const countAfter = await blockchainService.getTokenTransferCount();
    console.log(`Number of token transfers before: ${counBefore} Number of token transfers after: ${countAfter}`);
}

main('', '0x6a90063EEe5c46e874d382984D7f5860E5B00744').catch(e => {
    console.error(e);
    process.exit(1);
});

// '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' Uniswap Uni token
// '0xb81d70802a816b5dacba06d708b5acf19dcd436d' Dextoken
// '0x17aeea03942d24e5a8393513a3de08608b228939' Dextoken sender
// '0x77cbb281905cceb2d0268dbb4035dd3446707795' Dextoken sender 2
// '0x373f6cb03005afc7f928dfa41fad928fe60fcec6' Dextoken sender 3
// '0xba12222222228d8ba445958a75a0704d566bf2c8' Balancer vault
// '0xa1d0E215a23d7030842FC67cE582a6aFa3CCaB83' Yfii token
// '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3' ONDO token
// '0x6a90063EEe5c46e874d382984D7f5860E5B00744' ONDO sender 1