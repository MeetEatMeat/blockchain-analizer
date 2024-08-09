import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from '../../src/blockchain/blockchain.service';
import { PrismaService } from '../../src/prisma.service';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

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

    // Read unique addresses from file
    let uniqueAddresses: string[] = [];
    try {
        const filePath = path.join(__dirname, '../../outputs', 'unique_addresses.txt');
        const fileData = fs.readFileSync(filePath, 'utf-8');
        uniqueAddresses = JSON.parse(fileData);
        console.log("Unique addresses found: ", uniqueAddresses.length);
    } catch (e) {
        console.error('Error reading unique addresses from file: ', e);
        process.exit(1);
    }

    // Load progress
    const progressFilePath = path.join(__dirname, '../../outputs', 'progress.json');
    let progress = 0;
    if (fs.existsSync(progressFilePath)) {
        const progressData = fs.readFileSync(progressFilePath, 'utf-8');
        progress = JSON.parse(progressData).progress;
    }

    // Open stream for appending results
    const counterpartiesFilePath = path.join(__dirname, '../../outputs', 'counterparties.json');
    const counterpartiesStream = fs.createWriteStream(counterpartiesFilePath, { flags: 'a' });

    // Collect counterparties
    for (let i = progress; i < uniqueAddresses.length; i++) {
        const address = uniqueAddresses[i];
        console.log(`Collecting counterparties for address ${i + 1}/${uniqueAddresses.length}: ${address}`);
        const result = await blockchainService.collectAllCounterparties('', address.toLowerCase());
        console.log(`Counterparties found for ${address}: `, result.length);

        // Write result to file
        counterpartiesStream.write(JSON.stringify({ address: address.toLowerCase(), counterparties: result }) + '\n');

        // Save progress
        fs.writeFileSync(progressFilePath, JSON.stringify({ progress: i + 1 }, null, 2), 'utf-8');

        // Delay to avoid rate limits or overwhelming the API
        // await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Close the stream
    counterpartiesStream.end();

    console.log("Counterparties collection completed.");
}

main().catch(e => {
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