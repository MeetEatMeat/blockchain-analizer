import { Injectable, NotFoundException } from '@nestjs/common';
import { BlockchainDto } from './dto/create-blockchain.dto';
import { UpdateBlockchainDto } from './dto/update-blockchain.dto';
import { PrismaService } from '../prisma.service';
import { Transaction, TokenTransfer, Prisma } from '@prisma/client';
import checkAffiliates from './libs/analisys';
import { BlockchainWorker } from './libs/blockchainWorker';
import { error } from 'console';

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

  async deleteAllTransactions(): Promise<void> {
    try {
      const deleteResult = await this.prisma.transaction.deleteMany({});
      console.log(`Deleted ${deleteResult.count} transactions from the database`);
    } catch (error) {
      console.error('Error deleting transactions:', error);
      throw error;
    }
  }

  async getTransactionsCount(): Promise<number> {
    try {
      const count = await this.prisma.transaction.count();
      console.log(`Transactions count: ${count}`);
      return count;
    } catch (error) {
      console.error('Error fetching transactions count:', error);
      throw error;
    }
  }

  async updateTransactions(address: string): Promise<Transaction[]> {
    const startBlock = await this.transactionsGetLatestBlockInDB(address);
    const latestBlock = await this.worker.getLatestBlock();

    const transactions = await this.worker.fetchAllTransactions(address, startBlock, latestBlock, 1, 10000, 'asc');
    await this.saveToTransactions(transactions);

    return transactions;
  }

  async transactionsGetLatestBlockInDB(address: string): Promise<number> {
    const transactionsCount = await this.prisma.transaction.count();
    if (transactionsCount === 0) {
      return 0;
    }
    let result;
    if (address) {
      result = await this.prisma.transaction.findFirst({
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
    } else {
      throw new NotFoundException('BlockchainService.transactionsGetLatestBlockInDB(): Invalid parameters');
    }
    console.log('Latest block of transactions in db:', result);
    return parseInt(result.blockNumber);
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

  async deleteAllTokenTransfers(): Promise<void> {
    try {
      const deleteResult = await this.prisma.tokenTransfer.deleteMany({});
      console.log(`Deleted ${deleteResult.count} token transfers from the database`);
    } catch (error) {
      console.error('Error deleting token transfers:', error);
      throw error;
    }
  }

  async getTokenTransferCount(): Promise<number> {
    try {
      const count = await this.prisma.tokenTransfer.count();
      console.log(`Token transfer count: ${count}`);
      return count;
    } catch (error) {
      console.error('Error fetching token transfer count:', error);
      throw error;
    }
  }

  async checkTokenTransferRelations(address: string, target: string): Promise<TokenTransfer[]> {
    // Find all token transfers affiliated with the address
    const allTransfers = await this.updateTokenTransfers('', address, false);
    return allTransfers.filter(tx => tx.to === target || tx.from === target);
  }
  
  async findERC20TransfersFromAddress(address: string): Promise<TokenTransfer[]> {
    await this.updateTokenTransfers('', address, true);
    try {
      return await this.lookForAnyTokenTransfers(address);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  async findERC20TransfersFromContract(contractaddress: string): Promise<TokenTransfer[]> {
    await this.updateTokenTransfers(contractaddress, '', true);
    try {
      return await this.lookForAnyTokenTransfers(contractaddress);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  async findTokenTransfersFromAddress(contractaddress: string, address: string): Promise<TokenTransfer[]> {
    await this.updateTokenTransfers(contractaddress, address, true);
    try {
      return await this.lookForExactTokenTransfers(contractaddress, address);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  // If contractAddress (token) is placed only, it will fetch all token transfers of that token. 
  // To and From are arbitrary
  // If address is placed only, it will fetch all token transfers from that address OR to
  // that address. ContractAddress (token) is arbitrary
  // If both contractAddress and address are placed, it will fetch all transfers of that token 
  // from that address OR to that address.
  async updateTokenTransfers(contractaddress: string, address: string, store: boolean): Promise<TokenTransfer[]> {
    // const startBlock = await this.getLatestTokenTransferInDB(contractaddress, address);
    const startBlock = 0;
    console.log('updateTokenTransfers.Start block:', startBlock);
    const latestBlock = await this.worker.getLatestBlock();

    const tokenTransfers = await this.worker.fetchAllTokenTransfers(contractaddress, address, startBlock, latestBlock, 1, 10000, 'asc');
    if (store){
      await this.saveToTokenTransfers(tokenTransfers);
    }
    return tokenTransfers;
  }

  async getLatestTokenTransferInDB(contractAddress: string, address: string): Promise<number> {
    const tokenTransfersCount = await this.prisma.tokenTransfer.count();
    if (tokenTransfersCount === 0) {
      return 0;
    }
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
      console.log('Latest block in db Case 1', result);
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
      console.log('Latest block in db Case 2', result);
    } else if (address) {
      result = await this.prisma.tokenTransfer.findFirst({
        where: {
            from: address
        },
        orderBy: {
          blockNumber: 'desc'
        }
        // select: {
        //   blockNumber: true
        // }
      });
      console.log('Latest block in db Case 3', result);
    } else {
      throw new NotFoundException('BlockchainService.tokenTransferGetLatestBlockInDB(): Invalid parameters');
    }
    console.log('Latest block of token transfers in db: ', result);
    return parseInt(result.blockNumber);
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
          // console.log(`Duplicate token transfer found: ${tx.hash}`);
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