import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from '../src/blockchain/blockchain.service';
import { PrismaService } from '../src/prisma.service';
import { readAddressesFromCsv } from '../src/blockchain/libs/CsvWorker';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { ITokenTransfer, ITransaction } from 'src/blockchain/dto/interactions.dto';
import axios from 'axios';

dotenv.config();

async function main(contractaddress: string) {
    const apikey = process.env.ETH_API_KEY;
    console.log('API Key: ', apikey);
    const module: TestingModule = await Test.createTestingModule({
        providers: [BlockchainService, PrismaService],
    }).compile();

    const blockchainService = module.get<BlockchainService>(BlockchainService);

    const reportsDirectory = path.join(__dirname, '../outputs');
    if (!fs.existsSync(reportsDirectory)) {
        fs.mkdirSync(reportsDirectory, { recursive: true });
    }

    // Get addresses from CSV
    let csvAddresses: string[] = [];
    try {
        csvAddresses = await readAddressesFromCsv(path.join(__dirname, '../inputs/addresses.csv'));
        console.log("Addresses from CSV found: ", csvAddresses);
    } catch (e) {
        console.error('Error reading addresses from CSV: ', e);
        process.exit(1);
    };

    // Read unique addresses from file
    let uniqueAddresses: string[] = [];
    try {
        const filePath = path.join(__dirname, '../outputs', 'unique_addresses.txt');
        const fileData = fs.readFileSync(filePath, 'utf-8');
        uniqueAddresses = JSON.parse(fileData);
        console.log("Unique addresses found: ", uniqueAddresses.length);
    } catch (e) {
        console.error('Error reading unique addresses from file: ', e);
        process.exit(1);
    }

    // Filter out addresses that are already in the CSV
    const csvAddressSet = new Set(csvAddresses.map(addr => addr.toLowerCase()));
    uniqueAddresses = uniqueAddresses.filter(addr => !csvAddressSet.has(addr.toLowerCase()));
    console.log("Filtered unique addresses: ", uniqueAddresses.length);

    // Load progress
    const progressFilePath = path.join(__dirname, '../outputs', 'progress_update.json');
    let progress = 0;
    if (fs.existsSync(progressFilePath)) {
        const progressData = fs.readFileSync(progressFilePath, 'utf-8');
        progress = JSON.parse(progressData).progress;
    }

    const txArray: ITransaction[] = [];
    const ttArray: ITokenTransfer[] = [];

    for (let i = 50000; i < 60000; i++) {
        const address = uniqueAddresses[i];

        try {
            const response = await axios.get('https://api.etherscan.io/api', {
                params: {
                    module: 'account',
                    action: 'txlist',
                    address: address,
                    startblock: 0,
                    endblock: 99999999,
                    page: 1,
                    offset: 10000,
                    sort: 'asc',
                    apikey: apikey
                }
            });
            console.log(`Data for ${i + 1}/${uniqueAddresses.length}: ${address} txs: ${response.data.result.length}`);
            const txresult = response.data;
            if (txresult.status === '1') {
                txArray.push(...txresult.result);
            } else {
                console.error(`Error fetching transactions for ${address}:`, txresult.message);
            }
        } catch (error) {
            console.error(`Error fetching transactions for ${address}:`, error);
        }

        try {
            const response = await axios.get('https://api.etherscan.io/api', {
                params: {
                    module: 'account',
                    action: 'tokentx',
                    address: address,
                    startblock: 0,
                    endblock: 99999999,
                    page: 1,
                    offset: 10000,
                    sort: 'asc',
                    apikey: apikey
                }
            });

            const ttresult = response.data;
            if (ttresult.status === '1') {
                ttArray.push(...ttresult.result);
            } else {
                console.error(`Error fetching token transfers for ${address}:`, ttresult.message);
            }
        } catch (e) {
            console.error(`Error fetching token transfers for ${address}: `, e);
            break;
        }

        // Save progress
        fs.writeFileSync(progressFilePath, JSON.stringify({ progress: i + 1 }, null, 2), 'utf-8');
    }

    console.log("Fetched transactions: ", txArray.length);
    console.log("Fetched token transfers: ", ttArray.length);

    await blockchainService.saveToTransactions(txArray);
    await blockchainService.saveToTokenTransfers(ttArray);

    console.log("Data collection completed.");
}

main('').catch(e => {
    console.error(e);
    process.exit(1);
});

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