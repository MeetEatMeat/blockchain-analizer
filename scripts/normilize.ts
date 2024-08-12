import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';

const inputFilePath = path.join(__dirname, '../inputs/bad_eth.csv');
const outputFilePath = path.join(__dirname, '../outputs/processed_bad_eth.csv');

async function processCsvFile() {
    let requestAddresses: string[] = [];
    try {
        requestAddresses = await readUniqueLowAddressesFromCsv(inputFilePath);
        console.log("Addresses for requests found: ", requestAddresses.length);
    } catch (e) {
        console.error('Error reading request addresses from CSV: ', e);
        process.exit(1);
    }

    saveCsvFile(requestAddresses, outputFilePath);
}

const readUniqueLowAddressesFromCsv = async (filePath: string): Promise<string[]> => {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const uniqueAddresses = new Set<string>();
    const rows: any[] = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
                const address = data.Address.toLowerCase();
                if (!uniqueAddresses.has(address)) {
                    uniqueAddresses.add(address);
                    data.Address = address;
                    rows.push(data);
                }
            })
            .on('end', () => resolve(rows))
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
            console.log(`CSV file saved to ${outputPath} with addresses in lowercase and duplicates removed.`);
        });
}

processCsvFile();
