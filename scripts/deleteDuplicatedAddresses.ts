import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import { readAddressesFromCsv } from '../src/blockchain/libs/CsvWorker';

const inputFilePath = path.join(__dirname, '../inputs/bad_btc.csv');
const outputFilePath = path.join(__dirname, '../outputs/processed_bad_btc.csv');

async function processCsvFile() {
    let requestAddresses: string[] = [];
    try {
        requestAddresses = await readUniqueAddressesFromCsv(inputFilePath);
        console.log("Addresses for requests found: ", requestAddresses.length);
    } catch (e) {
        console.error('Error reading request addresses from CSV: ', e);
        process.exit(1);
    }

    saveCsvFile(requestAddresses, outputFilePath);
}

const readUniqueAddressesFromCsv = async (filePath: string): Promise<string[]> => {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const uniqueAddresses = new Set<string>();
    const rows: any[] = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
                const address = data.Address;
                if (!uniqueAddresses.has(address)) {
                    uniqueAddresses.add(address);
                    data.Address = address;
                    rows.push(data);
                }
            })
            .on('end', () => {
                resolve(rows);
            })
            .on('error', (error) => reject(error));
    });
};

function saveCsvFile(data: any[], outputPath: string): void {
    if (data.length === 0) {
        console.log('No data to save.');
        return;
    }

    const csvWriter = createObjectCsvWriter({
        path: outputPath,
        header: Object.keys(data[0]).map(column => ({ id: column, title: column }))
    });

    csvWriter.writeRecords(data)
        .then(() => {
            console.log(`CSV file saved to ${outputPath} with addresses duplicates removed.`);
        });
}

processCsvFile();
