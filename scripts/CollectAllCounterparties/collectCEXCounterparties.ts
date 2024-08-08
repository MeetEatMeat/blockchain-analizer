import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from '../../src/blockchain/blockchain.service';
import { PrismaService } from '../../src/prisma.service';
import { readAddressesFromCsv } from '../../src/blockchain/libs/CsvWorker';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { AddressCounterparties } from 'src/blockchain/dto/interactions.dto';

dotenv.config();

async function main() {
    const module: TestingModule = await Test.createTestingModule({
        providers: [BlockchainService, PrismaService],
    }).compile();

    const blockchainService = module.get<BlockchainService>(BlockchainService);
    const reportsDirectory = path.join(__dirname, './outputs');
    if (!fs.existsSync(reportsDirectory)) {
        fs.mkdirSync(reportsDirectory, { recursive: true });
    }

    // Get addresses from CSV
    let addresses: string[] = [];
    try {
        addresses = await readAddressesFromCsv(path.join(__dirname, './inputs/addresses.csv'));
        console.log("Addresses found: ", addresses);
    } catch (e) {
        console.error('Error reading addresses from CSV: ', e);
        process.exit(1);
    };

    // Collect counterparties
    const c: AddressCounterparties[] = [];

    for (const address of addresses) {
        console.log("Collecting counterparties for address: ", address);
        console.log("Updating token transfers...");
        await blockchainService.updateTokenTransfers('', address.toLowerCase(), true);

        console.log("Updating transactions...");
        await blockchainService.updateTransactions(address.toLowerCase());

        console.log("Pushing found counterparties...");
        const result = await blockchainService.collectAllCounterparties('', address.toLowerCase());
        console.log("Counterparties found result: ", result.length);
        c.push({ address: address.toLowerCase(), counterparties: result });
    }

    console.log("Counterparties count: ", c.length);
    console.log("Counterparties: ", c);
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