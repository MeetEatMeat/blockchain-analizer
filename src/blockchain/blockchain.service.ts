import { Injectable, NotFoundException } from '@nestjs/common';
import { BlockchainDto } from './dto/create-blockchain.dto';
import { UpdateBlockchainDto } from './dto/update-blockchain.dto';
import { PrismaService } from '../prisma.service';
import { Transaction, TokenTransfer, Prisma, Address, Label } from '@prisma/client';
import checkAffiliates from './libs/analisys';
import { BlockchainWorker } from './libs/blockchainWorker';
import { error } from 'console';
import { Label as LabelType } from './dto/labels.dto';
import { AddressResponse } from './dto/address.dto';

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

  async getLabels(address: string): Promise<LabelType[]> {
    const labelsFromDb = await this.loadLabels(address);

    if (labelsFromDb.length > 0) {
      return labelsFromDb;
    }

    try {
      const labelsFromApi = await this.worker.getLabels(address);
      console.log("Requesting labels from API for:", address);

      if (labelsFromApi.length > 0) {
        await this.storeLabels(labelsFromApi, address);
        return labelsFromApi;
      }

      return [];
    } catch (error) {
      console.error('Error fetching labels:', error);
      throw error;
    }
  }

  async loadLabels(address: string): Promise<LabelType[]> {
    const existingAddress = await this.prisma.address.findUnique({
      where: { address },
      include: { labels: true },
    });

    if (!existingAddress) {
      return [];
    }

    const labels = existingAddress.labels.map(label => ({
      address: existingAddress.address,
      chainId: label.chainId,
      label: label.label,
      name: label.name,
      symbol: label.symbol,
      website: label.website,
      image: label.image,
    }));

    return labels;
  }

  async storeLabels(labels: LabelType[], address: string): Promise<void> {
    await this.prisma.address.upsert({
      where: { address },
      update: {},
      create: {
        address,
        labels: {
          create: labels.map(label => ({
            chainId: label.chainId,
            label: label.label ?? null,
            name: label.name ?? null,
            symbol: label.symbol ?? null,
            website: label.website ?? null,
            image: label.image ?? null,
          })),
        },
      },
    });
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

  async collectExactAddressTransfers(address: string, target: string): Promise<TokenTransfer[]> {
    // Find all token transfers affiliated with the address
    console.log('collectExactAddressTransfers. Address:', address, 'Target:', target);
    const newTransfers = await this.updateTokenTransfers('', address);
    console.log('collectExactAddressTransfers. New transfers:', newTransfers.length);
    const addressTokenTransfers = await this.lookForAnyTokenTransfers(address);
    return addressTokenTransfers.filter(tx => tx.from === target || tx.to === target);
  }
  
  // async findERC20TransfersFromAddress(address: string): Promise<TokenTransfer[]> {
  //   await this.updateTokenTransfers('', address, true);
  //   try {
  //     return await this.lookForAnyTokenTransfers(address);
  //   } catch (error) {
  //     console.error('Error fetching transactions:', error);
  //     throw error;
  //   }
  // }

  // async findERC20TransfersFromContract(contractaddress: string): Promise<TokenTransfer[]> {
  //   await this.updateTokenTransfers(contractaddress, '', true);
  //   try {
  //     return await this.lookForAnyTokenTransfers(contractaddress);
  //   } catch (error) {
  //     console.error('Error fetching transactions:', error);
  //     throw error;
  //   }
  // }

  // async findTokenTransfersFromAddress(contractaddress: string, address: string): Promise<TokenTransfer[]> {
  //   await this.updateTokenTransfers(contractaddress, address, true);
  //   try {
  //     return await this.lookForExactTokenTransfers(contractaddress, address);
  //   } catch (error) {
  //     console.error('Error fetching transactions:', error);
  //     throw error;
  //   }
  // }

  // If contractAddress (token) is placed only, it will fetch all token transfers of that token. 
  // To and From are arbitrary
  // If address is placed only, it will fetch all token transfers from that address OR to
  // that address. ContractAddress (token) is arbitrary
  // If both contractAddress and address are placed, it will fetch all transfers of that token 
  // from that address OR to that address.
  async updateTokenTransfers(contractaddress: string, address: string, store: boolean = true): Promise<TokenTransfer[]> {
    const startBlock = await this.getLatestTokenTransferInDB(contractaddress, address);
    // const startBlock = 0;
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
        where: 
        {
          OR: [
            {
              contractAddress: contractAddress,
              from: address
            },
            {
              contractAddress: contractAddress,
              to: address
            }
          ],
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
          contractAddress: contractAddress
        },
        orderBy: {
          blockNumber: 'desc'
        },
        select: {
          blockNumber: true
        }
      });
    } else if (address) {
      result = await this.prisma.tokenTransfer.findFirst({
        where:
        {
          OR: [
            {
              from: address
            },
            {
              to: address
            }
          ],
        },
        orderBy: {
          blockNumber: 'desc'
        },
        select: {
          blockNumber: true
        }
      });
    } else {
      throw new NotFoundException('BlockchainService.tokenTransferGetLatestBlockInDB(): Invalid parameters');
    }
    return parseInt(result === null ? '0' : result.blockNumber);
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
    const txs = await this.prisma.tokenTransfer.findMany({
      where: {
        OR: [
          {from: address},
          {to: address}
        ]
      }
    });
    // console.log(`Fetched ${txs} token transfers from database`);
    return txs;
  }

  // async lookForAnyTokenTransfers(address: string): Promise<TokenTransfer[]> {
  //   const chunkSize = 100000;
  //   const txs: any[] = [];
  
  //   while (true) {
  //     const chunk = await this.prisma.transaction.findMany({
  //       where: {
  //         OR: [
  //           {from: address},
  //           {to: address}
  //         ]
  //       },
  //       skip: txs.length,
  //       take: chunkSize,
  //     });
  //     console.log(`Fetched ${chunk.length} transactions from database`);
  
  //     txs.push(...chunk);
  
  //     if (chunk.length === 0) {
  //       break;
  //     }
  //   }
  //   console.log(`Fetched ${txs.length} token transfers from database`);
  //   return txs;
  // }

  // async lookForExactTokenTransfers(contractAddress: string, fromAddress: string): Promise<TokenTransfer[]> {
  //   const chunkSize = 100000;
  //   const txs: TokenTransfer[] = [];
    
  //   while (true) {
  //     const chunk = await this.prisma.tokenTransfer.findMany({
  //       where: {
  //         from: fromAddress,
  //         contractAddress: contractAddress
  //       },
  //       skip: txs.length,
  //       take: chunkSize,
  //     });
      
  //     txs.push(...chunk);
      
  //     if (chunk.length === 0) {
  //       break;
  //     }
  //   }
  //   console.log(`Fetched ${txs.length} token transfers from database`);
  //   return txs;
  // }

  async collectAllContrparties(contractAddress: string, address: string): Promise<{ senders: AddressResponse[], receivers: AddressResponse[] }> {
    const senders = new Set<string>();
    const receivers = new Set<string>();

    let transfers: TokenTransfer[];

    if (contractAddress && address) {
      transfers = await this.prisma.tokenTransfer.findMany({
        where: {
          OR: [
            {
              contractAddress: contractAddress,
              to: address
            },
            {
              contractAddress: contractAddress,
              from: address
            }
          ],
        },
      });
    } else if (contractAddress) {
      transfers = await this.prisma.tokenTransfer.findMany({
        where: {
          contractAddress: contractAddress,
        },
      });
    } else if (address) {
      transfers = await this.prisma.tokenTransfer.findMany({
        where: {
          OR: [
            { from: address },
            { to: address }
          ],
        },
      });
    } else {
      transfers = [];
    }

    for (const transfer of transfers) {
      if (transfer.from === address) {
        receivers.add(transfer.to);
      }

      if (transfer.to === address) {
        senders.add(transfer.from);
      }

      if (transfer.from !== address && transfer.to !== address) {
        receivers.add(transfer.to);
        senders.add(transfer.from);
      }
    }

    const sendersArray = await this.getAddressResponses(Array.from(senders));
    const receiversArray = await this.getAddressResponses(Array.from(receivers));

    return {
      senders: sendersArray.sort((a, b) => a.address.localeCompare(b.address)),
      receivers: receiversArray.sort((a, b) => a.address.localeCompare(b.address))
    };
  }

  private async getAddressResponses(addresses: string[]): Promise<AddressResponse[]> {
    const responses: AddressResponse[] = [];

    for (const address of addresses) {
      const labels = await this.getLabels(address);
      const name = labels.length > 0 ? ((labels[0].name === null || typeof labels[0].name === 'undefined') ? '' : labels[0].name) : '';
      if(name.length > 0) responses.push({ address, name });
    }

    return responses;
  }


  // async collectAllContrparties(contractAddress: string, address: string): Promise<{ senders: string[], receivers: string[] }> {
  //   console.log('collectAllContrparties. contractAddress:', contractAddress, 'address:', address);
  //   const chunkSize = 100000;
  //   const senders: string[] = [];
  //   const receivers: string[] = [];

  //   let totalTransfers = 0;
  //   let skip = 0;

  //   while (true) {
  //     let transfers;

  //     if (contractAddress && address) {
  //       transfers = await this.prisma.tokenTransfer.findMany({
  //         where: {
  //           OR: [
  //             {
  //               contractAddress: contractAddress,
  //               to: address
  //             },
  //             {
  //               contractAddress: contractAddress,
  //               from: address
  //             }
  //           ],
  //         },
  //         skip: skip,
  //         take: chunkSize
  //       });
  //       console.log(`collectAllContrparties. Variant 1. Fetched ${transfers.length} token transfers from database`);
  //     } else if (contractAddress) {
  //       transfers = await this.prisma.tokenTransfer.findMany({
  //         where: {
  //           contractAddress: contractAddress,
  //         },
  //         select: {
  //           from: true,
  //           to: true
  //         },
  //         skip: skip,
  //         take: chunkSize
  //       });
  //       console.log(`collectAllContrparties. Variant 2. Fetched ${transfers.length} token transfers from database`);
  //     } else if (address) {
  //       transfers = await this.prisma.tokenTransfer.findMany({
  //         where: {
  //           OR: [
  //             { from: address },
  //             { to: address }
  //           ],
  //         },
  //         skip: skip,
  //         take: chunkSize
  //       });
  //       console.log(`collectAllContrparties. Variant 3. Fetched ${transfers.length} token transfers from database`);
  //     } else {
  //       transfers = [];
  //     }

  //     if (transfers.length === 0) {
  //       break;
  //     }

  //     totalTransfers += transfers.length;
  //     console.log(`collectAllContrparties. Fetched ${totalTransfers} token transfers from database`);

  //     transfers.forEach(transfer => {
  //       if (transfer.from === address) {
  //         console.log('Transfers ForEach. Variant 1. Receiver: ', transfer.to);
  //         receivers.push(transfer.to);
  //       } else if (transfer.to === address) {
  //         console.log('Transfers ForEach. Variant 2. Sender: ', transfer.from);
  //         senders.push(transfer.from);
  //       } else {
  //         senders.push(transfer.from);
  //         receivers.push(transfer.to);
  //         console.log('Transfers ForEach. Variant 3. Sender and Receiver: ', transfer.from, transfer.to);
  //       }
  //     });

  //     skip += chunkSize;
  //   }

  //   return {
  //     senders: senders,
  //     receivers: receivers
  //   };
  // }
}