import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from '../src/blockchain/blockchain.service';
import { PrismaService } from '../src/prisma.service';
import * as dotenv from 'dotenv';
import { saveTokenTransfersToCSV } from '../src/blockchain/libs/CsvWorker';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

async function main(contractaddress: string, address: string) {
    const module: TestingModule = await Test.createTestingModule({
        providers: [BlockchainService, PrismaService],
    }).compile();

    const blockchainService = module.get<BlockchainService>(BlockchainService);

    const worker = await blockchainService.getWorker();
    const startBlock = await blockchainService.getLatestTokenTransferInDB(contractaddress, address);
    console.log('updateTokenTransfers.Start block:', startBlock);
    const latestBlock = await worker.getLatestBlock();
    const tokenTransfers = await worker.fetchAllTokenTransfers(contractaddress, address, startBlock, latestBlock, 1, 10000, 'asc');
    console.log('Token transfers found: ', tokenTransfers.length);
    console.log('Dirname: ', __dirname);
    const reportsDirectory = path.join(__dirname, './outputs');
    if (!fs.existsSync(reportsDirectory)) {
        fs.mkdirSync(reportsDirectory, { recursive: true });
    }
    saveTokenTransfersToCSV(tokenTransfers, reportsDirectory, 'tokenTransfers.csv');
}

main('0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', '').catch(e => {
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
// '0x00000000000006b2ab6decbc6fc7ec6bd2fbc720' ONDO sender 1
// '0x0000000000007f150bd6f54c40a34d7c3d5e9f56' ONDO sender 2