import { Injectable, NotFoundException } from '@nestjs/common';
import { BlockchainDto } from './dto/create-blockchain.dto';
import { UpdateBlockchainDto } from './dto/update-blockchain.dto';
import { PrismaService } from '../prisma.service';
import { Transaction, TokenTransfer, Prisma } from '@prisma/client';
import checkAffiliates from './libs/analize';
import { BlockchainWorker } from './libs/blockchainWorker';

@Injectable()
export class BlockchainService {
  private worker: BlockchainWorker;

  constructor(private prisma: PrismaService) {
    this.worker = new BlockchainWorker(process.env.ETH_API_KEY || '');
  }

  updateWorker(apiKey: string) {
    this.worker = new BlockchainWorker(apiKey);
  }

  async addNewAddress(address: string): Promise<string> {
    const transactions = await this.updateDatabase(address, this.worker);
    return `Found and saved ${transactions.length} transactions for address: ${address}`;
  }

  async findAffiliates(address: string, range: number): Promise<string> {
    try {
      const allTransactions = await this.lookIntoDataBase(address);
      return checkAffiliates(allTransactions, range);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  async updateDatabase(address: string, worker: BlockchainWorker): Promise<Transaction[]> {
    // Find the latest block in the database
    const latestBlockInDb = await this.prisma.transaction.findFirst({
      where: {
        OR: [
          { from: address },
          { to: address }
        ]
      },
      orderBy: {
        blockNumber: 'desc'
      },
      select: {
        blockNumber: true
      }
    });

    const startBlock = latestBlockInDb ? parseInt(latestBlockInDb.blockNumber) + 1 : 0;
    console.log(`Starting block: ${startBlock}`);

    // Find the latest block on the network
    const latestBlock = await worker.getLatestBlock();
    console.log(`Latest block: ${latestBlock}`);

    // Fetch all transactions from the network for the given address
    const transactions = await worker.fetchAllTransactions(address, worker.getNetwork(), startBlock, latestBlock, 1, 10000, 'asc');
    console.log(`Fetched ${transactions.length} transactions`);

    // Save all transactions to the database
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
    console.log(`Found and saved ${transactions.length} transactions to database`);
    return transactions;
  }

  async lookIntoDataBase(address: string): Promise<Transaction[]>{
    const chunkSize = 100000;
    const txs: any[] = [];
  
    while (true) {
      const chunk = await this.prisma.transaction.findMany({
        where: {
          to: address
        },
        skip: txs.length,
        take: chunkSize,
      });
      // console.log("ChunkItems: ", chunk);
  
      txs.push(...chunk);
      console.log(`Fetched ${txs.length} transactions from database`);
  
      if (chunk.length === 0) {
        break;
      }
    }
  
    return txs;
  }
}