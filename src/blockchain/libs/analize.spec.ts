import checkAffiliates from './analize';
import axios from 'axios';
import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from '../blockchain.service';
import { PrismaService } from '../../prisma.service';
import { BlockchainWorker } from './blockchainWorker';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    const module: TestingModule = await Test.createTestingModule({
        providers: [BlockchainService, PrismaService],
    }).compile();

    const blockchainService = module.get<BlockchainService>(BlockchainService);
    const prismaService = module.get<PrismaService>(PrismaService);

    const worker: BlockchainWorker = new BlockchainWorker(process.env.ETH_API_KEY || '');
    const latestBlock = await worker.getLatestBlock();
    console.log("Latest block: ", latestBlock);

    const contractaddress = '0xa1d0E215a23d7030842FC67cE582a6aFa3CCaB83';
    const address = '0x7A57eaA048Dc74349743512B7Da762f7667A9108';

    // const result = await blockchainService.findAffiliates(address, 10);
    // const result = await blockchainService.addNewAddress(address);

    // const result = await blockchainService.findTokenTransfers('', address);

    // const result = await blockchainService.findTokenTransfers(contractaddress, '');

    // const result = await worker.getTokenTransfers(contractaddress, '', 0, latestBlock, 1, 10000, 'asc');
    // const result = await worker.getTokenTransfers('', address, 0, latestBlock, 1, 10000, 'asc');
    // const result = await worker.getTokenTransfers(contractaddress, address, 0, latestBlock, 1, 10000, 'asc');

    // const result = await worker.fetchAllTokenTransfers(contractaddress, address, 0, latestBlock, 1, 10000, 'asc');
    // const result = await worker.fetchAllTokenTransfers('', address, 0, latestBlock, 1, 10000, 'asc');
    // const result = await worker.fetchAllTokenTransfers(contractaddress, '', 0, latestBlock, 1, 10000, 'asc');


    console.log("Transfers found: " , result.length);

    // await prismaService.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});


// '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' Uniswap Uni token
// '0xb81d70802a816b5dacba06d708b5acf19dcd436d' Dextoken
// '0xba12222222228d8ba445958a75a0704d566bf2c8' Balancer vault
// '0xa1d0E215a23d7030842FC67cE582a6aFa3CCaB83' Yfii token
