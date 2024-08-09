import axios from 'axios';
import * as cheerio from 'cheerio';

async function findAddressesWithWord(baseUrl: string, word: string, pages: number): Promise<{ address: string, page: number }[]> {
    const results: { address: string, page: number }[] = [];

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': baseUrl
    };

    for (let page = 1; page <= pages; page++) {
        const url = `${baseUrl}-${page}.html`;

        try {
            const response = await axios.get(url, { headers });
            const html = response.data;
            const $ = cheerio.load(html);

            $('tr').each((_, element) => {
                const cells = $(element).find('td');
                if (cells.length > 1) {
                    const address = cells.eq(1).text().trim();
                    const rowText = $(element).text().toLowerCase();

                    if (rowText.includes(word.toLowerCase())) {
                        results.push({ address, page });
                    }
                }
            });
        } catch (error) {
            console.error(`Page parsing error ${page}:`, error);
        }
    }

    return results;
}

const baseUrl = 'https://bitinfocharts.com/top-100-richest-bitcoin-addresses';
const wordToSearch = 'bitkub';
const numberOfPages = 2;

findAddressesWithWord(baseUrl, wordToSearch, numberOfPages).then(addresses => {
    if (addresses.length > 0) {
        addresses.forEach(({ address, page }) => {
            console.log(`Address: ${address} found on: ${page}`);
        });
    } else {
        console.log('No addresses found');
    }
});
