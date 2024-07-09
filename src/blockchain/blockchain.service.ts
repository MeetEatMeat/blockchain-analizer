import { Injectable, NotFoundException } from '@nestjs/common';
import { BlockchainDto } from './dto/create-blockchain.dto';
import { UpdateBlockchainDto } from './dto/update-blockchain.dto';
import { PrismaService } from '../prisma.service';
import { Transaction, TokenTransfer, Prisma } from '@prisma/client';
import checkAffiliates from './libs/analize';
import { BlockchainWorker } from './libs/blockchainWorker';

@Injectable()
export class BlockchainService {
  private DATA = [{
    timestamp: 1632800000000,
    hash: ""
  }];

  constructor(private prisma: PrismaService) {}

  create(dto: BlockchainDto) {
    this.DATA.push({
      timestamp: dto.timestamp,
      hash: dto.hash
    });
    return this.DATA;
  }

  getData() {
    return this.DATA;
  }

  findOne(id: number) {
    return `This action returns a #${id} blockchain`;
  }

  update(timestamp: string, dto: UpdateBlockchainDto) {
    const transaction = this.DATA.find((data) => data.timestamp === +timestamp);
    if (!transaction) {
      throw new NotFoundException(`Transaction with timestamp ${timestamp} not found`);
    }
    transaction.hash = dto.hash;
    return transaction;
  }

  remove(id: number) {
    return `This action removes a #${id} blockchain`;
  }

  async findAffiliates(address: string) {
    const worker = new BlockchainWorker(process.env.ETH_API_KEY || '');
    const network = 'https://api.etherscan.io/api';

    const latestBlock = await worker.getLatestBlock(network);
    console.log(`Latest block: ${latestBlock}`);

    const transactions = await worker.fetchAllTransactions(address, network, 0, latestBlock, 1, 10000, 'asc');
    console.log(`Fetched ${transactions.length} transactions`);

    for (const tx of transactions) {
      try {
        await this.prisma.transaction.create({
          data: {
            hash: tx.hash,
            blockNumber: tx.blockNumber,
            timeStamp: tx.timeStamp,
            nonce: tx.nonce,
            blockHash: tx.blockHash,
            transactionIndex: tx.transactionIndex,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            gas: tx.gas,
            gasPrice: tx.gasPrice,
            isError: tx.isError,
            txreceipt_status: tx.txreceipt_status,
            input: tx.input,
            contractAddress: tx.contractAddress,
            cumulativeGasUsed: tx.cumulativeGasUsed,
            gasUsed: tx.gasUsed,
            confirmations: tx.confirmations,
          }
        });
      } catch (error) {
        if (error.code === 'P2002') {
          console.log(`Duplicate transaction found: ${tx.hash}`);
        } else {
          throw error;
        }
      }
    }

    console.log('Transactions saved to PostgreSQL database using Prisma');

    const savedTransactions = await this.prisma.transaction.findMany({
      where: {
        OR: [
          { from: address },
          { to: address }
        ]
      }
    });

    console.log('Saved transactions from database:', savedTransactions);

    // checkAffiliates(address);

    return `Found and saved ${transactions.length} transactions.`;
  }
}
