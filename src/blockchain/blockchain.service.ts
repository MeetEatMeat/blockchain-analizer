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

  async uploadAddressTransactions(address: string): Promise<string> {
    const transactions = await this.updateTransactions(address);
    return `Found and saved ${transactions.length} transactions for address: ${address}`;
  }

  async findAffiliates(address: string, range: number): Promise<string> {
    this.updateTransactions(address);
    try {
      const allTransactions = await this.lookForTransactions(address);
      return checkAffiliates(allTransactions, range);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  ///////////////////////////////////////////////////////////////////////////////////////
  // TRANSACTIONS
  ///////////////////////////////////////////////////////////////////////////////////////

  async updateTransactions(address: string): Promise<Transaction[]> {
    const startBlock = await this.getLatestBlockInDb(address);
    const latestBlock = await this.worker.getLatestBlock();

    const transactions = await this.worker.fetchAllTransactions(address, startBlock, latestBlock, 1, 10000, 'asc');
    await this.saveToTransactions(transactions);

    return transactions;
  }

  async getLatestBlockInDb(address: string): Promise<number> {
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
  
    return latestBlockInDb ? parseInt(latestBlockInDb.blockNumber) + 1 : 0;
  }

  async saveToTransactions(transactions: Transaction[]): Promise<void> {
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
  }

  async lookForTransactions(address: string): Promise<Transaction[]>{
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
  
      txs.push(...chunk);
      console.log(`Fetched ${txs.length} transactions from database`);
  
      if (chunk.length === 0) {
        break;
      }
    }
  
    return txs;
  }

  ///////////////////////////////////////////////////////////////////////////////////////
  // TOKEN TRANSFERS
  ///////////////////////////////////////////////////////////////////////////////////////

  async findERC20TransfersFromAddress(address: string): Promise<TokenTransfer[]> {
    this.updateTokenTransfers('', address);
    try {
      return await this.lookForAnyTokenTransfers(address);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  async findERC20TransfersFromContract(contractaddress: string): Promise<TokenTransfer[]> {
    this.updateTokenTransfers(contractaddress, '');
    try {
      return await this.lookForAnyTokenTransfers(contractaddress);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  async findTokenTransfersFromAddress(contractaddress: string, address: string): Promise<TokenTransfer[]> {
    this.updateTokenTransfers(contractaddress, address);
    try {
      return await this.lookForExactTokenTransfers(contractaddress, address);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  async updateTokenTransfers(contractaddress: string, address: string): Promise<TokenTransfer[]> {
    const latestBlockInDb = await this.tokenTransferGetLatestBlock(contractaddress, address);
    const startBlock = latestBlockInDb ? parseInt(latestBlockInDb.blockNumber) + 1 : 0;
    const latestBlock = await this.worker.getLatestBlock();

    const tokenTransfers = await this.worker.fetchAllTokenTransfers(contractaddress, address, startBlock, latestBlock, 1, 10000, 'asc');

    await this.saveToTokenTransfers(tokenTransfers);
    return tokenTransfers;
  }

  async tokenTransferGetLatestBlock(contractAddress: string, address: string): Promise<TokenTransfer> {
    let result;
    if (contractAddress && address) {
      result = await this.prisma.tokenTransfer.findFirst({
        where: {
            contractAddress: contractAddress,
            from: address
        },
        orderBy: {
          blockNumber: 'desc'
        },
        select: {
          blockNumber: true
        }
      });
    } else if (contractAddress) {
      result = await this.prisma.tokenTransfer.findFirst({
        where: {
            from: contractAddress
        },
        orderBy: {
          blockNumber: 'desc'
        },
        select: {
          blockNumber: true
        }
      });
    } else {
      result = await this.prisma.tokenTransfer.findFirst({
        where: {
            from: address
        },
        orderBy: {
          blockNumber: 'desc'
        },
        select: {
          blockNumber: true
        }
      });
    }
    return result;
  }

  async saveToTokenTransfers(tokenTransfers: TokenTransfer[]): Promise<void> {
    for (const tx of tokenTransfers) {
      try {
        await this.prisma.tokenTransfer.create({
          data: {
            hash: tx.hash,
            blockNumber: tx.blockNumber,
            timeStamp: tx.timeStamp,
            nonce: tx.nonce,
            blockHash: tx.blockHash,
            from: tx.from,
            contractAddress: tx.contractAddress,
            to: tx.to,
            value: tx.value,
            tokenName: tx.tokenName,
            tokenSymbol: tx.tokenSymbol,
            tokenDecimal: tx.tokenDecimal,
            transactionIndex: tx.transactionIndex,
            gas: tx.gas,
            gasPrice: tx.gasPrice,
            gasUsed: tx.gasUsed,
            cumulativeGasUsed: tx.cumulativeGasUsed,
            input: tx.input,
            confirmations: tx.confirmations,
          }
        });
      } catch (error) {
        if (error.code === 'P2002') {
          console.log(`Duplicate token transfer found: ${tx.hash}`);
        } else {
          throw error;
        }
      }
    }
  }

  async lookForAnyTokenTransfers(address: string): Promise<TokenTransfer[]> {
    const chunkSize = 100000;
    const txs: any[] = [];
  
    while (true) {
      const chunk = await this.prisma.transaction.findMany({
        where: {
          from: address
        },
        skip: txs.length,
        take: chunkSize,
      });
  
      txs.push(...chunk);
  
      if (chunk.length === 0) {
        break;
      }
    }
    console.log(`Fetched ${txs.length} token transfers from database`);
    return txs;
  }

  async lookForExactTokenTransfers(contractAddress: string, fromAddress: string): Promise<TokenTransfer[]> {
    const chunkSize = 100000;
    const txs: TokenTransfer[] = [];
    
    while (true) {
      const chunk = await this.prisma.tokenTransfer.findMany({
        where: {
          from: fromAddress,
          contractAddress: contractAddress
        },
        skip: txs.length,
        take: chunkSize,
      });
      
      txs.push(...chunk);
      
      if (chunk.length === 0) {
        break;
      }
    }
    console.log(`Fetched ${txs.length} token transfers from database`);
    return txs;
  }
}