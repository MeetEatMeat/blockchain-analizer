import * as path from 'path';
import * as fs from 'fs';
import { readAddressesFromCsv } from '../src/blockchain/libs/CsvWorker';

async function main() {
    const reportsDirectory = path.join(__dirname, '../outputs');
    if (!fs.existsSync(reportsDirectory)) {
        fs.mkdirSync(reportsDirectory, { recursive: true });
    }
    const outputFilePath = path.join(reportsDirectory, 'bad_eth_txs_with_stack.json');

    let firstList: string[] = [];
    try {
        firstList = await readAddressesFromCsv(path.join(__dirname, '../inputs/addresses.csv'));
        console.log("Addresses for checking found: ", firstList.length);
    } catch (e) {
        console.error('Error reading addresses from CSV: ', e);
        process.exit(1);
    }

    const firstSet = new Set(firstList.map(addr => addr.toLowerCase()));

    let secondList: string[] = [];
    try {
        secondList = await readAddressesFromCsv(path.join(__dirname, '../inputs/bad_eth.csv'));
        console.log("Addresses for requests found: ", secondList.length);
    } catch (e) {
        console.error('Error reading request addresses from CSV: ', e);
        process.exit(1);
    }

    const secondSet = new Set(secondList.map(addr => addr.toLowerCase()));
    
    const commonAddresses = [...secondSet].filter(addr => firstSet.has(addr));
    console.log(`Common addresses found: ${commonAddresses.length}`);
    console.log("Common addresses: ", commonAddresses);

}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
