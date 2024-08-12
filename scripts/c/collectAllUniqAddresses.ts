import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from '../../src/blockchain/blockchain.service';
import { PrismaService } from '../../src/prisma.service';
import { readAddressesFromCsv } from '../../src/blockchain/libs/CsvWorker';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { ITransaction } from 'src/blockchain/dto/interactions.dto';

dotenv.config();

async function main() {
    const module: TestingModule = await Test.createTestingModule({
        providers: [BlockchainService, PrismaService],
    }).compile();

    const blockchainService = module.get<BlockchainService>(BlockchainService);
    const reportsDirectory = path.join(__dirname, '../../outputs');
    if (!fs.existsSync(reportsDirectory)) {
        fs.mkdirSync(reportsDirectory, { recursive: true });
    }

    let addresses: string[] = [];
    try {
        addresses = (await readAddressesFromCsv(
            path.join(__dirname, '../../inputs/bitkub_addresses.csv'))).map(addr => addr.toLowerCase());
        console.log("Addresses found: ", addresses);
    } catch (e) {
        console.error('Error reading addresses from CSV: ', e);
        process.exit(1);
    }

    const chunkSize = 1000;

    const addressSummary: { [key: string]: number } = {};
    const allUniqueAddresses = new Set<string>();

    for (let i = 0; i < addresses.length; i += chunkSize) {
        const chunk = addresses.slice(i, i + chunkSize);
        console.log(`Processing chunk ${i / chunkSize + 1}: Addresses ${i} to ${i + chunkSize}`);

        const result = await collectAllUniqueAddresses(blockchainService, chunk);
        console.log("Unique addresses found: ", result.length);

        result.forEach(addr => allUniqueAddresses.add(addr));

        chunk.forEach(addr => {
            addressSummary[addr] = (addressSummary[addr] || 0) + result.length;
        });
    }

    const uniqueAddressesArray = Array.from(allUniqueAddresses).filter(addr => addr !== '0x0000000000000000000000000000000000000000');
    console.log("Unique addresses total count: ", uniqueAddressesArray.length);
    console.log("Unique addresses sample: ", uniqueAddressesArray.slice(0, 50));

    console.log("Summary of unique addresses found per input address:");
    for (const [address, count] of Object.entries(addressSummary)) {
        console.log(`Address: ${address}, Unique addresses found: ${count}`);
    }

    const filePath = path.join(__dirname, '../../outputs', 'unique_addresses.txt');
    fs.writeFileSync(filePath, JSON.stringify(uniqueAddressesArray, null, 2), 'utf-8');

    console.log("Unique addresses saved to outputs/unique_addresses.txt");
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});

async function collectAllUniqueAddresses(blockchainService: BlockchainService, addresses: string[]): Promise<string[]> {
    const uniqueAddresses = new Set<string>();

    const transactions = await blockchainService.lookForArrayTransactions(addresses);
    console.log('collectAllUniqueAddresses. Transactions found:', transactions.length);

    for (const transaction of transactions) {
        if (!addresses.includes(transaction.from)) {
            uniqueAddresses.add(transaction.from);
        }

        if (!addresses.includes(transaction.to)) {
            uniqueAddresses.add(transaction.to);
        }
    }

    return Array.from(uniqueAddresses);
}



// private async getTransfers(contractAddress: string, address: string): Promise<ITokenTransfer[]> {
//     const whereClause = this.buildWhereClause(contractAddress, address);
//     return await this.prisma.tokenTransfer.findMany({ where: whereClause });
//   }

//   private async getTransactions(address: string): Promise<ITransaction[]> {
//     return await this.lookForTransactions(address);
//   }
  
//   private buildWhereClause(contractAddress: string, address: string) {
//     if (contractAddress && address) {
//       return {
//         OR: [
//           { contractAddress: contractAddress, to: address },
//           { contractAddress: contractAddress, from: address },
//         ],
//       };
//     } else if (contractAddress) {
//       return { contractAddress: contractAddress };
//     } else if (address) {
//       return {
//         OR: [{ from: address }, { to: address }],
//       };
//     } else {
//       return {};
//     }
//   }

// 0xDB044B8298E04D442FdBE5ce01B8cc8F77130e33 | Bitkub Hot Wallet 1
// 0x3d1D8A1d418220fd53C18744d44c182C46f47468 | Bitkub Hot Wallet 2
// 0x59E0cDA5922eFbA00a57794faF09BF6252d64126 | Bitkub Hot Wallet 3
// 0x1579B5f6582C7a04f5fFEec683C13008C4b0A520 | Bitkub Hot Wallet 4
// 0xB9C764114C5619a95d7f232594e3B8dDDF95b9CF | Bitkub Hot Wallet 5
// 0xCa7404EED62a6976Afc335fe08044B04dBB7e97D | Bitkub Hot Wallet 6
// 0x6254B927ecC25DDd233aAECD5296D746B1C006B4 | Bitkub Hot Wallet 7
// 0x79169E7818968cD0C6DBd8929f24d797CC1Af9A1 | Bitkub Multisig 1
// 0x0649Cef6D11ed6F88535462E147304d3FE5ae14D | KUB Token
// 0xBC920c934B2b773F2e148d2dad38717c63757C69 | Bitkub Deployer
// 0x49876520C866D138dd749d6C2C33e4DA5bfAeC66 | Bitkub Deposit Funder 2
// 0x9be7B0f285d04701f27682F591a60417C47d095A | Bitkub Deposit Funder 1