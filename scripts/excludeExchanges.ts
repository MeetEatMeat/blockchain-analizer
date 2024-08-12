import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import * as dotenv from 'dotenv';
dotenv.config();

const inputFilePath = path.join(__dirname, '../inputs/processed_bad_eth.csv');
const outputFilePath = path.join(__dirname, '../outputs/filtered_bad_eth.csv');

// Function to process the CSV file and make API requests
async function processCsvFile() {
    const addresses: string[] = [];

    // Read addresses from CSV
    try {
        addresses.push(...await readAddressesFromCsv(inputFilePath));
        console.log(`Addresses for requests found: ${addresses.length}`);
    } catch (e) {
        console.error('Error reading addresses from CSV:', e);
        process.exit(1);
    }

    const filteredAddresses: { address: string }[] = [];

    // Make API requests for each address
    for (const address of addresses) {
        const labelData = await fetchEntityLabel(address);
        if (labelData && (labelData.label === "No label found" || labelData.label.endsWith(".User"))) {
            filteredAddresses.push({ address: address });
        }
    }

    // Save filtered addresses to CSV
    if (filteredAddresses.length > 0) {
        saveCsvFile(filteredAddresses, outputFilePath);
    } else {
        console.log("No matching addresses found.");
    }
}

// Function to read addresses from CSV file
async function readAddressesFromCsv(filePath: string): Promise<string[]> {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const addresses: string[] = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                const address = row.Address.toLowerCase();
                addresses.push(address);
            })
            .on('end', () => resolve(addresses))
            .on('error', (error) => reject(error));
    });
}

// Function to fetch entity label using API
async function fetchEntityLabel(address: string): Promise<{ address: string, label: string } | null> {
    const OKLINK_API_KEY = process.env.OKLINK_API_KEY;
    const url = `https://www.oklink.com/api/v5/explorer/address/entity-label?chainShortName=eth&address=${address}`;

    if (!OKLINK_API_KEY) {
        console.error('API Key not found');
        process.exit(1);
    }

    try {
        const response = await axios.get(url, {
            headers: {
                'Ok-Access-Key': OKLINK_API_KEY
            }
        });

        if (response.data.code === "0" && response.data.data && response.data.data.length > 0) {
            return {
                address: response.data.data[0].address,
                label: response.data.data[0].label
            };
        } else {
            return { address, label: "No label found" };
        }
    } catch (error) {
        console.error(`Error fetching label for address ${address}:`, error);
        return null;
    }
}

// Function to save filtered addresses to a new CSV file
function saveCsvFile(data: { address: string }[], outputPath: string): void {
    if (data.length === 0) {
        console.log('No data to save.');
        return;
    }

    const csvWriter = createObjectCsvWriter({
        path: outputPath,
        header: [
            { id: 'address', title: 'Address' },
            { id: 'label', title: 'Label' }
        ]
    });

    csvWriter.writeRecords(data)
        .then(() => {
            console.log(`CSV file saved to ${outputPath} with filtered addresses.`);
        });
}

// Run the script
processCsvFile();
